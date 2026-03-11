import { Download, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { formatDate, getValidityInfo } from "@/lib/formatBRL";

export interface HeaderConfig {
  hide_badge?: boolean;
  hide_client_context?: boolean;
  hide_subtitle?: boolean;
  hide_tagline?: boolean;
  hide_stat_badges?: boolean;
  hide_status_strip?: boolean;
  hide_validity?: boolean;
  hide_consultora?: boolean;
  custom_tagline?: string;
  custom_subtitle?: string;
}

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

/** Capitalize each word: "pedro henrique" → "Pedro Henrique" */
function titleCase(str: string) {
  return str.toLowerCase().replace(/\b\w/g, (l) => l.toUpperCase());
}

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validity = budget.date ? getValidityInfo(budget.date, budget.validity_days || 30) : null;
  const validityLabel = validity
    ? validity.expired
      ? "Proposta expirada"
      : `Válido até ${formatDate(validity.expiresAt)}`
    : null;

  const cfg: HeaderConfig = (budget.header_config as HeaderConfig) || {};

  // Unified meta line: bairro · metragem · versão · data
  const neighborhood = budget.bairro || budget.condominio || "";
  const area = budget.metragem ? `${budget.metragem}${budget.metragem.toString().includes('m²') ? '' : 'm²'}` : "";
  const version = budget.versao ? budget.versao.replace(/^v/i, '') : "";
  const dateStr = budget.date ? formatDate(budget.date) : "";

  const statBadges = [
    { value: "5 anos", label: "garantia", accent: false },
  ];

  const clientName = titleCase(budget.client_name || "");

  const projectTitle = budget.project_name || "Projeto e Reforma";
  const showPersonalizedSubtitle = !cfg.hide_subtitle && (!budget.project_name || budget.project_name === "Projeto e Reforma");

  const tagline = cfg.custom_tagline || "Projeto personalizado · Gestão completa · Execução com garantia";
  const subtitleText = cfg.custom_subtitle || `Orçamento personalizado para ${clientName}`;

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

        {/* ─── FAIXA 1 — Nav (logo + consultora + PDF) ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-7 sm:h-9 lg:h-8" />
          <div className="flex items-center gap-3">
            {!cfg.hide_consultora && budget.consultora_comercial && (
              <span className="hidden lg:inline text-xs text-white/70 font-body">
                {budget.consultora_comercial}, sua consultora
              </span>
            )}
            {!cfg.hide_consultora && budget.consultora_comercial && (
              <span className="hidden lg:block w-px h-4 bg-white/20" />
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

        {/* ─── Context bar (badge only, no client name duplication) ─── */}
        {!cfg.hide_client_context && !cfg.hide_badge && (
          <motion.div
            variants={fadeUp} custom={0} initial="hidden" animate="visible"
            className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-3"
          >
            <div className="flex items-center py-2 border-b border-white/[0.08]">
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-white bg-white/[0.08] border border-white/[0.12] rounded-md px-3 py-1">
                Orçamento
              </span>
            </div>
          </motion.div>
        )}

        {/* ─── FAIXA 2 — Conteúdo principal ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE (<lg) ── */}
          <div className="lg:hidden py-5">
            <motion.h1
              variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
              className="font-display font-extrabold text-2xl text-white leading-[1.05] tracking-tight"
            >
              {clientName || projectTitle}
            </motion.h1>

            {/* Meta line: bairro · metragem · versão · data */}
            <motion.div
              variants={fadeUp} custom={0.8} initial="hidden" animate="visible"
              className="mt-2 flex items-center gap-2 text-xs font-body flex-wrap"
            >
              {neighborhood && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-white/40 text-[10px] uppercase tracking-wide font-medium">Obra</span>
                    <span className="text-white/90 font-semibold">{neighborhood}</span>
                  </span>
                  {(area || version || dateStr) && <span className="text-white/20">|</span>}
                </>
              )}
              {area && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-white/40 text-[10px] uppercase tracking-wide font-medium">Área</span>
                    <span className="text-white/90 font-semibold">{area}</span>
                  </span>
                  {(version || dateStr) && <span className="text-white/20">|</span>}
                </>
              )}
              {version && (
                <>
                  <span className="inline-flex items-center gap-1">
                    <span className="text-white/40 text-[10px] uppercase tracking-wide font-medium">Versão</span>
                    <span className="text-white/90 font-semibold">{version}</span>
                  </span>
                  {dateStr && <span className="text-white/20">|</span>}
                </>
              )}
              {dateStr && (
                <span className="text-white/50">{dateStr}</span>
              )}
            </motion.div>

            {!cfg.hide_tagline && (
              <motion.p
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="mt-2 text-xs font-body text-white/60 leading-relaxed"
              >
                {tagline}
              </motion.p>
            )}

            {!cfg.hide_status_strip && (
              <motion.div
                variants={fadeUp} custom={2} initial="hidden" animate="visible"
                className="mt-2 flex items-center gap-2 text-xs text-white/60 font-body"
              >
                <span>Etapa: <span className="text-white/80">Orçamento</span></span>
                {!cfg.hide_validity && validityLabel && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className={validity?.expired ? 'text-destructive' : 'text-white/80'}>{validityLabel}</span>
                  </>
                )}
              </motion.div>
            )}
          </div>

          {/* ── DESKTOP (lg+) ── */}
          <div className="hidden lg:flex items-start justify-between py-5">
            {/* Left — Client name + meta */}
            <div className="flex-1 min-w-0">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
              >
                <h1 className="font-display font-extrabold text-[1.85rem] xl:text-3xl text-white leading-[1.1] tracking-tight">
                  {clientName || projectTitle}
                </h1>

                {/* Labeled meta chips */}
                <div className="mt-2 flex items-center gap-2.5 text-sm font-body flex-wrap">
                  {neighborhood && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-white/40 text-xs uppercase tracking-wide font-medium">Obra</span>
                        <span className="text-white/90 font-semibold">{neighborhood}</span>
                      </span>
                      {(area || version || dateStr) && <span className="text-white/20 text-xs">|</span>}
                    </>
                  )}
                  {area && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-white/40 text-xs uppercase tracking-wide font-medium">Área</span>
                        <span className="text-white/90 font-semibold">{area}</span>
                      </span>
                      {(version || dateStr) && <span className="text-white/20 text-xs">|</span>}
                    </>
                  )}
                  {version && (
                    <>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-white/40 text-xs uppercase tracking-wide font-medium">Versão</span>
                        <span className="text-white/90 font-semibold">{version}</span>
                      </span>
                      {dateStr && <span className="text-white/20 text-xs">|</span>}
                    </>
                  )}
                  {dateStr && (
                    <span className="text-white/50">{dateStr}</span>
                  )}
                </div>
              </motion.div>

              {!cfg.hide_tagline && (
                <motion.p
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="mt-2.5 text-xs text-white/60 font-body"
                >
                  {tagline}
                </motion.p>
              )}
            </div>

            {/* Right — Stat badge (garantia only) */}
            {!cfg.hide_stat_badges && (
              <motion.div
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="flex items-center gap-3 flex-shrink-0 ml-8"
              >
                {statBadges.map((badge) => (
                  <div key={badge.label} className="text-center min-w-[56px]">
                    <p className="text-lg font-extrabold font-mono leading-none text-white">
                      {badge.value}
                    </p>
                    <p className="text-xs uppercase tracking-wider text-white/60 font-body mt-1">
                      {badge.label}
                    </p>
                  </div>
                ))}
              </motion.div>
            )}
          </div>
        </div>

        {/* ─── FAIXA 3 — Status strip (desktop) — sem "Início: Imediato" ─── */}
        {!cfg.hide_status_strip && (
          <motion.div
            variants={fadeUp} custom={2} initial="hidden" animate="visible"
            className="relative z-10 hidden lg:block border-t border-white/[0.06] bg-black/10"
          >
            <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-2.5 flex items-center justify-between">
              <p className="text-xs text-white/60 font-body">
                Etapa: <span className="text-white/90">Orçamento</span>
                <span className="mx-2 text-white/20">·</span>
                Próximo: <span className="text-white/90">Briefing</span>
              </p>
              {!cfg.hide_validity && validityLabel && (
                <p className={`text-sm font-body ${validity?.expired ? 'text-destructive' : 'text-white/80'}`}>
                  {validity?.expired
                    ? "Valores expirados — solicite atualização"
                    : `Valores válidos até ${formatDate(validity!.expiresAt)}`
                  }
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </header>
  );
}
