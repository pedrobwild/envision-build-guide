import { Download, Loader2 } from "lucide-react";
import { TestimonialVideoPreview } from "./TestimonialVideoModal";
import { motion } from "framer-motion";
import logoWhite from "@/assets/logo-bwild-white.png";
import headerBg from "@/assets/header-bg.png";

import { getValidityInfo } from "@/lib/formatBRL";

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
const MONO = "budget-numeric";
const LABEL_MICRO = "budget-label text-[10px]";

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

/** Dot separator */
function Dot() {
  return <span className="text-white/30 select-none mx-0.5" aria-hidden>·</span>;
}

export function BudgetHeader({ budget, onExportPdf, exporting }: BudgetHeaderProps) {
  const validity = budget.date ? getValidityInfo(budget.date, budget.validity_days || 30) : null;
  const cfg: HeaderConfig = (budget.header_config as HeaderConfig) || {};

  const condominio = budget.condominio || "";
  const neighborhood = budget.bairro || "";
  const rawArea = budget.metragem ? budget.metragem.toString().replace(/\s/g, '').replace(/m²?$/i, '') : "";
  const area = rawArea ? `${rawArea}m²` : "";
  const versionNum = budget.versao ? budget.versao.replace(/^v/i, '') : (budget.version_number ?? "1");
  const versionStr = String(versionNum);

  const clientName = budget.client_name ? formatName(sanitizeClientName(budget.client_name)) : "";
  const projectTitle = budget.project_name || "Projeto e Reforma";
  const heroTitle = clientName || projectTitle;

  const tagline = cfg.custom_tagline || "Projeto personalizado · Gestão completa · Execução com garantia";

  /** Build meta chips array */
  const metaChips: { label: string; value: string; mono?: boolean }[] = [];
  if (condominio) metaChips.push({ label: "Condomínio", value: condominio });
  if (neighborhood) metaChips.push({ label: "Bairro", value: neighborhood });
  if (area) metaChips.push({ label: "Área", value: area, mono: true });
  if (versionStr) metaChips.push({ label: "Versão", value: `v${versionStr}`, mono: true });
  if (budget.prazo_dias_uteis) metaChips.push({ label: "Prazo", value: `${budget.prazo_dias_uteis} dias úteis`, mono: true });

  return (
    <header className="relative">
      <div className="relative overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${headerBg})` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70 lg:from-black/50 lg:via-black/30 lg:to-black/65" />
        <div
          className="absolute inset-0 hidden lg:block opacity-[0.012] pointer-events-none"
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
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onExportPdf}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/12 text-white hover:bg-white/20 backdrop-blur-md transition-all text-xs font-body font-medium disabled:opacity-50 border border-white/10 tracking-[-0.01em]"
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
          <div className="py-2 border-b border-white/[0.08]">
            <p className={`${LABEL_MICRO} text-white/45 leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis`}>
              Bwild Reformas LTDA <Dot /> CNPJ <span className={MONO}>47.350.338/0001-37</span> <Dot /> Responsável Técnico: Thiago Dantas do Amor <Dot /> CAU <span className={MONO}>A162437-7</span>
            </p>
          </div>
        </motion.div>

        {/* ─── Main content ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE ── */}
          <div className="lg:hidden pt-4 pb-6 space-y-2.5">
            <motion.div
              variants={fadeUp} custom={0.3} initial="hidden" animate="visible"
              className="space-y-1"
            >
              <h1 className="budget-heading font-extrabold text-[clamp(18px,5.5vw,24px)] text-white leading-[1.15] tracking-[-0.03em] break-words">
                {heroTitle}
              </h1>
              {clientName && projectTitle && !projectTitle.toLowerCase().includes(clientName.toLowerCase()) && (
                <p className="text-[13px] font-body text-white/55 font-medium tracking-[-0.01em] break-words">
                  {projectTitle}
                </p>
              )}
            </motion.div>

            {!cfg.hide_tagline && (
              <motion.p
                variants={fadeUp} custom={0.4} initial="hidden" animate="visible"
                className="text-[12px] text-white/50 font-body tracking-[-0.01em] font-medium leading-snug"
              >
                {tagline}
              </motion.p>
            )}

            {metaChips.length > 0 && (
              <motion.div
                variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
                className="flex flex-wrap gap-1.5"
              >
                {metaChips.map((chip) => (
                  <span
                    key={chip.label}
                    className="inline-flex items-center gap-1 rounded-md bg-white/10 backdrop-blur-sm px-2 py-0.5 text-[11px]"
                  >
                    <span className="text-white/50 font-body font-medium uppercase tracking-[0.04em]">{chip.label}</span>
                    <span className={`text-white/90 font-semibold ${chip.mono ? MONO : "font-body tracking-[-0.01em]"}`}>
                      {chip.value}
                    </span>
                  </span>
                ))}
              </motion.div>
            )}
          </div>

          {/* ── DESKTOP ── */}
          <div className="hidden lg:flex items-start justify-between py-8">
            <div className="flex-1 min-w-0 space-y-3">
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="space-y-2.5"
              >
                <h1 className="budget-heading font-extrabold text-[2.25rem] text-white leading-[1.08] tracking-[-0.03em] whitespace-nowrap overflow-hidden text-ellipsis">
                  {heroTitle}
                </h1>

                {/* Meta chips — single line */}
                <div className="flex items-center gap-0 text-sm font-body whitespace-nowrap overflow-hidden">
                  {metaChips.map((chip, i) => (
                    <span key={chip.label} className="inline-flex items-center shrink-0">
                      {i > 0 && <Dot />}
                      <span className={`${LABEL_MICRO} text-white/50 mr-1`}>{chip.label}</span>
                      <span className={`text-white/95 font-medium ${chip.mono ? MONO : "tracking-[-0.01em]"}`}>
                        {chip.value}
                      </span>
                    </span>
                  ))}
                </div>
              </motion.div>

              {!cfg.hide_tagline && (
                <motion.p
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="text-[13px] text-white/60 font-body tracking-[-0.01em] font-medium"
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