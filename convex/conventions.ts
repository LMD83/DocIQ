/**
 * Convention queries and mutations.
 *
 * Global conventions (NEIS, ISO 19650) are visible to every tenant and
 * maintained via the seed action. Custom conventions are org-scoped and
 * created by org admins for non-standard project filing rules.
 */

import { query, mutation } from "./_generated/server.js";
import { v, ConvexError } from "convex/values";
import { requireOrgRole, requireOrgMember } from "./lib/authz.js";

/**
 * List conventions available to an org: all globals + the org's own custom.
 * Ordered: globals first (by name), then custom (by createdAt desc).
 */
export const listForOrg = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgMember(ctx, orgId);

    const globals = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", undefined))
      .collect();

    const custom = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId))
      .collect();

    return {
      global: globals.sort((a, b) => a.name.localeCompare(b.name)),
      custom: custom.sort((a, b) => b.createdAt - a.createdAt),
    };
  },
});

/**
 * Get a single convention by id. Caller must be a member of the convention's
 * org, unless the convention is global.
 */
export const getById = query({
  args: { conventionId: v.id("conventions") },
  handler: async (ctx, { conventionId }) => {
    const convention = await ctx.db.get(conventionId);
    if (!convention) return null;
    if (convention.orgId) {
      await requireOrgMember(ctx, convention.orgId);
    }
    return convention;
  },
});

/**
 * Resolve a convention by key for a given org: org-scoped match first, then
 * global. Used by the upload form to bind a project to its convention.
 */
export const getByKey = query({
  args: {
    orgId: v.id("organizations"),
    key: v.string(),
  },
  handler: async (ctx, { orgId, key }) => {
    await requireOrgMember(ctx, orgId);

    const orgScoped = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    if (orgScoped) return orgScoped;

    const global = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", undefined).eq("key", key))
      .first();
    return global;
  },
});

/**
 * Create a custom convention for an org. Admin-only.
 * Schema enforces field shape at insert time.
 */
export const createCustom = mutation({
  args: {
    orgId: v.id("organizations"),
    key: v.string(),
    name: v.string(),
    version: v.string(),
    description: v.optional(v.string()),
    sourceUrl: v.optional(v.string()),
    fullPattern: v.string(),
    minPattern: v.optional(v.string()),
    separator: v.string(),
    case: v.union(v.literal("upper"), v.literal("lower"), v.literal("preserve")),
    fields: v.array(v.any()),
    codeTables: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const auth = await requireOrgRole(ctx, args.orgId, "admin");

    // Enforce key uniqueness within the org
    const existing = await ctx.db
      .query("conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", args.orgId).eq("key", args.key))
      .first();
    if (existing) {
      throw new ConvexError({
        kind: "conflict",
        message: `Convention with key '${args.key}' already exists in this organisation`,
      });
    }

    const id = await ctx.db.insert("conventions", {
      orgId: args.orgId,
      key: args.key,
      name: args.name,
      version: args.version,
      description: args.description,
      sourceUrl: args.sourceUrl,
      fullPattern: args.fullPattern,
      minPattern: args.minPattern,
      separator: args.separator,
      case: args.case,
      fields: args.fields,
      codeTables: args.codeTables,
      createdBy: auth.userId,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      orgId: args.orgId,
      actor: { kind: "user", userId: auth.userId },
      action: "convention.created",
      after: { key: args.key, name: args.name, version: args.version },
      timestamp: Date.now(),
    });

    return id;
  },
});

/**
 * List the org's originator registry + global originators.
 */
export const listOriginators = query({
  args: { orgId: v.id("organizations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgMember(ctx, orgId);

    const globals = await ctx.db
      .query("originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", undefined))
      .collect();

    const orgScoped = await ctx.db
      .query("originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", orgId))
      .collect();

    return {
      global: globals.sort((a, b) => a.code.localeCompare(b.code)),
      custom: orgScoped.sort((a, b) => a.code.localeCompare(b.code)),
    };
  },
});

/**
 * Register a new originator code for an org. Controller+ can do this (they
 * hit this need when a new consultant delivers their first file).
 */
export const registerOriginator = mutation({
  args: {
    orgId: v.id("organizations"),
    code: v.string(),
    organisationName: v.string(),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireOrgRole(ctx, args.orgId, "controller");

    // Enforce uppercase and length bounds (consistent with NEIS originator field)
    const code = args.code.toUpperCase();
    if (!/^[A-Z0-9]{2,5}$/.test(code)) {
      throw new ConvexError({
        kind: "invalid",
        message: "Originator code must be 2–5 uppercase letters/digits",
      });
    }

    const existing = await ctx.db
      .query("originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", code))
      .first();
    if (existing) {
      throw new ConvexError({
        kind: "conflict",
        message: `Originator '${code}' already registered for this organisation`,
      });
    }

    const id = await ctx.db.insert("originatorRegistry", {
      orgId: args.orgId,
      code,
      organisationName: args.organisationName,
      type: args.type,
      status: "pending_verification" as const, // admin promotes to active after check
      notes: args.notes,
      createdAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      orgId: args.orgId,
      actor: { kind: "user", userId: auth.userId },
      action: "originator.registered",
      after: { code, organisationName: args.organisationName },
      timestamp: Date.now(),
    });

    return id;
  },
});
