import { AlertTriangle, ShieldCheck, CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type RiskTone = "danger" | "warning" | "ok";

export interface RiskSignal {
  tone: RiskTone;
  title: string;
  detail?: string;
}

const toneClasses: Record<RiskTone, string> = {
  danger: "text-destructive",
  warning: "text-amber-600 dark:text-amber-400",
  ok: "text-emerald-600 dark:text-emerald-400",
};

export function RiskSignalsCard({ signals }: { signals: RiskSignal[] }) {
  const alerts = signals.filter((s) => s.tone !== "ok").length;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Sinais de risco
        </h3>
        {alerts > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            {alerts} alerta{alerts === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
            <ShieldCheck className="h-3 w-3" />
            Sem alertas
          </span>
        )}
      </div>
      <ul className="space-y-2 text-[12.5px] font-body">
        {signals.map((s, i) => (
          <li key={i} className="flex gap-2">
            <CircleAlert className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", toneClasses[s.tone])} />
            <span>
              <span className="font-medium text-foreground">{s.title}</span>
              {s.detail && <span className="text-muted-foreground"> — {s.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
