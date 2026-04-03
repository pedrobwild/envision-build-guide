import { motion } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";
import { CreditCard, TrendingUp } from "lucide-react";

interface MobilePriceAnchorProps {
  total: number;
  validityDaysLeft: number;
  expired: boolean;
}

export function MobilePriceAnchor({ total, validityDaysLeft, expired }: MobilePriceAnchorProps) {
  const installment10x = total / 10;

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
          <p className="text-2xl font-display font-bold text-foreground tracking-tight leading-none">
            {formatBRL(total)}
          </p>
          <div className="flex items-center gap-1.5 mt-1.5">
            <CreditCard className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span className="text-xs text-muted-foreground font-body">
              ou <strong className="text-foreground">10× {formatBRL(installment10x)}</strong> sem juros
            </span>
          </div>
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
    </motion.div>
  );
}
