/**
 * Renderiza ChartSpec[] em uma grid responsiva, escolhendo o componente
 * Recharts por type. Componente NÃO decide qual chart é melhor — recebe
 * `ChartSpec` já calculado pela camada de análise.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart as LineChartIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChartSpec } from "./types";

interface Props {
  charts: ChartSpec[] | null;
  loading?: boolean;
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(38 92% 50%)",
  "hsl(160 84% 39%)",
  "hsl(217 91% 60%)",
  "hsl(280 67% 60%)",
];

export function ChartRecommendationPanel({ charts, loading }: Props) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <LineChartIcon className="h-4 w-4 text-primary" />
            Visualizações sugeridas
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 w-full rounded-md" />
          ))}
        </CardContent>
      </Card>
    );
  }
  if (!charts || charts.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <LineChartIcon className="h-4 w-4 text-primary" />
            Visualizações sugeridas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sem visualizações sugeridas para este dataset.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <LineChartIcon className="h-4 w-4 text-primary" />
          Visualizações sugeridas
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {charts.map((c, i) => (
          <ChartFrame key={`${c.type}-${i}`} chart={c} />
        ))}
      </CardContent>
    </Card>
  );
}

function ChartFrame({ chart }: { chart: ChartSpec }) {
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <h4 className="text-xs font-semibold mb-2">{chart.title}</h4>
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart(chart)}
        </ResponsiveContainer>
      </div>
      {chart.rationale && (
        <p className="mt-2 text-[10px] text-muted-foreground">{chart.rationale}</p>
      )}
    </div>
  );
}

function renderChart(chart: ChartSpec): React.ReactElement {
  const { x, y } = chart.encoding;
  if (chart.type === "line" || chart.type === "area") {
    return (
      <LineChart data={chart.data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey={x} stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 11,
          }}
        />
        <Line type="monotone" dataKey={y ?? "value"} stroke={COLORS[0]} dot={false} strokeWidth={2} />
      </LineChart>
    );
  }
  if (chart.type === "horizontal_bar") {
    return (
      <BarChart data={chart.data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
        <YAxis type="category" dataKey={y ?? "value"} stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 11,
          }}
        />
        <Bar dataKey={x ?? "count"} radius={[0, 4, 4, 0]}>
          {chart.data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    );
  }
  if (chart.type === "pie") {
    return (
      <PieChart>
        <Pie
          data={chart.data}
          dataKey={y ?? "value"}
          nameKey={x ?? "name"}
          cx="50%"
          cy="50%"
          outerRadius={60}
          fill={COLORS[0]}
        >
          {chart.data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 6,
            fontSize: 11,
          }}
        />
      </PieChart>
    );
  }
  // bar, kpi, etc → fallback simples
  return (
    <BarChart data={chart.data}>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
      <XAxis dataKey={x ?? "key"} stroke="hsl(var(--muted-foreground))" fontSize={10} />
      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
      <Tooltip
        contentStyle={{
          background: "hsl(var(--popover))",
          border: "1px solid hsl(var(--border))",
          borderRadius: 6,
          fontSize: 11,
        }}
      />
      <Bar dataKey={y ?? "value"} radius={[4, 4, 0, 0]}>
        {chart.data.map((_, i) => (
          <Cell key={i} fill={COLORS[i % COLORS.length]} />
        ))}
      </Bar>
    </BarChart>
  );
}
