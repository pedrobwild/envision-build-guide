import { forwardRef } from "react";
import { motion } from "framer-motion";
import { CountUpValue } from "../CountUpValue";
import { TrustBadgesRow } from "./TrustBadgesRow";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

const LABEL = "budget-label text-[10px] text-muted-foreground";

interface InvestmentSummaryCardProps {
  total: number;
  installments: number;
  /** Loading skeleton state */
  loading?: boolean;
}

export const InvestmentSummaryCard = forwardRef<HTMLDivElement, InvestmentSummaryCardProps>(
  function InvestmentSummaryCard({ total, installments, loading }, ref) {
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
        className="relative rounded-2xl border border-primary/10 px-5 py-5 overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)",
          boxShadow:
            "0 8px 28px -8px hsl(var(--primary) / 0.10), 0 2px 8px -2px hsl(var(--primary) / 0.04)",
        }}
      >
        {/* Decorative glow */}
        <div
          className="absolute -top-20 -right-20 w-44 h-44 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative space-y-3">
          {/* Total */}
          <div className="space-y-1.5">
            <p className={LABEL}>Investimento total</p>
            <CountUpValue
              value={total}
              className={cn(
                "budget-currency font-extrabold text-primary leading-none block",
                total >= 1_000_000 ? "text-[1.5rem]" : "text-[1.875rem]"
              )}
              style={{ letterSpacing: "-0.03em" }}
            />
          </div>

          {/* Installment inline preview */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[12px] font-body text-muted-foreground">ou</span>
            <span className="budget-currency text-sm font-semibold text-foreground">
              {formatBRL(total / installments)}
            </span>
            <span className="text-[12px] font-body text-muted-foreground">
              em <span className="budget-numeric">{installments}×</span> sem juros
            </span>
          </div>

          {/* Trust badges */}
          <TrustBadgesRow />
        </div>
      </motion.div>
    );
  }
);
