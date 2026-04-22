# DocRoute — PRD v0.1
_Document Auto-Naming & Filing for CWMF / ISO 19650 Projects_

> Working name. Likely lands as a GovIQ module (`goviq/modules/docroute`), sold standalone to non-GovIQ customers.

---

## 1. Problem

Public-sector construction and healthcare estate projects under CWMF governance generate 10k–100k documents per lifecycle. Every consultant, contractor, and sub-consultant files inconsistently against the project’s agreed naming convention. Manual filing by document controllers is slow, error-prone, and creates audit exposure at stage gates and BCAR / HIQA / OGP review.

**Cost of the status quo:**
- Document controller time: ~0.5–2 FTE per mid-size project
- Stage-gate delays when registers don’t tie to filed documents
- Audit findings where metadata is missing or inconsistent
- Rework when consultants resubmit under wrong filename

## 2. Target Users (MVP)

| User | Pain | Value |
|---|---|---|
| Document Controller | Manual rename/file of every incoming file | Auto-files 90%+, reviews the rest |
| Project Manager (CWMF ER/DT) | Register never matches folder state | Live register, single source of truth |
| Design Team Lead | Consultant submissions fail naming check late | Immediate feedback at upload |
| Auditor / OGP reviewer | No trace of how/when files were named & moved | Full audit log per document |

Pilot ICP: **one Irish public-sector capital project, €10m–€100m, CWMF-governed, with a named document controller already in place.** Do not sell to clients without a human owner — they’ll blame you for their process debt.

## 3. Job-to-be-Done

> “When a file lands in my inbox or Teams, I want it parsed, named, filed, and registered automatically — and flagged when it can’t be — so I stop spending half my week on filing admin and I never fail a stage-gate audit on document control.”

## 4. MVP Scope

### In
- Web app (Next.js on Vercel + Convex backend)
- Auth: email + SSO-ready (Clerk or Convex Auth)
- Project create → pick naming convention template (CWMF default, ISO 19650-2 secondary)
- Upload: drag-drop, single + bulk (cap 500 files / 2GB per batch for MVP)
- Extraction pipeline: Claude API with structured JSON output
- Rename + route per convention rules
- Review queue for low-confidence / missing-field cases
- Master register: Convex table + XLSX export (CWMF Document Issue Register format)
- Audit log (immutable, append-only) per document and per project
- File storage: Convex file storage (MVP), S3-compatible adapter behind interface

### Out (explicit cut lines)
- Desktop sync client (phase 2)
- DWG / RVT parsing (phase 2 — header metadata only when added)
- Real-time SharePoint / Asite / Viewpoint / Aconex sync (phase 2, pluggable)
- BIM model handling, IFC, COBie
- Mobile app
- Multi-language OCR
- Workflow approvals / transmittals

### Non-functional
- p95 processing time < 30s per PDF (<5MB)
- 99.5% uptime target (Vercel + Convex defaults cover this)
- Data residency: EU region (Convex EU, Vercel fra1). Non-negotiable for Irish public-sector sale.
- GDPR: DPA, data map, DPIA template ready before pilot
- Security: SOC 2 roadmap noted, Cyber Essentials+ minimum before enterprise sale

## 5. Acceptance Criteria (what “shippable” means)

1. ≥ 90% auto-file rate on a 500-file CWMF test corpus (we build this corpus in week 1)
2. 100% of files resolve to one of: `filed`, `review`, `rejected` — zero silent failures
3. Every state change has an audit event
4. Register XLSX exports match CWMF template 1:1 (validated by a real document controller)
5. A document controller can process a 100-file batch in ≤ 15 minutes including reviews

## 6. System Architecture

```
[ Web UI — Next.js / Vercel ]
        │  upload + config
        ▼
[ Convex ] ───── project config, file storage, queues, audit log, register
        │  on upload → enqueue
        ▼
[ Node worker (Convex action) ]
        │
        ├── mime route
        │     ├─ pdf   → pdf-parse + Claude vision for scanned
        │     ├─ xlsx  → SheetJS sheet+cell parse
        │     ├─ docx  → mammoth text extract
        │     └─ image → Claude vision
        ▼
[ Claude API — structured extraction ]
        │  JSON schema output: {field: {value, confidence, source}}
        ▼
[ Validator ]
        │  required fields present? confidence ≥ threshold?
        ├── pass → rename + route + register update + audit
        └── fail → review queue + notify + audit
```

**Why Convex:** single system for DB + file storage + scheduled/queued actions + realtime. Cuts infra surface for a two-person build team. Already the GovIQ stack.

**Why not S3+Postgres+Redis for MVP:** not MVP. Re-platform when scale or compliance demands it; the storage adapter keeps that door open.

## 7. Data Model (Convex schema outline)

```ts
// projects
{
  _id, name, clientOrg, projectCode,
  conventionId: Id<"conventions">,
  folderTreeId: Id<"folderTrees">,
  status: "active" | "archived",
  createdBy, createdAt
}

// conventions  (seed: CWMF_2024, ISO19650_UK, HSE_CAPITAL)
{
  _id, name, version,
  pattern: string,        // e.g. "{project}-{originator}-{volume}-{level}-{type}-{role}-{number}-{status}-{revision}"
  fields: [{
    key, label, required: boolean,
    allowedValues?: string[], regex?: string,
    description: string   // used in Claude prompt
  }],
  separators: { field: "-", extension: "." },
  case: "upper" | "lower" | "preserve"
}

// folderTrees
{
  _id, name,
  nodes: [{ path, description }],
  routingRules: [{
    priority: number,
    when: { field: string, op: "eq"|"in"|"regex", value: any },
    targetPath: string
  }],
  fallbackPath: "/_unrouted/"
}

// documents
{
  _id, projectId,
  originalFilename, mimeType, fileSize, sha256,
  storageId,
  status: "pending"|"processing"|"review"|"filed"|"rejected",
  extracted: Record<string, { value: string|null, confidence: number, source?: string }>,
  overallConfidence: number,
  finalFilename?: string,
  filedPath?: string,
  reviewId?: Id<"reviews">,
  uploadedBy, uploadedAt, filedAt?
}

// reviews
{
  _id, documentId, projectId,
  missingFields: string[],
  lowConfidenceFields: [{ field, value, confidence }],
  suggestions: Record<string, string[]>,
  assignedTo?: Id<"users">,
  resolvedAt?, resolvedBy?, resolution?: "approved"|"corrected"|"rejected"
}

// auditEvents  (append-only)
{
  _id, projectId, documentId?, actor: Id<"users">|"system",
  action: string,   // "uploaded"|"extracted"|"renamed"|"routed"|"review_opened"|"review_resolved"|"filed"|"rejected"
  before?, after?, reason?, timestamp
}

// registerEntries  (materialised view for CWMF Document Issue Register)
{
  _id, projectId, documentId,
  docNumber, title, discipline, status, revision, issueDate,
  issuedBy, recipients: string[], path
}
```

## 8. Extraction Logic (deterministic tree)

```
on file upload:
  1. compute sha256; if seen → short-circuit to existing documentId
  2. classify mime; route to extractor
  3. extract raw text + structural hints (page count, first-page text, header block)
  4. call Claude with:
       - convention.fields (as JSON schema)
       - extractor output
       - few-shot examples from seed corpus
  5. receive {field: {value, confidence, source}} per field
  6. validate:
       - required field missing        → review
       - allowedValues violation       → review (with suggestions)
       - confidence < 0.85 on required → review
       - regex mismatch                → review
  7. if all pass:
       - build finalFilename from pattern
       - resolve path via folderTree.routingRules (first match wins)
       - move file; update document; insert registerEntry
       - emit audit events at each step
  8. else:
       - open review; notify assignees; emit audit
```

**Threshold note:** 0.85 is a starting number. Tune on real pilot data in week 4; expose as per-project config in phase 2.

## 9. Claude Extraction Prompt (template)

```
System:
You are a document classifier for a construction project governed by {convention.name} ({convention.version}).
Extract the fields below from the provided document. Return ONLY JSON matching the schema.

Convention fields:
{for each field: key, label, description, allowedValues, regex}

Rules:
- If a field is not determinable, set value: null and confidence: 0.
- Confidence reflects how directly the value appears in the document (title block > body > inferred).
- Prefer values from drawing title blocks, document headers, or explicit metadata over body text.
- source = short quote or location where you found the value.

User:
<<<document content (text + optional image pages)>>>

Return:
{ "<fieldKey>": { "value": "...", "confidence": 0.0-1.0, "source": "..." }, ... }
```

Implementation notes:
- Use Claude’s **structured output / tool-use** path, not free-text parsing. Force the schema.
- For scanned PDFs, send page images (Claude vision). Cost rises fast — gate by mime sniff + text density check.
- Cache by sha256 to avoid re-processing identical files.

## 10. Rename + Route

- Build filename by token substitution on `convention.pattern`
- Sanitise: strip/replace disallowed chars per OS (`\ / : * ? " < > |`), collapse whitespace, apply case rule
- Evaluate `folderTree.routingRules` in priority order; first match wins
- Fallback: `/_unrouted/` + review flag (never leave a file in limbo)
- Collision handling: if target filename exists → append `-vN` and flag as possible duplicate

## 11. Pricing Hypothesis (to validate in pilot)

| Tier | Target | £/€ per month | Includes |
|---|---|---|---|
| Pilot | Single project, ≤ 3 users | €600–€1,200 | 10k docs/mo, CWMF template, email support |
| Project | Per active project, ≤ 10 users | €2,500 | 50k docs/mo, 1 convention, register export, SSO |
| Programme | Multi-project org | €8k+ | Unlimited users, custom convention, SharePoint/Asite sync, SLA |

Margin sanity check: Claude API cost per PDF ≈ €0.02–€0.10 depending on pages + vision. At €2,500/mo and 50k docs → ≤ €5k worst-case model cost. Needs batching, caching, and text-first path to hold margin.

## 12. 6-Week Execution Plan

| Week | Deliverable | Gate |
|---|---|---|
| 1 | Convex schema, auth, project CRUD, upload UI, CWMF convention seeded, 500-file test corpus assembled | File uploads and persists; convention renders from config |
| 2 | PDF + DOCX extractors, Claude structured-output integration, validator | 50 real CWMF PDFs extract correctly end-to-end |
| 3 | Rename engine, folder routing, register XLSX export | Full pipeline works on 100-file batch; register matches CWMF template |
| 4 | Review queue UI, confidence tuning, audit log viewer, notifications | Document controller can resolve 20 reviews in < 10 min |
| 5 | XLSX extractor, bulk-upload hardening, retries, rate limits, observability (Axiom/Logtail), error taxonomy | 500-file batch passes; p95 < 30s/file |
| 6 | Pilot install, DPA signed, training, on-site day with pilot document controller, bug triage | First paid pilot live |

## 13. Open Questions — Blocking

1. **Pilot client locked?** Cannot start week 1 without a signed LOI. Who is it?
2. **Convention priority.** CWMF first (recommended — narrower, clearer market), or ISO 19650-2 first (broader, more contested)?
3. **Master register format.** Is it the OGP CWMF Document Issue Register template exactly, or a client variant? Need the actual file.
4. **Where do files ultimately live?** Convex storage is fine for MVP, but most CWMF projects mandate Asite / Viewpoint / SharePoint. What’s the pilot client using? That’s the first integration after MVP.
5. **Human-in-the-loop SLA.** How fast must the review queue be worked? That drives notification design.
6. **Data residency + GDPR posture.** Pilot client’s infosec will ask. Need DPA, DPIA, and data map ready **before** the demo, not after.
7. **GovIQ or standalone?** If this becomes a GovIQ module, it inherits auth, projects, orgs from GovIQ core. If standalone, it needs its own. Decide now; refactor later is cheap in Convex but not free.

## 14. Risks + Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Claude extraction accuracy < 90% on real corpus | Med | High | Week 1 corpus build; tune prompts + few-shot; expose threshold; ship review queue early |
| Client refuses EU-only / GDPR / DPIA | Low–Med | High | Bake in before pilot; Convex EU + Vercel EU; draft DPA template in week 1 |
| Pilot client’s filing convention is bespoke, not CWMF | High | Med | Make convention config data-driven from day one; price custom conventions as setup fee |
| Margin erosion from vision-heavy scanned PDFs | Med | Med | Text-first path, OCR pre-filter, cache by sha256, cap pages processed |
| Scope creep into DMS replacement | High | High | Hard cut lines above; refuse integrations in MVP; write-once register export is the integration path |

---

## Appendix A — Why not desktop-first

- Desktop app = install friction at every user, every machine, every OS update
- No server-side audit log = no enterprise sale, no regulator story
- No multi-user state = no document controller + PM + design lead workflow
- Claude Cowork dependency = you’re a plugin on someone else’s agent, not a product
- Pivot cost later is high: you rewrite the backend anyway

Desktop watcher can return in phase 2 as a **thin client** that uploads to the server — valuable for firms that live in Windows Explorer — but only after the server product exists.
