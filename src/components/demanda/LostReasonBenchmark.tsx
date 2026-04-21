import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface LostReasonBenchmarkItem {
  label: string;
  percentage: number;
  tone?: "danger" | "warning" | "muted";
}

export interface LostReasonBenchmarkProps {
  items: LostReasonBenchmarkItem[];
  onMarkLost?: () => void;
  alreadyLost?: boolean;
}

const toneColor: Record<NonNullable<LostReasonBenchmarkItem["tone"]>, string> = {
  danger: "bg-destructive",
  warning: "bg-amber-500",
  muted: "bg-muted-foreground/60",
};

export function LostReasonBenchmark({
  items,
  onMarkLost,
  alreadyLost,
}: LostReasonBenchmarkProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Motivos de perda similares
        </h3>
        <span className="text-[11px] text-muted-foreground font-body">base histórica</span>
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="text-[12.5px] font-body">
            <div className="flex items-center justify-between">
              <span className="text-foreground">{it.label}</span>
              <span className="font-semibold">{it.percentage}%</span>
            </div>
            <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
              <div
                className={cn("h-full", toneColor[it.tone ?? "muted"])}
                style={{ width: `${Math.min(100, it.percentage)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {onMarkLost && !alreadyLost && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 h-8 text-[11.5px] gap-1.5 text-destructive hover:text-destructive hover:border-destructive/40"
          onClick={onMarkLost}
        >
          <XCircle className="h-3.5 w-3.5" />
          Marcar como perdida
        </Button>
      )}
      {alreadyLost && (
        <div className="mt-3 text-[11px] text-destructive font-medium">
          Este negócio já está marcado como perdido.
        </div>
      )}
    </div>
  );
}
