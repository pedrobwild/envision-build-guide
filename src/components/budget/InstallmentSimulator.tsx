import { useState } from "react";
import { formatBRL } from "@/lib/formatBRL";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, ChevronDown } from "lucide-react";

interface InstallmentSimulatorProps {
  total: number;
}

const options = Array.from({ length: 18 }, (_, i) => ({
  months: i + 1,
  label: `${i + 1} ${i === 0 ? 'parcela' : 'parcelas'}`,
}));

export function InstallmentSimulator({ total }: InstallmentSimulatorProps) {
  const [selected, setSelected] = useState(18);
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((o) => o.months === selected)!;

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <CreditCard className="h-4 w-4 text-primary" />
        <h4 className="font-display font-bold text-sm text-foreground">Formas de Pagamento</h4>
      </div>

      <p className="text-sm text-muted-foreground font-body mb-4">
        Cartão de crédito em até <strong className="text-foreground">18× sem juros</strong>.
      </p>

      {/* Dropdown selector */}
      <div className="relative mb-4">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors text-sm font-body"
        >
          <span className="text-foreground font-medium">
            {selectedOption.label}
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.ul
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute z-10 mt-1 w-full bg-card border border-border rounded-lg shadow-lg overflow-y-auto max-h-60"
            >
              {options.map((opt) => (
                <li key={opt.months}>
                  <button
                    onClick={() => { setSelected(opt.months); setOpen(false); }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-body transition-colors ${
                      selected === opt.months
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted"
                    }`}
                  >
                    <span>{opt.label}</span>
                    <span className="font-semibold tabular-nums">{formatBRL(total / opt.months)} <span className="font-normal text-muted-foreground">sem juros</span></span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-sm text-muted-foreground font-body mb-1">
          {selected}× de
        </p>
        <p className="font-display font-bold text-xl text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatBRL(total / selected)}
        </p>
        <p className="text-xs text-muted-foreground font-body mt-3">
          Consultar outras formas de pagamento com sua consultora comercial
        </p>
      </motion.div>
    </div>
  );
}
