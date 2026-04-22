import { cn } from "@/lib/utils";

interface VersionBadgeProps {
  versionNumber?: number | null;
  isCurrent?: boolean | null;
  /** Compact = sem o rótulo "Atual/Substituída". */
  compact?: boolean;
  className?: string;
}

/**
 * Badge unificado de versão para Kanban e listas.
 * - V1 sozinho => não exibe nada (é a versão única).
 * - V≥2 atual => "V2 · Atual" (verde).
 * - V≥2 substituída => "V1 · Substituída" (cinza/strike).
 */
export function VersionBadge({ versionNumber, isCurrent, compact = false, className }: VersionBadgeProps) {
  const v = versionNumber ?? 1;
  if (v < 2) return null;

  const current = isCurrent !== false; // null/undefined tratamos como atual (compatibilidade)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-body font-semibold px-1.5 py-0.5 rounded-md ring-1",
        current
          ? "bg-success/10 text-success ring-success/25"
          : "bg-muted text-muted-foreground ring-border/60",
        className
      )}
      title={current ? `Versão ${v} — atual` : `Versão ${v} — substituída por uma versão mais recente`}
    >
      <span className={cn("font-mono tracking-tight", !current && "line-through opacity-70")}>
        V{v}
      </span>
      {!compact && (
        <span className="font-body uppercase tracking-wide text-[9px]">
          {current ? "Atual" : "Substituída"}
        </span>
      )}
    </span>
  );
}
