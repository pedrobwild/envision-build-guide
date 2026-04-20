import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface RotBadgeProps {
  daysInStage: number;
  /**
   * Limiar (em dias) acima do qual o badge é considerado "morno".
   * Antes disso o badge é ocultado (negócio fresco).
   */
  warnThreshold?: number;
  /**
   * Limiar a partir do qual o badge fica "quente" (vermelho).
   */
  hotThreshold?: number;
  className?: string;
}

/**
 * Badge "X dias parado" — sinaliza que o negócio não muda de etapa há tempos.
 * Cor escalonada:
 *  - < warn:  oculto
 *  - warn..hot: âmbar
 *  - >= hot: vermelho
 */
export function RotBadge({
  daysInStage,
  warnThreshold = 5,
  hotThreshold = 10,
  className,
}: RotBadgeProps) {
  if (daysInStage < warnThreshold) return null;

  const isHot = daysInStage >= hotThreshold;
  const styles = isHot
    ? "bg-destructive/10 text-destructive ring-destructive/20"
    : "bg-warning/10 text-warning ring-warning/20";

  return (
    <TooltipProvider delayDuration={250}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[9.5px] font-semibold font-body px-1.5 py-0.5 rounded-md ring-1",
              styles,
              className,
            )}
          >
            <Clock className="h-2.5 w-2.5" />
            {daysInStage}d
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">Parado há {daysInStage} dias nesta etapa</p>
          <p className="text-[10px] opacity-70">
            {isHot ? "Negócio esfriando — priorize ação" : "Sem movimento recente"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
