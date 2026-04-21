import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { LineChart as LineChartIcon, GitCompareArrows } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WeeklyPoint {
  weekStart: string;
  label: string;
  meetings: number;
  avgScore: number;
}

export interface BrokerSeries {
  name: string;
  weekly: WeeklyPoint[] | undefined;
}

type Metric = "meetings" | "avgScore";

// Stable, theme-aware palette (HSL via design tokens for first two; explicit fallbacks beyond).
// We map by index, not name — the parent passes a stable order (A then B).
const SERIES_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "hsl(24 90% 55%)", // orange — fallback for 3rd broker
  "hsl(155 65% 40%)", // green — fallback for 4th broker
];

export interface MergedRow {
  label: string;
  weekStart: string;
  // dynamic per-broker keys: e.g. broker_0, broker_1
  [key: string]: number | string | null;
}

/**
 * Merges weekly arrays from multiple brokers into a single chart dataset.
 * Aligns on weekStart (ISO week-anchored Monday). Missing weeks for a broker = null
 * so the line connects across gaps via `connectNulls`.
 */
/**
 * Merges weekly arrays from multiple brokers into a single chart dataset.
 * Aligns on weekStart (ISO week-anchored Monday). Missing weeks for a broker = null
 * so the line connects across gaps via `connectNulls`.
 *
 * Complexity: O(N + W·B) where N = total points across brokers, W = unique weeks,
 * B = brokers. Previous implementation was O(W·B·Pmax) due to Array.find lookups.
 */
export function mergeWeekly(series: BrokerSeries[]): MergedRow[] {
  // 1) Build per-broker Map<weekStart, point> + collect unique weekStart→label.
  const labelByKey = new Map<string, string>();
  const pointByKeyPerBroker: Array<Map<string, WeeklyPoint>> = series.map((s) => {
    const m = new Map<string, WeeklyPoint>();
    for (const w of s.weekly ?? []) {
      m.set(w.weekStart, w);
      if (!labelByKey.has(w.weekStart)) labelByKey.set(w.weekStart, w.label);
    }
    return m;
  });

  // 2) Sort unique week keys once.
  const sortedKeys = Array.from(labelByKey.keys()).sort();

  // 3) Materialize rows with O(1) lookups per (week, broker).
  return sortedKeys.map((weekStart) => {
    const row: MergedRow = { weekStart, label: labelByKey.get(weekStart) ?? weekStart };
    for (let idx = 0; idx < series.length; idx++) {
      const point = pointByKeyPerBroker[idx].get(weekStart);
      // Avoid plotting score=0 when no meetings happened (would drag line to 0)
      if (!point || point.meetings === 0) {
        row[`meetings_${idx}`] = point ? point.meetings : null;
        row[`avgScore_${idx}`] = null;
      } else {
        row[`meetings_${idx}`] = point.meetings;
        row[`avgScore_${idx}`] = point.avgScore;
      }
    }
    return row;
  });
}

// ─── Memoization ────────────────────────────────────────────────────────────
// Two-tier cache:
//   1) WeakMap keyed by the series array reference — cheapest hit when the
//      parent passes a stable reference (e.g. from useMemo).
//   2) Module-level Map keyed by a content signature — catches the common
//      case where the parent rebuilds the series array on every render but
//      the underlying data is unchanged.
const refCache = new WeakMap<BrokerSeries[], MergedRow[]>();
const sigCache = new Map<string, MergedRow[]>();
const SIG_CACHE_MAX = 16; // small LRU-ish cap; comparison rarely exceeds 2-4 brokers

function buildSeriesSignature(series: BrokerSeries[]): string {
  // Compact, content-addressable key. Avoids JSON.stringify overhead by
  // emitting only the fields mergeWeekly actually consumes.
  const parts: string[] = [];
  for (const s of series) {
    parts.push(`n:${s.name}`);
    const w = s.weekly;
    if (!w || w.length === 0) {
      parts.push("e");
      continue;
    }
    // weeks are typically pre-sorted by the producer; we don't sort here to
    // keep this O(N) — mergeWeekly itself is order-independent on weekStart.
    for (let i = 0; i < w.length; i++) {
      const p = w[i];
      parts.push(`${p.weekStart}|${p.meetings}|${p.avgScore}`);
    }
    parts.push("|");
  }
  return parts.join(",");
}

function memoizedMergeWeekly(series: BrokerSeries[]): MergedRow[] {
  const refHit = refCache.get(series);
  if (refHit) return refHit;

  const sig = buildSeriesSignature(series);
  const sigHit = sigCache.get(sig);
  if (sigHit) {
    refCache.set(series, sigHit);
    return sigHit;
  }

  const result = mergeWeekly(series);

  // Tiny LRU eviction — drop oldest entry when over cap.
  if (sigCache.size >= SIG_CACHE_MAX) {
    const firstKey = sigCache.keys().next().value;
    if (firstKey !== undefined) sigCache.delete(firstKey);
  }
  sigCache.set(sig, result);
  refCache.set(series, result);
  return result;
}

// Exposed for tests; not part of the public component API.
export const __memoInternals = {
  buildSeriesSignature,
  memoizedMergeWeekly,
  clear: () => sigCache.clear(),
};


function CompareTooltip({ active, payload, label, series, metric }: any) {
  if (!active || !payload?.length) return null;
  const unit = metric === "meetings" ? "reuniões" : "/ 100";
  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md min-w-[200px]">
      <p className="font-semibold text-foreground mb-1.5 pb-1.5 border-b border-border/40">
        Semana de {label}
      </p>
      <div className="space-y-1">
        {series.map((s: BrokerSeries, idx: number) => {
          const value = payload.find((p: any) => p.dataKey === `${metric}_${idx}`)?.value;
          const display = value == null ? "—" : metric === "avgScore" ? `${value} ${unit}` : `${value} ${unit}`;
          return (
            <div key={idx} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground truncate">
                <span
                  className="inline-block h-2 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: SERIES_COLORS[idx] }}
                  aria-hidden
                />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="font-bold text-foreground tabular-nums shrink-0">{display}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MultiBrokerWeeklySparkline({ series }: { series: BrokerSeries[] }) {
  const [metric, setMetric] = useState<Metric>("meetings");

  // Stable signature derived from data content. Using it as the useMemo
  // dependency means we only rebuild when the actual broker data changes —
  // not on every parent render that happens to pass a fresh array reference.
  const seriesSignature = useMemo(() => buildSeriesSignature(series), [series]);

  // memoizedMergeWeekly itself caches by ref + signature, so this useMemo
  // is mostly belt-and-suspenders to keep React's commit phase cheap.
  const data = useMemo(
    () => memoizedMergeWeekly(series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seriesSignature]
  );

  // Per-broker availability flag. We treat "no weekly array" and "weekly array
  // present but every meetings === 0" both as "no data" so the legend signals
  // it explicitly instead of showing a phantom line.
  const brokerHasData = useMemo(
    () =>
      series.map((s) => {
        const w = s.weekly;
        if (!w || w.length === 0) return false;
        return w.some((p) => p.meetings > 0);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seriesSignature]
  );

  const allEmpty =
    series.length === 0 || brokerHasData.every((v) => !v) || data.length === 0;

  const hasAnyForMetric = useMemo(
    () =>
      data.some((row) =>
        series.some((_, idx) => {
          const v = row[`${metric}_${idx}`];
          return typeof v === "number" && v > 0;
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, metric, series.length]
  );

  // Card-level empty state — no series, all-empty series, or merge produced no rows.
  if (allEmpty) {
    return (
      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-background/60 p-2 border border-border/40">
            <GitCompareArrows className="h-4 w-4 text-muted-foreground" aria-hidden />
          </div>
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Evolução semanal comparada
            </p>
            <p className="text-sm text-muted-foreground/90">
              {series.length === 0
                ? "Selecione consultores para comparar a evolução semanal."
                : "Nenhum dos consultores selecionados possui reuniões nas últimas 12 semanas."}
            </p>
            {series.length > 0 && (
              <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
                {series.map((s) => s.name).join(" · ")} — sem dados disponíveis no período.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 p-4 space-y-2 bg-card">
      <div className="flex items-center gap-1.5 flex-wrap">
        <LineChartIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Evolução semanal comparada · últimas 12 semanas
        </span>
        <div
          className="ml-auto inline-flex rounded-md border border-border/60 p-0.5 bg-muted/30"
          role="group"
          aria-label="Métrica do gráfico"
        >
          <button
            type="button"
            onClick={() => setMetric("meetings")}
            aria-pressed={metric === "meetings"}
            className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-sm transition-colors ${
              metric === "meetings"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Reuniões
          </button>
          <button
            type="button"
            onClick={() => setMetric("avgScore")}
            aria-pressed={metric === "avgScore"}
            className={`px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-sm transition-colors ${
              metric === "avgScore"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Score
          </button>
        </div>
        <div className="basis-full flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
          {series.map((s, idx) => {
            const hasData = brokerHasData[idx];
            return (
              <span
                key={idx}
                className={`inline-flex items-center gap-1.5 ${
                  hasData ? "" : "opacity-50"
                }`}
                title={hasData ? undefined : "Sem reuniões nas últimas 12 semanas"}
              >
                <span
                  className="inline-block h-0.5 w-3"
                  style={{ backgroundColor: SERIES_COLORS[idx] }}
                  aria-hidden
                />
                <span className="truncate max-w-[160px]">{s.name}</span>
                {!hasData && (
                  <Badge
                    variant="outline"
                    className="text-[9px] font-normal h-4 px-1 leading-none border-dashed"
                  >
                    sem dados
                  </Badge>
                )}
              </span>
            );
          })}
          {!hasAnyForMetric && (
            <Badge variant="outline" className="text-[10px] font-normal ml-auto">
              Sem dados na métrica selecionada
            </Badge>
          )}
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.4}
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border))" }}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
              width={32}
              domain={metric === "avgScore" ? [0, 100] : ["auto", "auto"]}
            />
            <Tooltip
              content={<CompareTooltip series={series} metric={metric} />}
              cursor={{ stroke: "hsl(var(--border))", strokeWidth: 1 }}
            />
            <Legend
              verticalAlign="bottom"
              height={0}
              wrapperStyle={{ display: "none" }}
            />
            {series.map((_, idx) => brokerHasData[idx] && (
              <Line
                key={idx}
                type="monotone"
                dataKey={`${metric}_${idx}`}
                stroke={SERIES_COLORS[idx]}
                strokeWidth={2}
                dot={{ r: 2.5, strokeWidth: 0, fill: SERIES_COLORS[idx] }}
                activeDot={{ r: 4 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
        Linhas alinhadas por semana (segunda-feira UTC). Semanas sem reuniões para um consultor
        ficam ocultas (linha conecta os pontos vizinhos).
      </p>
    </div>
  );
}
