import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/formatBRL";
import type { MonthlyFinancial } from "@/hooks/useDashboardMetrics";

interface Props {
  data: MonthlyFinancial[];
  loading?: boolean;
}

export function RevenueChart({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-4 w-40 mb-4" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    );
  }

  const isEmpty = data.length === 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body mb-1">
        Evolução financeira
      </h3>
      <p className="text-xs text-muted-foreground/70 font-body mb-4">
        Receita, custo e lucro dos últimos meses
      </p>

      {isEmpty ? (
        <div className="h-[240px] flex items-center justify-center">
          <p className="text-xs text-muted-foreground font-body">Sem dados financeiros no período</p>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0070F3" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0070F3" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradProfit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                width={45}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [
                  formatBRL(value),
                  name === "revenue" ? "Receita" : name === "cost" ? "Custo" : "Lucro",
                ]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#0070F3"
                strokeWidth={2}
                fill="url(#gradRevenue)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#gradProfit)"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="cost"
                stroke="#94a3b8"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                fill="none"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>

          <div className="flex items-center gap-5 mt-3 pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#0070F3]" />
              <span className="text-[10px] text-muted-foreground font-body">Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
              <span className="text-[10px] text-muted-foreground font-body">Lucro</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-0.5 bg-[#94a3b8] rounded" style={{ borderTop: "1px dashed #94a3b8" }} />
              <span className="text-[10px] text-muted-foreground font-body">Custo</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
