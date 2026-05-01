/**
 * FilaCard — cartão de "fila de trabalho" para a home Comercial.
 *
 * Cada fila representa um conjunto de orçamentos que precisam de
 * uma ação concreta (não é um KPI). Exemplos:
 *   • Prontos para enviar
 *   • Enviados sem visualização > 48h
 *   • Esfriando (sem update)
 *   • Leads novos atribuídos
 *
 * Padrão de UX (god mode):
 *   • Hierarquia: contagem grande → label → próxima ação.
 *   • Cor codifica prioridade (não decora).
 *   • Botão direto para a ação que resolve a fila.
 */

import { ArrowRight, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

const PRIORITY_STYLES: Record<FilaPriority, { border: string; iconBg: string; iconText: string; dot: string }> = {
  critical: {
    border: "border-destructive/30 hover:border-destructive/50",
    iconBg: "bg-destructive/10",
    iconText: "text-destructive",
    dot: "bg-destructive",
  },
  warning: {
    border: "border-amber-500/30 hover:border-amber-500/50",
    iconBg: "bg-amber-500/10",
    iconText: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  info: {
    border: "border-primary/20 hover:border-primary/40",
    iconBg: "bg-primary/10",
    iconText: "text-primary",
    dot: "bg-primary",
  },
  ok: {
    border: "border-emerald-500/20 hover:border-emerald-500/40",
    iconBg: "bg-emerald-500/10",
    iconText: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
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
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const style = PRIORITY_STYLES[priority];
  const empty = count === 0;

  return (
    <div
      className={`rounded-xl border bg-card p-4 transition-all flex flex-col gap-3 ${
        empty ? "border-border/60 opacity-70" : style.border
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${empty ? "bg-muted" : style.iconBg}`}>
          <Icon className={`h-4 w-4 ${empty ? "text-muted-foreground" : style.iconText}`} />
        </div>
        {!empty && <div className={`h-1.5 w-1.5 rounded-full ${style.dot} mt-2.5`} />}
      </div>

      <div className="space-y-0.5">
        <div className="font-display text-2xl font-semibold tabular-nums font-mono leading-none">
          {count}
        </div>
        <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
          {label}
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground/80 font-body leading-snug line-clamp-2 min-h-[2rem]">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button
          variant={empty ? "ghost" : "secondary"}
          size="sm"
          onClick={onAction}
          disabled={empty}
          className="h-8 text-xs font-body justify-between gap-2 mt-auto whitespace-nowrap"
        >
          <span className="truncate">{actionLabel}</span>
          <ArrowRight className="h-3 w-3 shrink-0" />
        </Button>
      )}
    </div>
  );
}
