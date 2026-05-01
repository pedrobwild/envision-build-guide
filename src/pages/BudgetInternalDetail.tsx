import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import { BudgetBreakdownPanel } from "@/components/budget/BudgetBreakdownPanel";
import { CrossPipelineStrip } from "@/components/budget/CrossPipelineStrip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CommentQuickTemplates } from "@/components/editor/CommentQuickTemplates";
import { Separator } from "@/components/ui/separator";
// ModuleCard removido: a página de demanda agora usa DemandSidebarNav
import { PipelineProgress, type PipelineStage } from "@/components/demanda/PipelineProgress";
import { LostReasonDialog, type LostReasonPayload } from "@/components/demanda/LostReasonDialog";
import { useBudgetHub } from "@/hooks/useBudgetHub";
import { MeetingsPanel } from "@/components/demanda/MeetingsPanel";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
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
  Copy,
  RotateCcw,
  FileSpreadsheet,
  FileDown,
} from "lucide-react";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { openPublicBudget } from "@/lib/openPublicBudget";
import { ExportPreviewDialog } from "@/components/budget/ExportPreviewDialog";
import { calculateBudgetTotal } from "@/lib/supabase-helpers";
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
import { RevisionRequestDialog } from "@/components/editor/RevisionRequestDialog";
import { useUserProfile } from "@/hooks/useUserProfile";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";
import { BudgetEventsTimeline } from "@/components/admin/BudgetEventsTimeline";
import { UnifiedActivityPanel } from "@/components/admin/UnifiedActivityPanel";
import { ClientModulePanel } from "@/components/admin/ClientModulePanel";
import { BudgetTasksPanel } from "@/components/admin/BudgetTasksPanel";
import { PrazoExecucaoChip } from "@/components/admin/PrazoExecucaoChip";
import { DemandSidebarNav } from "@/components/demanda/DemandSidebarNav";
import { MODULE_ACTIVITY_CONTEXT } from "@/lib/activity-templates";
import { formatBRL } from "@/lib/formatBRL";

interface BudgetDetail {
  id: string;
  project_name: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  lead_email: string | null;
  lead_name: string | null;
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
  payment_method: string | null;
  payment_installments: number | null;
  prazo_dias_uteis: number | null;
  version_group_id?: string | null;
  is_current_version?: boolean | null;
  version_number?: number | null;
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
  | "unified"
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
  { key: "mql", label: "MQL" },
  { key: "qualificacao", label: "Qualificação" },
  { key: "lead", label: "Lead" },
  { key: "validacao_briefing", label: "Validação de Briefing" },
  { key: "solicitado", label: "Solicitado" },
  { key: "em_elaboracao", label: "Em Elaboração" },
  { key: "entregue", label: "Entregue" },
  { key: "enviado", label: "Enviado ao Cliente" },
  { key: "minuta", label: "Minuta Solicitada" },
  { key: "fechado", label: "Contrato Fechado" },
];

function statusToPipelineIndex(status: string): { index: number; isLost: boolean } {
  switch (status) {
    case "mql":
      return { index: 0, isLost: false };
    case "qualificacao":
      return { index: 1, isLost: false };
    case "lead":
      return { index: 2, isLost: false };
    case "validacao_briefing":
      return { index: 3, isLost: false };
    case "novo":
    case "requested":
      return { index: 4, isLost: false };
    case "triage":
    case "assigned":
    case "in_progress":
    case "waiting_info":
    case "ready_for_review":
    case "revision_requested":
      return { index: 5, isLost: false };
    case "delivered_to_sales":
      return { index: 6, isLost: false };
    case "sent_to_client":
      return { index: 7, isLost: false };
    case "minuta_solicitada":
      return { index: 8, isLost: false };
    case "contrato_fechado":
      return { index: 9, isLost: false };
    case "lost":
    case "archived":
      return { index: 9, isLost: true };
    default:
      return { index: 0, isLost: false };
  }
}

export default function BudgetInternalDetail() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, isComercial } = useUserProfile();
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
  const [clientCode, setClientCode] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<ModuleKey | null>(
    (searchParams.get("module") as ModuleKey) ?? null
  );
  const [lostDialogOpen, setLostDialogOpen] = useState(false);
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const [resolvedBudgetId, setResolvedBudgetId] = useState<string | null>(null);
  const [resolvedSeqCode, setResolvedSeqCode] = useState<string | null>(null);
  // Pré-visualização de export antes do download. Os flags `exportingXlsx`
  // e `exportingPdf` são derivados do estado para preservar o spinner nos
  // botões enquanto o diálogo gera o preview.
  const [previewExport, setPreviewExport] = useState<
    { budgetId: string; kind: "pdf" | "xlsx" } | null
  >(null);
  const exportingXlsx = previewExport?.kind === "xlsx";
  const exportingPdf = previewExport?.kind === "pdf";
  const handleResolvedBudgetId = useCallback(
    (id: string, info: { isCurrent: boolean; versionNumber: number | null; sequentialCode: string | null }) => {
      setResolvedBudgetId(id);
      setResolvedSeqCode(info.sequentialCode);
    },
    []
  );
  const handleExportXlsx = useCallback(() => {
    const id = resolvedBudgetId ?? budgetId;
    if (!id || exportingXlsx) return;
    setPreviewExport({ budgetId: id, kind: "xlsx" });
  }, [resolvedBudgetId, budgetId, exportingXlsx]);
  const handleExportPdf = useCallback(() => {
    const id = resolvedBudgetId ?? budgetId;
    if (!id || exportingPdf) return;
    setPreviewExport({ budgetId: id, kind: "pdf" });
  }, [resolvedBudgetId, budgetId, exportingPdf]);
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
    const id = budgetId;
    let cancelled = false;

    async function loadAllData() {
      setLoading(true);
      const [budgetRes, eventsRes, commentsRes, profilesRes] = await Promise.all([
        supabase
          .from("budgets")
          .select(
            "id, project_name, client_id, client_name, client_phone, lead_email, lead_name, property_type, city, bairro, metragem, condominio, unit, internal_status, priority, due_at, created_at, updated_at, created_by, commercial_owner_id, estimator_owner_id, briefing, demand_context, internal_notes, reference_links, notes, status, public_id, sequential_code, manual_total, estimated_weeks, pipeline_stage, win_probability, expected_close_at, lead_source, payment_method, payment_installments, prazo_dias_uteis, is_current_version, version_group_id, version_number"
          )
          .eq("id", id)
          .single(),
        supabase
          .from("budget_events")
          .select("id, event_type, from_status, to_status, note, user_id, created_at")
          .eq("budget_id", id)
          .order("created_at", { ascending: true }),
        supabase
          .from("budget_comments")
          .select("id, body, user_id, created_at")
          .eq("budget_id", id)
          .order("created_at", { ascending: true }),
        supabase.from("profiles").select("id, full_name"),
      ]);

      if (cancelled) return;
      if (budgetRes.error) toast.error(`Erro ao carregar orçamento: ${budgetRes.error.message}`);
      if (eventsRes.error) toast.error(`Erro ao carregar eventos: ${eventsRes.error.message}`);

      if (budgetRes.data) {
        setBudget(budgetRes.data as BudgetDetail);
        // Busca o código sequencial do cliente vinculado (CLI-XXXX) para vínculo visual com o orçamento (ORC-XXXX)
        const clientId = (budgetRes.data as BudgetDetail).client_id;
        if (clientId) {
          supabase
            .from("clients")
            .select("sequential_code")
            .eq("id", clientId)
            .maybeSingle()
            .then(({ data }) => {
              if (!cancelled) setClientCode(data?.sequential_code ?? null);
            });
        } else {
          setClientCode(null);
        }
      }
      if (eventsRes.data) setEvents(eventsRes.data as EventRow[]);
      if (commentsRes.data) setComments(commentsRes.data as CommentRow[]);
      if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
      setLoading(false);

      // Compute total using the same logic as the public budget view, ensuring
      // the value shown in the deal/client card matches what the client sees.
      // Resolve to the current version of the version_group when needed.
      let effectiveBudgetId = id;
      const baseRow = budgetRes.data as { id: string; is_current_version?: boolean | null } | null;
      const versionGroupId = (budgetRes.data as { version_group_id?: string | null } | null)?.version_group_id ?? null;
      if (baseRow && versionGroupId && baseRow.is_current_version === false) {
        const { data: current } = await supabase
          .from("budgets")
          .select("id")
          .eq("version_group_id", versionGroupId)
          .eq("is_current_version", true)
          .maybeSingle();
        if (current?.id) effectiveBudgetId = current.id;
      }

      const { data: secs } = await supabase
        .from("sections")
        .select("id, section_price, qty, addendum_action")
        .eq("budget_id", effectiveBudgetId)
        .order("order_index", { ascending: true });
      const sectionRows = secs ?? [];
      const sectionIds = sectionRows.map((s) => s.id);
      if (cancelled) return;
      setSectionsCount(sectionIds.length);

      if (sectionIds.length > 0) {
        const [{ data: itemsData }, { data: adjData }] = await Promise.all([
          supabase
            .from("items")
            .select("id, section_id, internal_total, internal_unit_price, qty, bdi_percentage, addendum_action")
            .in("section_id", sectionIds),
          supabase
            .from("adjustments")
            .select("amount, sign")
            .eq("budget_id", effectiveBudgetId),
        ]);
        if (cancelled) return;
        setItemsCount((itemsData ?? []).length);
        const sectionsForCalc = sectionRows.map((s) => ({
          ...s,
          items: (itemsData ?? []).filter((i) => i.section_id === s.id),
        }));
        const total = calculateBudgetTotal(sectionsForCalc as never, (adjData ?? []) as never);
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

  /**
   * Persiste o prazo de execução em dias úteis. É chamado pelo chip do
   * cabeçalho. Faz update otimista no estado local e reverte em caso de erro
   * (assim a orçamentista não fica vendo um valor que não foi salvo).
   */
  async function savePrazoDiasUteis(next: number | null) {
    if (!budget) return;
    const previous = budget.prazo_dias_uteis ?? null;
    if (previous === next) return;
    setBudget((prev) => (prev ? { ...prev, prazo_dias_uteis: next } : prev));
    const { error } = await supabase
      .from("budgets")
      .update({ prazo_dias_uteis: next, updated_at: new Date().toISOString() })
      .eq("id", budget.id);
    if (error) {
      setBudget((prev) => (prev ? { ...prev, prazo_dias_uteis: previous } : prev));
      toast.error("Não foi possível salvar o prazo. Tente novamente.");
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

  // Probabilidade vinda do banco (com fallback heurístico)
  const probability = budget.win_probability ?? Math.min(95, Math.max(10, pipeline.index * 18 + (pipeline.isLost ? 0 : 10)));

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
              <button onClick={() => navigate("/admin/comercial")} className="hover:text-foreground transition-colors">
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
              disabled={!budget.public_id}
              onClick={async () => {
                if (!budget.public_id) return;
                try {
                  await navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id));
                  toast.success("Link copiado");
                } catch {
                  toast.error("Erro ao copiar link");
                }
              }}
              title={budget.public_id ? "Copiar link público" : "Link público sendo gerado..."}
            >
              <Copy className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Copiar link</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!budget.public_id}
              onClick={async () => {
                await openPublicBudget(
                  {
                    id: budget.id,
                    public_id: budget.public_id,
                    status: budget.status,
                    version_group_id: budget.version_group_id,
                  },
                  {
                    onStatusChanged: (newStatus) =>
                      setBudget((prev) => (prev ? { ...prev, status: newStatus } : prev)),
                  },
                );
              }}
              title={
                !budget.public_id
                  ? "Link público sendo gerado..."
                  : budget.status === "published" || budget.status === "minuta_solicitada"
                    ? "Abrir orçamento público"
                    : "Orçamento ainda em rascunho — clique para publicar e abrir"
              }
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">
                {budget.status === "published" || budget.status === "minuta_solicitada"
                  ? "Ver orçamento público"
                  : "Publicar e ver"}
              </span>
            </Button>
            {(isAdmin || isComercial) &&
              [
                "ready_for_review",
                "delivered_to_sales",
                "sent_to_client",
                "minuta_solicitada",
              ].includes(budget.internal_status) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevisionDialogOpen(true)}
                  className="gap-1.5 border-warning/40 text-warning hover:bg-warning/5 hover:text-warning"
                  title="Devolver para o orçamentista revisar"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Solicitar revisão</span>
                </Button>
              )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => commentTextareaRef.current?.focus()}
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden lg:inline">Nova nota</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate(`/admin/budget/${budget.id}`)}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Cross-pipeline context strip — visibilidade do estágio comercial dentro da tela de produção */}
      <CrossPipelineStrip
        internalStatus={budget.internal_status}
        pipelineStage={budget.pipeline_stage}
        winProbability={budget.win_probability}
        expectedCloseAt={budget.expected_close_at}
        totalDisplay={totalDisplay}
        commercialOwnerName={getProfileName(budget.commercial_owner_id)}
        onOpenComercial={() =>
          navigate(`/admin/comercial?budgetId=${budget.id}`)
        }
      />

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
                  <span className="font-mono text-[11px] tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                    {budget.sequential_code}
                  </span>
                )}
                {clientCode && budget.client_id && (
                  <Link
                    to={`/admin/crm/${budget.client_id}`}
                    className="font-mono text-[11px] tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded hover:bg-muted/70 hover:text-foreground transition-colors"
                    title="Abrir cliente vinculado"
                  >
                    {clientCode}
                  </Link>
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
                {/* Prazo de execução — mini-chip na barra de status, casa com Badges. */}
                <PrazoExecucaoChip
                  size="sm"
                  value={budget.prazo_dias_uteis ?? null}
                  onChange={savePrazoDiasUteis}
                />
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-semibold tracking-tight leading-tight text-foreground">
                {budget.project_name} · {budget.client_name}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground font-body mt-1">{subtitle}</p>
              )}
              {/* Prazo de execução — mesmo chip editável do BudgetEditor; salva direto no banco. */}
              <div className="mt-2">
                <PrazoExecucaoChip
                  value={budget.prazo_dias_uteis ?? null}
                  onChange={savePrazoDiasUteis}
                />
              </div>
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
          <div className="border-t border-border/60 mt-6 pt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
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
              label="Comercial"
              value=""
              custom={
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <Avatar name={getProfileName(budget.commercial_owner_id)} tone="rose" />
                  <span className="text-sm font-display font-medium text-foreground truncate">
                    {budget.commercial_owner_id ? getProfileName(budget.commercial_owner_id) : "—"}
                  </span>
                </div>
              }
            />
            <KpiBlock
              label="Orçamentista"
              value=""
              custom={
                <div className="flex items-center gap-2 mt-1.5 min-w-0">
                  <Avatar name={getProfileName(budget.estimator_owner_id)} tone="amber" />
                  <span className="text-sm font-display font-medium text-foreground truncate">
                    {budget.estimator_owner_id ? getProfileName(budget.estimator_owner_id) : "—"}
                  </span>
                </div>
              }
            />
          </div>
        </section>

        {/* SOLICITAÇÃO DE CONTRATO (cliente preencheu o formulário público) */}
        {budget.payment_method && (
          <section className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.08em] font-body font-semibold text-primary/80">
                  Solicitação de contrato
                </p>
                <p className="mt-1 text-sm font-display font-semibold text-foreground">
                  {budget.payment_method === "cartao"
                    ? `Cartão de crédito${budget.payment_installments ? ` em ${budget.payment_installments}× sem juros` : ""}`
                    : "Parcelamento no fluxo da obra"}
                </p>
                {(budget.lead_email || budget.lead_name) && (
                  <p className="mt-0.5 text-xs text-muted-foreground font-body">
                    {[budget.lead_name, budget.lead_email].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
              <span className="text-[10px] uppercase tracking-wide font-body font-semibold px-2 py-1 rounded-md bg-primary/15 text-primary">
                {budget.payment_method === "cartao" ? "Cartão" : "Fluxo da obra"}
              </span>
            </div>
          </section>
        )}

        {/* WORKSPACE: Sidebar de módulos + Painel de ações */}
        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-5">
          {/* Coluna esquerda: lista de botões */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <DemandSidebarNav
              items={[
                {
                  key: "budget",
                  icon: ClipboardList,
                  label: "Orçamento",
                  description: `${sectionsCount} seções · ${itemsCount} itens · ${formatBRL(totalDisplay)}`,
                  badge: budget.public_id
                    ? { label: "publicado", tone: "info" }
                    : { label: "rascunho", tone: "neutral" },
                  active: activeModule === "budget",
                  onClick: () => setActiveModule("budget"),
                },
                {
                  key: "briefing",
                  icon: FileText,
                  label: "Briefing & Contexto",
                  description: budget.briefing || budget.demand_context || "Sem briefing cadastrado.",
                  active: activeModule === "briefing",
                  onClick: () => setActiveModule("briefing"),
                },
                {
                  key: "unified",
                  icon: Activity,
                  label: "Linha do Tempo",
                  description: "Status, notas, reuniões e mensagens cronológicas.",
                  badge: { label: "novo", tone: "success" },
                  active: activeModule === "unified",
                  onClick: () => setActiveModule("unified"),
                },
                {
                  key: "meetings",
                  icon: Video,
                  label: "Reuniões",
                  description: hub.data?.meetingsCount
                    ? `${hub.data.meetingsCount} gravada${hub.data.meetingsCount === 1 ? "" : "s"} pela IA`
                    : "Gravações e análise IA.",
                  active: activeModule === "meetings",
                  onClick: () => setActiveModule("meetings"),
                },
                {
                  key: "conversations",
                  icon: MessageCircle,
                  label: "Conversas",
                  description: hub.data?.conversationsCount
                    ? `${hub.data.conversationsCount} conversa${hub.data.conversationsCount === 1 ? "" : "s"}`
                    : "WhatsApp e canais.",
                  badge: { label: "em breve", tone: "info" },
                  active: activeModule === "conversations",
                  onClick: () => setActiveModule("conversations"),
                },
                {
                  key: "media",
                  icon: ImageIcon,
                  label: "Mídias & Projetos",
                  description: "Vídeos 3D, fotos e PDFs.",
                  onClick: () => navigate(`/admin/budget/${budget.id}`),
                },
                {
                  key: "client",
                  icon: User,
                  label: "Cliente",
                  description: budget.client_name,
                  active: activeModule === "client",
                  onClick: () => setActiveModule("client"),
                },
                {
                  key: "versions",
                  icon: History,
                  label: "Versões & PDFs",
                  description: "Histórico de versões.",
                  active: activeModule === "versions",
                  onClick: () => setActiveModule("versions"),
                },
                {
                  key: "lost",
                  icon: XCircle,
                  label: budget.internal_status === "lost" ? "Negócio perdido" : "Marcar como perdida",
                  description: hub.data?.lostReason
                    ? `${hub.data.lostReason.reason_category}${hub.data.lostReason.competitor_name ? ` · ${hub.data.lostReason.competitor_name}` : ""}`
                    : "Registrar motivo estruturado.",
                  destructive: true,
                  badge: budget.internal_status === "lost" ? { label: "perdida", tone: "destructive" } : undefined,
                  onClick: () => {
                    if (budget.internal_status === "lost") {
                      setActiveModule("lost");
                    } else {
                      setLostDialogOpen(true);
                    }
                  },
                },
              ]}
            />
          </aside>

          {/* Coluna direita: Ações & Tarefas (sempre visível) */}
          <div className="min-w-0 space-y-5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h2 className="text-base font-display font-semibold tracking-tight text-foreground">
                  Ações & Acontecimentos
                </h2>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  Registre tarefas com prazo, marque concluídas e acompanhe o que está atrasado.
                </p>
              </div>
              {budget.updated_at && (
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-body">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Atualizado {format(new Date(budget.updated_at), "dd/MM HH:mm")}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <BudgetTasksPanel
                budgetId={budget.id}
                getProfileName={getProfileName}
                contextFilter={
                  activeModule && MODULE_ACTIVITY_CONTEXT[activeModule]
                    ? {
                        ...MODULE_ACTIVITY_CONTEXT[activeModule],
                        onClear: () => setActiveModule(null),
                      }
                    : null
                }
              />
            </div>

            {/* Notas internas rápidas */}
            <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-display font-semibold text-foreground flex items-center gap-2">
                  💬 Notas Internas
                  <span className="text-[11px] text-muted-foreground font-body font-normal">
                    ({comments.length})
                  </span>
                </h3>
                {comments.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setActiveModule("activities")}
                    className="text-[11px] text-primary hover:underline font-body"
                  >
                    Ver todas →
                  </button>
                )}
              </div>

              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground font-body italic mb-3">
                  Nenhuma nota interna ainda. Registre o primeiro acontecimento abaixo.
                </p>
              ) : (
                <div className="space-y-2.5 mb-3 max-h-64 overflow-y-auto">
                  {comments.slice(-3).reverse().map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[12px] font-medium font-body text-foreground">
                            {getProfileName(c.user_id)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-body">
                            {format(new Date(c.created_at), "dd/MM HH:mm")}
                          </span>
                        </div>
                        <p className="text-[12.5px] font-body text-foreground whitespace-pre-wrap leading-relaxed">
                          {c.body}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <CommentQuickTemplates value={newComment} onChange={setNewComment} textareaRef={commentTextareaRef} />
              <div className="flex gap-2 mt-2">
                <Textarea
                  ref={commentTextareaRef}
                  placeholder="Registre um acontecimento ou nota interna... (digite / para templates)"
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
        </section>

        {/* DRILL-DOWN DRAWER */}
        <Sheet open={!!activeModule} onOpenChange={(o) => !o && setActiveModule(null)}>
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
            {activeModule && (
              <>
                <SheetHeader className="p-6 border-b border-border bg-card sticky top-0 z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <SheetTitle className="text-base font-display font-semibold text-foreground">
                        {moduleTitles[activeModule]}
                      </SheetTitle>
                      <SheetDescription className="text-xs text-muted-foreground font-body">
                        {moduleSubtitles[activeModule]}
                      </SheetDescription>
                    </div>
                    {activeModule === "budget" && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={handleExportXlsx}
                          disabled={exportingXlsx}
                          title="Exportar planilha completa (.xlsx) da versão atual"
                        >
                          {exportingXlsx ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileSpreadsheet className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">.xlsx</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 gap-1.5 text-xs"
                          onClick={handleExportPdf}
                          disabled={exportingPdf}
                          title="Exportar PDF completo da versão atual"
                        >
                          {exportingPdf ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileDown className="h-3.5 w-3.5" />
                          )}
                          <span className="hidden sm:inline">.pdf</span>
                        </Button>
                        {budget.public_id && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1.5 text-xs"
                              onClick={async () => {
                                try {
                                  await navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!));
                                  toast.success("Link copiado");
                                } catch {
                                  toast.error("Não foi possível copiar");
                                }
                              }}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Copiar link</span>
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() =>
                                openPublicBudget(
                                  {
                                    id: budget.id,
                                    public_id: budget.public_id,
                                    status: budget.status,
                                    version_group_id: budget.version_group_id,
                                  },
                                  {
                                    onStatusChanged: (newStatus) =>
                                      setBudget((prev) =>
                                        prev ? { ...prev, status: newStatus } : prev,
                                      ),
                                  },
                                )
                              }
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Visualizar</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </SheetHeader>

                <div className="p-6">
                  {activeModule === "unified" && budgetId && (
                    <UnifiedActivityPanel budgetId={budgetId} getProfileName={getProfileName} />
                  )}

                  {activeModule === "briefing" && (
                    <BriefingPanel
                      briefing={budget.briefing}
                      demandContext={budget.demand_context}
                      internalNotes={budget.internal_notes}
                      links={links as string[]}
                    />
                  )}

                  {activeModule === "budget" && (
                    <BudgetBreakdownPanel
                      budgetId={budget.id}
                      onResolvedBudgetId={handleResolvedBudgetId}
                    />
                  )}

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

                  {activeModule === "meetings" && budgetId && <MeetingsPanel budgetId={budgetId} />}

                  {activeModule === "conversations" && (
                    <EmptyIntegration
                      icon={MessageCircle}
                      title="Conversas via Digisac"
                      description="Quando integrarmos o Digisac, todas as conversas de WhatsApp com este lead serão centralizadas aqui, com histórico completo e respostas em tempo real."
                      bullets={[
                        "Histórico unificado de WhatsApp",
                        "Notificações em tempo real",
                        "Respostas direto da plataforma",
                      ]}
                    />
                  )}

                  {activeModule === "client" && (
                    <ClientModulePanel
                      budget={budget}
                      onLinked={(clientId) => setBudget((b) => (b ? { ...b, client_id: clientId } : b))}
                      extraSection={
                        <div className="space-y-4">
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

                          {budget.internal_status === "contrato_fechado" && (
                            <div className="flex flex-wrap gap-2 pt-1">
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
                            </div>
                          )}
                        </div>
                      }
                    />
                  )}

                  {activeModule === "versions" && <VersionHistoryPanel budgetId={budget.id} defaultExpanded />}

                  {activeModule === "lost" && (
                    <LostPanel
                      lostReason={hub.data?.lostReason ?? null}
                      onReopen={() => changeStatus("in_progress" as InternalStatus, "Reaberta após análise.")}
                      onEdit={() => {
                        setActiveModule(null);
                        setLostDialogOpen(true);
                      }}
                    />
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

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

      <LostReasonDialog
        open={lostDialogOpen}
        onOpenChange={setLostDialogOpen}
        onConfirm={handleMarkLost}
      />

      <RevisionRequestDialog
        open={revisionDialogOpen}
        onOpenChange={setRevisionDialogOpen}
        budgetId={budget.id}
        currentStatus={budget.internal_status}
        onSuccess={() => {
          setRevisionDialogOpen(false);
          setBudget((prev) => (prev ? { ...prev, internal_status: "revision_requested" } : prev));
          setEvents((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              event_type: "revision_requested",
              from_status: budget.internal_status,
              to_status: "revision_requested",
              note: null,
              user_id: user?.id ?? null,
              created_at: new Date().toISOString(),
            },
          ]);
        }}
      />

      <ExportPreviewDialog
        open={!!previewExport}
        onOpenChange={(open) => {
          if (!open) setPreviewExport(null);
        }}
        budgetId={previewExport?.budgetId ?? null}
        kind={previewExport?.kind ?? "pdf"}
      />
    </div>
  );
}

const moduleTitles: Record<ModuleKey, string> = {
  unified: "Tudo em um só lugar",
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
  unified: "Linha do tempo única com status, notas, tarefas, reuniões e mensagens.",
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

function EmptyIntegration({
  icon: Icon,
  title,
  description,
  bullets,
}: {
  icon: typeof Video;
  title: string;
  description: string;
  bullets: string[];
}) {
  return (
    <div className="py-8">
      <div className="flex flex-col items-center text-center mb-6">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
          <Icon className="h-5 w-5" />
        </div>
        <h4 className="text-base font-display font-semibold text-foreground mb-1">{title}</h4>
        <p className="text-sm text-muted-foreground font-body max-w-sm leading-relaxed">{description}</p>
        <span className="mt-3 text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full border bg-primary/5 text-primary border-primary/20">
          Integração em breve
        </span>
      </div>

      <div className="rounded-lg border border-border bg-muted/20 p-4">
        <h5 className="text-[11px] font-display font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          O que virá
        </h5>
        <ul className="space-y-1.5">
          {bullets.map((b, i) => (
            <li key={i} className="text-sm font-body text-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function LostPanel({
  lostReason,
  onReopen,
  onEdit,
}: {
  lostReason: {
    reason_category: string;
    reason_detail: string | null;
    competitor_name: string | null;
    competitor_value: number | null;
    lost_at: string;
  } | null;
  onReopen: () => void;
  onEdit: () => void;
}) {
  if (!lostReason) {
    return (
      <div className="py-10 flex flex-col items-center text-center">
        <XCircle className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground font-body max-w-sm">
          Esta demanda foi marcada como perdida, mas não há motivo estruturado registrado.
        </p>
        <Button size="sm" variant="outline" className="mt-4" onClick={onEdit}>
          Registrar motivo
        </Button>
      </div>
    );
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

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-xs font-display font-semibold uppercase tracking-wider text-destructive">
            Negócio perdido
          </span>
          <span className="text-[11px] text-muted-foreground font-body ml-auto">
            {format(new Date(lostReason.lost_at), "dd/MM/yyyy HH:mm")}
          </span>
        </div>
        <div className="space-y-2.5">
          <InfoRow
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            label="Categoria"
            value={categoryLabels[lostReason.reason_category] ?? lostReason.reason_category}
          />
          {lostReason.competitor_name && (
            <InfoRow
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Concorrente"
              value={lostReason.competitor_name}
            />
          )}
          {lostReason.competitor_value !== null && lostReason.competitor_value !== undefined && (
            <InfoRow
              icon={<ClipboardList className="h-3.5 w-3.5" />}
              label="Valor da concorrência"
              value={formatBRL(lostReason.competitor_value)}
            />
          )}
          {lostReason.reason_detail && (
            <div className="pt-2 border-t border-destructive/10">
              <span className="text-xs text-muted-foreground font-body block mb-1">Detalhamento</span>
              <p className="text-sm text-foreground font-body whitespace-pre-wrap leading-relaxed">
                {lostReason.reason_detail}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={onEdit}>
          Editar motivo
        </Button>
        <Button size="sm" variant="ghost" onClick={onReopen}>
          Reabrir negócio
        </Button>
      </div>
    </div>
  );
}
