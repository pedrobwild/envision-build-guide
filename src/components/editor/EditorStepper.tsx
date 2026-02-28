import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type EditorStep = "floor-plan" | "rooms" | "spreadsheet" | "coverage";

const STEPS: { id: EditorStep; label: string; number: number }[] = [
  { id: "floor-plan", label: "Planta", number: 1 },
  { id: "rooms", label: "Cômodos", number: 2 },
  { id: "spreadsheet", label: "Planilha", number: 3 },
  { id: "coverage", label: "Mapeamento", number: 4 },
];

interface EditorStepperProps {
  current: EditorStep;
  onStepClick: (step: EditorStep) => void;
  completedSteps: Set<EditorStep>;
}

export function EditorStepper({ current, onStepClick, completedSteps }: EditorStepperProps) {
  return (
    <div className="flex items-center gap-1 sm:gap-2">
      {STEPS.map((step, i) => {
        const isActive = current === step.id;
        const isCompleted = completedSteps.has(step.id);
        const isClickable = isCompleted || isActive;

        return (
          <div key={step.id} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-lg text-xs sm:text-sm font-body font-medium transition-all",
                isActive && "bg-primary text-primary-foreground",
                isCompleted && !isActive && "bg-primary/10 text-primary hover:bg-primary/20",
                !isActive && !isCompleted && "bg-muted text-muted-foreground cursor-not-allowed"
              )}
            >
              {isCompleted && !isActive ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <span className="w-5 h-5 rounded-full border border-current flex items-center justify-center text-[10px] font-bold">
                  {step.number}
                </span>
              )}
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "w-4 sm:w-8 h-px",
                isCompleted ? "bg-primary/40" : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
