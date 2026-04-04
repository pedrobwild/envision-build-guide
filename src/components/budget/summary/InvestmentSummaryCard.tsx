import { forwardRef } from "react";
import { motion } from "framer-motion";
import { CountUpValue } from "../CountUpValue";
import { TrustBadgesRow } from "./TrustBadgesRow";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

const LABEL = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-muted-foreground/40";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };

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
          className="relative rounded-2xl border border-border/30 px-6 py-7 bg-muted/10 animate-pulse"
        >
          <div className="space-y-4">
            <div className="h-3 w-24 rounded bg-muted/40" />
            <div className="h-10 w-48 rounded bg-muted/30" />
            <div className="h-4 w-36 rounded bg-muted/20" />
            <div className="border-t border-border/10 pt-4 flex gap-6">
              <div className="h-3 w-20 rounded bg-muted/20" />
              <div className="h-3 w-28 rounded bg-muted/20" />
            </div>
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
        className="relative rounded-2xl border border-primary/10 px-6 py-7 overflow-hidden"
        style={{
          background:
            "linear-gradient(145deg, hsl(var(--primary) / 0.06) 0%, hsl(var(--primary) / 0.02) 40%, hsl(var(--background)) 100%)",
          boxShadow:
            "0 12px 40px -12px hsl(var(--primary) / 0.12), 0 4px 12px -4px hsl(var(--primary) / 0.05)",
        }}
      >
        {/* Decorative glows */}
        <div
          className="absolute -top-24 -right-24 w-56 h-56 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.07) 0%, transparent 70%)",
          }}
          aria-hidden
        />
        <div
          className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.04) 0%, transparent 70%)",
          }}
          aria-hidden
        />

        <div className="relative space-y-5">
          {/* Total */}
          <div className="space-y-2">
            <p className={LABEL}>Investimento total</p>
            <CountUpValue
              value={total}
              className={cn(
                "font-mono font-extrabold text-primary leading-none block tabular-nums",
                /* Scale down for very large values (> R$ 999.999) */
                total >= 1_000_000 ? "text-[1.75rem]" : "text-[2.25rem]"
              )}
              style={{ letterSpacing: "-0.03em", fontFeatureSettings: '"tnum" 1' }}
            />
          </div>

          {/* Installment inline preview */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-[12px] font-body text-muted-foreground/50">ou</span>
            <span
              className="font-mono text-sm font-semibold text-foreground tabular-nums"
              style={MONO_STYLE}
            >
              {formatBRL(total / installments)}
            </span>
            <span className="text-[12px] font-body text-muted-foreground/50">
              em {installments}× sem juros
            </span>
          </div>

          {/* Trust badges */}
          <TrustBadgesRow />
        </div>
      </motion.div>
    );
  }
);
