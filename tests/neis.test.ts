/**
 * NEIS parser parity tests.
 *
 * Fixtures ported from `neis_parser.py` `__main__` block so any drift between
 * the TS and Python implementations will break CI. If you change regex
 * anywhere, both implementations must produce the same output against these
 * fixtures.
 */

import { describe, it, expect } from "vitest";
import {
  parseFilename,
  renderFullFilename,
  renderMinFilename,
  isNeisCompliant,
  normaliseDn,
  normaliseCmp,
  buildingIdFromParts,
  recordCredibility,
  credibilityRoute,
  viewTypeFromNumber,
  FIELD_WEIGHTS,
  CREDIBILITY_GATES,
} from "../convex/neis/index.js";

// ---------------------------------------------------------------------------
// parseFilename — must behave identically to Python parse_filename
// ---------------------------------------------------------------------------

describe("parseFilename: full NEIS form", () => {
  it("parses the canonical example from the convention doc", () => {
    const name = "NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Distribution Board Schedule.pdf";
    const p = parseFilename(name);

    expect(p.patternMatched).toBe("full");
    expect(p.project).toBe("NEIS01");
    expect(p.phase).toBe("PH01");
    expect(p.element).toBe("62");
    expect(p.zone).toBe("B");
    expect(p.level).toBe("L01");
    expect(p.infoType).toBe("DR");
    expect(p.originator).toBe("HSE");
    expect(p.role).toBe("PM");
    expect(p.number).toBe("60007");
    expect(p.title).toBe("Distribution Board Schedule");
    expect(p.extension).toBe(".pdf");
    expect(p.viewType).toBe("RoomDataSheet"); // first digit 6
  });

  it("stamps 0.95 confidence on every matched field for full form", () => {
    const p = parseFilename("NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Distribution Board Schedule.pdf");
    for (const field of ["project", "phase", "element", "zone", "level", "infoType", "originator", "role", "number", "title"] as const) {
      expect(p.confidence[field]).toBe(0.95);
    }
  });

  it("derives view type from number's leading digit", () => {
    const cases = [
      { number: "00001", expected: "General" },
      { number: "10001", expected: "Plan" },
      { number: "20001", expected: "Elevation" },
      { number: "30001", expected: "Section" },
      { number: "40001", expected: "Schedule" },
      { number: "50001", expected: "Detail" },
      { number: "60001", expected: "RoomDataSheet" },
      { number: "70001", expected: "ReflectedCeilingPlan" },
      { number: "80001", expected: "ThreeDView" },
      { number: "90001", expected: "UserDefined" },
    ];
    for (const { number, expected } of cases) {
      expect(viewTypeFromNumber(number)).toBe(expected);
    }
  });
});

describe("parseFilename: minimum NEIS form", () => {
  it("parses a minimum-form filename", () => {
    const name = "11534-L00-DR-HSE-AR-11001-Site Plan.pdf";
    const p = parseFilename(name);

    expect(p.patternMatched).toBe("min");
    expect(p.project).toBe("11534");
    expect(p.level).toBe("L00");
    expect(p.infoType).toBe("DR");
    expect(p.originator).toBe("HSE");
    expect(p.role).toBe("AR");
    expect(p.number).toBe("11001");
    expect(p.title).toBe("Site Plan");
    expect(p.extension).toBe(".pdf");
    expect(p.phase).toBeUndefined();
    expect(p.element).toBeUndefined();
    expect(p.zone).toBeUndefined();
  });

  it("stamps 0.90 confidence on every matched field for min form", () => {
    const p = parseFilename("11534-L00-DR-HSE-AR-11001-Site Plan.pdf");
    for (const field of ["project", "level", "infoType", "originator", "role", "number", "title"] as const) {
      expect(p.confidence[field]).toBe(0.9);
    }
    expect(p.confidence.phase).toBeUndefined();
    expect(p.confidence.element).toBeUndefined();
    expect(p.confidence.zone).toBeUndefined();
  });
});

describe("parseFilename: legacy / non-matching", () => {
  it("returns pattern_matched='none' for legacy filenames", () => {
    const p = parseFilename("GF-Campus.pdf");
    expect(p.patternMatched).toBe("none");
    expect(p.project).toBeUndefined();
    expect(Object.keys(p.confidence)).toHaveLength(0);
  });

  it("returns pattern_matched='none' for empty input", () => {
    expect(parseFilename("").patternMatched).toBe("none");
  });

  it("returns pattern_matched='none' for filenames with wrong separators", () => {
    expect(parseFilename("NEIS01_PH01_62_B_L01_DR_HSE_PM_60007_Title.pdf").patternMatched).toBe("none");
  });
});

describe("isNeisCompliant", () => {
  it("returns true for full and min form", () => {
    expect(isNeisCompliant("NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Title.pdf")).toBe(true);
    expect(isNeisCompliant("11534-L00-DR-HSE-AR-11001-Site Plan.pdf")).toBe(true);
  });
  it("returns false for legacy", () => {
    expect(isNeisCompliant("GF-Campus.pdf")).toBe(false);
  });
});

describe("renderFullFilename / renderMinFilename", () => {
  it("round-trips a full-form filename", () => {
    const name = "NEIS01-PH01-62-B-L01-DR-HSE-PM-60007-Distribution Board Schedule.pdf";
    const p = parseFilename(name);
    expect(p.patternMatched).toBe("full");
    const rendered = renderFullFilename({
      project: p.project!,
      phase: p.phase!,
      element: p.element!,
      zone: p.zone!,
      level: p.level!,
      infoType: p.infoType!,
      originator: p.originator!,
      role: p.role!,
      number: p.number!,
      title: p.title!,
      extension: p.extension!,
    });
    expect(rendered).toBe(name);
  });

  it("round-trips a min-form filename", () => {
    const name = "11534-L00-DR-HSE-AR-11001-Site Plan.pdf";
    const p = parseFilename(name);
    expect(p.patternMatched).toBe("min");
    const rendered = renderMinFilename({
      project: p.project!,
      level: p.level!,
      infoType: p.infoType!,
      originator: p.originator!,
      role: p.role!,
      number: p.number!,
      title: p.title!,
      extension: p.extension!,
    });
    expect(rendered).toBe(name);
  });
});

// ---------------------------------------------------------------------------
// DN / CMP normalisation — parity with Python normalise_dn / normalise_cmp
// ---------------------------------------------------------------------------

describe("normaliseDn", () => {
  const cases: Array<[string | null | undefined, string | null]> = [
    ["DN0081", "DN0081"],
    ["DN101", "DN0101"],
    ["DN-101", "DN0101"],
    ["DN 0101", "DN0101"],
    ["DN0162A", "DN0162A"],
    ["DN162A", "DN0162A"],
    ["notadn", null],
    ["", null],
    [null, null],
    [undefined, null],
  ];
  it.each(cases)("normaliseDn(%o) → %o", (input, expected) => {
    expect(normaliseDn(input)).toBe(expected);
  });
});

describe("normaliseCmp", () => {
  const cases: Array<[string | null | undefined, string | null]> = [
    ["CMP0003", "CMP0003"],
    ["CMP3", "CMP0003"],
    ["CMP 0003", "CMP0003"],
    ["CMP-10", "CMP0010"],
    ["DN0081", null],
    ["", null],
  ];
  it.each(cases)("normaliseCmp(%o) → %o", (input, expected) => {
    expect(normaliseCmp(input)).toBe(expected);
  });
});

describe("buildingIdFromParts", () => {
  it("formats building ID per HSE CHO9 convention", () => {
    expect(buildingIdFromParts("DN0053", 1)).toBe("DN0053 B01");
    expect(buildingIdFromParts("DN0053", 10)).toBe("DN0053 B10");
    expect(buildingIdFromParts("DN0574", 1)).toBe("DN0574 B01");
  });
});

// ---------------------------------------------------------------------------
// Credibility scoring — parity with Python record_credibility / credibility_route
// ---------------------------------------------------------------------------

describe("FIELD_WEIGHTS sum", () => {
  it("weights sum to 1.0", () => {
    const total = Object.values(FIELD_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(1.0, 6);
  });
});

describe("recordCredibility — parity fixtures", () => {
  it("NEIS-compliant at 0.95 across all fields with valid licence → publish", () => {
    const conf = Object.fromEntries(
      Object.keys(FIELD_WEIGHTS).map((k) => [k, 0.95]),
    ) as Record<keyof typeof FIELD_WEIGHTS, number>;

    const r = recordCredibility(conf, "valid");
    // Python equivalent: sum(weight * 0.95) + 0 = 0.95
    expect(r.score).toBeCloseTo(0.95, 6);
    expect(r.route).toBe("publish");
    expect(r.licencePenalty).toBe(0);
  });

  it("Legacy OCR-style at 0.85 with student licence → review", () => {
    const conf = Object.fromEntries(
      Object.keys(FIELD_WEIGHTS).map((k) => [k, 0.85]),
    ) as Record<keyof typeof FIELD_WEIGHTS, number>;

    const r = recordCredibility(conf, "student");
    // Python equivalent: sum(weight * 0.85) - 0.15 = 0.85 - 0.15 = 0.70
    expect(r.score).toBeCloseTo(0.7, 6);
    expect(r.route).toBe("review"); // exactly at the review threshold
    expect(r.licencePenalty).toBe(-0.15);
  });

  it("Score clamps to [0, 1] when penalty would push below zero", () => {
    const conf = { project: 0.1 }; // 0.1 * 0.15 = 0.015 + -0.15 = negative
    const r = recordCredibility(conf, "student");
    expect(r.score).toBe(0);
    expect(r.route).toBe("quarantine");
  });

  it("Missing fields contribute zero (matches Python dict.get default)", () => {
    const r = recordCredibility({ project: 1.0 }, "valid");
    expect(r.score).toBeCloseTo(0.15, 6); // only project contributes
    expect(r.route).toBe("quarantine");
  });

  it("Breakdown entries correspond 1:1 to FIELD_WEIGHTS", () => {
    const r = recordCredibility({ project: 0.9 }, "valid");
    expect(r.breakdown).toHaveLength(Object.keys(FIELD_WEIGHTS).length);
    const projectEntry = r.breakdown.find((b) => b.field === "project");
    expect(projectEntry).toBeDefined();
    expect(projectEntry!.weight).toBe(0.15);
    expect(projectEntry!.confidence).toBe(0.9);
    expect(projectEntry!.contribution).toBeCloseTo(0.135, 6);
  });
});

describe("credibilityRoute", () => {
  it("gates match Python credibility_route exactly", () => {
    expect(credibilityRoute(0.85)).toBe("publish");
    expect(credibilityRoute(0.849999)).toBe("review");
    expect(credibilityRoute(0.7)).toBe("review");
    expect(credibilityRoute(0.699999)).toBe("quarantine");
    expect(credibilityRoute(0)).toBe("quarantine");
    expect(credibilityRoute(1)).toBe("publish");
  });

  it("publishes at exactly the publish gate", () => {
    expect(credibilityRoute(CREDIBILITY_GATES.publish)).toBe("publish");
  });

  it("reviews at exactly the review gate", () => {
    expect(credibilityRoute(CREDIBILITY_GATES.review)).toBe("review");
  });
});
