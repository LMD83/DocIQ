/**
 * DocRoute — convention + originator queries and mutations.
 *
 * Integrates with GovIQ core for auth and audit. Uses the GovIQ inline auth
 * pattern (no custom `lib/authz.ts`) — resolve identity, look up `sp_users`,
 * check `gov_memberships`, use role from that row. Audit events are written
 * to `gov_auditEvents` with `eventType = "docroute.<action>"`.
 *
 * TODO(session-0): the field/index names used below for `sp_users` and
 * `gov_memberships` are best guesses based on the goviq-codebase-navigator
 * skill description. Before first deploy, read the actual GovIQ schema and
 * replace the placeholder `by_authSubject` / `by_userId_orgId` / `authSubject`
 * references with the real names. Same for `gov_auditEvents` row shape.
 */

import { query, mutation } from "../_generated/server.js";
import type { QueryCtx, MutationCtx } from "../_generated/server.js";
import type { Id, Doc } from "../_generated/dataModel.js";
import { v, ConvexError } from "convex/values";

type Ctx = QueryCtx | MutationCtx;

/**
 * Role hierarchy for controller-or-higher gating within DocRoute.
 * Matches the GovIQ core membership role vocabulary.
 *
 * TODO(session-0): confirm these role names match `gov_memberships.role`.
 */
const ORG_ROLE_RANK = {
  viewer: 0,
  reviewer: 1,
  controller: 2,
  admin: 3,
  owner: 4,
} as const;

type OrgRoleName = keyof typeof ORG_ROLE_RANK;

interface AuthedCaller {
  user: Doc<"sp_users">;
  userId: Id<"sp_users">;
  orgId: Id<"sp_organisations">;
  role: OrgRoleName;
}

/**
 * Resolve the authenticated user from the Convex auth identity, then load
 * the matching `sp_users` row. Inline pattern — mirrors existing GovIQ code.
 *
 * TODO(session-0): replace `by_authSubject` / `authSubject` with the real
 * index and field names from GovIQ's auth.ts.
 */
async function requireUser(ctx: Ctx): Promise<Doc<"sp_users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ kind: "unauthenticated", message: "Not signed in" });
  }
  const user = await ctx.db
    .query("sp_users")
    .withIndex("by_authSubject", (q) => q.eq("authSubject", identity.subject))
    .first();
  if (!user) {
    throw new ConvexError({
      kind: "user_not_provisioned",
      message: "Authenticated identity has no sp_users record",
    });
  }
  return user;
}

/**
 * Assert the caller is a member of the given organisation (gov_memberships).
 *
 * TODO(session-0): confirm `gov_memberships` has a `by_userId_orgId`
 * composite index and a `role` field. Adjust if the real shape differs.
 */
async function requireOrgMember(
  ctx: Ctx,
  orgId: Id<"sp_organisations">,
): Promise<AuthedCaller> {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("gov_memberships")
    .withIndex("by_userId_orgId", (q) =>
      q.eq("userId", user._id).eq("orgId", orgId),
    )
    .first();
  if (!membership) {
    throw new ConvexError({
      kind: "forbidden",
      message: "Not a member of this organisation",
    });
  }
  return {
    user,
    userId: user._id,
    orgId,
    role: membership.role as OrgRoleName,
  };
}

async function requireOrgRole(
  ctx: Ctx,
  orgId: Id<"sp_organisations">,
  requiredRole: OrgRoleName,
): Promise<AuthedCaller> {
  const auth = await requireOrgMember(ctx, orgId);
  if (ORG_ROLE_RANK[auth.role] < ORG_ROLE_RANK[requiredRole]) {
    throw new ConvexError({
      kind: "forbidden",
      message: `Requires role '${requiredRole}'; caller has '${auth.role}'`,
      callerRole: auth.role,
      requiredRole,
    });
  }
  return auth;
}

/**
 * Append an audit event to `gov_auditEvents`. Event types are namespaced with
 * the `docroute.` prefix per GovIQ convention.
 *
 * TODO(session-0): confirm the exact row shape for `gov_auditEvents`. If
 * GovIQ uses `before` / `after` / `reason` / `actor` the way DocRoute
 * expects, great; otherwise map DocRoute's event payloads onto the real
 * shape here.
 */
async function writeAudit(
  ctx: MutationCtx,
  params: {
    orgId: Id<"sp_organisations">;
    userId: Id<"sp_users">;
    eventType: `docroute.${string}`;
    payload?: unknown;
  },
): Promise<void> {
  await ctx.db.insert("gov_auditEvents", {
    orgId: params.orgId,
    actor: { kind: "user", userId: params.userId },
    eventType: params.eventType,
    after: params.payload,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * List conventions available to an org: all globals + the org's own custom.
 */
export const listForOrg = query({
  args: { orgId: v.id("sp_organisations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgMember(ctx, orgId);

    const globals = await ctx.db
      .query("dr_conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", undefined))
      .collect();

    const custom = await ctx.db
      .query("dr_conventions")
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
  args: { conventionId: v.id("dr_conventions") },
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
 * Resolve a convention by key for a given org: org-scoped first, then global.
 * Used by upload flows to bind a project to its convention.
 */
export const getByKey = query({
  args: {
    orgId: v.id("sp_organisations"),
    key: v.string(),
  },
  handler: async (ctx, { orgId, key }) => {
    await requireOrgMember(ctx, orgId);

    const orgScoped = await ctx.db
      .query("dr_conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", orgId).eq("key", key))
      .first();
    if (orgScoped) return orgScoped;

    const global = await ctx.db
      .query("dr_conventions")
      .withIndex("by_org_key", (q) => q.eq("orgId", undefined).eq("key", key))
      .first();
    return global;
  },
});

/**
 * List the org's originator registry + global originators.
 */
export const listOriginators = query({
  args: { orgId: v.id("sp_organisations") },
  handler: async (ctx, { orgId }) => {
    await requireOrgMember(ctx, orgId);

    const globals = await ctx.db
      .query("dr_originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", undefined))
      .collect();

    const orgScoped = await ctx.db
      .query("dr_originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", orgId))
      .collect();

    return {
      global: globals.sort((a, b) => a.code.localeCompare(b.code)),
      custom: orgScoped.sort((a, b) => a.code.localeCompare(b.code)),
    };
  },
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a custom convention for an org. Admin-only.
 */
export const createCustom = mutation({
  args: {
    orgId: v.id("sp_organisations"),
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

    const existing = await ctx.db
      .query("dr_conventions")
      .withIndex("by_org_key", (q) =>
        q.eq("orgId", args.orgId).eq("key", args.key),
      )
      .first();
    if (existing) {
      throw new ConvexError({
        kind: "conflict",
        message: `Convention with key '${args.key}' already exists in this organisation`,
      });
    }

    const id = await ctx.db.insert("dr_conventions", {
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

    await writeAudit(ctx, {
      orgId: args.orgId,
      userId: auth.userId,
      eventType: "docroute.convention.created",
      payload: { key: args.key, name: args.name, version: args.version },
    });

    return id;
  },
});

/**
 * Register a new originator code for an org. Controller+ — document
 * controllers hit this need when a new consultant delivers their first file.
 */
export const registerOriginator = mutation({
  args: {
    orgId: v.id("sp_organisations"),
    code: v.string(),
    organisationName: v.string(),
    type: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const auth = await requireOrgRole(ctx, args.orgId, "controller");

    const code = args.code.toUpperCase();
    if (!/^[A-Z0-9]{2,5}$/.test(code)) {
      throw new ConvexError({
        kind: "invalid",
        message: "Originator code must be 2–5 uppercase letters/digits",
      });
    }

    const existing = await ctx.db
      .query("dr_originatorRegistry")
      .withIndex("by_org_code", (q) => q.eq("orgId", args.orgId).eq("code", code))
      .first();
    if (existing) {
      throw new ConvexError({
        kind: "conflict",
        message: `Originator '${code}' already registered for this organisation`,
      });
    }

    const id = await ctx.db.insert("dr_originatorRegistry", {
      orgId: args.orgId,
      code,
      organisationName: args.organisationName,
      type: args.type,
      status: "pending_verification" as const,
      notes: args.notes,
      createdAt: Date.now(),
    });

    await writeAudit(ctx, {
      orgId: args.orgId,
      userId: auth.userId,
      eventType: "docroute.originator.registered",
      payload: { code, organisationName: args.organisationName },
    });

    return id;
  },
});
