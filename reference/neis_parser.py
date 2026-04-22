"""
neis_parser.py — GovIQ Estate Record Spine parser
ISO 19650-2:2018 Irish National Annex / HSE NEIS File Naming Convention (Rev 11, 01.03.2022)

Parses filenames and normalises building/campus codes for the Estate Record Spine
ingestion pipeline. Emits per-field confidence and a weighted record credibility score,
for calibration against pilot ground-truth.

Production note: regex definitions should be ported to TypeScript for app-side
validation inside the GovIQ Convex app. This Python module is the worker-side parser.

Version: 0.1.0 (pending pilot calibration)
"""

import re
from dataclasses import dataclass, field
from typing import Optional


# ---------------------------------------------------------------------------
# Field-level regex components (named captures)
# ---------------------------------------------------------------------------

_PROJECT = r"(?P<project>[A-Z0-9]{3,8})"
_PHASE = r"(?P<phase>PH(?:\d{2}|\d[A-Z]|XX|ZZ))"
_ELEMENT = r"(?P<element>\d{2}|XX|ZZ)"
_ZONE = r"(?P<zone>[A-Z])"
_LEVEL = r"(?P<level>[LMB]\d{2}|DTM|XXX|ZZZ)"
_INFOTYPE = r"(?P<info_type>[A-Z]{2})"
_ORIGINATOR = r"(?P<originator>[A-Z0-9]{2,5})"
_ROLE = r"(?P<role>[A-Z]{2})"
_NUMBER = r"(?P<number>\d{4,6})"
_TITLE = r"(?P<title>[^\\/]+?)"
_EXT = r"(?P<ext>\.[A-Za-z0-9]{2,4})"


# ---------------------------------------------------------------------------
# Full and minimum NEIS filename patterns
# ---------------------------------------------------------------------------

NEIS_FULL = re.compile(
    rf"^{_PROJECT}-{_PHASE}-{_ELEMENT}-{_ZONE}-{_LEVEL}-"
    rf"{_INFOTYPE}-{_ORIGINATOR}-{_ROLE}-{_NUMBER}-{_TITLE}{_EXT}$"
)

NEIS_MIN = re.compile(
    rf"^{_PROJECT}-{_LEVEL}-{_INFOTYPE}-{_ORIGINATOR}-{_ROLE}-"
    rf"{_NUMBER}-{_TITLE}{_EXT}$"
)


# ---------------------------------------------------------------------------
# Building (DN) and Campus (CMP) code patterns
# ---------------------------------------------------------------------------

DN_STRICT = re.compile(r"^DN\d{4}[A-Z]?$")
DN_PERMISSIVE = re.compile(r"^DN[\s\-]?(?P<digits>\d{3,6})(?P<suffix>[A-Z])?$")
CMP_STRICT = re.compile(r"^CMP\d{4}$")
CMP_PERMISSIVE = re.compile(r"^CMP[\s\-]?(?P<digits>\d{3,6})$")


def normalise_dn(raw: str) -> Optional[str]:
    """
    Canonicalise a DN code to DN + 4-digit zero-padded form.
    Returns None if the input doesn't match the permissive DN shape.

    Examples:
        DN101    -> DN0101
        DN-162   -> DN0162
        DN0081A  -> DN0081A  (suffix preserved)
    """
    if not raw:
        return None
    m = DN_PERMISSIVE.match(raw.strip())
    if not m:
        return None
    digits = m.group("digits")
    suffix = m.group("suffix") or ""
    return f"DN{digits.zfill(4)}{suffix}"


def normalise_cmp(raw: str) -> Optional[str]:
    """Canonicalise a CMP code to CMP + 4-digit zero-padded form."""
    if not raw:
        return None
    m = CMP_PERMISSIVE.match(raw.strip())
    if not m:
        return None
    return f"CMP{m.group('digits').zfill(4)}"


# ---------------------------------------------------------------------------
# Document view type — first digit of NEIS drawing number
# ---------------------------------------------------------------------------

VIEW_TYPES = {
    "0": "General",
    "1": "Plan",
    "2": "Elevation",
    "3": "Section",
    "4": "Schedule",
    "5": "Detail",
    "6": "RoomDataSheet",
    "7": "ReflectedCeilingPlan",
    "8": "ThreeDView",
    "9": "UserDefined",
}


# ---------------------------------------------------------------------------
# Parsed filename record
# ---------------------------------------------------------------------------

@dataclass
class ParsedFilename:
    raw: str
    pattern_matched: str  # "full" | "min" | "none"
    project: Optional[str] = None
    phase: Optional[str] = None
    element: Optional[str] = None
    zone: Optional[str] = None
    level: Optional[str] = None
    info_type: Optional[str] = None
    originator: Optional[str] = None
    role: Optional[str] = None
    number: Optional[str] = None
    title: Optional[str] = None
    ext: Optional[str] = None
    confidence: dict = field(default_factory=dict)

    @property
    def view_type(self) -> Optional[str]:
        if self.number:
            return VIEW_TYPES.get(self.number[0])
        return None


def parse_filename(name: str) -> ParsedFilename:
    """
    Parse a filename against NEIS full-form, then minimum-form.
    Returns ParsedFilename with per-field confidence.
    Legacy filenames that match neither are returned with pattern_matched='none'.
    """
    m = NEIS_FULL.match(name)
    if m:
        g = m.groupdict()
        return ParsedFilename(
            raw=name,
            pattern_matched="full",
            confidence={k: 0.95 for k in g if k != "ext"},
            **g,
        )
    m = NEIS_MIN.match(name)
    if m:
        g = m.groupdict()
        return ParsedFilename(
            raw=name,
            pattern_matched="min",
            confidence={k: 0.90 for k in g if k != "ext"},
            **g,
        )
    return ParsedFilename(raw=name, pattern_matched="none")


# ---------------------------------------------------------------------------
# Credibility scoring
# ---------------------------------------------------------------------------

FIELD_WEIGHTS = {
    # Identity — 40%
    "project": 0.15,
    "building_id": 0.15,
    "drawing_number": 0.10,
    # Classification — 30%
    "document_type": 0.10,
    "discipline": 0.10,
    "stage_or_phase": 0.05,
    "revision": 0.05,
    # Temporal — 15%
    "date_issued": 0.10,
    "date_superseded": 0.05,
    # Responsible parties — 15%
    "author_firm": 0.10,
    "certifier": 0.05,
}

LICENCE_PENALTIES = {
    "valid": 0.00,
    "unknown": -0.05,
    "student": -0.15,          # Autodesk Student watermark — non-commercial
    "watermarked_other": -0.10,
}

CREDIBILITY_GATES = {
    "publish": 0.85,
    "review": 0.70,
    # below 0.70 -> quarantine
}


def record_credibility(field_confidence: dict, licence_status: str = "valid") -> float:
    """
    Weighted credibility across fields, adjusted for licence status.
    Returns a float clamped to [0.0, 1.0].

    Routing thresholds:
        >= 0.85  -> auto-publish to master register
        >= 0.70  -> review queue, pre-populated for human confirm
        <  0.70  -> quarantine, weekly triage
    """
    score = sum(
        field_confidence.get(field_name, 0.0) * weight
        for field_name, weight in FIELD_WEIGHTS.items()
    )
    score += LICENCE_PENALTIES.get(licence_status, 0.0)
    return max(0.0, min(1.0, score))


def credibility_route(score: float) -> str:
    if score >= CREDIBILITY_GATES["publish"]:
        return "publish"
    if score >= CREDIBILITY_GATES["review"]:
        return "review"
    return "quarantine"


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("\n== NEIS filename parsing ==")
    samples = [
        "NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Distribution Board Schedule.pdf",
        "11534-L00-DR-HSE-AR-11001-Site Plan.pdf",   # minimum form
        "GF-Campus.pdf",                              # legacy, won't match
    ]
    for s in samples:
        p = parse_filename(s)
        print(f"  [{p.pattern_matched:4s}] {s}")
        if p.pattern_matched != "none":
            for k, v in p.__dict__.items():
                if k not in ("raw", "confidence", "pattern_matched") and v:
                    print(f"          {k}: {v}")

    print("\n== DN normalisation ==")
    for raw in ["DN0081", "DN101", "DN-101", "DN 0101", "DN0162A", "notadn"]:
        print(f"  {raw!r:12s} -> {normalise_dn(raw)}")

    print("\n== CMP normalisation ==")
    for raw in ["CMP0003", "CMP3", "CMP 0003"]:
        print(f"  {raw!r:12s} -> {normalise_cmp(raw)}")

    print("\n== Credibility scoring ==")
    # NEIS-compliant drawing: high confidence on every field, valid licence
    high = {k: 0.95 for k in FIELD_WEIGHTS}
    print(f"  NEIS-compliant, valid licence: {record_credibility(high, 'valid'):.3f}"
          f" -> {credibility_route(record_credibility(high, 'valid'))}")

    # GF-Campus.pdf-style: content extraction at ~0.85 avg, student watermark
    mid = {k: 0.85 for k in FIELD_WEIGHTS}
    print(f"  Legacy OCR, student licence:   {record_credibility(mid, 'student'):.3f}"
          f" -> {credibility_route(record_credibility(mid, 'student'))}")
