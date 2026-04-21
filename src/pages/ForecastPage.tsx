import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { ForecastPanel } from "@/components/admin/ForecastPanel";
import { useUserProfile } from "@/hooks/useUserProfile";

export default function ForecastPage() {
  const { profile } = useUserProfile();
  const isAdmin = profile?.roles.includes("admin") ?? false;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
              Forecast & Previsibilidade
            </h1>
            <p className="text-sm text-muted-foreground font-body mt-0.5">
              Projeção de receita ponderada, metas mensais e attainment do pipeline comercial
            </p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
      >
        <ForecastPanel ownerFilter={null} isAdmin={isAdmin} />
      </motion.div>
    </div>
  );
}
