---
description: Core DocRoute project rules — read at every request
alwaysApply: true
---

# DocRoute (GovIQ module) — Cursor briefing

## What this repo is

This is the **staging repo for the GovIQ DocRoute module**. DocRoute is a
module inside the GovIQ platform (not a standalone app). It lives here
until Session 0 merges it into the GovIQ parent repo.

- `convex/docroute/` — the module code that gets merged into GovIQ's `convex/docroute/`
- `apps/web/` — Next.js 15 staging UI (Raycast-aesthetic dark theme)
- `scripts/sorting/` — Windows-local Python pipeline for HSE DNREF legacy sort (free + paid tiers)
- `reference/` — Python reference parser + HSE code-table CSVs
- `docs/` — product briefs (PRD, productisation, storage, commercial)
- `CLAUDE.md` — full engineering context (prefer this over these rules when they conflict)
- `MIGRATION.md` — how to merge into the GovIQ parent repo (includes Session 0 prompt)

## Hard rules (see CLAUDE.md §9 for the full list)

1. **Never** redefine GovIQ core tables (`sp_organisations`, `sp_users`,
   `gov_memberships`, `gov_auditEvents`). DocRoute tables are `dr_*` and
   reference GovIQ core by `v.id("sp_...")`.
2. **Never** bypass the inline GovIQ auth pattern. Every tenant-scoped
   Convex function: `ctx.auth.getUserIdentity()` → `sp_users` lookup →
   `gov_memberships` check.
3. **Never** change a scoring weight or credibility gate in
   `convex/docroute/neis/credibility.ts` without updating
   `reference/neis_parser.py` in the same PR. The fixtures in
   `tests/neis.test.ts` are the drift contract.
4. **Never** send free text to Claude and parse the response. Structured
   output via tool use only; schema derived from `convention.fields`.
5. **Never** commit `.env*`, node_modules, or customer data.

## Coding standards

### TypeScript
- `strict: true` + `noUncheckedIndexedAccess: true` (enforced by tsconfig).
- No `any` except at `v.any()` seams. Non-null assertions (`!`) OK when the
  index is provably in range (pattern: `arr[i % arr.length]!`).
- Named exports only (except Next pages).
- File naming: kebab-case for React components, camelCase for Convex
  functions, PascalCase for types.

### Convex
- Tenant-scoped functions use the inline auth pattern from
  `convex/docroute/conventions.ts`. Don't create a parallel `authz.ts`.
- Every state change the user might ask about later writes a
  `gov_auditEvents` row with `eventType = "docroute.<domain>.<action>"`.
- Use existing indexes; add new ones deliberately.
- Keep action handlers short — offload to internal mutations for DB work
  and internal actions for LLM calls.

### React (apps/web)
- Prefer composition of existing `components/ui/*` primitives. Don't fork.
- State that lives across components → Zustand store in `lib/<feature>-store.ts`.
- Framer Motion for micro-interactions only — don't animate where a CSS
  transition suffices.
- Shortcut handling via `hooks/use-keyboard-shortcut.ts`.
- **Live state over black-box spinners.** Every async operation should show
  staged progress, not a generic loading indicator. Pattern: explicit state
  machine + rolling event log + shimmer progress (see `lib/upload-store.ts`).

### Testing
- Changes to `convex/docroute/neis/{regex,parser,normalise,credibility}.ts`
  must keep `npm test` green. Parity fixtures in `tests/neis.test.ts`.
- Hand-write auth-bypass tests for any new tenant-scoped Convex function.

## Aesthetic (apps/web only)

Raycast-influenced: near-black base (`#0a0a0b`), layered surfaces, single
cool-blue accent (`#4f8cff`), Geist Sans body + Geist Mono for codes and
filenames, rounded 12px cards, rounded-pill badges, hairline 1px borders
(`rgba(255,255,255,0.06)`). Motion is subtle — cubic-bezier(0.16, 1, 0.3, 1)
for nav, spring for drag.

## When Cursor is about to do something architectural

If the change touches §2 of CLAUDE.md (locked decisions) — module vs
standalone, parser language strategy, storage adapter choice, convention
set, register format, AI extraction approach, module integration pattern —
**stop and ask first**. These were expensive to decide and are expensive
to reverse.
