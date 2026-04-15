import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, ChevronDown, ChevronUp, Play, Clock, MapPin, Ruler } from "lucide-react";
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
      .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime());
  }, [budgets, userId]);

  if (newRequests.length === 0) return null;

  const priorityColor: Record<string, string> = {
    urgente: "text-destructive border-destructive/40 bg-destructive/5",
    alta: "text-orange-600 border-orange-400/40 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/20",
    normal: "text-primary border-primary/30 bg-primary/5",
    baixa: "text-muted-foreground border-border bg-muted/30",
  };

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left group"
      >
        <Bell className="h-4.5 w-4.5 text-primary" />
        <h2 className="text-sm font-semibold font-display text-foreground">
          Novas Solicitações
        </h2>
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-mono">
          {newRequests.length}
        </Badge>
        <span className="ml-auto text-muted-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {newRequests.map((b) => {
            const priority = PRIORITIES[b.priority as keyof typeof PRIORITIES];
            const colorClass = priorityColor[b.priority] ?? priorityColor.normal;
            const timeAgo = b.created_at
              ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })
              : "";

            return (
              <Card
                key={b.id}
                className={`p-3 border-l-4 cursor-pointer hover:shadow-md transition-shadow ${colorClass}`}
                onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-1.5">
                      {b.sequential_code && (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                          {b.sequential_code}
                        </span>
                      )}
                      {priority && (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-current">
                          {priority.label}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{b.client_name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {b.property_type && (
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" />
                          {b.property_type}
                        </span>
                      )}
                      {b.metragem && (
                        <span className="flex items-center gap-0.5">
                          <Ruler className="h-3 w-3" />
                          {b.metragem}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {timeAgo}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 px-2 text-xs gap-1 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartBudget(b.id, "in_progress");
                    }}
                  >
                    <Play className="h-3 w-3" />
                    Começar
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
