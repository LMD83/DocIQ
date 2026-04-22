# Merging DocRoute into the GovIQ repo

DocRoute is a **module inside the GovIQ platform**, not a standalone app.
This guide describes how to merge the module source into the GovIQ repo,
reconcile it against the real GovIQ schema, and get it deployed on the
existing GovIQ Convex deployment. Total time: ~60 minutes if GovIQ is
already running locally.

This file replaces the old "standalone scaffold" migration guide.

---

## Prerequisites

- You already have the GovIQ repo checked out locally and `npx convex dev`
  runs cleanly against the shared deployment (`different-dolphin-62.eu-west-1.convex.cloud`).
- Node.js 20+, npm/pnpm, git, **Claude Code** installed.
- You're an admin on the GovIQ Convex deployment (you'll be seeding global
  rows).

No separate accounts are required — DocRoute uses the GovIQ Anthropic key,
Convex deployment, storage credentials, and billing. All secrets stay at the
GovIQ deployment level (`npx convex env set KEY value`).

---

## Step 1 — Copy the module into the GovIQ tree

From the GovIQ repo root:

```
cp -r /path/to/dociq/convex/docroute convex/docroute
cp -r /path/to/dociq/docs             docs/docroute
cp -r /path/to/dociq/reference        reference/docroute
cp    /path/to/dociq/tests/neis.test.ts tests/docroute.neis.test.ts
cp    /path/to/dociq/CLAUDE.md        convex/docroute/CLAUDE.md
cp    /path/to/dociq/MIGRATION.md     convex/docroute/MIGRATION.md
```

Do **not** copy `package.json`, `tsconfig.json`, `.gitignore`, or
`.env.example` from the DocRoute repo — those are inherited from the GovIQ
root. The DocRoute staging repo deliberately doesn't ship these.

The GovIQ tree should now contain:

```
convex/
├── schema.ts                      # existing GovIQ root schema
├── _generated/                    # existing
├── ...                            # existing GovIQ modules
└── docroute/                      # NEW — module lives here
    ├── schema.ts                  # exports individual dr_* defineTable(...)
    ├── conventions.ts             # queries + mutations, inline GovIQ auth
    ├── neis/                      # regex, parser, normalise, credibility, viewTypes, index
    ├── seed/                      # seedData, seedConventions, seedOriginators
    ├── CLAUDE.md                  # DocRoute engineering context
    └── MIGRATION.md               # this file
tests/
└── docroute.neis.test.ts          # parity fixtures
docs/docroute/                     # product briefs (moved for scoping)
reference/docroute/                # Python reference + code-table CSVs
```

## Step 2 — Merge `dr_*` tables into the root schema

Edit GovIQ's root `convex/schema.ts`:

```ts
import { defineSchema } from "convex/server";
import * as dr from "./docroute/schema";
// ... existing imports

export default defineSchema({
  // ... existing GovIQ tables: sp_organisations, sp_users,
  //                           gov_memberships, gov_auditEvents,
  //                           sp_procurements, documentPool, ...

  dr_conventions:         dr.dr_conventions,
  dr_originatorRegistry:  dr.dr_originatorRegistry,
  dr_folderTrees:         dr.dr_folderTrees,
  dr_projects:            dr.dr_projects,
  dr_projectMembers:      dr.dr_projectMembers,
  dr_sites:               dr.dr_sites,
  dr_buildings:           dr.dr_buildings,
  dr_documents:           dr.dr_documents,
  dr_reviewQueue:         dr.dr_reviewQueue,
  dr_registerEntries:     dr.dr_registerEntries,
  dr_synopsisSnapshots:   dr.dr_synopsisSnapshots,
});
```

Save. Do NOT run `npx convex dev` yet — Step 3 reconciles placeholder
references first.

## Step 3 — Session 0: schema reconciliation (MANDATORY)

The DocRoute scaffold was written without direct access to the real GovIQ
schema, so several references are placeholders. You must reconcile them
before the first deploy or `npx convex dev` will fail.

Start Claude Code from the **GovIQ repo root** and paste this prompt:

> Run Session 0 — schema reconciliation for the DocRoute module.
>
> Read these GovIQ files first:
> - `convex/schema.ts` — the root schema with GovIQ's existing tables
> - `convex/auth.ts` (or wherever GovIQ resolves Convex identity → user row)
> - Any `convex/lib/*.ts` that has membership-check helpers
> - The table definitions for `sp_organisations`, `sp_users`,
>   `gov_memberships`, `gov_auditEvents`, and `sp_procurements` (or
>   whichever procurement-equivalent table GovIQ uses)
>
> Then read:
> - `convex/docroute/schema.ts`
> - `convex/docroute/conventions.ts`
> - `convex/docroute/seed/seedConventions.ts`
> - `convex/docroute/seed/seedOriginators.ts`
>
> Fix every `TODO(session-0)` marker by reconciling against the real GovIQ
> shape. Specifically:
>
> 1. In `convex/docroute/schema.ts`: confirm `sp_organisations`,
>    `sp_users`, `sp_procurements` are the correct FK table names. If
>    GovIQ uses different names, rename every `v.id("...")` reference.
>    (`sp_procurements` is optional — if GovIQ doesn't model a
>    procurement-equivalent entity, remove the `procurementId` field from
>    `dr_projects` or adjust the FK.)
>
> 2. In `convex/docroute/conventions.ts`: replace the inline `requireUser`
>    / `requireOrgMember` / `requireOrgRole` / `writeAudit` helpers with
>    imports from GovIQ's existing auth helpers if they exist. If not, fix
>    the field/index names:
>    - `sp_users` index `by_authSubject` and field `authSubject` → real names
>    - `gov_memberships` index `by_userId_orgId` and field `role` → real names
>    - `gov_auditEvents` row shape: confirm the `actor` / `eventType` /
>      `after` / `timestamp` fields match real shape; map payloads as needed.
>
> 3. Confirm the role vocabulary in `ORG_ROLE_RANK` matches
>    `gov_memberships.role` values.
>
> 4. Run `npx convex dev` and fix any type errors until the schema deploys
>    cleanly.
>
> 5. Run `npm test` and confirm all NEIS parity fixtures pass.
>
> Report every change made, with the real field/table name you mapped
> each placeholder to. Do NOT modify any GovIQ core table. Do NOT add new
> dependencies.

When Claude Code reports done, spot-check the changes it made, then commit.

## Step 4 — Seed global conventions and originators

From the GovIQ repo root:

```
npx convex run docroute/seed/seedConventions:seedAll
npx convex run docroute/seed/seedOriginators:seedGlobal
```

Expected output:
```
Seeded NEIS: created (jh...)
Seeded ISO 19650: created (jh...)
Originator registry: 5 created, 0 updated
```

Both scripts are idempotent — safe to re-run.

## Step 5 — Wire a developer npm script (optional)

Add to GovIQ root `package.json` scripts:

```json
"docroute:seed": "npx convex run docroute/seed/seedConventions:seedAll && npx convex run docroute/seed/seedOriginators:seedGlobal",
"docroute:test": "vitest run tests/docroute.neis.test.ts"
```

So developers can `npm run docroute:test` without remembering paths.

## Step 6 — Verify parity tests pass

```
npm test
```

The DocRoute NEIS fixtures must remain green — they are the contract with
`reference/docroute/neis_parser.py`. Any red here before you touch feature
code means the merge introduced drift; fix before proceeding.

## Step 7 — Commit, open a feature branch, move on to Session 1

```
git checkout -b feature/docroute-module-merge
git add convex/docroute docs/docroute reference/docroute tests/docroute.neis.test.ts convex/schema.ts package.json
git commit -m "Merge GovIQ DocRoute module (schema + NEIS parser + seeds)"
git push -u origin feature/docroute-module-merge
```

Open a PR for review. DocRoute feature work (ingest pipeline, upload UI,
review queue) proceeds in subsequent sessions on top of this merge.

---

## Session 1 prompt (for after the merge is green)

> Build the document ingest pipeline described in
> `convex/docroute/CLAUDE.md` §6 point 1.
>
> Requirements:
> - HTTP action in `convex/docroute/documents.ts` that accepts an upload
>   for a given `dr_projects` row
> - Stores the file via the existing GovIQ file storage (adapter work is
>   Session 2; this session hardcodes Convex file storage)
> - Computes SHA256; dedupes against `by_project_sha` index on `dr_documents`
> - Runs `parseFilename` from `convex/docroute/neis/parser.ts` on the name
> - Enqueues an internal action on the existing GovIQ `documentPool` that:
>     - Loads the convention for the project from `dr_conventions`
>     - Extracts text from PDF (pdf-parse), DOCX (mammoth), XLSX (SheetJS)
>     - Calls Claude via Anthropic SDK with structured output, schema
>       derived from `convention.fields`. Prompt lives at
>       `convex/docroute/extraction/prompts/<docType>.ts` as a
>       first-class artefact, NOT a string inside a handler.
>     - Uses sha256 as cache key to skip re-extraction
>     - Computes per-field confidence, runs `scoringFromParser` +
>       `recordCredibility`
>     - Sets `dr_documents.status` and writes extracted fields
>     - Emits `gov_auditEvents` rows at: uploaded, extracted, scored, routed
>       — each with `eventType = "docroute.document.<action>"`
> - Respects licence status (-0.15 penalty when student watermark detected)
> - p95 < 30s per file
>
> Use the Anthropic SDK pinned in the GovIQ root `package.json` (add it if
> missing, pin the major version). Write unit tests for the dedupe path
> and the confidence-map translation. Do not touch the storage adapter
> interface yet.
>
> Start by writing a short plan for my review before any code.

---

## If something goes wrong

- **`npx convex dev` fails with `Type 'sp_something' does not exist`:**
  Session 0 wasn't completed. Go back to Step 3.
- **`npm test` fails after the merge:** parity fixtures broke. `git diff`
  against `main` and check whether anything in
  `convex/docroute/neis/regex.ts`, `parser.ts`, `normalise.ts`, or
  `credibility.ts` changed without an explicit reason. If so, roll back —
  those files are the Python-parity contract and only change with a
  coordinated PR to `reference/docroute/neis_parser.py`.
- **`gov_auditEvents` insert fails with "missing field":** the DocRoute
  `writeAudit` helper guessed at the row shape. Open
  `convex/docroute/conventions.ts` and adjust the insert to match the
  real `gov_auditEvents` shape (this is the kind of thing Session 0
  should have caught — double-check it did).
- **Seeds fail with "Table not found":** the schema merge in Step 2 wasn't
  saved, or `npx convex dev` didn't redeploy. Restart it and confirm the
  new tables appear in the dashboard.

---

## Checklist — have I done everything?

- [ ] Files copied into GovIQ tree per Step 1
- [ ] `dr_*` tables added to root `convex/schema.ts`
- [ ] Session 0 completed; every `TODO(session-0)` reconciled
- [ ] `npx convex dev` deploys cleanly against shared GovIQ deployment
- [ ] `npm run docroute:seed` completed; two conventions + five originators live
- [ ] `npm test` green, NEIS parity fixtures all pass
- [ ] Feature branch pushed, PR opened
- [ ] `CLAUDE.md` (at `convex/docroute/CLAUDE.md`) reviewed by Liam before
      Session 1 starts

When every box is ticked, DocRoute is live as a module inside GovIQ and
the next session can start on the ingest pipeline.
