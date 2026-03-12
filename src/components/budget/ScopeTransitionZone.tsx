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
      className="py-4 sm:py-5 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8"
    >
      <div className="text-center mb-4">
        <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
          Detalhamento da Mobília e Eletros
        </h2>
      </div>
      
    </motion.div>
  );
}
