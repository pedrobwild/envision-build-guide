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

/** Hairline separator */
function Sep() {
  return <span className="text-white/20 select-none mx-2" aria-hidden>·</span>;
}

/** Formats a date string/Date into 'Abril de 2026' (pt-BR) */
function formatMonthYear(value?: string | Date | null): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\p{L}/u, (l) => l.toLocaleUpperCase("pt-BR"));
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
  const dateLabel = formatMonthYear(budget.date);

  const clientName = budget.client_name ? formatName(sanitizeClientName(budget.client_name)) : "";
  const projectTitle = budget.project_name || "Projeto e Reforma";
  const heroTitle = clientName || projectTitle;
  const showProjectSubtitle = !!(clientName && projectTitle && !projectTitle.toLowerCase().includes(clientName.toLowerCase()));

  const tagline = cfg.custom_tagline || "Projeto personalizado · Gestão completa · Execução com garantia";

  /** Eyebrow tokens: PROPOSTA · v2 · Abril de 2026 */
  const eyebrow: { value: string; mono?: boolean }[] = [{ value: "Proposta" }];
  if (versionStr) eyebrow.push({ value: `v${versionStr}`, mono: true });
  if (dateLabel) eyebrow.push({ value: dateLabel });

  /** Property meta: 85m² · Jardins · Edifício Aurora */
  const propertyMeta: { value: string; mono?: boolean }[] = [];
  if (area) propertyMeta.push({ value: area, mono: true });
  if (neighborhood) propertyMeta.push({ value: neighborhood });
  if (condominio) propertyMeta.push({ value: condominio });

  /** Timeline meta — shown in a distinct row below */
  const timelineMeta: { label: string; value: string; mono?: boolean }[] = [];
  if (budget.prazo_dias_uteis) timelineMeta.push({ label: "Execução", value: `${budget.prazo_dias_uteis} dias úteis`, mono: true });

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
              className="budget-focus-on-dark flex items-center gap-1.5 px-3 py-1.5 sm:py-2 rounded-lg bg-white/12 text-white hover:bg-white/20 backdrop-blur-md text-xs font-body font-medium disabled:opacity-50 border border-white/10 tracking-[-0.01em]"
              data-pdf-hide
            >
              {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{exporting ? "Gerando..." : "PDF"}</span>
            </motion.button>
          </div>
        </motion.div>

        {/* ─── Main content ─── */}
        <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8">

          {/* ── MOBILE ── */}
          <div className="lg:hidden pt-6 pb-7 space-y-4">
            {/* Eyebrow */}
            <motion.div
              variants={fadeUp} custom={0.25} initial="hidden" animate="visible"
              className="flex items-center flex-wrap"
            >
              {eyebrow.map((e, i) => (
                <span key={i} className="inline-flex items-center">
                  {i > 0 && <Sep />}
                  <span className={`budget-label text-[10px] text-white/55 ${e.mono ? `${MONO} normal-case tracking-[0.04em]` : ""}`}>
                    {e.value}
                  </span>
                </span>
              ))}
            </motion.div>

            {/* Title + project subtitle */}
            <motion.div
              variants={fadeUp} custom={0.35} initial="hidden" animate="visible"
              className="space-y-1.5"
            >
              <h1 className="budget-heading font-extrabold text-[clamp(22px,6.5vw,30px)] text-white leading-[1.08] tracking-[-0.035em] break-words">
                {heroTitle}
              </h1>
              {showProjectSubtitle && (
                <p className="text-[13px] font-body text-white/65 font-medium tracking-[-0.005em] break-words">
                  {projectTitle}
                </p>
              )}
            </motion.div>

            {/* Property meta — inline editorial */}
            {propertyMeta.length > 0 && (
              <motion.div
                variants={fadeUp} custom={0.45} initial="hidden" animate="visible"
                className="flex items-center flex-wrap text-[12.5px] font-body"
              >
                {propertyMeta.map((m, i) => (
                  <span key={i} className="inline-flex items-center">
                    {i > 0 && <Sep />}
                    <span className={`text-white/80 font-medium ${m.mono ? MONO : "tracking-[-0.005em]"}`}>
                      {m.value}
                    </span>
                  </span>
                ))}
              </motion.div>
            )}

            {/* Tagline — promoted with top divider */}
            {!cfg.hide_tagline && (
              <motion.div
                variants={fadeUp} custom={0.55} initial="hidden" animate="visible"
                className="pt-4 border-t border-white/[0.08]"
              >
                <p className="text-[12.5px] text-white/60 font-body tracking-[-0.005em] leading-relaxed">
                  {tagline}
                </p>
                {timelineMeta.length > 0 && (
                  <div className="mt-2 flex items-center flex-wrap">
                    {timelineMeta.map((m, i) => (
                      <span key={i} className="inline-flex items-center">
                        {i > 0 && <Sep />}
                        <span className={`${LABEL_MICRO} text-white/45 mr-1.5`}>{m.label}</span>
                        <span className={`text-[12px] text-white/85 font-medium ${m.mono ? MONO : ""}`}>
                          {m.value}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* ── DESKTOP ── */}
          <div className="hidden lg:flex items-start justify-between py-12">
            <div className="flex-1 min-w-0 space-y-5">
              {/* Eyebrow */}
              <motion.div
                variants={fadeUp} custom={0} initial="hidden" animate="visible"
                className="flex items-center"
              >
                {eyebrow.map((e, i) => (
                  <span key={i} className="inline-flex items-center shrink-0">
                    {i > 0 && <Sep />}
                    <span className={`budget-label text-[10.5px] text-white/55 ${e.mono ? `${MONO} normal-case tracking-[0.04em]` : ""}`}>
                      {e.value}
                    </span>
                  </span>
                ))}
              </motion.div>

              {/* Title + project subtitle */}
              <motion.div
                variants={fadeUp} custom={0.5} initial="hidden" animate="visible"
                className="space-y-2"
              >
                <h1 className="budget-heading font-extrabold text-[2.5rem] xl:text-[2.75rem] text-white leading-[1.02] tracking-[-0.035em] whitespace-nowrap overflow-hidden text-ellipsis">
                  {heroTitle}
                </h1>
                {showProjectSubtitle && (
                  <p className="text-[15px] font-body text-white/65 font-medium tracking-[-0.005em]">
                    {projectTitle}
                  </p>
                )}
              </motion.div>

              {/* Property meta — editorial row */}
              {propertyMeta.length > 0 && (
                <motion.div
                  variants={fadeUp} custom={1} initial="hidden" animate="visible"
                  className="flex items-center flex-wrap text-[14px] font-body"
                >
                  {propertyMeta.map((m, i) => (
                    <span key={i} className="inline-flex items-center shrink-0">
                      {i > 0 && <Sep />}
                      <span className={`text-white/85 font-medium ${m.mono ? MONO : "tracking-[-0.005em]"}`}>
                        {m.value}
                      </span>
                    </span>
                  ))}
                </motion.div>
              )}

              {/* Tagline + timeline — promoted with divider */}
              {(!cfg.hide_tagline || timelineMeta.length > 0) && (
                <motion.div
                  variants={fadeUp} custom={1.5} initial="hidden" animate="visible"
                  className="pt-5 border-t border-white/[0.08] max-w-xl space-y-2.5"
                >
                  {!cfg.hide_tagline && (
                    <p className="text-[13.5px] text-white/65 font-body tracking-[-0.005em] leading-relaxed">
                      {tagline}
                    </p>
                  )}
                  {timelineMeta.length > 0 && (
                    <div className="flex items-center flex-wrap">
                      {timelineMeta.map((m, i) => (
                        <span key={i} className="inline-flex items-center shrink-0">
                          {i > 0 && <Sep />}
                          <span className={`${LABEL_MICRO} text-white/45 mr-2`}>{m.label}</span>
                          <span className={`text-[13px] text-white/90 font-medium ${m.mono ? MONO : ""}`}>
                            {m.value}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
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

        {/* ─── Corporate strip — footer ─── */}
        <motion.div
          variants={fadeUp} custom={2} initial="hidden" animate="visible"
          className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8"
        >
          <div className="border-t border-white/[0.06] py-2.5 lg:py-3">
            <p className={`${LABEL_MICRO} text-white/35 leading-relaxed text-[9.5px] lg:text-[10px] whitespace-nowrap overflow-hidden text-ellipsis`}>
              Bwild Reformas LTDA <Sep /> CNPJ <span className={MONO}>47.350.338/0001-37</span> <Sep /> <span className="hidden sm:inline">Responsável Técnico: Thiago Dantas do Amor <Sep /></span> CAU <span className={MONO}>A162437-7</span>
            </p>
          </div>
        </motion.div>
      </div>
    </header>
  );
}