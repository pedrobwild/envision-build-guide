import { useState } from "react";
import { CreditCard, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

const MONO_VALUE = "font-mono tabular-nums font-semibold text-primary";
const MONO_STYLE: React.CSSProperties = { fontFeatureSettings: '"tnum" 1', letterSpacing: '-0.02em' };
const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 18];

interface InstallmentSimulatorProps {
  total: number;
  installments: number;
  onInstallmentsChange: (n: number) => void;
}

export function InstallmentSimulator({
  total,
  installments,
  onInstallmentsChange,
}: InstallmentSimulatorProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-border/50 bg-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3.5 min-h-[48px]",
          "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] rounded-t-2xl"
        )}
      >
        <div className="flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-muted-foreground/50" aria-hidden />
          <span className="text-[13px] font-body font-medium text-foreground">
            Simular parcelamento
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(MONO_VALUE, "text-[13px]")} style={MONO_STYLE}>
            {installments}×
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground/40 transition-transform duration-200",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="max-h-[240px] overflow-y-auto rounded-xl border border-border/30 bg-background divide-y divide-border/[0.06]">
                {INSTALLMENT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => {
                      onInstallmentsChange(n);
                      setOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3.5 py-2.5 text-sm transition-colors min-h-[44px]",
                      "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]",
                      installments === n
                        ? "bg-primary/[0.05] text-primary"
                        : "text-foreground hover:bg-muted/30"
                    )}
                  >
                    <span className="font-body text-[13px]">
                      <span className="font-mono tabular-nums" style={MONO_STYLE}>
                        {n}
                      </span>
                      <span className="text-muted-foreground/60 ml-1">
                        × {n === 1 ? "parcela" : "parcelas"}
                      </span>
                    </span>
                    <span
                      className="font-mono font-semibold tabular-nums text-[13px]"
                      style={MONO_STYLE}
                    >
                      {formatBRL(total / n)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground/40 font-body mt-2.5 text-center">
                Condições sob consulta
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
