/**
 * MetaProgressBar — barra de progresso da meta com marker de ritmo.
 *
 * Renderiza:
 *   • Barra principal: progresso atual (ex.: receita fechada).
 *   • Marker (linha vertical): onde deveríamos estar pelo dia do
 *     mês (ritmo esperado para fechar no prazo).
 *   • Label numérica clara à direita.
 *
 * Cores: verde se acima do marker, âmbar se ligeiramente abaixo,
 * vermelho se muito abaixo.
 */

import { Skeleton } from "@/components/ui/skeleton";

interface MetaProgressBarProps {
  /** Valor atual atingido (ex.: R$ fechado no mês). */
  current: number;
  /** Meta total (ex.: meta do mês). */
  target: number;
  /** Marker — onde deveríamos estar (0..1). Default: dia atual / dias do mês. */
  paceMarker?: number;
  /** Label do progresso. */
  label?: string;
  /** Como formatar os valores (default: BRL). */
  format?: "currency" | "number";
  loading?: boolean;
}

function fmt(value: number, mode: "currency" | "number"): string {
  if (mode === "currency") {
    if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}k`;
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
  }
  return value.toLocaleString("pt-BR");
}

function defaultPaceMarker(): number {
  const now = new Date();
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(1, day / lastDay);
}

export function MetaProgressBar({
  current,
  target,
  paceMarker,
  label = "Meta do mês",
  format = "currency",
  loading,
}: MetaProgressBarProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    );
  }

  const pct = target > 0 ? Math.min(1, current / target) : 0;
  const pace = paceMarker ?? defaultPaceMarker();
  const onTrack = pct >= pace * 0.9; // tolerância de 10% abaixo do ritmo
  const wayBehind = pct < pace * 0.6;

  const fillColor = wayBehind
    ? "bg-destructive"
    : onTrack
    ? "bg-emerald-500"
    : "bg-amber-500";

  const fillGlow = wayBehind
    ? "shadow-[0_0_8px_rgba(239,68,68,0.3)]"
    : onTrack
    ? "shadow-[0_0_8px_rgba(16,185,129,0.25)]"
    : "shadow-[0_0_8px_rgba(245,158,11,0.25)]";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
          {label}
        </span>
        <div className="flex items-baseline gap-1.5 font-mono tabular-nums">
          <span className="text-sm font-semibold text-foreground">{fmt(current, format)}</span>
          <span className="text-[11px] text-muted-foreground/60">/ {fmt(target, format)}</span>
          <span
            className={`text-base font-bold ml-1.5 ${
              wayBehind ? "text-destructive" : onTrack ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {(pct * 100).toFixed(0)}%
          </span>
        </div>
      </div>
      <div className="relative h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${fillColor} ${fillGlow} transition-all duration-500`}
          style={{ width: `${pct * 100}%` }}
        />
        {/* Marker de ritmo */}
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/40"
          style={{ left: `${pace * 100}%` }}
          aria-label={`Ritmo esperado: ${(pace * 100).toFixed(0)}%`}
          title={`Ritmo do mês: ${(pace * 100).toFixed(0)}% (${onTrack ? "no ritmo" : "abaixo"})`}
        />
      </div>
      <p className="text-[10px] text-muted-foreground/60 font-body">
        {wayBehind
          ? `Muito abaixo do ritmo — ritmo esperado ${(pace * 100).toFixed(0)}%`
          : onTrack
          ? `No ritmo (esperado ${(pace * 100).toFixed(0)}%)`
          : `Pouco abaixo — ritmo esperado ${(pace * 100).toFixed(0)}%`}
      </p>
    </div>
  );
}
