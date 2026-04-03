import { useMemo } from "react";
import { Inbox, Hammer, CheckCircle2, Send, FileSignature } from "lucide-react";

interface FunnelStage {
  key: string;
  label: string;
  icon: React.ElementType;
  statuses: string[];
  color: string;
  bgColor: string;
}

const FUNNEL_STAGES: FunnelStage[] = [
  {
    key: "pending",
    label: "Pendente",
    icon: Inbox,
    statuses: ["requested", "novo", "triage", "assigned"],
    color: "text-primary",
    bgColor: "bg-primary",
  },
  {
    key: "in_progress",
    label: "Em elaboração",
    icon: Hammer,
    statuses: ["in_progress", "waiting_info", "blocked"],
    color: "text-warning",
    bgColor: "bg-warning",
  },
  {
    key: "review",
    label: "Em revisão",
    icon: CheckCircle2,
    statuses: ["ready_for_review"],
    color: "text-warning",
    bgColor: "bg-warning",
  },
  {
    key: "delivered",
    label: "Entregue",
    icon: Send,
    statuses: ["delivered_to_sales", "sent_to_client", "minuta_solicitada"],
    color: "text-success",
    bgColor: "bg-success",
  },
  {
    key: "closed",
    label: "Finalizado",
    icon: FileSignature,
    statuses: ["lost", "archived"],
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground",
  },
];

interface ProductionFunnelProps {
  budgets: { internal_status: string }[];
  onStageClick?: (statuses: string[]) => void;
}

export function ProductionFunnel({ budgets, onStageClick }: ProductionFunnelProps) {
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    FUNNEL_STAGES.forEach((s) => (counts[s.key] = 0));
    budgets.forEach((b) => {
      const stage = FUNNEL_STAGES.find((s) => s.statuses.includes(b.internal_status));
      if (stage) counts[stage.key]++;
    });
    return counts;
  }, [budgets]);

  const total = budgets.length || 1;

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <h3 className="text-sm font-display font-semibold text-foreground">Funil de Produção</h3>

      {/* Bar */}
      <div className="h-3 rounded-full bg-muted overflow-hidden flex">
        {FUNNEL_STAGES.map((stage) => {
          const pct = (stageCounts[stage.key] / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={stage.key}
              className={`${stage.bgColor} h-full transition-all duration-300`}
              style={{ width: `${pct}%` }}
            />
          );
        })}
      </div>

      {/* Stage pills */}
      <div className="flex flex-wrap gap-2">
        {FUNNEL_STAGES.map((stage) => {
          const count = stageCounts[stage.key];
          const Icon = stage.icon;
          return (
            <button
              key={stage.key}
              onClick={() => onStageClick?.(stage.statuses)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-body font-medium transition-colors
                border border-border hover:bg-accent/50 ${count > 0 ? stage.color : "text-muted-foreground/50"}`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{stage.label}</span>
              <span className="ml-0.5 font-semibold">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
