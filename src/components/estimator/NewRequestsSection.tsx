import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Bell,
  ChevronDown,
  ChevronUp,
  Play,
  Clock,
  MapPin,
  Ruler,
  AlertTriangle,
  Flame,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PRIORITIES } from "@/lib/role-constants";
import type { BudgetRow } from "@/components/estimator/EstimatorListView";
import type { InternalStatus } from "@/lib/role-constants";

const NEW_REQUEST_STATUSES = new Set(["requested", "triage", "assigned"]);

interface NewRequestsSectionProps {
  budgets: BudgetRow[];
  userId: string;
  onStartBudget: (budgetId: string, status: InternalStatus) => void;
}

export function NewRequestsSection({ budgets, userId, onStartBudget }: NewRequestsSectionProps) {
  const [expanded, setExpanded] = useState(true);
  const navigate = useNavigate();

  const newRequests = useMemo(() => {
    return budgets
      .filter(
        (b) =>
          NEW_REQUEST_STATUSES.has(b.internal_status) &&
          (b.estimator_owner_id === userId || b.estimator_owner_id === null)
      )
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      });
  }, [budgets, userId]);

  if (newRequests.length === 0) return null;

  const urgentCount = newRequests.filter((b) => b.priority === "urgente" || b.priority === "alta").length;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.02]">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full text-left px-4 py-2.5 group"
      >
        <div className="relative">
          <Bell className="h-4 w-4 text-primary" />
          {urgentCount > 0 && (
            <span className="absolute -top-0.5 -right-1 h-2 w-2 rounded-full bg-destructive animate-pulse" />
          )}
        </div>
        <h2 className="text-xs font-semibold font-display text-foreground uppercase tracking-wider">
          Novas Solicitações
        </h2>
        <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 font-mono">
          {newRequests.length}
        </Badge>
        {urgentCount > 0 && (
          <span className="text-[10px] text-destructive font-medium flex items-center gap-0.5">
            <Flame className="h-3 w-3" />
            {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </span>
      </button>

      {/* Cards */}
      {expanded && (
        <div className="px-3 pb-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {newRequests.map((b) => {
              const isUrgent = b.priority === "urgente";
              const isHigh = b.priority === "alta";
              const timeAgo = b.created_at
                ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })
                : "";

              return (
                <div
                  key={b.id}
                  className={`
                    rounded-md border px-3 py-2.5 cursor-pointer transition-all
                    hover:shadow-sm hover:border-primary/30
                    ${isUrgent
                      ? "border-destructive/30 bg-destructive/[0.03]"
                      : isHigh
                      ? "border-orange-400/30 bg-orange-500/[0.02]"
                      : "border-border bg-card"
                    }
                  `}
                  onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
                >
                  {/* Row 1: Code + Priority + Action */}
                  <div className="flex items-center justify-between gap-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {b.sequential_code && (
                        <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider">
                          {b.sequential_code}
                        </span>
                      )}
                      {isUrgent && (
                        <span className="flex items-center gap-0.5 text-[9px] font-medium text-destructive">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Urgente
                        </span>
                      )}
                      {isHigh && (
                        <span className="text-[9px] font-medium text-orange-600 dark:text-orange-400">
                          Alta
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-6 px-2 text-[10px] gap-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartBudget(b.id, "in_progress");
                      }}
                    >
                      <Play className="h-2.5 w-2.5" />
                      Começar
                    </Button>
                  </div>

                  {/* Client name */}
                  <p className="text-sm font-medium text-foreground truncate leading-tight">
                    {b.client_name}
                  </p>

                  {/* Project if different */}
                  {b.project_name && b.project_name !== b.client_name && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{b.project_name}</p>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                    {b.property_type && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                        {b.property_type}
                      </span>
                    )}
                    {b.metragem && (
                      <span className="flex items-center gap-0.5">
                        <Ruler className="h-2.5 w-2.5 shrink-0" />
                        {b.metragem}
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 ml-auto">
                      <Clock className="h-2.5 w-2.5" />
                      {timeAgo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
