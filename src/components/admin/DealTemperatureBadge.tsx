import { Flame, Snowflake, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DealTemperatureResult } from "@/lib/deal-temperature";

interface Props {
  result: DealTemperatureResult;
  /** Compact mode: only icon + tiny label. */
  compact?: boolean;
}

const STYLES = {
  hot: {
    icon: Flame,
    classes: "bg-destructive/10 text-destructive ring-destructive/20",
  },
  warm: {
    icon: Sun,
    classes: "bg-warning/10 text-warning ring-warning/20",
  },
  cold: {
    icon: Snowflake,
    classes: "bg-sky-500/10 text-sky-600 ring-sky-500/20",
  },
} as const;

export function DealTemperatureBadge({ result, compact }: Props) {
  if (result.label === "Encerrado") return null;
  const style = STYLES[result.temperature];
  const Icon = style.icon;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md ring-1 font-body font-semibold",
              compact ? "text-[9px] px-1 py-px" : "text-[10px] px-1.5 py-0.5",
              style.classes,
            )}
          >
            <Icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            {compact ? result.label[0] : result.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs font-medium">
            Temperatura: {result.label} ({result.score}/100)
          </p>
          <p className="text-[11px] text-muted-foreground">{result.topReason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
