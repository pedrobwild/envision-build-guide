import { forwardRef } from "react";
import { motion } from "framer-motion";
import { CountUpValue } from "../CountUpValue";
import { TrustBadgesRow } from "./TrustBadgesRow";
import { InstallmentPreview } from "./InstallmentPreview";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatBRL";
import type { AbatementLine } from "@/lib/budget-calc";

const LABEL = "budget-label text-[10px] text-muted-foreground";

interface InvestmentSummaryCardProps {
  total: number;
  installments: number;
  /** Loading skeleton state */
  loading?: boolean;
  /** Promotional discount amount (positive number, optional) — total agregado */
  discount?: number;
  /** Credit/abatement amount (positive number, optional) — total agregado */
  credit?: number;
  /** Subtotal before discount+credit (optional) */
  subtotal?: number;
  /** Linhas de desconto agrupadas por rótulo do item (sem expor valor por item) */
  discounts?: AbatementLine[];
  /** Linhas de crédito agrupadas por rótulo do item */
  credits?: AbatementLine[];
}

export const InvestmentSummaryCard = forwardRef<HTMLDivElement, InvestmentSummaryCardProps>(
  function InvestmentSummaryCard(
    { total, installments, loading, discount = 0, credit = 0, subtotal = 0, discounts = [], credits = [] },
    ref,
  ) {
    if (loading) {
      return (
        <div
          ref={ref}
          className="relative rounded-2xl border border-border/30 px-5 py-5 bg-muted/10 animate-pulse"
        >
          <div className="space-y-3">
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="h-8 w-44 rounded bg-muted/30" />
            <div className="h-3.5 w-36 rounded bg-muted/20" />
          </div>
        </div>
      );
    }

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-xl border border-primary/10 px-4 py-3.5 overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)",
          boxShadow:
            "0 6px 20px -8px hsl(var(--primary) / 0.10), 0 1px 4px -1px hsl(var(--primary) / 0.04)",
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute -top-16 -right-16 w-32 h-32 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative space-y-1.5">
          {(discount > 0 || credit > 0) && subtotal > 0 && (() => {
            // Se vieram listas detalhadas por rótulo, renderiza-as.
            // Senão, mantém compat com totais agregados (1 linha cada).
            const discountLines: AbatementLine[] =
              discounts.length > 0
                ? discounts
                : discount > 0
                ? [{ label: "Desconto promocional", total: discount }]
                : [];
            const creditLines: AbatementLine[] =
              credits.length > 0
                ? credits
                : credit > 0
                ? [{ label: "Crédito", total: credit }]
                : [];
            return (
              <div className="space-y-1 pb-2 mb-1 border-b border-border/60">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] text-muted-foreground font-body">Subtotal</span>
                  <span className="text-sm font-body tabular-nums text-muted-foreground line-through">
                    {formatBRL(subtotal)}
                  </span>
                </div>
                {discountLines.map((line) => (
                  <div key={`d-${line.label}`} className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-body font-medium text-emerald-700 dark:text-emerald-400 truncate">
                      {line.label}
                    </span>
                    <span className="text-sm font-body font-semibold tabular-nums text-emerald-700 dark:text-emerald-400 shrink-0">
                      − {formatBRL(line.total)}
                    </span>
                  </div>
                ))}
                {creditLines.map((line) => (
                  <div key={`c-${line.label}`} className="flex items-baseline justify-between gap-3">
                    <span className="text-[11px] font-body font-medium text-sky-700 dark:text-sky-400 truncate">
                      {line.label}
                    </span>
                    <span className="text-sm font-body font-semibold tabular-nums text-sky-700 dark:text-sky-400 shrink-0">
                      − {formatBRL(line.total)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })()}
          {/* Total — label e valor sem espaço extra para criar bloco coeso */}
          <div>
            <p className={cn(LABEL, "mb-0.5 leading-none")}>Investimento total</p>
            <CountUpValue
              value={total}
              className={cn(
                "budget-currency font-extrabold text-primary leading-none block",
                total >= 1_000_000 ? "text-[1.25rem]" : "text-[1.5rem]"
              )}
              style={{ letterSpacing: "-0.03em" }}
            />
          </div>

          {/* Installment inline preview — typography shared with desktop TotalCard */}
          <InstallmentPreview total={total} installments={installments} />

          {/* Trust badges */}
          <TrustBadgesRow />
        </div>
      </motion.div>
    );
  }
);
