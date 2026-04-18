import { cn } from "@/lib/utils";

export interface PipelineStage {
  key: string;
  label: string;
}

interface PipelineProgressProps {
  stages: PipelineStage[];
  currentIndex: number;
  isLost?: boolean;
}

export function PipelineProgress({ stages, currentIndex, isLost }: PipelineProgressProps) {
  return (
    <div className="w-full">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((stage, i) => {
          const active = i === currentIndex && !isLost;
          const completed = i < currentIndex && !isLost;
          return (
            <div key={stage.key} className="flex flex-col gap-2 min-w-0">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  isLost && i <= currentIndex && "bg-destructive",
                  !isLost && completed && "bg-foreground",
                  !isLost && active && "bg-primary",
                  !isLost && i > currentIndex && "bg-border/60",
                  isLost && i > currentIndex && "bg-border/60"
                )}
              />
              <span
                className={cn(
                  "text-xs font-body truncate",
                  active && "text-primary font-semibold",
                  completed && "text-foreground font-medium",
                  !active && !completed && "text-muted-foreground/70"
                )}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
