import { Download, Loader2 } from "lucide-react";
import { TestimonialVideoPreview } from "./TestimonialVideoModal";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";
import { ReclameAquiSeal } from "./ReclameAquiSeal";
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

import type { BudgetData } from "@/types/budget";

interface BudgetHeaderProps {
  budget: BudgetData;
  onExportPdf?: () => void;
  exporting?: boolean;
}

/** Shared typography tokens */
const MONO = "font-mono tabular-nums";
const LABEL_MICRO = "text-[10px] uppercase tracking-[0.08em] font-body font-semibold";

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

function formatName(str: string): string {
  return str
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());
}

/** Dot separator for meta chips */
function Dot() {
  return <span className="text-white/40 select-none" aria-hidden>·</span>;
}

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validity = budget.date ? getValidityInfo(budget.date, budget.validity_days || 30) : null;
  const cfg: HeaderConfig = (budget.header_config as HeaderConfig) || {};

  const condominio = budget.condominio || "";
  const neighborhood = budget.bairro || "";
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, '').replace(/m²?$/i, '') : "";
  const area = rawArea ? `${rawArea}m²` : "";
  const versionNum = budget.versao ? budget.versao.replace(/^v/i, '') : (budget.version_number ?? "1");
  const version = String(versionNum);
  const dateStr = budget.date ? formatDate(budget.date) : "";

  const clientName = budget.client_name ? formatName(sanitizeClientName(budget.client_name)) : "";
  const projectTitle = budget.project_name || "Projeto e Reforma";
  const heroTitle = clientName || projectTitle;

  const tagline = cfg.custom_tagline || "Projeto personalizado · Gestão completa · Execução com garantia";

  /** Build meta chips array for DRY rendering */
  const metaChips: { label: string; value: string; mono?: boolean }[] = [];
  if (condominio) metaChips.push({ label: "Condomínio", value: condominio });
  if (neighborhood) metaChips.push({ label: "Bairro", value: neighborhood });
  if (area) metaChips.push({ label: "Área", value: area, mono: true });
  if (version) metaChips.push({ label: "Versão", value: `v${version}`, mono: true });
  if (dateStr) metaChips.push({ label: "Elaboração", value: dateStr, mono: true });
  if (budget.prazo_dias_uteis) metaChips.push({ label: "Prazo", value: `${budget.prazo_dias_uteis} dias úteis`, mono: true });

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

        {/* ─── Nav bar ─── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-4 sm:pt-5 flex items-center justify-between"
        >
          <img src={logoWhite} alt="Bwild" className="h-10 sm:h-12 lg:h-11" />
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:block">
              <ReclameAquiSeal />
            </div>
            {/* Consultora info hidden on public view */}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/15 text-white hover:bg-white/25 backdrop-blur-md transition-all text-xs font-body font-medium disabled:opacity-50 border border-white/15 tracking-[-0.01em]"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{exporting ? "Gerando..." : "PDF"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ─── Company info strip — desktop ─── */}
        <motion.div
          variants={fadeUp} custom={0} initial="hidden" animate="visible"
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-3 hidden lg:block"
        >
          <div className="py-2 border-b border-white/[0.12]">
            <p className={`${LABEL_MICRO} text-white/60 leading-relaxed`}>
              Bwild Reformas LTDA <Dot /> CNPJ <span className={MONO}>47.350.338/0001-37</span> <Dot /> Responsável Técnico: Thiago Dantas do Amor <Dot /> CAU <span className={MONO}>A162437-7</span>
            </p>
          </div>
        </motion.div>

        {/* ─── Main content ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE ── */}
          <div className="lg:hidden py-4 space-y-1.5">
            <motion.h1
              variants={fadeUp} custom={0.3} initial="hidden" animate="visible"
              className="font-display font-bold text-xl text-white leading-[1.15] tracking-tight"
            >
              {heroTitle}
            </motion.h1>

            <motion.div
              variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
              className="flex items-center gap-1.5 text-xs font-body flex-wrap"
            >
              {metaChips.map((chip, i) => (
                <span key={chip.label} className="contents">
                  {i > 0 && <Dot />}
                  <span className={`text-white font-medium ${chip.mono ? MONO : "tracking-[-0.01em]"}`}>
                    {chip.value}
                  </span>
                </span>
              ))}
            </motion.div>

            {/* Company info — mobile */}
            <motion.p
              variants={fadeUp} custom={0.7} initial="hidden" animate="visible"
              className={`${LABEL_MICRO} text-white/50 leading-relaxed pt-1`}
            >
              Bwild Reformas LTDA <Dot /> CNPJ <span className={MONO}>47.350.338/0001-37</span>
              <br />
              RT: Thiago Dantas do Amor <Dot /> CAU <span className={MONO}>A162437-7</span>
            </motion.p>
          </div>

          {/* ── DESKTOP ── */}
          <div className="hidden lg:flex items-start justify-between py-6">
            <div className="flex-1 min-w-0 space-y-2.5">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="space-y-2"
              >
                <h1 className="font-display font-bold text-3xl text-white leading-[1.15] tracking-tight">
                  {heroTitle}
                </h1>

                {/* Labeled meta chips */}
                <div className="flex items-center gap-2 text-sm font-body flex-wrap">
                  {metaChips.map((chip, i) => (
                    <span key={chip.label} className="contents">
                      {i > 0 && <Dot />}
                      <span className={`${LABEL_MICRO} text-white/70`}>{chip.label}</span>
                      <span className={`text-white font-medium ${chip.mono ? MONO : "tracking-[-0.01em]"}`}>
                        {chip.value}
                      </span>
                    </span>
                  ))}
                </div>
              </motion.div>

              {!cfg.hide_tagline && (
                <motion.p
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="text-xs text-white/80 font-body tracking-[-0.01em]"
                >
                  {tagline}
                </motion.p>
              )}
            </div>

            {/* Right — Video testimonial */}
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
