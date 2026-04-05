import { useEffect, useState, useMemo, useCallback } from "react";
import { BudgetActionsMenu } from "@/components/admin/BudgetActionsMenu";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Search, ArrowLeft, Loader2, Inbox, Clock, AlertTriangle,
  MoreVertical, ExternalLink, CheckCircle2, ArrowUpDown,
  Users, Building2, User, Calendar, FileText, BarChart3,
  Flame, Send, Shield, Pencil,
} from "lucide-react";
import {
  INTERNAL_STATUSES, PRIORITIES,
  type InternalStatus, type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface BudgetRow {
  id: string;
  client_name: string;
  project_name: string;
  internal_status: string;
  priority: string;
  due_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
  city: string | null;
  bairro: string | null;
}

interface ProfileRow { id: string; full_name: string; }
interface RoleRow { user_id: string; role: string; }

const ACTIVE_STATUSES: InternalStatus[] = [
  "requested", "triage", "assigned", "in_progress", "waiting_info", "ready_for_review",
];

type SortOption = "urgente" | "recente" | "prazo";

export default function AdminOperationsDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [estimatorFilter, setEstimatorFilter] = useState<string>("all");
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgente");

  // Edit dialog
  const [editBudget, setEditBudget] = useState<BudgetRow | null>(null);
  const [editEstimator, setEditEstimator] = useState<string>("");
  const [editPriority, setEditPriority] = useState<string>("");
  const [editStatus, setEditStatus] = useState<string>("");
  const [editDueAt, setEditDueAt] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    setLoading(true);
    const [budgetsRes, profilesRes, rolesRes] = await Promise.all([
      supabase.from("budgets").select(
        "id, client_name, project_name, internal_status, priority, due_at, created_at, updated_at, commercial_owner_id, estimator_owner_id, city, bairro"
      ).order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as BudgetRow[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    if (rolesRes.data) setRoles(rolesRes.data as RoleRow[]);
    setLoading(false);
  }

  const getProfileName = useCallback(
    (id: string | null) => (id ? profiles.find(p => p.id === id)?.full_name || "—" : "Não atribuído"),
    [profiles],
  );

  const estimators = useMemo(() =>
    roles.filter(r => r.role === "orcamentista").map(r => ({
      id: r.user_id,
      name: getProfileName(r.user_id),
    })),
    [roles, getProfileName],
  );

  const commercials = useMemo(() =>
    roles.filter(r => r.role === "comercial").map(r => ({
      id: r.user_id,
      name: getProfileName(r.user_id),
    })),
    [roles, getProfileName],
  );

  // Global metrics
  const metrics = useMemo(() => {
    const active = budgets.filter(b => ACTIVE_STATUSES.includes(b.internal_status as InternalStatus));
    const now = new Date();
    return {
      total: budgets.length,
      requested: budgets.filter(b => b.internal_status === "requested").length,
      triage: budgets.filter(b => b.internal_status === "triage").length,
      assigned: budgets.filter(b => b.internal_status === "assigned").length,
      inProgress: budgets.filter(b => b.internal_status === "in_progress").length,
      overdue: active.filter(b => b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at))).length,
      readyForReview: budgets.filter(b => b.internal_status === "ready_for_review").length,
      delivered: budgets.filter(b => b.internal_status === "delivered_to_sales").length,
      waitingInfo: budgets.filter(b => b.internal_status === "waiting_info").length,
    };
  }, [budgets]);

  // Workload per estimator
  const estimatorWorkload = useMemo(() => {
    return estimators.map(est => {
      const mine = budgets.filter(b => b.estimator_owner_id === est.id);
      const active = mine.filter(b => ACTIVE_STATUSES.includes(b.internal_status as InternalStatus));
      return {
        ...est,
        total: active.length,
        overdue: active.filter(b => b.due_at && isPast(new Date(b.due_at)) && !isToday(new Date(b.due_at))).length,
        dueToday: active.filter(b => b.due_at && isToday(new Date(b.due_at))).length,
        inProgress: mine.filter(b => b.internal_status === "in_progress").length,
      };
    }).sort((a, b) => b.total - a.total);
  }, [budgets, estimators]);

  // Workload per commercial
  const commercialWorkload = useMemo(() => {
    return commercials.map(com => {
      const mine = budgets.filter(b => b.commercial_owner_id === com.id);
      return {
        ...com,
        open: mine.filter(b => ACTIVE_STATUSES.includes(b.internal_status as InternalStatus)).length,
        ready: mine.filter(b => ["ready_for_review", "delivered_to_sales"].includes(b.internal_status)).length,
        waiting: mine.filter(b => b.internal_status === "waiting_info").length,
      };
    }).sort((a, b) => b.open - a.open);
  }, [budgets, commercials]);

  const getDueInfo = (dueAt: string | null) => {
    if (!dueAt) return { label: null, variant: "default" as const };
    const dueDate = new Date(dueAt);
    const days = differenceInCalendarDays(dueDate, new Date());
    if (isPast(dueDate) && !isToday(dueDate)) return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" as const };
    if (isToday(dueDate)) return { label: "Vence hoje", variant: "today" as const };
    if (days <= 2) return { label: `${days}d`, variant: "soon" as const };
    return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
  };

  // Filtered list
  const filtered = useMemo(() => {
    let result = budgets.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.client_name.toLowerCase().includes(q) || b.project_name.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || b.internal_status === statusFilter;
      const matchEstimator = estimatorFilter === "all" || b.estimator_owner_id === estimatorFilter;
      const matchCommercial = commercialFilter === "all" || b.commercial_owner_id === commercialFilter;
      return matchSearch && matchStatus && matchEstimator && matchCommercial;
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
  }, [budgets, search, statusFilter, estimatorFilter, commercialFilter, sortBy]);

  function openEditDialog(b: BudgetRow) {
    setEditBudget(b);
    setEditEstimator(b.estimator_owner_id ?? "");
    setEditPriority(b.priority);
    setEditStatus(b.internal_status);
    setEditDueAt(b.due_at ? format(new Date(b.due_at), "yyyy-MM-dd") : "");
  }

  async function saveEdit() {
    if (!editBudget || !user) return;
    setSaving(true);
    const updates: Record<string, any> = {
      priority: editPriority,
      internal_status: editStatus,
      updated_at: new Date().toISOString(),
    };
    if (editEstimator) updates.estimator_owner_id = editEstimator;
    if (editDueAt) updates.due_at = new Date(editDueAt).toISOString();
    else updates.due_at = null;

    const { error } = await supabase.from("budgets").update(updates).eq("id", editBudget.id);

    if (!error) {
      // Log status change if changed
      if (editStatus !== editBudget.internal_status) {
        await supabase.from("budget_events").insert({
          budget_id: editBudget.id,
          user_id: user.id,
          event_type: "status_change",
          from_status: editBudget.internal_status,
          to_status: editStatus,
          note: "Alterado pelo admin",
        });
      }
      // Log assignment if changed
      if (editEstimator && editEstimator !== editBudget.estimator_owner_id) {
        await supabase.from("budget_events").insert({
          budget_id: editBudget.id,
          user_id: user.id,
          event_type: "assignment",
          note: `Atribuído para ${getProfileName(editEstimator)}`,
        });
      }

      setBudgets(prev => prev.map(b => b.id === editBudget.id ? {
        ...b,
        ...updates,
        estimator_owner_id: editEstimator || b.estimator_owner_id,
      } : b));
      toast.success("Demanda atualizada");
      setEditBudget(null);
    } else {
      toast.error("Erro ao atualizar");
    }
    setSaving(false);
  }

  const dueVariantStyles = {
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    today: "bg-warning/10 text-warning border-warning/20",
    soon: "bg-amber-50 text-amber-700 border-amber-200",
    default: "text-muted-foreground",
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold font-display text-foreground flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Operações
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                Gestão global de demandas e carga de trabalho
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-4 space-y-6">
        {/* Global metrics */}
        <div>
          <h2 className="text-sm font-semibold font-display text-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Visão Geral
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-9 gap-2">
            {[
              { label: "Total", count: metrics.total, accent: "text-foreground" },
              { label: "Solicitados", count: metrics.requested, accent: "text-blue-600" },
              { label: "Triagem", count: metrics.triage, accent: "text-purple-600" },
              { label: "Atribuídos", count: metrics.assigned, accent: "text-indigo-600" },
              { label: "Em Produção", count: metrics.inProgress, accent: "text-yellow-600" },
              { label: "Aguard. Info", count: metrics.waitingInfo, accent: "text-amber-600" },
              { label: "Atrasados", count: metrics.overdue, accent: "text-destructive" },
              { label: "Revisão", count: metrics.readyForReview, accent: "text-orange-600" },
              { label: "Entregues", count: metrics.delivered, accent: "text-emerald-600" },
            ].map((m, i) => (
              <Card key={i} className="p-2.5">
                <p className={`text-[10px] font-body ${m.accent} truncate`}>{m.label}</p>
                <p className={`text-xl font-bold font-display ${m.accent}`}>{m.count}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Workload panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Estimator workload */}
          <div>
            <h2 className="text-sm font-semibold font-display text-foreground mb-3 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Carga por Orçamentista
            </h2>
            {estimatorWorkload.length === 0 ? (
              <Card className="p-4 text-center text-sm text-muted-foreground font-body">Nenhum orçamentista cadastrado</Card>
            ) : (
              <div className="space-y-2">
                {estimatorWorkload.map(est => (
                  <Card
                    key={est.id}
                    className={`p-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow ${est.overdue > 0 ? "border-destructive/40" : ""}`}
                    onClick={() => { setEstimatorFilter(est.id); setStatusFilter("all"); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium font-body text-sm text-foreground truncate">{est.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-body shrink-0">
                      <span className="text-foreground font-semibold">{est.total} ativas</span>
                      {est.overdue > 0 && (
                        <span className="text-destructive font-semibold flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" />{est.overdue}
                        </span>
                      )}
                      {est.dueToday > 0 && (
                        <span className="text-warning font-semibold flex items-center gap-1">
                          <Flame className="h-3 w-3" />{est.dueToday}
                        </span>
                      )}
                      <span className="text-muted-foreground">{est.inProgress} prod.</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Commercial workload */}
          <div>
            <h2 className="text-sm font-semibold font-display text-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              Carga por Comercial
            </h2>
            {commercialWorkload.length === 0 ? (
              <Card className="p-4 text-center text-sm text-muted-foreground font-body">Nenhum comercial cadastrado</Card>
            ) : (
              <div className="space-y-2">
                {commercialWorkload.map(com => (
                  <Card
                    key={com.id}
                    className="p-3 flex items-center justify-between cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => { setCommercialFilter(com.id); setStatusFilter("all"); }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="font-medium font-body text-sm text-foreground truncate">{com.name}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-body shrink-0">
                      <span className="text-foreground font-semibold">{com.open} abertas</span>
                      <span className="text-emerald-600">{com.ready} prontas</span>
                      {com.waiting > 0 && (
                        <span className="text-amber-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />{com.waiting} aguard.
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottleneck alert */}
        {metrics.overdue > 0 && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <span className="text-sm font-medium text-destructive">
              {metrics.overdue} demanda{metrics.overdue > 1 ? "s" : ""} atrasada{metrics.overdue > 1 ? "s" : ""} — atenção ao SLA
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente ou projeto..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              {Object.entries(INTERNAL_STATUSES).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={estimatorFilter} onValueChange={setEstimatorFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Orçamentista" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos orçamentistas</SelectItem>
              {estimators.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={commercialFilter} onValueChange={setCommercialFilter}>
            <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="Comercial" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos comerciais</SelectItem>
              {commercials.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <ArrowUpDown className="h-3.5 w-3.5 mr-1.5" /><SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="urgente">Mais urgente</SelectItem>
              <SelectItem value="prazo">Prazo mais próximo</SelectItem>
              <SelectItem value="recente">Mais recente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Active filter chips */}
        {(estimatorFilter !== "all" || commercialFilter !== "all") && (
          <div className="flex items-center gap-2 flex-wrap">
            {estimatorFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setEstimatorFilter("all")}>
                Orçamentista: {getProfileName(estimatorFilter)} ✕
              </Badge>
            )}
            {commercialFilter !== "all" && (
              <Badge variant="secondary" className="gap-1 cursor-pointer" onClick={() => setCommercialFilter("all")}>
                Comercial: {getProfileName(commercialFilter)} ✕
              </Badge>
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}

        {/* Empty */}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold font-display text-foreground mb-1">Nenhum resultado</h2>
            <p className="text-sm text-muted-foreground font-body">Ajuste os filtros para encontrar demandas.</p>
          </div>
        )}

        {/* Budget list */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-body">{filtered.length} resultado{filtered.length !== 1 ? "s" : ""}</p>
            {filtered.map(b => {
              const status = INTERNAL_STATUSES[b.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
              const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
              const due = getDueInfo(b.due_at);
              const isOverdue = due.variant === "overdue";

              return (
                <Card key={b.id} className={`p-4 hover:shadow-md transition-shadow border group ${isOverdue ? "border-destructive/30" : ""}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isOverdue && <span className="w-2 h-2 rounded-full bg-destructive shrink-0" />}
                        <span className="font-semibold font-display text-foreground truncate">{b.project_name || "Sem nome"}</span>
                        <Badge variant="secondary" className={`text-xs font-body ${status.color}`}>{status.icon} {status.label}</Badge>
                        {b.priority !== "normal" && (
                          <Badge variant="outline" className={`text-xs font-body ${prio.color}`}>{prio.label}</Badge>
                        )}
                        {due.label && (
                          <span className={`inline-flex items-center gap-1 text-xs font-medium font-body px-2 py-0.5 rounded-full border ${dueVariantStyles[due.variant]}`}>
                            <Calendar className="h-3 w-3" />{due.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground font-body flex-wrap">
                        <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{b.client_name}</span>
                        <span className="flex items-center gap-1" title="Orçamentista">
                          <FileText className="h-3.5 w-3.5" />{getProfileName(b.estimator_owner_id)}
                        </span>
                        <span className="flex items-center gap-1" title="Comercial">
                          <Building2 className="h-3.5 w-3.5" />{getProfileName(b.commercial_owner_id)}
                        </span>
                        {b.updated_at && <span className="text-xs">Atualizado {format(new Date(b.updated_at), "dd/MM HH:mm")}</span>}
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="opacity-60 group-hover:opacity-100" onClick={() => openEditDialog(b)} title="Gerenciar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <BudgetActionsMenu
                        budget={b}
                        onRefresh={loadData}
                        fromPath="/admin/operacoes"
                        extraItems={
                          <>
                            <DropdownMenuItem onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                              <FileText className="h-4 w-4 mr-2" />Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuLabel className="text-xs">Alterar Status</DropdownMenuLabel>
                            {Object.entries(INTERNAL_STATUSES)
                              .filter(([k]) => k !== b.internal_status)
                              .slice(0, 6)
                              .map(([k, v]) => (
                                <DropdownMenuItem key={k} onClick={() => quickChangeStatus(b, k as InternalStatus)}>
                                  <span className="mr-2">{v.icon}</span>{v.label}
                                </DropdownMenuItem>
                              ))}
                          </>
                        }
                        trigger={
                          <Button variant="ghost" size="icon" className="opacity-60 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        }
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editBudget} onOpenChange={open => !open && setEditBudget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Gerenciar Demanda</DialogTitle>
          </DialogHeader>
          {editBudget && (
            <div className="space-y-4 py-2">
              <p className="text-sm font-body text-muted-foreground">{editBudget.project_name} — {editBudget.client_name}</p>

              <div className="space-y-2">
                <Label className="font-body text-sm">Orçamentista</Label>
                <Select value={editEstimator} onValueChange={setEditEstimator}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    {estimators.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prioridade</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRIORITIES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-sm">Prazo</Label>
                  <Input type="date" value={editDueAt} onChange={e => setEditDueAt(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-body text-sm">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERNAL_STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.icon} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditBudget(null)}>Cancelar</Button>
            <Button onClick={saveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  async function quickChangeStatus(b: BudgetRow, newStatus: InternalStatus) {
    const { error } = await supabase.from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", b.id);
    if (error) { toast.error("Erro ao atualizar"); return; }
    if (user) {
      await supabase.from("budget_events").insert({
        budget_id: b.id, user_id: user.id, event_type: "status_change",
        from_status: b.internal_status, to_status: newStatus,
      });
    }
    setBudgets(prev => prev.map(x => x.id === b.id ? { ...x, internal_status: newStatus, updated_at: new Date().toISOString() } : x));
    toast.success(`Status → ${INTERNAL_STATUSES[newStatus]?.label}`);
  }
}
