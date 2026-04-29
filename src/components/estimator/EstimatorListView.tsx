import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { InlineEdit } from "@/components/ui/inline-edit";
import { Checkbox } from "@/components/ui/checkbox";
import { useRevisionRequests } from "@/hooks/useRevisionRequests";
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
  ChevronRight,
  Ruler,
  MapPin,
  Eye,
  
} from "lucide-react";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  STATUS_GROUPS,
  VALID_INTERNAL_STATUSES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { format, formatDistanceToNow, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_OPTIONS = VALID_INTERNAL_STATUSES.map((s) => ({
  value: s,
  label: `${INTERNAL_STATUSES[s].icon} ${INTERNAL_STATUSES[s].label}`,
}));

const PRIORITY_OPTIONS = (Object.keys(PRIORITIES) as Priority[]).map((p) => ({
  value: p,
  label: PRIORITIES[p].label,
}));

const PENDING_STATUSES: readonly string[] = STATUS_GROUPS.PENDING;
const IN_PROGRESS_STATUSES: readonly string[] = STATUS_GROUPS.ACTIVE_WORK;
const DELIVERED_STATUSES: string[] = [...STATUS_GROUPS.DELIVERED, ...STATUS_GROUPS.COMMERCIAL_ADVANCED];
const FINISHED_STATUSES: readonly string[] = STATUS_GROUPS.FINISHED;
const HIDDEN_BY_DEFAULT_STATUSES = new Set([...DELIVERED_STATUSES, ...FINISHED_STATUSES]);

type WorkflowStage = "overdue" | "pending" | "in_progress" | "other";

function getWorkflowStage(b: BudgetRow): WorkflowStage {
  if (
    b.due_at &&
    isPast(new Date(b.due_at)) &&
    !isToday(new Date(b.due_at)) &&
    !HIDDEN_BY_DEFAULT_STATUSES.has(b.internal_status)
  ) {
    return "overdue";
  }
  if ((STATUS_GROUPS.PENDING as readonly string[]).includes(b.internal_status)) return "pending";
  if ((STATUS_GROUPS.ACTIVE_WORK as readonly string[]).includes(b.internal_status)) return "in_progress";
  if ((STATUS_GROUPS.REVIEW as readonly string[]).includes(b.internal_status)) return "in_progress";
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
  public_id: string | null;
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
  onQuickUpdate: (
    budgetId: string,
    patch: Partial<Pick<BudgetRow, "internal_status" | "priority" | "due_at" | "briefing">>,
  ) => Promise<void> | void;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectMany: (ids: string[], checked: boolean) => void;
}

interface WorkflowGroup {
  key: WorkflowStage;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  borderAccent: string;
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
  onQuickUpdate,
  selectedIds,
  onToggleSelect,
  onToggleSelectMany,
}: EstimatorListViewProps) {
  const navigate = useNavigate();

  const isDefaultView = statusFilter === "all" && priorityFilter === "all" && !search;

  const revisionIds = useMemo(
    () => filtered.filter((b) => b.internal_status === "revision_requested").map((b) => b.id),
    [filtered]
  );
  const revisionInfoMap = useRevisionRequests(revisionIds);

  const groups = useMemo<WorkflowGroup[]>(() => {
    if (!isDefaultView) return [];

    const overdue: BudgetRow[] = [];
    const pending: BudgetRow[] = [];
    const inProgress: BudgetRow[] = [];
    const other: BudgetRow[] = [];

    for (const b of filtered) {
      const stage = getWorkflowStage(b);
      if (stage === "overdue") overdue.push(b);
      else if (stage === "pending") pending.push(b);
      else if (stage === "in_progress") inProgress.push(b);
      else other.push(b);
    }

    const result: WorkflowGroup[] = [];
    if (overdue.length > 0) {
      result.push({
        key: "overdue",
        label: "Atrasados",
        description: "Prazo ultrapassado — ação imediata",
        icon: <AlertTriangle className="h-4 w-4" />,
        accent: "text-destructive",
        borderAccent: "border-l-destructive",
        budgets: overdue,
      });
    }
    if (pending.length > 0) {
      result.push({
        key: "pending",
        label: "Pendentes",
        description: "Aguardando início de elaboração",
        icon: <Inbox className="h-4 w-4" />,
        accent: "text-primary",
        borderAccent: "border-l-primary",
        budgets: pending,
      });
    }
    if (inProgress.length > 0) {
      result.push({
        key: "in_progress",
        label: "Em Elaboração",
        description: "Trabalho em andamento",
        icon: <Hammer className="h-4 w-4" />,
        accent: "text-foreground",
        borderAccent: "border-l-foreground/30",
        budgets: inProgress,
      });
    }
    if (other.length > 0) {
      result.push({
        key: "other",
        label: "Outros",
        description: "Demais orçamentos ativos",
        icon: <Clock className="h-4 w-4" />,
        accent: "text-muted-foreground",
        borderAccent: "border-l-muted-foreground/30",
        budgets: other,
      });
    }
    return result;
  }, [filtered, isDefaultView]);

  const renderBudgetCard = (b: BudgetRow, compact = false) => {
    const status =
      INTERNAL_STATUSES[b.internal_status as InternalStatus] ??
      INTERNAL_STATUSES.assigned;
    const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
    const due = getDueInfo(b.due_at, b.internal_status);
    const isUrgent = b.priority === "urgente";
    const isOverdue = due.variant === "overdue";
    const timeAgo = b.created_at
      ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR })
      : null;

    const isSelected = selectedIds.has(b.id);

    return (
      <Card
        key={b.id}
        className={`px-4 py-3 hover:shadow-md transition-all border group cursor-pointer ${
          isSelected ? "ring-2 ring-primary/40 border-primary/40 bg-primary/5" : ""
        }`}
        onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
      >
        <div className="flex items-center gap-3">
          {/* Selection checkbox */}
          <div
            className="shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(b.id)}
              aria-label={`Selecionar ${b.project_name || b.client_name}`}
              className={`${isSelected ? "" : "opacity-40 group-hover:opacity-100"} transition-opacity`}
            />
          </div>
          {/* Left: main info */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Code + Name + Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {b.sequential_code && (
                <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">
                  {b.sequential_code}
                </span>
              )}
              <span className="font-medium font-display text-sm text-foreground truncate">
                {b.project_name || b.client_name}
              </span>
              <InlineEdit
                type="select"
                value={b.internal_status}
                options={STATUS_OPTIONS}
                ariaLabel="Editar status"
                onSave={(v) => {
                  if (!v || v === b.internal_status) return;
                  return onQuickUpdate(b.id, { internal_status: v as InternalStatus });
                }}
                display={
                  <Badge variant="secondary" className={`text-[10px] font-body px-1.5 py-0 h-[18px] ${status.color}`}>
                    {status.icon} {status.label}
                  </Badge>
                }
                className="!p-0 !m-0 hover:bg-transparent"
              />
              <InlineEdit
                type="select"
                value={b.priority}
                options={PRIORITY_OPTIONS}
                ariaLabel="Editar prioridade"
                onSave={(v) => {
                  if (!v || v === b.priority) return;
                  return onQuickUpdate(b.id, { priority: v as string });
                }}
                display={
                  isUrgent ? (
                    <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[9px] px-1 py-0 h-4 gap-0.5">
                      <Flame className="h-2.5 w-2.5" />
                      Urgente
                    </Badge>
                  ) : b.priority === "alta" ? (
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${prio.color}`}>
                      Alta
                    </Badge>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/70 font-body">
                      {prio.label}
                    </span>
                  )
                }
                className="!p-0 !m-0 hover:bg-transparent"
              />
              <InlineEdit
                type="date"
                value={b.due_at ? String(b.due_at).slice(0, 10) : null}
                ariaLabel="Editar data de validade"
                placeholder="Sem prazo"
                onSave={(v) => {
                  const next = v ? new Date(`${v}T23:59:59`).toISOString() : null;
                  return onQuickUpdate(b.id, { due_at: next });
                }}
                display={
                  due.label ? (
                    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 h-4 rounded-full border ${dueVariantStyles[due.variant]}`}>
                      <Calendar className="h-2.5 w-2.5" />
                      {due.label}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground/70">
                      <Calendar className="h-2.5 w-2.5" />
                      Sem prazo
                    </span>
                  )
                }
                className="!p-0 !m-0 hover:bg-transparent"
              />
              <BriefingQuickEdit
                value={b.briefing}
                onSave={(next) => onQuickUpdate(b.id, { briefing: next })}
                projectName={b.project_name || b.client_name}
              />

              {b.internal_status === "revision_requested" && (() => {
                const info = revisionInfoMap[b.id];
                const dateLabel = info
                  ? format(new Date(info.requestedAt), "dd MMM 'às' HH:mm", { locale: ptBR })
                  : null;
                const relative = info
                  ? formatDistanceToNow(new Date(info.requestedAt), { addSuffix: true, locale: ptBR })
                  : null;
                const preview = info?.instructions
                  ? info.instructions.length > 180
                    ? `${info.instructions.slice(0, 177)}…`
                    : info.instructions
                  : null;
                const badge = (
                  <Badge
                    className="bg-warning/10 text-warning border-warning/20 border text-[9px] px-1 py-0 h-4 gap-0.5 cursor-help"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Revisão
                    {info ? <span className="font-body normal-case">· {relative}</span> : null}
                  </Badge>
                );
                if (!info) return badge;
                return (
                  <TooltipProvider delayDuration={150}>
                    <Tooltip>
                      <TooltipTrigger asChild>{badge}</TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs space-y-1.5 p-3">
                        <p className="text-[11px] font-semibold font-display text-foreground">
                          Revisão solicitada
                        </p>
                        <p className="text-[11px] font-body text-muted-foreground">
                          <span className="font-medium text-foreground">{info.requestedByName}</span>
                          {" · "}
                          {dateLabel}
                        </p>
                        {preview && (
                          <p className="text-[11px] font-body text-foreground/90 whitespace-pre-wrap leading-snug pt-1 border-t border-border/60">
                            {preview}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })()}
              {(b.version_number ?? 1) > 1 && (
                <span className="text-[9px] font-mono text-muted-foreground px-1 py-0 h-4 rounded bg-muted border border-border inline-flex items-center">
                  V{b.version_number}
                </span>
              )}
            </div>

            {/* Row 2: Meta — compact */}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-body flex-wrap">
              {b.project_name && b.project_name !== b.client_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3 shrink-0" />
                  {b.client_name}
                </span>
              )}
              {(b.bairro || b.city) && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 shrink-0" />
                  {[b.bairro, b.city].filter(Boolean).join(", ")}
                </span>
              )}
              {b.property_type && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />
                  {b.property_type}
                </span>
              )}
              {b.metragem && (
                <span className="flex items-center gap-1">
                  <Ruler className="h-3 w-3 shrink-0" />
                  {b.metragem}
                </span>
              )}
              <span className="flex items-center gap-1" title="Comercial">
                <Handshake className="h-3 w-3 shrink-0" />
                {getProfileName(b.commercial_owner_id)}
              </span>
              <span className="flex items-center gap-1" title="Orçamentista responsável">
                <UserCog className="h-3 w-3 shrink-0" />
                {getProfileName(b.estimator_owner_id)}
              </span>
              {b.internal_status === "revision_requested" && revisionInfoMap[b.id] && (
                <span
                  className="flex items-center gap-1 text-warning"
                  title={`Revisão solicitada por ${revisionInfoMap[b.id].requestedByName} em ${format(
                    new Date(revisionInfoMap[b.id].requestedAt),
                    "dd MMM 'às' HH:mm",
                    { locale: ptBR }
                  )}`}
                >
                  <RotateCcw className="h-3 w-3 shrink-0" />
                  {revisionInfoMap[b.id].requestedByName}
                </span>
              )}
              {timeAgo && <span>{timeAgo}</span>}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const nextActions: { label: string; targetStatus: InternalStatus; icon: React.ReactNode }[] = [];

              if (PENDING_STATUSES.includes(b.internal_status)) {
                nextActions.push({ label: "Iniciar", targetStatus: "in_progress", icon: <Clock className="h-3 w-3" /> });
              } else if (IN_PROGRESS_STATUSES.includes(b.internal_status)) {
                nextActions.push({ label: "Revisão", targetStatus: "ready_for_review", icon: <CheckCircle2 className="h-3 w-3" /> });
              } else if ((STATUS_GROUPS.REVIEW as readonly string[]).includes(b.internal_status)) {
                nextActions.push({ label: "Entregar", targetStatus: "delivered_to_sales", icon: <Send className="h-3 w-3" /> });
              }

              return nextActions.map((a) => (
                <Button
                  key={a.targetStatus}
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1 px-2.5"
                  onClick={() => onRequestStatusChange(b.id, a.targetStatus)}
                >
                  {a.icon}
                  <span className="hidden sm:inline">{a.label}</span>
                </Button>
              ));
            })()}

            {b.public_id && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary hover:bg-primary/10"
                onClick={() => window.open(getPublicBudgetUrl(b.public_id!), "_blank", "noopener,noreferrer")}
                title="Ver orçamento público"
                aria-label="Ver orçamento público"
              >
                <Eye className="h-3.5 w-3.5" />
              </Button>
            )}

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
                  {b.internal_status !== "delivered_to_sales" && (
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
                  className="h-7 w-7 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              }
            />

            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden sm:block" />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      {/* Hidden budgets banner */}
      {statusFilter === "all" && (counts.delivered + counts.finished) > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-md bg-muted/40 text-xs font-body text-muted-foreground">
          <span>
            {counts.delivered + counts.finished} entregue{(counts.delivered + counts.finished) !== 1 ? "s" : ""}/encerrado{(counts.delivered + counts.finished) !== 1 ? "s" : ""} oculto{(counts.delivered + counts.finished) !== 1 ? "s" : ""}
          </span>
          <Button
            variant="link"
            size="sm"
            className="text-[11px] h-auto p-0 gap-1 text-primary"
            onClick={() => onSetStatusFilter("_delivered")}
          >
            Ver →
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <Inbox className="h-7 w-7 text-muted-foreground" />
          </div>
          <h2 className="text-base font-semibold font-display text-foreground mb-1">
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
            <section key={group.key}>
              {/* Group header */}
              {(() => {
                const groupIds = group.budgets.map((b) => b.id);
                const allSelected = groupIds.length > 0 && groupIds.every((id) => selectedIds.has(id));
                const someSelected = !allSelected && groupIds.some((id) => selectedIds.has(id));
                return (
                  <div className={`flex items-center gap-2 mb-2 pl-1 border-l-2 ${group.borderAccent}`}>
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={(c) => onToggleSelectMany(groupIds, c === true)}
                      aria-label={`Selecionar todos do grupo ${group.label}`}
                      className="ml-2"
                    />
                    <span className={`${group.accent}`}>{group.icon}</span>
                    <h3 className={`text-xs font-semibold font-display uppercase tracking-wider ${group.accent}`}>
                      {group.label}
                    </h3>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-[14px] font-mono border-current">
                      {group.budgets.length}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground font-body hidden sm:inline">
                      {group.description}
                    </span>
                  </div>
                );
              })()}
              {/* Cards */}
              <div className="space-y-1.5">
                {group.budgets.map((b) => renderBudgetCard(b, true))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Flat list (when filtering/searching) */}
      {!loading && filtered.length > 0 && !isDefaultView && (
        <div className="space-y-1.5">
          {filtered.map((b) => renderBudgetCard(b))}
        </div>
      )}
    </>
  );
}

interface BriefingQuickEditProps {
  value: string | null;
  projectName: string;
  onSave: (next: string | null) => Promise<void> | void;
}

function BriefingQuickEdit({ value, projectName, onSave }: BriefingQuickEditProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  const hasBriefing = !!(value && value.trim());

  async function handleSave() {
    const next = draft.trim() ? draft.trim() : null;
    if (next === (value ?? null)) {
      setOpen(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(next);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value ?? "");
        setOpen(o);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          aria-label={hasBriefing ? "Editar briefing" : "Adicionar briefing"}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 h-4 text-[9px] font-body transition-colors ${
            hasBriefing
              ? "border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
              : "border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/50"
          }`}
        >
          <FileText className="h-2.5 w-2.5" />
          {hasBriefing ? "Briefing" : "+ briefing"}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[min(420px,calc(100vw-2rem))] p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="space-y-0.5">
          <p className="text-[11px] font-semibold font-display text-foreground">Briefing</p>
          <p className="text-[10px] text-muted-foreground font-body truncate">{projectName}</p>
        </div>
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Resumo da demanda, escopo, observações…"
          rows={6}
          className="text-xs font-body resize-y"
          autoFocus
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-7 text-xs"
            onClick={handleSave}
            disabled={saving}
          >
            Salvar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
