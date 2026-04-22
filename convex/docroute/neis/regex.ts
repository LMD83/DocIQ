/**
 * NEIS filename regex — TypeScript port of `neis_parser.py`.
 *
 * HSE NEIS File Naming Convention (Rev 11, 01.03.2022), aligned with
 * ISO 19650-2:2018 Irish National Annex.
 *
 * This module is the single source of truth for NEIS filename validation on
 * both the client (instant upload feedback) and the server (authoritative
 * parse in the ingestion worker).
 *
 * The Python reference implementation remains in `neis_parser.py` in the
 * Spine workers. Any change to patterns MUST be made in both and the
 * parity fixtures in `tests/neis.test.ts` must pass.
 *
 * Note on regex syntax:
 * - Python `(?P<name>...)` → JS `(?<name>...)` (ES2018+ named captures)
 * - Python `re.compile` anchored with ^...$ → JS RegExp with same anchors
 * - No `u` or `g` flags — we want deterministic `.match()` behaviour
 */

// ---------------------------------------------------------------------------
// Field-level regex components (named captures)
//
// Keep these as plain strings so they can be composed into the full patterns.
// Each named capture corresponds to a NEIS field.
// ---------------------------------------------------------------------------

export const FIELD_PATTERNS = {
  project: String.raw`(?<project>[A-Z0-9]{3,8})`,
  phase: String.raw`(?<phase>PH(?:\d{2}|\d[A-Z]|XX|ZZ))`,
  element: String.raw`(?<element>\d{2}|XX|ZZ)`,
  zone: String.raw`(?<zone>[A-Z])`,
  level: String.raw`(?<level>[LMB]\d{2}|DTM|XXX|ZZZ)`,
  infoType: String.raw`(?<infoType>[A-Z]{2})`,
  originator: String.raw`(?<originator>[A-Z0-9]{2,5})`,
  role: String.raw`(?<role>[A-Z]{2})`,
  number: String.raw`(?<number>\d{4,6})`,
  title: String.raw`(?<title>[^\\/]+?)`,
  extension: String.raw`(?<extension>\.[A-Za-z0-9]{2,4})`,
} as const;

export type NeisField = keyof typeof FIELD_PATTERNS;

// ---------------------------------------------------------------------------
// Full and minimum NEIS filename patterns
//
// Full form (all containers):
//   {project}-{phase}-{element}-{zone}-{level}-{infoType}-{originator}-{role}-{number}-{title}.{ext}
//
// Minimum form (convention permits omitting phase/element/zone on
// less-complex projects per the Rev 11 doc, Section "Document Files"):
//   {project}-{level}-{infoType}-{originator}-{role}-{number}-{title}.{ext}
// ---------------------------------------------------------------------------

const FP = FIELD_PATTERNS;

export const NEIS_FULL = new RegExp(
  `^${FP.project}-${FP.phase}-${FP.element}-${FP.zone}-${FP.level}-` +
    `${FP.infoType}-${FP.originator}-${FP.role}-${FP.number}-${FP.title}${FP.extension}$`,
);

export const NEIS_MIN = new RegExp(
  `^${FP.project}-${FP.level}-${FP.infoType}-${FP.originator}-${FP.role}-` +
    `${FP.number}-${FP.title}${FP.extension}$`,
);

// ---------------------------------------------------------------------------
// Building (DN) and Campus (CMP) code patterns
//
// DN codes canonicalise to `DN####` or `DN####A` (suffix preserves multi-
// building site disambiguation). `normalise_dn` in `normalise.ts` handles
// zero-padding and whitespace/hyphen variants seen in legacy data.
// ---------------------------------------------------------------------------

export const DN_STRICT = /^DN\d{4}[A-Z]?$/;
export const DN_PERMISSIVE = /^DN[\s\-]?(?<digits>\d{3,6})(?<suffix>[A-Z])?$/;
export const CMP_STRICT = /^CMP\d{4}$/;
export const CMP_PERMISSIVE = /^CMP[\s\-]?(?<digits>\d{3,6})$/;

// ---------------------------------------------------------------------------
// Pattern confidence baselines
//
// Used by the parser to stamp per-field confidence on a match. Full-pattern
// matches carry higher confidence than min-pattern matches because the
// structure itself conveys more validation.
//
// These constants mirror `neis_parser.py`:
//   - pattern_matched="full" → per-field confidence 0.95
//   - pattern_matched="min"  → per-field confidence 0.90
// ---------------------------------------------------------------------------

export const PATTERN_CONFIDENCE = {
  full: 0.95,
  min: 0.9,
} as const;
