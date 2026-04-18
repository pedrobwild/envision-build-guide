import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { BudgetBreakdownPanel } from "@/components/budget/BudgetBreakdownPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CommentQuickTemplates } from "@/components/editor/CommentQuickTemplates";
import { Separator } from "@/components/ui/separator";
import { ModuleCard } from "@/components/demanda/ModuleCard";
import { PipelineProgress, type PipelineStage } from "@/components/demanda/PipelineProgress";
import { LostReasonDialog, type LostReasonPayload } from "@/components/demanda/LostReasonDialog";
import { useBudgetHub } from "@/hooks/useBudgetHub";
import { formatDistanceToNow } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Calendar,
  User,
  Building2,
  Clock,
  FileText,
  ExternalLink,
  Send,
  AlertTriangle,
  PauseCircle,
  Link as LinkIcon,
  Edit3,
  MapPin,
  Ruler,
  RefreshCw,
  CheckCircle2,
  ArrowRightLeft,
  X,
  ChevronRight,
  MessageCircle,
  Image as ImageIcon,
  History,
  XCircle,
  ClipboardList,
  Video,
  Activity,
  Plus,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { BlockingDialog } from "@/components/editor/BlockingDialog";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";
import { BudgetEventsTimeline } from "@/components/admin/BudgetEventsTimeline";
import { formatBRL } from "@/lib/formatBRL";

interface BudgetDetail {
  id: string;
  project_name: string;
  client_name: string;
  client_phone: string | null;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  metragem: string | null;
  condominio: string | null;
  unit: string | null;
  internal_status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  briefing: string | null;
  demand_context: string | null;
  internal_notes: string | null;
  reference_links: string[] | null;
  notes: string | null;
  status: string;
  public_id: string | null;
  sequential_code?: string | null;
  manual_total: number | null;
  estimated_weeks: number | null;
  pipeline_stage: string | null;
  win_probability: number | null;
  expected_close_at: string | null;
  lead_source: string | null;
}

interface EventRow {
  id: string;
  event_type: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  user_id: string | null;
  created_at: string;
}

interface CommentRow {
  id: string;
  body: string;
  user_id: string;
  created_at: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

type ModuleKey =
  | "briefing"
  | "budget"
  | "activities"
  | "meetings"
  | "conversations"
  | "media"
  | "client"
  | "versions"
  | "lost";

const PIPELINE_STAGES: PipelineStage[] = [
  { key: "lead", label: "Lead" },
  { key: "briefing", label: "Briefing" },
  { key: "visita", label: "Visita" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "fechado", label: "Fechado" },
];

function statusToPipelineIndex(status: string): { index: number; isLost: boolean } {
  switch (status) {
    case "mql":
    case "qualificacao":
    case "lead":
    case "novo":
    case "requested":
      return { index: 0, isLost: false };
    case "validacao_briefing":
    case "triage":
    case "assigned":
      return { index: 1, isLost: false };
    case "in_progress":
    case "waiting_info":
    case "ready_for_review":
    case "revision_requested":
      return { index: 2, isLost: false };
    case "delivered_to_sales":
    case "sent_to_client":
      return { index: 3, isLost: false };
    case "minuta_solicitada":
      return { index: 4, isLost: false };
    case "contrato_fechado":
      return { index: 5, isLost: false };
    case "lost":
    case "archived":
      return { index: 5, isLost: true };
    default:
      return { index: 0, isLost: false };
  }
}

export default function BudgetInternalDetail() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [budget, setBudget] = useState<BudgetDetail | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [blockingTarget, setBlockingTarget] = useState<"waiting_info" | null>(null);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ status: string; target_id: string | null } | null>(null);
  const [budgetTotal, setBudgetTotal] = useState<number | null>(null);
  const [itemsCount, setItemsCount] = useState<number>(0);
  const [sectionsCount, setSectionsCount] = useState<number>(0);
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(
    (searchParams.get("module") as ModuleKey) ?? null
  );
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const hub = useBudgetHub(budgetId);

  // Sync activeModule with URL ?module=
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (activeModule) {
      next.set("module", activeModule);
    } else {
      next.delete("module");
    }
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);

  const getProfileName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      return profiles.find((p) => p.id === id)?.full_name || id.slice(0, 8);
    },
    [profiles]
  );

  useEffect(() => {
    if (!budgetId || !user) return;
    let cancelled = false;

    async function loadAllData() {
      setLoading(true);
      const [budgetRes, eventsRes, commentsRes, profilesRes] = await Promise.all([
        supabase
          .from("budgets")
          .select(
            "id, project_name, client_name, client_phone, property_type, city, bairro, metragem, condominio, unit, internal_status, priority, due_at, created_at, updated_at, created_by, commercial_owner_id, estimator_owner_id, briefing, demand_context, internal_notes, reference_links, notes, status, public_id, sequential_code, manual_total, estimated_weeks, pipeline_stage, win_probability, expected_close_at, lead_source"
          )
          .eq("id", budgetId)
          .single(),
        supabase
          .from("budget_events")
          .select("id, event_type, from_status, to_status, note, user_id, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: true }),
        supabase
          .from("budget_comments")
          .select("id, body, user_id, created_at")
          .eq("budget_id", budgetId)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, full_name"),
      ]);

      if (cancelled) return;
      if (budgetRes.error) toast.error(`Erro ao carregar orçamento: ${budgetRes.error.message}`);
      if (eventsRes.error) toast.error(`Erro ao carregar eventos: ${eventsRes.error.message}`);

      if (budgetRes.data) setBudget(budgetRes.data as BudgetDetail);
      if (eventsRes.data) setEvents(eventsRes.data as EventRow[]);
      if (commentsRes.data) setComments(commentsRes.data as CommentRow[]);
      if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
      setLoading(false);

      // Compute total from items
      const { data: secs } = await supabase.from("sections").select("id").eq("budget_id", budgetId);
      const sectionIds = (secs ?? []).map((s) => s.id);
      if (cancelled) return;
      setSectionsCount(sectionIds.length);

      if (sectionIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("items")
          .select("internal_total, internal_unit_price, qty, bdi_percentage")
          .in("section_id", sectionIds);
        if (cancelled) return;
        setItemsCount((itemsData ?? []).length);
        const total = (itemsData ?? []).reduce((acc, it) => {
          const base = it.internal_total ?? (Number(it.internal_unit_price ?? 0) * Number(it.qty ?? 0));
          const bdi = 1 + Number(it.bdi_percentage ?? 0) / 100;
          return acc + base * bdi;
        }, 0);
        setBudgetTotal(total);
      } else {
        setItemsCount(0);
        setBudgetTotal(0);
      }
    }

    loadAllData();
    return () => { cancelled = true; };
  }, [budgetId, user]);

  // Fetch sync status for this budget
  useEffect(() => {
    if (!budgetId) return;
    supabase
      .from("integration_sync_log")
      .select("sync_status, target_id")
      .eq("source_system", "envision")
      .eq("entity_type", "project")
      .eq("source_id", budgetId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSyncStatus({ status: data.sync_status, target_id: data.target_id });
      });
  }, [budgetId]);

  async function handleManualSync() {
    if (!budgetId) return;
    setSyncing(true);
    try {
      const res = await supabase.functions.invoke("sync-project-outbound", {
        body: { budget_id: budgetId },
      });
      if (res.error) throw new Error(res.error.message);
      const data = res.data;
      if (data?.status === "success") {
        toast.success("Projeto sincronizado com o Portal!");
        setSyncStatus({ status: "success", target_id: data.project_id });
      } else if (data?.message) {
        toast.info(data.message);
      } else {
        toast.error(data?.error ?? "Erro desconhecido ao sincronizar");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      toast.error(`Erro ao sincronizar: ${msg}`);
    } finally {
      setSyncing(false);
    }
  }

  async function changeStatus(newStatus: InternalStatus, note?: string) {
    if (!budget || !user) return;
    const oldStatus = budget.internal_status;

    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", budget.id);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    await supabase.from("budget_events").insert({
      budget_id: budget.id,
      user_id: user.id,
      event_type: "status_change",
      from_status: oldStatus,
      to_status: newStatus,
      note: note || null,
    });

    if (note) {
      const commentBody = `[${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}] ${note}`;
      await supabase.from("budget_comments").insert({
        budget_id: budget.id,
        user_id: user.id,
        body: commentBody,
      });
      setComments((prev) => [
        ...prev,
        { id: crypto.randomUUID(), body: commentBody, user_id: user.id, created_at: new Date().toISOString() },
      ]);
    }

    setBudget((prev) => prev ? { ...prev, internal_status: newStatus } : prev);
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        event_type: "status_change",
        from_status: oldStatus,
        to_status: newStatus,
        note: note || null,
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);

    toast.success(`Status → ${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}`);
  }

  async function handleBlockingConfirm(status: InternalStatus, note: string) {
    await changeStatus(status, note);
    setBlockingTarget(null);
  }

  async function addComment() {
    if (!newComment.trim() || !budget || !user) return;
    setSubmitting(true);

    const { error } = await supabase.from("budget_comments").insert({
      budget_id: budget.id,
      user_id: user.id,
      body: newComment.trim(),
    });

    if (error) {
      toast.error("Erro ao salvar comentário.");
      setSubmitting(false);
      return;
    }

    await supabase.from("budget_events").insert({
      budget_id: budget.id,
      user_id: user.id,
      event_type: "comment",
      note: newComment.trim().slice(0, 200),
    });

    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        body: newComment.trim(),
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
    setEvents((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        event_type: "comment",
        from_status: null,
        to_status: null,
        note: newComment.trim().slice(0, 200),
        user_id: user.id,
        created_at: new Date().toISOString(),
      },
    ]);
    setNewComment("");
    setSubmitting(false);
    toast.success("Comentário adicionado.");
  }

  async function handleMarkLost(payload: LostReasonPayload) {
    if (!budget || !user) return;

    const { error: lostErr } = await supabase
      .from("budget_lost_reasons")
      .upsert(
        {
          budget_id: budget.id,
          reason_category: payload.reason_category,
          reason_detail: payload.reason_detail || null,
          competitor_name: payload.competitor_name ?? null,
          competitor_value: payload.competitor_value ?? null,
          created_by: user.id,
          lost_at: new Date().toISOString(),
        },
        { onConflict: "budget_id" }
      );

    if (lostErr) {
      toast.error(`Erro ao registrar motivo: ${lostErr.message}`);
      return;
    }

    const categoryLabels: Record<string, string> = {
      preco: "Preço",
      escopo: "Escopo",
      concorrente: "Concorrente",
      timing: "Timing",
      sem_retorno: "Sem retorno",
      desistencia: "Desistência",
      outro: "Outro",
    };
    const noteParts = [`Motivo: ${categoryLabels[payload.reason_category]}`];
    if (payload.competitor_name) noteParts.push(`Concorrente: ${payload.competitor_name}`);
    if (payload.competitor_value) noteParts.push(`Valor concorrência: ${formatBRL(payload.competitor_value)}`);
    if (payload.reason_detail) noteParts.push(payload.reason_detail);

    await changeStatus("lost", noteParts.join(" · "));
    toast.success("Negócio marcado como perdido.");
  }

  const pipeline = useMemo(
    () => statusToPipelineIndex(budget?.internal_status ?? "novo"),
    [budget?.internal_status]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground font-body">Demanda não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    );
  }

  const status = INTERNAL_STATUSES[budget.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
  const prio = PRIORITIES[budget.priority as Priority] ?? PRIORITIES.normal;
  const dueDate = budget.due_at ? new Date(budget.due_at) : null;
  const daysLeft = dueDate ? differenceInCalendarDays(dueDate, new Date()) : null;
  const overdue = dueDate ? isPast(dueDate) && !isToday(dueDate) : false;
  const dueToday = dueDate ? isToday(dueDate) : false;
  const links = (budget.reference_links ?? []).filter((l: unknown) => typeof l === "string" && (l as string).trim());

  const totalDisplay = budget.manual_total ?? budgetTotal ?? 0;
  const locationParts = [budget.bairro, budget.city].filter(Boolean).join(", ");
  const subtitle = [
    budget.condominio,
    budget.unit && `Unidade ${budget.unit}`,
    locationParts,
    budget.metragem && `${budget.metragem}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Probabilidade derivada (heurística simples baseada em estágio)
  const probability = Math.min(95, Math.max(10, pipeline.index * 18 + (pipeline.isLost ? 0 : 10)));

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground font-body min-w-0">
              <button onClick={() => navigate("/admin/comercial")} className="hover:text-foreground transition-colors">
                Comercial
              </button>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <button onClick={() => navigate("/admin/demandas")} className="hover:text-foreground transition-colors">
                Pipeline
              </button>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="text-foreground font-medium font-mono truncate">
                {budget.sequential_code ?? budget.id.slice(0, 8)}
              </span>
            </nav>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => commentTextareaRef.current?.focus()}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Nova nota</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/admin/budget/${budget.id}`)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar orçamento</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Pending action banner */}
      {budget.internal_status === "waiting_info" && (
        <div className="border-b px-4 sm:px-6 py-3 bg-warning/5 border-warning/20">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <PauseCircle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-sm font-body font-medium flex-1 text-warning">
              Aguardando informação. Verifique as notas internas para detalhes.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs shrink-0"
              onClick={() => changeStatus("in_progress")}
            >
              Retomar produção
            </Button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* HERO */}
        <section className="rounded-2xl border bg-card p-5 sm:p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                {budget.sequential_code && (
                  <span className="text-[11px] font-mono text-muted-foreground/70">{budget.sequential_code}</span>
                )}
                <Badge variant="secondary" className="text-[10px] font-body uppercase tracking-wide">
                  {status.label}
                </Badge>
                <Badge variant="outline" className={`${prio.color} text-[10px] font-body`}>
                  {prio.label}
                </Badge>
                {dueDate && (
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-medium font-body px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                      overdue
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : dueToday
                        ? "bg-warning/10 text-warning border-warning/20"
                        : daysLeft !== null && daysLeft <= 2
                        ? "bg-warning/5 text-warning border-warning/20"
                        : "text-muted-foreground border-border"
                    }`}
                  >
                    <Calendar className="h-3 w-3" />
                    {overdue
                      ? `SLA -${Math.abs(daysLeft!)}d`
                      : dueToday
                      ? "Vence hoje"
                      : `${format(dueDate, "dd MMM", { locale: ptBR })}`}
                  </span>
                )}
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight leading-tight text-foreground">
                {budget.project_name} · {budget.client_name}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground font-body mt-1">{subtitle}</p>
              )}
            </div>

            {/* Quick status change */}
            <Select
              value={budget.internal_status}
              onValueChange={(v) => {
                const s = v as InternalStatus;
                if (s === "waiting_info") {
                  setBlockingTarget(s);
                } else {
                  changeStatus(s);
                }
              }}
            >
              <SelectTrigger className="h-8 w-auto text-xs gap-1 border-dashed shrink-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INTERNAL_STATUSES).map(([key, { label, icon }]) => (
                  <SelectItem key={key} value={key}>
                    {icon} {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pipeline */}
          <div className="mt-6">
            <PipelineProgress stages={PIPELINE_STAGES} currentIndex={pipeline.index} isLost={pipeline.isLost} />
          </div>

          {/* KPIs */}
          <div className="border-t border-border/60 mt-6 pt-5 grid grid-cols-2 md:grid-cols-4 gap-5">
            <KpiBlock
              label="Valor"
              value={formatBRL(totalDisplay)}
              sub={budget.estimated_weeks ? `${budget.estimated_weeks} semanas` : `${itemsCount} itens · ${sectionsCount} seções`}
            />
            <KpiBlock
              label="Probabilidade"
              value={`${probability}%`}
              progress={probability}
              tone={pipeline.isLost ? "destructive" : "primary"}
            />
            <KpiBlock
              label="Previsão"
              value={dueDate ? format(dueDate, "dd MMM", { locale: ptBR }) : "—"}
              sub={
                dueDate
                  ? overdue
                    ? `SLA vencido há ${Math.abs(daysLeft!)}d`
                    : dueToday
                    ? "Vence hoje"
                    : `em ${daysLeft}d`
                  : "Sem prazo definido"
              }
              subTone={overdue ? "destructive" : dueToday ? "warning" : "muted"}
            />
            <KpiBlock
              label="Responsáveis"
              value=""
              custom={
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex items-center -space-x-2">
                    <Avatar name={getProfileName(budget.commercial_owner_id)} tone="rose" />
                    <Avatar name={getProfileName(budget.estimator_owner_id)} tone="amber" />
                    {budget.created_by && budget.created_by !== budget.commercial_owner_id && (
                      <Avatar name={getProfileName(budget.created_by)} tone="emerald" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground font-body truncate">
                    {getProfileName(budget.commercial_owner_id).split(" ")[0]}
                  </span>
                </div>
              }
            />
          </div>
        </section>

        {/* MODULES HEADER */}
        <div className="flex items-center justify-between mb-3 mt-8">
          <h2 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
            Módulos
          </h2>
          {budget.updated_at && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Atualizado {format(new Date(budget.updated_at), "dd/MM HH:mm")}
            </span>
          )}
        </div>

        {/* MODULES GRID */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <ModuleCard
            icon={FileText}
            title="Briefing & Contexto"
            description={budget.briefing || budget.demand_context || "Sem briefing cadastrado ainda."}
            meta={links.length > 0 ? `${links.length} ${links.length === 1 ? "link" : "links"}` : undefined}
            active={activeModule === "briefing"}
            onClick={() => setActiveModule(activeModule === "briefing" ? null : "briefing")}
          />
          <ModuleCard
            icon={ClipboardList}
            title="Orçamento"
            description={`${sectionsCount} seções · ${itemsCount} itens · ${formatBRL(totalDisplay)}`}
            badge={budget.public_id ? { label: "publicado", tone: "info" } : { label: "rascunho", tone: "neutral" }}
            active={activeModule === "budget"}
            onClick={() => setActiveModule(activeModule === "budget" ? null : "budget")}
          />
          <ModuleCard
            icon={Activity}
            title="Atividades"
            description={`${events.length} eventos · ${comments.length} notas internas`}
            meta={events.length > 0 ? `Última ${format(new Date(events[events.length - 1].created_at), "dd/MM HH:mm")}` : undefined}
            badgeRight={comments.length > 0 ? { label: `${comments.length}`, tone: "neutral" } : undefined}
            active={activeModule === "activities"}
            onClick={() => setActiveModule(activeModule === "activities" ? null : "activities")}
          />
          <ModuleCard
            icon={Video}
            title="Reuniões"
            description="Integração com gravações e transcrições."
            badgeRight={{ label: "Em breve", tone: "info" }}
            disabled
          />
          <ModuleCard
            icon={MessageCircle}
            title="Conversas"
            description="WhatsApp e canais de atendimento."
            badgeRight={{ label: "Em breve", tone: "info" }}
            disabled
          />
          <ModuleCard
            icon={ImageIcon}
            title="Mídias & Projetos"
            description="Vídeos 3D, fotos e PDFs executivos do orçamento."
            onClick={() => navigate(`/admin/budget/${budget.id}`)}
          />
          <ModuleCard
            icon={User}
            title="Cliente"
            description={budget.client_name}
            meta={budget.client_phone ?? undefined}
            active={activeModule === "client"}
            onClick={() => setActiveModule(activeModule === "client" ? null : "client")}
          />
          <ModuleCard
            icon={History}
            title="Versões & PDFs"
            description="Histórico de versões publicadas e em ajuste."
            active={activeModule === "versions"}
            onClick={() => setActiveModule(activeModule === "versions" ? null : "versions")}
          />
          <ModuleCard
            icon={XCircle}
            title="Marcar como perdida"
            description="Registrar motivo estruturado · concorrente, preço, escopo…"
            destructive
            disabled={budget.internal_status === "lost"}
            badgeRight={budget.internal_status === "lost" ? { label: "perdida", tone: "destructive" } : undefined}
            onClick={() => setLostDialogOpen(true)}
          />
        </section>

        {/* DRILL-DOWN PANEL */}
        {activeModule && (
          <section className="mt-8 rounded-2xl border bg-card overflow-hidden">
            <div className="p-5 flex items-center justify-between border-b border-border">
              <div>
                <h3 className="text-base font-display font-semibold text-foreground">
                  {moduleTitles[activeModule]}
                </h3>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  {moduleSubtitles[activeModule]}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setActiveModule(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="p-5">
              {activeModule === "briefing" && (
                <BriefingPanel
                  briefing={budget.briefing}
                  demandContext={budget.demand_context}
                  internalNotes={budget.internal_notes}
                  links={links as string[]}
                />
              )}

              {activeModule === "budget" && <BudgetBreakdownPanel budgetId={budget.id} />}

              {activeModule === "activities" && (
                <div className="space-y-6">
                  <BudgetEventsTimeline events={events} getProfileName={getProfileName} />
                  <Separator />
                  <div>
                    <h4 className="text-sm font-display font-semibold mb-3 flex items-center gap-2">
                      💬 Notas Internas ({comments.length})
                    </h4>
                    <div className="space-y-3 mb-4">
                      {comments.length === 0 && (
                        <p className="text-sm text-muted-foreground font-body text-center py-4">
                          Nenhuma nota interna ainda. Adicione a primeira abaixo.
                        </p>
                      )}
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-sm font-medium font-body text-foreground">
                                {getProfileName(c.user_id)}
                              </span>
                              <span className="text-xs text-muted-foreground font-body">
                                {format(new Date(c.created_at), "dd/MM HH:mm")}
                              </span>
                            </div>
                            <p className="text-sm font-body text-foreground whitespace-pre-wrap">{c.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <CommentQuickTemplates value={newComment} onChange={setNewComment} textareaRef={commentTextareaRef} />
                    <div className="flex gap-2 mt-2">
                      <Textarea
                        ref={commentTextareaRef}
                        placeholder="Escreva uma nota interna... (digite / para templates)"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        rows={2}
                        className="flex-1 text-sm"
                        maxLength={2000}
                      />
                      <Button
                        size="icon"
                        disabled={!newComment.trim() || submitting}
                        onClick={addComment}
                        className="shrink-0 self-end"
                      >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeModule === "client" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Cliente & Imóvel
                    </h4>
                    <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Nome" value={budget.client_name} />
                    {budget.client_phone && (
                      <InfoRow icon={<MessageCircle className="h-3.5 w-3.5" />} label="Telefone" value={budget.client_phone} />
                    )}
                    {budget.property_type && (
                      <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Tipo" value={budget.property_type} />
                    )}
                    {locationParts && (
                      <InfoRow icon={<MapPin className="h-3.5 w-3.5" />} label="Local" value={locationParts} />
                    )}
                    {budget.condominio && (
                      <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Condomínio" value={budget.condominio} />
                    )}
                    {budget.unit && (
                      <InfoRow icon={<Building2 className="h-3.5 w-3.5" />} label="Unidade" value={budget.unit} />
                    )}
                    {budget.metragem && (
                      <InfoRow icon={<Ruler className="h-3.5 w-3.5" />} label="Metragem" value={budget.metragem} />
                    )}
                  </div>

                  <div className="space-y-3">
                    <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">
                      Equipe & Datas
                    </h4>
                    <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Comercial" value={getProfileName(budget.commercial_owner_id)} />
                    <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Orçamentista" value={getProfileName(budget.estimator_owner_id)} />
                    <InfoRow icon={<User className="h-3.5 w-3.5" />} label="Criado por" value={getProfileName(budget.created_by)} />
                    {budget.created_at && (
                      <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Criado" value={format(new Date(budget.created_at), "dd/MM/yyyy HH:mm")} />
                    )}
                    {budget.updated_at && (
                      <InfoRow icon={<Clock className="h-3.5 w-3.5" />} label="Atualizado" value={format(new Date(budget.updated_at), "dd/MM/yyyy HH:mm")} />
                    )}
                    {budget.due_at && (
                      <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Prazo" value={format(new Date(budget.due_at), "dd/MM/yyyy")} />
                    )}
                  </div>

                  <div className="md:col-span-2 flex flex-wrap gap-2 pt-2">
                    {budget.public_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => window.open(`/o/${budget.public_id}`, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Ver proposta pública
                      </Button>
                    )}
                    {budget.internal_status === "contrato_fechado" && (
                      <Button
                        variant={syncStatus?.status === "success" ? "outline" : "default"}
                        size="sm"
                        className="gap-2"
                        onClick={handleManualSync}
                        disabled={syncing}
                      >
                        {syncing ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : syncStatus?.status === "success" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : syncStatus?.status === "failed" ? (
                          <RefreshCw className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                        )}
                        {syncing
                          ? "Sincronizando..."
                          : syncStatus?.status === "success"
                          ? "Sincronizado com Portal"
                          : syncStatus?.status === "failed"
                          ? "Re-sincronizar"
                          : "Enviar para Portal"}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {activeModule === "versions" && <VersionHistoryPanel budgetId={budget.id} />}

              {activeModule === "lost" && (
                <div className="max-w-xl">
                  <p className="text-sm text-muted-foreground font-body mb-3">
                    Registre o motivo da perda. Esta nota será adicionada ao histórico e o status mudará para
                    <strong className="text-destructive"> Perdido</strong>.
                  </p>
                  <Textarea
                    placeholder="Ex: Cliente optou por concorrente com prazo menor; preço acima do orçado; mudança de escopo..."
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    rows={4}
                    maxLength={2000}
                  />
                  <div className="flex gap-2 mt-3 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => setActiveModule(null)}>
                      Cancelar
                    </Button>
                    <Button variant="destructive" size="sm" onClick={handleMarkLost} disabled={!lostReason.trim()}>
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                      Marcar como perdida
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Footer meta */}
        <div className="mt-8 flex items-center justify-between text-[11px] text-muted-foreground/70 font-body flex-wrap gap-2">
          <span>
            Criado por {getProfileName(budget.created_by)}
            {budget.created_at && ` em ${format(new Date(budget.created_at), "dd MMM yyyy", { locale: ptBR })}`}
            {budget.updated_at && ` · Última edição ${format(new Date(budget.updated_at), "dd/MM HH:mm")}`}
          </span>
          {links.length > 0 && (
            <div className="flex items-center gap-3">
              {links.slice(0, 3).map((l, i) => (
                <a key={i} href={l as string} target="_blank" rel="noopener noreferrer" className="hover:text-foreground inline-flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" />
                  Ref {i + 1}
                </a>
              ))}
            </div>
          )}
        </div>
      </main>

      <BlockingDialog
        open={!!blockingTarget}
        targetStatus={blockingTarget}
        onConfirm={handleBlockingConfirm}
        onCancel={() => setBlockingTarget(null)}
      />
    </div>
  );
}

const moduleTitles: Record<ModuleKey, string> = {
  briefing: "Briefing & Contexto",
  budget: "Estrutura do Orçamento",
  activities: "Atividades & Notas",
  meetings: "Reuniões",
  conversations: "Conversas",
  media: "Mídias & Projetos",
  client: "Cliente",
  versions: "Versões & PDFs",
  lost: "Marcar como perdida",
};

const moduleSubtitles: Record<ModuleKey, string> = {
  briefing: "Contexto da demanda, observações internas e links de referência.",
  budget: "Seções, itens e composição financeira completa.",
  activities: "Histórico cronológico e notas internas da equipe.",
  meetings: "Gravações e transcrições integradas.",
  conversations: "Mensagens e canais de atendimento.",
  media: "Vídeos 3D, fotos e PDFs do projeto.",
  client: "Informações detalhadas do cliente, imóvel e equipe.",
  versions: "Histórico de versões publicadas.",
  lost: "Registre o motivo estruturado da perda.",
};

function KpiBlock({
  label,
  value,
  sub,
  subTone,
  progress,
  tone,
  custom,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "muted" | "destructive" | "warning";
  progress?: number;
  tone?: "primary" | "destructive";
  custom?: React.ReactNode;
}) {
  const subClass =
    subTone === "destructive"
      ? "text-destructive"
      : subTone === "warning"
      ? "text-warning"
      : "text-muted-foreground/70";
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-body">{label}</div>
      {custom ? (
        custom
      ) : (
        <>
          <div className="text-lg sm:text-xl font-display font-semibold mt-1 truncate text-foreground">{value}</div>
          {progress !== undefined && (
            <div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full ${tone === "destructive" ? "bg-destructive" : "bg-primary"} transition-all`}
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          {sub && <div className={`text-[11px] mt-0.5 font-body ${subClass}`}>{sub}</div>}
        </>
      )}
    </div>
  );
}

function Avatar({ name, tone }: { name: string; tone: "rose" | "amber" | "emerald" }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  const bg =
    tone === "rose"
      ? "bg-rose-500"
      : tone === "amber"
      ? "bg-amber-500"
      : "bg-emerald-500";
  return (
    <span
      className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold text-white border-2 border-card ${bg}`}
      title={name}
    >
      {initials || "—"}
    </span>
  );
}

function BriefingPanel({
  briefing,
  demandContext,
  internalNotes,
  links,
}: {
  briefing: string | null;
  demandContext: string | null;
  internalNotes: string | null;
  links: string[];
}) {
  const hasAny = briefing || demandContext || internalNotes || links.length > 0;
  if (!hasAny) {
    return (
      <div className="py-10 flex flex-col items-center text-center">
        <FileText className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground font-body">
          Nenhum briefing ou instrução cadastrada para esta demanda.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      {briefing && (
        <Section title="Briefing">
          <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">{briefing}</p>
        </Section>
      )}
      {demandContext && (
        <Section title="Contexto da Demanda">
          <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">{demandContext}</p>
        </Section>
      )}
      {internalNotes && (
        <Section title="Observações Internas" tone="warning">
          <p className="text-sm font-body text-foreground whitespace-pre-wrap leading-relaxed">{internalNotes}</p>
        </Section>
      )}
      {links.length > 0 && (
        <Section title="Links de Referência">
          <div className="space-y-1.5">
            {links.map((link, i) => (
              <a
                key={i}
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline font-body truncate"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {link}
              </a>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children, tone }: { title: string; children: React.ReactNode; tone?: "warning" }) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        tone === "warning" ? "border-warning/20 bg-warning/5" : "border-border bg-muted/20"
      }`}
    >
      <h4
        className={`text-[11px] font-display font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5 ${
          tone === "warning" ? "text-warning" : "text-muted-foreground"
        }`}
      >
        {tone === "warning" && <AlertTriangle className="h-3 w-3" />}
        {title}
      </h4>
      {children}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <span className="text-xs text-muted-foreground font-body">{label}</span>
        <p className="text-sm text-foreground font-body truncate">{value}</p>
      </div>
    </div>
  );
}
