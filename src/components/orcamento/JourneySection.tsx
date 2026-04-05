import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowRight, Info } from "lucide-react";
import type { JourneyStep } from "@/lib/orcamento-types";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/60";
const MONO = "font-mono tabular-nums";

interface JourneySectionProps {
  steps: JourneyStep[];
}

export function JourneySection({ steps }: JourneySectionProps) {
  const [activeStep, setActiveStep] = useState(0);
  const current = steps[activeStep];

  return (
    <section className="space-y-6">
      <div>
        <p className={`${LABEL} mb-1`}>Processo</p>
        <h2 className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight leading-[1.15]">
          Sua jornada
        </h2>
      </div>

      {/* Desktop horizontal stepper */}
      <div className="hidden md:block">
        <div className="relative flex items-start justify-between">
          <div className="absolute top-4 left-[8%] right-[8%] h-px bg-border" />
          {steps.map((step, i) => (
            <button
              key={step.id}
              onClick={() => setActiveStep(i)}
              className="relative z-10 flex flex-col items-center text-center w-[16%] group"
            >
              <div
                className={cn(
                  `w-8 h-8 rounded-full flex items-center justify-center text-xs ${MONO} font-bold transition-all`,
                  activeStep === i
                    ? "bg-primary text-primary-foreground shadow-md scale-110"
                    : "bg-muted text-muted-foreground group-hover:bg-primary/20"
                )}
              >
                {step.id}
              </div>
              <p className={cn(
                "text-xs font-display mt-1.5 leading-tight transition-colors tracking-[-0.01em]",
                activeStep === i ? "text-primary font-semibold" : "text-muted-foreground"
              )}>
                {step.title}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Mobile horizontal pills */}
      <div className="flex md:hidden gap-2 overflow-x-auto pb-2 -mx-1 px-1">
        {steps.map((step, i) => (
          <button
            key={step.id}
            onClick={() => setActiveStep(i)}
            className={cn(
              "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-display font-medium transition-all border",
              activeStep === i
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            <span className={MONO}>{step.id}</span>. {step.title}
          </button>
        ))}
      </div>

      {/* Active step detail */}
      {current && (
        <Card className="border-primary/20">
          <CardContent className="pt-5 pb-4 space-y-3">
            <p className="text-xs font-display font-semibold text-primary uppercase tracking-[0.05em]">
              Etapa <span className={MONO}>{current.id}</span> — {current.title}
            </p>

            <div>
              <p className="text-xs font-display font-semibold text-foreground mb-2 tracking-[-0.01em]">O que acontece</p>
              <ul className="space-y-1.5">
                {current.whatHappens.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm font-body text-foreground leading-snug tracking-[-0.01em]">
                    <ArrowRight className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-muted/50 rounded-md px-3 py-2">
              <p className="text-xs font-body tracking-[-0.01em]">
                <span className="font-semibold text-foreground">Resultado:</span>{" "}
                <span className="text-muted-foreground">{current.result}</span>
              </p>
            </div>

            {current.proof && (
              <div className="flex items-start gap-2 text-xs text-muted-foreground font-body tracking-[-0.01em]">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{current.proof}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </section>
  );
}
