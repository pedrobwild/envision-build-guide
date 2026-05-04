import { useEffect, useMemo, useState } from "react";
import { GitCompare, ArrowUpRight, ArrowDownRight, Minus, Loader2 } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

interface MetricDelta {
  key: string;
  value_a: number | null;
  value_b: number | null;
  delta: number | null;
  delta_pct: number | null;
}

interface ComparisonResult {
  date_a: string;
  date_b: string;
  health_diagnosis_a: string | null;
  health_diagnosis_b: string | null;
  metrics: MetricDelta[];
  error?: string;
}

const METRIC_LABELS: Record<string, string> = {
  received_count: "Recebidos",
  backlog_count: "Backlog",
  overdue_count: "Atrasados",
  closed_count: "Fechados",
  sla_on_time_pct: "SLA no prazo",
  avg_lead_time_days: "Lead time (dias)",
  conversion_rate_pct: "Conversão",
  revenue_brl: "Receita (R$)",
  portfolio_value_brl: "Pipeline (R$)",
  gross_margin_pct: "Margem bruta",
  health_score: "Health score",
  weekly_throughput: "Throughput semanal",
};

// "lower is better" metrics
const LOWER_BETTER = new Set(["overdue_count", "avg_lead_time_days", "backlog_count"]);

const fmtValue = (key: string, v: number | null) => {
  if (v == null) return "—";
  if (key.endsWith("_pct")) return `${v.toFixed(1)}%`;
  if (key.endsWith("_brl")) return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (key.endsWith("_days")) return `${v.toFixed(1)}d`;
  return Math.round(v).toString();
};

export function SnapshotComparisonPanel() {
  const today = new Date();
  const [dateA, setDateA] = useState(format(subDays(today, 7), "yyyy-MM-dd"));
  const [dateB, setDateB] = useState(format(today, "yyyy-MM-dd"));
  const [data, setData] = useState<ComparisonResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: result, error: err } = await supabase.rpc("compare_snapshots" as never, {
        p_date_a: dateA,
        p_date_b: dateB,
      } as never);
      if (cancelled) return;
      if (err) setError(err.message);
      else {
        const r = result as unknown as ComparisonResult;
        if (r?.error) setError("Snapshot não encontrado para uma das datas");
        else setData(r);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [dateA, dateB]);

  const metrics = useMemo(() => data?.metrics ?? [], [data]);

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="bg-primary/10 p-2.5 rounded-lg">
            <GitCompare className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-display font-semibold text-foreground">
              Comparar dois snapshots
            </h2>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Veja a evolução entre dois dias do histórico
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="date-a" className="text-xs">Data A (referência)</Label>
            <Input id="date-a" type="date" value={dateA} max={dateB} onChange={(e) => setDateA(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-b" className="text-xs">Data B (atual)</Label>
            <Input id="date-b" type="date" value={dateB} min={dateA} onChange={(e) => setDateB(e.target.value)} className="h-8 text-xs" />
          </div>
        </div>

        {loading && <Skeleton className="h-48 w-full" />}
        {error && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {error}. Tente outra data ou aguarde os snapshots diários.
          </p>
        )}

        {!loading && !error && metrics.length > 0 && (
          <div className="space-y-1.5">
            <div className="grid grid-cols-12 text-[10px] uppercase tracking-wider text-muted-foreground px-2">
              <div className="col-span-4">Métrica</div>
              <div className="col-span-3 text-right">{format(parseISO(dateA), "dd/MM", { locale: ptBR })}</div>
              <div className="col-span-3 text-right">{format(parseISO(dateB), "dd/MM", { locale: ptBR })}</div>
              <div className="col-span-2 text-right">Δ</div>
            </div>
            {metrics.map((m) => {
              const label = METRIC_LABELS[m.key] ?? m.key;
              const delta = m.delta ?? 0;
              const isImprovement = LOWER_BETTER.has(m.key) ? delta < 0 : delta > 0;
              const isFlat = delta === 0 || m.value_a == null || m.value_b == null;
              const Icon = isFlat ? Minus : isImprovement ? ArrowUpRight : ArrowDownRight;
              const color = isFlat ? "text-muted-foreground" : isImprovement ? "text-emerald-600 dark:text-emerald-400" : "text-destructive";
              return (
                <div key={m.key} className="grid grid-cols-12 items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-muted/40">
                  <div className="col-span-4 text-foreground truncate">{label}</div>
                  <div className="col-span-3 text-right text-muted-foreground tabular-nums">{fmtValue(m.key, m.value_a)}</div>
                  <div className="col-span-3 text-right text-foreground font-medium tabular-nums">{fmtValue(m.key, m.value_b)}</div>
                  <div className={`col-span-2 text-right tabular-nums flex items-center justify-end gap-0.5 ${color}`}>
                    <Icon className="h-3 w-3" />
                    <span>{m.delta_pct != null ? `${Math.abs(m.delta_pct).toFixed(1)}%` : "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
