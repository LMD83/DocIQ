# GovIQ DocRoute — Engineering Context

> This file is read by Claude Code at the start of every session. It is the source of truth for locked product decisions, the tech stack, coding standards, and what's built vs. what's next. Keep it tight. Deep context lives in `docs/`.

## 1. What we're building

**GovIQ DocRoute** is a module of the GovIQ platform. A commercial multi-tenant SaaS that ingests construction and estates documents, extracts metadata against a pluggable naming convention, credibility-scores every file, and routes it to a canonical folder with an audit-ready register.

**Anchor customer:** HSE Estates, starting with the Dublin North Eastern IHA pilot. Scales across all 20 HSE Integrated Healthcare Areas at national rollout. Beyond HSE: other Irish public-sector estates (OPW, Tusla, Universities, Local Authorities) and private AEC firms.

**Anchor convention:** HSE NEIS File Naming Convention (Rev 11, 2022-03-01), aligned with IS EN ISO 19650-2:2018 Irish National Annex. See `docs/99-neis-convention-rev11.pdf`.

## 2. Decisions locked (don't re-litigate without cause)

| ID | Decision | Locked answer |
|---|---|---|
| D1 | Module or standalone brand? | **Module of GovIQ.** Branded "GovIQ DocRoute." No separate brand site. |
| D2 | Parser language strategy | **Hybrid.** Python `neis_parser.py` remains the reference for Spine workers. TS port in `convex/neis/` is authoritative for the web app. Parity enforced by fixtures in `tests/neis.test.ts`. |
| D3 | HSE storage | **Pluggable adapter.** SMB adapter for pilot against HSE shared drive; Azure Blob (HSE M365 tenant) if IG office prefers; Cloudflare R2 (EU-jurisdiction) as SaaS default for non-HSE tenants. OVHcloud as "sovereign tier" upgrade only when a customer demands no-CLOUD-Act. |
| D4 | Conventions at MVP | **Two: NEIS + ISO 19650-2 UK NA.** NEIS fully seeded. ISO 19650 seeded as structural stub — code tables to be populated before first non-HSE customer. |
| D5 | Post-HSE target | **Open: public sector, local councils, private firms.** Architecture is pluggable-convention from day one so non-HSE customers are not a custom build. |
| D6 | Registers format | **Convex tables are source of truth. XLSX/CSV are exports.** Do NOT treat XLSX as source of truth — breaks multi-user, breaks audit, breaks review queue. |
| D7 | AI extraction | **Claude API, structured output.** Zero-retention configured on our API key. Text-first path; vision only when text density low. SHA256 cache to avoid re-processing identical files. |

## 3. Stack

| Layer | Choice | Notes |
|---|---|---|
| App hosting | Vercel EU (fra1) | Next.js. Enterprise tier once SOC 2 starts. |
| Backend | Convex, EU deployment | Queries, mutations, actions, file storage, cron, real-time. |
| Object storage default | Cloudflare R2, EU jurisdiction lock | Zero egress. Adapter pattern for alternates. |
| Object storage (HSE pilot) | HSE SMB shared drive (via adapter) → Azure Blob later | Never our data centre. |
| Object storage (sovereign tier) | OVHcloud (France) | Only when contractually required. |
| Backups | Backblaze B2, EU (Amsterdam) | Nightly mirror. Object Lock for compliance tier. |
| LLM | Anthropic Claude API | Structured output / tool-use only. Zero-retention. |
| Auth | Convex Auth or Clerk | SSO-ready (Microsoft / Google). MFA enforced. |
| Billing | Stripe | Elements client-side; PAN never hits our servers. |
| Observability | Axiom EU (or Logtail EU) | Structured logs; never log secrets. |
| Frontend | Next.js 15 + React 19 + Tailwind + shadcn/ui | Single-file components for simple; package by feature otherwise. |
| Language | TypeScript strict everywhere | `noUncheckedIndexedAccess: true` is on — respect it. |
| Testing | Vitest | Parity fixtures in `tests/neis.test.ts` gate the regex/credibility modules. |
| Python worker | Stays separate | `neis_parser.py` is the reference implementation; do not modify the TS port without updating both. |

## 4. Code standards

### TypeScript
- `strict: true` + `noUncheckedIndexedAccess: true` — all array/object access returns `T | undefined`. Guard accordingly.
- No `any` except at Convex schema `v.any()` seams where the shape is intentionally dynamic. Document why when you do.
- Prefer `readonly` on inputs; mutate explicitly.
- Named exports only. No default exports except Convex schema.
- File names: kebab-case for components, camelCase for Convex functions, PascalCase for types.

### Convex
- Every tenant-scoped query/mutation calls `requireOrgMember` or `requireOrgRole` from `convex/lib/authz.ts` **before** any DB access. Non-negotiable.
- Never take `orgId` from client input without verifying caller is a member — the verification IS the authorisation check.
- Insert an `auditEvents` row on every state change the user might ask about later ("who uploaded this?", "who changed that path?").
- Use the existing indexes. Add indexes deliberately; every new one costs write latency.
- Keep action handlers short — offload to internal mutations for DB work and internal actions for LLM calls.

### Testing
- Every change to `convex/neis/regex.ts`, `parser.ts`, `normalise.ts`, or `credibility.ts` must keep `npm test` passing. The fixtures in `tests/neis.test.ts` are parity with `neis_parser.py` and drift-proof the TS port.
- When adding a new convention, add parity fixtures too.
- Hand-write tests for auth bypass attempts on any new tenant-scoped function. Every one.

### Git
- Small commits, clear subject lines, imperative mood.
- Branch per feature; PR into `main`. No force-push to `main`.
- Conventional-commits welcome but not required.
- Never commit `.env*` (enforced by `.gitignore`). Never commit customer data (there's no customer data in this repo anyway — but if in doubt, don't).

### Secrets
- Local dev: `.env.local`. Never committed.
- Convex: `npx convex env set KEY value`. 
- Production: deploy-time env, never in source.
- If a secret accidentally lands in git history, rotate it THEN force-remove from history. Rotate first.

## 5. Current state — what's built

- `convex/schema.ts` — multi-tenant schema, MVP + phase 2 shape (17 tables)
- `convex/neis/` — full TypeScript port of `neis_parser.py`:
  - `regex.ts` — full + min NEIS patterns, DN/CMP patterns
  - `parser.ts` — `parseFilename()`, renderers, `isNeisCompliant()`
  - `normalise.ts` — `normaliseDn()`, `normaliseCmp()`, `buildingIdFromParts()`
  - `credibility.ts` — FIELD_WEIGHTS, `recordCredibility()`, `credibilityRoute()`, parser-glue
  - `viewTypes.ts` — drawing number → view type
  - `index.ts` — barrel
- `convex/seed/` — NEIS convention + global originator registry seeds (idempotent)
- `convex/conventions.ts` — queries + mutations for conventions and originator registry
- `convex/lib/authz.ts` — `requireOrgMember`, `requireOrgRole`, `requireProjectAccess`
- `tests/neis.test.ts` — parity fixtures (full form, min form, legacy, DN/CMP normalisation, credibility math)

## 6. Current state — what's NOT built yet

Order of priority:

1. **Document ingest pipeline** — HTTP action for upload; file classification by mime; content extraction (pdf-parse, mammoth, SheetJS); Claude structured-output call driven by `convention.fields`; credibility scoring; route to `filed` / `review` / `quarantine`; audit events at each step.
2. **Storage adapter interface** — `StorageAdapter` with `R2Adapter`, `SmbAdapter`, `AzureBlobAdapter`, `OvhAdapter` implementations. Adapter selected per project.
3. **Upload UI** — Next.js page, drag-drop, single + bulk, instant NEIS validation via the TS regex, progress streaming from Convex subscriptions.
4. **Review queue UI** — card-per-file, inline rename preview, approve / correct / batch actions.
5. **Register view + export** — live web view backed by `registerEntries` table; XLSX export matching CWMF Document Issue Register format.
6. **Synopsis generation** — per-site workbook (template from `DN0574-SeaviewHouse-Synopsis.xlsx` style); regenerates on document state changes.
7. **Billing** — Stripe subscriptions + metered usage via `usageCounters`; tier enforcement in action handlers.
8. **Observability wiring** — structured logs to Axiom EU; error reporting; p95 latency tracking per action.

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

**Metadata outside the filename:** Purpose Code (P00–P10), Acceptance Code (S/A/B/C/D), Revision (integer starting at O), Revision Description. Stored on the `documents` table, NOT parsed from the filename.

**Credibility gates** (parity with `neis_parser.py`):
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

- `docs/01-estate-spine-prd.md` — engine architecture, credibility model, canonical taxonomy (the upstream spec this product implements)
- `docs/02-productisation-brief.md` — commercial SaaS wrapper scope, tiers, pricing model
- `docs/03-storage-brief.md` — the D3 research: R2 vs Azure vs AWS vs OVH, cost model, procurement path
- `docs/04-commercial-model.md` — HSE pilot → regional → national pricing, margin glide, value props
- `docs/99-neis-convention-rev11.pdf` — source standard
- `reference/neis_parser.py` — Python reference implementation for the Spine workers (DO NOT modify without updating the TS port and the parity tests)

## 9. Hard rules (things we don't do)

- **Never** replace Aconex, Fieldwire, or any HSE CDE. Integrate, don't replace.
- **Never** log secrets, customer document contents, or extracted field values at default log levels. Structured log metadata only.
- **Never** train any model on customer data. Zero-retention is contractual — don't let it slip operationally.
- **Never** ship a change to a scoring weight or credibility gate without updating both `neis_parser.py` and `convex/neis/credibility.ts` in the same PR.
- **Never** bypass `requireOrgMember` in a tenant-scoped function. Every single one.
- **Never** store financial data (cards, accounts, IBANs). Stripe Elements only.
- **Never** add a dependency without pinning its major version in `package.json`.

## 10. When in doubt

- Check `docs/` first for the written decision
- Parity tests in `tests/neis.test.ts` are the contract for the NEIS module — if they pass, you're aligned with the Python reference
- If a question isn't answered here or in `docs/`, raise it with Liam before assuming
- If you're about to make an architectural decision that isn't in §2, stop and ask — those are the kinds of decisions that are expensive to reverse
