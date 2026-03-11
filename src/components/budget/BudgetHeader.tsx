import { Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { formatDate, getValidityInfo } from "@/lib/formatBRL";

interface BudgetHeaderProps {
  budget: any;
  onExportPdf?: () => void;
  exporting?: boolean;
}

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validity = budget.date ? getValidityInfo(budget.date, budget.validity_days || 30) : null;
  const validityLabel = validity
    ? validity.expired
      ? "Proposta expirada"
      : `Válido até ${formatDate(validity.expiresAt)}`
    : null;

  // Desktop inline meta
  const metaLine2 = [
    budget.metragem,
    budget.versao && `v${budget.versao.replace(/^v/i, '')}`,
    budget.date && formatDate(budget.date),
  ].filter(Boolean).join(" · ");

  const statBadges = [
    { value: "5 anos", label: "garantia", accent: false },
    { value: "100%", label: "digital", accent: false },
  ];

  const clientContext = [
    budget.client_name,
    budget.condominio || budget.project_name,
  ].filter(Boolean).join(" · ");

  const projectTitle = budget.project_name || "Projeto e Reforma";
  const showPersonalizedSubtitle = !budget.project_name || budget.project_name === "Projeto e Reforma";

  return (
    <header className="relative">
      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${headerBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-charcoal/70 via-charcoal/50 to-charcoal/80" />
        <div
          className="absolute inset-0 hidden lg:block opacity-[0.015] pointer-events-none"
          style={{
            backgroundImage: 'repeating-linear-gradient(120deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)',
          }}
        />

        {/* ─── FAIXA 1 — Nav ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-7 sm:h-9 lg:h-8" />
          <div className="flex items-center gap-3">
            {budget.consultora_comercial && (
              <span className="hidden lg:inline text-xs text-white/30 font-body">
                {budget.consultora_comercial}, sua consultora
              </span>
            )}
            {budget.consultora_comercial && (
              <span className="hidden lg:block w-px h-4 bg-white/10" />
            )}
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

        {/* ─── Context bar ─── */}
        <motion.div
          variants={fadeUp} custom={0} initial="hidden" animate="visible"
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-3"
        >
          <div className="flex justify-between items-center py-2 border-b border-white/[0.06]">
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/50 bg-white/[0.06] border border-white/[0.08] rounded-md px-3 py-1">
              Orçamento
            </span>
            <span className="text-sm font-medium text-white/70 font-body truncate ml-4">
              {clientContext}
            </span>
          </div>
        </motion.div>

        {/* ─── FAIXA 2 — Conteúdo principal ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE (<lg) ── */}
          <div className="lg:hidden py-5">
            <motion.h1
              variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
              className="font-display font-extrabold text-2xl text-white leading-[1.05] tracking-tight"
            >
              {projectTitle}
            </motion.h1>

            {showPersonalizedSubtitle && (
              <motion.p
                variants={fadeUp} custom={0.8} initial="hidden" animate="visible"
                className="mt-1 text-sm font-body text-white/50"
              >
                Orçamento personalizado para {budget.client_name}
              </motion.p>
            )}

            <motion.p
              variants={fadeUp} custom={1} initial="hidden" animate="visible"
              className="mt-2 text-xs font-body text-white/40 leading-relaxed"
            >
              Projeto personalizado · Acompanhamento digital · Garantia 5 anos
            </motion.p>

            <motion.div
              variants={fadeUp} custom={2} initial="hidden" animate="visible"
              className="mt-2 flex items-center gap-2 text-xs text-white/30 font-body"
            >
              <span>Etapa: <span className="text-white/50">Orçamento</span></span>
              {validityLabel && (
                <>
                  <span className="text-white/15">·</span>
                  <span className={validity?.expired ? 'text-destructive/80' : 'text-white/50'}>{validityLabel}</span>
                </>
              )}
            </motion.div>
          </div>

          {/* ── DESKTOP (lg+) ── */}
          <div className="hidden lg:flex items-start justify-between py-5">
            {/* Left — Title + client data */}
            <div className="flex-1 min-w-0">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="flex items-start gap-5"
              >
                <div className="min-w-0">
                  <h1 className="font-display font-extrabold text-[1.85rem] xl:text-3xl text-white leading-[1.1] tracking-tight">
                    {projectTitle}
                  </h1>
                  {showPersonalizedSubtitle && (
                    <p className="text-sm text-white/50 font-body mt-1">
                      Orçamento personalizado para {budget.client_name}
                    </p>
                  )}
                </div>

                <span className="w-px h-7 bg-white/10 mt-1 flex-shrink-0" />

                <div className="min-w-0 mt-0.5">
                  <p className="text-sm text-white/70 font-body truncate">
                    <span className="font-semibold">{budget.client_name}</span>
                    {(budget.condominio || budget.project_name) && (
                      <span className="text-white/45"> · {budget.condominio || budget.project_name}</span>
                    )}
                  </p>
                  {metaLine2 && (
                    <p className="text-xs text-white/30 font-body mt-0.5">{metaLine2}</p>
                  )}
                </div>
              </motion.div>

              <motion.p
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="mt-2.5 text-xs text-white/30 font-body"
              >
                Projeto personalizado · Gestão completa · Execução com garantia
              </motion.p>
            </div>

            {/* Right — Stat badges (NO 92%) */}
            <motion.div
              variants={fadeUp} custom={1} initial="hidden" animate="visible"
              className="flex items-center gap-3 flex-shrink-0 ml-8"
            >
              {statBadges.map((badge) => (
                <div key={badge.label} className="text-center min-w-[56px]">
                  <p className={`text-lg font-extrabold font-mono leading-none ${badge.accent ? 'text-green-400' : 'text-white/50'}`}>
                    {badge.value}
                  </p>
                  <p className="text-xs uppercase tracking-wider text-white/25 font-body mt-1">
                    {badge.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* ─── FAIXA 3 — Status strip (desktop) ─── */}
        <motion.div
          variants={fadeUp} custom={2} initial="hidden" animate="visible"
          className="relative z-10 hidden lg:block border-t border-white/[0.04] bg-black/10"
        >
          <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
            <p className="text-xs text-white/25 font-body">
              Etapa: <span className="text-white/50">Orçamento</span>
              <span className="mx-2 text-white/10">·</span>
              Próximo: <span className="text-white/50">Briefing</span>
              <span className="mx-2 text-white/10">·</span>
              Início: <span className="text-white/50">Imediato</span>
            </p>
            {validityLabel && (
              <p className={`text-sm font-body ${validity?.expired ? 'text-destructive/60' : 'text-white/40'}`}>
                {validity?.expired
                  ? "Valores expirados — solicite atualização"
                  : `Valores válidos até ${formatDate(validity!.expiresAt)}`
                }
              </p>
            )}
          </div>
        </motion.div>
      </div>
    </header>
  );
}
