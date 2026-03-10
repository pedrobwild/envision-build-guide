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

  const highlightFields = [
    { icon: User, label: "Cliente", value: budget.client_name },
    { icon: Building, label: "Obra", value: budget.condominio },
  ].filter(f => f.value);

  const infoFields = [
    { icon: Ruler, label: "Metragem", value: budget.metragem },
    { icon: Hash, label: "Versão", value: budget.versao },
    { icon: Calendar, label: "Data", value: budget.date ? formatDate(budget.date) : null },
    { icon: Clock, label: "Validade", value: validUntil ? formatDate(validUntil) : null },
    { icon: UserCheck, label: "Consultora", value: budget.consultora_comercial },
  ].filter(f => f.value);

  return (
    <header className="relative">
      <div className="relative overflow-hidden flex flex-col">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${headerBg})` }}
        />
        <div className="absolute inset-0 bg-charcoal/50" />

        {/* Top bar */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-8 sm:h-10 lg:h-12" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all text-xs sm:text-sm font-body font-medium disabled:opacity-50 border border-white/10 hover:border-white/20"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span className="hidden sm:inline">{exporting ? "Gerando..." : "PDF"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Main hero content */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-8 sm:pt-12 lg:pt-16 pb-8 sm:pb-12 lg:pb-16">
          {/* Title */}
          <motion.h1
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="visible"
            className="font-display font-extrabold text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-white leading-[1.1] max-w-2xl"
          >
            Orçamento de Projeto e Reforma
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={0.5}
            initial="hidden"
            animate="visible"
            className="mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg font-body text-white/50 max-w-xl"
          >
            Projeto personalizado · Gestão completa · Execução com previsibilidade
          </motion.p>

          {/* Client & Project — prominent cards */}
          {highlightFields.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              className="mt-8 sm:mt-10 flex flex-wrap gap-3 sm:gap-4"
            >
              {highlightFields.map((field, i) => (
                <div
                  key={i}
                  className="group flex items-center gap-4 px-6 sm:px-8 py-4 sm:py-5 rounded-2xl bg-white/[0.07] backdrop-blur-xl border border-white/[0.12] hover:bg-white/[0.1] transition-colors min-w-[180px] sm:min-w-[220px]"
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                    <field.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white/60" />
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] text-white/40 font-body uppercase tracking-widest block">{field.label}</span>
                    <span className="text-lg sm:text-xl lg:text-2xl font-display font-bold text-white leading-tight">{field.value}</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Info pills — horizontal row */}
          {infoFields.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="mt-5 sm:mt-6 flex flex-wrap gap-2 sm:gap-2.5"
            >
              {infoFields.map((field, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-white/[0.06] backdrop-blur-md border border-white/[0.08]"
                >
                  <field.icon className="h-3.5 w-3.5 text-white/40 shrink-0" />
                  <span className="text-[10px] sm:text-[11px] text-white/40 font-body uppercase tracking-wider">{field.label}</span>
                  <span className="text-xs sm:text-sm font-display font-semibold text-white/90">{field.value}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Value badges */}
          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate="visible"
            className="mt-5 sm:mt-6 flex flex-wrap gap-2"
          >
            {["✦ Projeto 100% personalizado", "📱 Acompanhamento digital", "🛡️ Garantia 5 anos"].map((badge) => (
              <span
                key={badge}
                className="text-[10px] sm:text-xs rounded-full border border-white/[0.12] bg-white/[0.04] backdrop-blur-md px-3 sm:px-4 py-1.5 text-white/60 font-body"
              >
                {badge}
              </span>
            ))}
          </motion.div>

          {/* Status strip */}
          <motion.div
            variants={fadeUp}
            custom={3.5}
            initial="hidden"
            animate="visible"
            className="mt-5 sm:mt-6 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] sm:text-xs text-white/35 font-body"
          >
            <span>Etapa: <span className="text-white/55 font-medium">Orçamento</span></span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span>Próximo passo: <span className="text-white/55 font-medium">Briefing com arquiteta</span></span>
            <span className="hidden sm:inline text-white/20">|</span>
            <span>Início: <span className="text-white/55 font-medium">Imediato após aprovação</span></span>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
