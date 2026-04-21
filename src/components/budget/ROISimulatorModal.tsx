import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  TrendingUp,
  MapPin,
  Sparkles,
  Info,
  CalendarCheck2,
  Lightbulb,
  AlertTriangle,
  Building2,
  Percent,
  Calculator,
  ArrowRight,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import {
  AVERAGE_METRICS,
  findDistrict,
  formatPct,
  type DistrictRow,
} from "@/data/districtMetrics";

interface ROISimulatorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  total: number;
  bairro?: string | null;
  metragem?: string | null;
}

const DAYS_PER_MONTH = 30;
const DEFAULT_OPERATING_COST = 0.35;

export function ROISimulatorModal({
  open,
  onOpenChange,
  total,
  bairro,
  metragem,
}: ROISimulatorModalProps) {
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
  const [operatingCost, setOperatingCost] = useState<number>(DEFAULT_OPERATING_COST * 100);

  const sliderLimits = useMemo(() => {
    return {
      nightlyMin: Math.max(150, Math.round(baseline.nightly * 0.5)),
      nightlyMax: Math.round(baseline.nightly * 1.6),
    };
  }, [baseline.nightly]);

  // ── Cálculos ──
  const opCostPct = operatingCost / 100;
  const grossMonth = nightly * DAYS_PER_MONTH * (occupancy / 100);
  const opCostMonth = grossMonth * opCostPct;
  const netMonth = grossMonth - opCostMonth;
  const netYear = netMonth * 12;
  const grossYear = grossMonth * 12;
  const safeTotal = total > 0 ? total : 0;
  const roiYearPct = safeTotal > 0 ? (netYear / safeTotal) * 100 : 0;
  const paybackMonths = safeTotal > 0 && netMonth > 0 ? safeTotal / netMonth : null;

  const paybackLabel =
    paybackMonths === null
      ? "—"
      : paybackMonths < 12
        ? `${Math.round(paybackMonths)} meses`
        : `${(paybackMonths / 12).toFixed(1).replace(".", ",")} anos`;

  const fiveYearReturn = netYear * 5;
  const tenYearReturn = netYear * 10;

  const isEdited =
    nightly !== baseline.nightly ||
    occupancy !== baseline.occupancy ||
    operatingCost !== DEFAULT_OPERATING_COST * 100;

  const baselineRoi = useMemo(() => {
    const g = baseline.nightly * DAYS_PER_MONTH * (baseline.occupancy / 100);
    const n = g * (1 - DEFAULT_OPERATING_COST) * 12;
    return safeTotal > 0 ? (n / safeTotal) * 100 : 0;
  }, [baseline, safeTotal]);

  const handleReset = () => {
    setNightly(baseline.nightly);
    setOccupancy(baseline.occupancy);
    setOperatingCost(DEFAULT_OPERATING_COST * 100);
  };

  const competitionColor =
    district?.competition === "Alta"
      ? "bg-warning/15 text-warning border-warning/30"
      : district?.competition === "Média"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-success/15 text-success border-success/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 gap-0 overflow-hidden max-h-[92dvh]">
        {/* Header gradiente */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent border-b border-border px-5 sm:px-6 py-5">
          <DialogHeader className="text-left space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <DialogTitle className="font-display font-bold text-lg sm:text-xl">
                  Simulador de Retorno do Investimento
                </DialogTitle>
                <DialogDescription className="text-xs sm:text-sm font-body mt-0.5">
                  Projeção financeira baseada em dados reais de mercado
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <Badge variant="outline" className="text-[10px] font-mono bg-background/60">
                <MapPin className="h-3 w-3 mr-1" />
                {baseline.label}
              </Badge>
              {metragem && (
                <Badge variant="outline" className="text-[10px] font-mono bg-background/60">
                  <Building2 className="h-3 w-3 mr-1" />
                  {metragem}
                </Badge>
              )}
              {district?.score && (
                <Badge variant="secondary" className="text-[10px] font-mono">
                  Score {district.score}/100
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] font-mono bg-background/60">
                <Calculator className="h-3 w-3 mr-1" />
                Investimento {formatBRL(safeTotal)}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {/* KPIs principais */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${nightly}-${occupancy}-${operatingCost}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2.5"
            >
              <KpiTile
                label="ROI anual"
                value={formatPct(roiYearPct)}
                hint="sobre o investimento"
                accent
              />
              <KpiTile
                label="Payback"
                value={paybackLabel}
                hint="tempo estimado"
              />
              <KpiTile
                label="Líquido / mês"
                value={formatBRL(netMonth)}
                hint="receita estimada"
              />
              <KpiTile
                label="Líquido / ano"
                value={formatBRL(netYear)}
                hint="12 meses"
              />
            </motion.div>
          </AnimatePresence>

          <Tabs defaultValue="parametros" className="w-full">
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="parametros" className="text-xs sm:text-sm">
                Parâmetros
              </TabsTrigger>
              <TabsTrigger value="projecao" className="text-xs sm:text-sm">
                Projeção
              </TabsTrigger>
              <TabsTrigger value="bairro" className="text-xs sm:text-sm" disabled={!district}>
                {district ? "Bairro" : "Bairro —"}
              </TabsTrigger>
            </TabsList>

            {/* Parâmetros */}
            <TabsContent value="parametros" className="space-y-5 mt-4">
              <SliderRow
                label="Diária média"
                value={formatBRL(nightly)}
                helper={district?.adrRangeLabel ? `Mercado: ${district.adrRangeLabel}` : undefined}
                ariaLabel="Diária média"
                sliderValue={[nightly]}
                min={sliderLimits.nightlyMin}
                max={sliderLimits.nightlyMax}
                step={10}
                onChange={(v) => setNightly(v)}
              />

              <SliderRow
                label="Ocupação média"
                value={`${occupancy}%`}
                helper={`Mercado: ${baseline.occupancy}% de ocupação`}
                ariaLabel="Ocupação média"
                sliderValue={[occupancy]}
                min={40}
                max={95}
                step={1}
                onChange={(v) => setOccupancy(v)}
              />

              <SliderRow
                label="Custos operacionais"
                value={`${Math.round(operatingCost)}%`}
                helper="Plataformas, limpeza, energia, gestão"
                ariaLabel="Custos operacionais"
                sliderValue={[operatingCost]}
                min={15}
                max={55}
                step={1}
                onChange={(v) => setOperatingCost(v)}
              />

              {isEdited && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-body"
                >
                  Voltar para a média do bairro (ROI {formatPct(baselineRoi)})
                </button>
              )}
            </TabsContent>

            {/* Projeção */}
            <TabsContent value="projecao" className="space-y-4 mt-4">
              <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h4 className="font-display font-bold text-sm text-foreground">
                    Composição da receita mensal
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <BreakdownCell label="Receita bruta" value={formatBRL(grossMonth)} positive />
                  <BreakdownCell
                    label={`Custos (${Math.round(operatingCost)}%)`}
                    value={`− ${formatBRL(opCostMonth)}`}
                    negative
                  />
                  <BreakdownCell label="Receita líquida" value={formatBRL(netMonth)} highlight />
                </div>
                <p className="text-[11px] text-muted-foreground font-body leading-relaxed">
                  Cálculo: {formatBRL(nightly)} × {DAYS_PER_MONTH} dias × {occupancy}% de ocupação
                  = bruto. Subtraído {Math.round(operatingCost)}% de custos operacionais.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CalendarCheck2 className="h-4 w-4 text-primary" />
                  <h4 className="font-display font-bold text-sm text-foreground">
                    Projeção de longo prazo
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <ProjectionTile period="1 ano" value={formatBRL(netYear)} />
                  <ProjectionTile period="5 anos" value={formatBRL(fiveYearReturn)} highlight />
                  <ProjectionTile period="10 anos" value={formatBRL(tenYearReturn)} />
                </div>
                <Separator />
                <div className="flex items-start gap-2 text-xs font-body text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 text-primary mt-0.5 flex-shrink-0" />
                  <p>
                    Em 5 anos, o retorno acumulado representa{" "}
                    <span className="font-semibold text-foreground">
                      {safeTotal > 0 ? formatPct((fiveYearReturn / safeTotal) * 100) : "—"}
                    </span>{" "}
                    do valor investido na reforma — sem considerar a valorização do imóvel.
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-primary" />
                  <h4 className="font-display font-bold text-sm text-foreground">
                    Comparativo com investimentos tradicionais
                  </h4>
                </div>
                <div className="space-y-1.5 text-xs font-body">
                  <ComparisonRow label="CDI (estimado)" value="~10%" highlight={false} />
                  <ComparisonRow
                    label="Tesouro IPCA+ (real)"
                    value="~6%"
                    highlight={false}
                  />
                  <ComparisonRow
                    label="Esta reforma (ROI projetado)"
                    value={formatPct(roiYearPct)}
                    highlight
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-body italic mt-2">
                  Comparação ilustrativa. Investimento imobiliário possui liquidez e risco
                  diferentes de renda fixa.
                </p>
              </div>
            </TabsContent>

            {/* Bairro */}
            <TabsContent value="bairro" className="space-y-4 mt-4">
              {district ? (
                <>
                  <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-display font-bold text-sm text-foreground">
                        {district.districtName}
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] font-body border", competitionColor)}
                      >
                        Competição: {district.competition}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {district.chips.map((chip) => (
                        <Badge key={chip} variant="outline" className="text-[10px] font-body">
                          {chip}
                        </Badge>
                      ))}
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-2 text-xs font-body">
                      <Stat label="Anúncios ativos" value={district.listingsCount.toLocaleString("pt-BR")} />
                      <Stat label="Receita média/mês" value={formatBRL(district.revenueMonthBRL)} />
                      <Stat label="Faixa ADR" value={district.adrRangeLabel} />
                      <Stat label="ROI médio bairro" value={formatPct(district.roiPercent)} />
                    </div>
                  </div>

                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary" />
                      <h4 className="font-display font-bold text-sm text-foreground">
                        Perfil recomendado
                      </h4>
                    </div>
                    <p className="text-sm font-body text-foreground font-medium">
                      {district.recommendation.bestStudioType}
                    </p>
                    <p className="text-xs font-body text-muted-foreground leading-relaxed">
                      {district.recommendation.whyItWorks}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-success/20 bg-success/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-success" />
                        <h5 className="font-display font-bold text-xs text-foreground">
                          Boas práticas
                        </h5>
                      </div>
                      <ul className="space-y-1.5">
                        {district.recommendation.tips.map((tip) => (
                          <li
                            key={tip}
                            className="text-[11px] font-body text-muted-foreground leading-relaxed flex gap-1.5"
                          >
                            <span className="text-success">•</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                        <h5 className="font-display font-bold text-xs text-foreground">
                          Pontos de atenção
                        </h5>
                      </div>
                      <ul className="space-y-1.5">
                        {district.recommendation.risks.map((risk) => (
                          <li
                            key={risk}
                            className="text-[11px] font-body text-muted-foreground leading-relaxed flex gap-1.5"
                          >
                            <span className="text-warning">•</span>
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-border bg-muted/30 p-6 text-center">
                  <p className="text-sm font-body text-muted-foreground">
                    Sem dados específicos para este bairro. Usando média da cidade de São Paulo.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Footer disclaimer */}
          <div className="border-t border-border pt-3 flex items-start gap-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
              Projeção baseada em {district?.sourceLabel || "média de São Paulo (Bwild/AirDNA 2025)"}
              . Resultado estimado — sujeito a sazonalidade, gestão operacional, qualidade do
              anúncio e variação do mercado. Não constitui promessa de retorno.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Componentes auxiliares ──

function KpiTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        accent
          ? "bg-primary/10 border-primary/25"
          : "bg-muted/40 border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1">
        {label}
      </p>
      <p
        className={cn(
          "font-display font-bold text-lg sm:text-xl leading-tight",
          accent ? "text-primary" : "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground font-body mt-0.5">{hint}</p>
    </div>
  );
}

function SliderRow({
  label,
  value,
  helper,
  ariaLabel,
  sliderValue,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: string;
  helper?: string;
  ariaLabel: string;
  sliderValue: number[];
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-body text-muted-foreground">{label}</label>
        <span
          className="font-display font-bold text-sm text-foreground"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
      </div>
      <Slider
        aria-label={ariaLabel}
        value={sliderValue}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      {helper && (
        <p className="text-[10px] text-muted-foreground font-body mt-1.5">{helper}</p>
      )}
    </div>
  );
}

function BreakdownCell({
  label,
  value,
  positive,
  negative,
  highlight,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2.5",
        highlight && "bg-primary/10 border-primary/25",
        !highlight && "bg-background/60 border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
        {label}
      </p>
      <p
        className={cn(
          "font-display font-bold text-sm mt-0.5",
          highlight && "text-primary",
          negative && "text-warning",
          positive && !highlight && "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function ProjectionTile({
  period,
  value,
  highlight,
}: {
  period: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-3 text-center",
        highlight ? "bg-primary/10 border-primary/25" : "bg-background border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
        {period}
      </p>
      <p
        className={cn(
          "font-display font-bold text-base mt-1",
          highlight ? "text-primary" : "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-md px-2.5 py-1.5",
        highlight && "bg-primary/10 border border-primary/20",
      )}
    >
      <span className={cn("font-body", highlight ? "text-foreground font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-display font-bold",
          highlight ? "text-primary" : "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/40 border border-border p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono">
        {label}
      </p>
      <p
        className="font-display font-bold text-sm text-foreground mt-0.5"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
    </div>
  );
}
