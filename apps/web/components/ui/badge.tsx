import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-[11px] font-medium tracking-tight leading-none",
  {
    variants: {
      variant: {
        neutral:
          "border-line bg-surface text-fg-muted",
        accent:
          "border-accent/30 bg-accent-subtle text-accent",
        success:
          "border-success/30 bg-success-subtle text-success",
        warning:
          "border-warning/30 bg-warning-subtle text-warning",
        danger:
          "border-danger/30 bg-danger-subtle text-danger",
        mono:
          "border-line bg-surface text-fg font-mono text-[10.5px] tracking-normal",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, className }))} {...props} />;
}
