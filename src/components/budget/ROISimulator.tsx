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
const DEFAULT_OPERATING_COST = 0.35;
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

  return (
    <div
      data-pdf-section
      className={cn("rounded-lg border border-border bg-card p-5 space-y-4", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
          <h4 className="font-display font-bold text-sm text-foreground truncate">
            Simulador de Retorno
          </h4>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {district?.score ? (
            <Badge variant="secondary" className="font-mono text-[10px] tracking-wide">
              Score {district.score}
            </Badge>
          ) : null}
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wide text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 bg-primary/5 px-2 py-1 rounded-md transition-colors"
            aria-label="Abrir simulação completa"
          >
            <Maximize2 className="h-3 w-3" />
            Completa
          </button>
        </div>
      </div>

      {/* Bairro analisado — destaque */}
      <div className="rounded-lg border border-primary/25 bg-primary/5 p-2.5 flex items-center gap-2 flex-wrap">
        <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
          Análise para
        </span>
        <span className="font-display font-bold text-sm text-foreground truncate">
          {baseline.label}
        </span>
        {baseline.isFallback && (
          <Badge variant="outline" className="text-[9px] font-body bg-background/60">
            média SP
          </Badge>
        )}
        {metragem && (
          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
            {metragem}
          </span>
        )}
      </div>

      {/* KPIs */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`${nightly}-${occupancy}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-2 gap-2"
        >
          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1">
              ROI anual
            </p>
            <p
              className="text-primary font-display font-bold text-xl"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatPct(roiYearPct)}
            </p>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">
              sobre o investimento
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border p-3">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1">
              Payback
            </p>
            <p
              className="text-foreground font-display font-bold text-xl"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {paybackLabel}
            </p>
            <p className="text-[10px] text-muted-foreground font-body mt-0.5">
              tempo estimado
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Efeito BWild — destaque do impacto da reforma personalizada */}
      <div className="rounded-xl border border-primary/40 bg-card p-4 space-y-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-foreground font-mono font-bold leading-tight">
              Efeito BWild
            </p>
            <p className="text-[11px] text-muted-foreground font-body leading-tight mt-0.5">
              o que a reforma personalizada gera a mais
            </p>
          </div>
        </div>

        {/* Comparativo lado a lado */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Studio padrão — visualmente "apagado" */}
          <div className="rounded-lg bg-muted border border-border p-2.5">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1.5 font-semibold">
              Studio padrão
            </p>
            <div className="space-y-0.5 mb-1.5">
              <p className="text-[11px] text-muted-foreground font-body flex justify-between">
                <span>Diária</span>
                <strong className="text-foreground tabular-nums">{formatBRL(baseline.nightly)}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground font-body flex justify-between">
                <span>Ocupação</span>
                <strong className="text-foreground tabular-nums">{baseline.occupancy}%</strong>
              </p>
            </div>
            <div className="pt-1.5 border-t border-border">
              <p className="text-base font-display font-bold text-foreground tabular-nums leading-none">
                {formatBRL(baselineNetMonth)}
              </p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">/mês líquido</p>
            </div>
          </div>

          {/* Com sua reforma — destaque forte */}
          <div className="rounded-lg bg-primary border border-primary p-2.5 relative shadow-md">
            <Badge
              variant="secondary"
              className="absolute -top-2 right-2 text-[9px] font-mono px-1.5 py-0 h-4 bg-background text-foreground border border-primary/30"
            >
              BWild
            </Badge>
            <p className="text-[10px] uppercase tracking-wide text-primary-foreground/80 font-mono mb-1.5 font-semibold">
              Com sua reforma
            </p>
            <div className="space-y-0.5 mb-1.5">
              <p className="text-[11px] text-primary-foreground/90 font-body flex justify-between">
                <span>Diária</span>
                <strong className="text-primary-foreground tabular-nums">{formatBRL(nightly)}</strong>
              </p>
              <p className="text-[11px] text-primary-foreground/90 font-body flex justify-between">
                <span>Ocupação</span>
                <strong className="text-primary-foreground tabular-nums">{occupancy}%</strong>
              </p>
            </div>
            <div className="pt-1.5 border-t border-primary-foreground/20">
              <p className="text-base font-display font-bold text-primary-foreground tabular-nums leading-none">
                {formatBRL(netMonth)}
              </p>
              <p className="text-[10px] text-primary-foreground/80 font-mono mt-0.5">/mês líquido</p>
            </div>
          </div>
        </div>

        {/* Ganho extra — barra de destaque */}
        <div className="rounded-lg bg-success/10 border border-success/30 p-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-success font-mono font-bold">
              Ganho extra com a reforma
            </p>
            <p className="text-[11px] text-foreground font-body leading-tight mt-1">
              Reforma se paga em <strong className="text-success">{reformPaybackLabel}</strong>
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-display font-bold text-xl text-success leading-none tabular-nums">
              +{formatBRL(upliftMonth)}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono mt-1">
              /mês · {formatBRL(upliftYear)}/ano
            </p>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
          Projeção baseada no benchmark AirDNA "Top 10%" de listings premium em SP: design diferenciado,
          mobília sob medida e fotografia profissional geram em média +{upliftPctNightly}% na diária e
          +{BWILD_OCCUPANCY_UPLIFT}pp na ocupação vs. studios padrão.
        </p>
      </div>

      {/* ROI Total — renda + valorização */}
      <div className="rounded-lg border border-success/25 bg-gradient-to-br from-success/10 to-success/5 p-3">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <p className="text-[10px] uppercase tracking-wide text-success font-mono font-semibold">
            ROI total (renda + valorização)
          </p>
          <Badge variant="outline" className="text-[9px] font-mono border-success/30 text-success bg-background/60">
            +{formatPct(appreciationPctYear)} a.a.
          </Badge>
        </div>
        <div className="flex items-baseline gap-2">
          <p
            className="font-display font-bold text-2xl text-success leading-none"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatPct(roiTotalPct)}
          </p>
          <span className="text-[10px] text-muted-foreground font-body">por ano</span>
        </div>
        <p className="text-[10px] text-muted-foreground font-body mt-1.5 leading-relaxed">
          Renda líquida ({formatBRL(netYear)}/ano) + valorização do imóvel ({formatBRL(appreciationYear)}/ano).
          Fonte da valorização: <strong className="text-foreground">FipeZap {baseline.label}</strong>.
        </p>
      </div>

      {/* Receita líquida */}
      <div className="rounded-lg bg-gradient-to-br from-primary/5 to-transparent border border-primary/10 p-3">
        <div className="flex items-center gap-1.5 mb-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
            Receita líquida estimada
          </p>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p
            className="text-2xl font-display font-bold text-foreground"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {formatBRL(netMonth)}
          </p>
          <span className="text-xs text-muted-foreground font-body">/mês</span>
        </div>
        <p className="text-[10px] text-muted-foreground font-body mt-1">
          Bruto {formatBRL(grossMonth)}/mês · {Math.round(operatingCostPct * 100)}% custos operacionais
        </p>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-body text-muted-foreground">
              Valor de compra do studio
            </label>
            <span
              className="font-display font-bold text-sm text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
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
          <p className="text-[10px] text-muted-foreground font-body mt-1">
            Mercado: studios em SP custam em média R$ 350 mil a R$ 400 mil
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-body text-muted-foreground">Diária média</label>
            <span
              className="font-display font-bold text-sm text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
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
            <p className="text-[10px] text-muted-foreground font-body mt-1">
              Mercado: {district.adrRangeLabel}
            </p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-body text-muted-foreground">Ocupação média</label>
            <span
              className="font-display font-bold text-sm text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {occupancy}%
            </span>
          </div>
          <Slider
            aria-label="Ocupação média"
            value={[occupancy]}
            min={40}
            max={95}
            step={1}
            onValueChange={([v]) => setOccupancy(v)}
          />
          <p className="text-[10px] text-muted-foreground font-body mt-1">
            Mercado: {baseline.occupancy}% de ocupação
          </p>
        </div>
      </div>

      {/* Reset */}
      {isEdited && (
        <button
          type="button"
          onClick={handleReset}
          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          Voltar para a projeção BWild padrão
        </button>
      )}

      {/* Expand contexto */}
      {district && (
        <div>
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

      {/* Fonte dos dados — destaque */}
      <div className="border-t border-border pt-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
              Fonte dos dados
            </span>
            <Badge variant="outline" className="text-[10px] font-mono bg-background">
              {district?.sourceLabel || "Bwild/AirDNA 2025 — média SP"}
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
            Análise específica para <strong className="text-foreground">{baseline.label}</strong>.
            Payback considera o investimento total (compra do studio + reforma). Resultado estimado
            — sujeito a sazonalidade, gestão operacional e variação do mercado. Não constitui
            promessa de retorno.
          </p>
        </div>
      </div>

      {/* CTA modal */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-body font-medium text-primary hover:text-primary-foreground bg-primary/5 hover:bg-primary border border-primary/20 hover:border-primary px-3 py-2 rounded-md transition-colors"
      >
        <Maximize2 className="h-3.5 w-3.5" />
        Abrir simulação completa
      </button>

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
