import * as React from "react";
import { cn } from "@/lib/utils";

export function Kbd({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-[20px] items-center justify-center rounded-[5px] border border-line bg-surface/80 px-1 text-[10.5px] font-mono text-fg-muted shadow-[inset_0_-1px_0_rgba(0,0,0,0.4)]",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}
