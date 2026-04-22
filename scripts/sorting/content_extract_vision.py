#!/usr/bin/env python3
"""
content_extract_vision.py — PAID add-on: Claude vision for site photos.

Walks image files (JPG/PNG/HEIC/TIFF) in FileInventory.csv, sends each to
Claude with a structured-output schema, and records a caption + tagged
signals (subjects, equipment, condition, apparent_date_from_image) to
ContentExtractionVision.csv.

This is OPTIONAL and costs money. Default pricing ~€0.005–0.02 per photo at
Claude Haiku rates. Resumable — re-running skips photos already in the
output CSV.

Model: claude-haiku-4-5-20251001 (latest Haiku at time of writing).
Override with --model claude-sonnet-4-6 for more accuracy at higher cost.

Usage:
  set ANTHROPIC_API_KEY=sk-ant-...
  py content_extract_vision.py
  py content_extract_vision.py --limit 50       # test on 50 photos first
  py content_extract_vision.py --dry-run        # cost estimate, no API calls

Zero-retention: configure zero-retention on the API key at
console.anthropic.com before processing customer data.
"""
import argparse
import base64
import csv
import json
import os
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
DNREF_ROOT = Path(os.environ.get("DNREF_ROOT", r"C:\Users\gavin\Downloads\fwdeets\DNREF"))
CODES_DIR = Path(os.environ.get("GOVIQ_CODES", r"C:\Users\gavin\Downloads\GovIQ-Codes"))
INVENTORY_CSV = CODES_DIR / "FileInventory.csv"
RESULTS_CSV = CODES_DIR / "ContentExtractionVision.csv"

IMAGE_EXTS = {"jpg", "jpeg", "png", "heic", "tif", "tiff", "gif", "bmp", "webp"}

# Per-image cost ballpark (Haiku, ~0.3MP scaled-down image + ~300 token response)
# Adjust if you switch models.
COST_PER_IMAGE_EUR = 0.010

SYSTEM_PROMPT = """You are an estate-records analyst cataloguing site photos for the HSE healthcare-estates document register.

Given one image, return a structured tool-use response with:
- caption: one sentence describing what the photo shows
- subjects: array of 1–6 short tags (e.g. "fire escape", "plant room", "roof", "accessibility ramp")
- equipment_visible: array of named equipment or fittings visible (e.g. "AHU", "electrical distribution board", "wheelchair lift")
- condition: one of "new", "good", "fair", "poor", "damaged", "unclear"
- indoor_or_outdoor: "indoor" | "outdoor" | "mixed" | "unclear"
- apparent_era: rough architectural era if identifiable (e.g. "modern", "1990s retrofit", "mid-century", "unclear")
- compliance_concerns: short array of any visible issues relevant to building-reg compliance (e.g. "blocked fire door", "missing handrail")
- notes: any other short observation, or empty string

Be concise. Never invent detail you can't see. If unsure, mark the relevant field "unclear"."""

TOOL = {
    "name": "record_photo",
    "description": "Structured record of an HSE estate site photo.",
    "input_schema": {
        "type": "object",
        "properties": {
            "caption": {"type": "string"},
            "subjects": {"type": "array", "items": {"type": "string"}, "maxItems": 6},
            "equipment_visible": {"type": "array", "items": {"type": "string"}, "maxItems": 8},
            "condition": {
                "type": "string",
                "enum": ["new", "good", "fair", "poor", "damaged", "unclear"],
            },
            "indoor_or_outdoor": {
                "type": "string",
                "enum": ["indoor", "outdoor", "mixed", "unclear"],
            },
            "apparent_era": {"type": "string"},
            "compliance_concerns": {"type": "array", "items": {"type": "string"}, "maxItems": 5},
            "notes": {"type": "string"},
        },
        "required": [
            "caption",
            "subjects",
            "equipment_visible",
            "condition",
            "indoor_or_outdoor",
            "apparent_era",
            "compliance_concerns",
            "notes",
        ],
    },
}

COLS = [
    "site_code", "relative_path", "file_name", "extension",
    "caption", "subjects", "equipment_visible", "condition",
    "indoor_or_outdoor", "apparent_era", "compliance_concerns", "notes",
    "model", "input_tokens", "output_tokens", "cost_eur", "status",
]


def load_image_jobs():
    if not INVENTORY_CSV.exists():
        print(f"ERROR: {INVENTORY_CSV} not found.", file=sys.stderr)
        sys.exit(1)
    jobs = []
    with open(INVENTORY_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("extension") or "").lower() not in IMAGE_EXTS:
                continue
            jobs.append(row)
    return jobs


def already_done_keys():
    done = set()
    if not RESULTS_CSV.exists():
        return done
    with open(RESULTS_CSV, encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if (row.get("status") or "").lower() == "ok":
                done.add(f"{row['site_code']}::{row['relative_path']}")
    return done


def encode_image_downscaled(path: Path, max_dim: int = 1024) -> tuple[str, str]:
    """Base64-encode an image, downscaling to keep token cost low. Returns (b64, media_type)."""
    from PIL import Image  # Pillow
    import io

    try:
        img = Image.open(path)
        img = img.convert("RGB")
        img.thumbnail((max_dim, max_dim))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        b64 = base64.standard_b64encode(buf.getvalue()).decode("ascii")
        return b64, "image/jpeg"
    except Exception as e:
        raise RuntimeError(f"image encode failed: {e}")


def call_claude(client, model: str, b64: str, media_type: str):
    resp = client.messages.create(
        model=model,
        max_tokens=600,
        system=SYSTEM_PROMPT,
        tools=[TOOL],
        tool_choice={"type": "tool", "name": "record_photo"},
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": b64,
                        },
                    },
                    {"type": "text", "text": "Catalogue this photo."},
                ],
            }
        ],
    )

    tool_use = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            tool_use = block
            break
    if tool_use is None:
        raise RuntimeError("model did not return a tool_use block")

    usage = {
        "input_tokens": getattr(resp.usage, "input_tokens", 0),
        "output_tokens": getattr(resp.usage, "output_tokens", 0),
    }
    return tool_use.input, usage


def main():
    ap = argparse.ArgumentParser(description="Optional paid: Claude vision for site photos.")
    ap.add_argument(
        "--model",
        default="claude-haiku-4-5-20251001",
        help="Anthropic model id (default: claude-haiku-4-5-20251001).",
    )
    ap.add_argument("--limit", type=int, default=0, help="Process at most N photos (0 = no limit).")
    ap.add_argument("--dry-run", action="store_true", help="Count eligible photos and estimate cost; make no API calls.")
    args = ap.parse_args()

    jobs = load_image_jobs()
    done = already_done_keys()
    pending = [j for j in jobs if f"{j['site_code']}::{j['relative_path']}" not in done]
    if args.limit:
        pending = pending[: args.limit]

    est_cost = len(pending) * COST_PER_IMAGE_EUR
    print(f"Image files in inventory: {len(jobs):,}")
    print(f"Already processed:        {len(done):,}")
    print(f"Pending this run:         {len(pending):,}")
    print(f"Estimated cost:           ~€{est_cost:,.2f}  (@ {COST_PER_IMAGE_EUR:.3f}/img on {args.model})")

    if args.dry_run or not pending:
        return

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not set.", file=sys.stderr)
        sys.exit(2)

    try:
        import anthropic  # noqa
    except ImportError:
        print("ERROR: anthropic SDK not installed. Run: pip install anthropic", file=sys.stderr)
        sys.exit(2)

    client = anthropic.Anthropic(api_key=api_key)

    mode = "a" if RESULTS_CSV.exists() and RESULTS_CSV.stat().st_size > 0 else "w"
    fh = open(RESULTS_CSV, mode, newline="", encoding="utf-8")
    w = csv.writer(fh)
    if mode == "w":
        w.writerow(COLS)

    cnt = 0
    errors = 0
    start = time.time()
    for job in pending:
        path = DNREF_ROOT / job["folder_name"] / job["relative_path"]
        cnt += 1
        if not path.exists():
            w.writerow([
                job["site_code"], job["relative_path"], job["file_name"], job["extension"],
                "", "", "", "", "", "", "", "",
                args.model, 0, 0, 0.0, "missing",
            ])
            fh.flush()
            continue

        try:
            b64, media_type = encode_image_downscaled(path)
            record, usage = call_claude(client, args.model, b64, media_type)
        except Exception as e:
            errors += 1
            w.writerow([
                job["site_code"], job["relative_path"], job["file_name"], job["extension"],
                "", "", "", "", "", "", "", f"error: {str(e)[:120]}",
                args.model, 0, 0, 0.0, "error",
            ])
            fh.flush()
            continue

        cost = COST_PER_IMAGE_EUR  # ballpark; refine when you have real usage data
        w.writerow([
            job["site_code"], job["relative_path"], job["file_name"], job["extension"],
            record.get("caption", ""),
            "; ".join(record.get("subjects", [])),
            "; ".join(record.get("equipment_visible", [])),
            record.get("condition", ""),
            record.get("indoor_or_outdoor", ""),
            record.get("apparent_era", ""),
            "; ".join(record.get("compliance_concerns", [])),
            record.get("notes", ""),
            args.model,
            usage.get("input_tokens", 0),
            usage.get("output_tokens", 0),
            round(cost, 4),
            "ok",
        ])
        fh.flush()

        if cnt % 10 == 0:
            elapsed = time.time() - start
            print(f"  {cnt}/{len(pending)}  errors: {errors}  elapsed: {int(elapsed)}s")

    fh.close()
    print(f"\nDone. {cnt} images, {errors} errors.")


if __name__ == "__main__":
    main()
