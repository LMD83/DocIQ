# GovIQ DocRoute — module staging repo

This repo is the **staging area** for the GovIQ DocRoute module before it
gets merged into the GovIQ parent repo. It is not a standalone application.

DocRoute is a module inside the GovIQ platform. It reuses GovIQ core for
tenancy, auth (Entra ID), memberships, audit events, billing, workpools, and
cron. It contributes domain-specific `dr_*` tables and NEIS parsing /
credibility logic for HSE Estates and other public-sector estate records.

See `CLAUDE.md` for the engineering context and `MIGRATION.md` for the
merge-into-GovIQ runbook (including the mandatory Session 0 schema
reconciliation step).

## Layout

```
.
├── CLAUDE.md                         # Engineering context — read at every session
├── MIGRATION.md                      # Merge-into-GovIQ runbook + Session 0 prompt
├── convex/
│   └── docroute/                     # Lives under convex/docroute/ in GovIQ
│       ├── schema.ts                 # Exports individual dr_* defineTable(...)
│       ├── conventions.ts            # Queries/mutations, inline GovIQ auth
│       ├── neis/                     # Regex, parser, normalise, credibility, viewTypes
│       └── seed/                     # NEIS + ISO 19650 + originator seeds
├── tests/
│   └── neis.test.ts                  # Vitest parity fixtures with Python reference
├── docs/                             # Product briefs (PRD, productisation, storage, commercial)
├── reference/                        # Python reference parser + code-table CSVs
│   ├── neis_parser.py
│   └── code-tables/
└── (no package.json, tsconfig.json, .env.example — inherited from GovIQ root)
```

## Why there's no package.json or tsconfig.json

DocRoute inherits all dev config from the GovIQ root repo when merged. This
staging repo intentionally doesn't ship its own Node/TS config — that's what
makes the merge a drop-in rather than a reconciliation of two dependency
trees.

If you need to run the parity tests before merge, clone into a GovIQ-sized
environment (Node 20, vitest, convex) and run `vitest run tests/neis.test.ts`.

## Design decisions worth knowing

- **Module, not standalone.** No `organisations` / `users` / `memberships` /
  `auditEvents` tables — DocRoute references the GovIQ-core equivalents
  (`sp_organisations`, `sp_users`, `gov_memberships`, `gov_auditEvents`).
- **dr_\* table prefix.** Every DocRoute-owned table is prefixed, matching
  GovIQ's `sp_*` / `gov_*` / `core_*` convention.
- **Conventions are data, not code.** NEIS Rev 11 lives in `dr_conventions`
  rows you can version and swap. Custom conventions for non-HSE customers
  use the same shape.
- **Global vs org-scoped rows.** NEIS and ISO 19650 are seeded with
  `orgId: undefined` — visible to every tenant. Custom conventions carry an
  `orgId` and are only visible to that tenant.
- **Regex lives in one TS module** (`convex/docroute/neis/regex.ts`). Both
  client-side upload validation and server-side parsing import from the same
  source. The Python `reference/neis_parser.py` is the reference
  implementation; the TS module mirrors it and is tested against the same
  fixtures.
- **Credibility scoring** reproduces `FIELD_WEIGHTS`, `LICENCE_PENALTIES`,
  and `CREDIBILITY_GATES` byte-for-byte from the Python parser. A parity
  test in `tests/neis.test.ts` guards against drift.
- **Schema covers the full product vision** (sites, buildings, review queue,
  register entries, synopsis) so the MVP path does not need a destructive
  migration later.

## What's not in this staging repo

These come in subsequent sessions after the module is merged into GovIQ:

1. Extraction prompts (`convex/docroute/extraction/prompts/`, one file per doc-type)
2. Document ingest pipeline (upload → hash → classify → parse → extract → score → route)
3. Storage adapter interface (R2, SMB, Azure Blob, OVH)
4. Upload UI (Next.js page in the GovIQ root app)
5. Review queue UI
6. Register export (XLSX) and synopsis generation
7. Observability wiring (through GovIQ's existing pipeline)

Billing is handled at the GovIQ platform level — no DocRoute-specific
subscriptions, usage counters, or Stripe wiring.

## Cross-reference

- `CLAUDE.md` — engineering context, decisions locked, hard rules
- `MIGRATION.md` — merge runbook with Session 0 reconciliation prompt
- `docs/00-initial-prd-draft.md` — engine spec
- `docs/02-productisation-brief.md` — commercial SaaS wrapper scope
- `docs/99-neis-convention-rev11.pdf` — source standard
- `reference/neis_parser.py` — Python reference implementation (do not modify
  without updating the TS port and the parity tests)
