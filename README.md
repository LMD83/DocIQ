# GovIQ DocRoute — staging repo

Staging area for the GovIQ DocRoute module before it merges into the GovIQ
parent repo. Also hosts the Raycast-aesthetic UI prototype and the HSE
DNREF sorting pipeline.

DocRoute is a module inside the GovIQ platform. It reuses GovIQ core for
tenancy, auth (Entra ID), memberships, audit events, billing, workpools, and
cron. It contributes `dr_*` tables and NEIS parsing / credibility logic for
HSE Estates and other Irish public-sector estate records.

> Read `CLAUDE.md` for the engineering context and hard rules.
> Read `SESSION_0.md` when you're ready to merge into GovIQ.
> Read `MIGRATION.md` for the full-length reference version of the merge runbook.

## Open in Cursor

```bash
git clone <this-repo>
cd dociq
# Open the multi-root workspace for cleaner navigation:
cursor .vscode/DocIQ.code-workspace
# …or just open the root:
cursor .
```

Cursor picks up briefings from `.cursor/rules/*` automatically. The root
rule (`docroute-context.md`) always applies; the scoped rules only apply
when Cursor touches files matching their globs.

## Run the UI

```bash
cd apps/web
npm install
npm run dev
# http://localhost:3001 — redirects to /upload
```

Port is fixed at **3001** so this can run alongside another Next.js app on
3000. The upload surface simulates the full ingest pipeline with live
state — see `apps/web/README.md` for details.

## Layout

```
.
├── CLAUDE.md                           # Engineering context (read first)
├── SESSION_0.md                        # Merge-into-GovIQ runbook (standalone)
├── MIGRATION.md                        # Full-length reference version
├── README.md                           # This file
│
├── .cursor/rules/                      # Cursor AI briefings
│   ├── docroute-context.md             #   always-apply project rules
│   ├── web-patterns.md                 #   apps/web/** patterns
│   └── convex-patterns.md              #   convex/docroute/** patterns
├── .vscode/                            # Cursor / VS Code workspace
│   ├── extensions.json                 #   recommended extensions
│   ├── settings.json                   #   formatter + Tailwind IntelliSense
│   └── DocIQ.code-workspace            #   multi-root workspace
│
├── apps/web/                           # Next.js 15 staging UI (Raycast aesthetic)
│   ├── app/upload/page.tsx             #   Upload surface (live pipeline UX)
│   ├── components/ui                   #   Shared primitives (Button/Badge/Kbd)
│   ├── components/upload               #   Drop zone, file row, batch summary
│   └── lib/upload-store.ts             #   Zustand store + simulated pipeline
│
├── convex/docroute/                    # The module (merges to <goviq>/convex/docroute/)
│   ├── schema.ts                       #   Individual dr_* defineTable exports
│   ├── conventions.ts                  #   Queries + mutations, inline GovIQ auth
│   ├── neis/                           #   Regex, parser, normalise, credibility
│   └── seed/                           #   NEIS + ISO 19650 + originator seeds
│
├── scripts/sorting/                    # HSE DNREF sort pipeline (Windows-local)
│   ├── sort_folders.py                 #   v3 Tier-A-aware scorer
│   ├── content_extract.py              #   v4 with free OCR fallback
│   ├── content_extract_vision.py       #   optional paid Claude vision
│   ├── content_extract_tier_b.py       #   optional paid structured extraction
│   └── requirements.txt                #   pinned deps
│
├── tests/neis.test.ts                  # NEIS parity fixtures
├── docs/                               # Product briefs
└── reference/                          # Python reference parser + HSE CSVs
```

## What lives where — when to edit what

| If you want to …                                            | Edit here                                |
|------------------------------------------------------------|------------------------------------------|
| Change a NEIS regex or credibility weight                  | `convex/docroute/neis/*.ts` **and** `reference/neis_parser.py` + parity fixtures |
| Add a new DocRoute table                                    | `convex/docroute/schema.ts` (add `defineTable`, update `SESSION_0.md` wire-up) |
| Tweak the upload surface aesthetic                          | `apps/web/tailwind.config.ts` + `app/globals.css` |
| Add a new UI component                                      | `apps/web/components/<feature>/` — compose from `components/ui/*` primitives |
| Extend the HSE sort scorer                                  | `scripts/sorting/sort_folders.py` |
| Change CURSOR AI behaviour                                  | `.cursor/rules/*.md` |

## Current state

- ✅ Schema + NEIS parser + seeds (module-ready)
- ✅ Upload UI surface (dark Raycast aesthetic, live pipeline UX)
- ✅ HSE sort pipeline hitting 96.9% publish on 14k-file legacy tree
- ✅ Session 0 runbook written (requires GovIQ repo access to execute)
- 🟡 Ingest pipeline (`convex/docroute/documents.ts`) — not started; Session 1 after merge
- 🟡 Review queue UI — not started; next UI surface after upload feedback
- 🟡 Register view + XLSX export — not started
- 🟡 Storage adapter interface — not started; Session 2 after merge
- 🟡 Synopsis generation — not started

## Hard rules (see CLAUDE.md §9)

- Never redefine GovIQ core tables (`sp_*`, `gov_*`).
- Never bypass the inline GovIQ auth pattern (identity → `sp_users` → `gov_memberships`).
- Never change a credibility weight without updating both the TS module and the Python reference in the same PR.
- Never free-text-parse a Claude response — structured output via tool use only.
- Never commit `.env*`, `node_modules`, or customer data.
