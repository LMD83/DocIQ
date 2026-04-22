# Session 0 — merge DocRoute into the GovIQ repo

Standalone runbook for opening the **GovIQ parent repo** in Cursor and
merging this DocRoute module into it. Run this once, in a Cursor session
pointed at the GovIQ repo (not this DocIQ staging repo).

> ⚠️ **This must happen in a Cursor session opened against the GovIQ
> repo**, because Session 0 needs to read GovIQ's real `convex/schema.ts`
> and auth helpers to reconcile the placeholders in this module. The
> DocRoute staging repo (this one) doesn't contain those.

---

## Prerequisites

- Both repos cloned locally:
  - GovIQ repo (e.g. `~/code/goviq/`)
  - This DocRoute staging repo (e.g. `~/code/dociq/`)
- GovIQ repo runs cleanly: `npx convex dev` starts, tests pass.
- Cursor installed and logged in.

---

## Step 1 — Copy the module into GovIQ

From **the GovIQ repo root** (adjust source path to where your DocRoute
staging repo lives):

**macOS/Linux:**
```bash
cp -r ~/code/dociq/convex/docroute                convex/docroute
cp -r ~/code/dociq/docs                            docs/docroute
cp -r ~/code/dociq/reference                       reference/docroute
cp    ~/code/dociq/tests/neis.test.ts              tests/docroute.neis.test.ts
cp    ~/code/dociq/CLAUDE.md                       convex/docroute/CLAUDE.md
cp    ~/code/dociq/.cursor/rules/docroute-context.md .cursor/rules/docroute-context.md
cp    ~/code/dociq/.cursor/rules/convex-patterns.md  .cursor/rules/docroute-convex-patterns.md
```

**Windows PowerShell:**
```powershell
Copy-Item -Recurse C:\Users\gavin\Documents\DocIQ\convex\docroute              convex\docroute
Copy-Item -Recurse C:\Users\gavin\Documents\DocIQ\docs                          docs\docroute
Copy-Item -Recurse C:\Users\gavin\Documents\DocIQ\reference                     reference\docroute
Copy-Item         C:\Users\gavin\Documents\DocIQ\tests\neis.test.ts             tests\docroute.neis.test.ts
Copy-Item         C:\Users\gavin\Documents\DocIQ\CLAUDE.md                      convex\docroute\CLAUDE.md
Copy-Item         C:\Users\gavin\Documents\DocIQ\.cursor\rules\docroute-context.md .cursor\rules\docroute-context.md
Copy-Item         C:\Users\gavin\Documents\DocIQ\.cursor\rules\convex-patterns.md  .cursor\rules\docroute-convex-patterns.md
```

Do NOT copy: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`,
`apps/`, `scripts/` — those stay in the staging repo. `apps/web` ports
separately once merge is done.

After copy, GovIQ tree should have:

```
convex/
├── schema.ts                         # existing GovIQ root schema (edit in Step 2)
├── ... existing GovIQ modules
└── docroute/
    ├── schema.ts                     # exports individual dr_* defineTable(...)
    ├── conventions.ts                # queries + mutations, inline GovIQ auth
    ├── neis/                         # regex, parser, normalise, credibility, viewTypes, index
    ├── seed/                         # seedData, seedConventions, seedOriginators
    └── CLAUDE.md                     # module engineering context
tests/
└── docroute.neis.test.ts             # parity fixtures
docs/docroute/                        # product briefs
reference/docroute/                   # Python reference + code-table CSVs
.cursor/rules/
├── docroute-context.md               # Cursor AI briefing for DocRoute
└── docroute-convex-patterns.md       # Cursor AI patterns for convex/docroute
```

---

## Step 2 — Merge dr_* tables into GovIQ's root schema

Edit `convex/schema.ts` in the GovIQ repo. Add the import + 11 table
entries:

```ts
import { defineSchema } from "convex/server";
import * as dr from "./docroute/schema";
// ... existing imports

export default defineSchema({
  // ... existing GovIQ tables: sp_organisations, sp_users,
  //                           gov_memberships, gov_auditEvents,
  //                           sp_procurements, documentPool, emailPool, ...

  dr_conventions:        dr.dr_conventions,
  dr_originatorRegistry: dr.dr_originatorRegistry,
  dr_folderTrees:        dr.dr_folderTrees,
  dr_projects:           dr.dr_projects,
  dr_projectMembers:     dr.dr_projectMembers,
  dr_sites:              dr.dr_sites,
  dr_buildings:          dr.dr_buildings,
  dr_documents:          dr.dr_documents,
  dr_reviewQueue:        dr.dr_reviewQueue,
  dr_registerEntries:    dr.dr_registerEntries,
  dr_synopsisSnapshots:  dr.dr_synopsisSnapshots,
});
```

Save. Do **not** run `npx convex dev` yet — Step 3 must complete first or
it will fail with type errors from the placeholders.

---

## Step 3 — Reconcile placeholders (Cursor Composer)

Open Cursor's Composer (⌘I) in the GovIQ repo and paste this entire prompt:

> Run Session 0 — schema reconciliation for the just-added DocRoute module.
>
> **Read first** (don't skip any):
> - `convex/schema.ts` — root schema with all existing GovIQ tables
> - `convex/auth.ts` (or wherever GovIQ resolves Convex identity → user row)
> - Any `convex/lib/*.ts` file containing membership or role helpers
> - The actual table definitions for: `sp_organisations`, `sp_users`,
>   `gov_memberships`, `gov_auditEvents`, and `sp_procurements` (or the
>   GovIQ equivalent of a procurement-level entity)
> - `convex/docroute/CLAUDE.md` for the module context
>
> **Then read**:
> - `convex/docroute/schema.ts`
> - `convex/docroute/conventions.ts`
> - `convex/docroute/seed/seedConventions.ts`
> - `convex/docroute/seed/seedOriginators.ts`
>
> **Fix every `TODO(session-0)` marker by reconciling against the real
> GovIQ shape.** Specifically:
>
> 1. **`convex/docroute/schema.ts`** — confirm the FK table names
>    (`sp_organisations`, `sp_users`, `sp_procurements`) match GovIQ.
>    If any name differs, rename the `v.id("...")` references in all
>    11 tables. If GovIQ has no procurement-level entity, either:
>    (a) remove the `procurementId` field from `dr_projects`, or
>    (b) point it at the closest equivalent GovIQ table.
>
> 2. **`convex/docroute/conventions.ts`** — two options:
>    - (preferred) if GovIQ has existing auth helpers (e.g.
>      `requireOrgMember` in `convex/lib/auth.ts`), delete the inline
>      helpers here and import from there.
>    - (fallback) keep the inline helpers but fix the field/index names:
>      - `sp_users.authSubject` and its `by_authSubject` index
>      - `gov_memberships.userId` / `.orgId` / `.role` and the
>        `by_userId_orgId` composite index
>      - `gov_auditEvents` row shape: confirm `actor` / `eventType` /
>        `after` / `timestamp` fields, map the `writeAudit` helper onto
>        the real shape
>
> 3. Confirm `ORG_ROLE_RANK` matches the role values in
>    `gov_memberships.role`. Remove or rename roles as needed.
>
> 4. Run `npx convex dev` and fix any schema validation or type errors
>    until the deployment succeeds.
>
> 5. Run `npm test` (or the GovIQ test command — `pnpm test`, `bun test`,
>    etc.) and confirm the DocRoute NEIS parity fixtures all pass.
>
> **Report every change made**, with the real field/table name you mapped
> each placeholder to. Do NOT modify any GovIQ core table. Do NOT add
> new dependencies. Do NOT introduce a new `convex/lib/authz.ts` — the
> whole point is to reuse GovIQ's existing pattern.
>
> When done, summarise the diff vs the placeholder version in a table so
> I can review.

Review every change Composer makes. Push back on any that alters GovIQ
core tables or adds parallel helpers.

---

## Step 4 — Seed the global rows

Still in the GovIQ repo root, with `npx convex dev` running:

```bash
npx convex run docroute/seed/seedConventions:seedAll
npx convex run docroute/seed/seedOriginators:seedGlobal
```

Expected output:
```
Seeded NEIS: created (jh...)
Seeded ISO 19650: created (jh...)
Originator registry: 5 created, 0 updated
```

Both are idempotent — safe to re-run.

---

## Step 5 — Wire npm scripts (optional but convenient)

Add to GovIQ root `package.json`:

```json
{
  "scripts": {
    "docroute:seed": "npx convex run docroute/seed/seedConventions:seedAll && npx convex run docroute/seed/seedOriginators:seedGlobal",
    "docroute:test": "vitest run tests/docroute.neis.test.ts"
  }
}
```

So developers can `npm run docroute:test` without remembering paths.

---

## Step 6 — Commit + PR

```bash
git checkout -b feature/docroute-module-merge
git add convex/docroute \
        convex/schema.ts \
        docs/docroute \
        reference/docroute \
        tests/docroute.neis.test.ts \
        .cursor/rules/docroute-context.md \
        .cursor/rules/docroute-convex-patterns.md \
        package.json
git commit -m "Merge DocRoute module (dr_* schema, NEIS parser, seeds)"
git push -u origin feature/docroute-module-merge
```

Open a PR for review. DocRoute feature work (ingest pipeline, upload UI)
proceeds in subsequent sessions on top of this merge.

---

## Step 7 — Port the UI (optional, after merge PR merges)

Once the module merge is green, bring the UI across:

```bash
cp -r ~/code/dociq/apps/web  apps/docroute   # or wherever GovIQ UI apps live
```

Then:
1. Delete the mock `runPipeline` in `lib/upload-store.ts` and replace
   with a real Convex action call.
2. Update `@neis/*` tsconfig path from `../../convex/docroute/neis/*` to
   whatever the import depth is in the GovIQ monorepo.
3. Reconcile Tailwind config with GovIQ's root app tokens — don't fork;
   merge the Raycast-aesthetic tokens into the existing config.

---

## Checklist — have I done everything?

- [ ] Module files copied into GovIQ tree per Step 1
- [ ] `dr_*` tables added to root `convex/schema.ts` per Step 2
- [ ] Session 0 composer run; every `TODO(session-0)` reconciled
- [ ] `npx convex dev` deploys cleanly
- [ ] `npx convex run docroute/seed/seedConventions:seedAll` succeeded
- [ ] `npx convex run docroute/seed/seedOriginators:seedGlobal` succeeded
- [ ] NEIS parity fixtures all pass
- [ ] Feature branch pushed, PR opened

When every box is ticked, DocRoute is live as a module inside GovIQ.
