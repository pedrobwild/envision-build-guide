/**
 * FilaCard — cartão de "fila de trabalho" das homes.
 *
 * Redesign enterprise (Atlassian/Stripe):
 *   • Layout em zonas verticais: ícone + chip de prioridade · número
 *     grande · descrição curta · CTA de resolução.
 *   • Tipografia maior e mais legível: contagem 28px mono, label 13px.
 *   • Cor é só reforço — sempre acompanhada de chip textual.
 *   • Estado vazio = quase invisível (não rouba atenção).
 */

import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "./StatusChip";
import { cn } from "@/lib/utils";

export type FilaPriority = "critical" | "warning" | "info" | "ok";

interface FilaCardProps {
  icon: LucideIcon;
  label: string;
  count: number;
  description: string;
  priority?: FilaPriority;
  actionLabel?: string;
  onAction?: () => void;
  loading?: boolean;
}

const PRIORITY_TONE: Record<
  FilaPriority,
  {
    tone: "danger" | "warn" | "info" | "success";
    chip: string;
    rail: string;
    iconWrap: string;
    iconColor: string;
  }
> = {
  critical: {
    tone: "danger",
    chip: "Urgente",
    rail: "bg-danger",
    iconWrap: "bg-danger-bg border-danger-border",
    iconColor: "text-danger",
  },
  warning: {
    tone: "warn",
    chip: "Atenção",
    rail: "bg-warn",
    iconWrap: "bg-warn-bg border-warn-border",
    iconColor: "text-warn",
  },
  info: {
    tone: "info",
    chip: "A fazer",
    rail: "bg-info",
    iconWrap: "bg-info-bg border-info-border",
    iconColor: "text-info",
  },
  ok: {
    tone: "success",
    chip: "Em dia",
    rail: "bg-[hsl(var(--success))]",
    iconWrap: "bg-success-bg border-success-border",
    iconColor: "text-[hsl(var(--success))]",
  },
};

export function FilaCard({
  icon: Icon,
  label,
  count,
  description,
  priority = "info",
  actionLabel,
  onAction,
  loading,
}: FilaCardProps) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-hairline bg-surface-1 p-5 space-y-3 shadow-card">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-9 w-14" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  const empty = count === 0;
  const cfg = PRIORITY_TONE[empty ? "ok" : priority];

  return (
    <article
      className={cn(
        "group relative rounded-2xl border border-hairline bg-surface-1 p-5 shadow-card transition-all flex flex-col gap-4 overflow-hidden",
        !empty && "hover:border-hairline-strong hover:shadow-raised",
      )}
    >
      {/* Rail vertical de prioridade — reforço não-cromático */}
      <span
        className={cn(
          "absolute left-0 top-5 bottom-5 w-[3px] rounded-r-full",
          empty ? "bg-hairline" : cfg.rail,
        )}
        aria-hidden
      />

      <div className="flex items-start justify-between gap-2">
        <div
          className={cn(
            "h-9 w-9 rounded-lg flex items-center justify-center border",
            empty ? "bg-neutral-bg border-hairline" : cfg.iconWrap,
          )}
        >
          <Icon
            className={cn("h-[18px] w-[18px]", empty ? "text-ink-faint" : cfg.iconColor)}
            aria-hidden
          />
        </div>
        <StatusChip tone={empty ? "neutral" : cfg.tone} size="sm">
          {empty ? "Em dia" : cfg.chip}
        </StatusChip>
      </div>

      <div>
        <div
          className={cn(
            "font-mono font-semibold text-[28px] tabular-nums leading-none",
            empty ? "text-ink-faint" : "text-ink-strong",
          )}
        >
          {count}
        </div>
        <p className="text-[13px] font-semibold text-ink-strong font-body mt-2 leading-tight">
          {label}
        </p>
        <p className="text-[12px] text-ink-medium font-body leading-snug mt-1 line-clamp-2 min-h-[2.4em]">
          {description}
        </p>
      </div>

      {actionLabel && onAction && (
        <Button
          variant={empty ? "ghost" : "outline"}
          size="sm"
          onClick={onAction}
          disabled={empty}
          className="h-9 text-[12.5px] font-body justify-between gap-2 mt-auto whitespace-nowrap border-hairline hover:border-info hover:text-info"
        >
          <span className="truncate">{actionLabel}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
        </Button>
      )}
    </article>
  );
}
