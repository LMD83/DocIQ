"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-all duration-150 select-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary:
          "bg-accent text-white shadow-[0_0_0_1px_rgba(79,140,255,0.3),0_4px_12px_rgba(79,140,255,0.2)] hover:bg-accent-hover hover:shadow-[0_0_0_1px_rgba(79,140,255,0.4),0_6px_16px_rgba(79,140,255,0.25)] active:scale-[0.98]",
        secondary:
          "bg-surface text-fg border border-line hover:bg-surface-hover hover:border-line-strong active:scale-[0.98]",
        ghost:
          "text-fg-muted hover:text-fg hover:bg-surface-hover",
        danger:
          "bg-danger/90 text-white hover:bg-danger active:scale-[0.98]",
      },
      size: {
        sm: "h-7 px-2.5",
        md: "h-8 px-3",
        lg: "h-10 px-4 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
