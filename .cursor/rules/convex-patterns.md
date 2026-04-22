---
description: Patterns for Convex module work under convex/docroute/
globs:
  - convex/docroute/**
---

# convex/docroute patterns

## This code runs INSIDE the GovIQ convex/ tree after merge

Every file here is destined to live at `<goviq-root>/convex/docroute/<same path>`.
Imports of `_generated` must resolve from there, so they go up two levels:

```ts
import { internalMutation } from "../../_generated/server";
import { internal } from "../../_generated/api";
import type { Id } from "../../_generated/dataModel";
```

In this staging repo there is no `_generated/` — `convex dev` runs against
the shared GovIQ deployment at merge time and generates it there. Expect
TypeScript to flag missing `_generated` imports here; that's normal.

## Schema export shape

`convex/docroute/schema.ts` exports individual `defineTable(...)`
expressions, NOT `defineSchema(...)`. Merged in at the GovIQ root:

```ts
import * as dr from "./docroute/schema";
export default defineSchema({
  // ... existing sp_*, gov_*, etc.
  dr_conventions: dr.dr_conventions,
  // ...
});
```

Never add a default export or a `defineSchema` call here.

## Auth (do not introduce a parallel helper)

Every tenant-scoped query/mutation follows the inline pattern from
`conventions.ts`:

```ts
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new ConvexError({ kind: "unauthenticated" });

const user = await ctx.db
  .query("sp_users")
  .withIndex("by_authSubject", (q) => q.eq("authSubject", identity.subject))
  .first();
if (!user) throw new ConvexError({ kind: "user_not_provisioned" });

const membership = await ctx.db
  .query("gov_memberships")
  .withIndex("by_userId_orgId", (q) =>
    q.eq("userId", user._id).eq("orgId", orgId))
  .first();
if (!membership) throw new ConvexError({ kind: "forbidden" });
```

`TODO(session-0)` comments flag where the exact index / field names still
need to be confirmed against GovIQ's real schema. The names used are the
best guess from the goviq-codebase-navigator skill.

## Audit events

Every state change that the user might ask about later ("who uploaded
this?", "why is that in quarantine?") writes to `gov_auditEvents`:

```ts
await ctx.db.insert("gov_auditEvents", {
  orgId,
  actor: { kind: "user", userId: user._id },
  eventType: "docroute.<domain>.<action>",  // e.g. docroute.document.filed
  after: { ...relevant payload },
  timestamp: Date.now(),
});
```

Event type namespace is always `docroute.*`.

## Indexes

Use existing `dr_*` indexes defined in `schema.ts`. When you need a new
one, add it in `schema.ts` alongside the table definition, not in a
side file. Every new index costs write latency; be deliberate.

## Action handlers

Keep short. Offload DB writes to internal mutations, LLM calls to
internal actions. Pattern:

```ts
export const uploadDocument = action({
  args: {...},
  handler: async (ctx, args) => {
    const doc = await ctx.runMutation(internal.docroute.documents.create, {...});
    await ctx.runAction(internal.docroute.extraction.run, { docId: doc._id });
    return doc;
  },
});
```

## Extraction prompts

Prompts are first-class artefacts, NOT strings inside handlers:

```
convex/docroute/extraction/
├── prompts/
│   ├── drawing.ts        # one file per doc type
│   ├── certificate.ts
│   ├── report.ts
│   └── index.ts          # exports registry keyed by infoType
└── run.ts                # the action that calls Claude
```

Claude calls must use structured output via tool_use. Schema derives
from `convention.fields`. Never free-text-parse a Claude response.
