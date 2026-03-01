import { useState } from "react";
import { formatBRL } from "@/lib/formatBRL";
import { motion } from "framer-motion";
import { Calculator } from "lucide-react";

interface InstallmentSimulatorProps {
  total: number;
}

const options = [
  { months: 6, label: "6×" },
  { months: 10, label: "10×" },
  { months: 12, label: "12×" },
];

export function InstallmentSimulator({ total }: InstallmentSimulatorProps) {
  const [selected, setSelected] = useState(10);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-4 w-4 text-primary" />
        <h4 className="font-display font-bold text-sm text-foreground">Simulador de Parcelas</h4>
      </div>

      <div className="flex gap-2 mb-4">
        {options.map((opt) => (
          <button
            key={opt.months}
            onClick={() => setSelected(opt.months)}
            className={`flex-1 py-2 rounded-md text-sm font-body font-semibold transition-all ${
              selected === opt.months
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <motion.div
        key={selected}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <p className="text-xs text-muted-foreground font-body mb-1">
          {selected}× de
        </p>
        <p className="font-display font-bold text-xl text-primary">
          {formatBRL(total / selected)}
        </p>
        <p className="text-xs text-muted-foreground font-body mt-1">
          sem juros
        </p>
      </motion.div>
    </div>
  );
}
