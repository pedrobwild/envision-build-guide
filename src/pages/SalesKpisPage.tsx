/**
 * SalesKpisPage — Operação de Vendas (God Mode)
 *
 * Análise macro → micro de KPIs comerciais:
 *  1. Filtros (período, vendedora)
 *  2. Overview macro (KPI cards)
 *  3. Tempo médio em cada etapa (p50/p90)
 *  4. Performance por vendedora (ciclo, win rate, ticket)
 *  5. Cortes por segmento (m², tipo de locação, imóvel, fonte)
 *  6. Motivos de perda (volume + valor)
 *  7. Coortes mensais (taxa de conversão acumulada)
 *
 * Acessibilidade: navegação por teclado, foco visível, contraste AA,
 * estados loading/empty/error em todas as zonas.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownRight,
  ArrowUpRight,
  Activity,
  AlertTriangle,
  Award,
  BarChart3,
  Calendar,
  Clock,
  Filter,
  HelpCircle,
  Layers,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  formatCurrencyBRL,
  formatDays,
  formatPct,
  lostReasonLabel,
  rangeToBounds,
  stageLabel,
  useLostReasonsRanked,
  useSalesByOwner,
  useSalesBySegment,
  useSalesCohorts,
  useSalesOverview,
  useTimeInStageGodMode,
  type SalesPeriod,
  type SalesRange,
  type SegmentDimension,
} from "@/hooks/useSalesKpis";

// ============================================================
// 1. KPI Card local — versão compacta para esta página
// ============================================================
interface KpiTileProps {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "positive" | "warning" | "critical";
  loading?: boolean;
  tooltip?: string;
  delta?: { label: string; positive?: boolean };
}

const TONE_STYLES: Record<NonNullable<KpiTileProps["tone"]>, string> = {
  default: "border-border",
  positive: "border-emerald-500/30",
  warning: "border-amber-500/30",
  critical: "border-destructive/30",
};

function KpiTile({ label, value, hint, icon, tone = "default", loading, tooltip, delta }: KpiTileProps) {
  return (
    <Card className={cn("border", TONE_STYLES[tone])}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            {icon}
            <span>{label}</span>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Mais sobre ${label}`}
                      className="rounded p-0.5 text-muted-foreground/60 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    {tooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                delta.positive
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-destructive/10 text-destructive"
              )}
            >
              {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {delta.label}
            </span>
          )}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        )}
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 2. Overview block
// ============================================================
function OverviewBlock({ period, ownerId }: { period: SalesPeriod; ownerId: string | null }) {
  const { data, isLoading, isError, refetch } = useSalesOverview(period, ownerId);

  if (isError) {
    return (
      <Card className="border border-destructive/30">
        <CardContent className="flex items-center justify-between gap-3 p-4 text-sm">
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Não foi possível carregar os KPIs macro.
          </div>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  const o = data;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      <KpiTile
        label="Leads no período"
        value={String(o?.total_leads ?? 0)}
        icon={<Users className="h-3.5 w-3.5" />}
        loading={isLoading}
        tooltip="Total de orçamentos que entraram no funil dentro do período selecionado."
      />
      <KpiTile
        label="Win rate"
        value={formatPct(o?.win_rate_pct ?? 0)}
        icon={<Target className="h-3.5 w-3.5" />}
        tone="positive"
        loading={isLoading}
        tooltip="% de fechados sobre o total decidido (won + lost). Ignora deals abertos."
      />
      <KpiTile
        label="Ciclo médio"
        value={formatDays(o?.avg_cycle_days)}
        hint={
          o
            ? `p50 ${formatDays(o.p50_cycle_days)} · p90 ${formatDays(o.p90_cycle_days)}`
            : undefined
        }
        icon={<Clock className="h-3.5 w-3.5" />}
        loading={isLoading}
        tooltip="Dias entre a entrada do lead e o fechamento (won ou lost)."
      />
      <KpiTile
        label="Ticket médio fechado"
        value={formatCurrencyBRL(o?.avg_deal_size_won)}
        icon={<Award className="h-3.5 w-3.5" />}
        loading={isLoading}
        tooltip="Valor médio dos contratos fechados no período."
      />
      <KpiTile
        label="Receita fechada"
        value={formatCurrencyBRL(o?.revenue_won ?? 0)}
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        tone="positive"
        loading={isLoading}
      />
      <KpiTile
        label="Pipeline aberto"
        value={formatCurrencyBRL(o?.pipeline_open_value ?? 0)}
        hint={o ? `${o.deals_open} deals em andamento` : undefined}
        icon={<Activity className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <KpiTile
        label="Propostas enviadas"
        value={String(o?.proposals_sent ?? 0)}
        hint={o ? `${formatPct(o.proposal_rate_pct)} dos leads` : undefined}
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        loading={isLoading}
      />
      <KpiTile
        label="Deals fechados"
        value={String(o?.deals_won ?? 0)}
        icon={<Target className="h-3.5 w-3.5" />}
        tone="positive"
        loading={isLoading}
      />
      <KpiTile
        label="Deals perdidos"
        value={String(o?.deals_lost ?? 0)}
        hint={o ? formatCurrencyBRL(o.revenue_lost) + " perdidos" : undefined}
        icon={<AlertTriangle className="h-3.5 w-3.5" />}
        tone="critical"
        loading={isLoading}
      />
    </div>
  );
}

// ============================================================
// 3. Time in stage
// ============================================================
function TimeInStageBlock({ period, ownerId }: { period: SalesPeriod; ownerId: string | null }) {
  const { data, isLoading } = useTimeInStageGodMode(period, ownerId);
  const chartData = useMemo(
    () =>
      (data ?? [])
        .filter((r) => (r.sample_size ?? 0) >= 1 && r.avg_days != null)
        .map((r) => ({
          stage: stageLabel(r.stage),
          avg: Number(r.avg_days),
          p50: Number(r.p50_days ?? 0),
          p90: Number(r.p90_days ?? 0),
          n: r.sample_size,
        }))
        .slice(0, 10),
    [data]
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers className="h-4 w-4 text-primary" /> Tempo médio em cada etapa
          </CardTitle>
          <span className="text-xs text-muted-foreground">média · p50 · p90 (em dias)</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : chartData.length === 0 ? (
          <EmptyState message="Sem histórico suficiente de mudanças de etapa." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="stage"
                  width={140}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <RTooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)} d`, name]}
                />
                <Bar dataKey="avg" name="Média" radius={[0, 4, 4, 0]}>
                  {chartData.map((row, i) => (
                    <Cell
                      key={i}
                      fill={
                        row.avg > 14
                          ? "hsl(var(--destructive))"
                          : row.avg > 7
                          ? "hsl(38 92% 50%)"
                          : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 4. Performance por vendedora
// ============================================================
function OwnerTableBlock({
  period,
  onSelectOwner,
}: {
  period: SalesPeriod;
  onSelectOwner: (id: string | null) => void;
}) {
  const { data, isLoading } = useSalesByOwner(period);
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-primary" /> Performance por vendedora
          </CardTitle>
          <span className="text-xs text-muted-foreground">clique numa linha para filtrar o dashboard</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState message="Ainda não há orçamentos atribuídos." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedora</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Propostas</TableHead>
                  <TableHead className="text-right">Fechados</TableHead>
                  <TableHead className="text-right">Win rate</TableHead>
                  <TableHead className="text-right">Ciclo p50</TableHead>
                  <TableHead className="text-right">Ciclo p90</TableHead>
                  <TableHead className="text-right">Ticket médio</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                  <TableHead className="text-right">Pipeline aberto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.owner_id ?? "none"}
                    className="cursor-pointer hover:bg-muted/40 focus-within:bg-muted/40"
                    onClick={() => onSelectOwner(r.owner_id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectOwner(r.owner_id);
                      }
                    }}
                  >
                    <TableCell className="font-medium">{r.owner_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.total_leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.proposals_sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.deals_won}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge
                        variant="outline"
                        className={cn(
                          "border",
                          r.win_rate_pct >= 30
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : r.win_rate_pct >= 15
                            ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                            : "border-destructive/40 text-destructive"
                        )}
                      >
                        {formatPct(r.win_rate_pct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDays(r.p50_cycle_days)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatDays(r.p90_cycle_days)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrencyBRL(r.avg_deal_size_won)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrencyBRL(r.revenue_won)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrencyBRL(r.pipeline_open_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 5. Segmentação (m², tipo de locação, imóvel, fonte)
// ============================================================
const SEGMENT_TABS: { value: SegmentDimension; label: string; description: string }[] = [
  { value: "metragem", label: "Faixa de m²", description: "Conversão por área do imóvel." },
  { value: "location_type", label: "Tipo de locação", description: "STR, mid-stay, long-stay, etc." },
  { value: "property_type", label: "Tipo de imóvel", description: "Apto, casa, cobertura, etc." },
  { value: "lead_source", label: "Fonte do lead", description: "Origem do contato." },
];

function SegmentBlock({ period, ownerId }: { period: SalesPeriod; ownerId: string | null }) {
  const [dim, setDim] = useState<SegmentDimension>("metragem");
  const { data, isLoading } = useSalesBySegment(dim, period, ownerId);
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-4 w-4 text-primary" /> Conversão por segmento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={dim} onValueChange={(v) => setDim(v as SegmentDimension)}>
          <TabsList className="mb-4 flex w-full flex-wrap gap-1">
            {SEGMENT_TABS.map((s) => (
              <TabsTrigger key={s.value} value={s.value} className="flex-1 min-w-[140px]">
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {SEGMENT_TABS.map((s) => (
            <TabsContent key={s.value} value={s.value} className="space-y-3">
              <p className="text-xs text-muted-foreground">{s.description}</p>
              {isLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : rows.length === 0 ? (
                <EmptyState message="Sem dados nesta dimensão." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Segmento</TableHead>
                        <TableHead className="text-right">Leads</TableHead>
                        <TableHead className="text-right">Propostas</TableHead>
                        <TableHead className="text-right">Fechados</TableHead>
                        <TableHead className="text-right">Win rate</TableHead>
                        <TableHead className="text-right">Ciclo médio</TableHead>
                        <TableHead className="text-right">Ticket médio</TableHead>
                        <TableHead className="text-right">Receita</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => (
                        <TableRow key={r.segment}>
                          <TableCell className="font-medium">{r.segment}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.total_leads}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.proposals_sent}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.deals_won}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <Badge variant="outline" className="border">
                              {formatPct(r.win_rate_pct)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatDays(r.avg_cycle_days)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatCurrencyBRL(r.avg_deal_size_won)}</TableCell>
                          <TableCell className="text-right tabular-nums font-medium">{formatCurrencyBRL(r.revenue_won)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ============================================================
// 6. Lost reasons
// ============================================================
function LostReasonsBlock({ period, ownerId }: { period: SalesPeriod; ownerId: string | null }) {
  const { data, isLoading } = useLostReasonsRanked(period, ownerId);
  const rows = data ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-4 w-4 text-destructive" /> Motivos de perda
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState message="Ainda não foram registrados motivos de perda." />
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.reason}
                className="flex items-center justify-between rounded-md border bg-card/40 p-3 text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-32 text-foreground">{lostReasonLabel(r.reason)}</div>
                  <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-destructive/70"
                      style={{ width: `${Math.min(100, r.pct_of_lost)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-muted-foreground">{formatPct(r.pct_of_lost)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="tabular-nums text-muted-foreground">{r.qty} deals</span>
                  <span className="tabular-nums font-medium text-destructive">{formatCurrencyBRL(r.revenue_lost)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// 7. Cohorts mensais
// ============================================================
function CohortBlock({ period, ownerId }: { period: SalesPeriod; ownerId: string | null }) {
  const { data, isLoading } = useSalesCohorts(period, ownerId);
  const rows = (data ?? []).slice(0, 12);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-4 w-4 text-primary" /> Coortes mensais
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : rows.length === 0 ? (
          <EmptyState message="Sem coortes registradas." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês de entrada</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Propostas</TableHead>
                  <TableHead className="text-right">Fechados</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">Ciclo médio</TableHead>
                  <TableHead className="text-right">Receita</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cohort_month}>
                    <TableCell className="font-medium">
                      {new Date(r.cohort_month).toLocaleDateString("pt-BR", {
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.proposals_sent}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.deals_won}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Badge variant="outline" className="border">
                        {formatPct(r.lead_to_won_pct)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatDays(r.avg_cycle_days)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrencyBRL(r.revenue_won)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================
// Empty state
// ============================================================
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
      {message}
    </div>
  );
}

// ============================================================
// Filtros globais
// ============================================================
const RANGE_OPTIONS: { value: SalesRange; label: string }[] = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "ytd", label: "Ano atual (YTD)" },
  { value: "all", label: "Desde o início" },
];

// ============================================================
// Página
// ============================================================
export default function SalesKpisPage() {
  const [range, setRange] = useState<SalesRange>("90d");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const navigate = useNavigate();

  const period: SalesPeriod = useMemo(() => ({ range }), [range]);
  const bounds = rangeToBounds(period);
  // Lista global de vendedoras para o filtro — sem período/owner para nunca
  // esvaziar o seletor (o bloco da tabela usa sua própria query filtrada).
  const { data: owners } = useSalesByOwner();

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">KPIs de Vendas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Análise macro → micro da operação comercial: ciclo, conversão, segmentação e coortes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" /> Filtros:
          </div>
          <Select value={range} onValueChange={(v) => setRange(v as SalesRange)}>
            <SelectTrigger className="h-9 w-[180px]" aria-label="Período">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={ownerId ?? "__all"}
            onValueChange={(v) => setOwnerId(v === "__all" ? null : v)}
          >
            <SelectTrigger className="h-9 w-[200px]" aria-label="Vendedora">
              <SelectValue placeholder="Todas as vendedoras" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Todas as vendedoras</SelectItem>
              {(owners ?? [])
                .filter((o) => o.owner_id)
                .map((o) => (
                  <SelectItem key={o.owner_id!} value={o.owner_id!}>
                    {o.owner_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/comercial")}
            className="h-9"
          >
            Ver pipeline
          </Button>
        </div>
      </header>

      {/* Período aplicado */}
      <div className="text-xs text-muted-foreground">
        Período aplicado:{" "}
        <span className="font-medium text-foreground">
          {bounds.start ? new Date(bounds.start).toLocaleDateString("pt-BR") : "—"}
          {" → "}
          {bounds.end ? new Date(bounds.end).toLocaleDateString("pt-BR") : "hoje"}
        </span>
        {ownerId && (
          <>
            {" · "}
            Vendedora:{" "}
            <span className="font-medium text-foreground">
              {(owners ?? []).find((o) => o.owner_id === ownerId)?.owner_name ?? "—"}
            </span>
          </>
        )}
      </div>

      {/* 1. Macro */}
      <section aria-labelledby="kpis-macro" className="space-y-2">
        <h2 id="kpis-macro" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Visão macro
        </h2>
        <OverviewBlock period={period} ownerId={ownerId} />
      </section>

      {/* 2. Tempo em etapa + 3. Performance */}
      <section className="grid gap-4 lg:grid-cols-2">
        <TimeInStageBlock period={period} ownerId={ownerId} />
        <LostReasonsBlock period={period} ownerId={ownerId} />
      </section>

      {/* 4. Owner table */}
      <section aria-labelledby="kpis-owners">
        <h2 id="kpis-owners" className="sr-only">Performance por vendedora</h2>
        <OwnerTableBlock period={period} onSelectOwner={(id) => setOwnerId(id)} />
      </section>

      {/* 5. Segments */}
      <section aria-labelledby="kpis-segments">
        <h2 id="kpis-segments" className="sr-only">Conversão por segmento</h2>
        <SegmentBlock period={period} ownerId={ownerId} />
      </section>

      {/* 6. Cohorts */}
      <section aria-labelledby="kpis-cohorts">
        <h2 id="kpis-cohorts" className="sr-only">Coortes mensais</h2>
        <CohortBlock period={period} ownerId={ownerId} />
      </section>
    </div>
  );
}
