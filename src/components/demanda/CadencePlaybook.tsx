import { CheckCircle2, Circle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type CadenceStatus = "done" | "current" | "pending";

export interface CadenceStep {
  label: string;
  status: CadenceStatus;
  hint?: string;
}

export interface CadencePlaybookProps {
  stage: string;
  steps: CadenceStep[];
  onAddStep?: () => void;
}

export function CadencePlaybook({ stage, steps, onAddStep }: CadencePlaybookProps) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Cadência sugerida
        </h3>
        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
          Playbook
        </span>
      </div>
      <p className="text-[11.5px] text-muted-foreground font-body mb-3">
        Etapa: <span className="font-medium text-foreground">{stage}</span> · {steps.length} toques recomendados
      </p>
      <ul className="space-y-2">
        {steps.map((s, i) => (
          <li key={i} className="flex items-start gap-2 text-[12.5px] font-body">
            {s.status === "done" ? (
              <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : s.status === "current" ? (
              <div className="h-3.5 w-3.5 mt-0.5 shrink-0 rounded-full border-2 border-primary bg-primary/10" />
            ) : (
              <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/50" />
            )}
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "leading-tight",
                  s.status === "done" && "line-through text-muted-foreground",
                  s.status === "current" && "font-semibold text-foreground",
                  s.status === "pending" && "text-muted-foreground"
                )}
              >
                {s.label}
              </div>
              {s.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{s.hint}</div>}
            </div>
          </li>
        ))}
      </ul>
      {onAddStep && (
        <Button
          variant="outline"
          size="sm"
          className="w-full mt-3 h-8 text-[11.5px] gap-1.5"
          onClick={onAddStep}
        >
          <Plus className="h-3 w-3" />
          Adicionar toque
        </Button>
      )}
    </div>
  );
}
