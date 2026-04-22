/**
 * GovIQ DocRoute — NEIS module barrel.
 *
 * Import surface for both client and server code:
 *
 *     import { parseFilename, recordCredibility, normaliseDn } from "@/convex/neis";
 */

export {
  FIELD_PATTERNS,
  NEIS_FULL,
  NEIS_MIN,
  DN_STRICT,
  DN_PERMISSIVE,
  CMP_STRICT,
  CMP_PERMISSIVE,
  PATTERN_CONFIDENCE,
  type NeisField,
} from "./regex.js";

export {
  VIEW_TYPES,
  viewTypeFromNumber,
  type ViewTypeCode,
  type ViewTypeName,
} from "./viewTypes.js";

export {
  normaliseDn,
  normaliseCmp,
  buildingIdFromParts,
} from "./normalise.js";

export {
  parseFilename,
  isNeisCompliant,
  renderFullFilename,
  renderMinFilename,
  type PatternMatched,
  type FieldConfidence,
  type ParsedFilename,
} from "./parser.js";

export {
  FIELD_WEIGHTS,
  LICENCE_PENALTIES,
  CREDIBILITY_GATES,
  recordCredibility,
  credibilityRoute,
  scoringFromParser,
  type LicenceStatus,
  type CredibilityRoute,
  type ScoringField,
  type CredibilityBreakdownEntry,
  type CredibilityResult,
} from "./credibility.js";
