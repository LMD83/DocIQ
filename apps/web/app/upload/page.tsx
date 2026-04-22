"use client";

import { useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { DropZone } from "@/components/upload/drop-zone";
import { FileRow } from "@/components/upload/file-row";
import { BatchSummary } from "@/components/upload/batch-summary";
import { useUploadStore } from "@/lib/upload-store";
import { useKeyboardShortcut } from "@/hooks/use-keyboard-shortcut";

export default function UploadPage() {
  const files = useUploadStore((s) => s.files);
  const processing = useUploadStore((s) => s.processing);
  const startUpload = useUploadStore((s) => s.startUpload);

  // Group files by terminal state so completed batches collapse visually
  const groups = useMemo(() => {
    const active: typeof files = [];
    const done: typeof files = [];
    for (const f of files) {
      if (["filed", "review", "quarantine", "error"].includes(f.state)) {
        done.push(f);
      } else {
        active.push(f);
      }
    }
    return { active, done };
  }, [files]);

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  // ⌘O — open file picker
  useKeyboardShortcut({
    key: "o",
    meta: true,
    onTrigger: () => hiddenInputRef.current?.click(),
  });

  // Enter — start upload when there are idle files and nothing processing
  useKeyboardShortcut({
    key: "Enter",
    onTrigger: () => {
      if (processing) return;
      if (!files.some((f) => f.state === "idle")) return;
      void startUpload();
    },
  });

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (picked.length) useUploadStore.getState().addFiles(picked);
    e.target.value = "";
  };

  const empty = files.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8 pb-28">
      {/* Heading */}
      <div className="flex items-end justify-between pt-2">
        <div>
          <h1 className="text-[22px] font-medium tracking-tight">Upload</h1>
          <p className="mt-1 text-[13px] text-fg-muted">
            File documents to the HSE Dublin North East register. Every file is
            parsed, scored and routed in real time.
          </p>
        </div>
        {!empty && (
          <div className="text-[11.5px] text-fg-subtle">
            Convention: <span className="font-mono text-fg-muted">NEIS Rev 11</span>
          </div>
        )}
      </div>

      {/* Drop zone — hero when empty, compact strip once files are present */}
      {empty ? <DropZone /> : <DropZone compact />}

      {/* Active (processing or idle) */}
      {groups.active.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>
            {groups.active.some((f) => f.state !== "idle") ? "Processing" : "Ready"}
          </SectionLabel>
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {groups.active.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      {/* Terminal — filed/review/quarantine */}
      {groups.done.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>Completed</SectionLabel>
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {groups.done.map((f) => (
                <FileRow key={f.id} file={f} />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}

      <BatchSummary />

      {/* Hidden input for ⌘O */}
      <input
        ref={hiddenInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1 pt-2">
      <span className="text-[10.5px] font-medium uppercase tracking-[0.1em] text-fg-subtle">
        {children}
      </span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
