import { Download, Loader2 } from "lucide-react";
import { TestimonialVideoPreview } from "./TestimonialVideoModal";
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
      ? "Orçamento expirado"
      : `Validade: ${formatDate(validity.expiresAt)}`
    : null;

  const cfg: HeaderConfig = (budget.header_config as HeaderConfig) || {};

  // Unified meta line: bairro · metragem · versão · data
  const neighborhood = budget.bairro || budget.condominio || "";
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, '').replace(/m²?$/i, '') : "";
  const area = rawArea ? `${rawArea}m²` : "";
  const version = budget.versao ? budget.versao.replace(/^v/i, '').padStart(2, '0') : "";
  const dateStr = budget.date ? formatDate(budget.date) : "";

  const statBadges = [
    { value: "5 anos", label: "garantia", accent: false },
  ];

  const clientName = titleCase(budget.client_name || "");

  const projectTitle = budget.project_name || "Projeto e Reforma";
  const heroTitle = clientName ? `Orçamento ${clientName}` : projectTitle;
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
          <img src={logoWhite} alt="Bwild" className="h-10 sm:h-12 lg:h-11" />
          <div className="flex items-center gap-3">
            {!cfg.hide_consultora && budget.consultora_comercial && (
              <span className="hidden lg:inline text-xs text-white/80 font-body">
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

        {/* ─── Company info strip ─── */}
        <motion.div
          variants={fadeUp} custom={0} initial="hidden" animate="visible"
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-3"
        >
          <div className="py-2 border-b border-white/[0.08]">
            <p className="text-xs font-body text-white/60 leading-relaxed">
              CNPJ: 47.350.338/0001-37 · Responsável Técnico: Thiago Dantas do Amor · CAU: A162437-7
            </p>
          </div>
        </motion.div>

        {/* ─── FAIXA 2 — Conteúdo principal ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE (<lg) ── */}
          <div className="lg:hidden py-6 space-y-3">
            <motion.h1
              variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
              className="font-display font-extrabold text-2xl text-white leading-[1.05] tracking-tight"
            >
              {heroTitle}
            </motion.h1>

            {/* Meta line */}
            <motion.div
              variants={fadeUp} custom={0.8} initial="hidden" animate="visible"
              className="flex items-center gap-2 text-xs font-body flex-wrap"
            >
              {neighborhood && (
                <>
                  <span className="text-white/60">Bairro</span>
                  <span className="text-white/90 font-semibold">{neighborhood}</span>
                  {(area || version || dateStr) && <span className="text-white/20">·</span>}
                </>
              )}
              {area && (
                <>
                  <span className="text-white/60">Área</span>
                  <span className="text-white/90 font-semibold">{area}</span>
                  {(version || dateStr) && <span className="text-white/20">·</span>}
                </>
              )}
              {version && (
                <>
                  <span className="text-white/60">Versão</span>
                  <span className="text-white/90 font-semibold">{version}</span>
                  {dateStr && <span className="text-white/20">·</span>}
                </>
              )}
              {dateStr && (
                <>
                  <span className="text-white/60">Elaboração</span>
                  <span className="text-white/90 font-semibold">{dateStr}</span>
                </>
              )}
            </motion.div>

            {!cfg.hide_tagline && (
              <motion.p
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="text-xs font-body text-white/75 leading-relaxed"
              >
                {tagline}
              </motion.p>
            )}

            {!cfg.hide_status_strip && (
              <motion.div
                variants={fadeUp} custom={2} initial="hidden" animate="visible"
                className="flex items-center gap-2 text-xs text-white/60 font-body"
              >
                <span className="hidden" />
                {!cfg.hide_validity && validityLabel && (
                  <>
                    <span className="text-white/30">·</span>
                    <span className={validity?.expired ? 'text-destructive' : 'text-white/80'}>{validityLabel}</span>
                  </>
                )}
              </motion.div>
            )}

            {!cfg.hide_stat_badges && (
              <motion.div
                variants={fadeUp} custom={2.5} initial="hidden" animate="visible"
              >
                <TestimonialVideoPreview />
              </motion.div>
            )}
          </div>

          {/* ── DESKTOP (lg+) ── */}
          <div className="hidden lg:flex items-start justify-between py-6">
            {/* Left — Client name + meta */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="space-y-2"
              >
                <h1 className="font-display font-extrabold text-[1.85rem] xl:text-3xl text-white leading-[1.1] tracking-tight">
                  {heroTitle}
                </h1>

                {/* Labeled meta chips */}
                <div className="flex items-center gap-2 text-sm font-body flex-wrap">
                  {neighborhood && (
                    <>
                      <span className="text-white/60 text-xs">Bairro</span>
                      <span className="text-white/90 font-semibold">{neighborhood}</span>
                      {(area || version || dateStr) && <span className="text-white/20 text-xs">·</span>}
                    </>
                  )}
                  {area && (
                    <>
                      <span className="text-white/60 text-xs">Área</span>
                      <span className="text-white/90 font-semibold">{area}</span>
                      {(version || dateStr) && <span className="text-white/20 text-xs">·</span>}
                    </>
                  )}
                  {version && (
                    <>
                      <span className="text-white/60 text-xs">Versão</span>
                      <span className="text-white/90 font-semibold">{version}</span>
                      {dateStr && <span className="text-white/20 text-xs">·</span>}
                    </>
                  )}
                  {dateStr && (
                    <>
                      <span className="text-white/60 text-xs">Elaboração</span>
                      <span className="text-white/90 font-semibold">{dateStr}</span>
                    </>
                  )}
                </div>
              </motion.div>

              {!cfg.hide_tagline && (
                <motion.p
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="text-xs text-white/75 font-body"
                >
                  {tagline}
                </motion.p>
              )}
            </div>

            {/* Right — Video testimonial CTA */}
            {!cfg.hide_stat_badges && (
              <motion.div
                variants={fadeUp} custom={1} initial="hidden" animate="visible"
                className="flex-shrink-0 ml-8"
              >
                <TestimonialVideoPreview />
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
              <span className="hidden" />
              {!cfg.hide_validity && validityLabel && (
                <p className={`text-sm font-body ${validity?.expired ? 'text-destructive' : 'text-white/80'}`}>
                  {validity?.expired
                    ? "Orçamento expirado — solicite atualização"
                    : `Validade do orçamento: ${formatDate(validity!.expiresAt)}`
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
