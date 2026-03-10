import { Download, Loader2, Calendar, User, Building, Ruler, UserCheck, Hash, Clock, ShieldCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/ThemeToggle";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { formatDate, formatDateLong, getValidityInfo } from "@/lib/formatBRL";
import { ValidityCountdown } from "@/components/budget/ValidityCountdown";

interface BudgetHeaderProps {
  budget: any;
  onExportPdf?: () => void;
  exporting?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validUntil = budget.date && budget.validity_days
    ? new Date(new Date(budget.date).getTime() + budget.validity_days * 86400000)
    : null;

  const metaItems = [
    budget.metragem && { icon: Ruler, label: "Metragem", value: budget.metragem },
    budget.versao && { icon: Hash, label: "Versão", value: budget.versao },
    budget.date && { icon: Calendar, label: "Data", value: formatDate(budget.date) },
    validUntil && { icon: Clock, label: "Validade", value: formatDate(validUntil) },
    budget.consultora_comercial && { icon: UserCheck, label: "Consultora", value: budget.consultora_comercial },
  ].filter(Boolean) as { icon: any; label: string; value: string }[];

  return (
    <header className="relative">
      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${headerBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/50 to-charcoal/80" />

        {/* Nav */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-7 sm:h-9 lg:h-10" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-all text-xs font-body font-medium disabled:opacity-50 border border-white/10"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{exporting ? "Gerando..." : "PDF"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* Hero */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 lg:gap-12 items-end py-8 sm:py-12 lg:py-16">
            {/* Left — Title & subtitle */}
            <div>
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="inline-flex items-center gap-1.5 text-xs font-body uppercase tracking-[0.2em] text-white/40 mb-3 sm:mb-4"
              >
                <span className="w-6 h-px bg-white/30" />
                Orçamento Bwild
              </motion.div>

              <motion.h1
                variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
                className="font-display font-extrabold text-[clamp(1.75rem,5vw,3.5rem)] text-white leading-[1.05] tracking-tight"
              >
                Projeto e<br />Reforma
              </motion.h1>

              <motion.p
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="mt-3 text-xs sm:text-sm font-body text-white/40 max-w-md leading-relaxed"
              >
                Projeto personalizado · Gestão completa · Execução com previsibilidade
              </motion.p>

              {/* Value badges */}
              <motion.div
                variants={fadeUp} custom={1.5} initial="hidden" animate="visible"
                className="mt-4 sm:mt-5 flex flex-wrap gap-1.5"
              >
                {["✦ Projeto personalizado", "📱 Acompanhamento digital", "🛡️ Garantia 5 anos"].map((badge) => (
                  <span
                    key={badge}
                    className="text-xs rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-white/50 font-body"
                  >
                    {badge}
                  </span>
                ))}
              </motion.div>

              {/* Status strip */}
              <motion.div
                variants={fadeUp} custom={2} initial="hidden" animate="visible"
                className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-white/30 font-body"
              >
                <span>Etapa: <span className="text-white/50">Orçamento</span></span>
                <span className="text-white/15">·</span>
                <span>Próximo: <span className="text-white/50">Briefing</span></span>
                <span className="text-white/15">·</span>
                <span>Início: <span className="text-white/50">Imediato</span></span>
              </motion.div>

              {/* Validity notice */}
              {budget.date && (
                <motion.div
                  variants={fadeUp} custom={2.5} initial="hidden" animate="visible"
                  className="mt-3"
                >
                  {(() => {
                    const { expiresAt, expired } = getValidityInfo(budget.date, budget.validity_days || 30);
                    return (
                      <p className={`text-xs font-body ${expired ? 'text-destructive/80' : 'text-white/40'}`}>
                        {expired
                          ? "Valores e condições deste orçamento expiraram — solicite uma atualização."
                          : `Este orçamento reflete valores e condições válidos até ${formatDateLong(expiresAt)}.`
                        }
                      </p>
                    );
                  })()}
                </motion.div>
              )}
            </div>

            {/* Right — Client & Project info card */}
            <motion.div
              variants={fadeUp} custom={1} initial="hidden" animate="visible"
              className="w-full lg:w-[320px] xl:w-[360px]"
            >
              <div className="rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/[0.1] overflow-hidden">
                {/* Client & Obra */}
                <div className="grid grid-cols-2 divide-x divide-white/[0.08]">
                  {[
                    { icon: User, label: "Cliente", value: budget.client_name },
                    { icon: Building, label: "Obra", value: budget.condominio || budget.project_name },
                  ].map((field, i) => (
                    <div key={i} className="px-4 sm:px-5 py-4 sm:py-5 text-center">
                      <field.icon className="h-4 w-4 text-white/30 mx-auto mb-1.5" />
                      <p className="text-xs text-white/35 font-body uppercase tracking-[0.15em] mb-0.5">{field.label}</p>
                      <p className="text-sm sm:text-base font-display font-bold text-white truncate">{field.value}</p>
                    </div>
                  ))}
                </div>

                {/* Meta items */}
                {metaItems.length > 0 && (
                  <div className="border-t border-white/[0.08] px-4 sm:px-5 py-3 grid grid-cols-2 gap-x-4 gap-y-2">
                    {metaItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-2 min-w-0">
                        <item.icon className="h-3 w-3 text-white/25 flex-shrink-0" />
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="text-xs text-white/30 font-body uppercase tracking-wider flex-shrink-0">{item.label}</span>
                          <span className="text-xs font-display font-semibold text-white/80 truncate">{item.value}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </header>
  );
}
