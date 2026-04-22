/**
 * Authorisation helpers.
 *
 * Every tenant-scoped query or mutation MUST call `requireOrgMember` or
 * `requireOrgRole` before reading or writing. The pattern is:
 *
 *     export const myQuery = query({
 *       args: { orgId: v.id("organizations") },
 *       handler: async (ctx, { orgId }) => {
 *         const { userId, role } = await requireOrgMember(ctx, orgId);
 *         // ... now safe to query tenant data
 *       },
 *     });
 *
 * These helpers throw `ConvexError` with structured data so the client can
 * distinguish auth failures from other errors.
 */

import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server.js";
import type { Id, Doc } from "../_generated/dataModel.js";

type Ctx = QueryCtx | MutationCtx;

/**
 * Role hierarchy. Higher roles inherit permissions of lower roles.
 * Order matters.
 */
const ORG_ROLE_RANK = {
  viewer: 0,
  reviewer: 1,
  controller: 2,
  admin: 3,
  owner: 4,
} as const;

type OrgRoleName = keyof typeof ORG_ROLE_RANK;

export interface AuthedCaller {
  user: Doc<"users">;
  userId: Id<"users">;
  orgId: Id<"organizations">;
  role: OrgRoleName;
}

/**
 * Resolve the authenticated user from Convex auth identity.
 * Throws if unauthenticated or if the user record hasn't been created yet.
 */
async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError({ kind: "unauthenticated", message: "Not signed in" });
  }
  const user = await ctx.db
    .query("users")
    .withIndex("by_auth_subject", (q) => q.eq("authSubject", identity.subject))
    .first();
  if (!user) {
    throw new ConvexError({
      kind: "user_not_provisioned",
      message: "Authenticated identity has no user record",
    });
  }
  return user;
}

/**
 * Assert the caller is a member of the given organisation. Returns the
 * caller's role within that org so the handler can further gate actions.
 */
export async function requireOrgMember(
  ctx: Ctx,
  orgId: Id<"organizations">,
): Promise<AuthedCaller> {
  const user = await requireUser(ctx);
  const membership = await ctx.db
    .query("orgMemberships")
    .withIndex("by_org_user", (q) => q.eq("orgId", orgId).eq("userId", user._id))
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

/**
 * Assert the caller has at least the required role within the organisation.
 * Convenience wrapper over `requireOrgMember`.
 */
export async function requireOrgRole(
  ctx: Ctx,
  orgId: Id<"organizations">,
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
 * Helper for project-scoped handlers. Looks up the project, asserts the
 * caller is a member of the owning org, optionally applies a project-level
 * role override.
 */
export async function requireProjectAccess(
  ctx: Ctx,
  projectId: Id<"projects">,
  requiredOrgRole: OrgRoleName = "viewer",
): Promise<AuthedCaller & { project: Doc<"projects"> }> {
  const project = await ctx.db.get(projectId);
  if (!project) {
    throw new ConvexError({ kind: "not_found", message: "Project not found" });
  }
  const auth = await requireOrgRole(ctx, project.orgId, requiredOrgRole);
  return { ...auth, project };
}
