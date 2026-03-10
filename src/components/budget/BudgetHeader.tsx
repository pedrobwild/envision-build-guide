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
      <div className="relative overflow-hidden min-h-[320px] sm:min-h-[400px] lg:min-h-[480px] flex flex-col">
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
          <img src={logoWhite} alt="Bwild" className="h-9 sm:h-12" />
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

        {/* Center content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-4 py-6 sm:py-10">
          <motion.h1
            variants={fadeUp}
            custom={0}
            initial="hidden"
            animate="visible"
            className="font-display font-extrabold text-2xl sm:text-3xl lg:text-5xl text-white leading-tight max-w-3xl"
          >
            Orçamento de Projeto e Reforma
          </motion.h1>

          <motion.p
            variants={fadeUp}
            custom={0.5}
            initial="hidden"
            animate="visible"
            className="mt-2 sm:mt-3 text-sm sm:text-base lg:text-lg font-body text-white/60 text-center"
          >
            Projeto personalizado · Gestão completa · Execução com previsibilidade
          </motion.p>

          {/* Highlighted fields: Cliente & Obra */}
          {highlightFields.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={1}
              initial="hidden"
              animate="visible"
              className="mt-5 sm:mt-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4 max-w-4xl w-full"
            >
              {highlightFields.map((field, i) => (
                <div
                  key={i}
                  className="flex flex-col items-center px-5 sm:px-8 py-3 sm:py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 min-w-[120px] sm:min-w-[160px] flex-1 max-w-[200px]"
                >
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5">
                    <field.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white/50" />
                    <span className="text-[10px] sm:text-[11px] text-white/50 font-body uppercase tracking-wider">{field.label}</span>
                  </div>
                  <span className="text-sm sm:text-base lg:text-lg font-display font-bold text-white text-center leading-snug">{field.value}</span>
                </div>
              ))}
            </motion.div>
          )}

          {/* Secondary info pills - scrollable on mobile */}
          {infoFields.length > 0 && (
            <motion.div
              variants={fadeUp}
              custom={2}
              initial="hidden"
              animate="visible"
              className="mt-3 sm:mt-4 w-full max-w-4xl overflow-x-auto scrollbar-none"
            >
              <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-2.5 px-1 pb-1 sm:flex-wrap min-w-max sm:min-w-0">
                {infoFields.map((field, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-white/[0.08] backdrop-blur-md border border-white/10 whitespace-nowrap"
                  >
                    <field.icon className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-white/50 shrink-0" />
                    <div className="flex items-center gap-1 sm:gap-1.5">
                      <span className="text-[9px] sm:text-[10px] text-white/45 font-body uppercase tracking-wider">{field.label}</span>
                      <span className="text-[11px] sm:text-xs font-display font-semibold text-white/90">{field.value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Value badges */}
          <motion.div
            variants={fadeUp}
            custom={3}
            initial="hidden"
            animate="visible"
            className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
          >
            {["✦ Projeto 100% personalizado", "📱 Acompanhamento digital", "🛡️ Garantia 5 anos"].map((badge) => (
              <span
                key={badge}
                className="text-[10px] sm:text-xs rounded-full border border-white/15 bg-white/[0.06] backdrop-blur-md px-2.5 sm:px-3 py-1 text-white/70 font-body"
              >
                {badge}
              </span>
            ))}
          </motion.div>

          {/* Status strip - hidden on mobile to save space */}
          <motion.div
            variants={fadeUp}
            custom={3.5}
            initial="hidden"
            animate="visible"
            className="hidden sm:flex mt-4 flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/40 font-body"
          >
            <span>Etapa: <span className="text-white/60">Orçamento</span></span>
            <span>|</span>
            <span>Próximo passo: <span className="text-white/60">Briefing com arquiteta</span></span>
            <span>|</span>
            <span>Início: <span className="text-white/60">Imediato após aprovação</span></span>
          </motion.div>
        </div>
      </div>
    </header>
  );
}
