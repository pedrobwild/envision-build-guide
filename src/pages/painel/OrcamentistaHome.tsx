/**
 * OrcamentistaHome — cockpit de produção (papel "orcamentista").
 *
 * Refatorada de placeholder para home real, com a mesma linguagem
 * visual das outras (Atlassian/Stripe operacional).
 *
 * 4 zonas:
 *   1. HERO — saudação + carga atual + CTA para o pipeline.
 *   2. INBOX DE PRODUÇÃO — 4 filas (triagem, em produção, SLA risco, info).
 *   3. SLA & FILA DETALHADA — top SLA em risco/estourado + atalhos.
 *   4. ATALHOS DE FERRAMENTAS — pipeline, catálogo, biblioteca, templates.
 */

import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Hammer,
  ArrowRight,
  Inbox,
  Clock3,
  AlertTriangle,
  PauseCircle,
  CheckCircle2,
  Package,
  LayoutTemplate,
  ImagePlus,
  GitBranch,
  ListChecks,
  Zap,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import { PainelHeader } from "@/components/dashboard/PainelHeader";
import { FilaCard } from "@/components/dashboard/FilaCard";
import { Surface } from "@/components/dashboard/Surface";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { StatusChip } from "@/components/dashboard/StatusChip";
import { EmptyState } from "@/components/dashboard/EmptyState";

import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import {
  useOrcamentistaQueues,
  productionStatusLabel,
  nextProductionAction,
  shortTimeUntil,
  type ProductionDealRow,
} from "@/hooks/useOrcamentistaQueues";

const SECTION_DELAY = 0.06;
const anim = (delay: number) => ({
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
});

export default function OrcamentistaHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const ownerId = isAdmin ? null : user?.id ?? null;

  const queues = useOrcamentistaQueues(ownerId);
  const data = queues.data;
  const isLoading = queues.isLoading;

  const slaCritico = (data?.slaEstourado.length ?? 0) + (data?.slaRisco.length ?? 0);
  const subtitle = isLoading
    ? "Carregando sua fila de produção..."
    : data && data.totalAtivos === 0
    ? "Sua fila está vazia. Aproveite para revisar templates ou catálogo."
    : slaCritico > 0
    ? `${slaCritico} ${slaCritico === 1 ? "orçamento com SLA" : "orçamentos com SLA"} em risco hoje.`
    : `${data?.totalAtivos ?? 0} ${data?.totalAtivos === 1 ? "orçamento ativo" : "orçamentos ativos"} na sua carga.`;

  let step = 0;

  return (
    <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8 space-y-8 lg:space-y-10">
      {/* ───── 1. HERO ───── */}
      <motion.div {...anim(step++ * SECTION_DELAY)}>
        <PainelHeader
          subtitle={subtitle}
          actions={
            <Button size="sm" className="gap-1.5 h-9 px-3.5" onClick={() => navigate("/admin/producao")}>
              <Hammer className="h-3.5 w-3.5" /> Pipeline completo
              <ArrowRight className="h-3 w-3" />
            </Button>
          }
          meta={
            <Surface variant="raised" padding="md">
              <CargaSummary data={data} loading={isLoading} />
            </Surface>
          }
        />
      </motion.div>

      {/* ───── 2. INBOX DE PRODUÇÃO ───── */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow={slaCritico > 0 ? "Ação imediata" : "Hoje"}
          tone={slaCritico > 0 ? "danger" : "neutral"}
          icon={Inbox}
          title="Inbox de produção"
          description="Suas filas operacionais, ordenadas por prioridade de execução."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <FilaCard
            icon={Inbox}
            label="Triagem"
            count={data?.triagem.length ?? 0}
            description="Solicitações novas aguardando início. Defina prazo e comece."
            priority={data && data.triagem.length > 0 ? "info" : "ok"}
            actionLabel="Iniciar triagem"
            onAction={() => navigate("/admin/producao?status=pending")}
            loading={isLoading}
          />
          <FilaCard
            icon={Hammer}
            label="Em produção"
            count={data?.emProducao.length ?? 0}
            description="Orçamentos ativos sob sua responsabilidade neste momento."
            priority={data && data.emProducao.length > 6 ? "warning" : "info"}
            actionLabel="Continuar trabalho"
            onAction={() => navigate("/admin/producao?status=in_progress")}
            loading={isLoading}
          />
          <FilaCard
            icon={AlertTriangle}
            label="SLA em risco"
            count={(data?.slaEstourado.length ?? 0) + (data?.slaRisco.length ?? 0)}
            description="Vencendo em até 48h ou já estourados. Priorize agora."
            priority={
              data && data.slaEstourado.length > 0
                ? "critical"
                : data && data.slaRisco.length > 0
                ? "warning"
                : "ok"
            }
            actionLabel="Ver vencimentos"
            onAction={() => navigate("/admin/producao?filter=sla_risk")}
            loading={isLoading}
          />
          <FilaCard
            icon={PauseCircle}
            label="Aguardando info"
            count={data?.aguardandoInfo.length ?? 0}
            description="Bloqueados por retorno do cliente ou comercial. Cobre."
            priority={data && data.aguardandoInfo.length >= 3 ? "warning" : "info"}
            actionLabel="Cobrar retorno"
            onAction={() => navigate("/admin/producao?status=waiting_info")}
            loading={isLoading}
          />
        </div>
      </motion.section>

      {/* ───── 3. SLA EM RISCO + PRONTOS ───── */}
      <motion.section
        {...anim(step++ * SECTION_DELAY)}
        className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5"
      >
        {/* Lista detalhada de SLA */}
        <Surface variant="raised" padding="md" className="lg:col-span-2">
          <SectionHeader
            eyebrow="Vencimentos"
            tone={(data?.slaEstourado.length ?? 0) > 0 ? "danger" : "warn"}
            icon={Clock3}
            title="SLA em risco e estourado"
            description="Os orçamentos mais próximos do prazo (ou já fora dele)."
            count={(data?.slaEstourado.length ?? 0) + (data?.slaRisco.length ?? 0)}
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !data || (data.slaEstourado.length === 0 && data.slaRisco.length === 0) ? (
            <EmptyState
              icon={Sparkles}
              title="SLA em dia"
              description="Nenhum orçamento próximo do prazo. Continue assim."
              size="sm"
            />
          ) : (
            <ul className="space-y-0.5 -mx-2">
              {[...data.slaEstourado, ...data.slaRisco].slice(0, 8).map((d) => (
                <SlaRow key={d.id} deal={d} onClick={() => navigate(`/admin/budget/${d.id}`)} />
              ))}
            </ul>
          )}
        </Surface>

        {/* Prontos para entrega + carga */}
        <Surface variant="raised" padding="md">
          <SectionHeader
            eyebrow="Entrega"
            tone="success"
            icon={CheckCircle2}
            title="Prontos para entregar"
            description="Finalizados aguardando revisão ou envio."
            className="mb-3"
          />
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-11 w-full rounded-md" />)}
            </div>
          ) : !data || data.prontos.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Nada finalizado"
              description="Nenhum orçamento pronto para entrega ainda."
              size="sm"
            />
          ) : (
            <ul className="space-y-0.5 -mx-2">
              {data.prontos.slice(0, 5).map((d) => (
                <button
                  key={d.id}
                  onClick={() => navigate(`/admin/budget/${d.id}`)}
                  className="w-full text-left px-2 py-2 rounded-md hover:bg-surface-2 transition-colors group block"
                >
                  <p className="text-[13px] font-body font-semibold text-ink-strong truncate">
                    {d.client_name}
                  </p>
                  <p className="text-[11.5px] text-ink-medium font-body truncate mt-0.5">
                    {productionStatusLabel(d.internal_status)} · {d.project_name}
                  </p>
                </button>
              ))}
            </ul>
          )}
        </Surface>
      </motion.section>

      {/* ───── 4. ATALHOS DE FERRAMENTAS ───── */}
      <motion.section {...anim(step++ * SECTION_DELAY)}>
        <SectionHeader
          eyebrow="Ferramentas"
          icon={Zap}
          title="Atalhos rápidos"
          description="As ferramentas que você usa todo dia, a um clique."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <ToolShortcut
            icon={GitBranch}
            label="Pipeline de produção"
            description="Veja todos os orçamentos da operação."
            onClick={() => navigate("/admin/producao")}
          />
          <ToolShortcut
            icon={Package}
            label="Catálogo"
            description="Cadastre e mantenha itens, custos e fornecedores."
            onClick={() => navigate("/admin/catalogo")}
          />
          <ToolShortcut
            icon={LayoutTemplate}
            label="Templates"
            description="Gerencie modelos reutilizáveis de orçamento."
            onClick={() => navigate("/admin/templates")}
          />
          <ToolShortcut
            icon={ImagePlus}
            label="Biblioteca de fotos"
            description="Envie e organize a biblioteca visual."
            onClick={() => navigate("/admin/biblioteca-fotos")}
          />
        </div>
      </motion.section>
    </div>
  );
}

/* ───────────── Subcomponentes locais ───────────── */

function CargaSummary({
  data,
  loading,
}: {
  data: ReturnType<typeof useOrcamentistaQueues>["data"];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-[60px] w-full" />;
  }
  const total = data?.totalAtivos ?? 0;
  const slaTotal = (data?.slaEstourado.length ?? 0) + (data?.slaRisco.length ?? 0);
  const slaPct = total > 0 ? Math.round((slaTotal / total) * 100) : 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
      <div className="flex items-center gap-2 mb-2 sm:mb-0">
        <ListChecks className="h-4 w-4 text-info shrink-0" aria-hidden />
        <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body">
          Carga atual
        </span>
      </div>
      <div className="flex items-center gap-6 sm:gap-8 flex-wrap">
        <CargaStat label="Ativos" value={String(total)} tone="neutral" />
        <CargaStat label="Triagem" value={String(data?.triagem.length ?? 0)} tone="neutral" />
        <CargaStat
          label="SLA crítico"
          value={`${slaTotal}`}
          subtitle={total > 0 ? `${slaPct}% da carga` : undefined}
          tone={slaTotal > 0 ? "danger" : "success"}
        />
        <CargaStat
          label="Prontos"
          value={String(data?.prontos.length ?? 0)}
          tone={data && data.prontos.length > 0 ? "success" : "neutral"}
        />
      </div>
    </div>
  );
}

function CargaStat({
  label,
  value,
  subtitle,
  tone,
}: {
  label: string;
  value: string;
  subtitle?: string;
  tone: "neutral" | "success" | "danger";
}) {
  const valueColor =
    tone === "success" ? "text-[hsl(var(--success))]" : tone === "danger" ? "text-danger" : "text-ink-strong";
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-soft font-body mb-1">
        {label}
      </p>
      <p className={`text-[24px] font-mono font-semibold tabular-nums leading-none ${valueColor}`}>
        {value}
      </p>
      {subtitle && <p className="text-[11px] text-ink-medium font-body mt-1">{subtitle}</p>}
    </div>
  );
}

function SlaRow({ deal, onClick }: { deal: ProductionDealRow; onClick: () => void }) {
  const action = nextProductionAction(deal);
  const overdue = deal.due_at ? new Date(deal.due_at).getTime() < Date.now() : false;

  return (
    <li>
      <button
        onClick={onClick}
        className="w-full text-left flex items-center gap-3 px-2.5 py-2 -mx-2 rounded-md hover:bg-surface-2 transition-colors group"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-[13px] font-body font-semibold text-ink-strong truncate">
              {deal.client_name}
            </p>
            <StatusChip tone={overdue ? "danger" : "warn"} size="sm">
              {shortTimeUntil(deal.due_at)}
            </StatusChip>
          </div>
          <div className="flex items-center gap-1.5 text-[11.5px] text-ink-medium font-body mt-0.5">
            <span className={`font-medium ${overdue ? "text-danger" : "text-warn"}`}>
              → {action}
            </span>
            <span className="text-ink-faint">·</span>
            <span className="truncate">{productionStatusLabel(deal.internal_status)}</span>
          </div>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-ink-faint group-hover:text-info group-hover:translate-x-0.5 transition-all shrink-0" />
      </button>
    </li>
  );
}

function ToolShortcut({
  icon: Icon,
  label,
  description,
  onClick,
}: {
  icon: typeof Inbox;
  label: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-hairline bg-surface-1 p-5 shadow-card hover:border-hairline-strong hover:shadow-raised transition-all flex flex-col gap-3"
    >
      <div className="h-9 w-9 rounded-lg flex items-center justify-center bg-info-bg border border-info-border">
        <Icon className="h-[18px] w-[18px] text-info" aria-hidden />
      </div>
      <div className="flex-1">
        <p className="text-[13.5px] font-body font-semibold text-ink-strong leading-tight">{label}</p>
        <p className="text-[12px] text-ink-medium font-body mt-1 leading-snug line-clamp-2">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-[12px] text-info font-body font-medium">
        Abrir
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  );
}
