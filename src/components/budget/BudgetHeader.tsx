import { Download, Loader2 } from "lucide-react";
import { TestimonialVideoPreview } from "./TestimonialVideoModal";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { ReclameAquiSeal } from "./ReclameAquiSeal";
import { formatDate, getValidityInfo } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";

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


function sanitizeClientName(value: string): string {
  return value
    .replace(/\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2}/g, "")
    .replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2}/g, "")
    .replace(/\b\d{11,14}\b/g, "")
    .replace(/\b(?:n[ºo°]\s*)?\d{5,}\b/gi, "")
    .replace(/^\s*(?:nome\s+do\s+)?cliente\s*[:\-–]?\s*/i, "")
    .replace(/^\s*(?:orçamento|orcamento|proposta)\s*(?:n[ºo°]\s*\d+)?\s*(?:para|de)?\s*/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Normalise proper names: lowercase everything then capitalise each word start (handles accented chars) */
function formatName(str: string): string {
  return str
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validity = budget.date ? getValidityInfo(budget.date, budget.validity_days || 30) : null;
  const validityLabel = validity
    ? validity.expired
      ? "Orçamento expirado"
      : `Validade: ${formatDate(validity.expiresAt)}`
    : null;

  const cfg: HeaderConfig = (budget.header_config as HeaderConfig) || {};

  // Unified meta line: condomínio · bairro · metragem · versão · data
  const condominio = budget.condominio || "";
  const neighborhood = budget.bairro || "";
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, '').replace(/m²?$/i, '') : "";
  const area = rawArea ? `${rawArea}m²` : "";
  const versionNum = budget.versao ? budget.versao.replace(/^v/i, '') : (budget.version_number ?? "1");
  const version = String(versionNum);
  const dateStr = budget.date ? formatDate(budget.date) : "";

  const statBadges = [
    { value: "5 anos", label: "garantia", accent: false },
  ];

  const clientName = budget.client_name ? formatName(sanitizeClientName(budget.client_name)) : "";

  const projectTitle = budget.project_name || "Projeto e Reforma";
  const heroTitle = clientName || projectTitle;
  const showPersonalizedSubtitle = !cfg.hide_subtitle && (!budget.project_name || budget.project_name === "Projeto e Reforma");

  const tagline = cfg.custom_tagline || "Projeto personalizado · Gestão completa · Execução com garantia";
  const subtitleText = cfg.custom_subtitle || `Orçamento personalizado para ${clientName}`;

  return (
    <header className="relative">
      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${headerBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/25 to-black/60" />
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
          <div className="flex items-center gap-2 sm:gap-3">
            {/* ReclameAqui seal — hidden on mobile, shown via TrustStrip instead */}
            <div className="hidden lg:block">
              <ReclameAquiSeal />
            </div>
            {!cfg.hide_consultora && budget.consultora_comercial && (
              <span className="hidden lg:inline text-xs text-white/90 font-body">
                {budget.consultora_comercial}, sua consultora
              </span>
            )}
            {!cfg.hide_consultora && budget.consultora_comercial && (
              <span className="hidden lg:block w-px h-4 bg-white/30" />
            )}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 backdrop-blur-md transition-all text-xs font-body font-medium disabled:opacity-50 border border-white/15"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{exporting ? "Gerando..." : "PDF"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ─── Company info strip — desktop only ─── */}
        <motion.div
          variants={fadeUp} custom={0} initial="hidden" animate="visible"
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-3 hidden lg:block"
        >
          <div className="py-2 border-b border-white/[0.12]">
            <p className="text-xs font-body text-white/70 leading-relaxed">
              Bwild Reformas LTDA · CNPJ: 47.350.338/0001-37 · Responsável Técnico: Thiago Dantas do Amor · CAU: A162437-7
            </p>
          </div>
        </motion.div>

        {/* ─── FAIXA 2 — Conteúdo principal ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE (<lg) — compact, decision-oriented ── */}
          <div className="lg:hidden py-4 space-y-1.5">
            <motion.h1
              variants={fadeUp} custom={0.3} initial="hidden" animate="visible"
              className="font-display font-bold text-xl text-white leading-tight tracking-tight"
            >
              {heroTitle}
            </motion.h1>

            <motion.div
              variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
              className="flex items-center gap-1.5 text-xs font-body flex-wrap"
            >
              {condominio && (
                <>
                  <span className="text-white/95 font-medium">{condominio}</span>
                  {(neighborhood || area || version) && <span className="text-white/50">·</span>}
                </>
              )}
              {neighborhood && (
                <>
                  <span className="text-white/95 font-medium">{neighborhood}</span>
                  {(area || version) && <span className="text-white/50">·</span>}
                </>
              )}
              {area && (
                <>
                  <span className="text-white/95 font-medium">{area}</span>
                  {version && <span className="text-white/40">·</span>}
                </>
              )}
              {version && (
                <span className="text-white/95 font-medium">v{version}</span>
              )}
              {budget.prazo_dias_uteis && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="text-white/95 font-medium">{budget.prazo_dias_uteis} dias úteis</span>
                </>
              )}
            </motion.div>

            {/* Company info — mobile */}
            <motion.p
              variants={fadeUp} custom={0.7} initial="hidden" animate="visible"
              className="text-[10px] font-body text-white/50 leading-relaxed pt-1"
            >
              Bwild Reformas LTDA · CNPJ 47.350.338/0001-37
              <br />
              RT: Thiago Dantas do Amor · CAU A162437-7
            </motion.p>
          </div>

          {/* ── DESKTOP (lg+) ── */}
          <div className="hidden lg:flex items-start justify-between py-6">
            {/* Left — Client name + meta */}
            <div className="flex-1 min-w-0 space-y-2.5">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="space-y-2"
              >
                <h1 className="font-display font-bold text-3xl text-white leading-tight tracking-tight">
                  {heroTitle}
                </h1>

                {/* Labeled meta chips */}
                <div className="flex items-center gap-2 text-sm font-body flex-wrap">
                  {condominio && (
                    <>
                      <span className="text-white/70 text-xs">Condomínio</span>
                      <span className="text-white/95 font-medium">{condominio}</span>
                      {(neighborhood || area || version || dateStr) && <span className="text-white/40">·</span>}
                    </>
                  )}
                  {neighborhood && (
                    <>
                      <span className="text-white/70 text-xs">Bairro</span>
                      <span className="text-white/95 font-medium">{neighborhood}</span>
                      {(area || version || dateStr) && <span className="text-white/40">·</span>}
                    </>
                  )}
                  {area && (
                    <>
                      <span className="text-white/70 text-xs">Área</span>
                      <span className="text-white/95 font-medium">{area}</span>
                      {(version || dateStr) && <span className="text-white/40">·</span>}
                    </>
                  )}
                  {version && (
                    <>
                      <span className="text-white/70 text-xs">Versão</span>
                      <span className="text-white/95 font-medium">{version}</span>
                      {dateStr && <span className="text-white/40">·</span>}
                    </>
                  )}
                  {dateStr && (
                    <>
                      <span className="text-white/70 text-xs">Elaboração</span>
                      <span className="text-white/95 font-medium">{dateStr}</span>
                    </>
                  )}
                </div>
              </motion.div>

              {!cfg.hide_tagline && (
                <motion.p
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="text-xs text-white/80 font-body"
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

      </div>
    </header>
  );
}
