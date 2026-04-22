/**
 * Record credibility scoring.
 *
 * Port of `neis_parser.py::record_credibility` and `credibility_route`.
 * Weights, penalties, and gates are mirrored byte-for-byte. Any change
 * must be made in BOTH files and parity tests must continue to pass.
 *
 * Scoring model (from Estate Record Spine PRD §6):
 *   Identity        40%  (project 0.15 + building_id 0.15 + drawing_number 0.10)
 *   Classification  30%  (document_type 0.10 + discipline 0.10 + stage 0.05 + revision 0.05)
 *   Temporal        15%  (date_issued 0.10 + date_superseded 0.05)
 *   Parties         15%  (author_firm 0.10 + certifier 0.05)
 *
 * Routing gates:
 *   ≥ 0.85  → publish    (auto-filed, audit-logged)
 *   ≥ 0.70  → review     (pre-populated human confirm)
 *   < 0.70  → quarantine (weekly triage)
 */

export type LicenceStatus = "valid" | "unknown" | "student" | "watermarked_other";
export type CredibilityRoute = "publish" | "review" | "quarantine";

/**
 * Field weights — sum to 1.0. Matches Python `FIELD_WEIGHTS` dict.
 *
 * Note: these are the *record-level* scoring keys after parse + content
 * extraction + register cross-reference — not the raw regex capture names.
 * For example, the NEIS regex captures `originator`; the scoring model
 * references that via `author_firm` after cross-lookup against the
 * originator registry.
 */
export const FIELD_WEIGHTS = {
  // Identity — 40%
  project: 0.15,
  building_id: 0.15,
  drawing_number: 0.1,
  // Classification — 30%
  document_type: 0.1,
  discipline: 0.1,
  stage_or_phase: 0.05,
  revision: 0.05,
  // Temporal — 15%
  date_issued: 0.1,
  date_superseded: 0.05,
  // Responsible parties — 15%
  author_firm: 0.1,
  certifier: 0.05,
} as const;

export type ScoringField = keyof typeof FIELD_WEIGHTS;

export const LICENCE_PENALTIES: Record<LicenceStatus, number> = {
  valid: 0,
  unknown: -0.05,
  student: -0.15, // Autodesk Student watermark — non-commercial
  watermarked_other: -0.1,
};

export const CREDIBILITY_GATES = {
  publish: 0.85,
  review: 0.7,
} as const;

export interface CredibilityBreakdownEntry {
  field: ScoringField;
  weight: number;
  confidence: number;
  contribution: number;
}

export interface CredibilityResult {
  score: number; // 0.0 - 1.0 (clamped)
  route: CredibilityRoute;
  licenceStatus: LicenceStatus;
  licencePenalty: number;
  breakdown: CredibilityBreakdownEntry[];
}

/**
 * Compute weighted record credibility.
 *
 * `fieldConfidence` is a partial map from scoring field → [0.0, 1.0].
 * Fields not present in the map contribute zero (consistent with Python's
 * `dict.get(k, 0.0)` behaviour).
 *
 * Returns a full breakdown (not just the score) so the audit log and review
 * UI can explain *why* a record scored what it scored.
 */
export function recordCredibility(
  fieldConfidence: Partial<Record<ScoringField, number>>,
  licenceStatus: LicenceStatus = "valid",
): CredibilityResult {
  const breakdown: CredibilityBreakdownEntry[] = [];
  let raw = 0;

  for (const field of Object.keys(FIELD_WEIGHTS) as ScoringField[]) {
    const weight = FIELD_WEIGHTS[field];
    const confidence = fieldConfidence[field] ?? 0;
    const contribution = weight * confidence;
    raw += contribution;
    breakdown.push({ field, weight, confidence, contribution });
  }

  const licencePenalty = LICENCE_PENALTIES[licenceStatus];
  const withPenalty = raw + licencePenalty;
  const score = Math.max(0, Math.min(1, withPenalty));

  return {
    score,
    route: credibilityRoute(score),
    licenceStatus,
    licencePenalty,
    breakdown,
  };
}

/**
 * Map a credibility score to a routing decision. Thresholds match Python
 * `credibility_route()` exactly.
 */
export function credibilityRoute(score: number): CredibilityRoute {
  if (score >= CREDIBILITY_GATES.publish) return "publish";
  if (score >= CREDIBILITY_GATES.review) return "review";
  return "quarantine";
}

/**
 * Translation layer: parser field confidence → scoring field confidence.
 *
 * The NEIS parser stamps confidence on its regex capture keys
 * (`project`, `infoType`, `role`, `phase`, `number`). The credibility
 * model uses abstract scoring keys (`project`, `document_type`,
 * `discipline`, `stage_or_phase`, `drawing_number`). This function
 * bridges the two so worker code can call:
 *
 *     const parse = parseFilename(name);
 *     const scoring = scoringFromParser(parse.confidence);
 *     const credibility = recordCredibility(scoring, licence);
 *
 * Fields the parser can't infer from the filename alone (building_id,
 * date_issued, author_firm, certifier, revision, date_superseded) are
 * populated downstream by content extraction and register cross-lookup
 * in the worker.
 */
export function scoringFromParser(
  parserConfidence: Partial<{
    project: number;
    phase: number;
    infoType: number;
    role: number;
    number: number;
    originator: number;
  }>,
): Partial<Record<ScoringField, number>> {
  const out: Partial<Record<ScoringField, number>> = {};
  if (parserConfidence.project !== undefined) out.project = parserConfidence.project;
  if (parserConfidence.number !== undefined) out.drawing_number = parserConfidence.number;
  if (parserConfidence.infoType !== undefined) out.document_type = parserConfidence.infoType;
  if (parserConfidence.role !== undefined) out.discipline = parserConfidence.role;
  if (parserConfidence.phase !== undefined) out.stage_or_phase = parserConfidence.phase;
  // originator → author_firm requires cross-lookup against OriginatorRegistry;
  // the worker sets this after the registry match, not here.
  return out;
}
