import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { FunnelStep } from "@/hooks/useCommercialConversion";

interface Props {
  steps: FunnelStep[];
  loading?: boolean;
}

const STEP_COLORS = [
  "hsl(212, 100%, 47%)",  // primary blue
  "hsl(212, 90%, 55%)",
  "hsl(212, 80%, 62%)",
  "hsl(212, 70%, 70%)",
  "hsl(160, 65%, 45%)",   // green for closed
];

export function ConversionFunnelChart({ steps, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!steps.length || steps[0].count === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <p className="text-sm text-muted-foreground font-body">
          Nenhum lead no período selecionado.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-5">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.05em] text-muted-foreground font-body">
          Funil de conversão
        </h3>
        <p className="text-xs text-muted-foreground/70 font-body mt-1">
          Quantos leads avançaram em cada etapa do pipeline comercial → orçamento
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const widthPct = Math.max(step.pctOfTop, 4); // mínimo visível
          const color = STEP_COLORS[idx] ?? STEP_COLORS[0];
          const isFirst = idx === 0;

          return (
            <motion.div
              key={step.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08, duration: 0.35 }}
              className="group"
            >
              <div className="flex items-baseline justify-between mb-1.5 gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground font-body truncate">
                    {step.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground/80 font-body truncate">
                    {step.description}
                  </p>
                </div>
                <div className="flex items-baseline gap-2 shrink-0">
                  <span className="font-mono text-base font-semibold text-foreground tabular-nums">
                    {step.count}
                  </span>
                  {!isFirst && (
                    <span
                      className="font-mono text-[11px] text-muted-foreground tabular-nums"
                      title="Conversão a partir da etapa anterior"
                    >
                      {step.pctOfPrev.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="relative h-8 rounded-md bg-muted/40 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPct}%` }}
                  transition={{ delay: idx * 0.08 + 0.15, duration: 0.5, ease: "easeOut" }}
                  className="h-full rounded-md flex items-center px-3"
                  style={{ backgroundColor: color }}
                >
                  <span className="text-[11px] font-medium text-white/95 font-mono tabular-nums">
                    {step.pctOfTop.toFixed(1)}% do topo
                  </span>
                </motion.div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
