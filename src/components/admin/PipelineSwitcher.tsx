import { cn } from "@/lib/utils";
import { Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { DealPipeline } from "@/hooks/useDealPipelines";

interface PipelineSwitcherProps {
  pipelines: DealPipeline[];
  activeSlug: string | "all";
  onChange: (slug: string | "all") => void;
  counts?: Record<string, number>;
  loading?: boolean;
}

/**
 * Barra de tabs para alternar entre pipelines comerciais (Inbound / Indicação / Re-engajamento).
 * Usa cores customizadas por pipeline (campo `color`) com fallback para o token `primary`.
 */
export function PipelineSwitcher({
  pipelines,
  activeSlug,
  onChange,
  counts = {},
  loading = false,
}: PipelineSwitcherProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
    );
  }

  const totalAll = Object.values(counts).reduce((acc, n) => acc + n, 0);

  return (
    <div
      className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 overflow-x-auto scrollbar-none"
      role="tablist"
      aria-label="Pipelines comerciais"
    >
      <Tab
        active={activeSlug === "all"}
        onClick={() => onChange("all")}
        label="Todos"
        count={totalAll}
        icon={<Layers className="h-3.5 w-3.5" />}
      />
      {pipelines.map((p) => {
        const isActive = activeSlug === p.slug;
        return (
          <Tab
            key={p.id}
            active={isActive}
            onClick={() => onChange(p.slug)}
            label={p.name}
            count={counts[p.slug] ?? 0}
            color={p.color ?? undefined}
          />
        );
      })}
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
  count,
  icon,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  icon?: React.ReactNode;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-lg px-3 text-xs font-body font-medium whitespace-nowrap transition-all shrink-0",
        // Tap target confortável em mobile (≥40px), compacto em desktop.
        "h-10 sm:h-8",
        active
          ? "bg-card text-foreground shadow-sm ring-1 ring-border"
          : "text-muted-foreground hover:text-foreground hover:bg-card/60",
      )}
      style={
        active && color
          ? { boxShadow: `inset 0 -2px 0 ${color}` }
          : undefined
      }
    >
      {icon}
      <span>{label}</span>
      <span
        className={cn(
          "inline-flex items-center justify-center h-4 min-w-[18px] px-1 rounded-full text-[10px] font-bold tabular-nums",
          active ? "bg-muted text-foreground" : "bg-muted/70 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}
