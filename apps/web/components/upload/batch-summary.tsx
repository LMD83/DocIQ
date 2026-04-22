"use client";

import { motion } from "framer-motion";
import { Play, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { useUploadStore } from "@/lib/upload-store";
import { formatBytes } from "@/lib/utils";

export function BatchSummary() {
  const files = useUploadStore((s) => s.files);
  const processing = useUploadStore((s) => s.processing);
  const startUpload = useUploadStore((s) => s.startUpload);
  const clearAll = useUploadStore((s) => s.clearAll);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const nFull = files.filter((f) => f.parsed.patternMatched === "full").length;
  const nMin = files.filter((f) => f.parsed.patternMatched === "min").length;
  const nLegacy = files.filter((f) => f.parsed.patternMatched === "none").length;
  const nPending = files.filter((f) => f.state === "idle" || f.state === "queued").length;
  const nFiled = files.filter((f) => f.state === "filed").length;
  const nReview = files.filter((f) => f.state === "review").length;
  const nQuarantine = files.filter((f) => f.state === "quarantine").length;

  if (files.length === 0) return null;

  const allDone =
    !processing && files.every((f) => ["filed", "review", "quarantine", "error"].includes(f.state));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className="glass sticky bottom-5 z-30 flex items-center gap-4 rounded-card px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.4)]"
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <Stat label="files" value={files.length.toString()} accent />
        <Divider />
        <Stat label="size" value={formatBytes(totalSize)} />
        <Divider />
        <div className="hidden md:flex items-center gap-3 text-[11.5px]">
          <StatInline label="NEIS full" value={nFull} tone="success" />
          <StatInline label="min" value={nMin} tone="accent" />
          <StatInline label="legacy" value={nLegacy} tone="warning" />
        </div>
        {(nFiled > 0 || nReview > 0 || nQuarantine > 0) && (
          <>
            <Divider />
            <div className="hidden lg:flex items-center gap-3 text-[11.5px]">
              <StatInline label="filed" value={nFiled} tone="success" />
              <StatInline label="review" value={nReview} tone="warning" />
              <StatInline label="quarantine" value={nQuarantine} tone="danger" />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        {!processing && !allDone && (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              aria-label="Clear all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void startUpload()}
              disabled={nPending === 0}
            >
              <Play className="h-3.5 w-3.5" />
              File {nPending} file{nPending === 1 ? "" : "s"}
              <span className="ml-1 text-[11px] opacity-70 hidden sm:flex items-center gap-1">
                <Kbd className="bg-white/10 border-white/20 text-white/80">⏎</Kbd>
              </span>
            </Button>
          </>
        )}
        {processing && (
          <div className="flex items-center gap-2 text-[12.5px] text-fg-muted">
            <span className="relative flex size-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
              <span className="relative inline-flex rounded-full size-2 bg-accent" />
            </span>
            Processing …
          </div>
        )}
        {allDone && (
          <div className="flex items-center gap-2 text-[12.5px] text-success">
            <CheckCircle2 className="h-4 w-4" />
            Batch complete
            <Button
              variant="secondary"
              size="sm"
              onClick={clearAll}
              className="ml-2"
            >
              New batch
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={accent ? "text-[15px] font-medium tabular-nums text-fg" : "text-[13px] font-medium tabular-nums text-fg-muted"}>
        {value}
      </span>
      <span className="text-[11px] text-fg-subtle uppercase tracking-[0.08em]">{label}</span>
    </div>
  );
}

function StatInline({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "accent" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success" ? "text-success" : tone === "accent" ? "text-accent" : tone === "warning" ? "text-warning" : "text-danger";
  return (
    <div className="flex items-baseline gap-1">
      <span className={`${toneClass} tabular-nums font-medium`}>{value}</span>
      <span className="text-fg-subtle">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="h-4 w-px bg-line" />;
}
