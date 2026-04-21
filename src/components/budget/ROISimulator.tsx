import { useMemo, useState, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  MapPin,
  Sparkles,
  Info,
  CalendarCheck2,
  ChevronDown,
  Maximize2,
  Home,
  ExternalLink,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import {
  AVERAGE_METRICS,
  findDistrict,
  formatPct,
  getAppreciationPctYear,
  type DistrictRow,
} from "@/data/districtMetrics";

const ROISimulatorModal = lazy(() =>
  import("./ROISimulatorModal").then((m) => ({ default: m.ROISimulatorModal })),
);

interface ROISimulatorProps {
  total: number;
  bairro?: string | null;
  metragem?: string | null;
  operatingCostPct?: number;
  compact?: boolean;
  className?: string;
}

const DAYS_PER_MONTH = 30;
// Custos operacionais reais Airbnb SP (% sobre receita bruta):
// Comissão Airbnb 15% + Gestão/co-host 18% + Limpeza/lavanderia 7%
// + Condomínio/IPTU/utilities 8% + Manutenção/reservas 2% ≈ 50%
const DEFAULT_OPERATING_COST = 0.5;
const OPERATING_COST_BREAKDOWN = [
  { label: "Comissão Airbnb", pct: 15 },
  { label: "Gestão / co-host", pct: 18 },
  { label: "Limpeza e lavanderia", pct: 7 },
  { label: "Condomínio, IPTU e utilities", pct: 8 },
  { label: "Manutenção e reservas", pct: 2 },
];
const DEFAULT_STUDIO_PRICE = 375_000; // média R$ 350–400k para studio em SP
const STUDIO_PRICE_MIN = 250_000;
const STUDIO_PRICE_MAX = 600_000;
// Efeito BWild — projetos personalizados com design e mobília premium
// Benchmarks: AirDNA "Top 10%" vs mediana → +20-30% ADR, +10-15pp ocupação
const BWILD_NIGHTLY_UPLIFT = 0.28; // +28% na diária
const BWILD_OCCUPANCY_UPLIFT = 12; // +12 pontos percentuais

export function ROISimulator({
  total,
  bairro,
  metragem,
  operatingCostPct = DEFAULT_OPERATING_COST,
  compact = false,
  className,
}: ROISimulatorProps) {
  const district: DistrictRow | null = useMemo(() => findDistrict(bairro), [bairro]);

  const baseline = useMemo(() => {
    if (district) {
      return {
        nightly: district.nightlyRateBRL,
        occupancy: district.occupancyPercent,
        label: district.districtName,
        isFallback: false,
      };
    }
    return {
      nightly: AVERAGE_METRICS.nightlyRateBRL,
      occupancy: AVERAGE_METRICS.occupancyPercent,
      label: "Média São Paulo",
      isFallback: true,
    };
  }, [district]);

  const [nightly, setNightly] = useState<number>(baseline.nightly);
  const [occupancy, setOccupancy] = useState<number>(baseline.occupancy);
  const [studioPrice, setStudioPrice] = useState<number>(DEFAULT_STUDIO_PRICE);
  const [showDetails, setShowDetails] = useState<boolean>(!compact);
  const [modalOpen, setModalOpen] = useState(false);

  const sliderLimits = useMemo(() => {
    const minNightly = Math.max(150, Math.round(baseline.nightly * 0.6));
    const maxNightly = Math.round(baseline.nightly * 1.5);
    return {
      nightlyMin: minNightly,
      nightlyMax: maxNightly,
    };
  }, [baseline.nightly]);

  // ── Cálculos ──
  // Cenário SEM reforma — studio padrão do mercado
  const baselineGrossMonth = baseline.nightly * DAYS_PER_MONTH * (baseline.occupancy / 100);
  const baselineNetMonth = baselineGrossMonth * (1 - operatingCostPct);
  const baselineNetYear = baselineNetMonth * 12;

  // Cenário COM reforma BWild
  const grossMonth = nightly * DAYS_PER_MONTH * (occupancy / 100);
  const netMonth = grossMonth * (1 - operatingCostPct);
  const netYear = netMonth * 12;

  // Ganho incremental gerado pela reforma
  const upliftMonth = netMonth - baselineNetMonth;
  const upliftYear = netYear - baselineNetYear;

  const safeTotal = total > 0 ? total : 0;
  const totalInvestment = studioPrice + safeTotal;
  const appreciationPctYear = getAppreciationPctYear(district);
  const appreciationYear = studioPrice * (appreciationPctYear / 100);
  const roiYearPct = totalInvestment > 0 ? (netYear / totalInvestment) * 100 : 0;
  const roiTotalPct =
    totalInvestment > 0 ? ((netYear + appreciationYear) / totalInvestment) * 100 : 0;
  // Payback da REFORMA — em quanto tempo o ganho extra paga a obra
  const reformPaybackMonths = upliftMonth > 0 ? safeTotal / upliftMonth : null;
  const paybackMonths =
    totalInvestment > 0 && netMonth > 0 ? totalInvestment / netMonth : null;

  const formatPayback = (months: number | null) => {
    if (months === null) return "—";
    if (months < 12) return `${Math.round(months)} meses`;
    return `${(months / 12).toFixed(1).replace(".", ",")} anos`;
  };
  const paybackLabel = formatPayback(paybackMonths);
  const reformPaybackLabel = formatPayback(reformPaybackMonths);

  // Defaults BWild = baseline + uplift de mercado premium
  const bwildNightlyDefault = useMemo(
    () => Math.round(baseline.nightly * (1 + BWILD_NIGHTLY_UPLIFT)),
    [baseline.nightly],
  );
  const bwildOccupancyDefault = useMemo(
    () => Math.min(95, baseline.occupancy + BWILD_OCCUPANCY_UPLIFT),
    [baseline.occupancy],
  );

  // Aplica os defaults BWild na primeira montagem (uma vez por baseline)
  const [bwildApplied, setBwildApplied] = useState(false);
  if (!bwildApplied) {
    setNightly(bwildNightlyDefault);
    setOccupancy(bwildOccupancyDefault);
    setBwildApplied(true);
  }

  const isEdited =
    nightly !== bwildNightlyDefault ||
    occupancy !== bwildOccupancyDefault ||
    studioPrice !== DEFAULT_STUDIO_PRICE;

  const handleReset = () => {
    setNightly(bwildNightlyDefault);
    setOccupancy(bwildOccupancyDefault);
    setStudioPrice(DEFAULT_STUDIO_PRICE);
  };

  const upliftPctNightly = Math.round(BWILD_NIGHTLY_UPLIFT * 100);

  const competitionColor =
    district?.competition === "Alta"
      ? "bg-warning/15 text-warning border-warning/30"
      : district?.competition === "Média"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-success/15 text-success border-success/30";

  // Percentual de uplift formatado
  const upliftPct = baselineNetMonth > 0
    ? Math.round((upliftMonth / baselineNetMonth) * 100)
    : 0;

  return (
    <div
      data-pdf-section
      className={cn(
        "rounded-2xl border border-border bg-card overflow-hidden",
        className,
      )}
    >
      {/* ─── Header premium com gradient ─── */}
      <div className="relative bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent border-b border-border px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4.5 w-4.5 text-primary" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h4 className="font-display font-bold text-base text-foreground leading-tight">
                Simulador de retorno
              </h4>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                Veja o impacto do design BWild no seu investimento
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary hover:bg-primary hover:text-primary-foreground border border-primary/30 px-2.5 py-1.5 rounded-lg transition-all flex-shrink-0"
            aria-label="Abrir simulação completa"
          >
            <Maximize2 className="h-3 w-3" />
            Expandir
          </button>
        </div>

        {/* Bairro chip */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border px-2.5 py-1">
            <MapPin className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="text-[11px] font-display font-bold text-foreground">
              {baseline.label}
            </span>
            {baseline.isFallback && (
              <span className="text-[9px] font-mono uppercase text-muted-foreground tracking-wide ml-0.5">
                média
              </span>
            )}
          </div>
          {district?.score ? (
            <Badge variant="secondary" className="font-mono text-[10px] tracking-wider">
              Score {district.score}
            </Badge>
          ) : null}
          {metragem && (
            <span className="text-[10px] text-muted-foreground font-mono ml-auto">
              {metragem}
            </span>
          )}
        </div>
      </div>

      {/* ─── Conteúdo ─── */}
      <div className="p-5 space-y-5">
        {/* HERO — Efeito BWild */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-6 w-6 rounded-md bg-primary flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <h5 className="font-display font-bold text-sm text-foreground tracking-tight">
              O efeito BWild
            </h5>
            <Badge variant="outline" className="ml-auto text-[9px] font-mono uppercase tracking-wider border-primary/30 text-primary bg-primary/5">
              +{upliftPct}% renda
            </Badge>
          </div>

          {/* Comparativo lado a lado — design refinado */}
          <div className="grid grid-cols-2 gap-3">
            {/* Studio padrão */}
            <div className="rounded-xl bg-muted/40 border border-border p-3.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-2 font-semibold">
                Studio padrão
              </p>
              <div className="space-y-1 mb-3">
                <div className="flex items-baseline justify-between text-[11px] font-body">
                  <span className="text-muted-foreground">Diária</span>
                  <span className="text-foreground font-mono tabular-nums">{formatBRL(baseline.nightly)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] font-body">
                  <span className="text-muted-foreground">Ocupação</span>
                  <span className="text-foreground font-mono tabular-nums">{baseline.occupancy}%</span>
                </div>
              </div>
              <div className="pt-2.5 border-t border-border">
                <p className="text-lg font-display font-bold text-foreground/70 tabular-nums leading-none">
                  {formatBRL(baselineNetMonth)}
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-1 uppercase tracking-wider">/mês líquido</p>
              </div>
            </div>

            {/* Com sua reforma — premium */}
            <div className="relative rounded-xl bg-gradient-to-br from-primary to-primary/85 p-3.5 shadow-lg shadow-primary/20">
              <Badge className="absolute -top-2 right-3 text-[9px] font-mono px-2 py-0 h-4 bg-background text-primary border border-primary/40 shadow-sm">
                <Sparkles className="h-2 w-2 mr-0.5" />
                BWild
              </Badge>
              <p className="text-[10px] uppercase tracking-wider text-primary-foreground/85 font-mono mb-2 font-semibold">
                Com sua reforma
              </p>
              <div className="space-y-1 mb-3">
                <div className="flex items-baseline justify-between text-[11px] font-body">
                  <span className="text-primary-foreground/80">Diária</span>
                  <span className="text-primary-foreground font-mono tabular-nums font-semibold">{formatBRL(nightly)}</span>
                </div>
                <div className="flex items-baseline justify-between text-[11px] font-body">
                  <span className="text-primary-foreground/80">Ocupação</span>
                  <span className="text-primary-foreground font-mono tabular-nums font-semibold">{occupancy}%</span>
                </div>
              </div>
              <div className="pt-2.5 border-t border-primary-foreground/20">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={netMonth}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-lg font-display font-bold text-primary-foreground tabular-nums leading-none"
                  >
                    {formatBRL(netMonth)}
                  </motion.p>
                </AnimatePresence>
                <p className="text-[10px] text-primary-foreground/75 font-mono mt-1 uppercase tracking-wider">/mês líquido</p>
              </div>
            </div>
          </div>

          {/* Ganho extra — destaque success */}
          <div className="mt-3 rounded-xl bg-success/[0.08] border border-success/25 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-success font-mono font-bold mb-0.5">
                Ganho extra mensal
              </p>
              <p className="text-[11px] text-muted-foreground font-body leading-snug">
                Reforma paga sozinha em{" "}
                <strong className="text-success font-semibold">{reformPaybackLabel}</strong>
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <AnimatePresence mode="wait">
                <motion.p
                  key={upliftMonth}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="font-display font-bold text-xl text-success leading-none tabular-nums"
                >
                  +{formatBRL(upliftMonth)}
                </motion.p>
              </AnimatePresence>
              <p className="text-[10px] text-muted-foreground font-mono mt-1.5 tabular-nums">
                {formatBRL(upliftYear)}/ano
              </p>
            </div>
          </div>
        </div>

        {/* ─── KPIs principais ─── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-success/30 bg-gradient-to-br from-success/[0.08] to-transparent p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] uppercase tracking-wider text-success font-mono font-bold">
                ROI total
              </p>
              <Badge variant="outline" className="text-[9px] font-mono border-success/30 text-success bg-background/60 px-1.5 py-0 h-4">
                +{formatPct(appreciationPctYear)} a.a.
              </Badge>
            </div>
            <p
              className="font-display font-bold text-2xl text-success leading-none"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatPct(roiTotalPct)}
            </p>
            <p className="text-[10px] text-muted-foreground font-body mt-1.5">
              renda + valorização
            </p>
          </div>
          <div className="rounded-xl border border-border bg-muted/30 p-3.5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono font-bold mb-1.5">
              Payback total
            </p>
            <p
              className="font-display font-bold text-2xl text-foreground leading-none"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {paybackLabel}
            </p>
            <p className="text-[10px] text-muted-foreground font-body mt-1.5">
              studio + reforma
            </p>
          </div>
        </div>

        {/* ─── Receita líquida — linha resumo ─── */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-primary/[0.04] border border-primary/15 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono mb-0.5">
              Receita líquida estimada
            </p>
            <div className="flex items-baseline gap-1.5">
              <AnimatePresence mode="wait">
                <motion.p
                  key={netMonth}
                  initial={{ opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-xl font-display font-bold text-foreground tabular-nums leading-none"
                >
                  {formatBRL(netMonth)}
                </motion.p>
              </AnimatePresence>
              <span className="text-xs text-muted-foreground font-body">/mês</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] text-muted-foreground font-mono uppercase tracking-wider hover:text-foreground transition-colors"
                  aria-label="Ver detalhamento dos custos operacionais"
                >
                  −{Math.round(operatingCostPct * 100)}% custos
                  <Info className="h-2.5 w-2.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-3">
                <p className="text-[11px] font-display font-bold uppercase tracking-wider text-foreground mb-2">
                  Custos sobre receita bruta
                </p>
                <ul className="space-y-1.5">
                  {OPERATING_COST_BREAKDOWN.map((c) => (
                    <li key={c.label} className="flex justify-between text-[11px] font-body text-muted-foreground">
                      <span>{c.label}</span>
                      <span className="tabular-nums font-mono text-foreground">{c.pct}%</span>
                    </li>
                  ))}
                  <li className="flex justify-between pt-1.5 mt-1.5 border-t border-border text-[11px] font-display font-bold">
                    <span className="text-foreground">Total</span>
                    <span className="tabular-nums text-foreground">
                      {OPERATING_COST_BREAKDOWN.reduce((s, c) => s + c.pct, 0)}%
                    </span>
                  </li>
                </ul>
                <p className="text-[10px] text-muted-foreground mt-2.5 leading-relaxed">
                  Estimativa média para studios em São Paulo. Pode variar conforme condomínio, ocupação e modelo de gestão.
                </p>
              </PopoverContent>
            </Popover>
            <p className="text-[11px] text-muted-foreground font-body mt-0.5 tabular-nums">
              Bruto {formatBRL(grossMonth)}
            </p>
          </div>
        </div>

        {/* ─── Personalize sua simulação ─── */}
        <div className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h6 className="text-xs font-display font-bold text-foreground uppercase tracking-wider">
              Personalize sua simulação
            </h6>
            {isEdited && (
              <button
                type="button"
                onClick={handleReset}
                className="text-[10px] font-mono uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              >
                ↺ Resetar
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-body text-muted-foreground flex items-center gap-1.5">
                  <Home className="h-3 w-3" />
                  Valor de compra do studio
                </label>
                <span
                  className="font-display font-bold text-sm text-foreground tabular-nums"
                >
                  {formatBRL(studioPrice)}
                </span>
              </div>
              <Slider
                aria-label="Valor de compra do studio"
                value={[studioPrice]}
                min={STUDIO_PRICE_MIN}
                max={STUDIO_PRICE_MAX}
                step={5_000}
                onValueChange={([v]) => setStudioPrice(v)}
              />
              <p className="text-[10px] text-muted-foreground font-body mt-1.5">
                Studios em SP: R$ 350 mil a R$ 400 mil
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-body text-muted-foreground">
                  Diária média
                </label>
                <span
                  className="font-display font-bold text-sm text-foreground tabular-nums"
                >
                  {formatBRL(nightly)}
                </span>
              </div>
              <Slider
                aria-label="Diária média"
                value={[nightly]}
                min={sliderLimits.nightlyMin}
                max={sliderLimits.nightlyMax}
                step={10}
                onValueChange={([v]) => setNightly(v)}
              />
              {district?.adrRangeLabel && (
                <p className="text-[10px] text-muted-foreground font-body mt-1.5">
                  Mercado: {district.adrRangeLabel}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-body text-muted-foreground">
                  Taxa de ocupação
                </label>
                <span
                  className="font-display font-bold text-sm text-foreground tabular-nums"
                >
                  {occupancy}%
                </span>
              </div>
              <Slider
                aria-label="Taxa de ocupação"
                value={[occupancy]}
                min={40}
                max={95}
                step={1}
                onValueChange={([v]) => setOccupancy(v)}
              />
              <p className="text-[10px] text-muted-foreground font-body mt-1.5">
                Mercado padrão: {baseline.occupancy}%
              </p>
            </div>
          </div>
        </div>

        {/* Citação técnica */}
        <p className="text-[10px] text-muted-foreground font-body leading-relaxed text-center px-2">
          Benchmark <strong className="text-foreground">AirDNA "Top 10%"</strong> em SP: design
          premium gera +{upliftPctNightly}% na diária e +{BWILD_OCCUPANCY_UPLIFT}pp na ocupação.
        </p>

        {/* Expand contexto */}
        {district && (
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowDetails((p) => !p)}
              className="flex items-center justify-between w-full text-xs font-body text-muted-foreground hover:text-foreground transition-colors"
              aria-expanded={showDetails}
            >
              <span>Ver contexto do bairro</span>
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", showDetails && "rotate-180")}
              />
            </button>
            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pt-3 space-y-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {district.chips.map((chip) => (
                        <Badge key={chip} variant="outline" className="text-[10px] font-body">
                          {chip}
                        </Badge>
                      ))}
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-body border", competitionColor)}
                      >
                        Competição: {district.competition}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-1.5 text-xs font-body text-muted-foreground">
                      <CalendarCheck2 className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                      <span>
                        Perfil recomendado:{" "}
                        <span className="text-foreground font-medium">
                          {district.recommendation.bestStudioType}
                        </span>
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ─── Footer: fonte + disclaimer + CTA ─── */}
      <div className="bg-muted/30 border-t border-border px-5 py-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
              Fonte
            </span>
            <Badge variant="outline" className="text-[10px] font-mono bg-background">
              {district?.sourceLabel || "Bwild/AirDNA 2025"}
            </Badge>
          </div>
          <a
            href="https://www.airdna.co/vacation-rental-data/app/br/sao-paulo/sao-paulo/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors"
          >
            Ver fonte
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
        <div className="flex items-start gap-1.5">
          <Info className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
            Análise para <strong className="text-foreground">{baseline.label}</strong>. Payback
            considera o investimento total (studio + reforma). Resultado estimado — não constitui
            promessa de retorno.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-body font-semibold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-2.5 rounded-lg transition-colors shadow-sm"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          Abrir simulação completa
        </button>
      </div>

      {modalOpen && (
        <Suspense fallback={null}>
          <ROISimulatorModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            total={total}
            bairro={bairro}
            metragem={metragem}
          />
        </Suspense>
      )}
    </div>
  );
}
