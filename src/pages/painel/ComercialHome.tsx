/**
 * ComercialHome — home do consultor comercial (papel ativo "comercial").
 *
 * Foco: o que o vendedor precisa fazer AGORA, no nível individual.
 *
 * Layout em 4 zonas (skill god-mode):
 *   1. HEADER DE BATALHA — saudação + meta do mês com marker de ritmo.
 *   2. INBOX DE VENDAS — 4 filas de trabalho com próxima ação direta.
 *   3. PIPELINE PRIORIZADO — agrupado por etapa + Top 5 risco.
 *   4. KPIs COMERCIAIS + TIMELINE — 4 KPIs (sem overload) e linha do
 *      "o que mudou desde ontem".
 */

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Inbox,
  EyeOff,
  Snowflake,
  Sparkles,
  TrendingUp,
  Clock3,
  Wallet,
  Target,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  FileSignature,
  Send,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { MetaProgressBar } from "@/components/dashboard/MetaProgressBar";
import { FilaCard } from "@/components/dashboard/FilaCard";
import { TimelineItem } from "@/components/dashboard/TimelineItem";
import { KpiCardCompact } from "@/components/dashboard/KpiCard";

import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useComercialQueues, nextActionForDeal, type DealRow } from "@/hooks/useComercialQueues";
import { useSalesOverview, formatCurrencyBRL, formatDays, formatPct, stageLabel } from "@/hooks/useSalesKpis";

const SECTION_DELAY = 0.05;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay },
});

// Meta default — TODO: mover para tabela de configuração por consultor.
const DEFAULT_MONTHLY_TARGET_BRL = 250_000;

export default function ComercialHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isAdmin } = useUserProfile();

  // Admin pode opcionalmente ver tudo; consultor sempre vê só os seus.
  const ownerId = isAdmin ? null : user?.id ?? null;

  const queues = useComercialQueues(ownerId);
  const overview = useSalesOverview({ range: "30d" }, ownerId);

  // Lê dado do mês corrente para a meta (a RPC já considera o período).
  const overviewMTD = useSalesOverview(
    {
      range: "custom",
      startDate: useMemo(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      }, []),
      endDate: new Date().toISOString(),
    },
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
    ? "Carregando suas filas..."
    : criticalCount === 0
    ? "Tudo sob controle. Nenhum item exigindo atenção imediata."
    : `${criticalCount} ${criticalCount === 1 ? "item exige" : "itens exigem"} ação hoje.`;

  let step = 0;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ───── 1. HEADER DE BATALHA ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <PainelHeader
          subtitle={subtitle}
          actions={
            <Button size="sm" className="gap-1.5 h-8" onClick={() => navigate("/admin/crm")}> 
              <Sparkles className="h-3.5 w-3.5" /> Novo lead
            </Button>
          }
        />
      </motion.div>

      <motion.div {...anim(step++ * SECTION_DELAY)} className="rounded-xl border border-border bg-card p-4">
        <MetaProgressBar
          current={overviewMTD.data?.revenue_won ?? 0}
          target={DEFAULT_MONTHLY_TARGET_BRL}
          label="Meta do mês"
          format="currency"
          loading={overviewMTD.isLoading}
        />
      </motion.div>

      {/* ───── 2. INBOX DE VENDAS — 4 FILAS ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-3">
          Inbox de vendas
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FilaCard
            icon={Send}
            label="Prontos pra enviar"
            count={data?.prontosParaEnviar.length ?? 0}
            description="Orçamentos entregues pelo orçamentista que ainda não foram para o cliente."
            priority={data && data.prontosParaEnviar.length > 0 ? "info" : "ok"}
            actionLabel="Abrir e enviar"
            onAction={() => navigate("/admin/comercial?fila=prontos")}
            loading={isLoading}
          />
          <FilaCard
            icon={EyeOff}
            label="Sem visualização >48h"
            count={data?.semVisualizacao48h.length ?? 0}
            description="Enviados ao cliente há mais de 48h sem nenhuma abertura. Cobre."
            priority={data && data.semVisualizacao48h.length > 0 ? "warning" : "ok"}
            actionLabel="Cobrar abertura"
            onAction={() => navigate("/admin/comercial?fila=sem-vis")}
            loading={isLoading}
          />
          <FilaCard
            icon={Snowflake}
            label="Esfriando"
            count={data?.esfriando.length ?? 0}
            description="Negócios parados além do tempo máximo da etapa. Reaqueça antes que esfriem."
            priority={data && data.esfriando.length >= 3 ? "critical" : data && data.esfriando.length > 0 ? "warning" : "ok"}
            actionLabel="Pedir minuta"
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
      </motion.div>

      {/* ───── 3. PIPELINE PRIORIZADO + TOP 5 RISCO + AGENDA ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold font-display text-foreground tracking-tight">
              Pipeline priorizado
            </h2>
            <Tabs value={pipelineView} onValueChange={(v) => setPipelineView(v as "lista" | "kanban")}>
              <TabsList className="h-7">
                <TabsTrigger value="lista" className="text-[11px] h-6 px-3">Lista</TabsTrigger>
                <TabsTrigger value="kanban" className="text-[11px] h-6 px-3">Kanban</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data || data.pipelinePorEtapa.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">
              Nenhum negócio ativo no pipeline.
            </p>
          ) : (
            <div className="space-y-4">
              {data.pipelinePorEtapa.map((group) => (
                <div key={group.stage}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/70 font-body">
                      {stageLabel(group.stage)}
                    </span>
                    <Badge variant="outline" className="h-4 px-1.5 text-[9px] font-mono tabular-nums">
                      {group.deals.length}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {group.deals.slice(0, 5).map((d) => (
                      <DealRowItem key={d.id} deal={d} onClick={() => navigate(`/admin/budget/${d.id}`)} />
                    ))}
                    {group.deals.length > 5 && (
                      <button
                        onClick={() => navigate(`/admin/comercial?stage=${group.stage}`)}
                        className="text-[11px] font-body text-muted-foreground hover:text-foreground py-1"
                      >
                        Ver mais {group.deals.length - 5} ↗
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {/* Top 5 risco */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
              <h2 className="text-sm font-semibold font-display text-foreground tracking-tight">
                Top 5 em risco
              </h2>
            </div>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : !data || data.topRisco.length === 0 ? (
              <p className="text-[11px] text-muted-foreground py-2">Nenhum negócio em risco. Operação saudável.</p>
            ) : (
              <ul className="space-y-1">
                {data.topRisco.map((d) => (
                  <li key={d.id}>
                    <button
                      onClick={() => navigate(`/admin/budget/${d.id}`)}
                      className="w-full text-left px-2 py-1.5 -mx-2 rounded-md hover:bg-accent/50 transition-colors group"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-[12px] font-body font-medium text-foreground truncate">
                          {d.client_name}
                        </p>
                        <span className="text-[10px] font-mono text-destructive tabular-nums shrink-0">
                          {formatCurrencyBRL(d.total_value ?? 0)}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground/80 font-body truncate">
                        {nextActionForDeal(d)}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Agenda do dia (placeholder simples — usa AgendaPage para detalhes) */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              <h2 className="text-sm font-semibold font-display text-foreground tracking-tight">
                Agenda de hoje
              </h2>
            </div>
            <p className="text-[11px] text-muted-foreground py-2">
              Visualize compromissos, follow-ups e reuniões em
              <button
                onClick={() => navigate("/admin/agenda")}
                className="ml-1 text-primary hover:underline font-medium"
              >
                Agenda completa ↗
              </button>
            </p>
          </div>
        </div>
      </motion.div>

      {/* ───── 4. KPIs COMERCIAIS + TIMELINE ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-4">
            KPIs do consultor (últimos 30 dias)
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCardCompact
              label="Conversão"
              value={overview.isLoading ? "—" : formatPct(overview.data?.win_rate_pct)}
              subtitle={overview.isLoading ? "" : `${overview.data?.deals_won ?? 0} fechados`}
              loading={overview.isLoading}
            />
            <KpiCardCompact
              label="Ciclo médio"
              value={overview.isLoading ? "—" : formatDays(overview.data?.avg_cycle_days)}
              subtitle="Lead → fechamento"
              loading={overview.isLoading}
            />
            <KpiCardCompact
              label="Ticket médio"
              value={overview.isLoading ? "—" : formatCurrencyBRL(overview.data?.avg_deal_size_won ?? null)}
              subtitle="Contratos fechados"
              loading={overview.isLoading}
            />
            <KpiCardCompact
              label="Pipeline aberto"
              value={overview.isLoading ? "—" : formatCurrencyBRL(overview.data?.pipeline_open_value)}
              subtitle={overview.isLoading ? "" : `${overview.data?.deals_open ?? 0} negócios`}
              loading={overview.isLoading}
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold font-display text-foreground tracking-tight mb-3">
            Mudou desde ontem
          </h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (
            <div className="space-y-1 -mx-2">
              {/* Constrói uma timeline a partir das filas (proxy de "o que mudou"). */}
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
                  meta="Cobrar"
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
              {data && data.prontosParaEnviar.length === 0 && data.semVisualizacao48h.length === 0 && data.esfriando.length === 0 && (
                <p className="text-[11px] text-muted-foreground py-2 px-2">Sem mudanças relevantes.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ───────────── Subcomponentes ───────────── */

function DealRowItem({ deal, onClick }: { deal: DealRow; onClick: () => void }) {
  const action = nextActionForDeal(deal);
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-2 py-1.5 -mx-2 rounded-md hover:bg-accent/50 transition-colors group"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[12px] font-body font-medium text-foreground truncate">
            {deal.client_name}
          </p>
          <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
            {formatCurrencyBRL(deal.total_value ?? 0)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/80 font-body">
          <span className="text-primary font-medium">→ {action}</span>
          <span className="text-muted-foreground/40">·</span>
          <span className="truncate">{deal.project_name}</span>
        </div>
      </div>
      <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}

/** Tempo curto humano (h/d) para timeline. */
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
