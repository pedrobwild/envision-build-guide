import { useState } from "react";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Funnel,
  FunnelChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import type { Insight, InsightSeverity, VisualizationHint } from "@/lib/ai-data";
import { formatBRL } from "@/lib/formatBRL";

interface Props {
  insight: Insight;
  onAction?: (insight: Insight) => void;
}

const SEVERITY_CONFIG: Record<InsightSeverity, { label: string; cls: string; icon: typeof Info; tone: string }> = {
  critical: { label: "Crítico", cls: "border-destructive/30 bg-destructive/[0.05]", icon: AlertTriangle, tone: "text-destructive" },
  high: { label: "Alto", cls: "border-orange-500/30 bg-orange-500/[0.05]", icon: AlertCircle, tone: "text-orange-600 dark:text-orange-400" },
  medium: { label: "Médio", cls: "border-amber-500/30 bg-amber-500/[0.05]", icon: AlertCircle, tone: "text-amber-600 dark:text-amber-400" },
  low: { label: "Baixo", cls: "border-primary/20 bg-primary/[0.04]", icon: Info, tone: "text-primary" },
  info: { label: "Info", cls: "border-border bg-muted/30", icon: Sparkles, tone: "text-muted-foreground" },
};

const TYPE_LABEL: Record<Insight["type"], string> = {
  descriptive: "Descritivo",
  diagnostic: "Diagnóstico",
  predictive: "Preditivo",
  prescriptive: "Recomendação",
  comparative: "Comparativo",
  funnel: "Funil",
  financial: "Financeiro",
  operational: "Operacional",
  data_quality: "Qualidade",
  geographic: "Geográfico",
};

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function VisualizationRender({ viz }: { viz: VisualizationHint }) {
  const data = viz.data ?? [];
  if (data.length === 0) return null;
  const [first] = data;
  const numericKeys = Object.keys(first).filter((k) => typeof first[k] === "number");
  const labelKey = Object.keys(first).find((k) => typeof first[k] === "string") ?? "label";

  if (viz.type === "kpi") return null;

  if (viz.type === "line") {
    const yKey = viz.y ?? numericKeys[0];
    const xKey = viz.x ?? labelKey;
    return (
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} fontSize={10} tickLine={false} axisLine={false} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (viz.type === "bar") {
    const yKey = viz.y ?? numericKeys[0];
    const xKey = viz.x ?? labelKey;
    return (
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey={xKey} fontSize={9} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={48} />
          <YAxis fontSize={10} tickLine={false} axisLine={false} />
          <Tooltip />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (viz.type === "pie") {
    const valueKey = numericKeys[0];
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={data} dataKey={valueKey} nameKey={labelKey} outerRadius={70} label={(d) => String(d[labelKey])}>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (viz.type === "funnel") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <FunnelChart>
          <Tooltip />
          <Funnel dataKey={numericKeys[0]} data={data} isAnimationActive>
            {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    );
  }

  if (viz.type === "table") {
    const cols = Object.keys(first);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              {cols.map((c) => <th key={c} className="px-2 py-1 text-left font-medium text-muted-foreground">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 10).map((row, i) => (
              <tr key={i} className="border-t border-border/50">
                {cols.map((c) => <td key={c} className="px-2 py-1">{String(row[c] ?? "—")}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return null;
}

function fmtEvidence(value: string | number): string {
  if (typeof value === "number") {
    if (Math.abs(value) >= 1000) return formatBRL(value).replace("R$", "").trim();
    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }
  return value;
}

export function InsightCard({ insight, onAction }: Props) {
  const [open, setOpen] = useState(false);
  const sev: InsightSeverity = insight.severity ?? "info";
  const cfg = SEVERITY_CONFIG[sev];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("rounded-xl border p-4 space-y-3", cfg.cls)}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.tone)} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide">
              {TYPE_LABEL[insight.type]}
            </Badge>
            <Badge className={cn("h-5 px-1.5 text-[10px] font-semibold uppercase", cfg.tone)} variant="secondary">
              {cfg.label}
            </Badge>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground">
              confiança {(insight.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <h3 className="text-sm font-display font-semibold text-foreground leading-snug">
            {insight.title}
          </h3>
          <p className="text-[12px] text-muted-foreground font-body mt-1 leading-relaxed">
            {insight.summary}
          </p>
        </div>
        {onAction && (
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => onAction(insight)} title="Abrir">
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {insight.evidence.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {insight.evidence.slice(0, 6).map((ev, i) => (
            <div key={i} className="rounded-md bg-background/60 border border-border/50 px-2 py-1.5">
              <p className="text-[9px] font-body text-muted-foreground uppercase tracking-wide truncate" title={ev.label}>
                {ev.label}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <p className="text-xs font-mono tabular-nums text-foreground font-semibold truncate">
                  {fmtEvidence(ev.value)}
                </p>
                {ev.change != null && (
                  <span className={cn("flex items-center gap-0.5 text-[10px] font-mono tabular-nums",
                    ev.change >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}>
                    {ev.change >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                    {Math.abs(ev.change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {insight.recommendedAction && (
        <div className="rounded-md border border-primary/15 bg-primary/[0.04] px-3 py-2">
          <p className="text-[11px] font-body text-foreground leading-relaxed">
            <span className="font-semibold text-primary">→ Ação:</span>{" "}
            {insight.recommendedAction}
          </p>
        </div>
      )}

      {insight.visualization && insight.visualization.type !== "kpi" && (insight.visualization.data?.length ?? 0) > 0 && (
        <details className="rounded-md bg-background/40 border border-border/40">
          <summary
            className="px-3 py-1.5 text-[11px] font-body text-muted-foreground cursor-pointer flex items-center gap-1 select-none hover:text-foreground"
            onClick={() => setOpen((v) => !v)}
          >
            <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
            Ver visualização
          </summary>
          <div className="px-3 py-2">
            <VisualizationRender viz={insight.visualization} />
          </div>
        </details>
      )}

      {insight.limitations && insight.limitations.length > 0 && (
        <div className="text-[10px] font-body text-muted-foreground/80 border-t border-border/40 pt-2 space-y-0.5">
          {insight.limitations.map((l, i) => (
            <p key={i}>• {l}</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}
