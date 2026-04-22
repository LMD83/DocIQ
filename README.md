# GovIQ DocRoute — Convex backend scaffold

First cut of the commercial SaaS wrapper around the Estate Record Spine engine.
Delivers three things from the productisation brief:

1. **`convex/schema.ts`** — multi-tenant Convex schema (§6 of the brief).
2. **`convex/neis/`** — TypeScript port of `neis_parser.py` regex, normalisation,
   and credibility scoring. Single source of truth for filename validation on
   client + server.
3. **`convex/seed/`** — seed loader that writes the NEIS convention and
   originator registry to Convex on first run. All 8 HSE code tables are
   embedded as TS constants so the seed is reproducible in any environment.

## Layout

```
goviq-docroute/
├── convex/
│   ├── schema.ts                   # Full schema, multi-tenant
│   ├── conventions.ts              # Queries/mutations for conventions + originators
│   ├── lib/
│   │   └── authz.ts                # Org membership + role checks
│   ├── neis/
│   │   ├── regex.ts                # Regex patterns (mirrors neis_parser.py)
│   │   ├── parser.ts               # parse_filename() equivalent
│   │   ├── normalise.ts            # DN / CMP canonicalisation
│   │   ├── credibility.ts          # FIELD_WEIGHTS + score + route
│   │   ├── viewTypes.ts            # Document view type map
│   │   └── index.ts                # Barrel export
│   └── seed/
│       ├── seedData.ts             # Embedded code tables (source: your CSVs)
│       ├── seedConventions.ts      # internalAction — seeds NEIS convention
│       └── seedOriginators.ts      # internalAction — seeds originator registry
├── tests/
│   └── neis.test.ts                # Vitest fixtures (parity with Python __main__)
├── package.json
└── tsconfig.json
```

## Running

```bash
# 1. Install
npm install

# 2. Initialise Convex (creates deployment, generates _generated/)
npx convex dev

# 3. In a second terminal, seed the global conventions + originators
npx convex run seed/seedConventions:seedAll
npx convex run seed/seedOriginators:seedGlobal

# 4. Run tests
npm test
```

## Design decisions worth knowing

- **Conventions are data, not code.** NEIS Rev 11 lives in Convex rows you can
  version and swap. Custom conventions for non-HSE customers use the same
  shape.
- **Global vs org-scoped rows.** NEIS and ISO 19650 are seeded with
  `orgId: undefined` — visible to every tenant. Custom conventions carry an
  `orgId` and are only visible to that tenant.
- **Regex lives in one TS module** (`convex/neis/regex.ts`). Both client-side
  upload validation and server-side worker parse import from the same source.
  The Python `neis_parser.py` is the reference implementation; the TS module
  mirrors it exactly and is tested against the same fixtures.
- **Credibility scoring** (`credibility.ts`) reproduces `FIELD_WEIGHTS`,
  `LICENCE_PENALTIES`, and `CREDIBILITY_GATES` byte-for-byte from the Python
  parser. Any change to weights must update both; a parity test in
  `tests/neis.test.ts` guards against drift.
- **Schema covers the full product vision** (billing, sites, registers,
  synopses) so you do not need a destructive migration later. The MVP path only
  writes to a subset of these tables.

## What this scaffold does not include yet

These come in subsequent drops, in this order:

1. JSON schemas per convention for Claude structured extraction
2. Document ingest pipeline (upload → hash → classify → parse → extract → score → route)
3. Review queue UI (Next.js + shadcn/ui)
4. Register export (XLSX) and synopsis generation
5. Storage adapter interface (SMB, SharePoint, Aconex)
6. Stripe billing integration
7. Observability wiring (Axiom / Logtail)

## Cross-reference

- Estate Record Spine PRD v1.0 — engine architecture, credibility model,
  canonical taxonomy.
- NEIS File Naming Convention Rev 11 (HSE) — the convention this scaffold
  seeds.
- `neis_parser.py` — Python reference implementation for the worker side.
- Productisation Brief v0.1 — commercial wrapper scope.
