import { useState } from "react";
import { Clock, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTimeInStage } from "@/hooks/useTimeInStage";

const STAGE_LABELS: Record<string, string> = {
  novo: "Novo",
  em_analise: "Em análise",
  aguardando_info: "Aguardando",
  em_revisao: "Em revisão",
  delivered_to_sales: "Entregue",
  published: "Publicado",
  minuta_solicitada: "Minuta",
  contrato_fechado: "Fechado",
  perdido: "Perdido",
  sent_to_client: "Enviado cliente",
};

const COLORS = ["hsl(var(--primary))", "hsl(280 70% 55%)", "hsl(38 92% 50%)", "hsl(199 89% 48%)", "hsl(142 71% 45%)", "hsl(0 70% 55%)"];

export function TimeInStageChart() {
  const [days, setDays] = useState<30 | 90 | 180>(90);
  const { data, loading, error } = useTimeInStage(days);

  const chartData = data
    .filter((d) => d.avg_days != null && d.sample_size >= 2)
    .map((d) => ({
      stage: STAGE_LABELS[d.stage] ?? d.stage,
      avg: Number(d.avg_days),
      median: Number(d.median_days),
      p90: Number(d.p90_days),
      n: d.sample_size,
    }));

  return (
    <Card className="border bg-card">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 p-2.5 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground">
                Tempo médio por etapa
              </h2>
              <p className="text-sm text-muted-foreground font-body mt-0.5">
                Quanto cada orçamento permanece em cada status (via eventos)
              </p>
            </div>
          </div>
          <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as 30 | 90 | 180)}>
            <TabsList className="h-8">
              <TabsTrigger value="30" className="text-xs h-7">30d</TabsTrigger>
              <TabsTrigger value="90" className="text-xs h-7">90d</TabsTrigger>
              <TabsTrigger value="180" className="text-xs h-7">180d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {loading && <Skeleton className="h-[260px] w-full" />}
        {error && <p className="text-sm text-destructive py-6 text-center">{error}</p>}

        {!loading && !error && chartData.length === 0 && (
          <div className="text-center py-8 space-y-1">
            <p className="text-sm text-muted-foreground">Sem dados suficientes no período.</p>
            <p className="text-xs text-muted-foreground">Eventos de mudança de status são necessários.</p>
          </div>
        )}

        {!loading && !error && chartData.length > 0 && (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} unit="d" />
                <YAxis dataKey="stage" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} width={110} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "0.5rem",
                    fontSize: "0.75rem",
                  }}
                  formatter={(v: number, name) => [`${v.toFixed(1)}d`, name === "avg" ? "Média" : name === "median" ? "Mediana" : "P90"]}
                  labelFormatter={(l) => `${l} (n=${chartData.find((d) => d.stage === l)?.n ?? 0})`}
                />
                <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
