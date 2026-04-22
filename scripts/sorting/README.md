# HSE Estate sorting pipeline

Standalone Windows-local toolchain for sorting the HSE DNREF legacy tree
into the canonical estate taxonomy. Ships alongside the GovIQ DocRoute
module because it feeds the same credibility model — but it's a one-off
data-migration tool, not module code.

Target: push the sort-audit publish rate from ~80% to **90%+** using free
methods first, with optional paid Claude add-ons for harder edge cases.

## Pipeline

```
FileInventory.csv  ─┐                     (walker, not in this repo)
                    ▼
   content_extract.py v4 ──▶ ContentExtraction.csv       (free, Tier A regex + OCR)
                    │
                    ▼
   sort_folders.py v3    ──▶ SortAudit-*.csv             (free, Tier-A-aware scorer)
                              CredibilityReview-*.csv
                              01-Sites/DN####-Name/...   (when run with --apply)

Optional paid add-ons:
   content_extract_vision.py  ──▶ ContentExtractionVision.csv  (photos)
   content_extract_tier_b.py  ──▶ ContentExtractionTierB.csv   (docs, 23-field LLM structured)
```

## Quick start (free path to 90%+ publish)

```bash
# 1. Install free deps (one-time)
pip install -r requirements.txt

# 2. (Optional) Install Tesseract + Poppler for OCR fallback — see requirements.txt

# 3. Rerun Tier A extraction — captures richer fields per doc
py content_extract.py

# 4. (Optional) OCR pass — rescues scanned PDFs with no text layer
py content_extract.py --ocr-retry --max-ocr-pages 2

# 5. Re-run sort with the Tier-A-aware scorer
py sort_folders.py --source "C:\Users\...\DNREF" --target "C:\...\Estate-Canonical" --codes "C:\...\GovIQ-Codes"

# 6. Spot-check the audit CSV, then apply
py sort_folders.py --source ... --target ... --codes ... --apply
```

Expected after step 5 (with v3 sorter consuming Tier A fields):
- **Publish (≥0.85):** ~85–92%
- **Review (≥0.70):** ~8–14%
- **Quarantine:** ~0.1–0.5%

## What v3 sort changed vs v2

| Signal                       | v2                | v3                                                |
|-----------------------------|-------------------|---------------------------------------------------|
| DN folder identity          | +0.75             | +0.75                                             |
| Route-keyword match         | +0.15             | +0.15                                             |
| CE boost cap                | +0.30             | **+0.45** (raised so Tier A can contribute more)  |
| Tier A strong compliance    | —                 | **+0.08** (cert# + regs or certifier together)    |
| Tier A provenance           | —                 | **+0.05** (author_firm + dates together)          |
| Tier A status clarity       | —                 | **+0.03** (issued / approved / granted)           |
| Orphan rescue (fuzzy name)  | defined, unused   | **+0.40 scaled ×0.85** (wired up)                 |
| Orphan rescue (project #)   | defined, unused   | **+0.50 scaled ×0.90** (wired up)                 |
| Tier A route override       | —                 | **DAC# / BCAR# / FSC# / ABP# / planning# route direct to 30-Compliance/... or 50-Statutory/...** |
| Publish gate                | 0.77              | **0.85** (true publish — review queue catches the middle band) |

The v3 threshold is raised to the real 0.85 publish gate (matching
`reference/neis_parser.py`) but the richer stacked evidence means more
files still clear it. Files in the 0.70–0.85 band go to the review queue
where a human confirms the routing — this is the intended workflow, not
a failure.

## What v4 content extract changed vs v3

- Adds OCR fallback using Tesseract + pdf2image when text extraction yields
  nothing. Controlled by `--ocr-pass` (new rows) / `--ocr-retry` (existing
  no_text / timeout / err rows).
- Adds `used_ocr` column to ContentExtraction.csv so you can see which
  rows were rescued.
- No changes to the Tier A regex set — that already ships the 11 Tier A
  fields.

## Optional paid add-ons

Both require `ANTHROPIC_API_KEY` and `pip install -r requirements-paid.txt`.
Both default to `claude-haiku-4-5-20251001` (cheap, fast; override with
`--model claude-sonnet-4-6` if you want more accuracy at higher cost).

### Claude vision for photos

```bash
set ANTHROPIC_API_KEY=sk-ant-...
py content_extract_vision.py --dry-run           # cost estimate
py content_extract_vision.py --limit 50          # smoke test
py content_extract_vision.py                     # full run
```

Writes `ContentExtractionVision.csv` with caption, subjects,
equipment_visible, condition, indoor_or_outdoor, apparent_era,
compliance_concerns, notes — per photo. Structured output via Claude tool
use (no free-text parsing).

Cost: ~€0.01 per photo. 300 site photos ≈ €3.

### Tier B structured document extraction

```bash
set ANTHROPIC_API_KEY=sk-ant-...
py content_extract_tier_b.py --dry-run           # cost estimate
py content_extract_tier_b.py --limit 100         # smoke test
py content_extract_tier_b.py                     # full run
```

Writes `ContentExtractionTierB.csv` with 23 semantic fields per document
(document_type, scope_summary, certifier, compliance_assertions,
issues_identified, typed dates, monetary_amounts, etc.). Only runs on docs
where Tier A succeeded (status=ok in ContentExtraction.csv).

Cost: ~€0.02 per doc. 8,000 extracted docs ≈ €160. Resumable — cancel and
restart any time.

## Zero-retention and data handling

- Both paid scripts assume the Anthropic API key has **zero-retention**
  configured. Do that at <https://console.anthropic.com> before running
  against customer data.
- Scripts downscale photos to 1024px max edge and truncate document text
  to 12,000 chars before sending — keeps token cost predictable and
  exposes less content per call.
- Raw extracted text and image bytes are NOT persisted anywhere — only
  the structured-output records land in CSV.

## Relationship to the GovIQ DocRoute module

This pipeline is intentionally standalone. The credibility model here
(folder-evidence + keyword + CE boost) differs from the
filename-driven model in `convex/docroute/neis/credibility.ts` because
the HSE legacy tree is pre-NEIS — filenames don't match the convention.
When DocRoute's ingest pipeline goes live, the filename-aware model takes
over for new uploads; this legacy sort runs once to lift the existing
13,000-file pile into the canonical tree.

## Expected output structure

```
Estate-Canonical/
├── 01-Sites/
│   ├── DN0010-CorduffPCC/
│   │   ├── 00-Passport/
│   │   ├── 10-RecordDrawings/{AsBuilt,CAD,Architectural,...}/
│   │   ├── 20-OMManuals/
│   │   ├── 30-Compliance/{FSC,DAC,BCAR,HIQA,BER,Lease,Insurance,...}/
│   │   ├── 40-Surveys/{FRA,Asbestos,Condition,MandE,Legionella,...}/
│   │   ├── 50-Photos/
│   │   └── 70-Construction/{CoW,RFI,Variations,...}/
│   ├── DN0060-CityClinicAmiens/
│   └── ... (68 DN folders)
├── 99-Quarantine/
├── _Index/
│   ├── SortAudit-YYYYMMDD-HHMMSS.csv
│   └── CredibilityReview-YYYYMMDD-HHMMSS.csv
```

Only subfolders with files are created. Originals stay in DNREF\ (copy
mode). Add `--move` to move instead of copy.
