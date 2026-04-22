/**
 * NEIS filename parser.
 *
 * Port of `neis_parser.py::parse_filename`. Attempts to match the full NEIS
 * pattern first, then the minimum pattern. Returns a typed `ParsedFilename`
 * object with per-field confidence stamped at the pattern level
 * (full → 0.95, min → 0.90).
 *
 * Legacy filenames that match neither are returned with
 * `patternMatched = "none"` and no field values — they route through the
 * content-extraction pipeline in the worker.
 */

import { NEIS_FULL, NEIS_MIN, PATTERN_CONFIDENCE, type NeisField } from "./regex.js";
import { viewTypeFromNumber, type ViewTypeName } from "./viewTypes.js";

export type PatternMatched = "full" | "min" | "none";

/**
 * Per-field confidence map. Keys are NEIS field names except `extension`,
 * which is structural rather than metadata and doesn't carry confidence.
 */
export type FieldConfidence = Partial<Record<Exclude<NeisField, "extension">, number>>;

export interface ParsedFilename {
  raw: string;
  patternMatched: PatternMatched;
  project?: string;
  phase?: string;
  element?: string;
  zone?: string;
  level?: string;
  infoType?: string;
  originator?: string;
  role?: string;
  number?: string;
  title?: string;
  extension?: string;
  viewType?: ViewTypeName;
  confidence: FieldConfidence;
}

/**
 * Parse a filename against NEIS full-form, then minimum-form.
 *
 * The parser is anchored (`^...$`) — no partial matches. Filenames with
 * whitespace in the title are tolerated (the `title` capture consumes
 * everything up to the extension except slashes/backslashes).
 */
export function parseFilename(name: string): ParsedFilename {
  // Try full form first
  const fullMatch = name.match(NEIS_FULL);
  if (fullMatch?.groups) {
    return buildResult(name, "full", fullMatch.groups, PATTERN_CONFIDENCE.full);
  }

  // Fall back to minimum form
  const minMatch = name.match(NEIS_MIN);
  if (minMatch?.groups) {
    return buildResult(name, "min", minMatch.groups, PATTERN_CONFIDENCE.min);
  }

  // No match — legacy filename
  return {
    raw: name,
    patternMatched: "none",
    confidence: {},
  };
}

function buildResult(
  raw: string,
  patternMatched: Exclude<PatternMatched, "none">,
  groups: Record<string, string>,
  baseConfidence: number,
): ParsedFilename {
  const result: ParsedFilename = {
    raw,
    patternMatched,
    project: groups["project"],
    phase: groups["phase"],
    element: groups["element"],
    zone: groups["zone"],
    level: groups["level"],
    infoType: groups["infoType"],
    originator: groups["originator"],
    role: groups["role"],
    number: groups["number"],
    title: groups["title"],
    extension: groups["extension"],
    confidence: {},
  };

  // Stamp per-field confidence for every non-extension field that matched
  const fields: Array<Exclude<NeisField, "extension">> = [
    "project",
    "phase",
    "element",
    "zone",
    "level",
    "infoType",
    "originator",
    "role",
    "number",
    "title",
  ];
  for (const f of fields) {
    if (groups[f] !== undefined) {
      result.confidence[f] = baseConfidence;
    }
  }

  // Derive view type from the number's first digit if present
  if (result.number) {
    const vt = viewTypeFromNumber(result.number);
    if (vt) result.viewType = vt;
  }

  return result;
}

/**
 * Convenience: is this filename at least parseable as NEIS (full or min)?
 * Used for client-side upload feedback.
 */
export function isNeisCompliant(name: string): boolean {
  return parseFilename(name).patternMatched !== "none";
}

/**
 * Render a NEIS filename from parts. Inverse of parseFilename (for full form).
 * Returns null if any required full-form field is missing. Useful for the
 * rename preview in the review UI.
 */
export function renderFullFilename(parts: {
  project: string;
  phase: string;
  element: string;
  zone: string;
  level: string;
  infoType: string;
  originator: string;
  role: string;
  number: string;
  title: string;
  extension: string; // with leading dot, e.g. ".pdf"
}): string {
  const { project, phase, element, zone, level, infoType, originator, role, number, title, extension } = parts;
  return `${project}-${phase}-${element}-${zone}-${level}-${infoType}-${originator}-${role}-${number}-${title}${extension}`;
}

/**
 * Render a minimum-form filename from parts.
 */
export function renderMinFilename(parts: {
  project: string;
  level: string;
  infoType: string;
  originator: string;
  role: string;
  number: string;
  title: string;
  extension: string;
}): string {
  const { project, level, infoType, originator, role, number, title, extension } = parts;
  return `${project}-${level}-${infoType}-${originator}-${role}-${number}-${title}${extension}`;
}
