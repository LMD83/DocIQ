#!/usr/bin/env python3
"""
sort_folders.py v3 — HSE Estate folder reorganisation.

Free-first credibility scorer targeting ~90%+ publish on HSE DNREF legacy data.

Stacked evidence model:
  Identity
    - Parent folder is DN#### ................ +0.75
    - DN is registered in BuildingRegister ... +0.05
    - Filename contains DN .................... +0.05
    - Orphan-rescue (fuzzy building name) ..... +0.40 (scaled by 0.85)
    - Orphan-rescue (HSE project code 5-digit) +0.50 (scaled by 0.90)
  Classification
    - Route-keyword match on filename / path .. +0.15
  Content extraction (Tier A columns from ContentExtraction.csv)
    - Base content_score_boost ................ +0.05 .. +0.45 (70% of boost, capped 0.45)
    - Strong compliance (cert# + regs) ........ +0.08
    - Provenance (author_firm + date) ......... +0.05
    - Status clarity (approved / issued) ...... +0.03

Routing thresholds:
  >= 0.85  publish     (copy direct to canonical folder)
  >= 0.70  review      (copy to best-guess folder, flagged)
  <  0.70  quarantine  (copy to 99-Quarantine/)

Tier A route overrides — when content extraction names an explicit cert or
cert number, we override the keyword routing and send the file to the
matching compliance subfolder. DAC#, BCAR#, FSC#, ABP#, planning-ref all
route this way when present.

Usage:
  py sort_folders.py --source <DNREF> --target <Estate-Canonical> --codes <GovIQ-Codes>
  py sort_folders.py ... --apply         # real copy (safe; originals untouched)
  py sort_folders.py ... --apply --move  # move instead of copy
"""
import argparse
import csv
import os
import re
import shutil
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# ---------------------------------------------------------------------------
# Patterns
# ---------------------------------------------------------------------------
DN_ANY = re.compile(r"(DN|MH)[\s\-]?(\d{3,6})([A-Z])?", re.I)
DN_FOLDER = re.compile(r"^(DN|MH)(\d{4})[A-Z]?\s*-?\s*(.*)$", re.I)
HSE_PROJECT = re.compile(r"\b(\d{5})[A-Z]?\b")

ROUTE_HINTS = [
    # Statutory
    (re.compile(r"fire\s*cert|fire\s*safety\s*cert|\bfsc\b|\bfc\b|certificate\s+of\s+compliance", re.I), "30-Compliance/FSC"),
    (re.compile(r"\bdac\b|disability\s*access|part\s*m", re.I), "30-Compliance/DAC"),
    (re.compile(r"\bbcar\b|building\s*control|commencement\s*notice|assigned\s*certifier", re.I), "30-Compliance/BCAR"),
    (re.compile(r"\bhiqa\b|designated\s*centre|hiqa\s*regulation", re.I), "30-Compliance/HIQA"),
    (re.compile(r"\bber\b|energy\s*rating|seai|\bnzeb\b|\bdeap\b", re.I), "30-Compliance/BER"),
    (re.compile(r"planning|permission|\bpp\b|\bfcc\b|\babp\b|grant\s*of\s*permission|appeal", re.I), "50-Statutory/P03-PlanningPermission"),
    # Fire / risk / compliance
    (re.compile(r"\bfra\b|fire\s*risk|fire\s*inspection|fire\s*door|fire\s*alarm|fire\s*extinguisher|fire\s*strategy|life\s*safety|\bfse\b", re.I), "40-Surveys/FRA"),
    (re.compile(r"asbestos|\bohss\b|hazardous\s*material|chrysotile", re.I), "40-Surveys/Asbestos"),
    (re.compile(r"condition\s*survey|schedule\s*of\s*condition|defects?\s*walk|defects?\s*report|dilapidation", re.I), "40-Surveys/Condition"),
    (re.compile(r"\bm&e\b|mechanical\s*(and|&)\s*electrical|m\s*and\s*e\b|m&e\s*inspection", re.I), "40-Surveys/MandE"),
    (re.compile(r"legionella|water\s*(quality|test|safety)", re.I), "40-Surveys/Legionella"),
    (re.compile(r"accessibility\s*audit|access\s*audit", re.I), "40-Surveys/Accessibility"),
    # Drawings
    (re.compile(r"as\s*[-]?\s*constructed|record\s*drawing|as\s*built", re.I), "10-RecordDrawings/AsBuilt"),
    (re.compile(r"\.dwg$|\.dxf$|\.pln$|\.rvt$|\.ifc$", re.I), "10-RecordDrawings/CAD"),
    (re.compile(r"architectural|\barch\b|floor\s*plan|site\s*plan|general\s*arrangement|\bga\b[\s\-]*plan", re.I), "10-RecordDrawings/Architectural"),
    (re.compile(r"structural|\bstr\b", re.I), "10-RecordDrawings/Structural"),
    (re.compile(r"mechanical(?!.*electrical)|hvac|heating|ventilation", re.I), "10-RecordDrawings/Mechanical"),
    (re.compile(r"electrical(?!.*mechanical)|\belec\b|lighting", re.I), "10-RecordDrawings/Electrical"),
    (re.compile(r"civil|drainage|\bsw\b|foul|storm\s*water|manhole", re.I), "10-RecordDrawings/Civil"),
    (re.compile(r"drawing|\bdwg\b|plan|layout|elevation|section|detail", re.I), "10-RecordDrawings"),
    # O&M
    (re.compile(r"o\s*&\s*m|o&m|operation\s*maintenance|\bom\s*manual|o\s*and\s*m|user\s*manual", re.I), "20-OMManuals"),
    (re.compile(r"room\s*data\s*sheet|\brds\b", re.I), "20-OMManuals/RoomDataSheets"),
    # Procurement / contract
    (re.compile(r"\btender\b|etender|procure|\bittp?\b|\brfq\b|prior\s*information", re.I), "60-Procurement/Tender"),
    (re.compile(r"contract|\bagreement\b|bills?\s*of\s*quantit|bill\s*of\s*quants|\bbq\b", re.I), "60-Procurement/Contract"),
    (re.compile(r"evaluation|assessment\s*report|scoring", re.I), "60-Procurement/Evaluation"),
    # Construction
    (re.compile(r"\bcow\b|clerk\s*of\s*works|site\s*meeting|site\s*report|site\s*inspection|weekly\s*report", re.I), "70-Construction/CoW"),
    (re.compile(r"\brfi\b|request\s*for\s*info", re.I), "70-Construction/RFI"),
    (re.compile(r"variation|\bvo\b[\s\-]?\d|change\s*order", re.I), "70-Construction/Variations"),
    (re.compile(r"method\s*statement|\brams\b|risk\s*assessment(?!.*fire)", re.I), "70-Construction/Methods"),
    # Handover / defects
    (re.compile(r"handover|safety\s*file|\bpsdp\b|\bpscs\b|\bpsh\b", re.I), "80-Handover"),
    (re.compile(r"snag|punchlist|defect|outstanding\s*works", re.I), "90-Defects"),
    # Governance
    (re.compile(r"business\s*case|\bpad\b[\s\-]|option\s*appraisal|feasibility|brief", re.I), "00-Governance/Brief"),
    (re.compile(r"programme|schedule\s*of\s*works|gantt", re.I), "00-Governance/Programme"),
    (re.compile(r"minute|meeting|agenda", re.I), "00-Governance/Meetings"),
    (re.compile(r"schedule\s*of\s*accommodation|\bsoa\b", re.I), "00-Governance/SoA"),
    (re.compile(r"correspondence|email|letter|memo|\.msg$|\.eml$", re.I), "00-Governance/Correspondence"),
    # Lease / property
    (re.compile(r"lease|licence|tenancy|tenure|\bfolio\b|title\s*deed|registration\s*of\s*ownership|map\s*of\s*title", re.I), "30-Compliance/Lease"),
    (re.compile(r"insurance|indemnity", re.I), "30-Compliance/Insurance"),
    # Capital projects
    (re.compile(r"capital\s*project|refurbishment|renovation|extension|alteration|new\s*build|fit[\s\-]out", re.I), "00-Governance/CapitalProject"),
    (re.compile(r"kitchen\s*refurb|kitchen\s*works", re.I), "70-Construction/CapitalProject/Kitchen"),
    (re.compile(r"roof\s*replacement|roof\s*works|roof\s*repair", re.I), "70-Construction/CapitalProject/Roof"),
    (re.compile(r"car\s*park|parking", re.I), "70-Construction/CapitalProject/CarPark"),
    (re.compile(r"accessibility\s*upgrade|ramp|lift\s*install", re.I), "70-Construction/CapitalProject/Accessibility"),
    # Emergency / evacuation
    (re.compile(r"evacuation|emergency\s*plan|\bphe\b|progressive\s*horizontal", re.I), "40-LifeSafety/Evacuation"),
    # Photos / media
    (re.compile(r"\.jpg$|\.jpeg$|\.png$|\.heic$|\.tif$|\.tiff$|\.gif$|\.bmp$|photo|image|picture", re.I), "50-Photos"),
    (re.compile(r"\.mp4$|\.avi$|\.mov$|video", re.I), "50-Photos/Video"),
    # Finance
    (re.compile(r"invoice|payment|cost\s*plan|cost\s*report|\bcapex\b|budget", re.I), "60-Procurement/Finance"),
    # Generic fallbacks — keep these late so specific matches win
    (re.compile(r"report", re.I), "40-Surveys/Other"),
    (re.compile(r"specification|\bspec\b", re.I), "10-RecordDrawings/Specifications"),
    (re.compile(r"schedule", re.I), "10-RecordDrawings/Schedules"),
    (re.compile(r"proposal|quote|quotation", re.I), "60-Procurement/Quotes"),
    (re.compile(r"property|deed|title", re.I), "30-Compliance/Lease"),
    (re.compile(r"admin|administration", re.I), "00-Governance"),
    (re.compile(r"general|misc|miscellaneous", re.I), "00-Passport"),
    (re.compile(r"historic|legacy|archive|old", re.I), "00-Passport/Historic"),
    (re.compile(r"tenure|ownership|folio|registration\s*of\s*ownership", re.I), "30-Compliance/Lease"),
    (re.compile(r"ppp|public\s*private|funding|grant|capital\s*allocation", re.I), "00-Governance/Funding"),
    (re.compile(r"operational|operations|\bops\b", re.I), "00-Governance/Operations"),
    (re.compile(r"background|notes|general\s*info|reference", re.I), "00-Passport/Reference"),
    (re.compile(r"template", re.I), "00-Passport/Templates"),
    (re.compile(r"hiqa\s*drawing|compliance\s*drawing", re.I), "30-Compliance/HIQA/Drawings"),
    (re.compile(r"inspection|audit", re.I), "40-Surveys/Inspection"),
    (re.compile(r"commissioning|test\s*cert|test\s*certificate", re.I), "30-Compliance/Commissioning"),
    (re.compile(r"gas\s*safety|electrical\s*safety|\beic\b", re.I), "30-Compliance/SafetyCerts"),
    (re.compile(r"survey", re.I), "40-Surveys"),
]

# Tier A → route override when specific cert numbers detected.
# Highest-priority first; the first hit wins.
TIER_A_ROUTE_OVERRIDES = [
    ("dac_num",      "30-Compliance/DAC"),
    ("bcar_num",     "30-Compliance/BCAR"),
    ("fsc_refs",     "30-Compliance/FSC"),
    ("abp_num",      "50-Statutory/P03-PlanningPermission/ABP"),
    ("planning_num", "50-Statutory/P03-PlanningPermission"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def sanitize_path_part(name: str) -> str:
    """Strip Windows-invalid characters and trailing spaces/dots."""
    if not name:
        return ""
    name = str(name).strip().rstrip(". ").strip()
    name = re.sub(r'[<>:"|?*]', "", name)
    name = re.sub(r"\s+", " ", name)
    return name[:80].strip().rstrip(". ").strip()


def norm_dn(raw: Optional[str]) -> Optional[str]:
    if not raw:
        return None
    m = DN_ANY.search(str(raw))
    if not m:
        return None
    return f"{m.group(1).upper()}{m.group(2).zfill(4)}{(m.group(3) or '').upper()}"


def dn_from_folder(folder_name: str) -> Optional[str]:
    if not folder_name:
        return None
    m = DN_FOLDER.match(folder_name)
    if m:
        return f"{m.group(1).upper()}{m.group(2).zfill(4)}"
    return None


def route(text_lower: str) -> Tuple[str, bool]:
    """Keyword routing. Returns (target_subfolder, matched_specific_hint)."""
    for pat, dest in ROUTE_HINTS:
        if pat.search(text_lower):
            return dest, True
    return "00-Passport", False


def fuzzy_match_building(text: str, names_lower) -> Tuple[Optional[str], float]:
    """Match folder/file text against known building names. Returns (site_code, confidence)."""
    if not text:
        return (None, 0.0)
    tl = text.lower()
    best: Tuple[Optional[str], float] = (None, 0.0)
    for dn, name_lower, name_len in names_lower:
        if name_len < 6:
            continue
        if name_lower in tl:
            conf = 0.65 if name_len > 12 else 0.50
            if conf > best[1]:
                best = (dn, conf)
    return best


def project_code_to_dn(text: str, project_index) -> Optional[str]:
    if not text:
        return None
    m = HSE_PROJECT.search(text)
    if m:
        return project_index.get(m.group(0).upper())
    return None


def credibility_route(score: float) -> str:
    if score >= 0.85:
        return "publish"
    if score >= 0.70:
        return "review"
    return "quarantine"


def compute_score(
    dn_from_path: Optional[str],
    dn_from_name: Optional[str],
    dn_in_registry: bool,
    has_route_match: bool,
    orphan_rescue: Optional[str],  # "fuzzy" | "project" | None
    ce: Optional[dict],
) -> float:
    """
    Stacked evidence scorer. See module docstring for the model.
    """
    score = 0.0

    # Identity
    if dn_from_path:
        score += 0.75
    elif orphan_rescue == "fuzzy":
        score += 0.40  # weaker than explicit DN folder, but still meaningful
    elif orphan_rescue == "project":
        score += 0.50
    if dn_in_registry:
        score += 0.05
    if dn_from_name:
        score += 0.05

    # Classification
    if has_route_match:
        score += 0.15

    # Content extraction (Tier A-aware)
    if ce:
        base_boost = max(0.05, min(0.45, float(ce.get("content_score_boost", 0.0)) * 0.7))
        score += base_boost

        strong_compliance = (
            any(ce.get(k) for k in ("dac_num", "bcar_num", "fsc_refs", "abp_num", "planning_num"))
            and (ce.get("certifier") or ce.get("reg_refs"))
        )
        if strong_compliance:
            score += 0.08

        provenance = bool(ce.get("author_firm")) and bool(ce.get("dates"))
        if provenance:
            score += 0.05

        if ce.get("doc_status") in ("issued", "approved", "granted", "completed"):
            score += 0.03

    # Rescue-mode penalty — orphan-rescue matches are less certain than folder DNs
    if orphan_rescue == "fuzzy":
        score *= 0.85
    elif orphan_rescue == "project":
        score *= 0.90

    return min(1.0, score)


def tier_a_route_override(ce: Optional[dict]) -> Optional[str]:
    """If Tier A extracted a specific cert number, override keyword routing."""
    if not ce:
        return None
    for col, target in TIER_A_ROUTE_OVERRIDES:
        if ce.get(col):
            return target
    return None


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_buildings(codes: Path):
    buildings = {}
    names_lower = []
    path = codes / "BuildingRegister.csv"
    if not path.exists():
        return buildings, names_lower
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            code = (r.get("site_code") or "").strip()
            if not code or code == "UNREGISTERED":
                continue
            buildings.setdefault(code, []).append(r)
            nm = (r.get("name") or "").strip()
            if nm and len(nm) > 6:
                names_lower.append((code, nm.lower(), len(nm)))
    names_lower.sort(key=lambda x: -x[2])
    return buildings, names_lower


def load_sites(codes: Path):
    sites = {}
    path = codes / "SitesRegister.csv"
    if not path.exists():
        return sites
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            sites[r["site_code"]] = r
    return sites


def load_project_index(codes: Path):
    project_index = {}
    path = codes / "ProjectRegister.csv"
    if not path.exists():
        return project_index
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            code = (r.get("project_code") or "").strip().upper()
            dn = (r.get("dn_canonical") or "").strip()
            if code and dn:
                project_index[code] = dn
            for m in HSE_PROJECT.finditer(r.get("reference") or ""):
                project_index[m.group(0).upper()] = dn
    return project_index


def load_content_extraction(codes: Path):
    """
    Load ContentExtraction.csv into a dict keyed by "site_code|relative_path".
    Returns the full row — scorer downstream uses multiple Tier A columns.
    """
    ce_by_key = {}
    path = codes / "ContentExtraction.csv"
    if not path.exists():
        return ce_by_key
    with open(path, encoding="utf-8") as f:
        for r in csv.DictReader(f):
            key = f"{r.get('site_code','')}|{r.get('relative_path','')}"
            ce_by_key[key] = r
    return ce_by_key


# ---------------------------------------------------------------------------
# Plan row
# ---------------------------------------------------------------------------

@dataclass
class SortPlan:
    source_path: str
    size_bytes: int
    site_code: str
    folder_name: str
    proposed_target: str
    info_folder: str
    credibility: float
    routing: str
    ce_boost: float
    evidence: str  # "folder+keyword+ce-tierA" etc.
    notes: str


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="HSE Estate folder reorganisation (v3).")
    ap.add_argument("--source", required=True, help="Legacy tree root (e.g. DNREF)")
    ap.add_argument("--target", required=True, help="Canonical output tree root")
    ap.add_argument("--codes", required=True, help="GovIQ-Codes dir (registers + ContentExtraction.csv)")
    ap.add_argument("--apply", action="store_true", help="Execute copy (default: dry-run)")
    ap.add_argument("--move", action="store_true", help="Move instead of copy when --apply")
    args = ap.parse_args()

    source = Path(args.source).resolve()
    target = Path(args.target).resolve()
    codes = Path(args.codes).resolve()

    buildings, names_lower = load_buildings(codes)
    sites = load_sites(codes)
    project_index = load_project_index(codes)
    ce_by_key = load_content_extraction(codes)

    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    audit_dir = target / "_Index"
    audit_dir.mkdir(parents=True, exist_ok=True)
    audit_path = audit_dir / f"SortAudit-{ts}.csv"
    review_path = audit_dir / f"CredibilityReview-{ts}.csv"

    stats = {"publish": 0, "review": 0, "quarantine": 0, "total": 0}
    audit: list[SortPlan] = []

    print(f"Walking {source} ...")
    for root, _dirs, files in os.walk(source):
        rel_from_source = Path(root).relative_to(source)
        parts = rel_from_source.parts

        # Find first DN folder anywhere in the path (supports Archive/DN####/...)
        dn_from_path: Optional[str] = None
        dn_folder_name: str = parts[0] if parts else ""
        dn_idx = 0
        for i, p in enumerate(parts):
            d = dn_from_folder(p)
            if d:
                dn_from_path = d
                dn_folder_name = p
                dn_idx = i
                break

        # Orphan rescue — no DN folder found
        orphan_rescue: Optional[str] = None
        if not dn_from_path and parts:
            first = parts[0]
            f_dn, _conf = fuzzy_match_building(first, names_lower)
            if f_dn:
                dn_from_path = f_dn
                dn_folder_name = f"FUZZY-{first[:40]}"
                orphan_rescue = "fuzzy"
            else:
                p_dn = project_code_to_dn(first, project_index)
                if p_dn:
                    dn_from_path = p_dn
                    dn_folder_name = f"PROJECT-{first[:40]}"
                    orphan_rescue = "project"

        rel_inside_dn = Path(*parts[dn_idx + 1:]) if len(parts) > dn_idx + 1 else Path()

        for fn in files:
            if fn.startswith("~$"):
                continue
            stats["total"] += 1
            path = Path(root) / fn
            try:
                sz = path.stat().st_size
            except OSError:
                sz = 0

            dn_from_name = norm_dn(fn)
            full_path_text = f"{rel_from_source} {fn}".lower()
            dest_sub, has_route = route(full_path_text)

            rel_in_dn = str(rel_inside_dn / fn).replace("\\", "/")
            ce_key = f"{dn_from_path}|{rel_in_dn}" if dn_from_path else None
            ce_row = ce_by_key.get(ce_key) if ce_key else None
            boost = float(ce_row.get("content_score_boost") or 0.0) if ce_row else 0.0

            # Tier A route override trumps keyword routing when specific cert
            # numbers are present
            override = tier_a_route_override(ce_row)
            if override:
                dest_sub = override
                has_route = True  # cert number is a strong classification signal

            dn_in_registry = bool(dn_from_path and dn_from_path in buildings)
            score = compute_score(
                dn_from_path=dn_from_path,
                dn_from_name=dn_from_name,
                dn_in_registry=dn_in_registry,
                has_route_match=has_route,
                orphan_rescue=orphan_rescue,
                ce=ce_row,
            )
            routing = credibility_route(score)

            # Target path
            site_code = dn_from_path or "UNSORTED"
            if site_code in sites:
                short = sites[site_code].get("short_name", "Site") or "Site"
            else:
                short = dn_folder_name[:30]
            short = re.sub(r"^(DN|MH)\d+[A-Z]?[\s\-]*", "", short, flags=re.I)
            short = sanitize_path_part(short) or "Site"
            safe_folder = sanitize_path_part(dn_folder_name) or "UNKNOWN"
            safe_sub_parts = [sanitize_path_part(p) for p in dest_sub.split("/") if sanitize_path_part(p)]
            safe_sub = Path(*safe_sub_parts) if safe_sub_parts else Path("00-Passport")
            if routing == "quarantine":
                tgt_dir = target / "99-Quarantine" / safe_folder
            else:
                tgt_dir = target / "01-Sites" / f"{site_code}-{short}" / safe_sub

            evidence_parts = []
            if dn_from_path and not orphan_rescue:
                evidence_parts.append("folder")
            elif orphan_rescue:
                evidence_parts.append(f"rescue:{orphan_rescue}")
            if has_route:
                evidence_parts.append("keyword")
            if ce_row:
                evidence_parts.append("ce" + ("+tierA" if any(ce_row.get(k) for k in ("dac_num", "bcar_num", "certifier", "author_firm", "reg_refs")) else ""))

            notes = ""
            if override:
                notes = f"tier-a-route={override}"

            plan = SortPlan(
                source_path=str(path),
                size_bytes=sz,
                site_code=site_code,
                folder_name=dn_folder_name,
                proposed_target=str(tgt_dir / fn),
                info_folder=dest_sub,
                credibility=round(score, 3),
                routing=routing,
                ce_boost=round(boost, 3),
                evidence=",".join(evidence_parts) or "none",
                notes=notes,
            )
            audit.append(plan)
            stats[routing] += 1

            if args.apply:
                tgt_dir.mkdir(parents=True, exist_ok=True)
                tgt = tgt_dir / fn
                if not tgt.exists():
                    if args.move:
                        shutil.move(str(path), str(tgt))
                    else:
                        shutil.copy2(str(path), str(tgt))

    # Write audit + review queue
    if audit:
        fieldnames = list(asdict(audit[0]).keys())
        with open(audit_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for p in audit:
                w.writerow(asdict(p))
        with open(review_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            for p in audit:
                if p.routing != "publish":
                    w.writerow(asdict(p))

    print("\n=== SUMMARY ===")
    t = max(1, stats["total"])
    print(f"  Total files:     {stats['total']:,}")
    print(f"  Publish (>=.85): {stats['publish']:,}  ({100 * stats['publish'] / t:.1f}%)")
    print(f"  Review  (>=.70): {stats['review']:,}  ({100 * stats['review'] / t:.1f}%)")
    print(f"  Quarantine:      {stats['quarantine']:,}  ({100 * stats['quarantine'] / t:.1f}%)")
    print(f"\n  Audit log:       {audit_path}")
    print(f"  Review queue:    {review_path}")
    if not args.apply:
        print("\n  DRY RUN — no files moved. Re-run with --apply to execute.")


if __name__ == "__main__":
    main()
