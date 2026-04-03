import { useState, useCallback } from "react";
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
  CheckCircle2,
  Send,
  FileSignature,
  User,
  Building2,
  Calendar,
  AlertTriangle,
  Pin,
  Lock,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";

/* ── 5 columns matching the user's funnel ── */
const ESTIMATOR_COLUMNS = [
  {
    id: "pending",
    label: "Pendente",
    icon: Inbox,
    statuses: ["requested", "novo", "triage", "assigned"],
    accent: "border-t-indigo-500",
    headerColor: "text-indigo-700 dark:text-indigo-400",
    bgColor: "bg-indigo-50/50 dark:bg-indigo-950/20",
    targetStatus: "assigned" as InternalStatus,
    locked: false,
  },
  {
    id: "in_progress",
    label: "Em Elaboração",
    icon: Hammer,
    statuses: ["in_progress", "waiting_info", "blocked"],
    accent: "border-t-yellow-500",
    headerColor: "text-yellow-700 dark:text-yellow-400",
    bgColor: "bg-yellow-50/50 dark:bg-yellow-950/20",
    targetStatus: "in_progress" as InternalStatus,
    locked: false,
  },
  {
    id: "review",
    label: "Em Revisão",
    icon: CheckCircle2,
    statuses: ["ready_for_review"],
    accent: "border-t-orange-500",
    headerColor: "text-orange-700 dark:text-orange-400",
    bgColor: "bg-orange-50/50 dark:bg-orange-950/20",
    targetStatus: "ready_for_review" as InternalStatus,
    locked: false,
  },
  {
    id: "delivered",
    label: "Entregue",
    icon: Send,
    statuses: ["delivered_to_sales", "sent_to_client", "minuta_solicitada"],
    accent: "border-t-teal-500",
    headerColor: "text-teal-700 dark:text-teal-400",
    bgColor: "bg-teal-50/50 dark:bg-teal-950/20",
    targetStatus: "delivered_to_sales" as InternalStatus,
    locked: true, // estimator shouldn't drag into post-production
  },
  {
    id: "closed",
    label: "Finalizado",
    icon: FileSignature,
    statuses: ["sent_to_client", "lost", "archived"],
    accent: "border-t-green-500",
    headerColor: "text-green-700 dark:text-green-400",
    bgColor: "bg-green-50/50 dark:bg-green-950/20",
    targetStatus: null,
    locked: true,
  },
];

/* ── Types ── */
interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
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

function getDueInfo(dueAt: string | null): { label: string; variant: DueVariant } | null {
  if (!dueAt) return null;
  const dueDate = new Date(dueAt);
  const days = differenceInCalendarDays(dueDate, new Date());
  if (isPast(dueDate) && !isToday(dueDate))
    return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" };
  if (isToday(dueDate)) return { label: "Vence hoje", variant: "today" };
  if (days <= 2) return { label: `${days}d`, variant: "soon" };
  if (days <= 7) return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "ok" };
  return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" };
}

const dueVariantStyles: Record<DueVariant, string> = {
  overdue: "bg-destructive/10 text-destructive",
  today: "bg-warning/10 text-warning",
  soon: "bg-amber-100/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  ok: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  default: "text-muted-foreground bg-muted/50",
};

const dueBorderStyles: Record<DueVariant, string> = {
  overdue: "border-l-destructive",
  today: "border-l-warning",
  soon: "border-l-amber-400 dark:border-l-amber-500",
  ok: "border-l-emerald-400 dark:border-l-emerald-500",
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
    const d = getDueInfo(b.due_at);
    return d?.variant === "overdue" || d?.variant === "today";
  }).length;

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
          {column.label}
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

      <ScrollArea className="flex-1 px-2 pb-2" style={{ maxHeight: "calc(100vh - 340px)" }}>
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
  const statusMeta = INTERNAL_STATUSES[b.internal_status as InternalStatus];
  const due = getDueInfo(b.due_at);
  const highPrio = isHighPriority(b.priority);
  const borderColor = due ? dueBorderStyles[due.variant] : "border-l-transparent";

  return (
    <Card
      className={`p-3 text-left transition-all border border-l-[3px] ${borderColor} ${
        isDragging ? "opacity-60 shadow-xl rotate-2 scale-105" : "hover:shadow-md"
      } ${locked ? "cursor-default" : "cursor-grab active:cursor-grabbing"} ${
        highPrio ? "ring-1 ring-amber-300/50 dark:ring-amber-600/30" : ""
      }`}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
    >
      <div className="flex items-start gap-1.5 mb-1.5">
        {highPrio && <Pin className="h-3 w-3 shrink-0 text-amber-500 mt-0.5 fill-amber-500" />}
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

      {/* Sub-status badge */}
      {statusMeta && (
        <div className="mb-1.5">
          <Badge variant="secondary" className={`text-[10px] font-body ${statusMeta.color}`}>
            {statusMeta.icon} {statusMeta.label}
          </Badge>
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

      // Already in this column?
      const currentCol = ESTIMATOR_COLUMNS.find((c) => c.statuses.includes(budget.internal_status));
      if (currentCol?.id === targetCol.id) return;

      await onStatusChange(budget.id, targetCol.targetStatus);
    },
    [budgets, onStatusChange]
  );

  const columnBudgets = useCallback(
    (col: (typeof ESTIMATOR_COLUMNS)[number]) =>
      budgets.filter((b) => col.statuses.includes(b.internal_status)),
    [budgets]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
        {ESTIMATOR_COLUMNS.map((col) => (
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
