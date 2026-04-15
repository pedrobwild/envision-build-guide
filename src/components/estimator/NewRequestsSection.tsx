import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
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
  User,
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
        // Priority first (urgente > alta > normal > baixa), then by created_at desc
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
    <div className="space-y-3">
      {/* Section header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2.5 w-full text-left group"
      >
        <div className="relative">
          <Bell className="h-5 w-5 text-primary" />
          {urgentCount > 0 && (
            <span className="absolute -top-1 -right-1.5 h-3 w-3 rounded-full bg-destructive animate-pulse" />
          )}
        </div>
        <h2 className="text-sm font-semibold font-display text-foreground">
          Novas Solicitações
        </h2>
        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5 font-mono">
          {newRequests.length}
        </Badge>
        {urgentCount > 0 && (
          <span className="text-[11px] text-destructive font-medium flex items-center gap-1">
            <Flame className="h-3 w-3" />
            {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {expanded && (
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {newRequests.map((b) => {
            const priority = PRIORITIES[b.priority as keyof typeof PRIORITIES];
            const isUrgent = b.priority === "urgente";
            const isHigh = b.priority === "alta";
            const timeAgo = b.created_at
              ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })
              : "";

            const borderColor = isUrgent
              ? "border-l-destructive"
              : isHigh
              ? "border-l-orange-500"
              : "border-l-primary";

            const bgColor = isUrgent
              ? "bg-destructive/[0.03] hover:bg-destructive/[0.06]"
              : isHigh
              ? "bg-orange-500/[0.03] hover:bg-orange-500/[0.06]"
              : "bg-primary/[0.02] hover:bg-primary/[0.04]";

            return (
              <Card
                key={b.id}
                className={`p-3.5 border-l-[3px] cursor-pointer transition-all ${borderColor} ${bgColor}`}
                onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
              >
                <div className="space-y-2">
                  {/* Top row: code + priority */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {b.sequential_code && (
                        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
                          {b.sequential_code}
                        </span>
                      )}
                      {isUrgent && (
                        <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[9px] px-1.5 py-0 h-4 gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Urgente
                        </Badge>
                      )}
                      {isHigh && (
                        <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border-orange-300/40 border text-[9px] px-1.5 py-0 h-4">
                          Alta
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 px-2.5 text-xs gap-1 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartBudget(b.id, "in_progress");
                      }}
                    >
                      <Play className="h-3 w-3" />
                      Começar
                    </Button>
                  </div>

                  {/* Client name */}
                  <p className="text-sm font-medium text-foreground truncate">{b.client_name}</p>

                  {/* Project name if different from client */}
                  {b.project_name && b.project_name !== b.client_name && (
                    <p className="text-xs text-muted-foreground truncate">{b.project_name}</p>
                  )}

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    {b.property_type && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {b.property_type}
                      </span>
                    )}
                    {b.metragem && (
                      <span className="flex items-center gap-0.5">
                        <Ruler className="h-3 w-3 shrink-0" />
                        {b.metragem}
                      </span>
                    )}
                    {b.bairro && (
                      <span className="truncate">{b.bairro}</span>
                    )}
                  </div>

                  {/* Time ago */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
