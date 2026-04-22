/**
 * Seed action — NEIS + ISO 19650 conventions.
 *
 * Idempotent: running twice won't duplicate. Keyed by (orgId=null, key) so
 * repeat runs upsert if the version changed. Call from CLI:
 *
 *     npm run seed:conventions
 *
 * For the first non-HSE customer, the ISO 19650 convention's code tables
 * must be populated before this seed is re-run.
 */

import { internalAction, internalMutation } from "../_generated/server.js";
import { v } from "convex/values";
import { internal } from "../_generated/api.js";
import { NEIS_CONVENTION, ISO_19650_CONVENTION } from "./seedData.js";

/**
 * Internal mutation that upserts a convention by (orgId=null, key).
 * Extracted so the action can call it transactionally per convention.
 */
export const upsertGlobalConvention = internalMutation({
  args: {
    convention: v.any(), // validated at schema level on insert/patch
  },
  handler: async (ctx, { convention }) => {
    // Look up existing global convention by key
    const existing = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) =>
        q.eq("orgId", undefined).eq("key", convention.key),
      )
      .first();

    const now = Date.now();

    if (existing) {
      // Upsert: overwrite version and fields (schema is data, not history)
      await ctx.db.patch(existing._id, {
        name: convention.name,
        version: convention.version,
        description: convention.description,
        sourceUrl: convention.sourceUrl,
        fullPattern: convention.fullPattern,
        minPattern: convention.minPattern,
        separator: convention.separator,
        case: convention.case,
        fields: convention.fields,
        codeTables: convention.codeTables,
      });
      return { id: existing._id, action: "updated" as const };
    }

    const id = await ctx.db.insert("conventions", {
      orgId: undefined,
      key: convention.key,
      name: convention.name,
      version: convention.version,
      description: convention.description,
      sourceUrl: convention.sourceUrl,
      fullPattern: convention.fullPattern,
      minPattern: convention.minPattern,
      separator: convention.separator,
      case: convention.case,
      fields: convention.fields,
      codeTables: convention.codeTables,
      createdBy: undefined,
      createdAt: now,
    });
    return { id, action: "created" as const };
  },
});

/**
 * Public seed entry point. Seeds both global conventions.
 */
export const seedAll = internalAction({
  args: {},
  handler: async (ctx): Promise<{
    neis: { id: string; action: "created" | "updated" };
    iso19650: { id: string; action: "created" | "updated" };
  }> => {
    const neis = await ctx.runMutation(internal.seed.seedConventions.upsertGlobalConvention, {
      convention: NEIS_CONVENTION,
    });
    const iso19650 = await ctx.runMutation(internal.seed.seedConventions.upsertGlobalConvention, {
      convention: ISO_19650_CONVENTION,
    });

    console.log(`Seeded NEIS: ${neis.action} (${neis.id})`);
    console.log(`Seeded ISO 19650: ${iso19650.action} (${iso19650.id})`);

    return { neis, iso19650 };
  },
});
