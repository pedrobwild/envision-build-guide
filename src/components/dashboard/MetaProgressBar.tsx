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
  const pctRaw = target > 0 ? current / target : 0;
  const pace = paceMarker ?? defaultPaceMarker();
  const onTrack = pct >= pace * 0.9; // tolerância de 10% abaixo do ritmo
  const wayBehind = pct < pace * 0.6;
  const overAchieved = pctRaw >= 1;

  const status: "over" | "on" | "behind" | "way" = overAchieved
    ? "over"
    : wayBehind
    ? "way"
    : onTrack
    ? "on"
    : "behind";

  const fillGradient = {
    over: "bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400",
    on: "bg-gradient-to-r from-emerald-500 to-emerald-400",
    behind: "bg-gradient-to-r from-amber-500 to-amber-400",
    way: "bg-gradient-to-r from-rose-600 to-destructive",
  }[status];

  const fillGlow = {
    over: "shadow-[0_0_14px_rgba(16,185,129,0.45)]",
    on: "shadow-[0_0_10px_rgba(16,185,129,0.3)]",
    behind: "shadow-[0_0_10px_rgba(245,158,11,0.3)]",
    way: "shadow-[0_0_10px_rgba(239,68,68,0.35)]",
  }[status];

  const pctTone = {
    over: "text-emerald-600 dark:text-emerald-400",
    on: "text-emerald-600 dark:text-emerald-400",
    behind: "text-amber-600 dark:text-amber-400",
    way: "text-destructive",
  }[status];

  const statusDot = {
    over: "bg-emerald-500",
    on: "bg-emerald-500",
    behind: "bg-amber-500",
    way: "bg-destructive",
  }[status];

  const statusLabel = {
    over: "Meta batida",
    on: "No ritmo",
    behind: "Pouco abaixo do ritmo",
    way: "Muito abaixo do ritmo",
  }[status];

  return (
    <div className="space-y-2.5">
      {/* Header: % grande à esquerda + valores à direita */}
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className={`text-3xl font-bold leading-none tabular-nums font-mono ${pctTone}`}>
            {(pctRaw * 100).toFixed(0)}%
          </span>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground font-body truncate">
            {label}
          </span>
        </div>
        <div className="flex flex-col items-end gap-0.5 font-mono tabular-nums shrink-0">
          <span className="text-base sm:text-lg font-semibold text-foreground leading-none">
            {fmt(current, format)}
          </span>
          <span className="text-[13px] font-semibold text-muted-foreground leading-none">
            de {fmt(target, format)}
          </span>
        </div>
      </div>

      {/* Barra */}
      <div
        className="relative h-3 w-full rounded-full bg-muted/70 overflow-hidden ring-1 ring-border/40"
        role="progressbar"
        aria-valuenow={Math.round(pctRaw * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${(pctRaw * 100).toFixed(0)}% atingido`}
      >
        {/* Trilha sutil com listras quando 0% */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${fillGradient} ${fillGlow} transition-[width] duration-700 ease-out`}
          style={{ width: `${pct * 100}%` }}
        >
          {/* Brilho interno */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent pointer-events-none" />
        </div>

        {/* Marker de ritmo */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-foreground/60"
          style={{ left: `calc(${pace * 100}% - 1px)` }}
          aria-hidden
        />
        <div
          className="absolute -top-1 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-foreground/70 ring-2 ring-background"
          style={{ left: `${pace * 100}%` }}
          title={`Ritmo esperado: ${(pace * 100).toFixed(0)}%`}
          aria-hidden
        />
      </div>

      {/* Legenda */}
      <div className="flex items-center justify-between gap-2 text-[11px] font-body">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${statusDot}`} aria-hidden />
          <span className={`font-medium ${pctTone} truncate`}>{statusLabel}</span>
        </div>
        <span className="text-muted-foreground/70 tabular-nums shrink-0">
          ritmo esperado {(pace * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}
