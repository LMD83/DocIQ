import { CheckCircle2, AlertTriangle, CircleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ParsedFilename } from "@neis/index";

export function ValidationBadge({ parsed }: { parsed: ParsedFilename }) {
  if (parsed.patternMatched === "full") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3" />
        NEIS full
      </Badge>
    );
  }
  if (parsed.patternMatched === "min") {
    return (
      <Badge variant="accent">
        <CheckCircle2 className="h-3 w-3" />
        NEIS min
      </Badge>
    );
  }
  return (
    <Badge variant="warning">
      <AlertTriangle className="h-3 w-3" />
      Legacy
    </Badge>
  );
}

export function StateBadge({
  state,
}: {
  state:
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
}) {
  const map: Record<
    string,
    { label: string; variant: "neutral" | "accent" | "success" | "warning" | "danger"; pulse?: boolean }
  > = {
    idle:       { label: "ready",       variant: "neutral" },
    queued:     { label: "queued",      variant: "neutral", pulse: true },
    hashing:    { label: "hashing",     variant: "accent",  pulse: true },
    extracting: { label: "extracting",  variant: "accent",  pulse: true },
    scoring:    { label: "scoring",     variant: "accent",  pulse: true },
    routing:    { label: "routing",     variant: "accent",  pulse: true },
    filed:      { label: "filed",       variant: "success" },
    review:     { label: "review",      variant: "warning" },
    quarantine: { label: "quarantine",  variant: "danger" },
    error:      { label: "error",       variant: "danger" },
  };
  const cfg = map[state] ?? map.idle!;
  return (
    <Badge variant={cfg.variant}>
      {cfg.pulse && (
        <span className="relative flex size-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-current" />
          <span className="relative inline-flex rounded-full size-1.5 bg-current" />
        </span>
      )}
      {cfg.label}
    </Badge>
  );
}
