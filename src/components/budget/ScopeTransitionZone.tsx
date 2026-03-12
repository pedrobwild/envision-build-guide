import { motion } from "framer-motion";
import type { BudgetSection } from "@/types/budget";

interface ScopeTransitionZoneProps {
  sections: BudgetSection[];
  total: number;
}

export function ScopeTransitionZone({ sections, total }: ScopeTransitionZoneProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="py-12 lg:py-16"
    >
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          Detalhamento da Mobília e Eletros
        </h2>
        <p className="text-muted-foreground text-sm mt-1 font-body">
          Especificação completa dos itens selecionados para o seu projeto
        </p>
      </div>
    </motion.div>
  );
}
