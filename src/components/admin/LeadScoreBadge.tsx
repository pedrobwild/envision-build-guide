import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { TIER_META, type LeadScoreResult } from "@/lib/lead-score";
import { Flame, CloudSun, Snowflake } from "lucide-react";

interface LeadScoreBadgeProps {
  score: LeadScoreResult | null | undefined;
  /** "compact" mostra só ícone + número; "full" mostra label. */
  variant?: "compact" | "full";
  className?: string;
}

const TIER_STYLES: Record<"hot" | "warm" | "cold", string> = {
  hot: "bg-destructive/10 text-destructive ring-destructive/25",
  warm: "bg-warning/10 text-warning ring-warning/25",
  cold: "bg-muted text-muted-foreground ring-border",
};

const TIER_ICON = {
  hot: Flame,
  warm: CloudSun,
  cold: Snowflake,
} as const;

export function LeadScoreBadge({ score, variant = "compact", className }: LeadScoreBadgeProps) {
  if (!score) return null;
  const Icon = TIER_ICON[score.tier];
  const meta = TIER_META[score.tier];

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full ring-1 px-1.5 py-0.5 text-[10px] font-mono font-semibold tabular-nums tracking-tight",
              TIER_STYLES[score.tier],
              className,
            )}
            aria-label={`Lead score ${score.score} — ${meta.label}`}
          >
            <Icon className="h-2.5 w-2.5" />
            {score.score}
            {variant === "full" && <span className="ml-0.5 font-body">{meta.label}</span>}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-1.5 text-xs">
            <p className="font-display font-semibold">
              {meta.emoji} {meta.label} · {score.score}/100
            </p>
            <p className="text-muted-foreground">{score.reason}</p>
            <div className="pt-1 border-t border-border/50 space-y-0.5 text-[10px] font-mono">
              <div className="flex justify-between"><span>Volume</span><span>{score.breakdown.volume}/15</span></div>
              <div className="flex justify-between"><span>Ticket</span><span>{score.breakdown.ticket}/20</span></div>
              <div className="flex justify-between"><span>Recência</span><span>{score.breakdown.recency}/25</span></div>
              <div className="flex justify-between"><span>Pipeline</span><span>{score.breakdown.pipeline_velocity}/15</span></div>
              <div className="flex justify-between"><span>Conversão</span><span>{score.breakdown.conversion}/25</span></div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
