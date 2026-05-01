/**
 * ComercialHome — workspace tático do consultor (papel "comercial").
 *
 * Redesign enterprise operacional (Atlassian/Stripe-like).
 *
 * 4 zonas:
 *   1. HERO + META — saudação, contexto, meta do mês integrada.
 *   2. INBOX DE VENDAS — 4 filas com próxima ação evidente.
 *   3. PIPELINE PRIORIZADO + TOP RISCO + AGENDA — coluna principal e
 *      side-rail com ações urgentes.
 *   4. KPIs DO CONSULTOR + TIMELINE — métricas pessoais e atividade.
 *
 * Preserva 100% dos hooks (useComercialQueues, useSalesOverview), queries
 * e ações já existentes. Apenas refatora apresentação.
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Inbox,
  EyeOff,
  Snowflake,
  Sparkles,
  Clock3,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  FileSignature,
  Send,
  
  TrendingUp,
  Activity,
  ListChecks,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { EditableMetaCard } from "@/components/dashboard/EditableMetaCard";
import { FilaCard } from "@/components/dashboard/FilaCard";
import { TimelineItem } from "@/components/dashboard/TimelineItem";
import { Surface } from "@/components/dashboard/Surface";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusChip } from "@/components/dashboard/StatusChip";
import { EmptyState } from "@/components/dashboard/EmptyState";

import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useComercialQueues, nextActionForDeal, type DealRow } from "@/hooks/useComercialQueues";
import { useSalesOverview, formatCurrencyBRL, formatDays, formatPct, stageLabel } from "@/hooks/useSalesKpis";

const SECTION_DELAY = 0.06;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

const DEFAULT_MONTHLY_TARGET_BRL = 250_000;

export default function ComercialHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const ownerId = isAdmin ? null : user?.id ?? null;

  const queues = useComercialQueues(ownerId);
  const overview = useSalesOverview({ range: "30d" }, ownerId);

  const monthRange = useMemo(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: now.toISOString(),
    };
  }, []);
  const overviewMTD = useSalesOverview(
    { range: "custom", startDate: monthRange.startDate, endDate: monthRange.endDate },
    ownerId,
  );

  const [pipelineView, setPipelineView] = useState<"lista" | "kanban">("lista");

  const data = queues.data;
  const isLoading = queues.isLoading;

  const criticalCount =
    (data?.semVisualizacao48h.length ?? 0) +
    (data?.esfriando.length ?? 0) +
    (data?.prontosParaEnviar.length ?? 0);

  const subtitle = isLoading
    ? "Carregando suas filas de trabalho..."
    : criticalCount === 0
    ? "Tudo sob controle. Nenhum item exigindo atenção imediata."
    : `${criticalCount} ${criticalCount === 1 ? "negócio precisa" : "negócios precisam"} de ação hoje.`;

  let step = 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-10">
      {/* ───── 1. HERO + META ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <PainelHeader
          subtitle={subtitle}
          actions={
            <Button size="sm" className="gap-1.5 h-9 px-3.5" onClick={() => navigate("/admin/crm")}>
              <Sparkles className="h-3.5 w-3.5" /> Novo lead
            </Button>
          }
          meta={
            <EditableMetaCard
              computedRevenue={overviewMTD.data?.revenue_won ?? 0}
              computedLoading={overviewMTD.isLoading}
              canEdit={isAdmin}
              ownerId={null}
            />
          }
        />
      </motion.div>

      {/* ───── 2. INBOX DE VENDAS — 4 FILAS ───── */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow={criticalCount > 0 ? "Ação imediata" : "Hoje"}
          tone={criticalCount > 0 ? "warn" : "neutral"}
          icon={Inbox}
          title="Inbox de vendas"
          description="Suas 4 filas de trabalho. Cada cartão tem a próxima ação concreta."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <FilaCard
            icon={Send}
            label="Prontos para enviar"
            count={data?.prontosParaEnviar.length ?? 0}
            description="Entregues pelo orçamentista, ainda não enviados ao cliente."
            priority={data && data.prontosParaEnviar.length > 0 ? "info" : "ok"}
            actionLabel="Abrir e enviar"
            onAction={() => navigate("/admin/comercial?fila=prontos")}
            loading={isLoading}
          />
          <FilaCard
            icon={EyeOff}
            label="Sem visualização >48h"
            count={data?.semVisualizacao48h.length ?? 0}
            description="Enviados há mais de 48h sem nenhuma abertura. Cobre."
            priority={data && data.semVisualizacao48h.length > 0 ? "warning" : "ok"}
            actionLabel="Cobrar abertura"
            onAction={() => navigate("/admin/comercial?fila=sem-vis")}
            loading={isLoading}
          />
          <FilaCard
            icon={Snowflake}
            label="Esfriando"
            count={data?.esfriando.length ?? 0}
            description="Negócios parados além do tempo máximo da etapa. Reaqueça."
            priority={
              data && data.esfriando.length >= 3
                ? "critical"
                : data && data.esfriando.length > 0
                ? "warning"
                : "ok"
            }
            actionLabel="Reativar agora"
            onAction={() => navigate("/admin/comercial?fila=esfriando")}
            loading={isLoading}
          />
          <FilaCard
            icon={Inbox}
            label="Leads novos"
            count={data?.novosLeads.length ?? 0}
            description="Atribuídos a você nas últimas 48h. Faça o primeiro contato."
            priority={data && data.novosLeads.length > 0 ? "info" : "ok"}
            actionLabel="Atender agora"
            onAction={() => navigate("/admin/leads")}
            loading={isLoading}
          />
        </div>
      </motion.section>

      {/* ───── 3. PIPELINE + TOP RISCO + AGENDA ───── */}
      <motion.section {...anim(step++ * SECTION_DELAY)} className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* Pipeline priorizado */}
        <Surface variant="raised" padding="md" className="lg:col-span-2">
          <SectionHeader
            eyebrow="Pipeline"
            icon={ListChecks}
            title="Negócios priorizados"
            description="Agrupados por etapa, ordenados por urgência."
            count={data?.totalAtivos ?? null}
            actions={
              <Tabs value={pipelineView} onValueChange={(v) => setPipelineView(v as "lista" | "kanban")}>
                <TabsList className="h-8 bg-neutral-bg">
                  <TabsTrigger value="lista" className="text-xs h-6 px-3">
                    Lista
                  </TabsTrigger>
                  <TabsTrigger value="kanban" className="text-xs h-6 px-3">
                    Kanban
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            }
          />
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : !data || data.pipelinePorEtapa.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Pipeline vazio"
              description="Nenhum negócio ativo. Comece criando um lead ou atendendo a um existente."
              size="sm"
            />
          ) : pipelineView === "lista" ? (
            <div className="space-y-5">
              {data.pipelinePorEtapa.map((group) => (
                <div key={group.stage}>
                  <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-hairline/60">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body">
                      {stageLabel(group.stage)}
                    </span>
                    <StatusChip tone="neutral" size="sm" dot={false}>
                      {group.deals.length}
                    </StatusChip>
                  </div>
                  <div className="space-y-0.5">
                    {group.deals.slice(0, 5).map((d) => (
                      <DealRowItem key={d.id} deal={d} onClick={() => navigate(`/admin/budget/${d.id}`)} />
                    ))}
                    {group.deals.length > 5 && (
                      <button
                        onClick={() => navigate(`/admin/comercial?stage=${group.stage}`)}
                        className="text-[12px] font-body text-ink-soft hover:text-info py-1.5 transition-colors"
                      >
                        Ver mais {group.deals.length - 5} →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {data.pipelinePorEtapa.map((group) => (
                <div
                  key={group.stage}
                  className="rounded-lg border border-hairline/60 bg-neutral-bg/40 p-3 flex flex-col min-h-[200px]"
                >
                  <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-hairline/60">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body truncate">
                      {stageLabel(group.stage)}
                    </span>
                    <StatusChip tone="neutral" size="sm" dot={false}>
                      {group.deals.length}
                    </StatusChip>
                  </div>
                  <div className="space-y-1.5 flex-1">
                    {group.deals.slice(0, 6).map((d) => (
                      <button
                        key={d.id}
                        onClick={() => navigate(`/admin/budget/${d.id}`)}
                        className="w-full text-left rounded-md border border-hairline/50 bg-surface-1 hover:bg-surface-2 hover:border-hairline transition-colors p-2.5"
                      >
                        <div className="flex items-baseline justify-between gap-2 mb-1">
                          <p className="text-[12.5px] font-body font-semibold text-ink-strong truncate">
                            {d.client_name}
                          </p>
                          <span className="text-[11.5px] font-mono text-ink-medium tabular-nums shrink-0">
                            {formatCurrencyBRL(d.total_value ?? 0)}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-soft font-body truncate">
                          → {nextActionForDeal(d)}
                        </p>
                      </button>
                    ))}
                    {group.deals.length === 0 && (
                      <p className="text-[11.5px] text-ink-soft font-body italic py-2">
                        Sem negócios nesta etapa.
                      </p>
                    )}
                    {group.deals.length > 6 && (
                      <button
                        onClick={() => navigate(`/admin/comercial?stage=${group.stage}`)}
                        className="text-[11.5px] font-body text-ink-soft hover:text-info py-1 transition-colors"
                      >
                        Ver mais {group.deals.length - 6} →
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        {/* Side-rail */}
        <div className="space-y-4 lg:space-y-5">
          {/* Top 5 risco */}
          <Surface variant="raised" padding="md">
            <SectionHeader
              eyebrow="Risco"
              tone="danger"
              icon={AlertTriangle}
              title="Top 5 em risco"
              description="Maior valor parado por mais tempo."
              className="mb-3"
            />
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)}
              </div>
            ) : !data || data.topRisco.length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title="Nenhum risco"
                description="Operação saudável."
                size="sm"
              />
            ) : (
              <ul className="space-y-0.5 -mx-2">
                {data.topRisco.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => navigate(`/admin/budget/${d.id}`)}
                      className="w-full text-left px-2 py-2 rounded-md hover:bg-surface-2 transition-colors group"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[13px] font-body font-semibold text-ink-strong truncate">
                          {d.client_name}
                        </p>
                        <span className="text-[12px] font-mono text-danger tabular-nums shrink-0">
                          {formatCurrencyBRL(d.total_value ?? 0)}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-ink-medium font-body truncate mt-0.5">
                        → {nextActionForDeal(d)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Surface>

          {/* Agenda do dia */}
          <Surface variant="raised" padding="md">
            <SectionHeader
              eyebrow="Hoje"
              icon={Calendar}
              title="Agenda do dia"
              description="Compromissos e follow-ups programados."
              className="mb-3"
            />
            <EmptyState
              icon={Calendar}
              title="Nada programado"
              description="Sem compromissos para hoje. Use a agenda completa para marcar reuniões."
              size="sm"
              action={
                <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate("/admin/agenda")}>
                  Abrir agenda
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              }
            />
          </Surface>
        </div>
      </motion.section>

      {/* ───── 4. KPIs + TIMELINE ───── */}
      <motion.section {...anim(step++ * SECTION_DELAY)} className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
        {/* KPIs do consultor */}
        <Surface variant="raised" padding="md" className="lg:col-span-2">
          <SectionHeader
            eyebrow="Performance · 30 dias"
            icon={TrendingUp}
            title="Seus indicadores"
            description="Métricas pessoais — comparáveis ao restante da equipe."
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6">
            <KpiBlock
              label="Conversão"
              value={overview.isLoading ? "—" : formatPct(overview.data?.win_rate_pct)}
              subtitle={overview.isLoading ? "" : `${overview.data?.deals_won ?? 0} fechados`}
              loading={overview.isLoading}
            />
            <KpiBlock
              label="Ciclo médio"
              value={overview.isLoading ? "—" : formatDays(overview.data?.avg_cycle_days)}
              subtitle="Lead → fechamento"
              loading={overview.isLoading}
            />
            <KpiBlock
              label="Ticket médio"
              value={overview.isLoading ? "—" : formatCurrencyBRL(overview.data?.avg_deal_size_won ?? null)}
              subtitle="Contratos fechados"
              loading={overview.isLoading}
            />
            <KpiBlock
              label="Pipeline aberto"
              value={overview.isLoading ? "—" : formatCurrencyBRL(overview.data?.pipeline_open_value)}
              subtitle={overview.isLoading ? "" : `${overview.data?.deals_open ?? 0} negócios`}
              loading={overview.isLoading}
            />
          </div>
        </Surface>

        {/* Timeline */}
        <Surface variant="raised" padding="md">
          <SectionHeader
            eyebrow="Atividade"
            icon={Activity}
            title="Mudou desde ontem"
            description="O que se moveu nas suas filas."
            className="mb-3"
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-9 w-full rounded-md" />)}
            </div>
          ) : (
            <div className="space-y-0.5 -mx-2">
              {data?.prontosParaEnviar.slice(0, 2).map((d) => (
                <TimelineItem
                  key={`r-${d.id}`}
                  type="sent"
                  icon={FileSignature}
                  title={`Pronto: ${d.client_name}`}
                  meta={d.project_name}
                  time={shortTime(d.updated_at)}
                />
              ))}
              {data?.semVisualizacao48h.slice(0, 2).map((d) => (
                <TimelineItem
                  key={`v-${d.id}`}
                  type="stalled"
                  icon={Clock3}
                  title={`Sem abertura: ${d.client_name}`}
                  meta="Cobrar visualização"
                  time={shortTime(d.generated_at || d.updated_at)}
                />
              ))}
              {data?.esfriando.slice(0, 2).map((d) => (
                <TimelineItem
                  key={`e-${d.id}`}
                  type="stalled"
                  icon={Snowflake}
                  title={`Esfriando: ${d.client_name}`}
                  meta={stageLabel(d.internal_status)}
                  time={shortTime(d.updated_at)}
                />
              ))}
              {data &&
                data.prontosParaEnviar.length === 0 &&
                data.semVisualizacao48h.length === 0 &&
                data.esfriando.length === 0 && (
                  <EmptyState
                    icon={Activity}
                    title="Sem mudanças"
                    description="Nenhum movimento relevante nas últimas 24h."
                    size="sm"
                  />
                )}
            </div>
          )}
        </Surface>
      </motion.section>
    </div>
  );
}

/* ───────────── Subcomponentes locais ───────────── */

function KpiBlock({
  label,
  value,
  subtitle,
  loading,
}: {
  label: string;
  value: string;
  subtitle?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-7 w-20" />
        <Skeleton className="h-3 w-16" />
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body mb-1.5">
        {label}
      </p>
      <p className="text-[24px] font-mono font-semibold tabular-nums text-ink-strong leading-none">
        {value}
      </p>
      {subtitle && <p className="text-[11.5px] text-ink-medium font-body mt-1.5 leading-snug">{subtitle}</p>}
    </div>
  );
}

function DealRowItem({ deal, onClick }: { deal: DealRow; onClick: () => void }) {
  const action = nextActionForDeal(deal);
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-2.5 py-2 -mx-2 rounded-md hover:bg-surface-2 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[13px] font-body font-semibold text-ink-strong truncate">
            {deal.client_name}
          </p>
          <span className="text-[12px] font-mono tabular-nums text-ink-medium shrink-0">
            {formatCurrencyBRL(deal.total_value ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[11.5px] text-ink-medium font-body mt-0.5">
          <span className="text-info font-medium">→ {action}</span>
          <span className="text-ink-faint">·</span>
          <span className="truncate">{deal.project_name}</span>
        </div>
      </div>
      <ArrowUpRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-info group-hover:translate-x-0.5 transition-all shrink-0" />
    </button>
  );
}

function shortTime(d: string | null | undefined): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  const min = ms / 60_000;
  if (min < 60) return `${Math.round(min)}min`;
  const h = min / 60;
  if (h < 24) return `${Math.round(h)}h`;
  const days = h / 24;
  if (days < 7) return `${Math.round(days)}d`;
  return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
