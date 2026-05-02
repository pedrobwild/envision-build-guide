import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Calendar, User, Building2, ArrowLeft, Loader2, Inbox,
  Clock, MoreVertical, ExternalLink, CheckCircle2,
  ArrowUpDown, Copy, Send, RotateCcw, AlertTriangle,
  FileText, Eye, ThumbsUp, XCircle, Plus, GitCompare,
  LayoutList, Columns3, UserPlus, ChevronRight, Flame,
  SlidersHorizontal, X, Hammer,
} from "lucide-react";
import {
  INTERNAL_STATUSES, PRIORITIES, canTransitionStatus,
  type InternalStatus, type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isToday, isPast, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { MobileFilterChips, type FilterChip } from "@/components/admin/MobileFilterChips";
import { KanbanBoard, type DueFilter } from "@/components/commercial/KanbanBoard";
import { RevisionRequestDialog } from "@/components/editor/RevisionRequestDialog";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { VersionBadge } from "@/components/admin/VersionBadge";
import { ContractUploadModal } from "@/components/commercial/ContractUploadModal";
import { ClientForm } from "@/components/crm/ClientForm";
import { InlineEdit } from "@/components/ui/inline-edit";
import { showUndoToast } from "@/lib/inline-edit-undo";
import { SavedViewsBar } from "@/components/crm/SavedViewsBar";
import { useDealPipelines, setBudgetPipeline } from "@/hooks/useDealPipelines";
import { useBudgetPipelineMeta } from "@/hooks/useBudgetPipelineMeta";
import { useBudgetActivityMeta } from "@/hooks/useBudgetActivityMeta";
import { useLeadScores } from "@/hooks/useLeadScores";
import { PipelineSwitcher } from "@/components/admin/PipelineSwitcher";
import { computeDealTemperature, suggestNextAction, type DealTemperatureResult, type NextActionSuggestion } from "@/lib/deal-temperature";
import { LostReasonDialog, type LostReasonPayload } from "@/components/demanda/LostReasonDialog";
import { NewActivityDialog } from "@/components/agenda/NewActivityDialog";
import { BudgetCommunicationDrawer } from "@/components/admin/BudgetCommunicationDrawer";


// Pipeline groups for the commercial view
const LOCKED_STATUSES: readonly string[] = [
  "requested", "triage", "assigned", "in_progress", "waiting_info",
];

const PIPELINE_SECTIONS = {
  mql: {
    label: "MQL",
    statuses: ["mql"] as InternalStatus[],
    icon: User,
    accent: "text-slate-600",
  },
  qualificacao: {
    label: "Qualificação",
    statuses: ["qualificacao"] as InternalStatus[],
    icon: Eye,
    accent: "text-cyan-700",
  },
  lead: {
    label: "Lead",
    statuses: ["lead"] as InternalStatus[],
    icon: User,
    accent: "text-sky-700",
  },
  validacao_briefing: {
    label: "Validação de Briefing",
    statuses: ["validacao_briefing"] as InternalStatus[],
    icon: FileText,
    accent: "text-indigo-700",
  },
  solicitado: {
    label: "Solicitado",
    statuses: ["requested", "novo"] as InternalStatus[],
    icon: FileText,
    accent: "text-primary",
  },
  em_elaboracao: {
    label: "Em Elaboração",
    statuses: ["triage", "assigned", "in_progress", "waiting_info"] as InternalStatus[],
    icon: Clock,
    accent: "text-warning",
  },
  revisao_solicitada: {
    label: "Revisão Solicitada",
    statuses: ["revision_requested"] as InternalStatus[],
    icon: RotateCcw,
    accent: "text-orange-600",
  },
  entregue: {
    label: "Entregue",
    statuses: ["delivered_to_sales"] as InternalStatus[],
    icon: CheckCircle2,
    accent: "text-success",
  },
  em_revisao: {
    label: "Em Revisão",
    statuses: ["ready_for_review"] as InternalStatus[],
    icon: Eye,
    accent: "text-warning",
  },
  enviado: {
    label: "Enviado para o Cliente",
    statuses: ["sent_to_client"] as InternalStatus[],
    icon: Send,
    accent: "text-success",
  },
  minuta: {
    label: "Minuta Solicitada",
    statuses: ["minuta_solicitada"] as InternalStatus[],
    icon: FileText,
    accent: "text-violet-600",
  },
  fechado: {
    label: "Contrato Fechado",
    statuses: ["contrato_fechado"] as InternalStatus[],
    icon: ThumbsUp,
    accent: "text-success",
  },
  perdido: {
    label: "Perdido",
    statuses: ["lost"] as InternalStatus[],
    icon: XCircle,
    accent: "text-muted-foreground",
  },
} as const;

type SortOption = "urgente" | "recente" | "prazo";

// Workflow groups for commercial list view
type CommercialWorkflowStage = "action_needed" | "overdue" | "em_elaboracao" | "revisao_solicitada" | "enviado" | "solicitado" | "advanced" | "closed";

interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  internal_status: InternalStatus;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  generated_at: string | null;
  last_viewed_at: string | null;
  view_count: number | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  public_id: string | null;
  status: string;
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
  is_published_version: boolean | null;
  budget_pdf_url: string | null;
  manual_total: number | null;
  pipeline_id: string | null;
  client_phone: string | null;
  client_id: string | null;
  property_id: string | null;
  /**
   * Quando dois ou mais orçamentos pertencem ao mesmo cliente+imóvel mas têm
   * `version_group_id` diferentes (foram criados como orçamentos novos em vez
   * de versões), o pipeline mostra apenas o mais recente e enumera os demais
   * aqui para o card exibir um badge "+N versões".
   */
  sibling_budget_ids?: string[];
}

interface ProfileRow { id: string; full_name: string; }

const DELIVERED_FINISHED = new Set(["delivered_to_sales", "sent_to_client", "minuta_solicitada", "lost", "archived", "contrato_fechado"]);

// Thresholds das filas — manter idêntico ao usado em useComercialQueues e no
// filtro `filtered` para evitar divergência entre contagem e lista.
const QUEUE_COOLDOWN_DAYS: Record<string, number> = {
  sent_to_client: 5,
  minuta_solicitada: 10,
  waiting_info: 3,
};
const QUEUE_HOUR_MS = 1000 * 60 * 60;
const QUEUE_DAY_MS = QUEUE_HOUR_MS * 24;

type QueueBudgetLike = {
  internal_status: string;
  view_count: number | null;
  generated_at: string | null;
  updated_at: string | null;
};

function matchesQueue(b: QueueBudgetLike, queue: "prontos" | "sem-vis" | "esfriando", now: number): boolean {
  if (queue === "prontos") {
    return b.internal_status === "delivered_to_sales";
  }
  if (queue === "sem-vis") {
    if (b.internal_status !== "sent_to_client") return false;
    if ((b.view_count ?? 0) > 0) return false;
    const ref = b.generated_at ?? b.updated_at;
    if (!ref) return false;
    return (now - new Date(ref).getTime()) / QUEUE_HOUR_MS >= 48;
  }
  // esfriando
  const threshold = QUEUE_COOLDOWN_DAYS[b.internal_status];
  if (!threshold) return false;
  if (!b.updated_at) return false;
  return (now - new Date(b.updated_at).getTime()) / QUEUE_DAY_MS >= threshold;
}

function getDueInfo(dueAt: string | null, internalStatus?: string) {
  if (!dueAt) return { label: null, variant: "default" as const };
  const dueDate = new Date(dueAt);
  const days = differenceInCalendarDays(dueDate, new Date());
  const isDelivered = internalStatus ? DELIVERED_FINISHED.has(internalStatus) : false;
  if (isPast(dueDate) && !isToday(dueDate)) {
    if (isDelivered) return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
    return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" as const };
  }
  if (isToday(dueDate)) return { label: "Vence hoje", variant: isDelivered ? "default" as const : "today" as const };
  if (days <= 2) return { label: `${days}d restante${days > 1 ? "s" : ""}`, variant: isDelivered ? "default" as const : "soon" as const };
  return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
}

const dueVariantStyles = {
  overdue: "bg-destructive/10 text-destructive border-destructive/20",
  today: "bg-warning/10 text-warning border-warning/20",
  soon: "bg-warning/10 text-warning border-warning/20",
  default: "text-muted-foreground",
};

function getCommercialStage(b: BudgetRow): CommercialWorkflowStage {
  // Action needed = delivered to sales (ready to send to client)
  if (b.internal_status === "delivered_to_sales") return "action_needed";
  // Overdue (non-finished)
  if (b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at)) && !DELIVERED_FINISHED.has(b.internal_status)) return "overdue";
  // Revision requested
  if (b.internal_status === "revision_requested") return "revisao_solicitada";
  // Being built
  if (["requested", "novo"].includes(b.internal_status)) return "solicitado";
  if (["triage", "assigned", "in_progress", "waiting_info", "ready_for_review"].includes(b.internal_status)) return "em_elaboracao";
  // Sent to client
  if (b.internal_status === "sent_to_client") return "enviado";
  // Advanced commercial (minuta, contrato)
  if (["minuta_solicitada", "contrato_fechado"].includes(b.internal_status)) return "advanced";
  // Closed (lost, archived)
  return "closed";
}

interface WorkflowGroup {
  key: CommercialWorkflowStage;
  label: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  borderAccent: string;
  budgets: BudgetRow[];
}

export default function CommercialDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [syncedBudgetIds, setSyncedBudgetIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  // Persistimos busca/filtros/visualização em sessionStorage para que o usuário
  // não perca o contexto ao alternar Kanban/Lista, trocar status ou recarregar
  // a página dentro da mesma sessão. Chave única do dashboard comercial.
  const PERSIST_KEY = "commercialDashboard:filters:v1";
  type PersistedFilters = {
    search?: string;
    statusFilter?: string;
    sortBy?: SortOption;
    viewMode?: "list" | "kanban";
  };
  const persisted = (() => {
    if (typeof window === "undefined") return {} as PersistedFilters;
    try {
      const raw = window.sessionStorage.getItem(PERSIST_KEY);
      return raw ? (JSON.parse(raw) as PersistedFilters) : {};
    } catch {
      return {} as PersistedFilters;
    }
  })();
  const [search, setSearch] = useState<string>(persisted.search ?? "");
  const [statusFilter, setStatusFilter] = useState<string>(persisted.statusFilter ?? "all");
  const [sortBy, setSortBy] = useState<SortOption>(persisted.sortBy ?? "recente");
  const [viewMode, setViewMode] = useState<"list" | "kanban">(persisted.viewMode ?? "kanban");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [pipelineFilter, setPipelineFilter] = useState<string>("all");
  // Fila vinda da home do comercial via ?fila=prontos|sem-vis|esfriando.
  // Quando ativa, sobrepõe statusFilter e força viewMode = "list" para
  // o usuário ver imediatamente os negócios qualificados pela regra.
  const [queueFilter, setQueueFilter] = useState<"prontos" | "sem-vis" | "esfriando" | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const f = params.get("fila");
    if (f === "prontos" || f === "sem-vis" || f === "esfriando") return f;
    return null;
  });
  const [confirmCloseBudgetId, setConfirmCloseBudgetId] = useState<string | null>(null);
  const [revisionBudget, setRevisionBudget] = useState<BudgetRow | null>(null);
  const [contractUploadBudget, setContractUploadBudget] = useState<BudgetRow | null>(null);
  const [newDealOpen, setNewDealOpen] = useState(false);
  const [pendingLostBudgetId, setPendingLostBudgetId] = useState<string | null>(null);
  const [nextActionBudgetId, setNextActionBudgetId] = useState<string | null>(null);
  const [nextActionPreset, setNextActionPreset] = useState<{ type: string; title: string } | null>(null);
  const [historyBudget, setHistoryBudget] = useState<BudgetRow | null>(null);

  // Persiste busca + filtros básicos + visualização sempre que mudarem.
  // Usamos sessionStorage para não atravessar abas ou reinícios do navegador,
  // mantendo a experiência limpa em novas sessões.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload: PersistedFilters = { search, statusFilter, sortBy, viewMode };
      window.sessionStorage.setItem(PERSIST_KEY, JSON.stringify(payload));
    } catch {
      // storage cheio/bloqueado: silenciosamente ignora — não é crítico.
    }
  }, [search, statusFilter, sortBy, viewMode]);

  // Sincroniza ?fila=… vindo da home do comercial. Ao chegar com fila,
  // forçamos a lista (mais legível pra cobrar/abrir cada deal) e zeramos
  // statusFilter para não conflitar com o filtro de fila.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const f = params.get("fila");
    const next = (f === "prontos" || f === "sem-vis" || f === "esfriando") ? f : null;
    setQueueFilter(next);
    if (next) {
      setViewMode("list");
      setStatusFilter("all");
      setDueFilter("all");
    }
  }, [location.search]);

  const { data: pipelines = [], isLoading: pipelinesLoading } = useDealPipelines();
  const budgetIds = useMemo(() => budgets.map((b) => b.id), [budgets]);
  const { data: pipelineMetaMap } = useBudgetPipelineMeta(budgetIds);
  const { data: activityMetaMap } = useBudgetActivityMeta(budgetIds);
  // Onda 5A: scores de lead por cliente (agregado e cacheado)
  const clientIds = useMemo(
    () => budgets.map((b) => b.client_id).filter((v): v is string => !!v),
    [budgets],
  );
  const { data: leadScoreMap } = useLeadScores(clientIds);

  // Score de temperatura + sugestão de próxima ação para cada card
  const temperatureMap = useMemo(() => {
    const map = new Map<string, DealTemperatureResult>();
    for (const b of budgets) {
      const meta = activityMetaMap?.get(b.id);
      const stageMeta = pipelineMetaMap?.get(b.id);
      const result = computeDealTemperature({
        daysSinceLastActivity: meta?.days_since_last_activity ?? null,
        daysInStage: stageMeta?.days_in_stage ?? null,
        manualTotal: b.manual_total ?? null,
        internalStatus: b.internal_status,
      });
      map.set(b.id, result);
    }
    return map;
  }, [budgets, activityMetaMap, pipelineMetaMap]);

  const nextActionMap = useMemo(() => {
    const map = new Map<string, NextActionSuggestion | null>();
    for (const b of budgets) {
      const meta = activityMetaMap?.get(b.id);
      const stageMeta = pipelineMetaMap?.get(b.id);
      const sugg = suggestNextAction({
        internalStatus: b.internal_status,
        daysSinceLastActivity: meta?.days_since_last_activity ?? null,
        daysInStage: stageMeta?.days_in_stage ?? null,
        hasScheduledActivity: meta?.has_scheduled ?? false,
      });
      map.set(b.id, sugg);
    }
    return map;
  }, [budgets, activityMetaMap, pipelineMetaMap]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user && profile) loadData(); }, [user, profile, location.key]);

  async function loadData() {
    setLoading(true);
    const isAdmin = profile?.roles.includes("admin");
    let budgetQuery = supabase
      .from("budgets")
      .select("id, client_id, property_id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, updated_at, generated_at, last_viewed_at, view_count, commercial_owner_id, estimator_owner_id, public_id, status, version_number, version_group_id, is_current_version, is_published_version, sequential_code, budget_pdf_url, manual_total, pipeline_id, client_phone")
      .order("created_at", { ascending: false });

    if (!isAdmin) {
      // Visibilidade do comercial: orçamentos atribuídos a ele OU orçamentos
      // sem owner comercial em qualquer etapa relevante do funil
      // (do MQL ao fechamento). Combinamos o filtro de versão atual com o de
      // visibilidade num único .or() — encadear .or() duas vezes faz o
      // PostgREST sobrescrever o primeiro filtro, derrubando a query.
      const commercialRelevantStatuses = [
        "mql", "qualificacao", "lead", "validacao_briefing",
        "novo", "requested",
        "triage", "assigned", "in_progress", "waiting_info",
        "ready_for_review", "delivered_to_sales", "sent_to_client",
        "revision_requested", "minuta_solicitada", "contrato_fechado", "lost"
      ];
      budgetQuery = budgetQuery
        .or("is_current_version.eq.true,is_current_version.is.null")
        .or(
          `commercial_owner_id.eq.${user!.id},and(commercial_owner_id.is.null,internal_status.in.(${commercialRelevantStatuses.join(",")}))`,
        );
    } else {
      // Admin vê todos, mas só a versão atual de cada grupo.
      budgetQuery = budgetQuery.or("is_current_version.eq.true,is_current_version.is.null");
    }
    const [budgetsRes, profilesRes, syncRes] = await Promise.all([
      budgetQuery,
      supabase.from("profiles").select("id, full_name"),
      supabase.from("integration_sync_log")
        .select("source_id")
        .eq("source_system", "envision")
        .eq("entity_type", "project")
        .eq("sync_status", "success"),
    ]);

    if (budgetsRes.data) {
      const rawBudgets = budgetsRes.data as BudgetRow[];
      const unresolvedGroupIds = Array.from(
        new Set(
          rawBudgets
            .filter((budget) => !budget.public_id && budget.version_group_id)
            .map((budget) => budget.version_group_id)
            .filter((groupId): groupId is string => Boolean(groupId))
        )
      );

      let publishedPublicIds = new Map<string, string>();
      if (unresolvedGroupIds.length > 0) {
        const { data: publishedVersions } = await supabase
          .from("budgets")
          .select("version_group_id, public_id")
          .in("version_group_id", unresolvedGroupIds)
          .eq("is_published_version", true)
          .not("public_id", "is", null);

        publishedPublicIds = new Map(
          (publishedVersions ?? []).flatMap((version) =>
            version.version_group_id && version.public_id
              ? [[version.version_group_id, version.public_id]]
              : []
          )
        );
      }

      setBudgets(
        rawBudgets.map((budget) => ({
          ...budget,
          public_id:
            budget.public_id ??
            (budget.version_group_id ? publishedPublicIds.get(budget.version_group_id) ?? null : null),
        }))
      );
    }

    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (syncRes.data) setSyncedBudgetIds(new Set(syncRes.data.map(r => r.source_id)));
    setLoading(false);
  }

  const getProfileName = useCallback(
    (id: string | null) => (id ? profiles.find(p => p.id === id)?.full_name || "—" : "—"),
    [profiles],
  );

  /**
   * Deduplica orçamentos do mesmo negócio quando foram criados como
   * orçamentos novos (version_group_id distinto) em vez de versões. Mantém
   * apenas o mais recente (created_at desc) e expõe os ids dos demais em
   * `sibling_budget_ids` para o card mostrar um badge "+N versões".
   *
   * Chave de agrupamento (em ordem de prioridade), sempre escopada ao mesmo
   * pipeline_id para não juntar negócios de pipelines diferentes:
   *   1. version_group_id (versões formais do mesmo orçamento)
   *   2. client_id + property_id (mesmo imóvel do mesmo cliente)
   *   3. client_id (fallback quando property_id está ausente em algum)
   */
  const dedupedBudgets = useMemo<BudgetRow[]>(() => {
    const groups = new Map<string, BudgetRow[]>();
    const ungrouped: BudgetRow[] = [];
    for (const b of budgets) {
      const pipelineKey = b.pipeline_id ?? "no-pipeline";
      let key: string | null = null;
      if (b.version_group_id) {
        key = `vg::${pipelineKey}::${b.version_group_id}`;
      } else if (b.client_id && b.property_id) {
        key = `cp::${pipelineKey}::${b.client_id}::${b.property_id}`;
      } else if (b.client_id) {
        key = `c::${pipelineKey}::${b.client_id}`;
      }
      if (!key) {
        ungrouped.push(b);
        continue;
      }
      const list = groups.get(key);
      if (list) list.push(b);
      else groups.set(key, [b]);
    }
    const champions: BudgetRow[] = [];
    for (const list of groups.values()) {
      if (list.length === 1) {
        champions.push(list[0]);
        continue;
      }
      const sorted = [...list].sort((a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
      );
      const champion = sorted[0];
      const siblings = sorted.slice(1).map((s) => s.id);
      champions.push({ ...champion, sibling_budget_ids: siblings });
    }
    return [...champions, ...ungrouped];
  }, [budgets]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [key, sec] of Object.entries(PIPELINE_SECTIONS)) {
      c[key] = dedupedBudgets.filter(b => (sec.statuses as readonly string[]).includes(b.internal_status)).length;
    }
    c.total = dedupedBudgets.length;
    c.needsAction = dedupedBudgets.filter(b => b.internal_status === "delivered_to_sales").length;
    c.overdue = dedupedBudgets.filter(b =>
      b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at)) && !DELIVERED_FINISHED.has(b.internal_status)
    ).length;
    c.dueToday = dedupedBudgets.filter(b =>
      b.due_at && isToday(new Date(b.due_at)) && !DELIVERED_FINISHED.has(b.internal_status)
    ).length;
    return c;
  }, [dedupedBudgets]);

  const isAdmin = profile?.roles.includes("admin");

  const commercialOptions = useMemo(() => {
    if (!isAdmin) return [];
    const ids = [...new Set(budgets.map(b => b.commercial_owner_id).filter(Boolean))] as string[];
    return ids.map(id => ({ id, name: getProfileName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, budgets, getProfileName]);

  // Lookup pipeline_id from active slug for filtering
  const activePipelineId = useMemo(() => {
    if (pipelineFilter === "all") return null;
    return pipelines.find((p) => p.slug === pipelineFilter)?.id ?? null;
  }, [pipelineFilter, pipelines]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const HOUR = 1000 * 60 * 60;
    // Mesmas thresholds usadas em useComercialQueues — mantém o card da home
    // e a tela do pipeline mostrando exatamente o mesmo conjunto.
    const COOLDOWN_DAYS: Record<string, number> = {
      sent_to_client: 5,
      minuta_solicitada: 10,
      waiting_info: 3,
    };
    const result = dedupedBudgets.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.client_name.toLowerCase().includes(q) || b.project_name.toLowerCase().includes(q) || (b.bairro ?? "").toLowerCase().includes(q);
      const matchCommercial = commercialFilter === "all" || b.commercial_owner_id === commercialFilter;
      if (!matchCommercial) return false;

      if (activePipelineId !== null) {
        if (b.pipeline_id !== activePipelineId) return false;
      }

      // Filtro de fila vindo da home do comercial. Tem prioridade sobre statusFilter.
      if (queueFilter) {
        if (queueFilter === "prontos") {
          if (b.internal_status !== "delivered_to_sales") return false;
        } else if (queueFilter === "sem-vis") {
          // Enviado ao cliente, sem nenhuma abertura, há mais de 48h.
          if (b.internal_status !== "sent_to_client") return false;
          if ((b.view_count ?? 0) > 0) return false;
          const ref = b.generated_at ?? b.updated_at;
          if (!ref) return false;
          const hours = (now - new Date(ref).getTime()) / HOUR;
          if (hours < 48) return false;
        } else if (queueFilter === "esfriando") {
          const threshold = COOLDOWN_DAYS[b.internal_status];
          if (!threshold) return false;
          if (!b.updated_at) return false;
          const days = (now - new Date(b.updated_at).getTime()) / (HOUR * 24);
          if (days < threshold) return false;
        }
        return matchSearch;
      }

      if (dueFilter !== "all") {
        const v = getDueInfo(b.due_at, b.internal_status).variant;
        if (dueFilter === "overdue" && v !== "overdue" && v !== "today") return false;
        if (dueFilter === "due_soon" && v !== "soon") return false;
      }

      if (statusFilter === "all") return matchSearch;
      const section = PIPELINE_SECTIONS[statusFilter as keyof typeof PIPELINE_SECTIONS];
      if (section) return matchSearch && (section.statuses as readonly string[]).includes(b.internal_status);
      return matchSearch && b.internal_status === statusFilter;
    });

    const priorityOrder: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };
    result.sort((a, b) => {
      if (sortBy === "urgente") {
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        if (a.due_at) return -1;
        if (b.due_at) return 1;
        return 0;
      }
      if (sortBy === "prazo") {
        if (a.due_at && b.due_at) return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
        if (a.due_at) return -1;
        if (b.due_at) return 1;
        return 0;
      }
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });
    return result;
  }, [dedupedBudgets, search, statusFilter, sortBy, commercialFilter, dueFilter, activePipelineId, queueFilter]);

  // Counts per pipeline (for the PipelineSwitcher tabs)
  const pipelineCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of pipelines) map[p.slug] = 0;
    for (const b of dedupedBudgets) {
      const slug = pipelines.find((p) => p.id === b.pipeline_id)?.slug;
      if (slug) map[slug] = (map[slug] ?? 0) + 1;
    }
    return map;
  }, [dedupedBudgets, pipelines]);

  // Workflow groups for list view
  const isDefaultView = statusFilter === "all" && !search && dueFilter === "all" && commercialFilter === "all";

  const workflowGroups = useMemo<WorkflowGroup[]>(() => {
    if (!isDefaultView) return [];

    const buckets: Record<CommercialWorkflowStage, BudgetRow[]> = {
      action_needed: [], overdue: [], revisao_solicitada: [], solicitado: [],
      em_elaboracao: [], enviado: [], advanced: [], closed: [],
    };

    for (const b of filtered) {
      const stage = getCommercialStage(b);
      buckets[stage].push(b);
    }

    const defs: { key: CommercialWorkflowStage; label: string; description: string; icon: React.ReactNode; accent: string; borderAccent: string }[] = [
      { key: "action_needed", label: "Prontos para Enviar", description: "Entregues — enviar ao cliente", icon: <CheckCircle2 className="h-4 w-4" />, accent: "text-success", borderAccent: "border-l-success" },
      { key: "overdue", label: "Atrasados", description: "Prazo ultrapassado", icon: <AlertTriangle className="h-4 w-4" />, accent: "text-destructive", borderAccent: "border-l-destructive" },
      { key: "revisao_solicitada", label: "Revisão Solicitada", description: "Retornou para orçamentista", icon: <RotateCcw className="h-4 w-4" />, accent: "text-warning", borderAccent: "border-l-warning" },
      { key: "solicitado", label: "Solicitados", description: "Aguardando elaboração", icon: <FileText className="h-4 w-4" />, accent: "text-primary", borderAccent: "border-l-primary" },
      { key: "em_elaboracao", label: "Em Elaboração", description: "Em produção pelo orçamentista", icon: <Hammer className="h-4 w-4" />, accent: "text-foreground", borderAccent: "border-l-foreground/30" },
      { key: "enviado", label: "Enviados ao Cliente", description: "Aguardando retorno do cliente", icon: <Send className="h-4 w-4" />, accent: "text-success", borderAccent: "border-l-success/50" },
      { key: "advanced", label: "Negociação Avançada", description: "Minuta ou contrato em andamento", icon: <ThumbsUp className="h-4 w-4" />, accent: "text-violet-600", borderAccent: "border-l-violet-500" },
      { key: "closed", label: "Encerrados", description: "Perdidos ou arquivados", icon: <XCircle className="h-4 w-4" />, accent: "text-muted-foreground", borderAccent: "border-l-muted-foreground/30" },
    ];

    return defs
      .filter(d => buckets[d.key].length > 0)
      .map(d => ({ ...d, budgets: buckets[d.key] }));
  }, [filtered, isDefaultView]);

  async function changeStatus(budgetId: string, newStatus: InternalStatus) {
    const current = budgets.find(b => b.id === budgetId);
    if (!current) return;

    // Validate transition client-side (mirrors DB trigger)
    if (!canTransitionStatus(current.internal_status, newStatus)) {
      const fromLabel = INTERNAL_STATUSES[current.internal_status as InternalStatus]?.label ?? current.internal_status;
      const toLabel = INTERNAL_STATUSES[newStatus]?.label ?? newStatus;
      toast.error(`Transição inválida: "${fromLabel}" → "${toLabel}"`, {
        description: "Esse fluxo não é permitido. Mova o card para uma etapa válida.",
      });
      return;
    }

    if (newStatus === "contrato_fechado") {
      const target = budgets.find(b => b.id === budgetId);
      if (target) { setContractUploadBudget(target); return; }
    }

    // Forçar registro de motivo ao marcar como perdido
    if (newStatus === "lost" && current.internal_status !== "lost") {
      setPendingLostBudgetId(budgetId);
      return;
    }

    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", budgetId);
    if (error) {
      toast.error("Erro ao atualizar status", { description: error.message });
      return;
    }

    if (user) {
      await supabase.from("budget_events").insert({
        budget_id: budgetId,
        user_id: user.id,
        event_type: "status_change",
        from_status: current?.internal_status ?? null,
        to_status: newStatus,
      });
    }

    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, internal_status: newStatus, updated_at: new Date().toISOString() } : b));
    toast.success(`Status atualizado para "${INTERNAL_STATUSES[newStatus]?.label ?? newStatus}"`);
  }

  async function confirmLostReason(payload: LostReasonPayload) {
    if (!pendingLostBudgetId || !user) return;
    const budgetId = pendingLostBudgetId;
    const current = budgets.find(b => b.id === budgetId);
    // 1) salva motivo (upsert por budget_id)
    const { error: lostErr } = await supabase
      .from("budget_lost_reasons")
      .upsert({
        budget_id: budgetId,
        reason_category: payload.reason_category,
        reason_detail: payload.reason_detail || null,
        competitor_name: payload.competitor_name ?? null,
        competitor_value: payload.competitor_value ?? null,
        created_by: user.id,
      }, { onConflict: "budget_id" });
    if (lostErr) {
      toast.error("Erro ao registrar motivo", { description: lostErr.message });
      return;
    }
    // 2) move o card para Perdido
    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: "lost", updated_at: new Date().toISOString() })
      .eq("id", budgetId);
    if (error) {
      toast.error("Erro ao atualizar status", { description: error.message });
      return;
    }
    await supabase.from("budget_events").insert({
      budget_id: budgetId,
      user_id: user.id,
      event_type: "status_change",
      from_status: current?.internal_status ?? null,
      to_status: "lost",
      note: `Motivo: ${payload.reason_category}`,
    });
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, internal_status: "lost", updated_at: new Date().toISOString() } : b));
    setPendingLostBudgetId(null);
    toast.success("Negócio marcado como perdido");
  }

  function handleNextActionClick(budgetId: string, sugg: NextActionSuggestion) {
    setNextActionPreset({ type: sugg.type, title: sugg.label });
    setNextActionBudgetId(budgetId);
  }


  async function claimBudget(budgetId: string) {
    if (!user) return;
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, commercial_owner_id: user.id } : b));
    const { error } = await supabase
      .from("budgets")
      .update({ commercial_owner_id: user.id, updated_at: new Date().toISOString() })
      .eq("id", budgetId);
    if (error) {
      toast.error("Erro ao assumir orçamento.");
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, commercial_owner_id: null } : b));
    } else {
      toast.success("Orçamento assumido com sucesso!");
    }
  }

  async function updateBudgetField(
    budgetId: string,
    field: "manual_total" | "due_at",
    next: string | number | null,
    label: string,
  ) {
    const current = budgets.find(b => b.id === budgetId);
    if (!current) return;
    const previous = current[field] ?? null;
    if (previous === next) return;

    // Optimistic
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, [field]: next } : b));

    const { error } = await supabase
      .from("budgets")
      .update({ [field]: next, updated_at: new Date().toISOString() })
      .eq("id", budgetId);

    if (error) {
      // Revert
      setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, [field]: previous } : b));
      toast.error(`Erro ao atualizar ${label}`, { description: error.message });
      return;
    }

    showUndoToast({
      message: `${label} atualizado`,
      onUndo: async () => {
        setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, [field]: previous } : b));
        await supabase
          .from("budgets")
          .update({ [field]: previous, updated_at: new Date().toISOString() })
          .eq("id", budgetId);
      },
    });
  }

  function handleContractUploadSuccess() {
    if (!contractUploadBudget || !user) return;
    const budgetId = contractUploadBudget.id;
    supabase.from("budget_events").insert({
      budget_id: budgetId, user_id: user.id, event_type: "status_change",
      from_status: contractUploadBudget.internal_status, to_status: "contrato_fechado",
    });
    setBudgets(prev => prev.map(b => b.id === budgetId ? { ...b, internal_status: "contrato_fechado", updated_at: new Date().toISOString() } : b));
    setContractUploadBudget(null);
  }

  function copyPublicLink(publicId: string | null) {
    if (!publicId) { toast.error("Orçamento não possui link público."); return; }
    navigator.clipboard.writeText(getPublicBudgetUrl(publicId));
    toast.success("Link copiado!");
  }

  function handleRevisionRequestSuccess() {
    if (!revisionBudget) return;
    setBudgets(prev => prev.map(b => b.id === revisionBudget.id ? { ...b, internal_status: "revision_requested", updated_at: new Date().toISOString() } : b));
    setRevisionBudget(null);
  }

  // Filter bar state
  const hasActiveFilters = statusFilter !== "all" || search.length > 0 || dueFilter !== "all" || commercialFilter !== "all";
  const activeFilterCount = [statusFilter !== "all", dueFilter !== "all", commercialFilter !== "all"].filter(Boolean).length;
  const clearAllFilters = () => { setSearch(""); setStatusFilter("all"); setDueFilter("all"); setCommercialFilter("all"); };

  const renderBudgetCard = (b: BudgetRow) => {
    const status = INTERNAL_STATUSES[b.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
    const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
    const due = getDueInfo(b.due_at, b.internal_status);
    const isLocked = LOCKED_STATUSES.includes(b.internal_status);
    const isEntregue = b.internal_status === "delivered_to_sales";
    const timeAgo = b.created_at ? formatDistanceToNow(new Date(b.created_at), { addSuffix: true, locale: ptBR }) : null;

    return (
      <Card
        key={b.id}
        className={`px-4 py-3 hover:shadow-md transition-all border group cursor-pointer ${isEntregue ? "border-success/30" : ""}`}
        onClick={() => navigate(`/admin/demanda/${b.id}`)}
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            {/* Row 1: Code + Name + Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {isEntregue && <span className="w-2 h-2 rounded-full bg-success shrink-0" />}
              <span className="font-medium font-display text-sm text-foreground truncate">
                {b.project_name || b.client_name}
              </span>
              <Badge variant="secondary" className={`text-[10px] font-body px-1.5 py-0 h-[18px] ${status.color}`}>
                {status.icon} {status.label}
              </Badge>
              {!b.commercial_owner_id && (
                <Badge
                  variant="outline"
                  className="text-[10px] font-body border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 cursor-pointer hover:bg-amber-100 transition-colors"
                  onClick={(e) => { e.stopPropagation(); claimBudget(b.id); }}
                >
                  <UserPlus className="h-3 w-3 mr-0.5" />Assumir
                </Badge>
              )}
              {b.priority === "urgente" && (
                <Badge className="bg-destructive/10 text-destructive border-destructive/20 border text-[9px] px-1 py-0 h-4 gap-0.5">
                  <Flame className="h-2.5 w-2.5" />Urgente
                </Badge>
              )}
              {b.priority === "alta" && (
                <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${prio.color}`}>Alta</Badge>
              )}
              {due.label && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0 h-4 rounded-full border ${dueVariantStyles[due.variant]}`}>
                  <Calendar className="h-2.5 w-2.5" />{due.label}
                </span>
              )}
              <VersionBadge versionNumber={b.version_number} isCurrent={b.is_current_version} />

              {b.budget_pdf_url && (
                <a
                  href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/budget-pdfs/${b.budget_pdf_url}`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                >
                  <FileText className="h-3 w-3" />PDF
                </a>
              )}
              {b.manual_total && b.manual_total > 0 ? (
                <span
                  className="inline-flex items-center text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success tabular-nums"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InlineEdit
                    type="currency"
                    value={b.manual_total}
                    onSave={(v) => updateBudgetField(b.id, "manual_total", v, "Valor")}
                    ariaLabel="Editar valor"
                  />
                </span>
              ) : (
                <span
                  className="inline-flex items-center text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground tabular-nums"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InlineEdit
                    type="currency"
                    value={null}
                    placeholder="+ Valor"
                    onSave={(v) => updateBudgetField(b.id, "manual_total", v, "Valor")}
                    ariaLabel="Adicionar valor"
                  />
                </span>
              )}
            </div>

            {/* Row 2: Meta */}
            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground font-body flex-wrap">
              <span className="flex items-center gap-1"><User className="h-3 w-3 shrink-0" />{b.client_name}</span>
              {(b.bairro || b.city) && (
                <span className="flex items-center gap-1"><Building2 className="h-3 w-3 shrink-0" />{[b.bairro, b.city].filter(Boolean).join(", ")}</span>
              )}
              <span className="flex items-center gap-1" title="Orçamentista">
                <FileText className="h-3 w-3 shrink-0" />{getProfileName(b.estimator_owner_id)}
              </span>
              {timeAgo && <span>{timeAgo}</span>}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Quick action buttons */}
            {b.internal_status === "delivered_to_sales" && (
              <Button variant="default" size="sm" className="h-7 text-xs gap-1 px-2.5" onClick={() => changeStatus(b.id, "sent_to_client")}>
                <Send className="h-3 w-3" /><span className="hidden sm:inline">Enviar</span>
              </Button>
            )}
            {["delivered_to_sales", "sent_to_client"].includes(b.internal_status) && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2" onClick={() => setRevisionBudget(b)}>
                <RotateCcw className="h-3 w-3" /><span className="hidden sm:inline">Revisão</span>
              </Button>
            )}
            {b.public_id && (
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => copyPublicLink(b.public_id)} title="Copiar link">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            <BudgetActionsMenu
              budget={b}
              onRefresh={loadData}
              fromPath="/admin/comercial"
              extraItems={
                <>
                  <DropdownMenuItem onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                    <FileText className="h-4 w-4 mr-2" />Ver detalhes
                  </DropdownMenuItem>
                  {!isLocked && (
                    <>
                      <DropdownMenuSeparator />
                      {b.internal_status !== "lost" && b.internal_status !== "sent_to_client" && b.internal_status !== "delivered_to_sales" && (
                        <DropdownMenuItem onClick={() => changeStatus(b.id, "lost")}>
                          <XCircle className="h-4 w-4 mr-2" />Marcar como perdido
                        </DropdownMenuItem>
                      )}
                      {b.internal_status === "sent_to_client" && (
                        <>
                          <DropdownMenuItem onClick={() => changeStatus(b.id, "minuta_solicitada")}>
                            <FileText className="h-4 w-4 mr-2" />Solicitar minuta
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeStatus(b.id, "contrato_fechado")}>
                            <ThumbsUp className="h-4 w-4 mr-2" />Fechar contrato
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => changeStatus(b.id, "lost")}>
                            <XCircle className="h-4 w-4 mr-2" />Marcar como perdido
                          </DropdownMenuItem>
                        </>
                      )}
                    </>
                  )}
                </>
              }
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 hidden sm:block" />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="shrink-0 h-8 w-8 sm:h-9 sm:w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-0">
                <h1 className="text-base sm:text-lg font-semibold font-display text-foreground truncate">Meus Negócios</h1>
                <p className="text-[11px] sm:text-sm text-muted-foreground font-body truncate">
                  {profile?.full_name || "Comercial"} · {counts.total} negócio{counts.total !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Button size="sm" onClick={() => setNewDealOpen(true)} className="h-8 px-2.5 sm:h-9 sm:px-3">
                <Plus className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Criar Negócio</span>
                <span className="sr-only sm:hidden">Criar negócio</span>
              </Button>
              <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm" className="h-7 px-2 sm:px-2.5 gap-1 sm:gap-1.5 text-xs"
                  onClick={() => setViewMode("list")}
                  aria-label="Visualização em lista"
                >
                  <LayoutList className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Lista</span>
                </Button>
                <Button
                  variant={viewMode === "kanban" ? "secondary" : "ghost"}
                  size="sm" className="h-7 px-2 sm:px-2.5 gap-1 sm:gap-1.5 text-xs"
                  onClick={() => setViewMode("kanban")}
                  aria-label="Visualização kanban"
                >
                  <Columns3 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Kanban</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 space-y-4 sm:space-y-5 pb-24 lg:pb-6">
          {queueFilter && (
            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] px-3 py-2.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] uppercase tracking-wide text-primary/70 font-medium">
                    Filtro de fila ativo
                  </p>
                  <p className="text-sm font-medium text-foreground truncate">
                    {queueFilter === "prontos" && `Prontos para enviar — ${filtered.length} negócio${filtered.length !== 1 ? "s" : ""} entregue${filtered.length !== 1 ? "s" : ""} pelo orçamentista, aguardando envio ao cliente`}
                    {queueFilter === "sem-vis" && `Sem visualização há mais de 48h — ${filtered.length} negócio${filtered.length !== 1 ? "s" : ""} enviado${filtered.length !== 1 ? "s" : ""} ao cliente sem nenhuma abertura`}
                    {queueFilter === "esfriando" && `Esfriando — ${filtered.length} negócio${filtered.length !== 1 ? "s" : ""} parado${filtered.length !== 1 ? "s" : ""} além do tempo máximo da etapa`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => {
                    setQueueFilter(null);
                    navigate("/admin/comercial", { replace: true });
                  }}
                >
                  Limpar filtro
                </Button>
              </div>

              {queueFilter === "sem-vis" && (
                <div className="rounded-md border border-border/60 bg-background/60 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">
                    Critérios aplicados
                  </p>
                  <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-4 gap-y-1 text-xs text-foreground/80">
                    <li className="flex items-center gap-1.5">
                      <Send className="h-3 w-3 text-primary shrink-0" />
                      <span><span className="font-mono text-[11px] text-muted-foreground">internal_status</span> = <span className="font-medium">sent_to_client</span></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Eye className="h-3 w-3 text-primary shrink-0" />
                      <span><span className="font-mono text-[11px] text-muted-foreground">view_count</span> = <span className="font-medium">0</span></span>
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-primary shrink-0" />
                      <span><span className="font-mono text-[11px] text-muted-foreground">generated_at</span> (ou <span className="font-mono text-[11px] text-muted-foreground">updated_at</span>) ≥ <span className="font-medium">48h</span></span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}
          {/* Compact summary strip — desktop */}
          <div className="hidden lg:flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-xs font-body text-muted-foreground">
            {counts.needsAction > 0 && (
              <button onClick={() => setStatusFilter("entregue")} className="flex items-center gap-1 text-success font-medium hover:underline">
                <CheckCircle2 className="h-3 w-3" />
                {counts.needsAction} para enviar
              </button>
            )}
            {counts.overdue > 0 && (
              <button onClick={() => setDueFilter("overdue")} className="flex items-center gap-1 text-destructive font-medium hover:underline">
                <AlertTriangle className="h-3 w-3" />
                {counts.overdue} atrasado{counts.overdue > 1 ? "s" : ""}
              </button>
            )}
            {counts.dueToday > 0 && (
              <span className="flex items-center gap-1 text-warning font-medium">
                <Flame className="h-3 w-3" />
                {counts.dueToday} vence{counts.dueToday > 1 ? "m" : ""} hoje
              </span>
            )}
            <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {counts.solicitado ?? 0} solicitado{(counts.solicitado ?? 0) !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {counts.em_elaboracao ?? 0} em elaboração</span>
            <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {counts.enviado ?? 0} enviado{(counts.enviado ?? 0) !== 1 ? "s" : ""}</span>
            <span className="flex items-center gap-1 ml-auto text-muted-foreground/60"><ThumbsUp className="h-3 w-3" /> {counts.fechado ?? 0} fechado{(counts.fechado ?? 0) !== 1 ? "s" : ""}</span>
          </div>

          {/* Mobile filter chips */}
          <MobileFilterChips
            chips={[
              { id: "all", label: "Todos", count: counts.total },
              { id: "entregue", label: "Para Enviar", icon: CheckCircle2, count: counts.entregue ?? 0 },
              { id: "em_elaboracao", label: "Em Elaboração", icon: Clock, count: counts.em_elaboracao ?? 0 },
              { id: "revisao_solicitada", label: "Revisão Sol.", icon: RotateCcw, count: counts.revisao_solicitada ?? 0 },
              { id: "enviado", label: "Enviados", icon: Send, count: counts.enviado ?? 0 },
              { id: "solicitado", label: "Solicitados", icon: FileText, count: counts.solicitado ?? 0 },
              { id: "fechado", label: "Fechados", icon: ThumbsUp, count: counts.fechado ?? 0 },
            ] as FilterChip[]}
            activeChipId={statusFilter}
            onChipChange={(id) => setStatusFilter(id)}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar cliente, projeto..."
            resultCount={filtered.length}
            totalCount={dedupedBudgets.length}
          />

          {/* Compact filter bar — desktop */}
          <div className="hidden lg:block space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Buscar cliente, projeto, bairro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-muted flex items-center justify-center hover:bg-muted-foreground/20">
                    <X className="h-2.5 w-2.5 text-muted-foreground" />
                  </button>
                )}
              </div>

              {hasActiveFilters && (
                <Badge
                  variant="secondary"
                  className="h-7 px-2 text-[11px] font-mono tabular-nums whitespace-nowrap"
                  aria-live="polite"
                  title="Resultados após aplicar busca e filtros"
                >
                  {filtered.length} de {dedupedBudgets.length}
                </Badge>
              )}

              <div className="h-5 w-px bg-border" />

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className={`w-[160px] h-8 text-xs ${statusFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
                  <SlidersHorizontal className="h-3 w-3 mr-1 shrink-0" />
                  <SelectValue placeholder="Pipeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(PIPELINE_SECTIONS).map(([key, sec]) => (
                    <SelectItem key={key} value={key}>{sec.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dueFilter} onValueChange={v => setDueFilter(v as DueFilter)}>
                <SelectTrigger className={`w-[150px] h-8 text-xs ${dueFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
                  <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os prazos</SelectItem>
                  <SelectItem value="overdue">🔴 Vencidos / Hoje</SelectItem>
                  <SelectItem value="due_soon">🟡 Próximos (≤2d)</SelectItem>
                </SelectContent>
              </Select>

              {isAdmin && commercialOptions.length > 0 && (
                <Select value={commercialFilter} onValueChange={setCommercialFilter}>
                  <SelectTrigger className={`w-[150px] h-8 text-xs ${commercialFilter !== "all" ? "border-primary/40 bg-primary/5" : ""}`}>
                    <User className="h-3 w-3 mr-1 shrink-0" />
                    <SelectValue placeholder="Comercial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Comercial</SelectItem>
                    {commercialOptions.map(opt => (
                      <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="h-5 w-px bg-border" />

              <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <ArrowUpDown className="h-3 w-3 mr-1 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Mais urgente</SelectItem>
                  <SelectItem value="prazo">Prazo próximo</SelectItem>
                  <SelectItem value="recente">Mais recente</SelectItem>
                </SelectContent>
              </Select>

              <div className="h-5 w-px bg-border" />

              <SavedViewsBar
                entity="budgets"
                currentFilters={{ search, statusFilter, dueFilter, commercialFilter, sortBy }}
                onApply={(f) => {
                  if (typeof f.search === "string") setSearch(f.search);
                  if (typeof f.statusFilter === "string") setStatusFilter(f.statusFilter);
                  if (typeof f.dueFilter === "string") setDueFilter(f.dueFilter as DueFilter);
                  if (typeof f.commercialFilter === "string") setCommercialFilter(f.commercialFilter);
                  if (typeof f.sortBy === "string") setSortBy(f.sortBy as SortOption);
                }}
              />
            </div>

            {/* Active filters summary */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 text-xs font-body text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">{filtered.length}</Badge>
                  resultado{filtered.length !== 1 ? "s" : ""}
                </span>
                {activeFilterCount > 0 && (
                  <>
                    <span>·</span>
                    <span>{activeFilterCount} filtro{activeFilterCount > 1 ? "s" : ""} ativo{activeFilterCount > 1 ? "s" : ""}</span>
                  </>
                )}
                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[11px] text-primary hover:text-primary gap-0.5" onClick={clearAllFilters}>
                  <X className="h-3 w-3" />Limpar
                </Button>
              </div>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground font-body">Carregando orçamentos...</p>
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-base sm:text-lg font-semibold font-display text-foreground mb-1">
                {hasActiveFilters ? "Nenhum resultado" : "Nenhum orçamento ainda"}
              </h2>
              <p className="text-sm text-muted-foreground font-body max-w-sm">
                {hasActiveFilters ? "Ajuste os filtros para encontrar o que procura." : "Crie uma nova solicitação de orçamento para começar."}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters}>
                    <X className="h-4 w-4 mr-1.5" />Limpar filtros
                  </Button>
                )}
                {!hasActiveFilters && (
                  <Button onClick={() => setNewDealOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" />Criar Negócio
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Pipeline switcher (Inbound / Indicação / Re-engajamento) */}
          {(pipelinesLoading || pipelines.length > 0) && (
            <PipelineSwitcher
              pipelines={pipelines}
              activeSlug={pipelineFilter}
              onChange={setPipelineFilter}
              counts={pipelineCounts}
              loading={pipelinesLoading}
            />
          )}

          {/* Kanban view */}
          {!loading && viewMode === "kanban" && budgets.length > 0 && (
            <KanbanBoard
              budgets={filtered}
              onStatusChange={changeStatus}
              onCardClick={(id) => navigate(`/admin/demanda/${id}`)}
              getProfileName={getProfileName}
              syncedBudgetIds={syncedBudgetIds}
              pipelineMeta={pipelineMetaMap}
              temperatureMap={temperatureMap}
              nextActionMap={nextActionMap}
              leadScoreMap={leadScoreMap}
              onNextAction={handleNextActionClick}
              onOpenHistory={(b) => setHistoryBudget(b as unknown as BudgetRow)}
              onRefresh={loadData}
            />
          )}

          {/* List view with workflow groups */}
          {!loading && viewMode === "list" && filtered.length > 0 && (
            <div className="space-y-6">
              {isDefaultView && workflowGroups.length > 0 ? (
                workflowGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    {/* Group header */}
                    <div className={`flex items-center gap-2 border-l-2 ${group.borderAccent} pl-3 py-1`}>
                      <span className={`${group.accent}`}>{group.icon}</span>
                      <h3 className={`text-sm font-display font-semibold ${group.accent}`}>{group.label}</h3>
                      <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">{group.budgets.length}</Badge>
                      <span className="text-[11px] font-body text-muted-foreground ml-1">{group.description}</span>
                    </div>
                    <div className="space-y-1.5">
                      {group.budgets.map(b => renderBudgetCard(b))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="space-y-1.5">
                  {filtered.map(b => renderBudgetCard(b))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <RevisionRequestDialog
        open={!!revisionBudget}
        onOpenChange={(open) => { if (!open) setRevisionBudget(null); }}
        budgetId={revisionBudget?.id ?? ""}
        currentStatus={revisionBudget?.internal_status ?? "sent_to_client"}
        onSuccess={handleRevisionRequestSuccess}
      />

      <ContractUploadModal
        open={!!contractUploadBudget}
        onOpenChange={(open) => { if (!open) setContractUploadBudget(null); }}
        budgetId={contractUploadBudget?.id ?? ""}
        projectName={contractUploadBudget?.project_name || contractUploadBudget?.client_name || ""}
        onSuccess={handleContractUploadSuccess}
      />

      <ClientForm
        open={newDealOpen}
        onOpenChange={setNewDealOpen}
        initial={
          newDealOpen
            ? ({
                // Pré-atribui o comercial atual (não-admins) para que o card
                // criado já apareça com dono no pipeline e nas listagens.
                commercial_owner_id: !isAdmin && user?.id ? user.id : null,
                status: "lead",
              } as Partial<import("@/hooks/useClients").Client>)
            : null
        }
        onSaved={() => {
          setNewDealOpen(false);
          toast.success("Negócio criado!", {
            description: "O cliente foi cadastrado e um card foi criado na etapa Lead.",
          });
          loadData();
        }}
      />

      <AlertDialog open={!!confirmCloseBudgetId} onOpenChange={(open) => { if (!open) setConfirmCloseBudgetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar envio ao cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca o orçamento como enviado ao cliente. Deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (confirmCloseBudgetId) { changeStatus(confirmCloseBudgetId, "sent_to_client"); setConfirmCloseBudgetId(null); } }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LostReasonDialog
        open={!!pendingLostBudgetId}
        onOpenChange={(open) => { if (!open) setPendingLostBudgetId(null); }}
        onConfirm={confirmLostReason}
      />

      <NewActivityDialog
        open={!!nextActionBudgetId}
        onOpenChange={(open) => {
          if (!open) {
            setNextActionBudgetId(null);
            setNextActionPreset(null);
          }
        }}
        budgetId={nextActionBudgetId ?? undefined}
        presetType={nextActionPreset?.type}
        presetTitle={nextActionPreset?.title}
      />

      <BudgetCommunicationDrawer
        open={!!historyBudget}
        onOpenChange={(open) => { if (!open) setHistoryBudget(null); }}
        budgetId={historyBudget?.id ?? null}
        budget={historyBudget ? {
          id: historyBudget.id,
          client_name: historyBudget.client_name,
          project_name: historyBudget.project_name,
          client_phone: historyBudget.client_phone,
          public_id: historyBudget.public_id,
        } : null}
        getProfileName={getProfileName}
      />
    </>
  );
}
