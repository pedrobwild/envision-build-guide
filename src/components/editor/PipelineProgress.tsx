import { Check, RotateCcw } from "lucide-react";
import type { InternalStatus } from "@/lib/role-constants";
import { useIsMobile } from "@/hooks/use-mobile";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const STAGES = [
  { label: "Solicitado", statuses: ["requested", "triage", "assigned"] },
  { label: "Em Produção", statuses: ["in_progress", "waiting_info", "blocked"] },
  { label: "Revisão", statuses: ["ready_for_review", "delivered_to_sales"] },
  { label: "Enviado", statuses: ["sent_to_client", "minuta_solicitada", "revision_requested"] },
] as const;

function getStageIndex(status: string): number {
  const idx = STAGES.findIndex((s) => (s.statuses as readonly string[]).includes(status));
  return idx >= 0 ? idx : 0;
}

interface PipelineProgressProps {
  internalStatus: string;
}

export function PipelineProgress({ internalStatus }: PipelineProgressProps) {
  const currentIdx = getStageIndex(internalStatus);
  const isMobile = useIsMobile();

  if (isMobile) {
    const stage = STAGES[currentIdx];
    return (
      <div className="px-4 py-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-body mb-1">
          <span className="font-medium text-foreground">{stage.label}</span>
          <span>Etapa {currentIdx + 1} de {STAGES.length}</span>
        </div>
        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${((currentIdx + 1) / STAGES.length) * 100}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-3 rounded-lg bg-muted/20">
      <div className="flex items-center">
        {STAGES.map((stage, i) => {
          const isCompleted = i < currentIdx;
          const isCurrent = i === currentIdx;

          return (
            <div key={stage.label} className="flex items-center flex-1 last:flex-none">
              {/* Stage circle + label */}
              <div className="flex flex-col items-center gap-1">
                {(() => {
                  const isRevisionRequested = isCurrent && internalStatus === "revision_requested";
                  const circleContent = isCompleted ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : isRevisionRequested ? (
                    <RotateCcw className="h-3.5 w-3.5" />
                  ) : (
                    i + 1
                  );

                  const circleClass = `h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-xs font-medium transition-all duration-300 ${isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isRevisionRequested
                    ? "bg-warning text-warning-foreground ring-2 ring-warning/30"
                    : isCurrent
                    ? "bg-primary text-primary-foreground ring-2 ring-primary/20 shadow-sm"
                    : "border-2 border-muted-foreground/20 text-muted-foreground/40"}`;

                  const circle = (
                    <div className={circleClass}>
                      {circleContent}
                    </div>
                  );

                  if (isRevisionRequested) {
                    return (
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>{circle}</TooltipTrigger>
                          <TooltipContent>
                            <p>Revisão solicitada pelo comercial</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    );
                  }

                  return circle;
                })()}
                <span
                  className={`text-[11px] font-body whitespace-nowrap ${
                    isCurrent
                      ? internalStatus === "revision_requested"
                        ? "text-warning font-semibold"
                        : "text-foreground font-semibold"
                      : isCompleted
                      ? "text-muted-foreground"
                      : "text-muted-foreground/50"
                  }`}
                >
                  {isCurrent && internalStatus === "revision_requested" ? "Revisão Solicitada" : stage.label}
                </span>
              </div>

              {/* Connector line */}
              {i < STAGES.length - 1 && (
                <div className="flex-1 mx-2 mt-[-16px]">
                  <div
                    className={`h-0.5 w-full ${
                      i < currentIdx
                        ? "bg-primary"
                        : "border-t-2 border-dashed border-muted-foreground/20"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
