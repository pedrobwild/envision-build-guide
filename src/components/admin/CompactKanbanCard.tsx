import { useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Calendar, Pin, ExternalLink, MessageCircle, ArrowRight, Copy, History } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITIES, INTERNAL_STATUSES, type Priority, type InternalStatus } from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotBadge } from "@/components/admin/RotBadge";
import { DealTemperatureBadge } from "@/components/admin/DealTemperatureBadge";
import { NextActionChip } from "@/components/admin/NextActionChip";
import type { DealTemperatureResult, NextActionSuggestion } from "@/lib/deal-temperature";

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
  isSynced?: boolean;
  /** Dias parado na etapa atual — exibe RotBadge se >= warnThreshold. */
  daysInStage?: number | null;
  /** Resultado do score de temperatura. */
  temperature?: DealTemperatureResult | null;
  /** Sugestão de próxima ação. */
  nextAction?: NextActionSuggestion | null;
  onClick: () => void;
  onQuickAction?: (action: "open" | "whatsapp" | "advance" | "copyLink" | "nextAction") => void;
  /** Callback opcional para abrir o histórico/comunicação do negócio. */
  onOpenHistory?: () => void;
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
  overdue: "bg-destructive/10 text-destructive ring-1 ring-destructive/20",
  today: "bg-warning/10 text-warning ring-1 ring-warning/25",
  soon: "bg-warning/10 text-warning ring-1 ring-warning/20",
  ok: "bg-success/10 text-success ring-1 ring-success/20",
  default: "bg-muted/60 text-muted-foreground ring-1 ring-border/60",
};

const dueAccentStyles: Record<DueVariant, string> = {
  overdue: "before:bg-destructive",
  today: "before:bg-warning",
  soon: "before:bg-warning/80",
  ok: "before:bg-success",
  default: "before:bg-transparent",
};

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("");
}

const SWIPE_THRESHOLD = -60;
const ACTION_WIDTH = 180;

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
  isSynced,
  daysInStage,
  temperature,
  nextAction,
  onClick,
  onQuickAction,
}: CompactKanbanCardProps) {
  const prio = PRIORITIES[priority as Priority] ?? PRIORITIES.normal;
  const statusMeta = INTERNAL_STATUSES[internalStatus as InternalStatus];
  const due = getDueInfo(dueAt);
  const highPrio = priority === "urgente" || priority === "alta";
  const accent = due ? dueAccentStyles[due.variant] : "before:bg-transparent";

  const x = useMotionValue(0);
  const [revealed, setRevealed] = useState(false);
  const actionsOpacity = useTransform(x, [-ACTION_WIDTH, -40, 0], [1, 0.5, 0]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x < SWIPE_THRESHOLD) setRevealed(true);
    else setRevealed(false);
  };

  const initials = getInitials(clientName);
  const location = [bairro, city].filter(Boolean).join(", ");

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Action buttons behind the card */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch rounded-xl overflow-hidden"
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
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("copyLink"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-accent text-accent-foreground text-[10px] font-body font-medium"
        >
          <Copy className="h-3.5 w-3.5" />
          Link
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("whatsapp"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-success text-success-foreground text-[10px] font-body font-medium"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onQuickAction?.("advance"); setRevealed(false); }}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 bg-warning text-warning-foreground text-[10px] font-body font-medium"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Avançar
        </button>
      </motion.div>

      {/* Swipeable premium card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -ACTION_WIDTH, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        animate={{ x: revealed ? -ACTION_WIDTH : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        style={{ x }}
        whileHover={{ y: -1 }}
        onClick={() => { if (!revealed) onClick(); else setRevealed(false); }}
        className={cn(
          // Base premium surface
          "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer",
          "bg-gradient-to-br from-card to-card/95",
          "border border-border/70",
          "shadow-premium-sm hover:shadow-premium hover:border-border",
          "transition-[box-shadow,border-color,transform] duration-200",
          // Left accent rail (priority/due)
          "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3px] before:rounded-full",
          accent,
          highPrio && "ring-1 ring-warning/25",
          "active:scale-[0.99]"
        )}
      >
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center text-[11px] font-display font-bold tracking-tight",
            "ring-1 ring-inset",
            highPrio
              ? "bg-gradient-to-br from-warning/20 to-warning/5 text-warning ring-warning/30"
              : "bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-primary/20"
          )}>
            {initials || "?"}
          </div>
          {highPrio && (
            <Pin className="absolute -top-0.5 -right-0.5 h-3 w-3 fill-warning text-warning drop-shadow-sm" />
          )}
        </div>

        {/* Info — 2 lines */}
        <div className="flex-1 min-w-0">
          {/* Line 1: code + project name + priority */}
          <div className="flex items-center gap-1.5">
            {sequentialCode && (
              <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/60 shrink-0">
                {sequentialCode}
              </span>
            )}
            <span className="font-display font-semibold text-[13px] text-foreground truncate flex-1 leading-tight tracking-tight">
              {projectName || "Sem nome"}
            </span>
            {priority !== "normal" && (
              <span className={cn(
                "text-[9px] font-body font-bold uppercase tracking-wide px-1.5 py-px rounded-md flex-shrink-0",
                prio.color
              )}>
                {prio.label}
              </span>
            )}
          </div>

          {/* Line 2: client · location · owner */}
          <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground font-body leading-tight">
            <span className="truncate font-medium text-foreground/70">{clientName}</span>
            {location && (
              <>
                <span className="opacity-30">•</span>
                <span className="truncate">{location}</span>
              </>
            )}
            {(commercialName || estimatorName) && (
              <>
                <span className="opacity-30">•</span>
                <span className="truncate italic">{commercialName || estimatorName}</span>
              </>
            )}
          </div>
        </div>

        {/* Right: badges stacked */}
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {due && (
            <span className={cn(
              "inline-flex items-center gap-1 text-[9.5px] font-semibold font-body px-1.5 py-0.5 rounded-md",
              dueVariantStyles[due.variant]
            )}>
              <Calendar className="h-2.5 w-2.5" />
              {due.label}
            </span>
          )}
          {statusMeta && (
            <span className={cn(
              "text-[9.5px] font-medium font-body px-1.5 py-0.5 rounded-md bg-muted/70 ring-1 ring-border/50",
              statusMeta.color
            )}>
              {statusMeta.icon} {statusMeta.label}
            </span>
          )}
          <div className="flex items-center gap-1 flex-wrap justify-end">
            {temperature && <DealTemperatureBadge result={temperature} compact />}
            {typeof daysInStage === "number" && (
              <RotBadge daysInStage={daysInStage} />
            )}
            {(versionNumber ?? 1) > 1 && (
              <span className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground ring-1 ring-border/40">
                V{versionNumber}
              </span>
            )}
            {isSynced && (
              <span
                className="inline-flex items-center text-[9px] font-bold font-body px-1.5 py-0.5 rounded-md bg-success/10 text-success ring-1 ring-success/20"
                title="Sincronizado com Portal BWild"
              >
                ✓
              </span>
            )}
          </div>
        </div>
      </motion.div>
      {nextAction && (
        <div className="mt-1 px-0.5">
          <NextActionChip
            suggestion={nextAction}
            compact
            onClick={() => onQuickAction?.("nextAction")}
          />
        </div>
      )}
    </div>
  );
}
