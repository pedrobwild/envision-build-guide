/**
 * ConsistencyCheckDialog
 *
 * Roda em runtime as mesmas verificações cruzadas do
 * scripts/test-sales-kpis-as-admin.sql, porém usando os filtros globais
 * atualmente aplicados no dashboard. Apresenta cada checagem como uma
 * linha PASS/FAIL e destaca divergências numéricas para auditoria visual.
 *
 * Útil para confirmar — sem abrir terminal — que period/ownerId estão
 * propagando para todas as RPCs sem inconsistências.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  rangeToBounds,
  formatCurrencyBRL,
  formatPct,
  isAutoComparePreset,
  previousPeriod,
  type SalesPeriod,
} from "@/hooks/useSalesKpis";

// As RPCs não estão no tipo gerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

interface CheckResult {
  id: string;
  title: string;
  description: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  metrics?: Array<{ label: string; value: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: SalesPeriod;
  ownerId: string | null;
  ownerName?: string | null;
}

/** Compara dois números com tolerância de 1 centavo (revenue) ou 0 (counts). */
function eq(a: number, b: number, tolerance = 0): boolean {
  return Math.abs((a ?? 0) - (b ?? 0)) <= tolerance;
}

async function rpc<T>(name: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb.rpc(name, params);
  if (error) throw error;
  return (data ?? []) as T;
}

async function runChecks(
  period: SalesPeriod,
  ownerId: string | null,
): Promise<CheckResult[]> {
  const bounds = rangeToBounds(period);
  const start = bounds.start;
  const end = bounds.end;

  // Disparar em paralelo o que dá pra paralelizar
  const [
    dashFiltered,
    cohortsFiltered,
    byOwnerPeriod,
    segAll,
    segOwner,
    tisAll,
    tisOwner,
    lrAll,
    lrOwner,
    dashAllOwner,
  ] = await Promise.all([
    rpc<Record<string, number>>("sales_kpis_dashboard", {
      _start_date: start,
      _end_date: end,
      _owner_id: ownerId,
    }),
    rpc<Array<{ leads: number; deals_won: number; revenue_won: number }>>(
      "sales_kpis_cohorts",
      { _start_date: start, _end_date: end, _owner_id: ownerId },
    ),
    rpc<Array<{ owner_id: string | null; total_leads: number }>>(
      "sales_kpis_by_owner",
      { _start_date: start, _end_date: end },
    ),
    rpc<Array<{ total_leads: number }>>("sales_conversion_by_segment", {
      _dimension: "metragem",
      _start_date: start,
      _end_date: end,
      _owner_id: null,
    }),
    rpc<Array<{ total_leads: number }>>("sales_conversion_by_segment", {
      _dimension: "metragem",
      _start_date: start,
      _end_date: end,
      _owner_id: ownerId,
    }),
    rpc<Array<{ sample_size: number }>>("sales_kpis_time_in_stage", {
      _start_date: start,
      _end_date: end,
      _owner_id: null,
    }),
    rpc<Array<{ sample_size: number }>>("sales_kpis_time_in_stage", {
      _start_date: start,
      _end_date: end,
      _owner_id: ownerId,
    }),
    rpc<Array<{ qty: number }>>("sales_kpis_lost_reasons", {
      _start_date: start,
      _end_date: end,
      _owner_id: null,
    }),
    rpc<Array<{ qty: number }>>("sales_kpis_lost_reasons", {
      _start_date: start,
      _end_date: end,
      _owner_id: ownerId,
    }),
    // Dashboard sem owner para cross-check com by_owner
    rpc<Record<string, number>>("sales_kpis_dashboard", {
      _start_date: start,
      _end_date: end,
      _owner_id: null,
    }),
  ]);

  const dash = dashFiltered ?? {};
  const dashAll = dashAllOwner ?? {};
  const cohortLeads = (cohortsFiltered ?? []).reduce((s, r) => s + Number(r.leads ?? 0), 0);
  const cohortWon = (cohortsFiltered ?? []).reduce((s, r) => s + Number(r.deals_won ?? 0), 0);
  const cohortRevenue = (cohortsFiltered ?? []).reduce(
    (s, r) => s + Number(r.revenue_won ?? 0),
    0,
  );

  const byOwnerSumLeads = (byOwnerPeriod ?? []).reduce(
    (s, r) => s + Number(r.total_leads ?? 0),
    0,
  );
  const segAllLeads = (segAll ?? []).reduce((s, r) => s + Number(r.total_leads ?? 0), 0);
  const segOwnerLeads = (segOwner ?? []).reduce((s, r) => s + Number(r.total_leads ?? 0), 0);
  const tisAllSamples = (tisAll ?? []).reduce((s, r) => s + Number(r.sample_size ?? 0), 0);
  const tisOwnerSamples = (tisOwner ?? []).reduce((s, r) => s + Number(r.sample_size ?? 0), 0);
  const lrAllQty = (lrAll ?? []).reduce((s, r) => s + Number(r.qty ?? 0), 0);
  const lrOwnerQty = (lrOwner ?? []).reduce((s, r) => s + Number(r.qty ?? 0), 0);

  const dashLeads = Number(dash.total_leads ?? 0);
  const dashWon = Number(dash.deals_won ?? 0);
  const dashRevenue = Number(dash.revenue_won ?? 0);

  const checks: CheckResult[] = [];

  // A. Dashboard vs Cohorts (mesmo filtro)
  {
    const okLeads = eq(dashLeads, cohortLeads);
    const okWon = eq(dashWon, cohortWon);
    const okRev = eq(dashRevenue, cohortRevenue, 0.01);
    const ok = okLeads && okWon && okRev;
    checks.push({
      id: "dashboard_vs_cohorts",
      title: "Dashboard ↔ Coortes",
      description:
        "Os totais do KPI macro devem bater com a soma das coortes mensais para o mesmo filtro.",
      status: ok ? "pass" : "fail",
      detail: ok
        ? "Leads, ganhos e receita batem entre as duas RPCs."
        : "Há divergência entre dashboard e soma das coortes.",
      metrics: [
        { label: "Leads (dash / coortes)", value: `${dashLeads} / ${cohortLeads}` },
        { label: "Ganhos (dash / coortes)", value: `${dashWon} / ${cohortWon}` },
        {
          label: "Receita (dash / coortes)",
          value: `${formatCurrencyBRL(dashRevenue)} / ${formatCurrencyBRL(cohortRevenue)}`,
        },
      ],
    });
  }

  // B. Dashboard(sem owner) == Σ by_owner (mesmo período) — sempre roda
  {
    const dashAllLeads = Number(dashAll.total_leads ?? 0);
    const ok = eq(dashAllLeads, byOwnerSumLeads);
    checks.push({
      id: "dashboard_vs_by_owner",
      title: "Dashboard (todas as vendedoras) ↔ Σ tabela por vendedora",
      description:
        "Quando ignoramos o filtro de owner, o total do dashboard deve igualar a soma da tabela de vendedoras.",
      status: ok ? "pass" : "fail",
      detail: ok
        ? "Totais consistentes."
        : "Soma da tabela de vendedoras difere do dashboard sem filtro de owner.",
      metrics: [
        {
          label: "Leads (dash all / Σ owners)",
          value: `${dashAllLeads} / ${byOwnerSumLeads}`,
        },
      ],
    });
  }

  // C. Segment(owner) ≤ Segment(all)
  {
    const ok = segOwnerLeads <= segAllLeads;
    checks.push({
      id: "segment_owner_filter",
      title: "Segmento respeita filtro de vendedora",
      description:
        "Filtrar por uma vendedora específica nunca deve aumentar o total do bloco de segmentação.",
      status: ok ? "pass" : "fail",
      detail: ownerId
        ? ok
          ? "Subset coerente com o total."
          : "Owner produziu mais leads que o total — investigar RPC."
        : "Sem owner selecionado: comparando total contra ele mesmo (esperado igual).",
      metrics: [
        { label: "Leads (todas / owner)", value: `${segAllLeads} / ${segOwnerLeads}` },
      ],
    });
  }

  // D. time_in_stage e lost_reasons — owner ≤ total
  {
    const okTis = tisOwnerSamples <= tisAllSamples;
    const okLr = lrOwnerQty <= lrAllQty;
    const ok = okTis && okLr;
    checks.push({
      id: "time_and_lost_owner_filter",
      title: "Tempo em etapa e Motivos de perda respeitam owner",
      description:
        "Amostras filtradas por vendedora devem ser ≤ amostras totais do mesmo período.",
      status: ok ? "pass" : "fail",
      detail: ok
        ? "Amostras filtradas estão dentro do total."
        : "Amostra do owner excede o total — possível bug no predicado.",
      metrics: [
        {
          label: "Tempo em etapa (todas / owner)",
          value: `${tisAllSamples} / ${tisOwnerSamples}`,
        },
        {
          label: "Motivos de perda (todas / owner)",
          value: `${lrAllQty} / ${lrOwnerQty}`,
        },
      ],
    });
  }

  // E. Quando há owner selecionado, dashboard(filtrado).leads ≤ dashboard(all).leads
  if (ownerId) {
    const ok = dashLeads <= Number(dashAll.total_leads ?? 0);
    checks.push({
      id: "dashboard_subset",
      title: "Dashboard com owner é subconjunto do dashboard total",
      description:
        "Aplicar a vendedora não pode produzir mais leads do que ignorar o filtro.",
      status: ok ? "pass" : "fail",
      detail: ok ? "OK." : "Owner produziu mais leads que o total.",
      metrics: [
        {
          label: "Leads (owner / total)",
          value: `${dashLeads} / ${Number(dashAll.total_leads ?? 0)}`,
        },
      ],
    });
  }

  return checks;
}

export function ConsistencyCheckDialog({
  open,
  onOpenChange,
  period,
  ownerId,
  ownerName,
}: Props) {
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const t0 = performance.now();
      const r = await runChecks(period, ownerId);
      const ms = Math.round(performance.now() - t0);
      logger.debug(`[consistency-check] ran ${r.length} checks in ${ms}ms`);
      setResults(r);
      setLastRunAt(new Date());
    } catch (err) {
      logger.warn("[consistency-check] failed", err);
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível executar as checagens. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }, [period, ownerId]);

  // Auto-roda ao abrir
  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (next && !loading) {
      void run();
    }
    if (!next) {
      // limpa para não exibir resultado obsoleto na próxima abertura com outros filtros
      setResults(null);
      setError(null);
    }
  };

  const failCount = results?.filter((r) => r.status === "fail").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Comparar totais entre RPCs</DialogTitle>
          <DialogDescription>
            Roda checagens cruzadas usando os filtros globais aplicados (
            {period.range === "custom" ? "período personalizado" : period.range}
            {ownerId ? ` · ${ownerName ?? "vendedora"}` : " · todas as vendedoras"}).
            Divergências indicam inconsistência entre as RPCs do dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {loading && (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Falha ao executar
              </div>
              <p className="mt-1 text-xs">{error}</p>
            </div>
          )}

          {!loading && !error && results && (
            <>
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  failCount === 0
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-300",
                )}
              >
                <div className="flex items-center gap-2 font-medium">
                  {failCount === 0 ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> Todas as checagens passaram
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" /> {failCount} divergência(s)
                      detectada(s)
                    </>
                  )}
                </div>
                {lastRunAt && (
                  <p className="mt-0.5 text-xs opacity-80">
                    Executado em {lastRunAt.toLocaleTimeString("pt-BR")}
                  </p>
                )}
              </div>

              <ul className="space-y-2">
                {results.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-md border p-3",
                      r.status === "pass"
                        ? "border-border"
                        : "border-destructive/40 bg-destructive/5",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{r.title}</span>
                          <Badge
                            variant={r.status === "pass" ? "secondary" : "destructive"}
                            className="text-[10px] uppercase"
                          >
                            {r.status === "pass" ? "Pass" : "Fail"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.description}
                        </p>
                        <p className="mt-1 text-xs">{r.detail}</p>
                      </div>
                    </div>
                    {r.metrics && r.metrics.length > 0 && (
                      <dl className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                        {r.metrics.map((m) => (
                          <div key={m.label} className="flex items-baseline gap-2">
                            <dt className="text-muted-foreground">{m.label}:</dt>
                            <dd className="font-mono tabular-nums">{m.value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={() => void run()} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Executando…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> Rodar novamente
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
