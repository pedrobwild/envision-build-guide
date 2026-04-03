import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Calendar,
  User,
  Building2,
  ArrowLeft,
  Loader2,
  Inbox,
  Clock,
  AlertTriangle,
  MoreVertical,
  FileText,
  ExternalLink,
  CheckCircle2,
  PauseCircle,
  ArrowUpDown,
  Flame,
  GitCompare,
  LayoutList,
  Kanban,
  Send,
  FileSignature,
  UserCog,
  Handshake,
  RotateCcw,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { ProductionFunnel } from "@/components/editor/ProductionFunnel";
import { MobileFilterChips, type FilterChip } from "@/components/admin/MobileFilterChips";
import { format, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { EstimatorKanban } from "@/components/editor/EstimatorKanban";
import { NewBudgetModal } from "@/components/editor/NewBudgetModal";
import { Plus } from "lucide-react";

// Statuses relevant for the estimator's active queue
const ESTIMATOR_ACTIVE_STATUSES: InternalStatus[] = [
  "assigned",
  "in_progress",
  "waiting_info",
  "blocked",
  "ready_for_review",
];

type SortOption = "urgente" | "recente" | "prazo";

function getEstimatorStage(status: string): "pending" | "in_progress" | "review" | "delivered" | "finished" {
  if (["requested", "novo", "triage", "assigned"].includes(status)) return "pending";
  if (["in_progress", "waiting_info", "blocked", "revision_requested"].includes(status)) return "in_progress";
  if (status === "ready_for_review") return "review";
  if (["delivered_to_sales", "sent_to_client", "minuta_solicitada"].includes(status)) return "delivered";
  return "finished";
}

interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
  property_type: string | null;
  city: string | null;
  bairro: string | null;
  internal_status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  briefing: string | null;
  demand_context: string | null;
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

export default function EstimatorDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading, isAdmin } = useUserProfile();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [userRoles, setUserRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [estimatorFilter, setEstimatorFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgente");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // Assignment dialog state
  const [assignDialog, setAssignDialog] = useState<{
    open: boolean;
    budgetId: string;
    type: "estimator" | "commercial";
    currentValue: string | null;
  }>({ open: false, budgetId: "", type: "estimator", currentValue: null });
  const [assignValue, setAssignValue] = useState<string>("");
  const [assigning, setAssigning] = useState(false);
  const [newBudgetOpen, setNewBudgetOpen] = useState(false);

  useEffect(() => {
    if (!user || profileLoading) return;
    loadData();
  }, [user, profileLoading]);

  async function loadData() {
    setLoading(true);
    const adminCheck = profile?.roles.includes("admin");
    let budgetQuery = supabase
      .from("budgets")
      .select(
        "id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, updated_at, commercial_owner_id, estimator_owner_id, briefing, demand_context, version_number, version_group_id, is_current_version"
      )
      .order("created_at", { ascending: false });
    if (!adminCheck) {
      budgetQuery = budgetQuery.eq("estimator_owner_id", user!.id);
    }
    const [budgetsRes, profilesRes, rolesRes] = await Promise.all([
      budgetQuery,
      supabase.from("profiles").select("id, full_name"),
      adminCheck ? supabase.from("user_roles").select("user_id, role") : Promise.resolve({ data: [] }),
    ]);

    if (budgetsRes.data) setBudgets(budgetsRes.data as BudgetRow[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (rolesRes.data) setUserRoles(rolesRes.data as RoleRow[]);
    setLoading(false);
  }

  // Get users by role for assignment
  const getUsersByRole = useCallback(
    (role: "orcamentista" | "comercial") => {
      const userIds = userRoles.filter((r) => r.role === role).map((r) => r.user_id);
      return profiles.filter((p) => userIds.includes(p.id));
    },
    [profiles, userRoles]
  );

  async function handleAssign() {
    if (!assignValue) return;
    setAssigning(true);
    const field = assignDialog.type === "estimator" ? "estimator_owner_id" : "commercial_owner_id";
    const { error } = await supabase
      .from("budgets")
      .update({ [field]: assignValue, updated_at: new Date().toISOString() } as any)
      .eq("id", assignDialog.budgetId);

    if (error) {
      toast.error("Erro ao atribuir responsável.");
    } else {
      setBudgets((prev) =>
        prev.map((b) =>
          b.id === assignDialog.budgetId ? { ...b, [field]: assignValue, updated_at: new Date().toISOString() } : b
        )
      );
      const name = profiles.find((p) => p.id === assignValue)?.full_name ?? "";
      toast.success(`${assignDialog.type === "estimator" ? "Orçamentista" : "Comercial"} atribuído: ${name}`);
    }
    setAssigning(false);
    setAssignDialog({ open: false, budgetId: "", type: "estimator", currentValue: null });
  }

  const getProfileName = useCallback(
    (id: string | null) => {
      if (!id) return "—";
      return profiles.find((p) => p.id === id)?.full_name || "—";
    },
    [profiles]
  );

  const commercialOptions = useMemo(() => {
    if (!isAdmin) return [];
    const ids = [...new Set(budgets.map((b) => b.commercial_owner_id).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: getProfileName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, budgets, getProfileName]);

  const estimatorOptions = useMemo(() => {
    if (!isAdmin) return [];
    const ids = [...new Set(budgets.map((b) => b.estimator_owner_id).filter(Boolean))] as string[];
    return ids.map((id) => ({ id, name: getProfileName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, budgets, getProfileName]);

  // Deadline helpers
  const getDueInfo = (dueAt: string | null) => {
    if (!dueAt) return { label: null, variant: "default" as const };
    const dueDate = new Date(dueAt);
    const days = differenceInCalendarDays(dueDate, new Date());

    if (isPast(dueDate) && !isToday(dueDate))
      return {
        label: `${Math.abs(days)}d atrasado`,
        variant: "overdue" as const,
      };
    if (isToday(dueDate))
      return { label: "Vence hoje", variant: "today" as const };
    if (days <= 2)
      return { label: `${days}d restante${days > 1 ? "s" : ""}`, variant: "soon" as const };
    return {
      label: format(dueDate, "dd MMM", { locale: ptBR }),
      variant: "default" as const,
    };
  };

  // Summary counts aligned with the 5 funnel stages
  const PENDING_STATUSES = ["requested", "novo", "triage", "assigned"];
  const IN_PROGRESS_STATUSES = ["in_progress", "waiting_info", "blocked", "revision_requested"];
  const REVIEW_STATUSES = ["ready_for_review"];
  const DELIVERED_STATUSES = ["delivered_to_sales", "sent_to_client", "minuta_solicitada"];
  const FINISHED_STATUSES = ["lost", "archived"];

  const counts = useMemo(() => {
    return {
      total: budgets.length,
      overdue: budgets.filter(
        (b) => b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at)) &&
          [...PENDING_STATUSES, ...IN_PROGRESS_STATUSES, ...REVIEW_STATUSES].includes(b.internal_status)
      ).length,
      dueToday: budgets.filter(
        (b) => b.due_at && isToday(new Date(b.due_at)) &&
          [...PENDING_STATUSES, ...IN_PROGRESS_STATUSES, ...REVIEW_STATUSES].includes(b.internal_status)
      ).length,
      pending: budgets.filter((b) => PENDING_STATUSES.includes(b.internal_status)).length,
      inProgress: budgets.filter((b) => IN_PROGRESS_STATUSES.includes(b.internal_status)).length,
      review: budgets.filter((b) => REVIEW_STATUSES.includes(b.internal_status)).length,
      delivered: budgets.filter((b) => DELIVERED_STATUSES.includes(b.internal_status)).length,
      finished: budgets.filter((b) => FINISHED_STATUSES.includes(b.internal_status)).length,
    };
  }, [budgets]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = budgets.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        b.client_name.toLowerCase().includes(q) ||
        b.project_name.toLowerCase().includes(q) ||
        (b.bairro ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || b.internal_status === statusFilter;
      const matchPriority = priorityFilter === "all" || b.priority === priorityFilter;
      const matchCommercial =
        commercialFilter === "all" || b.commercial_owner_id === commercialFilter;
      const matchEstimator =
        estimatorFilter === "all" || b.estimator_owner_id === estimatorFilter;
      return matchSearch && matchStatus && matchPriority && matchCommercial && matchEstimator;
    });

    const priorityOrder: Record<string, number> = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

    result.sort((a, b) => {
      if (sortBy === "urgente") {
        const pa = priorityOrder[a.priority] ?? 2;
        const pb = priorityOrder[b.priority] ?? 2;
        if (pa !== pb) return pa - pb;
        // Then by due_at ascending (nulls last)
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
      // recente
      return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
    });

    return result;
  }, [budgets, search, statusFilter, priorityFilter, commercialFilter, estimatorFilter, sortBy]);

  // Quick status change
  async function changeStatus(budgetId: string, newStatus: InternalStatus) {
    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", budgetId);

    if (error) {
      toast.error("Erro ao atualizar status.");
      return;
    }

    setBudgets((prev) =>
      prev.map((b) =>
        b.id === budgetId
          ? { ...b, internal_status: newStatus, updated_at: new Date().toISOString() }
          : b
      )
    );

    const statusLabel = INTERNAL_STATUSES[newStatus]?.label ?? newStatus;
    toast.success(`Status atualizado para "${statusLabel}"`);
  }

  const dueVariantStyles = {
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    today: "bg-warning/10 text-warning border-warning/20",
    soon: "bg-warning/10 text-warning border-warning/20",
    default: "text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold font-display text-foreground">
                Minha Fila de Orçamentos
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                {profile?.full_name || "Orçamentista"} · {counts.total} demanda{counts.total !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {/* View toggle + New button */}
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button size="sm" className="gap-1.5" onClick={() => setNewBudgetOpen(true)}>
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Nova Solicitação</span>
              </Button>
            )}
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 gap-1.5 text-xs"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-3.5 w-3.5" />
                Lista
              </Button>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 px-2.5 gap-1.5 text-xs"
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-5">
        {/* Full-page loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground font-body">Carregando demandas...</p>
          </div>
        )}

        {!loading && (
          <>
        {/* Production Funnel */}
        <ProductionFunnel
          budgets={budgets}
          onStageClick={(statuses) => {
            // If a single status matches a filter option, use it; otherwise show all
            if (statuses.length === 1) {
              setStatusFilter(statuses[0]);
            } else {
              setStatusFilter("all");
            }
          }}
        />

        {/* Summary cards — desktop */}
        <div className="hidden lg:grid grid-cols-7 gap-3">
          <SummaryCard
            label="Atrasadas"
            count={counts.overdue}
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="text-destructive"
            onClick={() => setStatusFilter("all")}
          />
          <SummaryCard
            label="Vence hoje"
            count={counts.dueToday}
            icon={<Flame className="h-4 w-4" />}
            accent="text-warning"
          />
          <SummaryCard
            label="Pendente"
            count={counts.pending}
            icon={<Inbox className="h-4 w-4" />}
            accent="text-primary"
            onClick={() => setStatusFilter("assigned")}
          />
          <SummaryCard
            label="Em Elaboração"
            count={counts.inProgress}
            icon={<Clock className="h-4 w-4" />}
            accent="text-warning"
            onClick={() => setStatusFilter("in_progress")}
          />
          <SummaryCard
            label="Em Revisão"
            count={counts.review}
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="text-warning"
            onClick={() => setStatusFilter("ready_for_review")}
          />
          <SummaryCard
            label="Entregue"
            count={counts.delivered}
            icon={<Send className="h-4 w-4" />}
            accent="text-success"
            onClick={() => setStatusFilter("delivered_to_sales")}
          />
          <SummaryCard
            label="Finalizado"
            count={counts.finished}
            icon={<FileSignature className="h-4 w-4" />}
            accent="text-success"
            onClick={() => setStatusFilter("sent_to_client")}
          />
        </div>

        {/* Mobile filter chips */}
        <MobileFilterChips
          chips={[
            { id: "all", label: "Todos", count: counts.total },
            { id: "overdue", label: "Atrasados", icon: AlertTriangle, count: counts.overdue, color: "destructive" },
            { id: "urgente", label: "Urgentes", icon: Flame, count: budgets.filter(b => b.priority === "urgente").length },
            { id: "today", label: "Hoje", icon: Clock, count: counts.dueToday },
            { id: "assigned", label: "Pendente", icon: Inbox, count: counts.pending },
            { id: "in_progress", label: "Em Elaboração", count: counts.inProgress },
            { id: "ready_for_review", label: "Revisão", count: counts.review },
          ] as FilterChip[]}
          activeChipId={
            priorityFilter === "urgente" ? "urgente" :
            statusFilter !== "all" ? statusFilter :
            "all"
          }
          onChipChange={(id) => {
            if (id === "all") {
              setStatusFilter("all");
              setPriorityFilter("all");
            } else if (id === "overdue") {
              setStatusFilter("all");
              setPriorityFilter("all");
              // We'll use status filter + due filter logic — for now just show all and let sort handle it
              setSortBy("prazo");
              setStatusFilter("all");
            } else if (id === "urgente") {
              setPriorityFilter("urgente");
              setStatusFilter("all");
            } else if (id === "today") {
              setStatusFilter("all");
              setPriorityFilter("all");
              setSortBy("prazo");
            } else {
              setPriorityFilter("all");
              setStatusFilter(id);
            }
          }}
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Buscar cliente, projeto..."
        />

        {/* Kanban View */}
        {viewMode === "kanban" && !loading && (
          <EstimatorKanban
            budgets={budgets.filter(b => (commercialFilter === "all" || b.commercial_owner_id === commercialFilter) && (estimatorFilter === "all" || b.estimator_owner_id === estimatorFilter))}
            onStatusChange={async (budgetId, newStatus) => {
              await changeStatus(budgetId, newStatus);
            }}
            onCardClick={(id) => navigate(`/admin/budget/${id}`, { state: { from: "/admin/producao" } })}
            getProfileName={getProfileName}
          />
        )}

        {/* List View */}
        {viewMode === "list" && (
          <>
            {/* Filters */}
            <div className="hidden lg:flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, projeto, bairro..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  {Object.entries(INTERNAL_STATUSES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {Object.entries(PRIORITIES).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && commercialOptions.length > 0 && (
                <Select value={commercialFilter} onValueChange={setCommercialFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <User className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Comercial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os comerciais</SelectItem>
                    {commercialOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {isAdmin && estimatorOptions.length > 0 && (
                <Select value={estimatorFilter} onValueChange={setEstimatorFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <UserCog className="h-3.5 w-3.5 mr-1.5" />
                    <SelectValue placeholder="Orçamentista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os orçamentistas</SelectItem>
                    {estimatorOptions.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                <SelectTrigger className="w-full sm:w-[170px]">
                  <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="urgente">Mais urgente</SelectItem>
                  <SelectItem value="prazo">Prazo mais próximo</SelectItem>
                  <SelectItem value="recente">Mais recente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Empty state */}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Inbox className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold font-display text-foreground mb-1">
                  {search || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Nenhum resultado"
                    : "Nenhuma demanda atribuída"}
                </h2>
                <p className="text-sm text-muted-foreground font-body max-w-sm">
                  {search || statusFilter !== "all" || priorityFilter !== "all"
                    ? "Ajuste os filtros para encontrar o que procura."
                    : "Quando um orçamento for atribuído a você, ele aparecerá aqui."}
                </p>
              </div>
            )}

            {/* List */}
            {!loading && filtered.length > 0 && (
              <div className="space-y-2">
                {filtered.map((b) => {
                  const status =
                    INTERNAL_STATUSES[b.internal_status as InternalStatus] ??
                    INTERNAL_STATUSES.assigned;
                  const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
                  const due = getDueInfo(b.due_at);

                  return (
                    <Card
                      key={b.id}
                      className="p-4 hover:shadow-md transition-shadow border group"
                    >
                      <div className="flex items-start gap-4">
                        {/* Main content */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}
                        >
                          {/* Row 1: Project + badges */}
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            <span className="font-semibold font-display text-foreground truncate">
                              {b.project_name || "Sem nome"}
                            </span>
                            <Badge variant="secondary" className={`text-xs font-body ${status.color}`}>
                              {status.icon} {status.label}
                            </Badge>
                            {b.priority !== "normal" && (
                              <Badge variant="outline" className={`text-xs font-body ${prio.color}`}>
                                {prio.label}
                              </Badge>
                            )}
                            {due.label && (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-medium font-body px-2 py-0.5 rounded-full border ${dueVariantStyles[due.variant]}`}
                              >
                                <Calendar className="h-3 w-3" />
                                {due.label}
                              </span>
                            )}
                            {(b.version_number ?? 1) > 1 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                                V{b.version_number}
                              </span>
                            )}
                          </div>
                          {b.internal_status === "revision_requested" && (
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge className="bg-warning/10 text-warning border-warning/20 border text-xs font-body gap-1 px-2 py-0.5">
                                <RotateCcw className="h-3 w-3" />
                                Revisão solicitada
                              </Badge>
                            </div>
                          )}

                          {/* Row 2: Meta */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground font-body flex-wrap">
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {b.client_name}
                            </span>
                            {(b.bairro || b.city) && (
                              <span className="flex items-center gap-1">
                                <Building2 className="h-3.5 w-3.5" />
                                {[b.bairro, b.city].filter(Boolean).join(", ")}
                              </span>
                            )}
                            <span className="flex items-center gap-1" title="Comercial responsável">
                              <Handshake className="h-3.5 w-3.5" />
                              {getProfileName(b.commercial_owner_id)}
                            </span>
                            <span className="flex items-center gap-1" title="Orçamentista responsável">
                              <UserCog className="h-3.5 w-3.5" />
                              {getProfileName(b.estimator_owner_id)}
                            </span>
                            {b.created_at && (
                              <span className="text-xs">
                                Criado {format(new Date(b.created_at), "dd/MM/yy")}
                              </span>
                            )}
                            {b.updated_at && (
                              <span className="text-xs">
                                Atualizado {format(new Date(b.updated_at), "dd/MM HH:mm")}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick stage actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {(() => {
                            const stage = getEstimatorStage(b.internal_status);
                            const nextActions: { label: string; targetStatus: InternalStatus; icon: React.ReactNode; variant: "default" | "outline" | "secondary" }[] = [];

                            if (stage === "pending") {
                              nextActions.push({ label: "Iniciar", targetStatus: "in_progress", icon: <Clock className="h-3 w-3" />, variant: "default" });
                            } else if (stage === "in_progress") {
                              nextActions.push({ label: "Revisão", targetStatus: "ready_for_review", icon: <CheckCircle2 className="h-3 w-3" />, variant: "default" });
                            } else if (stage === "review") {
                              nextActions.push({ label: "Entregar", targetStatus: "delivered_to_sales", icon: <Send className="h-3 w-3" />, variant: "default" });
                            }

                            return nextActions.map((a) => (
                              <Button
                                key={a.targetStatus}
                                variant={a.variant}
                                size="sm"
                                className="h-7 text-xs gap-1 px-2.5"
                                onClick={(e) => { e.stopPropagation(); changeStatus(b.id, a.targetStatus); }}
                              >
                                {a.icon}
                                {a.label}
                              </Button>
                            ));
                          })()}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                              >
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                              <DropdownMenuItem onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/producao" } })}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Abrir orçamento
                              </DropdownMenuItem>
                              {b.briefing && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    toast.info(b.briefing, {
                                      duration: 10000,
                                      description: `Briefing — ${b.project_name}`,
                                    });
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Ver briefing
                                </DropdownMenuItem>
                              )}
                              {(b.version_number ?? 1) > 1 && b.version_group_id && (
                                <DropdownMenuItem onClick={() => navigate(`/admin/comparar?left=${b.version_group_id}&right=${b.id}`)}>
                                  <GitCompare className="h-4 w-4 mr-2" />
                                  Comparar versões
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {/* All 5 stage transitions in overflow */}
                              {!PENDING_STATUSES.includes(b.internal_status) && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "assigned")}>
                                  <Inbox className="h-4 w-4 mr-2" />
                                  Mover p/ Pendente
                                </DropdownMenuItem>
                              )}
                              {!IN_PROGRESS_STATUSES.includes(b.internal_status) && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "in_progress")}>
                                  <Clock className="h-4 w-4 mr-2" />
                                  Mover p/ Em Elaboração
                                </DropdownMenuItem>
                              )}
                              {b.internal_status !== "ready_for_review" && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "ready_for_review")}>
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mover p/ Em Revisão
                                </DropdownMenuItem>
                              )}
                              {!DELIVERED_STATUSES.includes(b.internal_status) && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "delivered_to_sales")}>
                                  <Send className="h-4 w-4 mr-2" />
                                  Mover p/ Entregue
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => {
                                    setAssignValue(b.estimator_owner_id ?? "");
                                    setAssignDialog({ open: true, budgetId: b.id, type: "estimator", currentValue: b.estimator_owner_id });
                                  }}>
                                    <UserCog className="h-4 w-4 mr-2" />
                                    Atribuir orçamentista
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => {
                                    setAssignValue(b.commercial_owner_id ?? "");
                                    setAssignDialog({ open: true, budgetId: b.id, type: "commercial", currentValue: b.commercial_owner_id });
                                  }}>
                                    <Handshake className="h-4 w-4 mr-2" />
                                    Atribuir comercial
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
          </>
        )}
      </div>

      {/* Assignment Dialog (admin only) */}
      <Dialog open={assignDialog.open} onOpenChange={(open) => {
        if (!open) setAssignDialog({ open: false, budgetId: "", type: "estimator", currentValue: null });
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {assignDialog.type === "estimator" ? "Atribuir Orçamentista" : "Atribuir Comercial"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={assignValue} onValueChange={setAssignValue}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um responsável" />
              </SelectTrigger>
              <SelectContent>
                {getUsersByRole(assignDialog.type === "estimator" ? "orcamentista" : "comercial").map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog({ open: false, budgetId: "", type: "estimator", currentValue: null })}>
              Cancelar
            </Button>
            <Button onClick={handleAssign} disabled={!assignValue || assigning}>
              {assigning && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Atribuir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewBudgetModal
        open={newBudgetOpen}
        onOpenChange={setNewBudgetOpen}
        onSuccess={() => loadData()}
      />
    </div>
  );
}

/* Small summary card component */
function SummaryCard({
  label,
  count,
  icon,
  accent,
  onClick,
}: {
  label: string;
  count: number;
  icon: React.ReactNode;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <Card
      className={`p-3 flex flex-col gap-1 ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-1.5 text-xs font-body ${accent}`}>
        {icon}
        {label}
      </div>
      <span className="text-2xl font-bold font-display text-foreground">{count}</span>
    </Card>
  );
}
