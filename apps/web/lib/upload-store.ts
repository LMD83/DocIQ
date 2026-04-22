"use client";

import { create } from "zustand";
import { parseFilename, type ParsedFilename } from "@neis/index";

/**
 * Upload store — per-file state machine + rolling event log.
 *
 * The pipeline in production (DocRoute ingest action) is:
 *   queued → hashing → extracting → scoring → routing → filed/review/quarantine
 *
 * Here we simulate each stage with realistic timing and deterministic-looking
 * signals so users see the work happening in real time rather than a
 * black-box spinner. The NEIS parse is REAL (runs the actual TS parser from
 * convex/docroute/neis), so the classification view is genuine.
 */

export type FileState =
  | "idle"
  | "queued"
  | "hashing"
  | "extracting"
  | "scoring"
  | "routing"
  | "filed"
  | "review"
  | "quarantine"
  | "error";

export type EventKind =
  | "parse"
  | "hash"
  | "dedupe"
  | "extract"
  | "score"
  | "route"
  | "filed"
  | "error";

export interface PipelineEvent {
  id: string;
  t: number;
  kind: EventKind;
  message: string;
  tone?: "info" | "success" | "warning";
}

export interface ExtractedField {
  field: string;
  value: string;
  confidence: number;
}

export interface FileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  parsed: ParsedFilename;
  state: FileState;
  progress: number; // 0..1
  credibility: number; // 0..1, ticks up during scoring
  credibilityTarget: number; // final target score
  events: PipelineEvent[];
  extractedFields: ExtractedField[];
  sha256?: string;
  route?: "publish" | "review" | "quarantine";
  filedPath?: string;
  error?: string;
}

interface UploadState {
  files: FileRecord[];
  processing: boolean;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearAll: () => void;
  startUpload: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Deterministic "fake but plausible" extraction samples
// ---------------------------------------------------------------------------

const SAMPLE_CERTIFIERS = [
  "John Murphy FSE",
  "Factfire Ltd",
  "RH Building Consultants",
  "OHSS Risk Services",
  "Barry O'Connor CEng",
];
const SAMPLE_AUTHOR_FIRMS = [
  "Henry J Lyons Architects",
  "Arup Engineering",
  "Jacobs Ireland",
  "Kavanagh Tuite",
  "DBFL Consulting Engineers",
];
const SAMPLE_REGS = ["Part B", "Part M", "HIQA Reg 17", "BCAR", "Section 5"];
const SAMPLE_DAC = ["DAC/2021/457", "DAC-2019-88", "DAC/2022/104"];
const SAMPLE_BCAR = ["BCAR/2020/1132", "BCAR-7/18/0098"];
const SAMPLE_FSC = ["FSC/2019/412", "FSC-2021-0088"];

function seededIndex(seed: number, length: number): number {
  return Math.abs(seed) % length;
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return h;
}

// ---------------------------------------------------------------------------
// Pipeline simulator
// ---------------------------------------------------------------------------

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pushEvent(
  set: (fn: (s: UploadState) => Partial<UploadState>) => void,
  fileId: string,
  kind: EventKind,
  message: string,
  tone: PipelineEvent["tone"] = "info",
) {
  set((s) => ({
    files: s.files.map((f) =>
      f.id === fileId
        ? {
            ...f,
            events: [
              ...f.events,
              { id: genId(), t: Date.now(), kind, message, tone },
            ],
          }
        : f,
    ),
  }));
}

function patch(
  set: (fn: (s: UploadState) => Partial<UploadState>) => void,
  fileId: string,
  updates: Partial<FileRecord>,
) {
  set((s) => ({
    files: s.files.map((f) => (f.id === fileId ? { ...f, ...updates } : f)),
  }));
}

async function runPipeline(
  set: (fn: (s: UploadState) => Partial<UploadState>) => void,
  get: () => UploadState,
  fileId: string,
) {
  const initial = get().files.find((f) => f.id === fileId);
  if (!initial) return;

  const seed = hashString(initial.name);

  // --- Stage: hashing -----------------------------------------------------
  patch(set, fileId, { state: "hashing", progress: 0.1 });
  pushEvent(set, fileId, "hash", "Computing SHA256 …");
  await delay(320 + (Math.abs(seed) % 200));
  const fakeSha = (Math.abs(seed) >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
  patch(set, fileId, { sha256: fakeSha, progress: 0.2 });
  pushEvent(set, fileId, "hash", `SHA256 ${fakeSha.slice(0, 12)}…`, "info");
  pushEvent(set, fileId, "dedupe", "No duplicate in register", "info");

  // --- Stage: extracting --------------------------------------------------
  patch(set, fileId, { state: "extracting", progress: 0.32 });
  pushEvent(set, fileId, "extract", "Extracting text from document …");
  await delay(420);

  const extractedFields: ExtractedField[] = [];
  const current = get().files.find((f) => f.id === fileId);
  if (!current) return;

  // NEIS parse already seeded the fields; echo the top ones as extraction events
  if (current.parsed.project) {
    extractedFields.push({ field: "project", value: current.parsed.project, confidence: 0.95 });
    pushEvent(set, fileId, "extract", `Project: ${current.parsed.project}`, "success");
    await delay(140);
  }
  if (current.parsed.originator) {
    extractedFields.push({ field: "originator", value: current.parsed.originator, confidence: 0.95 });
    pushEvent(set, fileId, "extract", `Originator: ${current.parsed.originator}`, "success");
    await delay(120);
  }

  // Fake but plausible content signals, deterministic from the filename
  const authorFirm = SAMPLE_AUTHOR_FIRMS[seededIndex(seed, SAMPLE_AUTHOR_FIRMS.length)]!;
  extractedFields.push({ field: "author_firm", value: authorFirm, confidence: 0.82 });
  pushEvent(set, fileId, "extract", `Author firm: ${authorFirm}`, "success");
  await delay(180);

  const hasCompliance = Math.abs(seed) % 3 === 0;
  if (hasCompliance) {
    const certifier = SAMPLE_CERTIFIERS[seededIndex(seed * 7, SAMPLE_CERTIFIERS.length)]!;
    extractedFields.push({ field: "certifier", value: certifier, confidence: 0.78 });
    pushEvent(set, fileId, "extract", `Certifier: ${certifier}`, "success");
    await delay(160);

    const certType = ["dac", "bcar", "fsc"][seededIndex(seed * 3, 3)]!;
    const certNum =
      certType === "dac"
        ? SAMPLE_DAC[seededIndex(seed * 5, SAMPLE_DAC.length)]!
        : certType === "bcar"
          ? SAMPLE_BCAR[seededIndex(seed * 5, SAMPLE_BCAR.length)]!
          : SAMPLE_FSC[seededIndex(seed * 5, SAMPLE_FSC.length)]!;
    extractedFields.push({ field: `${certType}_number`, value: certNum, confidence: 0.9 });
    pushEvent(set, fileId, "extract", `${certType.toUpperCase()} number detected: ${certNum}`, "success");
    await delay(150);
  }

  const regRefs = [SAMPLE_REGS[seededIndex(seed * 11, SAMPLE_REGS.length)]!];
  extractedFields.push({ field: "regulatory_references", value: regRefs.join(", "), confidence: 0.7 });
  pushEvent(set, fileId, "extract", `Regulatory reference: ${regRefs[0]}`, "info");

  patch(set, fileId, { extractedFields, progress: 0.6 });

  // --- Stage: scoring -----------------------------------------------------
  patch(set, fileId, { state: "scoring", progress: 0.7 });
  pushEvent(set, fileId, "score", "Running credibility model …");

  // Compute target based on NEIS match + fake content evidence
  let target = 0;
  if (current.parsed.patternMatched === "full") target = 0.92;
  else if (current.parsed.patternMatched === "min") target = 0.83;
  else target = 0.58 + (Math.abs(seed) % 20) / 100; // 0.58–0.78 range

  // Boost if compliance signals present
  if (hasCompliance) target += 0.05;
  target = Math.min(0.99, target);

  patch(set, fileId, { credibilityTarget: target });
  pushEvent(set, fileId, "score", `Identity: ${(target * 0.4).toFixed(2)}`, "info");
  await delay(180);
  pushEvent(set, fileId, "score", `Classification: ${(target * 0.3).toFixed(2)}`, "info");
  await delay(140);
  pushEvent(set, fileId, "score", `Temporal + Parties: ${(target * 0.3).toFixed(2)}`, "info");
  await delay(180);

  // Tick the credibility score up smoothly
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // Ease-out cubic for a nice settle
    const eased = 1 - Math.pow(1 - t, 3);
    patch(set, fileId, {
      credibility: target * eased,
      progress: 0.7 + 0.2 * t,
    });
    await delay(22);
  }

  pushEvent(set, fileId, "score", `Licence: valid (no penalty)`, "info");
  pushEvent(set, fileId, "score", `Final credibility ${target.toFixed(2)}`, "success");

  // --- Stage: routing -----------------------------------------------------
  patch(set, fileId, { state: "routing", progress: 0.95 });
  await delay(220);
  const route: "publish" | "review" | "quarantine" =
    target >= 0.85 ? "publish" : target >= 0.7 ? "review" : "quarantine";

  const targetSub = deriveTargetFolder(current.parsed, extractedFields);
  const siteCode = current.parsed.originator === "HSE" ? "DN0574-Seaview" : "DN0081-Corduff";
  const filedPath =
    route === "publish"
      ? `01-Sites/${siteCode}/${targetSub}/${current.name}`
      : route === "review"
        ? `_Review/${siteCode}/${targetSub}/${current.name}`
        : `99-Quarantine/${current.name}`;

  pushEvent(
    set,
    fileId,
    "route",
    route === "publish"
      ? `Routed to publish → ${targetSub}`
      : route === "review"
        ? `Routed to review queue (credibility ${target.toFixed(2)})`
        : `Quarantined — below threshold`,
    route === "publish" ? "success" : route === "review" ? "warning" : "warning",
  );
  await delay(120);

  // --- Terminal state -----------------------------------------------------
  const terminal: FileState = route === "publish" ? "filed" : route;
  patch(set, fileId, {
    state: terminal,
    progress: 1,
    credibility: target,
    route,
    filedPath,
  });
  pushEvent(set, fileId, "filed", filedPath, "success");
}

function deriveTargetFolder(
  parsed: ParsedFilename,
  extracted: ExtractedField[],
): string {
  // Let extracted compliance hints win
  if (extracted.some((f) => f.field === "dac_number")) return "30-Compliance/DAC";
  if (extracted.some((f) => f.field === "bcar_number")) return "30-Compliance/BCAR";
  if (extracted.some((f) => f.field === "fsc_number")) return "30-Compliance/FSC";

  // Fall back to NEIS infoType
  switch (parsed.infoType) {
    case "DR":
      return "10-RecordDrawings";
    case "SP":
      return "10-RecordDrawings/Specifications";
    case "SH":
      return "10-RecordDrawings/Schedules";
    case "RP":
      return "40-Surveys";
    case "MA":
      return "20-OMManuals";
    case "CE":
      return "30-Compliance";
    default:
      return "00-Passport";
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUploadStore = create<UploadState>((set, get) => ({
  files: [],
  processing: false,

  addFiles: (incoming) => {
    const existingNames = new Set(get().files.map((f) => f.name));
    const toAdd: FileRecord[] = [];
    for (const file of incoming) {
      if (existingNames.has(file.name)) continue; // de-dupe on filename within the batch
      const parsed = parseFilename(file.name);
      toAdd.push({
        id: genId(),
        name: file.name,
        size: file.size,
        type: file.type || "application/octet-stream",
        parsed,
        state: "idle",
        progress: 0,
        credibility: 0,
        credibilityTarget: 0,
        events: [
          {
            id: genId(),
            t: Date.now(),
            kind: "parse",
            message:
              parsed.patternMatched === "full"
                ? "NEIS full pattern matched — all fields recognised"
                : parsed.patternMatched === "min"
                  ? "NEIS minimum pattern matched — missing phase/element/zone"
                  : "Legacy filename — will route via content extraction",
            tone:
              parsed.patternMatched === "full"
                ? "success"
                : parsed.patternMatched === "min"
                  ? "info"
                  : "warning",
          },
        ],
        extractedFields: [],
      });
    }
    if (toAdd.length === 0) return;
    set((s) => ({ files: [...toAdd, ...s.files] }));
  },

  removeFile: (id) =>
    set((s) => ({ files: s.files.filter((f) => f.id !== id) })),

  clearAll: () => set({ files: [] }),

  startUpload: async () => {
    const pending = get().files.filter((f) => f.state === "idle");
    if (pending.length === 0) return;
    set({ processing: true });

    // Mark all as queued up-front so the UI shows the whole batch moving
    set((s) => ({
      files: s.files.map((f) =>
        f.state === "idle" ? { ...f, state: "queued" as const } : f,
      ),
    }));

    // Process with a small concurrency to feel alive but not chaotic
    const concurrency = 3;
    const queue = [...pending];
    const workers: Promise<void>[] = [];
    const next = async () => {
      const item = queue.shift();
      if (!item) return;
      await runPipeline(set, get, item.id);
      await next();
    };
    for (let i = 0; i < concurrency; i++) workers.push(next());
    await Promise.all(workers);

    set({ processing: false });
  },
}));
