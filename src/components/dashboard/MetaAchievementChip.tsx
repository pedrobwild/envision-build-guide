/**
 * MetaAchievementChip — chip compacto mostrando a % de atingimento
 * da meta do mês corrente. Usado ao lado da informação principal do
 * painel comercial.
 *
 * Reutiliza a mesma fonte de verdade do EditableMetaCard: tabela
 * commercial_targets (target + override opcional) + receita calculada
 * recebida via prop. Cores seguem a mesma semântica da MetaProgressBar.
 */

import { useQuery } from "@tanstack/react-query";
import { Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MetaAchievementChipProps {
  /** Receita fechada do mês calculada automaticamente. */
  computedRevenue: number;
  loading?: boolean;
  ownerId?: string | null;
  className?: string;
}

interface TargetRow {
  revenue_target_brl: number | null;
  revenue_override_brl: number | null;
}

const DEFAULT_TARGET = 250_000;

function monthStartISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function defaultPace(): number {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.min(1, now.getDate() / lastDay);
}

export function MetaAchievementChip({
  computedRevenue,
  loading,
  ownerId = null,
  className,
}: MetaAchievementChipProps) {
  const targetMonth = monthStartISO();
  const queryKey = ["commercial-target", ownerId ?? "global", targetMonth] as const;

  const { data: row, isLoading } = useQuery<TargetRow | null>({
    queryKey,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb = supabase as any;
      const q = sb
        .from("commercial_targets")
        .select("revenue_target_brl, revenue_override_brl")
        .eq("target_month", targetMonth)
        .limit(1)
        .maybeSingle();
      const { data, error } = ownerId
        ? await q.eq("owner_id", ownerId)
        : await q.is("owner_id", null);
      if (error) throw error;
      return (data ?? null) as TargetRow | null;
    },
    staleTime: 30_000,
  });

  if (loading || isLoading) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-muted/60 animate-pulse",
          className,
        )}
        aria-hidden
      >
        <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
        <span className="h-3 w-12 rounded bg-muted-foreground/30" />
      </div>
    );
  }

  const target = row?.revenue_target_brl ?? DEFAULT_TARGET;
  const override = row?.revenue_override_brl ?? null;
  const displayed = override ?? computedRevenue;
  const pctRaw = target > 0 ? displayed / target : 0;
  const pctRounded = Math.round(pctRaw * 100);
  const pace = defaultPace();
  const onTrack = pctRaw >= pace * 0.9;
  const overAchieved = pctRaw >= 1;
  const wayBehind = pctRaw < pace * 0.6;

  const tone = overAchieved
    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-500/30"
    : onTrack
    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 ring-emerald-500/25"
    : wayBehind
    ? "text-destructive bg-destructive/10 ring-destructive/30"
    : "text-amber-700 dark:text-amber-300 bg-amber-500/10 ring-amber-500/25";

  const dotTone = overAchieved || onTrack
    ? "bg-emerald-500"
    : wayBehind
    ? "bg-destructive"
    : "bg-amber-500";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 h-7 pl-1.5 pr-2.5 rounded-full ring-1 font-body",
        tone,
        className,
      )}
      title={`Meta do mês: ${pctRounded}% atingido${override !== null ? " (manual)" : ""}`}
      aria-label={`Atingimento da meta do mês: ${pctRounded}%`}
    >
      <span className="relative inline-flex items-center justify-center h-4 w-4 rounded-full bg-background/60">
        <Target className="h-2.5 w-2.5" aria-hidden />
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 h-1.5 w-1.5 rounded-full ring-1 ring-background",
            dotTone,
          )}
          aria-hidden
        />
      </span>
      <span className="text-[11.5px] font-semibold tabular-nums font-mono leading-none">
        {pctRounded}%
      </span>
      <span className="text-[10px] uppercase tracking-[0.08em] opacity-75 leading-none">
        meta
      </span>
    </div>
  );
}
