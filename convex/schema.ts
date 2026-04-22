/**
 * GovIQ DocRoute — Convex schema
 *
 * Multi-tenant. Every tenant-scoped table carries `orgId`. Queries and
 * mutations MUST filter by `orgId` derived from the authenticated caller —
 * never from client input. See `convex/lib/authz.ts` for the helper.
 *
 * Convention tables (`conventions`, `folderTrees`) can be global (orgId
 * undefined) or org-scoped. Global rows are the seeded NEIS and ISO 19650
 * defaults; org-scoped rows are customer-specific customisations.
 *
 * Rows mirror §6 of the productisation brief. MVP only writes to a subset;
 * the rest are defined here so later phases don't require destructive
 * migrations.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// ---------------------------------------------------------------------------
// Enum-ish unions (kept as string literals; Convex v.union validates at write)
// ---------------------------------------------------------------------------

export const OrgPlan = v.union(
  v.literal("trial"),
  v.literal("starter"),
  v.literal("project"),
  v.literal("programme"),
  v.literal("estate"),
);

export const OrgRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("controller"),
  v.literal("reviewer"),
  v.literal("viewer"),
);

export const ProjectRole = v.union(
  v.literal("owner"),
  v.literal("controller"),
  v.literal("reviewer"),
  v.literal("viewer"),
);

export const DocumentStatus = v.union(
  v.literal("pending"),
  v.literal("parsing"),
  v.literal("extracting"),
  v.literal("scoring"),
  v.literal("review"),
  v.literal("filed"),
  v.literal("quarantine"),
  v.literal("rejected"),
);

export const CredibilityRoute = v.union(
  v.literal("publish"),
  v.literal("review"),
  v.literal("quarantine"),
);

export const LicenceStatus = v.union(
  v.literal("valid"),
  v.literal("unknown"),
  v.literal("student"),
  v.literal("watermarked_other"),
);

export const PatternMatched = v.union(
  v.literal("full"),
  v.literal("min"),
  v.literal("none"),
);

// ---------------------------------------------------------------------------
// Re-usable shapes
// ---------------------------------------------------------------------------

/**
 * A field definition within a naming convention. One object per field in the
 * convention pattern. `codeTableKey` references a key in the convention's
 * `codeTables` array; `regex` provides a validation pattern if no code table
 * applies (e.g. numeric sequences, free text).
 */
const FieldDef = v.object({
  key: v.string(),               // "project", "phase", "element", ...
  label: v.string(),             // Human-readable field label
  required: v.boolean(),         // Is the field mandatory in full form?
  regex: v.optional(v.string()), // Validation regex for freeform fields
  codeTableKey: v.optional(v.string()), // Key into convention.codeTables
  minLength: v.optional(v.number()),
  maxLength: v.optional(v.number()),
  description: v.optional(v.string()),
});

/**
 * A single row in a code table. `group` is optional because not every code
 * table uses it (e.g. AcceptanceCodes has no group).
 */
const CodeTableEntry = v.object({
  code: v.string(),
  description: v.string(),
  group: v.optional(v.string()),
});

/**
 * A named code table within a convention. `key` matches `FieldDef.codeTableKey`.
 */
const CodeTable = v.object({
  key: v.string(),
  label: v.string(),
  entries: v.array(CodeTableEntry),
});

/**
 * Per-field extraction result. `source` records where the value came from
 * (filename-regex, pdf-title-block, llm-extracted, register-cross-ref).
 */
const FieldResult = v.object({
  value: v.union(v.string(), v.null()),
  confidence: v.number(), // 0.0 - 1.0
  source: v.optional(v.string()),
});

/**
 * Credibility scoring output. Mirrors Python `record_credibility` return
 * plus the routing decision and an auditable breakdown.
 */
const CredibilityResult = v.object({
  score: v.number(),             // 0.0 - 1.0
  route: CredibilityRoute,
  licenceStatus: LicenceStatus,
  breakdown: v.array(
    v.object({
      field: v.string(),
      weight: v.number(),
      confidence: v.number(),
      contribution: v.number(), // weight * confidence
    }),
  ),
  licencePenalty: v.number(),
});

/**
 * Parse result from the NEIS regex parser. Fields match the named captures
 * in `convex/neis/regex.ts`. Any field may be null if the pattern was `min`
 * (only partial fields) or `none` (no match).
 */
const ParseResult = v.object({
  patternMatched: PatternMatched,
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

/**
 * Folder tree routing rule. `when` is a simple predicate on a parsed/extracted
 * field. First matching rule (by priority ascending) wins; fallback path is
 * defined at the folderTree level.
 */
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
// Schema
// ---------------------------------------------------------------------------

export default defineSchema({
  // -------------------------------------------------------------------------
  // Tenancy
  // -------------------------------------------------------------------------

  /**
   * A customer organisation. Top-level tenant. Each org has its own projects,
   * users, conventions, folder trees, billing state.
   */
  organizations: defineTable({
    name: v.string(),
    plan: OrgPlan,
    dataRegion: v.union(v.literal("eu"), v.literal("ie")), // EU-only for public sector
    stripeCustomerId: v.optional(v.string()),
    createdBy: v.string(), // userId as string — avoid circular id dependency
    createdAt: v.number(),
  }).index("by_stripe_customer", ["stripeCustomerId"]),

  /**
   * Authenticated users. Minimal shape here; identity detail lives in the
   * auth provider (Convex Auth, Clerk, or SSO). Email is duplicated here only
   * for display and search.
   */
  users: defineTable({
    authSubject: v.string(), // stable subject from auth provider
    email: v.string(),
    displayName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_email", ["email"]),

  /**
   * User ↔ organisation membership with role. Presence in this table grants
   * access to the org; absence denies. `role` gates mutations.
   */
  orgMemberships: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: OrgRole,
    invitedBy: v.optional(v.id("users")),
    joinedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_user", ["userId"])
    .index("by_org_user", ["orgId", "userId"]),

  // -------------------------------------------------------------------------
  // Convention configuration
  // -------------------------------------------------------------------------

  /**
   * A naming convention. Rows with `orgId = undefined` are global seeds
   * (NEIS, ISO 19650) visible to every tenant. Rows with `orgId` set are
   * custom conventions only visible to that tenant.
   *
   * `fullPattern` / `minPattern` are human-readable strings (e.g.
   * "{project}-{phase}-{element}-...") used for display and rename rendering.
   * The actual parsing regex lives in code (`convex/neis/regex.ts`) for the
   * seeded conventions; custom conventions supply their own regex per field.
   */
  conventions: defineTable({
    orgId: v.optional(v.id("organizations")),
    key: v.string(),       // e.g. "NEIS" — unique per (orgId, key, version)
    name: v.string(),      // Human label
    version: v.string(),   // e.g. "Rev 11"
    description: v.optional(v.string()),
    sourceUrl: v.optional(v.string()), // Link to convention spec
    fullPattern: v.string(),
    minPattern: v.optional(v.string()),
    separator: v.string(), // Typically "-"
    case: v.union(v.literal("upper"), v.literal("lower"), v.literal("preserve")),
    fields: v.array(FieldDef),
    codeTables: v.array(CodeTable),
    createdBy: v.optional(v.id("users")), // null for seeded rows
    createdAt: v.number(),
  })
    .index("by_org_key", ["orgId", "key"])
    .index("by_key", ["key"]), // global lookup for seeded conventions

  /**
   * Originator registry. Codes for organisations producing documents. Global
   * seeded entries (HSE, OPW, etc.) + per-org customer additions.
   */
  originatorRegistry: defineTable({
    orgId: v.optional(v.id("organizations")), // null = global
    code: v.string(),             // 2–5 uppercase
    organisationName: v.string(),
    type: v.optional(v.string()), // Client / Consultant / Contractor / Certifier / Authority
    status: v.union(
      v.literal("active"),
      v.literal("inactive"),
      v.literal("pending_verification"),
    ),
    notes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_org_code", ["orgId", "code"])
    .index("by_code", ["code"]),

  /**
   * Folder taxonomy with routing rules. Global seeded (HSE canonical from
   * Estate Spine PRD) + per-org customisations.
   */
  folderTrees: defineTable({
    orgId: v.optional(v.id("organizations")),
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
    fallbackPath: v.string(), // Where unrouted docs land (e.g. "/_unrouted/")
    createdAt: v.number(),
  })
    .index("by_org_key", ["orgId", "key"])
    .index("by_key", ["key"]),

  // -------------------------------------------------------------------------
  // Projects
  // -------------------------------------------------------------------------

  /**
   * A project is the unit of filing. One project = one convention + one
   * folder tree + one document stream + one register.
   */
  projects: defineTable({
    orgId: v.id("organizations"),
    name: v.string(),
    projectCode: v.string(), // Maps to convention "project" field value
    clientRef: v.optional(v.string()),
    conventionId: v.id("conventions"),
    folderTreeId: v.id("folderTrees"),
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("archived"),
    ),
    createdBy: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_org_code", ["orgId", "projectCode"]),

  /**
   * Per-project role overrides. If absent, the user's orgMembership role is
   * used.
   */
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: ProjectRole,
    addedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_user", ["projectId", "userId"]),

  // -------------------------------------------------------------------------
  // Portfolio dimension (HSE-style estates — optional per project)
  // -------------------------------------------------------------------------

  /**
   * A site within a project portfolio. Maps to DN-code in HSE, but the code
   * format is per-convention (site_code validator lives on the convention).
   */
  sites: defineTable({
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    siteCode: v.string(),     // e.g. "DN0574"
    name: v.string(),
    shortName: v.optional(v.string()),
    address: v.optional(v.string()),
    town: v.optional(v.string()),
    county: v.optional(v.string()),
    eircode: v.optional(v.string()),
    operator: v.optional(v.string()),
    metadata: v.optional(v.any()), // arbitrary per-site fields
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_site", ["projectId", "siteCode"]),

  /**
   * A building within a site. Multi-building sites use building_id = DN + B##.
   */
  buildings: defineTable({
    siteId: v.id("sites"),
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    buildingId: v.string(),  // e.g. "DN0574 B01"
    name: v.string(),
    type: v.optional(v.string()),
    yearBuilt: v.optional(v.number()),
    areaSqm: v.optional(v.number()),
    metadata: v.optional(v.any()),
    createdAt: v.number(),
  })
    .index("by_site", ["siteId"])
    .index("by_project", ["projectId"])
    .index("by_project_building", ["projectId", "buildingId"]),

  // -------------------------------------------------------------------------
  // Documents — the main event
  // -------------------------------------------------------------------------

  /**
   * Every uploaded file is a document. Progresses through states:
   * pending → parsing → extracting → scoring → (filed | review | quarantine)
   *
   * `sha256` is the deduplication key per project. `storageId` is the Convex
   * file storage reference for the original bytes. `finalFilename` /
   * `filedPath` are populated on successful route.
   */
  documents: defineTable({
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    siteId: v.optional(v.id("sites")),
    buildingId: v.optional(v.id("buildings")),

    originalFilename: v.string(),
    sha256: v.string(),
    mimeType: v.string(),
    fileSize: v.number(),
    storageId: v.id("_storage"),

    uploadedBy: v.id("users"),
    uploadedAt: v.number(),

    status: DocumentStatus,

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

    reviewId: v.optional(v.id("reviewQueue")),

    // Captured at extraction time; drives the register + synopsis outputs
    purposeCode: v.optional(v.string()),    // P00 - P10
    acceptanceCode: v.optional(v.string()), // S / A / B / C / D
    revision: v.optional(v.string()),
    revisionDescription: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_project_status", ["projectId", "status"])
    .index("by_project_sha", ["projectId", "sha256"])
    .index("by_site", ["siteId"])
    .index("by_building", ["buildingId"]),

  /**
   * Review queue row. One per document that failed auto-publish but scored
   * above quarantine threshold. Document controllers resolve these in a
   * card-based UI.
   */
  reviewQueue: defineTable({
    documentId: v.id("documents"),
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    openedAt: v.number(),

    missingFields: v.array(v.string()),
    lowConfidenceFields: v.array(
      v.object({
        field: v.string(),
        value: v.union(v.string(), v.null()),
        confidence: v.number(),
      }),
    ),
    suggestions: v.optional(v.any()), // Record<field, string[]>

    assignedTo: v.optional(v.id("users")),
    status: v.union(
      v.literal("open"),
      v.literal("in_progress"),
      v.literal("resolved"),
      v.literal("escalated"),
    ),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.id("users")),
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
    .index("by_assignee", ["assignedTo"]),

  // -------------------------------------------------------------------------
  // Outputs (materialised — source of truth is `documents`)
  // -------------------------------------------------------------------------

  /**
   * One row per filed document, flattened for register views and XLSX export.
   * Rebuilt incrementally on document state transitions.
   */
  registerEntries: defineTable({
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    documentId: v.id("documents"),
    siteId: v.optional(v.id("sites")),
    buildingId: v.optional(v.id("buildings")),

    // NEIS fields (denormalised for fast query)
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

    // Register columns
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
    .index("by_document", ["documentId"]),

  /**
   * Pre-rendered per-site synopsis workbook. Regenerated when any document
   * tied to the site changes status.
   */
  synopsisSnapshots: defineTable({
    projectId: v.id("projects"),
    orgId: v.id("organizations"),
    siteId: v.id("sites"),
    generatedAt: v.number(),
    workbookStorageId: v.id("_storage"),
    fileCount: v.number(),
    compliance: v.optional(v.any()), // { BER: "A3", FireCert: "missing", ... }
  })
    .index("by_site", ["siteId"])
    .index("by_project", ["projectId"]),

  // -------------------------------------------------------------------------
  // Governance
  // -------------------------------------------------------------------------

  /**
   * Immutable audit log. Every state change on a document, every admin
   * action, every data access that matters for regulator review.
   * NEVER update or delete rows — append only.
   */
  auditEvents: defineTable({
    orgId: v.id("organizations"),
    projectId: v.optional(v.id("projects")),
    documentId: v.optional(v.id("documents")),
    actor: v.union(
      v.object({ kind: v.literal("user"), userId: v.id("users") }),
      v.object({ kind: v.literal("system"), component: v.string() }),
    ),
    action: v.string(),  // e.g. "document.uploaded" | "document.scored" | "review.resolved"
    before: v.optional(v.any()),
    after: v.optional(v.any()),
    reason: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_project_time", ["projectId", "timestamp"])
    .index("by_document_time", ["documentId", "timestamp"])
    .index("by_org_time", ["orgId", "timestamp"]),

  // -------------------------------------------------------------------------
  // Billing & metering
  // -------------------------------------------------------------------------

  /**
   * Monthly usage counter per org. Written to by the ingest pipeline; read
   * by the billing job that syncs Stripe subscription metered usage.
   */
  usageCounters: defineTable({
    orgId: v.id("organizations"),
    yearMonth: v.string(), // "2026-04"
    docsProcessed: v.number(),
    ocrPages: v.number(),
    llmCalls: v.number(),
    storageBytes: v.number(),
    lastUpdatedAt: v.number(),
  })
    .index("by_org_month", ["orgId", "yearMonth"]),

  /**
   * Stripe subscription state, synced via webhook.
   */
  subscriptions: defineTable({
    orgId: v.id("organizations"),
    stripeSubscriptionId: v.string(),
    tier: OrgPlan,
    status: v.string(), // active | past_due | canceled | trialing
    seats: v.number(),
    docLimit: v.number(),
    currentPeriodEnd: v.number(),
    updatedAt: v.number(),
  })
    .index("by_org", ["orgId"])
    .index("by_stripe_sub", ["stripeSubscriptionId"]),
});
