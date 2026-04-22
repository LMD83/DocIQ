/**
 * Seed action — global originator registry entries.
 *
 * Seeds the default set of Irish AEC organisations (HSE, OPW, Tusla, HIQA,
 * OGP). Per-customer originators are added through the application UI and
 * stored with an `orgId`; these global seeds are visible to every tenant.
 *
 * Idempotent — keyed by (orgId=null, code). Call from CLI:
 *
 *     npm run seed:originators
 */

import { internalAction, internalMutation } from "../_generated/server.js";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { ORIGINATOR_SEEDS } from "./seedData.js";

export const upsertGlobalOriginator = internalMutation({
  args: {
    code: v.string(),
    organisationName: v.string(),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, { code, organisationName, type, notes }) => {
    const existing = await ctx.db
      .query("originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", undefined).eq("code", code))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        organisationName,
        type,
        notes,
        status: existing.status, // preserve status on re-seed
      });
      return { id: existing._id, action: "updated" as const };
    }

    const id = await ctx.db.insert("originatorRegistry", {
      orgId: undefined,
      code,
      organisationName,
      type,
      status: "active" as const,
      notes,
      createdAt: now,
    });
    return { id, action: "created" as const };
  },
});

export const seedGlobal = internalAction({
  args: {},
  handler: async (ctx): Promise<{ seeded: number; updated: number }> => {
    let seeded = 0;
    let updated = 0;

    for (const entry of ORIGINATOR_SEEDS) {
      const result = await ctx.runMutation(internal.seed.seedOriginators.upsertGlobalOriginator, {
        code: entry.code,
        organisationName: entry.organisationName,
        type: entry.type,
        notes: entry.notes,
      });
      if (result.action === "created") seeded++;
      else updated++;
    }

    console.log(`Originator registry: ${seeded} created, ${updated} updated`);
    return { seeded, updated };
  },
});
