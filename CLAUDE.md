# GovIQ DocRoute — Engineering Context

> DocRoute is a **module inside the GovIQ platform**, not a standalone app.
> This file is read by Claude Code at the start of every session. It is the
> source of truth for locked decisions, the integration shape with GovIQ
> core, coding standards, and what's built vs. what's next. Keep it tight.
> Deep context lives in `docs/`.

## 1. What we're building

**GovIQ DocRoute** is a module of the GovIQ platform. DocRoute ingests
construction and estates documents, extracts metadata against a pluggable
naming convention, credibility-scores every file, and routes it to a
canonical folder with an audit-ready register.

It **reuses** GovIQ core for tenancy, auth (Entra ID via Convex Auth),
memberships, audit, billing, workpools, and cron infrastructure. It
**contributes** domain-specific tables (`dr_*`) and NEIS-specific parsing /
scoring logic.

**Anchor customer:** HSE Estates, starting with the Dublin North Eastern IHA
pilot. Scales across all 20 HSE Integrated Healthcare Areas at national
rollout. Beyond HSE: other Irish public-sector estates (OPW, Tusla,
Universities, Local Authorities) and private AEC firms.

**Anchor convention:** HSE NEIS File Naming Convention (Rev 11, 2022-03-01),
aligned with IS EN ISO 19650-2:2018 Irish National Annex. See
`docs/99-neis-convention-rev11.pdf`.

## 2. Decisions locked (don't re-litigate without cause)

| ID | Decision | Locked answer |
|---|---|---|
| D1 | Module or standalone brand? | **Module of GovIQ.** Branded "GovIQ DocRoute." No separate brand site, no separate Convex deployment, no separate repo once merged. |
| D2 | Parser language strategy | **Hybrid.** Python `reference/neis_parser.py` remains the reference for Spine workers. TS port in `convex/docroute/neis/` is authoritative for the web app. Parity enforced by fixtures in `tests/neis.test.ts`. |
| D3 | HSE storage | **Pluggable adapter.** SMB adapter for pilot against HSE shared drive; Azure Blob (HSE M365 tenant) if IG office prefers; Cloudflare R2 (EU-jurisdiction) as SaaS default for non-HSE tenants. OVHcloud as "sovereign tier" upgrade only when a customer demands no-CLOUD-Act. |
| D4 | Conventions at MVP | **Two: NEIS + ISO 19650-2 UK NA.** NEIS fully seeded. ISO 19650 seeded as structural stub — code tables to be populated before first non-HSE customer. |
| D5 | Post-HSE target | **Open: public sector, local councils, private firms.** Architecture is pluggable-convention from day one. |
| D6 | Registers format | **Convex tables are source of truth. XLSX/CSV are exports.** Do NOT treat XLSX as source of truth — breaks multi-user, breaks audit, breaks review queue. |
| D7 | AI extraction | **Claude API, structured output.** Zero-retention configured on our API key. Text-first path; vision only when text density low. SHA256 cache to avoid re-processing identical files. |
| D8 | Module integration | **DocRoute reuses GovIQ core: `sp_organisations`, `sp_users`, `gov_memberships`, `gov_auditEvents`, existing Entra ID auth, workpools, cron.** DocRoute-owned tables are all prefixed `dr_*`. Audit events use `eventType = "docroute.<action>"`. |

## 3. Stack — what DocRoute reuses from GovIQ vs. what it adds

### Reuses from GovIQ core (do NOT redefine)

| Concern | GovIQ provides | DocRoute uses |
|---|---|---|
| Tenancy | `sp_organisations` | `v.id("sp_organisations")` on every dr_* tenant row |
| Users | `sp_users` | `v.id("sp_users")` on uploader, assignee, createdBy |
| Memberships + roles | `gov_memberships` | Inline lookup for `requireOrgMember` / `requireOrgRole` |
| Auth | Microsoft Entra ID via Convex Auth | `ctx.auth.getUserIdentity()` → `sp_users` by subject |
| Audit | `gov_auditEvents` | Insert with `eventType = "docroute.<action>"` |
| Billing | Platform-level (GovIQ) | DocRoute does not handle billing |
| Project-level entity | `sp_procurements` (or equivalent) | Optional FK from `dr_projects.procurementId` |
| Document pool | GovIQ `documentPool` workpool | Ingest pipeline enqueues here |
| Email pool | GovIQ `emailPool` | Review/escalation notifications |
| Cron | GovIQ cron infrastructure | Register regeneration, synopsis, metered usage |

### DocRoute-specific tables (`dr_*` prefix) — live under `convex/docroute/`

- `dr_conventions` — naming conventions (NEIS, ISO 19650, custom)
- `dr_originatorRegistry` — organisation codes
- `dr_folderTrees` — canonical taxonomy + routing rules
- `dr_projects` — filing unit (optionally linked to `sp_procurements`)
- `dr_projectMembers` — per-project role overrides
- `dr_sites` / `dr_buildings` — portfolio dimension (HSE-style estates)
- `dr_documents` — core domain
- `dr_reviewQueue` — human-confirm queue
- `dr_registerEntries` — materialised register (source of truth: `dr_documents`)
- `dr_synopsisSnapshots` — per-site synopsis workbook snapshots

### Stack reused at platform level

| Layer | Choice | Notes |
|---|---|---|
| App hosting | Vercel EU (fra1) | GovIQ root Next.js app |
| Backend | Convex, EU deployment (`different-dolphin-62.eu-west-1.convex.cloud`) | Single shared GovIQ deployment |
| Object storage (HSE) | HSE SMB → Azure Blob via storage adapter | DocRoute builds the adapter interface |
| Object storage (SaaS) | Cloudflare R2, EU jurisdiction lock | Default for non-HSE tenants |
| LLM | Anthropic Claude API | Structured output / tool-use only. Zero-retention. |
| Testing | Vitest | Parity fixtures in `tests/neis.test.ts` |
| Python worker | Stays separate | `reference/neis_parser.py` |

## 4. Code standards

### TypeScript (inherited from GovIQ root)
- `strict: true` + `noUncheckedIndexedAccess: true` — respect undefined on array/object access.
- No `any` except at `v.any()` seams where the shape is intentionally dynamic. Document why.
- Prefer `readonly` on inputs; mutate explicitly.
- Named exports only.
- File names: kebab-case for components, camelCase for Convex functions, PascalCase for types.

### Convex (DocRoute-specific rules on top of GovIQ conventions)
- Every tenant-scoped DocRoute query/mutation resolves identity through the
  GovIQ inline pattern: `ctx.auth.getUserIdentity()` → `sp_users` → check
  `gov_memberships`. Do not introduce a parallel `authz.ts` helper.
- Never take `orgId` from client input without verifying caller membership.
  The membership check IS the authorisation check.
- Every state change the user might ask about later emits a
  `gov_auditEvents` row with `eventType = "docroute.<domain>.<action>"`
  (e.g. `docroute.document.uploaded`, `docroute.review.resolved`).
- Use existing indexes. Add indexes deliberately; every new one costs write latency.
- Keep action handlers short — offload to internal mutations for DB work and
  internal actions for LLM calls.

### Testing
- Every change to `convex/docroute/neis/regex.ts`, `parser.ts`,
  `normalise.ts`, or `credibility.ts` must keep `npm test` passing. Parity
  fixtures in `tests/neis.test.ts` guard against drift from `reference/neis_parser.py`.
- When adding a new convention, add parity fixtures too.
- Hand-write tests for auth bypass attempts on any new tenant-scoped function.

### Git
- Small commits, clear subject lines, imperative mood.
- Branch per feature; PR into `main`. No force-push to `main`.
- Never commit `.env*`. Never commit customer data.

### Secrets
- All secrets live at the GovIQ deployment level: `npx convex env set KEY value`.
- DocRoute does not define its own `.env*` files in this tree once merged.

## 5. Current state — what's built

- `convex/docroute/schema.ts` — 11 `dr_*` tables exported as individual `defineTable(...)` expressions, to be merged into GovIQ root `convex/schema.ts`.
- `convex/docroute/neis/` — full TypeScript port of `neis_parser.py`:
  - `regex.ts` — full + min NEIS patterns, DN/CMP patterns
  - `parser.ts` — `parseFilename()`, renderers, `isNeisCompliant()`
  - `normalise.ts` — `normaliseDn()`, `normaliseCmp()`, `buildingIdFromParts()`
  - `credibility.ts` — `FIELD_WEIGHTS`, `recordCredibility()`, `credibilityRoute()`, parser-glue
  - `viewTypes.ts` — drawing number → view type
  - `index.ts` — barrel
- `convex/docroute/seed/` — NEIS + ISO 19650 convention + global originator seeds (idempotent, targeting `dr_conventions` / `dr_originatorRegistry`)
- `convex/docroute/conventions.ts` — queries + mutations for conventions and originator registry. Inline GovIQ auth; audit events to `gov_auditEvents`.
- `tests/neis.test.ts` — parity fixtures
- `reference/neis_parser.py` — Python reference (DO NOT modify without updating the TS port and the parity tests)

## 6. Current state — what's NOT built yet

Order of priority (all land under `convex/docroute/`):

1. **Document ingest pipeline** — HTTP action for upload; file classification
   by mime; content extraction (pdf-parse, mammoth, SheetJS); Claude
   structured-output call driven by `convention.fields`; credibility
   scoring; route to `filed` / `review` / `quarantine`; audit events at each
   step. Enqueues to the existing GovIQ `documentPool`; does not create a
   new workpool.
2. **Storage adapter interface** — `StorageAdapter` with `R2Adapter`,
   `SmbAdapter`, `AzureBlobAdapter`, `OvhAdapter`. Adapter selected per
   `dr_projects` row.
3. **Extraction prompts** — first-class artefacts under
   `convex/docroute/extraction/prompts/`, one file per doc-type. Prompts
   are NOT strings buried in function bodies.
4. **Upload UI** — Next.js page in GovIQ root app, drag-drop, single + bulk,
   instant NEIS validation via the TS regex, progress streaming from Convex
   subscriptions.
5. **Review queue UI** — card-per-file, inline rename preview,
   approve / correct / batch actions.
6. **Register view + export** — live web view backed by `dr_registerEntries`;
   XLSX export matching CWMF Document Issue Register format.
7. **Synopsis generation** — per-site workbook; regenerates on document state
   changes.
8. **Observability wiring** — structured logs through GovIQ's existing
   observability pipeline; p95 latency tracking per action.

Billing is handled at the GovIQ platform level — no DocRoute-specific
subscriptions, usage counters, or Stripe wiring.

## 7. NEIS convention authority

The canonical pattern is:

```
{project}-{phase}-{element}-{zone}-{level}-{infoType}-{originator}-{role}-{number}-{title}.{ext}
```

Example:
```
NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Distribution Board Schedule.pdf
```

Minimum form (less-complex projects, per Rev 11 §"Document Files"):
```
{project}-{level}-{infoType}-{originator}-{role}-{number}-{title}.{ext}
```

**Metadata outside the filename:** Purpose Code (P00–P10), Acceptance Code
(S/A/B/C/D), Revision (integer starting at O), Revision Description. Stored
on `dr_documents`, NOT parsed from the filename.

**Credibility gates** (parity with `reference/neis_parser.py`):
- ≥ 0.85 → `publish` (auto-file, audit-log)
- ≥ 0.70 → `review` (human confirm with pre-population)
- < 0.70 → `quarantine` (weekly triage)

**Licence penalties:**
- `valid`: 0
- `unknown`: -0.05
- `student`: -0.15 (Autodesk Student watermark — non-commercial)
- `watermarked_other`: -0.10

## 8. Context — deeper reading

Read when relevant, not every session:

- `docs/00-initial-prd-draft.md` — the engine spec this product implements
- `docs/02-productisation-brief.md` — commercial SaaS wrapper scope, tiers, pricing
- `docs/03-storage-brief.md` — D3 research: R2 vs Azure vs AWS vs OVH, cost model, procurement path
- `docs/04-commercial-model.md` — HSE pilot → regional → national pricing
- `docs/99-neis-convention-rev11.pdf` — source standard
- `reference/neis_parser.py` — Python reference implementation for the Spine workers (DO NOT modify without updating the TS port and the parity tests)
- `MIGRATION.md` — how to merge this module into the GovIQ repo, including the mandatory Session 0 schema reconciliation step

## 9. Hard rules (things we don't do)

- **Never** redefine GovIQ core tables (`sp_organisations`, `sp_users`,
  `gov_memberships`, `gov_auditEvents`, billing). DocRoute integrates, it
  doesn't duplicate.
- **Never** bypass the inline GovIQ auth pattern. Every tenant-scoped
  function resolves `sp_users` via identity, then checks `gov_memberships`.
- **Never** replace Aconex, Fieldwire, or any HSE CDE. Integrate, don't replace.
- **Never** log secrets, customer document contents, or extracted field
  values at default log levels. Structured log metadata only.
- **Never** train any model on customer data. Zero-retention is contractual.
- **Never** ship a change to a scoring weight or credibility gate without
  updating both `reference/neis_parser.py` and
  `convex/docroute/neis/credibility.ts` in the same PR.
- **Never** send free text to Claude and parse the response. Force
  structured output via tool-use. Prompt contract is `convention.fields`
  mapped to a JSON schema.
- **Never** add a dependency without pinning its major version in the GovIQ
  root `package.json`.

## 10. When in doubt

- **Session 0 is mandatory on first merge.** See `MIGRATION.md` §"Session 0".
  Reconcile the auth-helper placeholders and FK table names in this module
  against the real GovIQ schema before any feature work.
- Check `docs/` first for the written decision.
- Parity tests in `tests/neis.test.ts` are the contract for the NEIS module.
- Use the goviq-codebase-navigator skill when you need to inspect GovIQ
  core conventions.
- If you're about to make an architectural decision that isn't in §2, stop
  and ask — those decisions are expensive to reverse.
