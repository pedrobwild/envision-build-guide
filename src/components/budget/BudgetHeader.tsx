import { Download, Loader2, Calendar, MapPin, User, Building, Ruler, UserCheck, Mail, Hash, Clock } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { formatDate } from "@/lib/formatBRL";

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
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  const infoFields = [
    { icon: User, label: "Cliente", value: budget.client_name },
    { icon: Building, label: "Obra", value: budget.condominio },
    { icon: MapPin, label: "Bairro", value: budget.bairro },
    { icon: Ruler, label: "Metragem", value: budget.metragem },
    { icon: Hash, label: "Versão", value: budget.versao },
    { icon: Calendar, label: "Data", value: budget.date ? formatDate(budget.date) : null },
    { icon: Clock, label: "Validade", value: validUntil ? formatDate(validUntil) : null },
    { icon: UserCheck, label: "Consultora", value: budget.consultora_comercial },
    { icon: Mail, label: "E-mail", value: budget.email_comercial },
  ].filter(f => f.value);

  return (
    <header className="relative">
      <div className="relative overflow-hidden min-h-[420px] sm:min-h-[480px] flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${headerBg})` }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-charcoal/40" />

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
            Orçamento de Projeto e Reforma
          </motion.h1>


          {/* Project info pills */}
          {infoFields.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="mt-8 flex flex-wrap items-center justify-center gap-3 max-w-4xl"
            >
              {infoFields.map((field, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15"
                >
                  <field.icon className="h-4 w-4 text-white/60 shrink-0" />
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-white/50 font-body uppercase tracking-wider">{field.label}</span>
                    <span className="text-sm font-display font-semibold text-white">{field.value}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </header>
  );
}
