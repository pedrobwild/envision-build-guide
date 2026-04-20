import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { MobileSwipeableKanban } from "@/components/admin/MobileSwipeableKanban";
import { CompactKanbanCard } from "@/components/admin/CompactKanbanCard";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import {
  Clock,
  CheckCircle2,
  Send,
  ThumbsUp,
  XCircle,
  User,
  Building2,
  Calendar,
  RotateCcw,
  AlertTriangle,
  Lock,
  Pin,
  FileText,
  Eye,
  Hammer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { INTERNAL_STATUSES, PRIORITIES, STATUS_GROUPS, type InternalStatus, type Priority } from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotBadge } from "@/components/admin/RotBadge";
import type { BudgetPipelineMetaRow } from "@/hooks/useBudgetPipelineMeta";

// Commercial Kanban column definitions
const KANBAN_COLUMNS = [
  {
    id: "mql",
    label: "MQL",
    icon: User,
    statuses: ["mql"] as InternalStatus[],
    accent: "border-t-slate-400",
    headerColor: "text-slate-600",
    bgColor: "bg-slate-50",
    targetStatus: "mql" as InternalStatus,
    locked: false,
  },
  {
    id: "qualificacao",
    label: "Qualificação",
    icon: Eye,
    statuses: ["qualificacao"] as InternalStatus[],
    accent: "border-t-cyan-500",
    headerColor: "text-cyan-700",
    bgColor: "bg-cyan-50/50",
    targetStatus: "qualificacao" as InternalStatus,
    locked: false,
  },
  {
    id: "lead",
    label: "Lead",
    icon: User,
    statuses: ["lead"] as InternalStatus[],
    accent: "border-t-sky-500",
    headerColor: "text-sky-700",
    bgColor: "bg-sky-50/50",
    targetStatus: "lead" as InternalStatus,
    locked: false,
  },
  {
    id: "validacao_briefing",
    label: "Validação de Briefing",
    icon: FileText,
    statuses: ["validacao_briefing"] as InternalStatus[],
    accent: "border-t-indigo-500",
    headerColor: "text-indigo-700",
    bgColor: "bg-indigo-50/50",
    targetStatus: "validacao_briefing" as InternalStatus,
    locked: false,
  },
  {
    id: "solicitado",
    label: "Solicitado",
    icon: FileText,
    statuses: ["requested", "novo"] as InternalStatus[],
    accent: "border-t-primary",
    headerColor: "text-primary",
    bgColor: "bg-primary/5",
    targetStatus: "requested" as InternalStatus,
    locked: false,
  },
  {
    id: "em_elaboracao",
    label: "Em Elaboração",
    icon: Hammer,
    statuses: ["triage", "assigned", "in_progress", "waiting_info", "revision_requested", "ready_for_review"] as InternalStatus[],
    accent: "border-t-warning",
    headerColor: "text-warning",
    bgColor: "bg-warning/5",
    locked: true,
  },
  {
    id: "entregue",
    label: "Entregue",
    icon: CheckCircle2,
    statuses: ["delivered_to_sales"] as InternalStatus[],
    accent: "border-t-success",
    headerColor: "text-success",
    bgColor: "bg-success/5",
    targetStatus: "delivered_to_sales" as InternalStatus,
    locked: false,
  },
  {
    id: "enviado",
    label: "Enviado ao Cliente",
    icon: Send,
    statuses: ["sent_to_client"] as InternalStatus[],
    accent: "border-t-success",
    headerColor: "text-success",
    bgColor: "bg-success/5",
    targetStatus: "sent_to_client" as InternalStatus,
    locked: false,
  },
  {
    id: "minuta",
    label: "Minuta Solicitada",
    icon: FileText,
    statuses: ["minuta_solicitada"] as InternalStatus[],
    accent: "border-t-violet-500",
    headerColor: "text-violet-600",
    bgColor: "bg-violet-50/50",
    targetStatus: "minuta_solicitada" as InternalStatus,
    locked: false,
  },
  {
    id: "fechado",
    label: "Contrato Fechado",
    icon: ThumbsUp,
    statuses: ["contrato_fechado"] as InternalStatus[],
    accent: "border-t-success",
    headerColor: "text-success",
    bgColor: "bg-success/5",
    targetStatus: "contrato_fechado" as InternalStatus,
    locked: false,
  },
  {
    id: "perdido",
    label: "Perdido",
    icon: XCircle,
    statuses: ["lost"] as InternalStatus[],
    accent: "border-t-muted-foreground",
    headerColor: "text-muted-foreground",
    bgColor: "bg-muted/30",
    targetStatus: "lost" as InternalStatus,
    locked: false,
  },
] as const;

interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
  sequential_code?: string | null;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  internal_status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  public_id: string | null;
  status: string;
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
  is_published_version: boolean | null;
}

export type DueFilter = "all" | "overdue" | "due_soon";

interface KanbanBoardProps {
  budgets: BudgetRow[];
  onStatusChange: (budgetId: string, newStatus: InternalStatus) => Promise<void>;
  onCardClick: (budgetId: string) => void;
  getProfileName: (id: string | null) => string;
  dueFilter?: DueFilter;
  syncedBudgetIds?: Set<string>;
  /** Mapa budgetId → meta de pipeline (dias parados, etc.). */
  pipelineMeta?: Map<string, BudgetPipelineMetaRow>;
}

function getColumnForBudget(internalStatus: string) {
  return KANBAN_COLUMNS.find((col) =>
    (col.statuses as readonly string[]).includes(internalStatus)
  );
}

type DueVariant = "overdue" | "today" | "soon" | "ok" | "default";

const POST_DELIVERY_STATUSES: Set<string> = new Set([
  ...STATUS_GROUPS.DELIVERED,
  ...STATUS_GROUPS.COMMERCIAL_ADVANCED,
  ...STATUS_GROUPS.FINISHED,
]);

function getDueInfo(dueAt: string | null, internalStatus?: string): { label: string; variant: DueVariant } | null {
  if (!dueAt) return null;
  const dueDate = new Date(dueAt);
  const days = differenceInCalendarDays(dueDate, new Date());
  const isPostDelivery = internalStatus ? POST_DELIVERY_STATUSES.has(internalStatus) : false;
  if (isPast(dueDate) && !isToday(dueDate)) {
    if (isPostDelivery) return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" };
    return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" };
  }
  if (isToday(dueDate)) return { label: isPostDelivery ? format(dueDate, "dd MMM", { locale: ptBR }) : "Vence hoje", variant: isPostDelivery ? "default" : "today" };
  if (days <= 2) return { label: isPostDelivery ? format(dueDate, "dd MMM", { locale: ptBR }) : `${days}d`, variant: isPostDelivery ? "default" : "soon" };
  if (days <= 7) return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "ok" };
  return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" };
}

const dueVariantStyles: Record<DueVariant, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-warning/10 text-warning",
  soon: "bg-warning/10 text-warning",
  ok: "bg-success/10 text-success",
  default: "text-muted-foreground bg-muted/50",
};

const dueBorderStyles: Record<DueVariant, string> = {
  overdue: "border-l-destructive",
  today: "border-l-warning",
  soon: "border-l-warning",
  ok: "border-l-success",
  default: "border-l-transparent",
};

function isHighPriority(priority: string): boolean {
  return priority === "urgente" || priority === "alta";
}

function sortBudgetsForColumn(budgets: BudgetRow[]): BudgetRow[] {
  const priorityOrder: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  return [...budgets].sort((a, b) => {
    const pa = priorityOrder[a.priority] ?? 2;
    const pb = priorityOrder[b.priority] ?? 2;
    const aHigh = pa <= 1 ? 0 : 1;
    const bHigh = pb <= 1 ? 0 : 1;
    if (aHigh !== bHigh) return aHigh - bHigh;
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    if (pa !== pb) return pa - pb;
    return 0;
  });
}

function matchesDueFilter(budget: BudgetRow, filter: DueFilter): boolean {
  if (filter === "all") return true;
  const due = getDueInfo(budget.due_at, budget.internal_status);
  // "overdue" matches the UI label "Vencidos / Hoje": past-due items and items due today.
  if (filter === "overdue") return due?.variant === "overdue" || due?.variant === "today";
  // "due_soon" matches the UI label "Próximos (≤2d)": items due in the next 1–2 days,
  // NOT including items already overdue or due today (those are in the "overdue" bucket).
  if (filter === "due_soon") return due?.variant === "soon";
  return true;
}

// Sub-section definitions for the "Em Elaboração" column
const EM_ELABORACAO_SUBSECTIONS = [
  {
    id: "em_producao",
    label: "Em Produção",
    statuses: ["triage", "assigned", "in_progress", "ready_for_review"],
    icon: null,
    headerClass: "text-xs font-medium text-muted-foreground uppercase tracking-wide",
    cardBorderClass: "",
  },
  {
    id: "aguardando",
    label: "Aguardando",
    statuses: ["waiting_info"],
    icon: Clock,
    headerClass: "text-xs font-medium text-warning uppercase tracking-wide",
    cardBorderClass: "border-l-2 border-l-warning",
  },
  {
    id: "revisao_solicitada",
    label: "Revisão Solicitada",
    statuses: ["revision_requested"],
    icon: RotateCcw,
    headerClass: "text-xs font-medium text-warning uppercase tracking-wide",
    cardBorderClass: "border-l-2 border-l-warning",
    tooltip: "Orçamento retornou para o orçamentista para revisão",
  },
] as const;

// --- Sub-section within a column ---
function SubSectionGroup({
  subsection,
  budgets,
  locked,
  onCardClick,
  getProfileName,
  compact = false,
  syncedBudgetIds = new Set(),
}: {
  subsection: typeof EM_ELABORACAO_SUBSECTIONS[number];
  budgets: BudgetRow[];
  locked: boolean;
  onCardClick: (id: string) => void;
  getProfileName: (id: string | null) => string;
  compact?: boolean;
  syncedBudgetIds?: Set<string>;
}) {
  const Icon = subsection.icon;
  const sorted = sortBudgetsForColumn(budgets);

  const header = (
    <div className="flex items-center gap-1.5 px-1 mb-2 mt-3">
      {Icon && <Icon className="h-3 w-3" />}
      <span className={subsection.headerClass}>{subsection.label}</span>
      <Badge variant="secondary" className="text-xs">{sorted.length}</Badge>
    </div>
  );

  return (
    <div>
      {"tooltip" in subsection && subsection.tooltip ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{header}</TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">{subsection.tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        header
      )}
      <div className="space-y-2">
        {sorted.map((b) => (
          <div key={b.id} className={subsection.cardBorderClass ? `rounded-md ${subsection.cardBorderClass}` : ""}>
            {compact ? (
              <CompactKanbanCard
                projectName={b.project_name}
                clientName={b.client_name}
                priority={b.priority}
                internalStatus={b.internal_status}
                dueAt={b.due_at}
                bairro={b.bairro}
                city={b.city}
                versionNumber={b.version_number}
                sequentialCode={b.sequential_code}
                commercialName={b.commercial_owner_id ? getProfileName(b.commercial_owner_id) : undefined}
                estimatorName={b.estimator_owner_id ? getProfileName(b.estimator_owner_id) : undefined}
                isSynced={syncedBudgetIds.has(b.id)}
                onClick={() => onCardClick(b.id)}
                onQuickAction={(action) => {
                  if (action === "open") onCardClick(b.id);
                  if (action === "copyLink" && b.public_id) {
                    navigator.clipboard.writeText(getPublicBudgetUrl(b.public_id));
                    toast.success("Link copiado!");
                  } else if (action === "copyLink") {
                    toast.error("Orçamento sem link público");
                  }
                }}
              />
            ) : (
              <DraggableCard
                budget={b}
                locked={locked}
                onClick={() => onCardClick(b.id)}
                getProfileName={getProfileName}
                isSynced={syncedBudgetIds.has(b.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Droppable Column ---
function KanbanColumn({
  column,
  budgets,
  onCardClick,
  getProfileName,
  dueFilter,
  syncedBudgetIds = new Set(),
}: {
  column: (typeof KANBAN_COLUMNS)[number];
  budgets: BudgetRow[];
  onCardClick: (id: string) => void;
  getProfileName: (id: string | null) => string;
  dueFilter: DueFilter;
  syncedBudgetIds?: Set<string>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id, disabled: column.locked });
  const Icon = column.icon;

  const filteredBudgets = budgets.filter(b => matchesDueFilter(b, dueFilter));
  const sorted = sortBudgetsForColumn(filteredBudgets);
  const overdueCount = filteredBudgets.filter(b => {
    const d = getDueInfo(b.due_at, b.internal_status);
    return d?.variant === "overdue" || d?.variant === "today";
  }).length;

  const isEmElaboracao = column.id === "em_elaboracao";

  // Pre-compute sub-section groups for em_elaboracao
  const subSectionData = useMemo(() => {
    if (!isEmElaboracao) return [];
    return EM_ELABORACAO_SUBSECTIONS.map(sub => ({
      sub,
      items: filteredBudgets.filter(b => (sub.statuses as readonly string[]).includes(b.internal_status)),
    })).filter(({ items }) => items.length > 0);
  }, [isEmElaboracao, filteredBudgets]);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] w-[220px] lg:w-auto lg:flex-1 rounded-xl border border-border border-t-4 ${column.accent} ${column.bgColor} transition-shadow ${
        isOver && !column.locked ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-semibold font-body ${column.headerColor}`}>
          <Icon className="h-3.5 w-3.5" />
          <span className="truncate">{column.label}</span>
          {column.locked && <Lock className="h-3 w-3 ml-0.5 opacity-50" />}
        </div>
        <div className="flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="text-[10px] font-bold font-body bg-destructive/15 text-destructive rounded-full px-1.5 py-0.5 flex items-center gap-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {overdueCount}
            </span>
          )}
          <span className="text-xs font-bold font-display text-muted-foreground bg-background/80 rounded-full px-2 py-0.5">
            {sorted.length}
          </span>
        </div>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 px-2 pb-2" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {isEmElaboracao ? (
          /* Sub-sectioned layout for Em Elaboração */
          <div>
            {subSectionData.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground font-body">
                Nenhum orçamento
              </div>
            )}
            {subSectionData.map(({ sub, items }, idx) => (
              <div key={sub.id}>
                {idx > 0 && <Separator className="my-2" />}
                <SubSectionGroup
                  subsection={sub}
                  budgets={items}
                  locked={column.locked}
                  onCardClick={onCardClick}
                  getProfileName={getProfileName}
                  syncedBudgetIds={syncedBudgetIds}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Standard layout for other columns */
          <div className="space-y-2">
            {sorted.map((b, idx) => {
              const prevHighPrio = idx > 0 && isHighPriority(sorted[idx - 1].priority);
              const currHighPrio = isHighPriority(b.priority);
              const showDivider = idx > 0 && prevHighPrio && !currHighPrio;

              return (
                <div key={b.id}>
                  {showDivider && (
                    <div className="flex items-center gap-2 py-1 px-1">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-body">Demais</span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <DraggableCard
                    budget={b}
                    locked={column.locked}
                    onClick={() => onCardClick(b.id)}
                    getProfileName={getProfileName}
                    isSynced={syncedBudgetIds.has(b.id)}
                  />
                </div>
              );
            })}
            {sorted.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground font-body">
                Nenhum orçamento
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

// --- Draggable Card ---
function DraggableCard({
  budget,
  locked,
  onClick,
  getProfileName,
  isSynced,
}: {
  budget: BudgetRow;
  locked: boolean;
  onClick: () => void;
  getProfileName: (id: string | null) => string;
  isSynced?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: budget.id,
    disabled: locked,
    data: { budget },
  });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <KanbanCard budget={budget} isDragging={isDragging} locked={locked} onClick={onClick} getProfileName={getProfileName} isSynced={isSynced} />
    </div>
  );
}

function KanbanCard({
  budget: b,
  isDragging,
  locked,
  onClick,
  getProfileName,
  isSynced,
}: {
  budget: BudgetRow;
  isDragging?: boolean;
  locked: boolean;
  onClick: () => void;
  getProfileName: (id: string | null) => string;
  isSynced?: boolean;
}) {
  const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
  const due = getDueInfo(b.due_at, b.internal_status);
  const highPrio = isHighPriority(b.priority);
  const borderColor = due ? dueBorderStyles[due.variant] : "border-l-transparent";

  return (
    <Card
      className={`p-3 text-left transition-all border border-l-[3px] ${borderColor} ${
        isDragging ? "opacity-60 shadow-xl rotate-2 scale-105" : "hover:shadow-md"
      } ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${
        highPrio ? "ring-1 ring-warning/30" : ""
      }`}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        {highPrio && (
          <Pin className="h-3 w-3 shrink-0 text-warning mt-0.5 fill-warning" />
        )}
        <span className="font-semibold font-display text-xs text-foreground leading-tight line-clamp-2 flex-1">
          {b.project_name || "Sem nome"}
        </span>
        {b.priority !== "normal" && (
          <Badge variant="outline" className={`text-[10px] px-1 py-0 shrink-0 ${prio.color}`}>
            {prio.label}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-body mb-1">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{b.client_name}</span>
      </div>

      {(b.bairro || b.city) && (
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-body mb-1">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{[b.bairro, b.city].filter(Boolean).join(", ")}</span>
        </div>
      )}

      {(b.commercial_owner_id || b.estimator_owner_id) && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-body mb-1.5 flex-wrap">
          {b.commercial_owner_id && (
            <span className="inline-flex items-center gap-0.5 bg-muted/60 rounded px-1.5 py-0.5" title="Comercial">
              💼 {getProfileName(b.commercial_owner_id)}
            </span>
          )}
          {b.estimator_owner_id && (
            <span className="inline-flex items-center gap-0.5 bg-muted/60 rounded px-1.5 py-0.5" title="Orçamentista">
              📐 {getProfileName(b.estimator_owner_id)}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {due && (
          <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium font-body px-1.5 py-0.5 rounded-full ${dueVariantStyles[due.variant]}`}>
            <Calendar className="h-2.5 w-2.5" />
            {due.label}
          </span>
        )}
        {(b.version_number ?? 1) > 1 && (
          <span className="text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
            V{b.version_number}
          </span>
        )}
        {isSynced && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium font-body px-1.5 py-0.5 rounded-full bg-success/10 text-success" title="Sincronizado com Portal BWild">
            ✓ Portal
          </span>
        )}
      </div>
    </Card>
  );
}

// --- Main Board ---
export function KanbanBoard({ budgets, onStatusChange, onCardClick, getProfileName, dueFilter = "all", syncedBudgetIds = new Set() }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileColIndex, setMobileColIndex] = useState(0);
  const isMobile = useIsMobile();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const activeBudget = activeId ? budgets.find((b) => b.id === activeId) : null;

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const budget = budgets.find((b) => b.id === active.id);
      if (!budget) return;

      const targetColumn = KANBAN_COLUMNS.find((col) => col.id === over.id);
      if (!targetColumn || targetColumn.locked) return;

      const currentColumn = getColumnForBudget(budget.internal_status);
      if (currentColumn?.id === targetColumn.id) return;

      const sourceColumn = KANBAN_COLUMNS.find((col) =>
        (col.statuses as readonly string[]).includes(budget.internal_status)
      );
      if (sourceColumn?.locked) return;

      if ("targetStatus" in targetColumn && targetColumn.targetStatus) {
        await onStatusChange(budget.id, targetColumn.targetStatus);
      }
    },
    [budgets, onStatusChange]
  );

  const columnBudgets = useCallback(
    (col: (typeof KANBAN_COLUMNS)[number]) =>
      budgets.filter((b) => (col.statuses as readonly string[]).includes(b.internal_status)),
    [budgets]
  );

  const mobileColumns = useMemo(() =>
    KANBAN_COLUMNS.map((col) => {
      const items = columnBudgets(col).filter(b => matchesDueFilter(b, dueFilter));
      const overdueCount = items.filter((b) => {
        const d = getDueInfo(b.due_at, b.internal_status);
        return d?.variant === "overdue" || d?.variant === "today";
      }).length;
      return {
        id: col.id,
        label: col.label,
        icon: col.icon,
        accent: col.accent,
        headerColor: col.headerColor,
        count: items.length,
        overdueCount,
      };
    }),
    [columnBudgets, dueFilter]
  );

  // Mobile: swipeable single-column view
  if (isMobile) {
    return (
      <MobileSwipeableKanban
        columns={mobileColumns}
        activeIndex={mobileColIndex}
        onChangeIndex={setMobileColIndex}
      >
        {(colIndex) => {
          const col = KANBAN_COLUMNS[colIndex];
          const items = columnBudgets(col).filter(b => matchesDueFilter(b, dueFilter));
          const sorted = sortBudgetsForColumn(items);
          const isEmElaboracao = col.id === "em_elaboracao";

          return (
            <div className={`rounded-xl border border-border border-t-4 ${col.accent} ${col.bgColor} min-h-[300px]`}>
              <ScrollArea className="px-2 pb-2 pt-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
                {isEmElaboracao ? (
                  <div>
                    {(() => {
                      const subData = EM_ELABORACAO_SUBSECTIONS.map(sub => ({
                        sub,
                        items: items.filter(b => (sub.statuses as readonly string[]).includes(b.internal_status)),
                      })).filter(({ items }) => items.length > 0);

                      if (subData.length === 0) return (
                        <div className="py-8 text-center text-xs text-muted-foreground font-body">Nenhum orçamento</div>
                      );

                      return subData.map(({ sub, items: subItems }, idx) => (
                        <div key={sub.id}>
                          {idx > 0 && <Separator className="my-2" />}
                          <SubSectionGroup
                            subsection={sub}
                            budgets={subItems}
                            locked={col.locked}
                            onCardClick={onCardClick}
                            getProfileName={getProfileName}
                            compact
                            syncedBudgetIds={syncedBudgetIds}
                          />
                        </div>
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {sorted.map((b, idx) => {
                      const prevHigh = idx > 0 && isHighPriority(sorted[idx - 1].priority);
                      const currHigh = isHighPriority(b.priority);
                      const showDivider = idx > 0 && prevHigh && !currHigh;
                      return (
                        <div key={b.id}>
                          {showDivider && (
                            <div className="flex items-center gap-2 py-1 px-1">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-body">Demais</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <CompactKanbanCard
                            projectName={b.project_name}
                            clientName={b.client_name}
                            priority={b.priority}
                            internalStatus={b.internal_status}
                            dueAt={b.due_at}
                            bairro={b.bairro}
                            city={b.city}
                            versionNumber={b.version_number}
                            sequentialCode={b.sequential_code}
                            commercialName={b.commercial_owner_id ? getProfileName(b.commercial_owner_id) : undefined}
                            estimatorName={b.estimator_owner_id ? getProfileName(b.estimator_owner_id) : undefined}
                            isSynced={syncedBudgetIds.has(b.id)}
                            onClick={() => onCardClick(b.id)}
                            onQuickAction={(action) => {
                              if (action === "open") onCardClick(b.id);
                              if (action === "copyLink") {
                                if (b.public_id) {
                                  navigator.clipboard.writeText(getPublicBudgetUrl(b.public_id));
                                  toast.success("Link copiado!");
                                } else {
                                  toast.error("Orçamento sem link público");
                                }
                              }
                            }}
                          />
                        </div>
                      );
                    })}
                    {sorted.length === 0 && (
                      <div className="py-8 text-center text-xs text-muted-foreground font-body">Nenhum orçamento</div>
                    )}
                  </div>
                )}
              </ScrollArea>
            </div>
          );
        }}
      </MobileSwipeableKanban>
    );
  }

  // Desktop: horizontal scroll with drag & drop
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {KANBAN_COLUMNS.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            budgets={columnBudgets(col)}
            onCardClick={onCardClick}
            getProfileName={getProfileName}
            dueFilter={dueFilter}
            syncedBudgetIds={syncedBudgetIds}
          />
        ))}
      </div>

      <DragOverlay>
        {activeBudget && (
          <div className="w-[220px]">
            <KanbanCard budget={activeBudget} isDragging locked={false} onClick={() => {}} getProfileName={getProfileName} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
