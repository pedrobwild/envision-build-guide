import { useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { Calendar, Pin, ExternalLink, MessageCircle, ArrowRight, Copy, History, Eye, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { PRIORITIES, INTERNAL_STATUSES, type Priority, type InternalStatus } from "@/lib/role-constants";
import { differenceInCalendarDays, isPast, isToday, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotBadge } from "@/components/admin/RotBadge";
import { DealTemperatureBadge } from "@/components/admin/DealTemperatureBadge";
import { NextActionChip } from "@/components/admin/NextActionChip";
import type { DealTemperatureResult, NextActionSuggestion } from "@/lib/deal-temperature";
import type { LeadScoreResult } from "@/lib/lead-score";
import { LeadScoreBadge } from "@/components/admin/LeadScoreBadge";
import { VersionBadge } from "@/components/admin/VersionBadge";
import {
  COMMERCIAL_STAGES,
  PRODUCTION_STAGES,
  deriveCommercialStage,
  deriveProductionStage,
  type CommercialStage,
  type ProductionStage,
} from "@/lib/pipeline-stages";

interface CompactKanbanCardProps {
  projectName: string;
  clientName: string;
  priority: string;
  internalStatus: string;
  dueAt: string | null;
  bairro?: string | null;
  city?: string | null;
  versionNumber?: number | null;
  isCurrentVersion?: boolean | null;
  sequentialCode?: string | null;
  commercialName?: string;
  estimatorName?: string;
  highPriority?: boolean;
  isSynced?: boolean;
  /** Identificador público do orçamento — habilita o botão direto "Ver pública". */
  publicId?: string | null;
  /** Data de criação do negócio. */
  createdAt?: string | null;
  /** Data de última atualização. */
  updatedAt?: string | null;
  /** Modo do card: 'commercial' mostra criação + atualização; 'estimator' mostra solicitação + prazo. */
  mode?: "commercial" | "estimator";
  /** Dias parado na etapa atual — exibe RotBadge se >= warnThreshold. */
  daysInStage?: number | null;
  /** Resultado do score de temperatura. */
  temperature?: DealTemperatureResult | null;
  /** Sugestão de próxima ação. */
  nextAction?: NextActionSuggestion | null;
  /** Score de qualidade do lead/cliente (Onda 5A). */
  leadScore?: LeadScoreResult | null;
  /** Quantidade de orçamentos "irmãos" (mesmo cliente+imóvel) representados por este card. */
  siblingCount?: number;
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
  bairro: _bairro,
  city: _city,
  versionNumber,
  isCurrentVersion,
  sequentialCode,
  commercialName,
  estimatorName,
  isSynced,
  publicId,
  createdAt,
  updatedAt,
  mode = "commercial",
  daysInStage,
  temperature,
  nextAction,
  leadScore,
  siblingCount,
  onClick,
  onQuickAction,
  onOpenHistory,
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
  // Datas exibidas no card (substituem cliente/bairro)
  const fmtDate = (iso?: string | null) => (iso ? format(new Date(iso), "dd MMM", { locale: ptBR }) : null);
  const createdLabel = fmtDate(createdAt);
  const updatedLabel = fmtDate(updatedAt);
  const dueLabelShort = fmtDate(dueAt);

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

          {/* Line 2: datas (criação + atualização ou prazo) · responsável */}
          <div className="flex items-center gap-1.5 mt-1 text-[10.5px] text-muted-foreground font-body leading-tight">
            {createdLabel && (
              <span className="truncate" title="Data de criação">
                <span className="opacity-60">Criado:</span>{" "}
                <span className="font-medium text-foreground/70">{createdLabel}</span>
              </span>
            )}
            {mode === "commercial" && updatedLabel && (
              <>
                <span className="opacity-30">•</span>
                <span className="truncate" title="Última atualização">
                  <span className="opacity-60">Atualizado:</span>{" "}
                  <span className="font-medium text-foreground/70">{updatedLabel}</span>
                </span>
              </>
            )}
            {mode === "estimator" && dueLabelShort && (
              <>
                <span className="opacity-30">•</span>
                <span className="truncate" title="Prazo de entrega">
                  <span className="opacity-60">Prazo:</span>{" "}
                  <span className="font-medium text-foreground/70">{dueLabelShort}</span>
                </span>
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
            {leadScore && <LeadScoreBadge score={leadScore} />}
            {temperature && <DealTemperatureBadge result={temperature} compact />}
            {typeof daysInStage === "number" && (
              <RotBadge daysInStage={daysInStage} />
            )}
            <VersionBadge versionNumber={versionNumber} isCurrent={isCurrentVersion} />
            {typeof siblingCount === "number" && siblingCount > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenHistory?.(); }}
                className="inline-flex items-center gap-1 text-[9.5px] font-bold font-body px-1.5 py-0.5 rounded-md bg-accent/20 text-accent-foreground ring-1 ring-accent/40 hover:bg-accent/30 transition-colors"
                title={`${siblingCount} orçamento(s) anterior(es) deste cliente/imóvel`}
              >
                <Layers className="h-2.5 w-2.5" />
                +{siblingCount}
              </button>
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
      {/* Botões persistentes — canto superior esquerdo (acima do avatar)
          para não sobrepor a coluna de badges no canto direito */}
      <div className="absolute top-1.5 left-1.5 z-10 flex items-center gap-1">
        {publicId && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.open(getPublicBudgetUrl(publicId), "_blank", "noopener,noreferrer");
            }}
            className="h-5 w-5 rounded-full bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 flex items-center justify-center transition-colors"
            title="Ver orçamento público"
            aria-label="Ver orçamento público"
          >
            <Eye className="h-3 w-3" />
          </button>
        )}
        {onOpenHistory && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenHistory(); }}
            className="h-5 w-5 rounded-full bg-card/80 border border-border/60 text-muted-foreground hover:text-primary hover:border-primary/40 flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
            title="Ver histórico e comunicação"
            aria-label="Histórico"
          >
            <History className="h-3 w-3" />
          </button>
        )}
      </div>
      <div className="mt-1 px-0.5 min-h-[22px]">
        {nextAction ? (
          <NextActionChip
            suggestion={nextAction}
            compact
            onClick={() => onQuickAction?.("nextAction")}
          />
        ) : (
          <div
            className="inline-flex items-center gap-1 rounded-md ring-1 ring-border/40 bg-muted/30 text-muted-foreground/70 text-[10px] font-body font-medium px-1.5 py-0.5 w-full justify-start"
            title="Nenhuma ação pendente no momento"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success/60 shrink-0" />
            <span className="truncate">Em dia</span>
          </div>
        )}
      </div>
    </div>
  );
}
