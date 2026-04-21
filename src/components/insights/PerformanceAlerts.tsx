import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, TrendingDown } from "lucide-react";

interface TrendsDelta {
  meetings: number;
  avgScore: number;
  positiveSentimentPct: number;
}

interface TrendsPayload {
  windows: { windowDays: 30 | 60 | 90; meetings: number; avgScore: number; positiveSentimentPct: number }[];
  delta30vs60: TrendsDelta;
}

interface AlertItem {
  metric: string;
  dropPct: number;
  current: number;
  previous: number;
  unit?: string;
}

const DROP_THRESHOLD = 20; // %

/**
 * Detects drops > 20% comparing the last 30d window to the preceding 30d
 * (reconstructed via current window value minus delta).
 */
function detectDrops(trends: TrendsPayload): AlertItem[] {
  const w30 = trends.windows.find((w) => w.windowDays === 30);
  if (!w30) return [];
  const alerts: AlertItem[] = [];

  const checks: { metric: string; current: number; delta: number; unit?: string }[] = [
    { metric: "Reuniões", current: w30.meetings, delta: trends.delta30vs60.meetings },
    { metric: "Score médio", current: w30.avgScore, delta: trends.delta30vs60.avgScore },
    { metric: "Sentimento positivo", current: w30.positiveSentimentPct, delta: trends.delta30vs60.positiveSentimentPct, unit: "%" },
  ];

  for (const c of checks) {
    if (c.delta >= 0) continue; // only drops
    const previous = c.current - c.delta; // delta is negative → previous > current
    if (previous <= 0) continue;
    const dropPct = Math.round((Math.abs(c.delta) / previous) * 100);
    if (dropPct > DROP_THRESHOLD) {
      alerts.push({
        metric: c.metric,
        dropPct,
        current: c.current,
        previous,
        unit: c.unit,
      });
    }
  }
  return alerts;
}

export default function PerformanceAlerts({ trends }: { trends: TrendsPayload | undefined }) {
  if (!trends?.windows?.length) return null;
  const alerts = detectDrops(trends);
  if (alerts.length === 0) return null;

  return (
    <Alert variant="destructive" className="border-destructive/40 bg-destructive/5">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2 font-bold">
        Alerta de queda de performance
        <span className="text-xs font-normal text-muted-foreground">
          (últimos 30d vs 30d anteriores)
        </span>
      </AlertTitle>
      <AlertDescription className="mt-2">
        <ul className="space-y-1.5">
          {alerts.map((a, i) => (
            <li key={i} className="flex items-center gap-2 text-sm">
              <TrendingDown className="h-3.5 w-3.5 shrink-0 text-destructive" />
              <span className="font-semibold">{a.metric}</span>
              <span className="text-muted-foreground">caiu</span>
              <span className="font-bold text-destructive tabular-nums">−{a.dropPct}%</span>
              <span className="text-muted-foreground tabular-nums">
                ({a.previous}{a.unit || ""} → {a.current}{a.unit || ""})
              </span>
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
