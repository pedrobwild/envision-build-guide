import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { formatBRL } from "@/lib/formatBRL";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Phone,
  Mail,
  MapPin,
  FileText,
  Image as ImageIcon,
  Link as LinkIcon,
  ExternalLink,
  MessageCircle,
  ArrowRight,
} from "lucide-react";
import { NextBestActionBanner } from "./NextBestActionBanner";
import { CadencePlaybook, CadenceStep } from "./CadencePlaybook";
import { RiskSignalsCard, RiskSignal } from "./RiskSignalsCard";
import { LostReasonBenchmark, LostReasonBenchmarkItem } from "./LostReasonBenchmark";
import { UnifiedActivityPanel } from "@/components/admin/UnifiedActivityPanel";

export interface DemandWorkspaceV2Props {
  budgetId: string;
  budget: {
    id: string;
    project_name: string;
    client_name: string;
    client_phone: string | null;
    lead_email: string | null;
    city: string | null;
    bairro: string | null;
    condominio: string | null;
    unit: string | null;
    metragem: string | null;
    briefing: string | null;
    demand_context: string | null;
    reference_links: string[] | null;
    manual_total: number | null;
    estimated_weeks: number | null;
    internal_status: string;
    public_id: string | null;
    client_id: string | null;
  };
  budgetTotal?: number;
  itemsCount: number;
  sectionsCount: number;
  getProfileName: (id: string | null | undefined) => string;
  onOpenBudgetEditor: () => void;
  onOpenVersionHistory: () => void;
  onOpenMeetings: () => void;
  onOpenConversations: () => void;
  onOpenClient: () => void;
  onOpenBriefing: () => void;
  onMarkLost: () => void;
  onComposeWhatsapp?: () => void;
  onComposeEmail?: () => void;
  riskSignals: RiskSignal[];
  cadenceStage: string;
  cadenceSteps: CadenceStep[];
  lostBenchmark: LostReasonBenchmarkItem[];
  nextBestAction?: {
    title: string;
    rationale: string;
    liftLabel?: string;
    onPrimary?: () => void;
  };
  conversationsPreview?: Array<{
    id: string;
    name: string;
    channel: string;
    preview: string;
    at: string;
    initials: string;
    color: string;
  }>;
  versionsPreview?: Array<{
    label: string;
    status: string;
    at: string;
    current?: boolean;
  }>;
  breakdown?: Array<{ label: string; value: number; pct: number }>;
  hero?: ReactNode;
}

export function DemandWorkspaceV2(props: DemandWorkspaceV2Props) {
  const {
    budgetId,
    budget,
    budgetTotal,
    itemsCount,
    sectionsCount,
    getProfileName,
    onOpenBudgetEditor,
    onOpenVersionHistory,
    onOpenMeetings,
    onOpenConversations,
    onOpenClient,
    onOpenBriefing,
    onMarkLost,
    onComposeWhatsapp,
    onComposeEmail,
    riskSignals,
    cadenceStage,
    cadenceSteps,
    lostBenchmark,
    nextBestAction,
    conversationsPreview = [],
    versionsPreview = [],
    breakdown = [],
    hero,
  } = props;

  const totalDisplay = budget.manual_total ?? budgetTotal ?? 0;
  const links = (budget.reference_links ?? []).filter(
    (l): l is string => typeof l === "string" && l.trim().length > 0
  );

  return (
    <div className="space-y-5">
      {hero}
      {nextBestAction && (
        <NextBestActionBanner
          title={nextBestAction.title}
          rationale={nextBestAction.rationale}
          liftLabel={nextBestAction.liftLabel}
          onPrimary={nextBestAction.onPrimary}
          primaryLabel="Executar"
        />
      )}

      <section className="grid grid-cols-12 gap-5">
        {/* LEFT: cliente + briefing + orçamento resumo */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Cliente
              </h3>
              <button
                className="text-[11px] text-primary font-medium hover:underline"
                onClick={onOpenClient}
              >
                Abrir ficha
              </button>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-[12px] font-semibold">
                {budget.client_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold truncate">{budget.client_name}</div>
                <div className="text-[11.5px] text-muted-foreground truncate">
                  {budget.condominio ?? budget.bairro ?? "Cliente cadastrado"}
                </div>
              </div>
            </div>
            <div className="border-t border-border/60 mt-3 pt-3 space-y-1.5 text-[12px] font-body">
              {budget.client_phone && (
                <div className="flex items-center gap-2 text-foreground">
                  <Phone className="h-3 w-3 text-muted-foreground" />
                  {budget.client_phone}
                </div>
              )}
              {budget.lead_email && (
                <div className="flex items-center gap-2 text-foreground truncate">
                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate">{budget.lead_email}</span>
                </div>
              )}
              {(budget.city || budget.bairro) && (
                <div className="flex items-center gap-2 text-foreground">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  {[budget.bairro, budget.city].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
            {budget.client_id && (
              <div className="mt-3 flex gap-1.5">
                {onComposeWhatsapp && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-[11px] gap-1"
                    onClick={onComposeWhatsapp}
                  >
                    <MessageCircle className="h-3 w-3" />
                    WhatsApp
                  </Button>
                )}
                {onComposeEmail && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 flex-1 text-[11px] gap-1"
                    onClick={onComposeEmail}
                  >
                    <Mail className="h-3 w-3" />
                    E-mail
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Briefing
              </h3>
              <button
                className="text-[11px] text-primary font-medium hover:underline"
                onClick={onOpenBriefing}
              >
                Editar
              </button>
            </div>
            <p className="text-[12.5px] text-foreground/90 leading-relaxed font-body line-clamp-4">
              {budget.briefing || budget.demand_context || "Sem briefing cadastrado ainda."}
            </p>
            {links.length > 0 && (
              <div className="border-t border-border/60 mt-3 pt-3">
                <div className="text-[11px] text-muted-foreground mb-1.5">Links de referência</div>
                <div className="space-y-1.5">
                  {links.slice(0, 3).map((l, i) => (
                    <a
                      key={i}
                      href={l}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[12px] text-foreground/80 hover:text-foreground truncate"
                    >
                      <LinkIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate">{l}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Orçamento
              </h3>
              <Badge variant="secondary" className="text-[10px]">
                {budget.public_id ? "publicado" : "rascunho"}
              </Badge>
            </div>
            <div className="text-[20px] font-semibold">{formatBRL(totalDisplay)}</div>
            <div className="text-[11.5px] text-muted-foreground mt-0.5">
              {sectionsCount} seções · {itemsCount} itens
              {budget.estimated_weeks ? ` · ${budget.estimated_weeks} semanas` : ""}
            </div>
            {breakdown.length > 0 && (
              <div className="border-t border-border/60 mt-3 pt-3 space-y-2">
                {breakdown.map((b) => (
                  <div key={b.label}>
                    <div className="flex items-center justify-between text-[12px] font-body">
                      <span className="text-muted-foreground">{b.label}</span>
                      <span className="font-medium">{formatBRL(b.value)}</span>
                    </div>
                    <div className="h-1 bg-muted rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              className="w-full justify-center mt-4 gap-1.5 text-[12px]"
              size="sm"
              onClick={onOpenBudgetEditor}
            >
              Abrir editor completo
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
            {budget.public_id && (
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-center mt-2 gap-1.5 text-[12px]"
                onClick={() => window.open(`/orcamento/${budget.public_id}`, "_blank")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Ver página pública
              </Button>
            )}
          </div>
        </aside>

        {/* CENTER: timeline unificada */}
        <section className="col-span-12 lg:col-span-6">
          <div className="rounded-xl border bg-card overflow-hidden">
            <UnifiedActivityPanel
              budgetId={budgetId}
              getProfileName={getProfileName}
            />
          </div>
        </section>

        {/* RIGHT: ações + cadência + conversas + versões */}
        <aside className="col-span-12 lg:col-span-3 space-y-4">
          <CadencePlaybook stage={cadenceStage} steps={cadenceSteps} />

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Conversas
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                  <span className="h-1 w-1 rounded-full bg-emerald-500" /> Digisac
                </span>
              </div>
              <button
                className="text-[11px] text-primary font-medium hover:underline"
                onClick={onOpenConversations}
              >
                Abrir
              </button>
            </div>
            {conversationsPreview.length === 0 ? (
              <p className="text-[12px] text-muted-foreground font-body">
                Sem conversas vinculadas ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {conversationsPreview.slice(0, 4).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 cursor-pointer"
                    onClick={onOpenConversations}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold shrink-0"
                      style={{ background: c.color }}
                    >
                      {c.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12.5px] font-medium truncate">
                          {c.name} · {c.channel}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">{c.at}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{c.preview}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Versões & PDFs
              </h3>
              <button
                className="text-[11px] text-primary font-medium hover:underline"
                onClick={onOpenVersionHistory}
              >
                Histórico
              </button>
            </div>
            {versionsPreview.length === 0 ? (
              <p className="text-[12px] text-muted-foreground font-body">
                Sem versões registradas ainda.
              </p>
            ) : (
              <div className="space-y-2">
                {versionsPreview.map((v) => (
                  <div key={v.label} className="flex items-center justify-between text-[12px] font-body">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={v.current ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {v.label}
                      </Badge>
                      <span className="text-muted-foreground">{v.status}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{v.at}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Reuniões
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-300">
                Elephan.ia
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-[12px]"
              onClick={onOpenMeetings}
            >
              <FileText className="h-3.5 w-3.5" />
              Abrir gravações e transcrições
            </Button>
          </div>
        </aside>
      </section>

      {/* Segunda linha: insights comerciais */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <RiskSignalsCard signals={riskSignals} />
        </div>
        <div className="col-span-12 md:col-span-6 lg:col-span-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mídias & Projetos
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 text-[12px]"
              onClick={onOpenBudgetEditor}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              Abrir editor (vídeos, fotos e PDFs)
            </Button>
          </div>
        </div>
        <div className="col-span-12 md:col-span-12 lg:col-span-4">
          <LostReasonBenchmark
            items={lostBenchmark}
            onMarkLost={onMarkLost}
            alreadyLost={budget.internal_status === "lost"}
          />
        </div>
      </section>
    </div>
  );
}
