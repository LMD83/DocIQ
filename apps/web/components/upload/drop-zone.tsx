"use client";

import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, FolderOpen } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";
import { useUploadStore } from "@/lib/upload-store";
import { cn } from "@/lib/utils";

export function DropZone({ compact = false }: { compact?: boolean }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addFiles = useUploadStore((s) => s.addFiles);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) addFiles(files);
    },
    [addFiles],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      if (files.length) addFiles(files);
      e.target.value = "";
    },
    [addFiles],
  );

  if (compact) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "group flex items-center justify-between gap-4 rounded-card border border-dashed px-4 py-3 transition-all",
          dragging
            ? "border-accent bg-accent-subtle"
            : "border-line-strong bg-surface/40 hover:bg-surface/70 hover:border-line-strong",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-surface-elevated border border-line">
            <Upload className="h-4 w-4 text-fg-muted" />
          </div>
          <div>
            <div className="text-[12.5px] font-medium">Drop more files</div>
            <div className="text-[11px] text-fg-subtle">or click to browse</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[11.5px] text-fg-muted hover:text-fg hover:bg-surface-hover"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          Browse
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={onPick}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-card border-2 border-dashed px-10 py-16 transition-all duration-200",
        dragging
          ? "border-accent bg-accent-subtle accent-glow scale-[1.005]"
          : "border-line-strong bg-surface/30 hover:bg-surface/50 hover:border-line-strong",
      )}
    >
      <motion.div
        animate={{
          y: dragging ? -4 : 0,
          scale: dragging ? 1.04 : 1,
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="flex size-14 items-center justify-center rounded-2xl bg-surface-elevated border border-line mb-5"
      >
        <Upload className={cn("h-6 w-6 transition-colors", dragging ? "text-accent" : "text-fg-muted")} />
      </motion.div>

      <h2 className="text-[18px] font-medium tracking-tight text-balance text-center mb-1.5">
        Drop documents to file them to the HSE register
      </h2>
      <p className="text-[13px] text-fg-muted text-balance text-center max-w-md mb-6">
        Every file is parsed, content-extracted, credibility-scored and routed to
        the canonical folder in real time. Drag a whole folder if you like.
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-[13px] font-medium text-white shadow-[0_0_0_1px_rgba(79,140,255,0.3),0_4px_12px_rgba(79,140,255,0.2)] hover:bg-accent-hover transition-all"
        >
          <FolderOpen className="h-4 w-4" />
          Browse files
        </button>
        <div className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
          <span>or press</span>
          <Kbd>⌘</Kbd>
          <Kbd>O</Kbd>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4 text-[11px] text-fg-subtle">
        <span>Accepted: PDF · DOCX · XLSX · DWG · images · email</span>
        <span className="size-1 rounded-full bg-fg-dim" />
        <span>Max batch: 500 files · 2 GB</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={onPick}
      />
    </motion.div>
  );
}
