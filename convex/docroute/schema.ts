/**
 * GovIQ DocRoute — schema fragment.
 *
 * DocRoute is a module inside the GovIQ platform, not a standalone app. This
 * file exports individual `defineTable(...)` expressions to be merged into
 * the root `convex/schema.ts` of the GovIQ repo — it does NOT call
 * `defineSchema(...)` itself.
 *
 * Merge pattern in GovIQ `convex/schema.ts`:
 *
 *     import * as dr from "./docroute/schema";
 *
 *     export default defineSchema({
 *       sp_organisations: ...,
 *       sp_users: ...,
 *       gov_memberships: ...,
 *       gov_auditEvents: ...,
 *       // ... existing GovIQ tables
 *       dr_conventions: dr.dr_conventions,
 *       dr_originatorRegistry: dr.dr_originatorRegistry,
 *       dr_folderTrees: dr.dr_folderTrees,
 *       dr_projects: dr.dr_projects,
 *       dr_projectMembers: dr.dr_projectMembers,
 *       dr_sites: dr.dr_sites,
 *       dr_buildings: dr.dr_buildings,
 *       dr_documents: dr.dr_documents,
 *       dr_reviewQueue: dr.dr_reviewQueue,
 *       dr_registerEntries: dr.dr_registerEntries,
 *       dr_synopsisSnapshots: dr.dr_synopsisSnapshots,
 *     });
 *
 * Tenancy, users, memberships, audit events, billing, and subscriptions all
 * live in GovIQ core (`sp_organisations`, `sp_users`, `gov_memberships`,
 * `gov_auditEvents`, plus whatever billing tables GovIQ already defines).
 * DocRoute does NOT redefine those — it references them by `v.id("sp_...")`.
 *
 * TODO(session-0): confirm the exact names of the GovIQ core tables and
 * adjust the `v.id(...)` references below if they don't match. The names
 * used here match the descriptions in the goviq-codebase-navigator skill.
 */

import { defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Enum-ish unions (DocRoute-local only — platform-wide enums like OrgPlan
// and OrgRole live in GovIQ core, not here)
// ---------------------------------------------------------------------------

export const DrProjectRole = v.union(
  v.literal("owner"),
  v.literal("controller"),
  v.literal("reviewer"),
  v.literal("viewer"),
);

export const DrDocumentStatus = v.union(
  v.literal("pending"),
  v.literal("parsing"),
  v.literal("extracting"),
  v.literal("scoring"),
  v.literal("review"),
  v.literal("filed"),
  v.literal("quarantine"),
  v.literal("rejected"),
);

export const DrCredibilityRoute = v.union(
  v.literal("publish"),
  v.literal("review"),
  v.literal("quarantine"),
);

export const DrLicenceStatus = v.union(
  v.literal("valid"),
  v.literal("unknown"),
  v.literal("student"),
  v.literal("watermarked_other"),
);

export const DrPatternMatched = v.union(
  v.literal("full"),
  v.literal("min"),
  v.literal("none"),
);

// ---------------------------------------------------------------------------
// Re-usable shapes
// ---------------------------------------------------------------------------

const FieldDef = v.object({
  key: v.string(),
  label: v.string(),
  required: v.boolean(),
  regex: v.optional(v.string()),
  codeTableKey: v.optional(v.string()),
  minLength: v.optional(v.number()),
  maxLength: v.optional(v.number()),
  description: v.optional(v.string()),
});

const CodeTableEntry = v.object({
  code: v.string(),
  description: v.string(),
  group: v.optional(v.string()),
});

const CodeTable = v.object({
  key: v.string(),
  label: v.string(),
  entries: v.array(CodeTableEntry),
});

const CredibilityBreakdownEntry = v.object({
  field: v.string(),
  weight: v.number(),
  confidence: v.number(),
  contribution: v.number(),
});

const CredibilityResult = v.object({
  score: v.number(),
  route: DrCredibilityRoute,
  licenceStatus: DrLicenceStatus,
  breakdown: v.array(CredibilityBreakdownEntry),
  licencePenalty: v.number(),
});

const ParseResult = v.object({
  patternMatched: DrPatternMatched,
  project: v.optional(v.string()),
  phase: v.optional(v.string()),
  element: v.optional(v.string()),
  zone: v.optional(v.string()),
  level: v.optional(v.string()),
  infoType: v.optional(v.string()),
  originator: v.optional(v.string()),
  role: v.optional(v.string()),
  number: v.optional(v.string()),
  title: v.optional(v.string()),
  extension: v.optional(v.string()),
  viewType: v.optional(v.string()),
});

const RoutingRule = v.object({
  priority: v.number(),
  when: v.object({
    field: v.string(),
    op: v.union(
      v.literal("eq"),
      v.literal("in"),
      v.literal("regex"),
      v.literal("startsWith"),
    ),
    value: v.union(v.string(), v.array(v.string())),
  }),
  targetPath: v.string(),
});

// ---------------------------------------------------------------------------
// dr_conventions — naming convention definitions
// ---------------------------------------------------------------------------

/**
 * A naming convention. Rows with `orgId = undefined` are global seeds (NEIS,
 * ISO 19650) visible to every tenant. Rows with `orgId` set are custom
 * conventions only visible to that tenant.
 */
export const dr_conventions = defineTable({
  orgId: v.optional(v.id("sp_organisations")),
  key: v.string(),
  name: v.string(),
  version: v.string(),
  description: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
  fullPattern: v.string(),
  minPattern: v.optional(v.string()),
  separator: v.string(),
  case: v.union(v.literal("upper"), v.literal("lower"), v.literal("preserve")),
  fields: v.array(FieldDef),
  codeTables: v.array(CodeTable),
  createdBy: v.optional(v.id("sp_users")),
  createdAt: v.number(),
})
  .index("by_org_key", ["orgId", "key"])
  .index("by_key", ["key"]);

// ---------------------------------------------------------------------------
// dr_originatorRegistry — organisation codes
// ---------------------------------------------------------------------------

export const dr_originatorRegistry = defineTable({
  orgId: v.optional(v.id("sp_organisations")),
  code: v.string(),
  organisationName: v.string(),
  type: v.optional(v.string()),
  status: v.union(
    v.literal("active"),
    v.literal("inactive"),
    v.literal("pending_verification"),
  ),
  notes: v.optional(v.string()),
  createdAt: v.number(),
})
  .index("by_org_code", ["orgId", "code"])
  .index("by_code", ["code"]);

// ---------------------------------------------------------------------------
// dr_folderTrees — taxonomy + routing rules
// ---------------------------------------------------------------------------

export const dr_folderTrees = defineTable({
  orgId: v.optional(v.id("sp_organisations")),
  key: v.string(),
  name: v.string(),
  version: v.string(),
  nodes: v.array(
    v.object({
      path: v.string(),
      description: v.optional(v.string()),
    }),
  ),
  routingRules: v.array(RoutingRule),
  fallbackPath: v.string(),
  createdAt: v.number(),
})
  .index("by_org_key", ["orgId", "key"])
  .index("by_key", ["key"]);

// ---------------------------------------------------------------------------
// dr_projects — filing unit
//
// Optionally references an `sp_procurements` row when the DocRoute project is
// the document side of an existing GovIQ procurement. Null when DocRoute is
// used standalone within a GovIQ tenant (e.g. pure record-keeping for an
// estate not tied to a capital project).
//
// TODO(session-0): confirm `sp_procurements` is the correct parent table
// (vs. e.g. `sp_projects`). Adjust the FK if GovIQ uses a different table
// for the project-level concept DocRoute should anchor to.
// ---------------------------------------------------------------------------

export const dr_projects = defineTable({
  orgId: v.id("sp_organisations"),
  procurementId: v.optional(v.id("sp_procurements")),
  name: v.string(),
  projectCode: v.string(),
  clientRef: v.optional(v.string()),
  conventionId: v.id("dr_conventions"),
  folderTreeId: v.id("dr_folderTrees"),
  status: v.union(
    v.literal("active"),
    v.literal("paused"),
    v.literal("archived"),
  ),
  createdBy: v.id("sp_users"),
  createdAt: v.number(),
})
  .index("by_org", ["orgId"])
  .index("by_org_code", ["orgId", "projectCode"])
  .index("by_procurement", ["procurementId"]);

// ---------------------------------------------------------------------------
// dr_projectMembers — per-project role overrides
// ---------------------------------------------------------------------------

export const dr_projectMembers = defineTable({
  projectId: v.id("dr_projects"),
  userId: v.id("sp_users"),
  role: DrProjectRole,
  addedAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_project_user", ["projectId", "userId"]);

// ---------------------------------------------------------------------------
// dr_sites / dr_buildings — portfolio dimension for estate-style projects
// ---------------------------------------------------------------------------

export const dr_sites = defineTable({
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  siteCode: v.string(),
  name: v.string(),
  shortName: v.optional(v.string()),
  address: v.optional(v.string()),
  town: v.optional(v.string()),
  county: v.optional(v.string()),
  eircode: v.optional(v.string()),
  operator: v.optional(v.string()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_project_site", ["projectId", "siteCode"]);

export const dr_buildings = defineTable({
  siteId: v.id("dr_sites"),
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  buildingId: v.string(),
  name: v.string(),
  type: v.optional(v.string()),
  yearBuilt: v.optional(v.number()),
  areaSqm: v.optional(v.number()),
  metadata: v.optional(v.any()),
  createdAt: v.number(),
})
  .index("by_site", ["siteId"])
  .index("by_project", ["projectId"])
  .index("by_project_building", ["projectId", "buildingId"]);

// ---------------------------------------------------------------------------
// dr_documents — core domain table
// ---------------------------------------------------------------------------

export const dr_documents = defineTable({
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  siteId: v.optional(v.id("dr_sites")),
  buildingId: v.optional(v.id("dr_buildings")),

  originalFilename: v.string(),
  sha256: v.string(),
  mimeType: v.string(),
  fileSize: v.number(),
  storageId: v.id("_storage"),

  uploadedBy: v.id("sp_users"),
  uploadedAt: v.number(),

  status: DrDocumentStatus,

  parsed: v.optional(ParseResult),
  extracted: v.optional(v.array(
    v.object({
      field: v.string(),
      value: v.union(v.string(), v.null()),
      confidence: v.number(),
      source: v.optional(v.string()),
    }),
  )),
  credibility: v.optional(CredibilityResult),

  finalFilename: v.optional(v.string()),
  filedPath: v.optional(v.string()),
  filedAt: v.optional(v.number()),

  reviewId: v.optional(v.id("dr_reviewQueue")),

  purposeCode: v.optional(v.string()),
  acceptanceCode: v.optional(v.string()),
  revision: v.optional(v.string()),
  revisionDescription: v.optional(v.string()),
})
  .index("by_project", ["projectId"])
  .index("by_project_status", ["projectId", "status"])
  .index("by_project_sha", ["projectId", "sha256"])
  .index("by_site", ["siteId"])
  .index("by_building", ["buildingId"]);

// ---------------------------------------------------------------------------
// dr_reviewQueue — human-confirm queue for review-tier documents
// ---------------------------------------------------------------------------

export const dr_reviewQueue = defineTable({
  documentId: v.id("dr_documents"),
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  openedAt: v.number(),

  missingFields: v.array(v.string()),
  lowConfidenceFields: v.array(
    v.object({
      field: v.string(),
      value: v.union(v.string(), v.null()),
      confidence: v.number(),
    }),
  ),
  suggestions: v.optional(v.any()),

  assignedTo: v.optional(v.id("sp_users")),
  status: v.union(
    v.literal("open"),
    v.literal("in_progress"),
    v.literal("resolved"),
    v.literal("escalated"),
  ),
  resolvedAt: v.optional(v.number()),
  resolvedBy: v.optional(v.id("sp_users")),
  resolution: v.optional(
    v.union(
      v.literal("approved"),
      v.literal("corrected"),
      v.literal("rejected"),
    ),
  ),
})
  .index("by_project", ["projectId"])
  .index("by_project_status", ["projectId", "status"])
  .index("by_assignee", ["assignedTo"]);

// ---------------------------------------------------------------------------
// dr_registerEntries — materialised register (source of truth: dr_documents)
// ---------------------------------------------------------------------------

export const dr_registerEntries = defineTable({
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  documentId: v.id("dr_documents"),
  siteId: v.optional(v.id("dr_sites")),
  buildingId: v.optional(v.id("dr_buildings")),

  project: v.optional(v.string()),
  phase: v.optional(v.string()),
  element: v.optional(v.string()),
  zone: v.optional(v.string()),
  level: v.optional(v.string()),
  infoType: v.optional(v.string()),
  originator: v.optional(v.string()),
  role: v.optional(v.string()),
  number: v.optional(v.string()),
  title: v.optional(v.string()),

  finalFilename: v.string(),
  filedPath: v.string(),
  purposeCode: v.optional(v.string()),
  acceptanceCode: v.optional(v.string()),
  revision: v.optional(v.string()),
  revisionDescription: v.optional(v.string()),
  dateIssued: v.optional(v.number()),
  credibilityScore: v.number(),
  uploadedAt: v.number(),
})
  .index("by_project", ["projectId"])
  .index("by_project_site", ["projectId", "siteId"])
  .index("by_document", ["documentId"]);

// ---------------------------------------------------------------------------
// dr_synopsisSnapshots — pre-rendered per-site synopsis workbook
// ---------------------------------------------------------------------------

export const dr_synopsisSnapshots = defineTable({
  projectId: v.id("dr_projects"),
  orgId: v.id("sp_organisations"),
  siteId: v.id("dr_sites"),
  generatedAt: v.number(),
  workbookStorageId: v.id("_storage"),
  fileCount: v.number(),
  compliance: v.optional(v.any()),
})
  .index("by_site", ["siteId"])
  .index("by_project", ["projectId"]);
