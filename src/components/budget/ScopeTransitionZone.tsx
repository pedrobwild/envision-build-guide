import { motion } from "framer-motion";
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
      className="py-8 sm:py-10 bg-muted/30 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 rounded-xl"
    >
      <div className="text-center mb-6">
        <h2 className="text-lg sm:text-xl font-display font-bold text-foreground">
          Escopo Técnico Detalhado
        </h2>
        <p className="text-sm text-muted-foreground font-body mt-1">
          Tudo o que está incluído no seu investimento
        </p>
      </div>
      
    </motion.div>
  );
}
