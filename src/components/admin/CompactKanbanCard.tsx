import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Calendar, Pin, ExternalLink, MessageCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITIES, INTERNAL_STATUSES, type Priority, type InternalStatus } from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompactKanbanCardProps {
  projectName: string;
  clientName: string;
  priority: string;
  internalStatus: string;
  dueAt: string | null;
  bairro?: string | null;
  city?: string | null;
  versionNumber?: number | null;
  sequentialCode?: string | null;
  commercialName?: string;
  estimatorName?: string;
  highPriority?: boolean;
  onClick: () => void;
  onQuickAction?: (action: "open" | "whatsapp" | "advance") => void;
}

type DueVariant = "overdue" | "today" | "soon" | "ok" | "default";

function getDueInfo(dueAt: string | null): { label: string; variant: DueVariant } | null {
  if (!dueAt) return null;
  const dueDate = new Date(dueAt);
  const days = differenceInCalendarDays(dueDate, new Date());
  if (isPast(dueDate) && !isToday(dueDate))
    return { label: `${Math.abs(days)}d atrás`, variant: "overdue" };
  if (isToday(dueDate)) return { label: "Hoje", variant: "today" };
  if (days <= 2) return { label: `${days}d`, variant: "soon" };
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

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const SWIPE_THRESHOLD = -60;
const ACTION_WIDTH = 140;

export function CompactKanbanCard({
  projectName,
  clientName,
  priority,
  internalStatus,
  dueAt,
  bairro,
  city,
  versionNumber,
  sequentialCode,
  commercialName,
  estimatorName,
  onClick,
  onQuickAction,
}: CompactKanbanCardProps) {
  const prio = PRIORITIES[priority as Priority] ?? PRIORITIES.normal;
  const statusMeta = INTERNAL_STATUSES[internalStatus as InternalStatus];
  const due = getDueInfo(dueAt);
  const highPrio = priority === "urgente" || priority === "alta";
  const borderColor = due ? dueBorderStyles[due.variant] : "border-l-transparent";

  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);
  const actionsOpacity = useTransform(x, [-ACTION_WIDTH, -40, 0], [1, 0.5, 0]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) {
      setRevealed(true);
    } else {
      setRevealed(false);
    }
  };

  const initials = getInitials(clientName);
  const location = [bairro, city].filter(Boolean).join(", ");

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Action buttons behind the card */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ opacity: actionsOpacity, width: ACTION_WIDTH }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("open"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-primary text-primary-foreground text-[10px] font-body font-medium"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Abrir
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("whatsapp"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-success text-white text-[10px] font-body font-medium"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("advance"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-warning text-white text-[10px] font-body font-medium rounded-r-lg"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Avançar
        </button>
      </motion.div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: revealed ? -ACTION_WIDTH : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        style={{ x }}
        onClick={() => { if (!revealed) onClick(); else setRevealed(false); }}
        className={cn(
          "relative flex items-center gap-2.5 p-2.5 bg-card border border-l-[3px] rounded-lg transition-shadow",
          borderColor,
          highPrio && "ring-1 ring-warning/30",
          "active:bg-muted/30"
        )}
      >
        {/* Avatar */}
        <div className={cn(
          "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-display font-bold",
          highPrio
            ? "bg-warning/15 text-warning"
            : "bg-primary/10 text-primary"
        )}>
          {highPrio && <Pin className="h-3 w-3 fill-warning absolute -top-0.5 -right-0.5" />}
          {initials}
        </div>

        {/* Info — 2 lines */}
        <div className="flex-1 min-w-0">
          {/* Line 1: project name + priority */}
          <div className="flex items-center gap-1.5">
            <span className="font-display font-semibold text-xs text-foreground truncate flex-1 leading-tight">
              {projectName || "Sem nome"}
            </span>
            {priority !== "normal" && (
              <span className={cn("text-[9px] font-body font-bold px-1 py-px rounded flex-shrink-0", prio.color)}>
                {prio.label}
              </span>
            )}
          </div>

          {/* Line 2: client · location · owner */}
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground font-body leading-tight">
            <span className="truncate">{clientName}</span>
            {location && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{location}</span>
              </>
            )}
            {(commercialName || estimatorName) && (
              <>
                <span className="opacity-40">·</span>
                <span className="truncate">{commercialName || estimatorName}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: badges stacked */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {due && (
            <span className={cn("inline-flex items-center gap-0.5 text-[9px] font-medium font-body px-1.5 py-0.5 rounded-full", dueVariantStyles[due.variant])}>
              <Calendar className="h-2.5 w-2.5" />
              {due.label}
            </span>
          )}
          {statusMeta && (
            <span className={cn("text-[9px] font-body px-1.5 py-0.5 rounded-full bg-muted/60", statusMeta.color)}>
              {statusMeta.icon} {statusMeta.label}
            </span>
          )}
          {(versionNumber ?? 1) > 1 && (
            <span className="text-[9px] font-body px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              V{versionNumber}
            </span>
          )}
        </div>
      </motion.div>
    </div>
  );
}
