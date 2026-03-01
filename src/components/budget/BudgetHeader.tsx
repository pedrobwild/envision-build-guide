import { Download, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import { ValidityCountdown } from "@/components/budget/ValidityCountdown";

interface BudgetHeaderProps {
  budget: any;
  onExportPdf?: () => void;
  exporting?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const pills = [
    { label: "Cliente", value: budget.client_name },
    { label: "Metragem", value: budget.metragem },
    { label: "Orçamento", value: budget.versao ? `#${budget.versao}` : null },
  ].filter(p => p.value);

  return (
    <header className="relative">
      {/* Hero with dark overlay */}
      <div className="relative overflow-hidden bg-charcoal min-h-[340px] sm:min-h-[400px] flex flex-col">
        {/* Background image */}
        {budget.floor_plan_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${budget.floor_plan_url})` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-charcoal via-charcoal-light to-charcoal" />
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-charcoal/80 backdrop-blur-sm" />

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-8" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all text-sm font-body font-medium disabled:opacity-50 border border-white/10 hover:border-white/20"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting ? "Gerando..." : "PDF"}
            </motion.button>
          </div>
        </motion.div>

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
          <motion.h1
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="visible"
            className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl text-white leading-tight max-w-3xl"
          >
            {budget.project_name || "Orçamento de Reforma"}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={1}
            initial="hidden"
            animate="visible"
            className="mt-3 text-white/70 font-body text-sm sm:text-base max-w-lg"
          >
            Transformamos ambientes com excelência, design e qualidade
          </motion.p>

          {budget.date && budget.validity_days && (
            <motion.div variants={fadeUp} custom={1.5} initial="hidden" animate="visible" className="mt-3">
              <ValidityCountdown date={budget.date} validityDays={budget.validity_days} />
            </motion.div>
          )}

          {/* Glassmorphism pills */}
          {pills.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              {pills.map((pill, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center px-6 py-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 min-w-[120px]"
                >
                  <span className="text-[11px] text-white/60 font-body uppercase tracking-wider">{pill.label}</span>
                  <span className="text-sm sm:text-base font-display font-bold text-white mt-0.5">{pill.value}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
