import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Minus, CalendarRange, AlertTriangle, Activity, Download, LineChart as LineChartIcon, Pin, X } from "lucide-react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceDot,
} from "recharts";

interface TrendWindow {
  windowDays: 30 | 60 | 90;
  meetings: number;
  avgScore: number;
  positiveSentimentPct: number;
  topObjections: { objection: string; count: number }[];
}

interface WeeklyPoint {
  weekStart: string;
  label: string;
  meetings: number;
  avgScore: number;
}

interface TrendsPayload {
  windows: TrendWindow[];
  delta30vs60: {
    meetings: number;
    avgScore: number;
    positiveSentimentPct: number;
  };
  weekly?: WeeklyPoint[];
}

function DeltaPill({ value, suffix = "", invert = false }: { value: number; suffix?: string; invert?: boolean }) {
  if (value === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground">
        <Minus className="h-3 w-3" />
        0{suffix}
      </span>
    );
  }
  const positive = value > 0;
  const better = invert ? !positive : positive;
  const colorClass = better ? "text-emerald-600" : "text-red-500";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${colorClass}`}>
      <Icon className="h-3 w-3" />
      {value > 0 ? "+" : ""}{value}{suffix}
    </span>
  );
}

function WindowCard({ win, delta, isPrimary }: { win: TrendWindow; delta?: TrendsPayload["delta30vs60"]; isPrimary?: boolean }) {
  return (
    <div className={`rounded-lg border p-4 space-y-3 ${isPrimary ? "border-primary/30 bg-primary/[0.03]" : "border-border/60"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CalendarRange className={`h-3.5 w-3.5 ${isPrimary ? "text-primary" : "text-muted-foreground"}`} />
          <span className={`text-xs font-semibold uppercase tracking-wider ${isPrimary ? "text-primary" : "text-muted-foreground"}`}>
            últimos {win.windowDays}d
          </span>
        </div>
        {isPrimary && delta && (
          <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
            vs 30d ant.
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{win.meetings}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">reuniões</p>
          {isPrimary && delta && <DeltaPill value={delta.meetings} />}
        </div>
        <div>
          <p className={`text-2xl font-bold tabular-nums ${win.avgScore >= 70 ? "text-emerald-600" : win.avgScore >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {win.avgScore || "—"}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">score médio</p>
          {isPrimary && delta && <DeltaPill value={delta.avgScore} />}
        </div>
        <div>
          <p className="text-2xl font-bold tabular-nums text-foreground">{win.positiveSentimentPct}<span className="text-sm">%</span></p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">sent. positivo</p>
          {isPrimary && delta && <DeltaPill value={delta.positiveSentimentPct} suffix="%" />}
        </div>
      </div>

      {win.topObjections.length > 0 && (
        <div className="pt-2 border-t border-border/40 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Top objeções no período
          </p>
          {win.topObjections.map((o, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <p className="text-xs text-muted-foreground leading-snug flex-1 line-clamp-2">{o.objection}</p>
              <Badge variant="secondary" className="text-[10px] shrink-0 h-5">{o.count}x</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Weekly sparkline ─────────────────────────────────────────────
type WeeklyChartPoint = WeeklyPoint & {
  scoreMA4: number | null;
  meetingsAvg4: number | null;
};

function buildSparklineData(weekly: WeeklyPoint[]): WeeklyChartPoint[] {
  // 4-week trailing moving average for avgScore (only when we have a full window of meetings)
  return weekly.map((w, i) => {
    const start = Math.max(0, i - 3);
    const window = weekly.slice(start, i + 1);
    const totalMeetings = window.reduce((s, x) => s + x.meetings, 0);
    // Per-week average meetings over the trailing 4-week window (1 decimal)
    const meetingsAvg4 = window.length > 0
      ? Math.round((totalMeetings / window.length) * 10) / 10
      : null;
    if (totalMeetings === 0 || window.length < 2) {
      return { ...w, scoreMA4: null, meetingsAvg4 };
    }
    // Weighted by meetings to avoid empty weeks dragging the line to 0
    const weightedSum = window.reduce((s, x) => s + x.avgScore * x.meetings, 0);
    const ma = weightedSum / totalMeetings;
    return { ...w, scoreMA4: Math.round(ma), meetingsAvg4 };
  });
}

type MeetingsMode = "total" | "avg";

const nfInt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtMeetings(value: unknown, mode: MeetingsMode): string {
  if (value == null || Number.isNaN(value as number)) return "—";
  const n = Number(value);
  return mode === "avg" ? nf1.format(n) : nfInt.format(n);
}
function fmtScore(value: unknown): string {
  if (value == null || Number.isNaN(value as number)) return "—";
  const n = Number(value);
  if (n === 0) return "—";
  return `${nfInt.format(n)} / 100`;
}

interface SparkTooltipPayloadItem {
  dataKey?: string | number;
  value?: number | string | null;
}

interface SparkTooltipProps {
  active?: boolean;
  payload?: SparkTooltipPayloadItem[];
  label?: string;
  mode: MeetingsMode;
}

function SparkTooltip({ active, payload, label, mode }: SparkTooltipProps) {
  if (!active || !payload?.length) return null;
  const meetings = payload.find((p) => p.dataKey === "meetings")?.value;
  const meetingsAvg = payload.find((p) => p.dataKey === "meetingsAvg4")?.value;
  const score = payload.find((p) => p.dataKey === "avgScore")?.value;
  const ma = payload.find((p) => p.dataKey === "scoreMA4")?.value;

  const meetingsValue = mode === "avg" ? meetingsAvg : meetings;
  const meetingsLabel = mode === "avg" ? "Média / sem." : "Total";
  const meetingsUnit = mode === "avg" ? "reuniões/sem." : "reuniões";

  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md min-w-[200px]">
      <p className="font-semibold text-foreground mb-1.5 pb-1.5 border-b border-border/40">
        Semana de {label}
      </p>

      {/* Reuniões section */}
      <div className="space-y-0.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-sm bg-primary/70" aria-hidden />
          Reuniões
        </p>
        <p className="flex items-baseline justify-between gap-3 pl-3">
          <span className="text-muted-foreground">{meetingsLabel}</span>
          <span className="tabular-nums">
            <span className="font-bold text-foreground">{fmtMeetings(meetingsValue, mode)}</span>
            <span className="text-[10px] text-muted-foreground/70 ml-1">{meetingsUnit}</span>
          </span>
        </p>
      </div>

      {/* Score section */}
      <div className="space-y-0.5 mt-1.5 pt-1.5 border-t border-border/40">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium flex items-center gap-1">
          <span className="inline-block h-0.5 w-2.5 bg-[hsl(var(--accent-foreground))]" aria-hidden />
          Score médio
        </p>
        <p className="flex items-baseline justify-between gap-3 pl-3">
          <span className="text-muted-foreground">Semana</span>
          <span className="font-bold text-foreground tabular-nums">{fmtScore(score)}</span>
        </p>
        {ma != null && (
          <p className="flex items-baseline justify-between gap-3 pl-3">
            <span className="text-muted-foreground">MA 4 sem.</span>
            <span className="font-bold text-foreground tabular-nums">{fmtScore(ma)}</span>
          </p>
        )}
      </div>
    </div>
  );
}

function EmptySparkline({ reason }: { reason: "no-data" | "no-meetings" }) {
  const message =
    reason === "no-meetings"
      ? "Sem reuniões registradas nas últimas 12 semanas."
      : "Dados semanais ainda não disponíveis para este escopo.";
  return (
    <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6">
      <div className="flex items-start gap-3">
        <div className="rounded-md bg-background/60 p-2 border border-border/40">
          <LineChartIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="space-y-1 flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Evolução semanal · últimas 12 semanas
          </p>
          <p className="text-sm text-muted-foreground/90">{message}</p>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            O gráfico aparecerá automaticamente assim que houver reuniões registradas no período.
          </p>
        </div>
      </div>
    </div>
  );
}

function WeeklySparkline({ weekly }: { weekly: WeeklyPoint[] }) {
  const [mode, setMode] = useState<MeetingsMode>("total");
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const data = buildSparklineData(weekly);
  const totalMeetings = data.reduce((s, w) => s + w.meetings, 0);
  if (totalMeetings === 0) return <EmptySparkline reason="no-meetings" />;
  const pinned = pinnedIndex != null ? data[pinnedIndex] : null;

  const meetingsKey = mode === "avg" ? "meetingsAvg4" : "meetings";
  const meetingsName = mode === "avg" ? "Reuniões (média 4 sem.)" : "Reuniões";

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-2 bg-card">
      <div className="flex items-center gap-1.5 flex-wrap">
        <LineChartIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evolução semanal · últimas 12 semanas
        </span>
        <div
          className="ml-auto inline-flex rounded-md border border-border/60 p-0.5 bg-muted/30"
          role="group"
          aria-label="Modo de exibição de reuniões"
        >
          <button
            type="button"
            onClick={() => setMode("total")}
            aria-pressed={mode === "total"}
            className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-sm transition-colors ${
              mode === "total"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Total
          </button>
          <button
            type="button"
            onClick={() => setMode("avg")}
            aria-pressed={mode === "avg"}
            className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-sm transition-colors ${
              mode === "avg"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Média 4s
          </button>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={() => setPinnedIndex(null)}
            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/15 transition-colors"
            aria-label="Desafixar semana"
          >
            <Pin className="h-3 w-3" />
            <span>Fixado: {pinned.label}</span>
            <X className="h-3 w-3" />
          </button>
        )}
        <div className="basis-full flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm bg-primary/60" aria-hidden />
            <span>{meetingsName} <span className="text-muted-foreground/60">(esq.)</span></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-3 bg-[hsl(var(--accent-foreground))]" aria-hidden />
            <span>Score <span className="text-muted-foreground/60">(dir.)</span></span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-3"
              style={{ backgroundImage: "repeating-linear-gradient(90deg, hsl(var(--muted-foreground)) 0 3px, transparent 3px 6px)" }}
              aria-hidden
            />
            <span>MA Score 4 sem.</span>
          </span>
        </div>
      </div>
      <div className="relative h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
            onClick={(state: { activeTooltipIndex?: number } | undefined) => {
              const idx = state?.activeTooltipIndex;
              if (typeof idx !== "number") return;
              setPinnedIndex((prev) => (prev === idx ? null : idx));
            }}
            style={{ cursor: "pointer" }}
          >
            <defs>
              <linearGradient id="meetingsArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={mode === "avg"}
              width={28}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <Tooltip
              content={<SparkTooltip mode={mode} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
              wrapperStyle={pinned ? { display: "none" } : undefined}
            />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey={meetingsKey}
              name={meetingsName}
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#meetingsArea)"
              dot={false}
              activeDot={{ r: 3 }}
              isAnimationActive={false}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="avgScore"
              name="Score"
              stroke="hsl(var(--accent-foreground))"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="scoreMA4"
              name="MA Score (4 sem.)"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              activeDot={false}
              connectNulls
            />
            {pinned && (
              <>
                <ReferenceDot
                  x={pinned.label}
                  y={(pinned as unknown as Record<string, number | null | undefined>)[meetingsKey] ?? 0}
                  yAxisId="left"
                  r={4}
                  fill="hsl(var(--primary))"
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                  isFront
                />
                {pinned.avgScore > 0 && (
                  <ReferenceDot
                    x={pinned.label}
                    y={pinned.avgScore}
                    yAxisId="right"
                    r={4}
                    fill="hsl(var(--accent-foreground))"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    isFront
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
        {pinned && (
          <div className="pointer-events-none absolute top-2 right-2 z-10">
            <div className="pointer-events-auto">
              <SparkTooltip
                active
                mode={mode}
                label={pinned.label}
                payload={[
                  { dataKey: "meetings", value: pinned.meetings },
                  { dataKey: "meetingsAvg4", value: pinned.meetingsAvg4 },
                  { dataKey: "avgScore", value: pinned.avgScore },
                  { dataKey: "scoreMA4", value: pinned.scoreMA4 },
                ]}
              />
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Clique em uma semana para fixar o tooltip · clique novamente (ou no chip acima) para desafixar.
      </p>
    </div>
  );
}

function escapeCsv(value: string | number): string {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportTrendsCsv(trends: TrendsPayload, scopeLabel: string) {
  const rows: string[] = [];
  rows.push("section,window_days,metric,value,unit");

  // Windows section
  for (const w of trends.windows) {
    rows.push(`window,${w.windowDays},meetings,${w.meetings},count`);
    rows.push(`window,${w.windowDays},avg_score,${w.avgScore},score`);
    rows.push(`window,${w.windowDays},positive_sentiment_pct,${w.positiveSentimentPct},%`);
  }

  // Delta section
  rows.push(`delta_30_vs_prev_30,30,meetings_delta,${trends.delta30vs60.meetings},count`);
  rows.push(`delta_30_vs_prev_30,30,avg_score_delta,${trends.delta30vs60.avgScore},score`);
  rows.push(`delta_30_vs_prev_30,30,positive_sentiment_pct_delta,${trends.delta30vs60.positiveSentimentPct},%`);

  // Top objections section (separate header for clarity)
  rows.push("");
  rows.push("section,window_days,objection,count,");
  for (const w of trends.windows) {
    for (const o of w.topObjections) {
      rows.push(`top_objection,${w.windowDays},${escapeCsv(o.objection)},${o.count},`);
    }
  }

  // Weekly evolution section — exact values shown on the 12-week sparkline
  if (trends.weekly?.length) {
    const enriched = buildSparklineData(trends.weekly);
    rows.push("");
    rows.push(
      "section,week_index,week_start,week_label,meetings,meetings_avg_4w,avg_score,score_ma_4w"
    );
    enriched.forEach((w, i) => {
      const ma = w.scoreMA4 ?? "";
      const meetingsAvg = w.meetingsAvg4 ?? "";
      rows.push(
        `weekly,${i + 1},${w.weekStart},${escapeCsv(w.label)},${w.meetings},${meetingsAvg},${w.avgScore},${ma}`
      );
    });
  }

  const csv = rows.join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const today = new Date().toISOString().slice(0, 10);
  const safeScope = scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "tendencias";
  a.href = url;
  a.download = `tendencias-${safeScope}-${today}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function TrendAnalysis({
  trends,
  scopeLabel = "consolidado",
}: {
  trends: TrendsPayload | undefined;
  scopeLabel?: string;
}) {
  if (!trends?.windows?.length) return null;
  const w30 = trends.windows.find((w) => w.windowDays === 30);
  const w60 = trends.windows.find((w) => w.windowDays === 60);
  const w90 = trends.windows.find((w) => w.windowDays === 90);

  // Hide entirely if no meetings in any window (avoid noise)
  const hasAny = trends.windows.some((w) => w.meetings > 0);
  if (!hasAny) return null;

  return (
    <Card className="border-border/60 overflow-hidden">
      <CardHeader className="pb-3 bg-muted/30">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-primary" />
          Tendências Temporais
          <Badge variant="outline" className="ml-auto text-xs font-normal">30 / 60 / 90 dias</Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1"
            onClick={() => exportTrendsCsv(trends, scopeLabel)}
            aria-label="Exportar tendências em CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {w30 && <WindowCard win={w30} delta={trends.delta30vs60} isPrimary />}
          {w60 && <WindowCard win={w60} />}
          {w90 && <WindowCard win={w90} />}
        </div>
        <div className="mt-4">
          {trends.weekly && trends.weekly.length > 0 ? (
            <WeeklySparkline weekly={trends.weekly} />
          ) : (
            <EmptySparkline reason="no-data" />
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
          Janelas cumulativas a partir de hoje. Os deltas (▲▼) comparam os últimos 30 dias com os 30 dias imediatamente anteriores.
          A linha tracejada no gráfico é a média móvel ponderada de 4 semanas.
        </p>
      </CardContent>
    </Card>
  );
}
