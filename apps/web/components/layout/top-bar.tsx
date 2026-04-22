import Link from "next/link";
import { Kbd } from "@/components/ui/kbd";

export function TopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-base/80 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <Link href="/upload" className="flex items-center gap-2.5 group">
            <div className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-accent/90 text-white text-[11px] font-semibold shadow-[0_0_0_1px_rgba(79,140,255,0.3),0_2px_6px_rgba(79,140,255,0.2)] transition-transform group-hover:scale-[1.04]">
              DR
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] font-medium tracking-tight">DocRoute</span>
              <span className="text-[11px] text-fg-subtle">/ GovIQ</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1 text-[12.5px] text-fg-muted">
            <NavItem href="/upload" active>
              Upload
            </NavItem>
            <NavItem href="#" disabled>
              Review
            </NavItem>
            <NavItem href="#" disabled>
              Register
            </NavItem>
            <NavItem href="#" disabled>
              Sites
            </NavItem>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 rounded-pill border border-line bg-surface/50 px-2.5 py-1 text-[11.5px] text-fg-subtle">
            <span className="size-1.5 rounded-full bg-success animate-pulse-soft" />
            <span>NEIS01 · HSE Dublin NE</span>
          </div>

          <div className="flex items-center gap-1.5 text-[11.5px] text-fg-subtle">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavItem({
  href,
  children,
  active,
  disabled,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  const base =
    "px-2.5 py-1 rounded-md transition-colors";
  if (disabled) {
    return (
      <span className={`${base} text-fg-dim cursor-not-allowed`}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className={`${base} ${active ? "text-fg bg-surface/70" : "hover:text-fg hover:bg-surface/50"}`}
    >
      {children}
    </Link>
  );
}
