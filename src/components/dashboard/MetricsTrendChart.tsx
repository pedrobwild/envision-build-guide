import { useState } from "react";
import { TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useMetricsHistory } from "@/hooks/useMetricsHistory";
import { toast } from "sonner";

const METRICS = {
  health: { label: "Health Score", color: "hsl(var(--primary))", key: "health_score" as const, suffix: "" },
  sla: { label: "SLA no prazo (%)", color: "hsl(142 71% 45%)", key: "sla_on_time_pct" as const, suffix: "%" },
  backlog: { label: "Backlog ativo", color: "hsl(38 92% 50%)", key: "backlog_count" as const, suffix: "" },
  leadtime: { label: "Lead time (dias)", color: "hsl(280 70% 55%)", key: "avg_lead_time_days" as const, suffix: "d" },
  conversion: { label: "Conversão (%)", color: "hsl(199 89% 48%)", key: "conversion_rate_pct" as const, suffix: "%" },
  revenue: { label: "Receita (R$)", color: "hsl(160 60% 45%)", key: "revenue_brl" as const, suffix: "" },
};

type MetricKey = keyof typeof METRICS;

export function MetricsTrendChart() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metric, setMetric] = useState<MetricKey>("health");
  const [refreshKey, setRefreshKey] = useState(0);
  const [generating, setGenerating] = useState(false);
  const { data, loading, error, generateNow } = useMetricsHistory(days, refreshKey);

  const cfg = METRICS[metric];
  const chartData = data.map((s) => ({
    date: s.snapshot_date,
    value: s[cfg.key],
  }));

  const handleGenerate = async () => {
    setGenerating(true);
    const err = await generateNow();
    setGenerating(false);
    if (err) {
      toast.error(`Falha ao gerar snapshot: ${err}`);
    } else {
      toast.success("Snapshot do dia gerado");
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Tendência histórica
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Snapshots diários gerados automaticamente às 00:10 (BRT)
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={generating}
            className="gap-1.5"
          >
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Gerar agora
          </Button>
        </div>

        <div className="flex flex-wrap gap-3 items-center justify-between">
          <Tabs value={metric} onValueChange={(v) => setMetric(v as MetricKey)}>
            <TabsList className="h-8">
              {Object.entries(METRICS).map(([k, v]) => (
                <TabsTrigger key={k} value={k} className="text-xs h-7">{v.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 7 | 30 | 90)}>
            <TabsList className="h-8">
              <TabsTrigger value="7" className="text-xs h-7">7d</TabsTrigger>
              <TabsTrigger value="30" className="text-xs h-7">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs h-7">90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading && <Skeleton className="h-[260px] w-full" />}
        {error && <p className="text-sm text-destructive py-6 text-center">{error}</p>}

        {!loading && !error && data.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">Ainda não há snapshots salvos.</p>
            <p className="text-xs text-muted-foreground">
              Clique em <strong>Gerar agora</strong> para criar o primeiro, ou aguarde o cron diário.
            </p>
          </div>
        )}

        {!loading && !error && data.length > 0 && (
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(parseISO(d), "dd/MM", { locale: ptBR })}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  labelFormatter={(d) => format(parseISO(d as string), "dd 'de' MMM", { locale: ptBR })}
                  formatter={(v) => [`${v}${cfg.suffix}`, cfg.label]}
                />
                <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={cfg.label}
                  stroke={cfg.color}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
