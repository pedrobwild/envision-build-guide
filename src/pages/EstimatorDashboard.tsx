import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Loader2,
  Inbox,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Flame,
  LayoutList,
  Kanban,
  Send,
  Plus,
} from "lucide-react";
import {
  INTERNAL_STATUSES,
  STATUS_GROUPS,
  type InternalStatus,
} from "@/lib/role-constants";
import { ProductionFunnel } from "@/components/editor/ProductionFunnel";
import { MobileFilterChips, type FilterChip } from "@/components/admin/MobileFilterChips";
import { isToday, isPast } from "date-fns";
import { toast } from "sonner";
import { EstimatorKanban } from "@/components/editor/EstimatorKanban";
import { NewBudgetModal } from "@/components/editor/NewBudgetModal";
import { TemplateSelectorDialog } from "@/components/editor/TemplateSelectorDialog";
import { EstimatorFilterBar, type SortOption } from "@/components/estimator/EstimatorFilterBar";
import { EstimatorListView, type BudgetRow } from "@/components/estimator/EstimatorListView";
import { NewRequestsSection } from "@/components/estimator/NewRequestsSection";
import { NotificationBell } from "@/components/estimator/NotificationBell";

const PENDING_STATUSES: readonly string[] = STATUS_GROUPS.PENDING;
const IN_PROGRESS_STATUSES: readonly string[] = STATUS_GROUPS.ACTIVE_WORK;
const REVIEW_STATUSES: readonly string[] = STATUS_GROUPS.REVIEW;
const DELIVERED_STATUSES: string[] = [...STATUS_GROUPS.DELIVERED, ...STATUS_GROUPS.COMMERCIAL_ADVANCED];
const FINISHED_STATUSES: readonly string[] = STATUS_GROUPS.FINISHED;
const HIDDEN_BY_DEFAULT_STATUSES = new Set([...DELIVERED_STATUSES, ...FINISHED_STATUSES]);
const PENDING_STATUSES_SET = new Set(["requested", "novo", "triage", "assigned"]);

interface ProfileRow {
  id: string;
  full_name: string;
}

interface RoleRow {
  user_id: string;
  role: string;
}

export default function EstimatorDashboard() {
  const location = useLocation();
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
  const [templateDialog, setTemplateDialog] = useState<{ open: boolean; budgetId: string; pendingStatus: InternalStatus }>({
    open: false,
    budgetId: "",
    pendingStatus: "in_progress",
  });

  useEffect(() => {
    if (!user || profileLoading) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profileLoading, location.key]);

  async function loadData() {
    setLoading(true);
    const adminCheck = profile?.roles.includes("admin");
    let budgetQuery = supabase
      .from("budgets")
      .select(
        "id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, updated_at, commercial_owner_id, estimator_owner_id, briefing, demand_context, version_number, version_group_id, is_current_version, sequential_code, metragem"
      )
      .order("created_at", { ascending: false });
    if (!adminCheck) {
      budgetQuery = budgetQuery.or(`estimator_owner_id.eq.${user!.id},estimator_owner_id.is.null`);
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
      .update({ [field]: assignValue, updated_at: new Date().toISOString() } as Record<string, unknown>)
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

  const filtered = useMemo(() => {
    const result = budgets.filter((b) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        b.client_name.toLowerCase().includes(q) ||
        b.project_name.toLowerCase().includes(q) ||
        (b.bairro ?? "").toLowerCase().includes(q);
      const matchStatus = statusFilter === "all"
        ? !HIDDEN_BY_DEFAULT_STATUSES.has(b.internal_status)
        : statusFilter === "_pending"
        ? PENDING_STATUSES.includes(b.internal_status)
        : statusFilter === "_in_progress"
        ? IN_PROGRESS_STATUSES.includes(b.internal_status)
        : statusFilter === "_delivered"
        ? DELIVERED_STATUSES.includes(b.internal_status)
        : statusFilter === "_finished"
        ? FINISHED_STATUSES.includes(b.internal_status)
        : b.internal_status === statusFilter;
      const matchPriority = priorityFilter === "all" || b.priority === priorityFilter;
      const matchCommercial = commercialFilter === "all" || b.commercial_owner_id === commercialFilter;
      const matchEstimator = estimatorFilter === "all" || b.estimator_owner_id === estimatorFilter;
      return matchSearch && matchStatus && matchPriority && matchCommercial && matchEstimator;
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
  }, [budgets, search, statusFilter, priorityFilter, commercialFilter, estimatorFilter, sortBy]);

  async function requestStatusChange(budgetId: string, newStatus: InternalStatus) {
    if (newStatus === "in_progress") {
      const budget = budgets.find((b) => b.id === budgetId);
      if (budget && PENDING_STATUSES_SET.has(budget.internal_status)) {
        const { count } = await supabase
          .from("sections")
          .select("id", { count: "exact", head: true })
          .eq("budget_id", budgetId);
        if ((count ?? 0) === 0) {
          setTemplateDialog({ open: true, budgetId, pendingStatus: newStatus });
          return;
        }
      }
    }
    changeStatus(budgetId, newStatus);
  }

  async function changeStatus(budgetId: string, newStatus: InternalStatus) {
    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() })
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

  const handleOpenAssignDialog = useCallback((budgetId: string, type: "estimator" | "commercial", currentValue: string | null) => {
    setAssignValue(currentValue ?? "");
    setAssignDialog({ open: true, budgetId, type, currentValue });
  }, []);

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
          <div className="flex items-center gap-2">
            {user && <NotificationBell userId={user.id} />}
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
                if (statuses.length === 1) {
                  setStatusFilter(statuses[0]);
                } else {
                  setStatusFilter("all");
                }
              }}
            />

            {/* Compact summary strip — desktop */}
            <div className="hidden lg:flex items-center gap-4 px-3 py-2 rounded-lg bg-muted/30 border border-border/50 text-xs font-body text-muted-foreground">
              {counts.overdue > 0 && (
                <button onClick={() => setStatusFilter("all")} className="flex items-center gap-1 text-destructive font-medium hover:underline">
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
              <span className="flex items-center gap-1"><Inbox className="h-3 w-3" /> {counts.pending} pendente{counts.pending !== 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {counts.inProgress} em elaboração</span>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> {counts.review} em revisão</span>
              <span className="flex items-center gap-1 ml-auto text-muted-foreground/60"><Send className="h-3 w-3" /> {counts.delivered} entregue{counts.delivered !== 1 ? "s" : ""}</span>
            </div>

            {/* Mobile filter chips */}
            <MobileFilterChips
              chips={[
                { id: "all", label: "Todos", count: counts.total },
                { id: "overdue", label: "Atrasados", icon: AlertTriangle, count: counts.overdue, color: "destructive" },
                { id: "urgente", label: "Urgentes", icon: Flame, count: budgets.filter(b => b.priority === "urgente").length },
                { id: "today", label: "Hoje", icon: Clock, count: counts.dueToday },
                { id: "_pending", label: "Pendente", icon: Inbox, count: counts.pending },
                { id: "_in_progress", label: "Em Elaboração", count: counts.inProgress },
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
                  setSortBy("prazo");
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
            {viewMode === "kanban" && (
              <EstimatorKanban
                budgets={budgets.filter(b => (commercialFilter === "all" || b.commercial_owner_id === commercialFilter) && (estimatorFilter === "all" || b.estimator_owner_id === estimatorFilter))}
                hideDelivered={statusFilter === "all"}
                onStatusChange={async (budgetId, newStatus) => {
                  requestStatusChange(budgetId, newStatus);
                }}
                onCardClick={(id) => navigate(`/admin/budget/${id}`, { state: { from: "/admin/producao" } })}
                getProfileName={getProfileName}
              />
            )}

            {/* List View */}
            {viewMode === "list" && (
              <>
                {user && (
                  <NewRequestsSection
                    budgets={budgets}
                    userId={user.id}
                    onStartBudget={requestStatusChange}
                  />
                )}

                <EstimatorFilterBar
                  search={search}
                  onSearchChange={setSearch}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  priorityFilter={priorityFilter}
                  onPriorityFilterChange={setPriorityFilter}
                  commercialFilter={commercialFilter}
                  onCommercialFilterChange={setCommercialFilter}
                  estimatorFilter={estimatorFilter}
                  onEstimatorFilterChange={setEstimatorFilter}
                  sortBy={sortBy}
                  onSortByChange={setSortBy}
                  commercialOptions={commercialOptions}
                  estimatorOptions={estimatorOptions}
                  isAdmin={isAdmin}
                  filteredCount={filtered.length}
                />

                <EstimatorListView
                  filtered={filtered}
                  loading={loading}
                  search={search}
                  statusFilter={statusFilter}
                  priorityFilter={priorityFilter}
                  counts={{ delivered: counts.delivered, finished: counts.finished }}
                  isAdmin={isAdmin}
                  getProfileName={getProfileName}
                  onRequestStatusChange={requestStatusChange}
                  onSetStatusFilter={setStatusFilter}
                  onOpenAssignDialog={handleOpenAssignDialog}
                  onRefresh={loadData}
                />
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

      <TemplateSelectorDialog
        open={templateDialog.open}
        budgetId={templateDialog.budgetId}
        onOpenChange={(open) => setTemplateDialog((prev) => ({ ...prev, open }))}
        onConfirm={() => {
          changeStatus(templateDialog.budgetId, templateDialog.pendingStatus);
          setTemplateDialog({ open: false, budgetId: "", pendingStatus: "in_progress" });
        }}
      />
    </div>
  );
}

