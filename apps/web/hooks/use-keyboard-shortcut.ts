"use client";

import { useEffect } from "react";

interface Opts {
  key: string;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  onTrigger: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcut({
  key,
  meta = false,
  alt = false,
  shift = false,
  onTrigger,
  enabled = true,
}: Opts) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      // Don't fire if focus is in an input/textarea/contenteditable
      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const metaOrCtrl = e.metaKey || e.ctrlKey;
      if (meta && !metaOrCtrl) return;
      if (!meta && metaOrCtrl) return;
      if (alt !== e.altKey) return;
      if (shift !== e.shiftKey) return;
      if (e.key.toLowerCase() !== key.toLowerCase()) return;
      e.preventDefault();
      onTrigger();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [key, meta, alt, shift, onTrigger, enabled]);
}
