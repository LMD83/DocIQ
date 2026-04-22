/**
 * NEIS seed data — embedded code tables.
 *
 * Source of truth: the HSE-supplied CSVs (DisciplineCodes.csv, ElementCodes.csv,
 * InfoTypeCodes.csv, PurposeCodes.csv, AcceptanceCodes.csv, LevelCodes.csv,
 * PhaseCodes.csv, OriginatorRegister.csv).
 *
 * These constants are embedded rather than read from disk at runtime so the
 * seed action is reproducible in any environment (Convex actions don't have
 * filesystem access to the repo). When a new revision of the convention is
 * published, regenerate this file from the updated CSVs and bump the
 * `NEIS_CONVENTION.version`.
 */

export interface CodeTableEntry {
  code: string;
  description: string;
  group?: string;
}

// ---------------------------------------------------------------------------
// Discipline / Role codes (41 entries)
// Source: DisciplineCodes.csv
// ---------------------------------------------------------------------------
export const DISCIPLINE_CODES: CodeTableEntry[] = [
  { code: "AR", description: "Architect", group: "Design" },
  { code: "BS", description: "Building Surveyor", group: "Survey" },
  { code: "CE", description: "Civil Engineer", group: "Design" },
  { code: "CM", description: "Cost Manager / Quantity Surveyor", group: "Cost" },
  { code: "CN", description: "Contractor", group: "Construction" },
  { code: "DE", description: "Drainage Engineer", group: "Design" },
  { code: "EE", description: "Electrical Engineer", group: "Design" },
  { code: "EN", description: "Environmental Consultant", group: "Design" },
  { code: "FM", description: "Facilities Manager", group: "Operations" },
  { code: "FO", description: "Facility Owner / Representative", group: "Operations" },
  { code: "GS", description: "Geospatial / Land Surveyor", group: "Survey" },
  { code: "HS", description: "Health and Safety Manager", group: "Safety" },
  { code: "IA", description: "Interior Architect", group: "Design" },
  { code: "IC", description: "Instrumentation and Control Engineer", group: "Design" },
  { code: "IM", description: "Information Manager", group: "Information" },
  { code: "LA", description: "Landscape Architect", group: "Design" },
  { code: "LS", description: "Life Safety Engineer", group: "Safety" },
  { code: "ME", description: "Mechanical Engineer", group: "Design" },
  { code: "PE", description: "Public Health Engineer", group: "Design" },
  { code: "PL", description: "Town Planner", group: "Planning" },
  { code: "PM", description: "Project Manager", group: "Management" },
  { code: "SC", description: "Subcontractor", group: "Construction" },
  { code: "SD", description: "Specialist Designer", group: "Design" },
  { code: "SE", description: "Structural Engineer", group: "Design" },
  { code: "SF", description: "Software Engineer", group: "Information" },
  { code: "SS", description: "Security Specialist", group: "Safety" },
  { code: "TE", description: "Communications Engineer", group: "Design" },
  { code: "VZ", description: "Visualisation", group: "Design" },
  { code: "AC", description: "Assigned Certifier", group: "Certifier" },
  { code: "AN", description: "Ancillary Certifier", group: "Certifier" },
  { code: "BI", description: "BIM Information Manager", group: "Information" },
  { code: "BM", description: "BIM Manager", group: "Information" },
  { code: "DC", description: "Design Certifier", group: "Certifier" },
  { code: "ER", description: "Employer's Representative", group: "Management" },
  { code: "EX", description: "Energy Expert", group: "Design" },
  { code: "FS", description: "Fire Safety Consultant", group: "Safety" },
  { code: "PC", description: "Project Supervisor Construction Stage (PSCS)", group: "Safety" },
  { code: "PD", description: "Project Supervisor Design Process (PSDP)", group: "Safety" },
  { code: "TA", description: "Technical Advisor", group: "Management" },
  { code: "ZZ", description: "General / Non-Disciplinary", group: "Special" },
];

// ---------------------------------------------------------------------------
// Element / System codes (53 entries)
// Source: ElementCodes.csv
// ---------------------------------------------------------------------------
export const ELEMENT_CODES: CodeTableEntry[] = [
  { code: "10", description: "Prepared Site", group: "Substructure" },
  { code: "11", description: "Ground/Earth Shapes", group: "Substructure" },
  { code: "13", description: "Floors in Substructure", group: "Substructure" },
  { code: "16", description: "Foundations/Rising Walls", group: "Substructure" },
  { code: "17", description: "Piled Foundations", group: "Substructure" },
  { code: "20", description: "Site Structures", group: "Superstructure" },
  { code: "21", description: "External Walls", group: "Superstructure" },
  { code: "22", description: "Internal Walls", group: "Superstructure" },
  { code: "23", description: "Floors", group: "Superstructure" },
  { code: "24", description: "Stairs/Ramps", group: "Superstructure" },
  { code: "27", description: "Roofs", group: "Superstructure" },
  { code: "28", description: "Frames", group: "Superstructure" },
  { code: "30", description: "Site Enclosures", group: "Completions" },
  { code: "31", description: "External Wall Completions", group: "Completions" },
  { code: "32", description: "Internal Wall Completions", group: "Completions" },
  { code: "33", description: "Floor Completions", group: "Completions" },
  { code: "34", description: "Stair Completions", group: "Completions" },
  { code: "35", description: "Suspended Ceilings", group: "Completions" },
  { code: "37", description: "Roof Completions", group: "Completions" },
  { code: "40", description: "Roads/Paths", group: "Finishes" },
  { code: "41", description: "Wall Finishes General", group: "Finishes" },
  { code: "42", description: "Wall Finishes Internal", group: "Finishes" },
  { code: "43", description: "Floor Finishes", group: "Finishes" },
  { code: "44", description: "Stair Finishes", group: "Finishes" },
  { code: "45", description: "Ceiling Finishes", group: "Finishes" },
  { code: "47", description: "Roof Finishes", group: "Finishes" },
  { code: "50", description: "Site Services - Mechanical", group: "Mechanical" },
  { code: "51", description: "Heating Centre", group: "Mechanical" },
  { code: "52", description: "Drainage", group: "Mechanical" },
  { code: "53", description: "Water Distribution", group: "Mechanical" },
  { code: "54", description: "Gas Distribution", group: "Mechanical" },
  { code: "55", description: "Space Cooling", group: "Mechanical" },
  { code: "56", description: "Space Heating", group: "Mechanical" },
  { code: "57", description: "Ventilation and Air Conditioning", group: "Mechanical" },
  { code: "58", description: "Other Mechanical and Electrical", group: "Mechanical" },
  { code: "60", description: "Site Services - Electrical", group: "Electrical" },
  { code: "61", description: "Electrical Supply/Main", group: "Electrical" },
  { code: "62", description: "Power", group: "Electrical" },
  { code: "63", description: "Lighting", group: "Electrical" },
  { code: "64", description: "Communications", group: "Electrical" },
  { code: "65", description: "Security/Protection", group: "Electrical" },
  { code: "66", description: "Transport", group: "Electrical" },
  { code: "68", description: "Other Electrical", group: "Electrical" },
  { code: "70", description: "Site Fittings", group: "Fittings" },
  { code: "71", description: "Display/Circulation Fittings", group: "Fittings" },
  { code: "72", description: "Work/Rest/Play Fittings", group: "Fittings" },
  { code: "73", description: "Culinary Fittings", group: "Fittings" },
  { code: "74", description: "Sanitary Fittings", group: "Fittings" },
  { code: "75", description: "Cleaning/Maintenance Fittings", group: "Fittings" },
  { code: "76", description: "Storage/Screening Fittings", group: "Fittings" },
  { code: "80", description: "Landscape/Play Areas", group: "External" },
  { code: "XX", description: "No Associated Element", group: "Special" },
  { code: "ZZ", description: "Multiple Elements", group: "Special" },
];

// ---------------------------------------------------------------------------
// Information Type codes (53 entries)
// Source: InfoTypeCodes.csv
// ---------------------------------------------------------------------------
export const INFO_TYPE_CODES: CodeTableEntry[] = [
  { code: "AG", description: "Agenda", group: "Meeting" },
  { code: "AF", description: "Animation", group: "Media" },
  { code: "BQ", description: "Bill of Quantities", group: "Cost" },
  { code: "CA", description: "Calculations", group: "Technical" },
  { code: "CE", description: "Certificate", group: "Governance" },
  { code: "CH", description: "Chart", group: "Information" },
  { code: "CR", description: "Clash Rendition", group: "BIM" },
  { code: "CM", description: "Combined Model", group: "BIM" },
  { code: "CC", description: "Contract", group: "Contractual" },
  { code: "DR", description: "Drawing", group: "Graphical" },
  { code: "ER", description: "Employer Records", group: "Governance" },
  { code: "ES", description: "Estimate", group: "Cost" },
  { code: "FE", description: "Fee Proposal", group: "Commercial" },
  { code: "GD", description: "Geographic Information System", group: "Spatial" },
  { code: "IM", description: "Image", group: "Media" },
  { code: "IE", description: "Information Exchange", group: "Information" },
  { code: "IV", description: "Invoice", group: "Commercial" },
  { code: "IS", description: "Issue Sheet", group: "Information" },
  { code: "MA", description: "Manual", group: "Operations" },
  { code: "MS", description: "Method Statement", group: "Safety" },
  { code: "MI", description: "Minutes", group: "Meeting" },
  { code: "MR", description: "Model Rendition", group: "BIM" },
  { code: "M2", description: "2D Model", group: "BIM" },
  { code: "M3", description: "3D Model", group: "BIM" },
  { code: "PT", description: "Permit", group: "Governance" },
  { code: "PH", description: "Photograph", group: "Media" },
  { code: "PL", description: "Plan", group: "Graphical" },
  { code: "PY", description: "Policy", group: "Governance" },
  { code: "PP", description: "Presentation", group: "Information" },
  { code: "PW", description: "Process Workflow", group: "Information" },
  { code: "PR", description: "Programme", group: "Management" },
  { code: "RG", description: "Register", group: "Information" },
  { code: "RP", description: "Report", group: "Information" },
  { code: "RD", description: "Room Data Sheet", group: "Technical" },
  { code: "SH", description: "Schedule", group: "Information" },
  { code: "SC", description: "Schematic", group: "Graphical" },
  { code: "SP", description: "Specification", group: "Technical" },
  { code: "SU", description: "Survey", group: "Survey" },
  { code: "TE", description: "Template", group: "Information" },
  { code: "VS", description: "Visualisation", group: "Media" },
  { code: "BR", description: "Brief", group: "Governance" },
  { code: "CP", description: "Cost Plan", group: "Cost" },
  { code: "CT", description: "Cost Report", group: "Cost" },
  { code: "FN", description: "File Note", group: "Information" },
  { code: "HS", description: "Health and Safety", group: "Safety" },
  { code: "IP", description: "Inspection and Test Plan", group: "Quality" },
  { code: "PD", description: "Pricing Document", group: "Commercial" },
  { code: "RE", description: "Records", group: "Governance" },
  { code: "SA", description: "Schedule of Accommodation", group: "Technical" },
  { code: "SK", description: "Sketch", group: "Graphical" },
  { code: "ST", description: "Statutory Document", group: "Governance" },
  { code: "TS", description: "Technical Data Sheet", group: "Technical" },
  { code: "TD", description: "Tender Document", group: "Commercial" },
];

// ---------------------------------------------------------------------------
// Purpose Codes (11 entries, P00–P10)
// Source: PurposeCodes.csv
// ---------------------------------------------------------------------------
export const PURPOSE_CODES: CodeTableEntry[] = [
  { code: "P00", description: "Initiation", group: "Pre-Design" },
  { code: "P01", description: "Information", group: "General" },
  { code: "P02", description: "Coordination", group: "Design" },
  { code: "P03", description: "Planning Permission", group: "Statutory" },
  { code: "P04", description: "Fire Safety Certificate", group: "Statutory" },
  { code: "P05", description: "Disability Access Certificate", group: "Statutory" },
  { code: "P06", description: "Building Control Compliance", group: "Statutory" },
  { code: "P07", description: "Pre-Tender", group: "Procurement" },
  { code: "P08", description: "Tender", group: "Procurement" },
  { code: "P09", description: "Contract / Construction", group: "Construction" },
  { code: "P10", description: "Handover", group: "Handover" },
];

// ---------------------------------------------------------------------------
// Acceptance Codes (5 entries)
// Source: AcceptanceCodes.csv
// ---------------------------------------------------------------------------
export const ACCEPTANCE_CODES: CodeTableEntry[] = [
  { code: "S", description: "Issued (not yet accepted or reviewed)" },
  { code: "A", description: "Accepted" },
  { code: "B", description: "Accepted subject to comments" },
  { code: "C", description: "Rejected" },
  { code: "D", description: "Acceptance not required" },
];

// ---------------------------------------------------------------------------
// Level Codes (13 entries)
// Source: LevelCodes.csv
// ---------------------------------------------------------------------------
export const LEVEL_CODES: CodeTableEntry[] = [
  { code: "L00", description: "Ground Floor", group: "Above Ground" },
  { code: "L01", description: "First Floor", group: "Above Ground" },
  { code: "L02", description: "Second Floor", group: "Above Ground" },
  { code: "L03", description: "Third Floor", group: "Above Ground" },
  { code: "L04", description: "Fourth Floor", group: "Above Ground" },
  { code: "L05", description: "Fifth Floor", group: "Above Ground" },
  { code: "M00", description: "Ground Mezzanine", group: "Mezzanine" },
  { code: "M01", description: "First Mezzanine", group: "Mezzanine" },
  { code: "B01", description: "First Basement", group: "Below Ground" },
  { code: "B02", description: "Second Basement", group: "Below Ground" },
  { code: "DTM", description: "Datum", group: "Special" },
  { code: "XXX", description: "No Level", group: "Special" },
  { code: "ZZZ", description: "Multiple Levels", group: "Special" },
];

// ---------------------------------------------------------------------------
// Phase Codes (8 entries)
// Source: PhaseCodes.csv
// ---------------------------------------------------------------------------
export const PHASE_CODES: CodeTableEntry[] = [
  { code: "PH01", description: "Phase 1" },
  { code: "PH02", description: "Phase 2" },
  { code: "PH03", description: "Phase 3" },
  { code: "PH04", description: "Phase 4" },
  { code: "PH1A", description: "Phase 1A (Sub-phase)" },
  { code: "PH1B", description: "Phase 1B (Sub-phase)" },
  { code: "PHXX", description: "No Phase / Not Phased" },
  { code: "PHZZ", description: "All Phases / Multi-phase" },
];

// ---------------------------------------------------------------------------
// Originator Registry — global seeds (the customer's OriginatorRegister.csv
// only contained HSE; the product seeds a broader default set for common
// Irish AEC organisations. Customers add their own originators per-org.)
// ---------------------------------------------------------------------------
export interface OriginatorSeed {
  code: string;
  organisationName: string;
  type?: string;
  notes?: string;
}

export const ORIGINATOR_SEEDS: OriginatorSeed[] = [
  { code: "HSE", organisationName: "Health Service Executive", type: "Client", notes: "Primary client / in-house estates team" },
  { code: "OPW", organisationName: "Office of Public Works", type: "Client" },
  { code: "TUS", organisationName: "Tusla — Child and Family Agency", type: "Client" },
  { code: "HIQ", organisationName: "Health Information and Quality Authority", type: "Authority" },
  { code: "OGP", organisationName: "Office of Government Procurement", type: "Authority" },
];

// ---------------------------------------------------------------------------
// NEIS Convention definition
// ---------------------------------------------------------------------------

export const NEIS_CONVENTION = {
  key: "NEIS",
  name: "HSE NEIS File Naming Convention",
  version: "Rev 11 (2022-03-01)",
  description:
    "HSE Capital & Estates file naming policy aligned with IS EN ISO 19650-2:2018 Irish National Annex. " +
    "Governs container naming for all capital projects within the National Estates Information System.",
  sourceUrl: "https://healthservice.hse.ie", // placeholder — replace with canonical URL
  fullPattern: "{project}-{phase}-{element}-{zone}-{level}-{infoType}-{originator}-{role}-{number}-{title}",
  minPattern: "{project}-{level}-{infoType}-{originator}-{role}-{number}-{title}",
  separator: "-",
  case: "preserve" as const,

  fields: [
    {
      key: "project",
      label: "Project Code",
      required: true,
      regex: "^[A-Z0-9]{3,8}$",
      minLength: 3,
      maxLength: 8,
      description: "HSE Capital Projects Reference Number (typically 5 digits ± trailing letter, e.g. 11534 or 11534B) or internal subsystem code (e.g. NEIS01).",
    },
    {
      key: "phase",
      label: "Sub-Project / Phase",
      required: true,
      regex: "^PH(?:\\d{2}|\\d[A-Z]|XX|ZZ)$",
      maxLength: 4,
      codeTableKey: "phase",
      description: "Project phase. PHXX = no phase, PHZZ = all phases.",
    },
    {
      key: "element",
      label: "Element / System",
      required: true,
      regex: "^(?:\\d{2}|XX|ZZ)$",
      maxLength: 2,
      codeTableKey: "element",
      description: "CWMF Building/Site Element code. XX = none, ZZ = multiple.",
    },
    {
      key: "zone",
      label: "Spatial Zone",
      required: true,
      regex: "^[A-Z]$",
      maxLength: 1,
      description: "Single-letter zone code (A–Z). X = no associated zone, Z = all zones.",
    },
    {
      key: "level",
      label: "Level",
      required: true,
      regex: "^(?:[LMB]\\d{2}|DTM|XXX|ZZZ)$",
      maxLength: 3,
      codeTableKey: "level",
      description: "Floor / level code. L## for above-ground, M## for mezzanine, B## for basement.",
    },
    {
      key: "infoType",
      label: "Information Type",
      required: true,
      regex: "^[A-Z]{2}$",
      maxLength: 2,
      codeTableKey: "infoType",
      description: "Document type (DR drawing, RP report, SP specification, CE certificate, etc.).",
    },
    {
      key: "originator",
      label: "Originator",
      required: true,
      regex: "^[A-Z0-9]{2,5}$",
      minLength: 2,
      maxLength: 5,
      description: "Organisation code. Must be registered in the OriginatorRegistry before use.",
    },
    {
      key: "role",
      label: "Discipline / Role",
      required: true,
      regex: "^[A-Z]{2}$",
      maxLength: 2,
      codeTableKey: "discipline",
      description: "Discipline code (AR architect, SE structural, ME mechanical, etc.).",
    },
    {
      key: "number",
      label: "Sequential Number",
      required: true,
      regex: "^\\d{4,6}$",
      minLength: 4,
      maxLength: 6,
      description: "Sequential document number. For 5-digit numbers the first digit encodes document view type (1 plans, 2 elevations, 3 sections, 4 schedules, 5 details, 6 room data sheets, 7 RCP, 8 3D, 9 user-defined).",
    },
    {
      key: "title",
      label: "Title / Description",
      required: true,
      description: "Human-readable document title. No slashes or backslashes.",
    },
  ],

  codeTables: [
    { key: "phase", label: "Phase Codes", entries: PHASE_CODES },
    { key: "element", label: "Element Codes", entries: ELEMENT_CODES },
    { key: "level", label: "Level Codes", entries: LEVEL_CODES },
    { key: "infoType", label: "Information Type Codes", entries: INFO_TYPE_CODES },
    { key: "discipline", label: "Discipline / Role Codes", entries: DISCIPLINE_CODES },
    { key: "purpose", label: "Purpose Codes (metadata)", entries: PURPOSE_CODES },
    { key: "acceptance", label: "Acceptance Codes (metadata)", entries: ACCEPTANCE_CODES },
  ],
};

// ---------------------------------------------------------------------------
// ISO 19650-2 UK NA Convention — seeded as a minimal stub.
//
// The full UK NA code tables are not included in this seed (HSE NEIS is the
// pilot's authoritative convention). ISO 19650 is seeded here so the product
// can offer it at MVP (Decision D4) with a structurally correct convention
// record; code tables will be populated before the first non-HSE customer.
// ---------------------------------------------------------------------------
export const ISO_19650_CONVENTION = {
  key: "ISO-19650-2-UK",
  name: "ISO 19650-2 (UK NA) — Information Container Naming",
  version: "2018",
  description:
    "UK National Annex naming convention for information containers per ISO 19650-2:2018. " +
    "STUB: code tables to be populated before first non-HSE customer. Fields align with the NEIS structure minus HSE-specific additions.",
  sourceUrl: "https://www.ukbimalliance.org",
  fullPattern: "{project}-{originator}-{volume}-{level}-{type}-{role}-{classification}-{number}",
  minPattern: "{project}-{originator}-{type}-{role}-{number}",
  separator: "-",
  case: "preserve" as const,
  fields: [
    { key: "project", label: "Project Code", required: true, description: "Alphanumeric project reference." },
    { key: "originator", label: "Originator", required: true, description: "Organisation code." },
    { key: "volume", label: "Volume / System", required: false, description: "Volume or system reference." },
    { key: "level", label: "Level / Location", required: false, description: "Floor or location code." },
    { key: "type", label: "Type", required: true, description: "Information type." },
    { key: "role", label: "Role / Discipline", required: true, description: "Discipline code." },
    { key: "classification", label: "Classification", required: false, description: "Uniclass 2015 code (optional)." },
    { key: "number", label: "Number", required: true, description: "Sequential number." },
  ],
  codeTables: [], // populated before first non-HSE customer
};
