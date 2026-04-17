import { useState, useCallback, useMemo } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { useDroppable, useDraggable } from "@dnd-kit/core";
import {
  Inbox,
  Hammer,
  Send,
  FileSignature,
  User,
  Building2,
  Calendar,
  AlertTriangle,
  Pin,
  Lock,
  Clock,
  RotateCcw,
  ThumbsUp,
  XCircle,
  FileText,
  CheckCircle2,
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
import {
  PRIORITIES,
  STATUS_GROUPS,
  INTERNAL_STATUSES,
  canTransitionStatus,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { toast } from "sonner";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── Columns — mirrors Commercial Kanban, with estimator lock rules ── */
const ESTIMATOR_COLUMNS = [
  {
    id: "solicitado",
    label: "Solicitado",
    icon: FileText,
    statuses: ["requested", "novo"] as string[],
    accent: "border-t-primary",
    headerColor: "text-primary",
    bgColor: "bg-primary/5",
    targetStatus: "assigned" as InternalStatus,
    locked: false,
  },
  {
    id: "em_elaboracao",
    label: "Em Elaboração",
    icon: Hammer,
    statuses: ["triage", "assigned", "in_progress", "waiting_info", "revision_requested", "ready_for_review"] as string[],
    accent: "border-t-warning",
    headerColor: "text-warning",
    bgColor: "bg-warning/5",
    targetStatus: "in_progress" as InternalStatus,
    locked: false,
  },
  {
    id: "entregue",
    label: "Entregue",
    icon: CheckCircle2,
    statuses: ["delivered_to_sales"] as string[],
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
    statuses: ["sent_to_client"] as string[],
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
    statuses: ["minuta_solicitada"] as string[],
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
    statuses: ["contrato_fechado"] as string[],
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
    statuses: ["lost", "archived"] as string[],
    accent: "border-t-muted-foreground",
    headerColor: "text-muted-foreground",
    bgColor: "bg-muted/30",
    targetStatus: "lost" as InternalStatus,
    locked: false,
  },
];

/* ── Sub-sections for Em Elaboração (mirrors commercial) ── */
const EM_ELABORACAO_SUBSECTIONS = [
  {
    id: "em_producao",
    label: "Em Produção",
    statuses: ["triage", "assigned", "in_progress", "ready_for_review"],
    icon: null as typeof Clock | null,
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

/* ── Types ── */
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
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
}

interface EstimatorKanbanProps {
  budgets: BudgetRow[];
  onStatusChange: (budgetId: string, newStatus: InternalStatus) => Promise<void>;
  onCardClick: (budgetId: string) => void;
  getProfileName: (id: string | null) => string;
}

/* ── Helpers ── */
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

function isHighPriority(p: string) {
  return p === "urgente" || p === "alta";
}

function sortBudgets(budgets: BudgetRow[]): BudgetRow[] {
  const po: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
  return [...budgets].sort((a, b) => {
    const aH = (po[a.priority] ?? 2) <= 1 ? 0 : 1;
    const bH = (po[b.priority] ?? 2) <= 1 ? 0 : 1;
    if (aH !== bH) return aH - bH;
    if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    if (a.due_at) return -1;
    if (b.due_at) return 1;
    return (po[a.priority] ?? 2) - (po[b.priority] ?? 2);
  });
}

/* ── Sub-section group (for Em Elaboração) ── */
function SubSectionGroup({
  subsection,
  budgets,
  locked,
  onCardClick,
  getProfileName,
  compact = false,
}: {
  subsection: typeof EM_ELABORACAO_SUBSECTIONS[number];
  budgets: BudgetRow[];
  locked: boolean;
  onCardClick: (id: string) => void;
  getProfileName: (id: string | null) => string;
  compact?: boolean;
}) {
  const Icon = subsection.icon;
  const sorted = sortBudgets(budgets);

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
                onClick={() => onCardClick(b.id)}
                onQuickAction={(action) => {
                  if (action === "open") onCardClick(b.id);
                }}
              />
            ) : (
              <DraggableCard
                budget={b}
                locked={locked}
                onClick={() => onCardClick(b.id)}
                getProfileName={getProfileName}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Droppable Column ── */
function Column({
  column,
  budgets,
  onCardClick,
  getProfileName,
}: {
  column: (typeof ESTIMATOR_COLUMNS)[number];
  budgets: BudgetRow[];
  onCardClick: (id: string) => void;
  getProfileName: (id: string | null) => string;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.id, disabled: column.locked });
  const Icon = column.icon;
  const sorted = sortBudgets(budgets);
  const overdueCount = budgets.filter((b) => {
    const d = getDueInfo(b.due_at, b.internal_status);
    return d?.variant === "overdue" || d?.variant === "today";
  }).length;

  const isEmElaboracao = column.id === "em_elaboracao";

  const subSectionData = useMemo(() => {
    if (!isEmElaboracao) return [];
    return EM_ELABORACAO_SUBSECTIONS.map(sub => ({
      sub,
      items: budgets.filter(b => (sub.statuses as readonly string[]).includes(b.internal_status)),
    })).filter(({ items }) => items.length > 0);
  }, [isEmElaboracao, budgets]);

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[220px] w-[220px] lg:w-auto lg:flex-1 rounded-xl border border-border border-t-4 ${column.accent} ${column.bgColor} transition-shadow ${
        isOver && !column.locked ? "ring-2 ring-primary shadow-lg" : ""
      }`}
    >
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

      <ScrollArea className="flex-1 px-2 pb-2" style={{ maxHeight: "calc(100vh - 320px)" }}>
        {isEmElaboracao ? (
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
                />
              </div>
            ))}
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
                  <DraggableCard
                    budget={b}
                    locked={column.locked}
                    onClick={() => onCardClick(b.id)}
                    getProfileName={getProfileName}
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

/* ── Draggable Card ── */
function DraggableCard({
  budget,
  locked,
  onClick,
  getProfileName,
}: {
  budget: BudgetRow;
  locked: boolean;
  onClick: () => void;
  getProfileName: (id: string | null) => string;
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
      <EstimatorCard budget={budget} isDragging={isDragging} locked={locked} onClick={onClick} getProfileName={getProfileName} />
    </div>
  );
}

/* ── Card UI ── */
function EstimatorCard({
  budget: b,
  isDragging,
  locked,
  onClick,
  getProfileName,
}: {
  budget: BudgetRow;
  isDragging?: boolean;
  locked: boolean;
  onClick: () => void;
  getProfileName: (id: string | null) => string;
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
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        {highPrio && <Pin className="h-3 w-3 shrink-0 text-warning mt-0.5 fill-warning" />}
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
        <div className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground font-body mb-1.5">
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
      </div>
    </Card>
  );
}

/* ── Main Kanban Board ── */
export function EstimatorKanban({ budgets, onStatusChange, onCardClick, getProfileName }: EstimatorKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileColIndex, setMobileColIndex] = useState(0);
  const isMobile = useIsMobile();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeBudget = activeId ? budgets.find((b) => b.id === activeId) : null;

  const handleDragStart = useCallback((e: DragStartEvent) => setActiveId(e.active.id as string), []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const budget = budgets.find((b) => b.id === active.id);
      if (!budget) return;

      const targetCol = ESTIMATOR_COLUMNS.find((c) => c.id === over.id);
      if (!targetCol || targetCol.locked || !targetCol.targetStatus) return;

      const currentCol = ESTIMATOR_COLUMNS.find((c) => c.statuses.includes(budget.internal_status));
      if (currentCol?.id === targetCol.id) return;

      if (!canTransitionStatus(budget.internal_status, targetCol.targetStatus)) {
        const fromLabel = INTERNAL_STATUSES[budget.internal_status as InternalStatus]?.label ?? budget.internal_status;
        const toLabel = INTERNAL_STATUSES[targetCol.targetStatus]?.label ?? targetCol.targetStatus;
        toast.error(`Transição inválida: "${fromLabel}" → "${toLabel}"`, {
          description: "Para entregar, mova primeiro o card para Em Revisão.",
        });
        return;
      }

      await onStatusChange(budget.id, targetCol.targetStatus);
    },
    [budgets, onStatusChange]
  );

  const columnBudgets = useCallback(
    (col: (typeof ESTIMATOR_COLUMNS)[number]) =>
      budgets.filter((b) => col.statuses.includes(b.internal_status)),
    [budgets]
  );

  const visibleColumns = ESTIMATOR_COLUMNS;

  const mobileColumns = useMemo(() =>
    visibleColumns.map((col) => {
      const items = columnBudgets(col);
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
    [columnBudgets, visibleColumns]
  );

  if (isMobile) {
    return (
      <MobileSwipeableKanban
        columns={mobileColumns}
        activeIndex={mobileColIndex}
        onChangeIndex={setMobileColIndex}
      >
        {(colIndex) => {
          const col = visibleColumns[colIndex];
          const items = columnBudgets(col);
          const isEmElaboracao = col.id === "em_elaboracao";

          if (isEmElaboracao) {
            const subData = EM_ELABORACAO_SUBSECTIONS.map(sub => ({
              sub,
              items: items.filter(b => (sub.statuses as readonly string[]).includes(b.internal_status)),
            })).filter(({ items: i }) => i.length > 0);

            return (
              <div className={`rounded-xl border border-border border-t-4 ${col.accent} ${col.bgColor} min-h-[300px]`}>
                <ScrollArea className="px-2 pb-2 pt-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  {subData.length === 0 && (
                    <div className="py-8 text-center text-xs text-muted-foreground font-body">Nenhum orçamento</div>
                  )}
                  {subData.map(({ sub, items: subItems }, idx) => (
                    <div key={sub.id}>
                      {idx > 0 && <Separator className="my-2" />}
                      <SubSectionGroup
                        subsection={sub}
                        budgets={subItems}
                        locked={col.locked}
                        onCardClick={onCardClick}
                        getProfileName={getProfileName}
                        compact
                      />
                    </div>
                  ))}
                </ScrollArea>
              </div>
            );
          }

          const sorted = sortBudgets(items);
          return (
            <div className={`rounded-xl border border-border border-t-4 ${col.accent} ${col.bgColor} min-h-[300px]`}>
              <ScrollArea className="px-2 pb-2 pt-1" style={{ maxHeight: "calc(100vh - 280px)" }}>
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
                          onClick={() => onCardClick(b.id)}
                          onQuickAction={(action) => {
                            if (action === "open") onCardClick(b.id);
                          }}
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
              </ScrollArea>
            </div>
          );
        }}
      </MobileSwipeableKanban>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {visibleColumns.map((col) => (
          <Column
            key={col.id}
            column={col}
            budgets={columnBudgets(col)}
            onCardClick={onCardClick}
            getProfileName={getProfileName}
          />
        ))}
      </div>

      <DragOverlay>
        {activeBudget && (
          <div className="w-[220px]">
            <EstimatorCard budget={activeBudget} isDragging locked={false} onClick={() => {}} getProfileName={getProfileName} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
