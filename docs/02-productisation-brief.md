# GovIQ DocRoute — Productisation Brief v0.1

> Sits above the existing **GovIQ Estate Record Spine PRD v1.0** and the **NEIS File Naming Convention (Rev 11)**. Defines the commercial SaaS wrapper around the Spine engine.

---

## 1. What you already have (inventory)

| Asset | State | Role in commercial product |
|---|---|---|
| NEIS File Naming Convention Rev 11 (HSE, ISO 19650-2 Irish NA) | Adopted standard, complete code tables | Convention #1 in the pluggable convention engine |
| `neis_parser.py` | Working Python parser, full + min patterns, DN/CMP normalisation, credibility scoring | Worker-side parser; port regex to TS for client-side validation |
| Code tables (ElementCodes, DisciplineCodes, InfoTypeCodes, PurposeCodes, AcceptanceCodes, LevelCodes, PhaseCodes, OriginatorRegister) | 8 CSVs, ready to seed | Seed data for NEIS convention config |
| MasterRegister.xlsx | 16 sheets, 6,324 file inventory, real HSE data | Output template for register export |
| Per-site synopsis (DN0574-DN0581 samples) | Generated workbook per site | Output template for building passport |
| Estate Spine PRD v1.0 | 12-week pilot plan, credibility model, canonical taxonomy | Foundation for HSE deployment |
| File quality analysis (BypassedFiles, DataQualityIssues, HighValueExtractions) | Real calibration data from 1,294-file discovery | Ground truth for extraction accuracy targets |

**What is missing to sell this:** a web product. Upload UI, multi-tenant project config, review queue, billing, self-serve onboarding, audit trail exposed to non-engineers.

## 2. Product shape — the decision

Three viable shapes. Pick one. I recommend C.

### Option A — Internal-only, services model
HSE pilot only. No SaaS. Charge as consultancy. Estimated TAM: ~€150k–€300k for HSE programme; zero scalable revenue.
**Reject.** You said you want to build an app and sell the service.

### Option B — Self-hosted single-tenant product
Install on each customer's infra. Essentially enterprise software. High margin per deal, slow growth, 6–12 month sales cycles.
**Reject for MVP.** Back-burner for Phase 3 enterprise edition.

### Option C — Multi-tenant SaaS module of GovIQ (recommended)
GovIQ as the platform; DocRoute as the first self-serve module. HSE is the anchor reference customer. External customers buy GovIQ subscriptions and get DocRoute included at their tier.

**Why C wins:**
- Shared auth, billing, UI shell with the rest of GovIQ (no duplication)
- Reference deployment (HSE) is also the #1 commercial case study
- Convention is pluggable, so OPW / Local Authorities / Tusla / Universities / private AEC are next
- Data stays in GovIQ, which gives you a reason for customers to adopt other GovIQ modules (Capital Governance, Evaluation, Risk, etc.)

### What this implies
- **Branding:** GovIQ DocRoute (or GovIQ Estate Spine if positioning at estates only)
- **Not a separate product site.** Landing page lives under `goviq.ie/docroute`
- **No separate pricing SKU initially** — it's included in GovIQ tiers. Metering by docs processed, projects, users.

## 3. Target segments (GTM)

Priority order. Only #1 and #2 should drive MVP scope.

| # | Segment | Convention(s) | Buying signal | Size |
|---|---|---|---|---|
| 1 | HSE Estates + HSE Capital | NEIS (your Rev 11) | Active engagement, pilot framed | 1 logo, anchor reference |
| 2 | Other Irish public-sector estates (OPW, Tusla, Universities, Local Authorities) | ISO 19650-2 Irish NA variants; often bespoke project-level | Post-HSE reference sale | ~20 logos |
| 3 | Irish public-sector capital projects (non-estates) | CWMF document templates, PW-CF series | CWMF-governed projects with document control role | ~100+ logos |
| 4 | Private-sector AEC firms (architects, QS, consultants, contractors) working on public projects | ISO 19650 UK NA or client-specific | CWMF/HSE framework contract mandates | Large but fragmented |
| 5 | Non-construction regulated filing (legal, clinical, medical devices) | Bespoke | Phase 3+ | Do not design for this |

**MVP scope supports #1 and #2 only.** #3 requires CWMF template library; #4 requires multi-convention per-project defaults. Both are post-pilot.

## 4. Commercial product — scope delta from Estate Spine PRD

What's in the existing PRD that stays: engine architecture, credibility model, NEIS parser, canonical taxonomy, Master Register & synopsis outputs, 12-week HSE plan.

What the commercial wrapper adds:

### 4.1 Multi-tenancy
- Organisations (customers) as top-level tenant
- Projects scoped to organisations
- Users with roles: Owner, Admin, Document Controller, Reviewer, Viewer
- Per-project convention config (pluggable)
- Data isolation by tenant at Convex row level (RLS-equivalent)

### 4.2 Convention engine (pluggable)
- NEIS (HSE Rev 11) — seeded day 1
- ISO 19650-2 UK NA — seeded day 1
- Custom — customers define pattern + fields + code tables via admin UI
- Convention versioning (NEIS Rev 12 will happen; don't overwrite)

### 4.3 Web UI (the actual app)
- **Upload:** drag-drop, single + bulk (cap: 500 files / 2GB batch in MVP)
- **Project dashboard:** file queue, review queue count, register link, recent activity
- **File detail view:** original, extracted fields with confidence, rename preview, suggested folder, audit log
- **Review queue:** card-per-file, one-click approve/correct, batch actions
- **Register view:** live Master Register (web + XLSX export), per-site synopsis links
- **Admin:** org settings, users, projects, conventions, originator registry, billing

### 4.4 Billing & self-serve
- Stripe subscription (monthly/annual)
- Tiers bound to: active projects, docs processed/month, seats, conventions, export formats
- Self-serve signup with email/OTP + SSO-ready (Microsoft/Google)
- Free trial: 14 days, one project, 200 docs, capped credibility processing

### 4.5 Storage & integration
- MVP: Convex file storage (EU region)
- Phase 2 pluggable adapters: SharePoint, Aconex, Asite, Fieldwire, SMB
- Export: XLSX register, folder-tree zip, CSV inventory

### 4.6 Data residency & governance
- EU-only hosting (Convex EU; Vercel fra1)
- DPA template, DPIA starter, data map in documentation
- Audit log exported per-project for regulator review
- Role-based access + optional watermark on previews
- No training on customer data (call this out explicitly in the DPA)

### 4.7 What the commercial product does NOT change
- The parser logic (stays)
- The credibility model (stays)
- The canonical folder taxonomy (stays, now per-tenant)
- The output register schema (stays, now per-project)

## 5. Architecture — current vs. target

### Current (Estate Spine prototype)
```
[HSE shared drive (SMB)] ← files
         │
[Python workers (local)] → neis_parser.py, content extractors
         │
[sort_folders.py] → canonical folder tree (junctions)
         │
[build_master.py] → MasterRegister.xlsx
[build_synopses.py] → per-site synopsis workbooks
```

Services, not a product. Runs on one machine. Outputs are files on disk. No users, no audit trail exposed, no self-serve.

### Target (GovIQ DocRoute SaaS)
```
[Browser — Next.js on Vercel EU]
     │   Auth (Convex/Clerk) · Upload · Review · Register · Admin
     ▼
[Convex EU] — multi-tenant tables, file storage, queues, audit log
     │
     ├── [TS validators] — port of neis_parser regex, runs at upload for instant feedback
     │
     ├── [Convex actions → Node worker(s)]
     │      ├─ content extractors (pdf-parse / pdfplumber, mammoth, SheetJS, ODA for DWG)
     │      ├─ OCR fallback (Tesseract baseline; Azure DI paid tier)
     │      ├─ Claude API structured extraction (JSON schema per convention)
     │      ├─ credibility scoring (ported from neis_parser.FIELD_WEIGHTS)
     │      └─ route decision (publish / review / quarantine)
     │
     └── [Publishers]
            ├─ register rebuild (per project, incremental)
            ├─ synopsis rebuild (per site, incremental)
            └─ storage adapter → Convex, S3, SharePoint, Aconex (plug-in)
[Stripe] — subscription + metering
[Axiom/Logtail] — observability
```

Key architectural moves from current to target:
1. **Parser port:** `neis_parser.py` regex → TS module shared between client (instant validation) and server (authoritative parse). Keep Python version as the reference implementation; generate the TS from the same regex source where possible.
2. **Worker port:** Python content extractors → Node actions in Convex (or Node microservice called by Convex HTTP action). Fall back to calling Python via a worker service for DWG/OCR where Node libraries are weaker.
3. **Storage abstraction:** introduce `StorageAdapter` interface. Default `ConvexStorageAdapter`; seat `SmbAdapter` / `SharePointAdapter` behind the same interface for Phase 2. HSE pilot uses SMB adapter; external SaaS customers use Convex.
4. **Multi-tenancy:** every Convex table gets `orgId` + `projectId`. Queries filtered by caller's org. Convex functions enforce this, not the UI.
5. **Registers become Convex tables, not XLSX files.** XLSX is an *export*, not the source of truth. This is the biggest conceptual change from your current prototype. It unlocks live dashboards, per-field updates, audit, and the review queue.

## 6. Convex schema — key tables (commercial wrapper)

```ts
// TENANT
organizations: { _id, name, plan, stripeCustomerId, dataRegion, createdAt }
users: { _id, orgId, email, role, authProvider, createdAt }
orgMemberships: { _id, orgId, userId, role, invitedBy, joinedAt }

// CONFIG
conventions: {
  _id, orgId?, isGlobal, name, version,  // isGlobal=true for seeded NEIS/ISO
  fullPattern, minPattern, fields: FieldDef[], codeTables: Record<string, CodeTable>,
  createdBy, createdAt
}
originatorRegistry: { _id, orgId, code, organisation, verified, createdAt }
folderTrees: { _id, orgId, name, nodes: NodeDef[], routingRules: Rule[], fallbackPath }

// PROJECT
projects: {
  _id, orgId, name, projectCode,
  conventionId, folderTreeId,
  status, createdBy, createdAt
}
projectMembers: { _id, projectId, userId, role }

// SITE (HSE-like portfolio structure, optional per project)
sites: { _id, projectId, siteCode, name, address, metadata }
buildings: { _id, siteId, buildingId, name, type, metadata }

// DOCS
documents: {
  _id, projectId, orgId,
  originalFilename, sha256, mimeType, fileSize, storageId,
  uploadedBy, uploadedAt,
  status: "pending"|"parsing"|"extracting"|"scoring"|"review"|"filed"|"quarantine"|"rejected",
  parsed: ParseResult,       // from neis_parser equivalent
  extracted: Record<string, FieldResult>,
  credibility: CredibilityResult,   // score + route + explanation
  finalFilename?, filedPath?, filedAt?, reviewId?
}
reviewQueue: {
  _id, documentId, projectId, orgId,
  missingFields, lowConfidenceFields, suggestions,
  assignedTo?, status, resolvedAt?, resolvedBy?, resolution?
}

// OUTPUTS (materialised)
registerEntries: { _id, projectId, documentId, ...NEIS fields, ...register columns }
synopsisSnapshots: { _id, projectId, siteId, generatedAt, workbookStorageId }

// GOVERNANCE
auditEvents: { _id, orgId, projectId, documentId?, actor, action, before?, after?, timestamp }
usageCounters: { _id, orgId, month, docsProcessed, ocrPages, storageBytes }

// BILLING
subscriptions: { _id, orgId, stripeSubId, tier, status, currentPeriodEnd, seats, docLimit }
```

## 7. Extraction — LLM + regex together

The Estate Spine PRD already has this right: regex-first, LLM-second, registers as tiebreaker. Making that explicit as a pipeline contract:

```
ingest(file):
  1. hash + dedupe
  2. client-side: TS regex against filename → instant feedback ("looks like NEIS full-form")
  3. server action: 
     a. content extract by mime (pdf/docx/xlsx/dwg/image)
     b. Python/Node regex pass for dates, DN codes, drawing numbers, cert numbers
     c. Claude structured extraction with JSON schema = convention.fields
        - force tool-use / structured output, no free-text parsing
        - include seeded code tables so model can validate against allowed values
        - vision only when text density < threshold (scanned PDFs, title-block photos)
     d. cross-reference against registers (BuildingRegister, OriginatorRegistry, LeaseRegister if present)
     e. compute per-field confidence = f(regex match, LLM confidence, register agreement, licence flag)
     f. compute record credibility via FIELD_WEIGHTS (identical math to neis_parser.record_credibility)
     g. route: publish / review / quarantine
  4. emit audit events at each step
  5. on publish: write registerEntries, regenerate synopsis for affected site
```

**Cost discipline:** cache by sha256 (don't re-extract identical files), text-first path (skip vision unless needed), batch similar docs through the same prompt where possible. Typical NEIS-compliant PDF: €0.02–€0.05 in Claude cost. Scanned photocopy of a 20-page fire cert: €0.15–€0.30. Price the tier accordingly.

## 8. MVP scope — commercial wrapper

Eight weeks on top of (or in parallel with) the HSE pilot. Assumes Liam product-lead + one full-stack engineer.

| Week | Deliverable |
|---|---|
| 1 | Convex schema + multi-tenant auth + org/project CRUD + NEIS convention seeded from code tables |
| 2 | TS port of neis_parser regex (filename validation at upload) + upload UI + Convex file storage + audit log primitives |
| 3 | PDF + DOCX + XLSX content extractors as Convex actions; Claude structured extraction with JSON schema; regex pass for DN/dates |
| 4 | Credibility scoring (ported weights); route decision; filed/review/quarantine states; rename + folder routing |
| 5 | Review queue UI (card-per-file, approve/correct/batch); originator registry admin |
| 6 | Register view + XLSX export; per-site synopsis generation (port build_synopses logic); folder-tree zip export |
| 7 | Billing (Stripe), self-serve signup, 14-day trial limits, basic metering; SSO (Microsoft/Google) |
| 8 | HSE pilot tenant provisioned; DPA + DPIA templates published; observability, error budgets, feature flags; landing page live |

Gates:
- End of W2: HSE document controller can upload one file and see NEIS filename validated instantly
- End of W4: 50 real HSE files auto-filed end-to-end with ≥85% credibility
- End of W6: first register + synopsis export matches existing MasterRegister v3.1 to ≥95% field parity
- End of W8: external prospect can self-signup and run the product unassisted

## 9. Pricing hypothesis (validate in pilot)

Metered on docs processed, projects active, seats. Rough numbers; tune on pilot.

| Tier | €/mo | Docs/mo | Projects | Seats | Features |
|---|---|---|---|---|---|
| Trial (14d) | 0 | 200 | 1 | 3 | NEIS only, no export, watermarked |
| Starter | 400 | 5,000 | 1 | 5 | NEIS + ISO 19650, XLSX export |
| Project | 1,200 | 25,000 | 3 | 15 | + review batch, synopsis export, SSO |
| Programme | 3,500 | 100,000 | 10 | 50 | + custom conventions, SharePoint adapter, priority support |
| Estate (HSE) | bespoke | unlimited | unlimited | unlimited | + SMB adapter, canonical folder apply, national rollout, SLA |

**Margin sanity:** at Programme tier 100k docs × €0.04 mean Claude cost = €4k worst case. Margin 55–65% after infra. Hold by caching + text-first + batching.

## 10. Open decisions — blocking

| # | Decision | Options | Recommendation |
|---|---|---|---|
| D1 | Is DocRoute a GovIQ module or a standalone brand? | Module / Brand / Both | Module. Single brand. |
| D2 | Do we port the Python parser to TS/Node, or call it from Node as a service? | Port / Microservice / Hybrid | Hybrid — port regex (shared validation), keep Python for DWG/OCR workers |
| D3 | HSE pilot storage: SMB (their drive) or Convex (our cloud)? | SMB / Convex / Both via adapter | Both. Pilot runs against their SMB via adapter; SaaS signups use Convex. |
| D4 | Does the external SaaS launch with NEIS + ISO 19650 only, or with a custom-convention builder? | Two only / Custom builder | Two only at MVP; custom builder at week 9–10 as paid upgrade. |
| D5 | Who is the first external paying customer after HSE? | OPW / a local authority / a university / a consultant firm | Local Authority estates team — fastest buying cycle, similar convention to HSE. |
| D6 | When do we add CWMF document template library (CWMF documents, not just NEIS naming)? | MVP / Post-MVP / Phase 2 | Post-MVP. It's a different product surface (template → doc, vs. doc → metadata). |
| D7 | Public pricing page at launch, or "contact us"? | Public / Contact / Public for Trial+Starter only | Public for Trial/Starter/Project; Contact for Programme+Estate. |
| D8 | Legal residency statement in the DPA — Convex EU only, or also OK with UK/Ireland sub-processors? | EU-only / EU+UK | EU+Ireland only for public-sector sale. Harden this before any HSE DPA signature. |

## 11. Risks — commercial-layer specific

| Risk | L | I | Mitigation |
|---|---|---|---|
| HSE pilot drags and delays commercial launch | H | H | Run pilot and commercial build in parallel; commercial team does not wait for pilot gates |
| External prospects want conventions we haven't built | H | M | Custom convention builder is a paid upgrade; set pricing to make it worth saying yes |
| Claude cost per doc runs ahead of tier pricing | M | M | Text-first path + sha256 cache + batching; monitor per-tenant cost, throttle trials |
| GDPR / DPIA blocks first external deal | M | H | Publish DPA + DPIA template at launch; EU-only hosting; SOC 2 roadmap documented |
| Customers expect SharePoint/Aconex sync on day 1 | H | M | Export zip as MVP; SharePoint adapter in Phase 2; price Programme tier around it |
| HSE NEIS Rev 12 or 13 drops mid-build | L | M | Convention versioning in the schema; migration script template |
| Parser port to TS diverges from Python reference | M | M | Single regex source generates both; CI test both against the same fixture corpus |

## 12. What I will not build yet (anti-scope)

- Desktop sync client (Phase 3 if ever)
- Native DWG/RVT parsing beyond title-block metadata (use ODA file converter as a worker; do not host a CAD engine)
- Automated consultant onboarding with skills assessment
- AI-generated building synopsis narrative (stick to structured data for Phase 1; no hallucination risk in regulator-facing outputs)
- Mobile app
- CWMF template filling (separate product, separate PRD)
- Fieldwire/Aconex/SharePoint write-back (read-only in Phase 1; write in Phase 2 per adapter)
- Redaction / anonymisation of clinical data (Phase 2; flag-only in Phase 1)

## 13. What you need to produce before Week 1

1. **LOI or memo of intent** from HSE confirming pilot scope and data access
2. **DPA + DPIA** drafts ready for HSE legal review by end of week 2
3. **Decision log** on D1–D8 above (even provisional)
4. **Second prospect** identified and contacted — cold lookalike to HSE, to validate that the product works outside HSE
5. **Branding call** — is the external web property `goviq.ie/docroute`, or something else? Copywriting depends on this.

## 14. What I can build next on request

If you want me to produce any of these immediately, say the word and I'll write them as code files:

- Convex schema file (full `schema.ts` matching section 6)
- TS port of `neis_parser.py` regex (filename validator for client + server)
- Seed script that loads your 8 code tables into the `conventions` + `originatorRegistry` tables
- JSON schema per convention for Claude structured extraction
- Next.js upload page + review queue card component (shadcn/ui)
- Landing page outline (copy + structure) for `goviq.ie/docroute`
- Pricing page copy with Stripe integration stubs
- DPA + DPIA starter templates
