/**
 * Document view type — first digit of a 5-digit NEIS drawing number.
 *
 * From the convention doc, Rev 11, Section "Number":
 *   "an additional number (optional) can be added to the start of the 4 digit
 *    (the first digit of a 5 digit sequential number), this will be used to
 *    define the document view type (primarily for drawings)."
 *
 * Parity with `VIEW_TYPES` dict in `neis_parser.py`.
 */

export const VIEW_TYPES = {
  "0": "General",
  "1": "Plan",
  "2": "Elevation",
  "3": "Section",
  "4": "Schedule",
  "5": "Detail",
  "6": "RoomDataSheet",
  "7": "ReflectedCeilingPlan",
  "8": "ThreeDView",
  "9": "UserDefined",
} as const;

export type ViewTypeCode = keyof typeof VIEW_TYPES;
export type ViewTypeName = (typeof VIEW_TYPES)[ViewTypeCode];

/**
 * Return the view type for a NEIS number string, or `undefined` if the number
 * is not 5 digits or the leading digit is unmapped. Leading zeros are valid
 * (a 4-digit number starting with 0 is view type "General").
 */
export function viewTypeFromNumber(number: string | undefined | null): ViewTypeName | undefined {
  if (!number || number.length < 1) return undefined;
  const first = number[0] as ViewTypeCode;
  return VIEW_TYPES[first];
}
