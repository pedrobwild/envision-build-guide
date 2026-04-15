import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Calendar,
  User,
  Building2,
  Inbox,
  Clock,
  MoreVertical,
  FileText,
  CheckCircle2,
  Send,
  UserCog,
  Handshake,
  RotateCcw,
  AlertTriangle,
  Flame,
  Hammer,
  ClipboardCheck,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  STATUS_GROUPS,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PENDING_STATUSES: readonly string[] = STATUS_GROUPS.PENDING;
const IN_PROGRESS_STATUSES: readonly string[] = STATUS_GROUPS.ACTIVE_WORK;
const DELIVERED_STATUSES: string[] = [...STATUS_GROUPS.DELIVERED, ...STATUS_GROUPS.COMMERCIAL_ADVANCED];
const FINISHED_STATUSES: readonly string[] = STATUS_GROUPS.FINISHED;
const HIDDEN_BY_DEFAULT_STATUSES = new Set([...DELIVERED_STATUSES, ...FINISHED_STATUSES]);

type WorkflowStage = "overdue" | "in_progress" | "review" | "other";

function getWorkflowStage(b: BudgetRow): WorkflowStage {
  // Overdue takes precedence
  if (
    b.due_at &&
    isPast(new Date(b.due_at)) &&
    !isToday(new Date(b.due_at)) &&
    !HIDDEN_BY_DEFAULT_STATUSES.has(b.internal_status)
  ) {
    return "overdue";
  }
  if ((STATUS_GROUPS.ACTIVE_WORK as readonly string[]).includes(b.internal_status)) return "in_progress";
  if ((STATUS_GROUPS.REVIEW as readonly string[]).includes(b.internal_status)) return "review";
  return "other";
}

function getDueInfo(dueAt: string | null, internalStatus?: string) {
  if (!dueAt) return { label: null, variant: "default" as const };
  const dueDate = new Date(dueAt);
  const days = differenceInCalendarDays(dueDate, new Date());
  const isDelivered = internalStatus ? HIDDEN_BY_DEFAULT_STATUSES.has(internalStatus) : false;

  if (isPast(dueDate) && !isToday(dueDate)) {
    if (isDelivered) return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
    return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" as const };
  }
  if (isToday(dueDate))
    return { label: "Vence hoje", variant: isDelivered ? "default" as const : "today" as const };
  if (days <= 2)
    return { label: `${days}d restante${days > 1 ? "s" : ""}`, variant: isDelivered ? "default" as const : "soon" as const };
  return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
}

const dueVariantStyles = {
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  today: "bg-warning/10 text-warning border-warning/20",
  soon: "bg-warning/10 text-warning border-warning/20",
  default: "text-muted-foreground",
};

export interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  internal_status: InternalStatus;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  briefing: string | null;
  demand_context: string | null;
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
  sequential_code: string | null;
  metragem?: string | null;
}

interface EstimatorListViewProps {
  filtered: BudgetRow[];
  loading: boolean;
  search: string;
  statusFilter: string;
  priorityFilter: string;
  counts: { delivered: number; finished: number };
  isAdmin: boolean;
  getProfileName: (id: string | null) => string;
  onRequestStatusChange: (budgetId: string, newStatus: InternalStatus) => void;
  onSetStatusFilter: (value: string) => void;
  onOpenAssignDialog: (budgetId: string, type: "estimator" | "commercial", currentValue: string | null) => void;
  onRefresh: () => void;
}

interface WorkflowGroup {
  key: WorkflowStage;
  label: string;
  icon: React.ReactNode;
  accent: string;
  budgets: BudgetRow[];
}

export function EstimatorListView({
  filtered,
  loading,
  search,
  statusFilter,
  priorityFilter,
  counts,
  isAdmin,
  getProfileName,
  onRequestStatusChange,
  onSetStatusFilter,
  onOpenAssignDialog,
  onRefresh,
}: EstimatorListViewProps) {
  const navigate = useNavigate();

  // Group budgets by workflow stage when showing default view
  const isDefaultView = statusFilter === "all" && priorityFilter === "all" && !search;

  const groups = useMemo<WorkflowGroup[]>(() => {
    if (!isDefaultView) return [];

    const overdue: BudgetRow[] = [];
    const inProgress: BudgetRow[] = [];
    const review: BudgetRow[] = [];
    const other: BudgetRow[] = [];

    for (const b of filtered) {
      const stage = getWorkflowStage(b);
      if (stage === "overdue") overdue.push(b);
      else if (stage === "in_progress") inProgress.push(b);
      else if (stage === "review") review.push(b);
      else other.push(b);
    }

    const result: WorkflowGroup[] = [];
    if (overdue.length > 0) {
      result.push({
        key: "overdue",
        label: "Atrasados — Ação Imediata",
        icon: <AlertTriangle className="h-4 w-4" />,
        accent: "text-destructive",
        budgets: overdue,
      });
    }
    if (inProgress.length > 0) {
      result.push({
        key: "in_progress",
        label: "Em Elaboração",
        icon: <Hammer className="h-4 w-4" />,
        accent: "text-primary",
        budgets: inProgress,
      });
    }
    if (review.length > 0) {
      result.push({
        key: "review",
        label: "Aguardando Revisão",
        icon: <ClipboardCheck className="h-4 w-4" />,
        accent: "text-warning",
        budgets: review,
      });
    }
    if (other.length > 0) {
      result.push({
        key: "other",
        label: "Pendentes",
        icon: <Inbox className="h-4 w-4" />,
        accent: "text-muted-foreground",
        budgets: other,
      });
    }
    return result;
  }, [filtered, isDefaultView]);

  const renderBudgetCard = (b: BudgetRow) => {
    const status =
      INTERNAL_STATUSES[b.internal_status as InternalStatus] ??
      INTERNAL_STATUSES.assigned;
    const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
    const due = getDueInfo(b.due_at, b.internal_status);
    const isUrgent = b.priority === "urgente";
    const isOverdue = due.variant === "overdue";

    const cardBorder = isOverdue
      ? "border-l-[3px] border-l-destructive"
      : isUrgent
      ? "border-l-[3px] border-l-destructive/60"
      : b.priority === "alta"
      ? "border-l-[3px] border-l-orange-400"
      : "";

    return (
      <Card
        key={b.id}
        className={`p-4 hover:shadow-md transition-shadow border group ${cardBorder}`}
      >
        <div className="flex items-start gap-4">
          {/* Main content */}
          <div
            className="flex-1 min-w-0 cursor-pointer"
            onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
          >
            {/* Row 1: Project + badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {b.sequential_code && (
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {b.sequential_code}
                </span>
              )}
              <span className="font-semibold font-display text-foreground truncate">
                {b.project_name || "Sem nome"}
              </span>
              <Badge variant="secondary" className={`text-xs font-body ${status.color}`}>
                {status.icon} {status.label}
              </Badge>
              {b.priority !== "normal" && (
                <Badge variant="outline" className={`text-xs font-body ${prio.color}`}>
                  {isUrgent && <Flame className="h-3 w-3 mr-0.5" />}
                  {prio.label}
                </Badge>
              )}
              {due.label && (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-medium font-body px-2 py-0.5 rounded-full border ${dueVariantStyles[due.variant]}`}
                >
                  <Calendar className="h-3 w-3" />
                  {due.label}
                </span>
              )}
              {(b.version_number ?? 1) > 1 && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                  V{b.version_number}
                </span>
              )}
            </div>

            {b.internal_status === "revision_requested" && (
              <div className="flex items-center gap-1.5 mb-1">
                <Badge className="bg-warning/10 text-warning border-warning/20 border text-xs font-body gap-1 px-2 py-0.5">
                  <RotateCcw className="h-3 w-3" />
                  Revisão solicitada
                </Badge>
              </div>
            )}

            {/* Row 2: Meta */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-body flex-wrap">
              <span className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {b.client_name}
              </span>
              {(b.bairro || b.city) && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3.5 w-3.5" />
                  {[b.bairro, b.city].filter(Boolean).join(", ")}
                </span>
              )}
              <span className="flex items-center gap-1" title="Comercial responsável">
                <Handshake className="h-3.5 w-3.5" />
                {getProfileName(b.commercial_owner_id)}
              </span>
              <span className="flex items-center gap-1" title="Orçamentista responsável">
                <UserCog className="h-3.5 w-3.5" />
                {getProfileName(b.estimator_owner_id)}
              </span>
              {b.created_at && (
                <span className="text-xs">
                  Criado {format(new Date(b.created_at), "dd/MM/yy")}
                </span>
              )}
              {b.updated_at && (
                <span className="text-xs">
                  Atualizado {format(new Date(b.updated_at), "dd/MM HH:mm")}
                </span>
              )}
            </div>
          </div>

          {/* Quick stage actions */}
          <div className="flex items-center gap-1 shrink-0">
            {(() => {
              const nextActions: { label: string; targetStatus: InternalStatus; icon: React.ReactNode; variant: "default" | "outline" | "secondary" }[] = [];

              if (PENDING_STATUSES.includes(b.internal_status)) {
                nextActions.push({ label: "Iniciar", targetStatus: "in_progress", icon: <Clock className="h-3 w-3" />, variant: "default" });
              } else if (IN_PROGRESS_STATUSES.includes(b.internal_status)) {
                nextActions.push({ label: "Revisão", targetStatus: "ready_for_review", icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" });
              } else if ((STATUS_GROUPS.REVIEW as readonly string[]).includes(b.internal_status)) {
                nextActions.push({ label: "Entregar", targetStatus: "delivered_to_sales", icon: <Send className="h-3 w-3" />, variant: "default" });
              }

              return nextActions.map((a) => (
                <Button
                  key={a.targetStatus}
                  variant={a.variant}
                  size="sm"
                  className="h-7 text-xs gap-1 px-2.5"
                  onClick={(e) => { e.stopPropagation(); onRequestStatusChange(b.id, a.targetStatus); }}
                >
                  {a.icon}
                  {a.label}
                </Button>
              ));
            })()}

            <BudgetActionsMenu
              budget={b}
              onRefresh={onRefresh}
              fromPath="/admin/producao"
              extraItems={
                <>
                  {b.briefing && (
                    <DropdownMenuItem
                      onClick={() => {
                        toast.info(b.briefing, {
                          duration: 10000,
                          description: `Briefing — ${b.project_name}`,
                        });
                      }}
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Ver briefing
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {!PENDING_STATUSES.includes(b.internal_status) && (
                    <DropdownMenuItem onClick={() => onRequestStatusChange(b.id, "assigned")}>
                      <Inbox className="h-4 w-4 mr-2" />
                      Mover p/ Pendente
                    </DropdownMenuItem>
                  )}
                  {!IN_PROGRESS_STATUSES.includes(b.internal_status) && (
                    <DropdownMenuItem onClick={() => onRequestStatusChange(b.id, "in_progress")}>
                      <Clock className="h-4 w-4 mr-2" />
                      Mover p/ Em Elaboração
                    </DropdownMenuItem>
                  )}
                  {b.internal_status !== "ready_for_review" && (
                    <DropdownMenuItem onClick={() => onRequestStatusChange(b.id, "ready_for_review")}>
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Mover p/ Em Revisão
                    </DropdownMenuItem>
                  )}
                  {!DELIVERED_STATUSES.includes(b.internal_status) && (
                    <DropdownMenuItem onClick={() => onRequestStatusChange(b.id, "delivered_to_sales")}>
                      <Send className="h-4 w-4 mr-2" />
                      Mover p/ Entregue
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onOpenAssignDialog(b.id, "estimator", b.estimator_owner_id)}>
                        <UserCog className="h-4 w-4 mr-2" />
                        Atribuir orçamentista
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onOpenAssignDialog(b.id, "commercial", b.commercial_owner_id)}>
                        <Handshake className="h-4 w-4 mr-2" />
                        Atribuir comercial
                      </DropdownMenuItem>
                    </>
                  )}
                </>
              }
              trigger={
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              }
            />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      {/* Hidden budgets banner */}
      {statusFilter === "all" && (counts.delivered + counts.finished) > 0 && (
        <div className="flex items-center justify-between px-3 py-2 rounded-md bg-muted/50 text-sm font-body text-muted-foreground">
          <span>
            {counts.delivered + counts.finished} orçamento{(counts.delivered + counts.finished) !== 1 ? "s" : ""} entregue{(counts.delivered + counts.finished) !== 1 ? "s" : ""}/encerrado{(counts.delivered + counts.finished) !== 1 ? "s" : ""} não {(counts.delivered + counts.finished) !== 1 ? "estão visíveis" : "está visível"} nesta visualização.
          </span>
          <Button
            variant="link"
            size="sm"
            className="text-xs h-auto p-0 gap-1 text-primary"
            onClick={() => onSetStatusFilter("_delivered")}
          >
            Ver orçamentos entregues →
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Inbox className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold font-display text-foreground mb-1">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "Nenhum resultado"
              : "Nenhuma demanda atribuída"}
          </h2>
          <p className="text-sm text-muted-foreground font-body max-w-sm">
            {search || statusFilter !== "all" || priorityFilter !== "all"
              ? "Ajuste os filtros para encontrar o que procura."
              : "Quando um orçamento for atribuído a você, ele aparecerá aqui."}
          </p>
        </div>
      )}

      {/* Grouped workflow view (default) */}
      {!loading && filtered.length > 0 && isDefaultView && (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className={group.accent}>{group.icon}</span>
                <h3 className={`text-xs font-semibold font-display uppercase tracking-wider ${group.accent}`}>
                  {group.label}
                </h3>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                  {group.budgets.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {group.budgets.map(renderBudgetCard)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Flat list (when filtering/searching) */}
      {!loading && filtered.length > 0 && !isDefaultView && (
        <div className="space-y-2">
          {filtered.map(renderBudgetCard)}
        </div>
      )}
    </>
  );
}
