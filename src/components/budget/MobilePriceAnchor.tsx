import { motion } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";
import { CreditCard, TrendingUp, ChevronDown } from "lucide-react";

interface MobilePriceAnchorProps {
  total: number;
  validityDaysLeft: number;
  expired: boolean;
}

export function MobilePriceAnchor({ total, validityDaysLeft, expired }: MobilePriceAnchorProps) {
  const installment18x = total / 18;

  const scrollToSummary = () => {
    const el = document.getElementById("resumo-financeiro");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="lg:hidden rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-3">
        {/* Price block */}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-body mb-0.5">Investimento total</p>
          <p className="text-2xl font-display font-bold text-foreground leading-none" style={{ letterSpacing: '-0.03em', fontFeatureSettings: '"tnum" 1' }}>
            {formatBRL(total)}
          </p>
        </div>

        {/* Validity badge */}
        <div
          className={`flex-shrink-0 flex flex-col items-center justify-center rounded-lg px-3 py-2 text-center ${
            expired
              ? "bg-destructive/10 text-destructive"
              : validityDaysLeft <= 5
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-primary/10 text-primary"
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5 mb-0.5" />
          <span className="text-[10px] font-body font-medium leading-tight">
            {expired ? "Expirado" : `${validityDaysLeft}d`}
          </span>
          {!expired && (
            <span className="text-[9px] font-body opacity-70 leading-tight">restantes</span>
          )}
        </div>
      </div>

      {/* CTA to scroll to full summary */}
      <button
        onClick={scrollToSummary}
        className="mt-3 w-full flex items-center justify-center gap-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 active:bg-primary/20 text-primary text-xs font-medium font-body py-2 transition-colors"
      >
        Ver orçamento completo
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}
