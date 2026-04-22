/**
 * DocRoute seed action — NEIS + ISO 19650 conventions.
 *
 * Idempotent: running twice won't duplicate. Keyed by (orgId=undefined, key)
 * so repeat runs upsert if the version changed. Call from the GovIQ repo CLI:
 *
 *     npx convex run docroute/seed/seedConventions:seedAll
 *
 * (Or via an npm script registered in the GovIQ root `package.json`.)
 *
 * For the first non-HSE customer, the ISO 19650 convention's code tables
 * must be populated before this seed is re-run.
 */

import { internalAction, internalMutation } from "../../_generated/server.js";
import { v } from "convex/values";
import { internal } from "../../_generated/api.js";
import { NEIS_CONVENTION, ISO_19650_CONVENTION } from "./seedData.js";

/**
 * Internal mutation that upserts a convention by (orgId=undefined, key).
 */
export const upsertGlobalConvention = internalMutation({
  args: {
    convention: v.any(),
  },
  handler: async (ctx, { convention }) => {
    const existing = await ctx.db
      .query("dr_conventions")
      .withIndex("by_org_key", (q) =>
        q.eq("orgId", undefined).eq("key", convention.key),
      )
      .first();

    const now = Date.now();

    if (existing) {
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

    const id = await ctx.db.insert("dr_conventions", {
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
    const neis = await ctx.runMutation(
      internal.docroute.seed.seedConventions.upsertGlobalConvention,
      { convention: NEIS_CONVENTION },
    );
    const iso19650 = await ctx.runMutation(
      internal.docroute.seed.seedConventions.upsertGlobalConvention,
      { convention: ISO_19650_CONVENTION },
    );

    console.log(`Seeded NEIS: ${neis.action} (${neis.id})`);
    console.log(`Seeded ISO 19650: ${iso19650.action} (${iso19650.id})`);

    return { neis, iso19650 };
  },
});
