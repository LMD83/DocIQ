/**
 * DN / CMP code normalisation.
 *
 * Legacy HSE filenames contain DN codes in many shapes — `DN101`, `DN-101`,
 * `DN 0101`, `DN0081A`. This module canonicalises them to `DN####` (4-digit
 * zero-padded) with an optional single-letter suffix for multi-building
 * site disambiguation.
 *
 * Port of `neis_parser.py::normalise_dn` and `normalise_cmp`. Parity tests
 * live in `tests/neis.test.ts`.
 */

import { DN_PERMISSIVE, CMP_PERMISSIVE } from "./regex.js";

/**
 * Canonicalise a DN code to `DN####` (zero-padded) with preserved suffix.
 * Returns `null` if the input does not match the permissive DN shape.
 *
 * @example
 *   normaliseDn("DN101")   // "DN0101"
 *   normaliseDn("DN-162")  // "DN0162"
 *   normaliseDn("DN0081A") // "DN0081A"
 *   normaliseDn("notadn")  // null
 */
export function normaliseDn(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(DN_PERMISSIVE);
  if (!match || !match.groups) return null;
  const { digits, suffix } = match.groups;
  if (!digits) return null;
  const padded = digits.padStart(4, "0");
  return `DN${padded}${suffix ?? ""}`;
}

/**
 * Canonicalise a CMP (campus) code to `CMP####` zero-padded form.
 * Returns `null` if the input does not match the permissive CMP shape.
 *
 * @example
 *   normaliseCmp("CMP3")    // "CMP0003"
 *   normaliseCmp("CMP 0003") // "CMP0003"
 */
export function normaliseCmp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const match = raw.trim().match(CMP_PERMISSIVE);
  if (!match || !match.groups) return null;
  const { digits } = match.groups;
  if (!digits) return null;
  return `CMP${digits.padStart(4, "0")}`;
}

/**
 * Building ID canonical form: `{site_code} B{NN}`.
 * HSE CHO9 convention — space-separated, two-digit block index.
 *
 * @example
 *   buildingIdFromParts("DN0053", 1) // "DN0053 B01"
 */
export function buildingIdFromParts(siteCode: string, blockIndex: number): string {
  const bn = String(blockIndex).padStart(2, "0");
  return `${siteCode} B${bn}`;
}
