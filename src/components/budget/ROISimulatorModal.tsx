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
  Home,
  ExternalLink,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import {
  AVERAGE_METRICS,
  BENCHMARKS_2025,
  DATA_SOURCES,
  findDistrict,
  formatPct,
  getAppreciationPctYear,
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
const DEFAULT_OPERATING_COST = 0.5; // ~50% custos reais Airbnb SP (comissão + gestão + limpeza + condomínio + manutenção)
const DEFAULT_STUDIO_PRICE = 375_000;
const STUDIO_PRICE_MIN = 250_000;
const STUDIO_PRICE_MAX = 600_000;

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
  const [studioPrice, setStudioPrice] = useState<number>(DEFAULT_STUDIO_PRICE);

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
  const totalInvestment = studioPrice + safeTotal; // compra + reforma
  const appreciationPctYear = getAppreciationPctYear(district);
  const appreciationYear = studioPrice * (appreciationPctYear / 100);
  const roiYearPct = totalInvestment > 0 ? (netYear / totalInvestment) * 100 : 0;
  const roiTotalPct =
    totalInvestment > 0 ? ((netYear + appreciationYear) / totalInvestment) * 100 : 0;
  const paybackMonths =
    totalInvestment > 0 && netMonth > 0 ? totalInvestment / netMonth : null;

  const paybackLabel =
    paybackMonths === null
      ? "—"
      : paybackMonths < 12
        ? `${Math.round(paybackMonths)} meses`
        : `${(paybackMonths / 12).toFixed(1).replace(".", ",")} anos`;

  // Projeção composta — renda acumulada + valorização patrimonial
  const buildProjection = (years: number) => {
    const rentAccum = netYear * years;
    const propertyValueFuture = studioPrice * Math.pow(1 + appreciationPctYear / 100, years);
    const propertyAppreciation = propertyValueFuture - studioPrice;
    return {
      rent: rentAccum,
      appreciation: propertyAppreciation,
      total: rentAccum + propertyAppreciation,
      finalAsset: propertyValueFuture + rentAccum,
    };
  };
  const projection5y = buildProjection(5);
  const projection10y = buildProjection(10);
  const projection1y = buildProjection(1);

  const isEdited =
    nightly !== baseline.nightly ||
    occupancy !== baseline.occupancy ||
    operatingCost !== DEFAULT_OPERATING_COST * 100 ||
    studioPrice !== DEFAULT_STUDIO_PRICE;

  const baselineRoi = useMemo(() => {
    const g = baseline.nightly * DAYS_PER_MONTH * (baseline.occupancy / 100);
    const n = g * (1 - DEFAULT_OPERATING_COST) * 12;
    const inv = DEFAULT_STUDIO_PRICE + safeTotal;
    return inv > 0 ? (n / inv) * 100 : 0;
  }, [baseline, safeTotal]);

  const handleReset = () => {
    setNightly(baseline.nightly);
    setOccupancy(baseline.occupancy);
    setOperatingCost(DEFAULT_OPERATING_COST * 100);
    setStudioPrice(DEFAULT_STUDIO_PRICE);
  };

  const competitionColor =
    district?.competition === "Alta"
      ? "bg-warning/15 text-warning border-warning/30"
      : district?.competition === "Média"
        ? "bg-primary/10 text-primary border-primary/30"
        : "bg-success/15 text-success border-success/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          // Bottom-sheet no mobile, dialog centrado no desktop
          "p-0 gap-0 overflow-hidden",
          "max-w-[100vw] sm:max-w-2xl",
          "h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[88dvh]",
          // No mobile alinha embaixo (bottom-sheet feel) sem cantos arredondados no topo do viewport
          "rounded-none sm:rounded-lg",
          // Override do posicionamento padrão para bottom-sheet no mobile
          "top-0 left-0 translate-x-0 translate-y-0 sm:top-[50%] sm:left-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]",
        )}
      >
        {/* Header gradiente — compacto, sticky no mobile para contexto durante scroll */}
        <div className="sticky top-0 z-20 relative bg-gradient-to-br from-primary/15 via-primary/5 to-card border-b border-border px-4 sm:px-5 py-3 sm:py-3.5">
          <DialogHeader className="text-left space-y-1">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="min-w-0 pr-8">
                <DialogTitle className="font-display font-bold text-[15px] sm:text-base leading-tight">
                  Simulador de Retorno
                </DialogTitle>
                <DialogDescription className="text-[10px] sm:text-[11px] font-body leading-snug text-balance text-muted-foreground">
                  Design premium · análise por bairro
                </DialogDescription>
              </div>
            </div>

            {/* Linha unificada: bairro + chips em scroll horizontal */}
            <div className="flex items-center gap-1.5 flex-nowrap pt-1.5 -mx-1 px-1 overflow-x-auto scrollbar-none">
              <Badge
                variant="outline"
                className="text-[10px] font-mono bg-background/80 border-primary/30 flex-shrink-0"
              >
                <MapPin className="h-3 w-3 mr-1 text-primary" />
                <span className="truncate max-w-[120px]">{baseline.label}</span>
                {district?.score && (
                  <span className="ml-1 text-muted-foreground">· {district.score}</span>
                )}
              </Badge>
              {metragem && (
                <Badge variant="outline" className="text-[10px] font-mono bg-background/60 flex-shrink-0">
                  {metragem}
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] font-mono flex-shrink-0">
                Total {formatBRL(totalInvestment)}
              </Badge>
            </div>
          </DialogHeader>
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto overscroll-contain px-4 sm:px-5 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          {/* KPIs principais — 2 cols mobile, 4 desktop, com hierarquia visual */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${nightly}-${occupancy}-${operatingCost}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5"
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
            {/* TabsList sticky no mobile pra navegação rápida durante scroll */}
            <TabsList className="grid grid-cols-3 w-full sticky top-0 z-10 bg-card/95 backdrop-blur-sm shadow-sm">
              <TabsTrigger value="parametros" className="text-xs sm:text-sm min-h-[40px]">
                Parâmetros
              </TabsTrigger>
              <TabsTrigger value="projecao" className="text-xs sm:text-sm min-h-[40px]">
                Projeção
              </TabsTrigger>
              <TabsTrigger value="bairro" className="text-xs sm:text-sm min-h-[40px]" disabled={!district}>
                {district ? "Bairro" : "Bairro —"}
              </TabsTrigger>
            </TabsList>

            {/* Parâmetros */}
            <TabsContent value="parametros" className="space-y-4 sm:space-y-5 mt-4">
              {/* Composição do investimento */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-primary flex-shrink-0" />
                  <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground leading-tight">
                    Composição do investimento
                    <span className="hidden sm:inline"> (base do payback)</span>
                  </h4>
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center">
                  <div className="rounded-md bg-background border border-border p-2">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Studio</p>
                    <p className="text-[11px] sm:text-xs font-display font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(studioPrice)}
                    </p>
                  </div>
                  <div className="rounded-md bg-background border border-border p-2">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Reforma</p>
                    <p className="text-[11px] sm:text-xs font-display font-bold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(safeTotal)}
                    </p>
                  </div>
                  <div className="rounded-md bg-primary/15 border border-primary/30 p-2">
                    <p className="text-[9px] text-muted-foreground font-mono uppercase">Total</p>
                    <p className="text-[11px] sm:text-xs font-display font-bold text-primary" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {formatBRL(totalInvestment)}
                    </p>
                  </div>
                </div>
              </div>

              <SliderRow
                label="Valor de compra do studio"
                value={formatBRL(studioPrice)}
                helper="Mercado: studios em SP custam em média R$ 350 mil a R$ 400 mil"
                ariaLabel="Valor de compra do studio"
                sliderValue={[studioPrice]}
                min={STUDIO_PRICE_MIN}
                max={STUDIO_PRICE_MAX}
                step={5_000}
                onChange={(v) => setStudioPrice(v)}
              />

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
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors font-body min-h-[36px] inline-flex items-center"
                >
                  Voltar aos valores de referência (ROI {formatPct(baselineRoi)})
                </button>
              )}
            </TabsContent>

            {/* Projeção */}
            <TabsContent value="projecao" className="space-y-4 mt-4">
              <div className="rounded-lg border border-primary/15 bg-gradient-to-br from-primary/5 to-transparent p-3 sm:p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
                  <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground">
                    Composição da receita mensal
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-2.5">
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

              {/* Projeção composta — renda + valorização patrimonial */}
              <div className="rounded-lg border border-success/25 bg-success/5 p-3 sm:p-4 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CalendarCheck2 className="h-4 w-4 text-success flex-shrink-0" />
                    <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground">
                      Renda + valorização
                    </h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono border-success/30 text-success bg-background/60">
                    +{formatPct(appreciationPctYear)} a.a.
                  </Badge>
                </div>

                {/* Mobile: cards empilhados (tabela quebra em telas estreitas) */}
                <div className="sm:hidden space-y-2">
                  <ProjectionCard period="1 ano" data={projection1y} />
                  <ProjectionCard period="5 anos" data={projection5y} highlight />
                  <ProjectionCard period="10 anos" data={projection10y} />
                </div>

                {/* Desktop: tabela */}
                <div className="hidden sm:block overflow-hidden rounded-md border border-border bg-background">
                  <table className="w-full text-xs font-body">
                    <thead className="bg-muted/50">
                      <tr className="text-[10px] font-mono uppercase text-muted-foreground">
                        <th className="text-left px-3 py-2">Período</th>
                        <th className="text-right px-3 py-2">Renda acumulada</th>
                        <th className="text-right px-3 py-2">Valorização imóvel</th>
                        <th className="text-right px-3 py-2">Retorno total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <ProjectionRow period="1 ano" data={projection1y} />
                      <ProjectionRow period="5 anos" data={projection5y} highlight />
                      <ProjectionRow period="10 anos" data={projection10y} />
                    </tbody>
                  </table>
                </div>

                <div className="flex items-start gap-2 text-[11px] sm:text-xs font-body text-muted-foreground">
                  <ArrowRight className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                  <p className="leading-relaxed">
                    Em 10 anos, o patrimônio total estimado (imóvel valorizado + renda acumulada)
                    chega a{" "}
                    <span className="font-semibold text-foreground">
                      {formatBRL(projection10y.finalAsset)}
                    </span>
                    , partindo de um investimento de{" "}
                    <span className="font-semibold text-foreground">
                      {formatBRL(totalInvestment)}
                    </span>
                    .
                  </p>
                </div>
              </div>

              {/* Comparativo com benchmarks reais 2025 */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Percent className="h-4 w-4 text-primary flex-shrink-0" />
                    <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground">
                      vs. investimentos tradicionais
                    </h4>
                  </div>
                  <Badge variant="outline" className="text-[10px] font-mono bg-background">
                    valores 2025
                  </Badge>
                </div>
                <div className="space-y-1.5 text-[11px] sm:text-xs font-body">
                  <ComparisonRow label={`Poupança (~${BENCHMARKS_2025.poupanca}% a.a.)`} value={formatPct(BENCHMARKS_2025.poupanca)} />
                  <ComparisonRow label={`Tesouro IPCA+ real (~${BENCHMARKS_2025.ipcaPlus}% a.a.)`} value={formatPct(BENCHMARKS_2025.ipcaPlus)} />
                  <ComparisonRow label={`Fundos Imobiliários — IFIX (~${BENCHMARKS_2025.fundoImobiliario}% a.a.)`} value={formatPct(BENCHMARKS_2025.fundoImobiliario)} />
                  <ComparisonRow label={`CDI / Selic (~${BENCHMARKS_2025.cdi}% a.a.)`} value={formatPct(BENCHMARKS_2025.cdi)} />
                  <ComparisonRow
                    label="Este studio (renda + valorização)"
                    value={formatPct(roiTotalPct)}
                    highlight
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/80 font-body italic mt-2 leading-relaxed">
                  Fontes: BCB (CDI/Selic), Tesouro Direto (IPCA+), B3 (IFIX), FipeZap (valorização imóvel).
                  Investimento imobiliário possui liquidez e risco diferentes de renda fixa.
                </p>
              </div>
            </TabsContent>

            {/* Bairro */}
            <TabsContent value="bairro" className="space-y-4 mt-4">
              {district ? (
                <>
                  <div className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground">
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

                  <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 sm:p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                      <h4 className="font-display font-bold text-[13px] sm:text-sm text-foreground">
                        Perfil recomendado
                      </h4>
                    </div>
                    <p className="text-[13px] sm:text-sm font-body text-foreground font-medium">
                      {district.recommendation.bestStudioType}
                    </p>
                    <p className="text-xs font-body text-muted-foreground leading-relaxed">
                      {district.recommendation.whyItWorks}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-success/20 bg-success/5 p-3 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-success flex-shrink-0" />
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
                        <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
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

          {/* Footer — Fonte e disclaimer */}
          <div className="border-t border-border pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
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
                className="inline-flex items-center gap-1 text-[10px] font-mono text-primary hover:text-primary/80 transition-colors min-h-[28px]"
              >
                Consultar dados de mercado
                <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
            <div className="flex items-start gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground font-body leading-relaxed">
                Análise específica para{" "}
                <strong className="text-foreground">{baseline.label}</strong>. O payback considera o{" "}
                <strong className="text-foreground">investimento total</strong> = compra do studio
                ({formatBRL(studioPrice)}) + reforma ({formatBRL(safeTotal)}). Resultado estimado —
                sujeito a sazonalidade, gestão operacional, qualidade do anúncio e variação do
                mercado. Não constitui promessa de retorno.
              </p>
            </div>

            {/* Fontes oficiais detalhadas */}
            <div className="rounded-md border border-border bg-muted/20 p-2.5 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono font-semibold">
                Fontes oficiais consultadas
              </p>
              <ul className="space-y-1">
                {DATA_SOURCES.map((src) => (
                  <li key={src.label} className="flex items-start gap-1.5">
                    <ExternalLink className="h-2.5 w-2.5 text-primary flex-shrink-0 mt-1" />
                    <div className="min-w-0">
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] font-mono text-primary hover:underline break-words"
                      >
                        {src.label}
                      </a>
                      <p className="text-[10px] text-muted-foreground font-body leading-snug">
                        {src.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
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
        "rounded-lg border p-2.5 sm:p-3",
        accent
          ? "bg-primary/10 border-primary/25"
          : "bg-muted/40 border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono mb-1 truncate">
        {label}
      </p>
      <p
        className={cn(
          "font-display font-bold text-base sm:text-xl leading-tight",
          accent ? "text-primary" : "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground font-body mt-0.5 leading-tight truncate">{hint}</p>
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
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <label className="text-[12px] sm:text-xs font-body text-muted-foreground min-w-0 truncate">{label}</label>
        <span
          className="font-display font-bold text-sm text-foreground tabular-nums px-2 py-0.5 rounded-md bg-primary/[0.06] border border-primary/15 flex-shrink-0"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {value}
        </span>
      </div>
      <div className="py-2 -my-1 touch-pan-y">
        <Slider
          aria-label={ariaLabel}
          value={sliderValue}
          min={min}
          max={max}
          step={step}
          onValueChange={([v]) => onChange(v)}
        />
      </div>
      {helper && (
        <p className="text-[10px] text-muted-foreground font-body mt-2 leading-snug">{helper}</p>
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
        "rounded-md border p-2.5 flex sm:block items-center justify-between gap-2",
        highlight && "bg-primary/10 border-primary/25",
        !highlight && "bg-background/60 border-border",
      )}
    >
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-mono sm:mb-0">
        {label}
      </p>
      <p
        className={cn(
          "font-display font-bold text-sm sm:mt-0.5",
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

function ProjectionRow({
  period,
  data,
  highlight,
}: {
  period: string;
  data: { rent: number; appreciation: number; total: number; finalAsset: number };
  highlight?: boolean;
}) {
  return (
    <tr className={cn(highlight && "bg-success/10")}>
      <td className="px-3 py-2 font-display font-bold text-foreground">{period}</td>
      <td
        className="px-3 py-2 text-right text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatBRL(data.rent)}
      </td>
      <td
        className="px-3 py-2 text-right text-foreground"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatBRL(data.appreciation)}
      </td>
      <td
        className={cn(
          "px-3 py-2 text-right font-display font-bold",
          highlight ? "text-success" : "text-foreground",
        )}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {formatBRL(data.total)}
      </td>
    </tr>
  );
}

// Card empilhado para projeção no mobile (substitui a tabela)
function ProjectionCard({
  period,
  data,
  highlight,
}: {
  period: string;
  data: { rent: number; appreciation: number; total: number; finalAsset: number };
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-background p-2.5",
        highlight ? "border-success/40 bg-success/[0.06] shadow-sm" : "border-border",
      )}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Em
        </span>
        <span className="font-display font-bold text-sm text-foreground">{period}</span>
      </div>
      <div className="grid grid-cols-2 gap-1.5 text-[11px] font-body">
        <div>
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Renda</p>
          <p className="font-display font-semibold text-foreground tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(data.rent)}
          </p>
        </div>
        <div>
          <p className="text-[9px] font-mono uppercase text-muted-foreground">Valorização</p>
          <p className="font-display font-semibold text-foreground tabular-nums" style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatBRL(data.appreciation)}
          </p>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-border flex items-baseline justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          Retorno total
        </span>
        <span
          className={cn(
            "font-display font-bold text-base tabular-nums",
            highlight ? "text-success" : "text-foreground",
          )}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {formatBRL(data.total)}
        </span>
      </div>
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
        "flex items-center justify-between gap-2 rounded-md px-2.5 py-2 sm:py-1.5",
        highlight && "bg-primary/10 border border-primary/20",
      )}
    >
      <span className={cn("font-body min-w-0 truncate", highlight ? "text-foreground font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <span
        className={cn(
          "font-display font-bold flex-shrink-0",
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
