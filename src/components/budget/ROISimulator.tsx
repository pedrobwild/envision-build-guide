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
  const grossMonth = nightly * DAYS_PER_MONTH * (occupancy / 100);
  const netMonth = grossMonth * (1 - operatingCostPct);
  const netYear = netMonth * 12;
  const safeTotal = total > 0 ? total : 0;
  // Investimento total = compra do studio + reforma
  const totalInvestment = studioPrice + safeTotal;
  const roiYearPct = totalInvestment > 0 ? (netYear / totalInvestment) * 100 : 0;
  const roiReformOnlyPct = safeTotal > 0 ? (netYear / safeTotal) * 100 : 0;
  const paybackMonths =
    totalInvestment > 0 && netMonth > 0 ? totalInvestment / netMonth : null;

  const paybackLabel =
    paybackMonths === null
      ? "—"
      : paybackMonths < 12
        ? `${Math.round(paybackMonths)} meses`
        : `${(paybackMonths / 12).toFixed(1).replace(".", ",")} anos`;

  const isEdited =
    nightly !== baseline.nightly ||
    occupancy !== baseline.occupancy ||
    studioPrice !== DEFAULT_STUDIO_PRICE;

  const baselineRoi = useMemo(() => {
    const g = baseline.nightly * DAYS_PER_MONTH * (baseline.occupancy / 100);
    const n = g * (1 - operatingCostPct) * 12;
    const inv = DEFAULT_STUDIO_PRICE + safeTotal;
    return inv > 0 ? (n / inv) * 100 : 0;
  }, [baseline, operatingCostPct, safeTotal]);

  const handleReset = () => {
    setNightly(baseline.nightly);
    setOccupancy(baseline.occupancy);
    setStudioPrice(DEFAULT_STUDIO_PRICE);
  };

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

      {/* Composição do investimento (compra + reforma) */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <Home className="h-3 w-3 text-primary" />
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
            Investimento total considerado no payback
          </p>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md bg-background border border-border p-2">
            <p className="text-[9px] text-muted-foreground font-mono uppercase">Studio</p>
            <p
              className="text-xs font-display font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatBRL(studioPrice)}
            </p>
          </div>
          <div className="rounded-md bg-background border border-border p-2">
            <p className="text-[9px] text-muted-foreground font-mono uppercase">Reforma</p>
            <p
              className="text-xs font-display font-bold text-foreground"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatBRL(safeTotal)}
            </p>
          </div>
          <div className="rounded-md bg-primary/10 border border-primary/25 p-2">
            <p className="text-[9px] text-muted-foreground font-mono uppercase">Total</p>
            <p
              className="text-xs font-display font-bold text-primary"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatBRL(totalInvestment)}
            </p>
          </div>
        </div>
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
          Voltar para a média do bairro (ROI {formatPct(baselineRoi)})
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

      {/* Footer */}
      <div className="border-t border-border pt-3 flex items-start gap-1.5">
        <Info className="h-3 w-3 text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
          Projeção baseada em {district?.sourceLabel || "média de São Paulo"}. Resultado estimado —
          sujeito a sazonalidade, gestão operacional e variação do mercado. Não constitui promessa
          de retorno.
        </p>
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
