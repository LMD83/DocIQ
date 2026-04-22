"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  ChevronRight,
  FileText,
  FileImage,
  FileSpreadsheet,
  File as FileIcon,
  Folder,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ValidationBadge, StateBadge } from "./validation-badge";
import { useUploadStore, type FileRecord, type PipelineEvent } from "@/lib/upload-store";
import { cn, formatBytes } from "@/lib/utils";

export function FileRow({ file }: { file: FileRecord }) {
  const [expanded, setExpanded] = useState(false);
  const removeFile = useUploadStore((s) => s.removeFile);

  const isProcessing = [
    "queued",
    "hashing",
    "extracting",
    "scoring",
    "routing",
  ].includes(file.state);
  const isTerminal = ["filed", "review", "quarantine", "error"].includes(file.state);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group rounded-card border bg-surface/60 transition-colors",
        file.state === "filed" && "border-success/20",
        file.state === "review" && "border-warning/20",
        file.state === "quarantine" && "border-danger/20",
        !isTerminal && "border-line hover:border-line-strong",
      )}
    >
      {/* Row head */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <FileTypeIcon mime={file.type} name={file.name} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate font-mono text-[12.5px] text-fg">{file.name}</div>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-fg-subtle">
            <span>{formatBytes(file.size)}</span>
            <span className="size-1 rounded-full bg-fg-dim" />
            <ValidationBadge parsed={file.parsed} />
            {file.parsed.patternMatched !== "none" && <FieldPreview file={file} />}
          </div>
        </div>

        <div className="flex items-center gap-3 pl-4">
          {isProcessing && <CredibilityPulse value={file.credibility} />}
          {isTerminal && <CredibilityScore value={file.credibility} />}
          <StateBadge state={file.state} />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              removeFile(file.id);
            }}
            className="text-fg-dim hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
          <ChevronRight
            className={cn(
              "h-4 w-4 text-fg-dim transition-transform",
              expanded && "rotate-90",
            )}
          />
        </div>
      </button>

      {/* Progress bar */}
      {(isProcessing || isTerminal) && (
        <div className="px-4">
          <div className="relative h-[2px] overflow-hidden rounded-full bg-surface-elevated">
            <motion.div
              className={cn(
                "absolute inset-y-0 left-0 rounded-full",
                file.state === "filed" && "bg-success",
                file.state === "review" && "bg-warning",
                file.state === "quarantine" && "bg-danger",
                !isTerminal && "bg-accent",
              )}
              initial={{ width: 0 }}
              animate={{ width: `${file.progress * 100}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
            {isProcessing && (
              <div className="absolute inset-0 shimmer-bg animate-shimmer opacity-60" />
            )}
          </div>
        </div>
      )}

      {/* Expanded pane — event log + extracted fields + destination */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line px-4 pt-3 pb-4 grid gap-4 md:grid-cols-[1fr_240px]">
              <EventLog events={file.events} />
              <SidePane file={file} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------

function FileTypeIcon({ mime, name }: { mime: string; name: string }) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const Icon = (() => {
    if (mime.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "heic", "tif", "tiff", "bmp"].includes(ext))
      return FileImage;
    if (["xlsx", "xls", "csv"].includes(ext)) return FileSpreadsheet;
    if (["pdf", "docx", "doc", "txt", "md", "rtf"].includes(ext)) return FileText;
    return FileIcon;
  })();
  return (
    <div className="flex size-8 flex-shrink-0 items-center justify-center rounded-md border border-line bg-surface-elevated">
      <Icon className="h-4 w-4 text-fg-muted" />
    </div>
  );
}

function FieldPreview({ file }: { file: FileRecord }) {
  const parsed = file.parsed;
  const parts: string[] = [];
  if (parsed.project) parts.push(parsed.project);
  if (parsed.phase) parts.push(parsed.phase);
  if (parsed.level) parts.push(parsed.level);
  if (parsed.infoType) parts.push(parsed.infoType);
  if (parsed.originator) parts.push(parsed.originator);
  if (parts.length === 0) return null;
  return (
    <span className="font-mono text-[10.5px] text-fg-subtle truncate">
      {parts.join(" · ")}
    </span>
  );
}

function CredibilityPulse({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
      <span className="text-fg-subtle">c</span>
      <span className="text-accent tabular-nums">{value.toFixed(2)}</span>
    </div>
  );
}

function CredibilityScore({ value }: { value: number }) {
  const tone = value >= 0.85 ? "text-success" : value >= 0.7 ? "text-warning" : "text-danger";
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
      <span className="text-fg-subtle">c</span>
      <span className={cn("tabular-nums font-medium", tone)}>{value.toFixed(2)}</span>
    </div>
  );
}

function EventLog({ events }: { events: PipelineEvent[] }) {
  return (
    <div>
      <div className="mb-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
        Pipeline
      </div>
      <ol className="space-y-1.5 font-mono text-[11.5px]">
        {events.map((e) => (
          <li key={e.id} className="flex items-start gap-2">
            <span className="mt-1 size-1 flex-shrink-0 rounded-full bg-fg-dim" />
            <span className="text-fg-subtle tabular-nums pr-1">
              {formatTs(e.t)}
            </span>
            <span
              className={cn(
                "text-fg-muted",
                e.tone === "success" && "text-success",
                e.tone === "warning" && "text-warning",
              )}
            >
              {e.message}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SidePane({ file }: { file: FileRecord }) {
  return (
    <div className="flex flex-col gap-3">
      {file.sha256 && (
        <Field label="SHA256">
          <span className="font-mono text-[10.5px] text-fg-muted truncate">
            {file.sha256.slice(0, 16)}…
          </span>
        </Field>
      )}
      {file.extractedFields.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
            Extracted
          </div>
          <div className="flex flex-wrap gap-1">
            {file.extractedFields.map((x) => (
              <Badge key={x.field} variant="mono">
                {x.field}: {x.value}
              </Badge>
            ))}
          </div>
        </div>
      )}
      {file.filedPath && (
        <Field label="Destination">
          <div className="flex items-start gap-1.5">
            <Folder className="mt-0.5 h-3 w-3 flex-shrink-0 text-fg-subtle" />
            <span className="font-mono text-[10.5px] text-fg leading-tight break-all">
              {file.filedPath}
            </span>
          </div>
        </Field>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-medium uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function formatTs(t: number): string {
  const d = new Date(t);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}
