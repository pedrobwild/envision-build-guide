/**
 * TimelineItem — item da timeline "o que mudou desde ontem".
 *
 * Pequeno, denso, lê em < 1s. Padrão visual do skill god-mode:
 * hierarquia por tipografia, cor codifica natureza do evento.
 */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type TimelineEventType =
  | "won"        // contrato fechado
  | "lost"       // perdido
  | "sent"       // proposta enviada
  | "viewed"     // cliente abriu
  | "stalled"    // esfriou
  | "new_lead"   // lead novo
  | "neutral";

const EVENT_STYLES: Record<TimelineEventType, { dot: string; text: string }> = {
  won:      { dot: "bg-emerald-500",  text: "text-emerald-700 dark:text-emerald-400" },
  lost:     { dot: "bg-destructive",  text: "text-destructive" },
  sent:     { dot: "bg-primary",      text: "text-primary" },
  viewed:   { dot: "bg-blue-500",     text: "text-blue-600 dark:text-blue-400" },
  stalled:  { dot: "bg-amber-500",    text: "text-amber-600 dark:text-amber-400" },
  new_lead: { dot: "bg-violet-500",   text: "text-violet-600 dark:text-violet-400" },
  neutral:  { dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
};

interface TimelineItemProps {
  icon?: LucideIcon;
  type?: TimelineEventType;
  title: string;
  meta?: string;
  time: string;
  onClick?: () => void;
}

export function TimelineItem({ icon: Icon, type = "neutral", title, meta, time, onClick }: TimelineItemProps) {
  const style = EVENT_STYLES[type];
  const Tag = onClick ? "button" : "div";

  return (
    <Tag
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 py-2 px-2 -mx-2 rounded-md w-full text-left",
        onClick && "hover:bg-accent/50 transition-colors cursor-pointer",
      )}
    >
      <div className="relative flex flex-col items-center pt-1 shrink-0">
        <div className={cn("h-2 w-2 rounded-full ring-2 ring-background", style.dot)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-body text-foreground leading-snug truncate">
            {Icon && <Icon className={cn("inline-block h-3 w-3 mr-1 -mt-0.5", style.text)} />}
            {title}
          </p>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground/60 shrink-0">
            {time}
          </span>
        </div>
        {meta && <p className="text-[10px] text-muted-foreground/70 font-body mt-0.5 truncate">{meta}</p>}
      </div>
    </Tag>
  );
}
