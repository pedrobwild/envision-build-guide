import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import type { BacklogStatus } from "@/hooks/useDashboardMetrics";

const BAR_COLOR = "#0070F3";
const BAR_COLOR_MUTED = "#94a3b8";

interface BacklogChartProps {
  data: BacklogStatus[];
  loading?: boolean;
}

export function BacklogByStatusChart({ data, loading }: BacklogChartProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-36 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  const isEmpty = data.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-1">
        Backlog por etapa
      </h3>
      <p className="text-xs text-muted-foreground/70 font-body mb-4">
        Distribuição dos orçamentos em andamento
      </p>

      {isEmpty ? (
        <div className="h-[200px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground font-body">Nenhum item em backlog</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="label"
              width={110}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} orçamentos`, ""]}
              labelFormatter={() => ""}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
              {data.map((entry, i) => (
                <Cell
                  key={entry.status}
                  fill={entry.status === "in_progress" ? BAR_COLOR : BAR_COLOR_MUTED}
                  opacity={entry.status === "in_progress" ? 1 : 0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

interface FunnelData {
  received: number;
  published: number;
  closed: number;
}

export function SimpleFunnel({ data, loading }: { data: FunnelData; loading?: boolean }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-28 mb-4" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  const max = Math.max(data.received, 1);
  const stages = [
    { label: "Recebidos", value: data.received, color: "#94a3b8" },
    { label: "Publicados", value: data.published, color: "#0070F3" },
    { label: "Fechados", value: data.closed, color: "#10b981" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-1">
        Funil de conversão
      </h3>
      <p className="text-xs text-muted-foreground/70 font-body mb-5">
        Do recebimento ao contrato fechado
      </p>

      <div className="space-y-4">
        {stages.map((stage) => (
          <div key={stage.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-body text-foreground">{stage.label}</span>
              <span className="text-sm font-mono font-semibold tabular-nums text-foreground">{stage.value}</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${Math.max((stage.value / max) * 100, 2)}%`,
                  backgroundColor: stage.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
