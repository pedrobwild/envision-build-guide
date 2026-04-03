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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search, Calendar, User, Building2, ArrowLeft, Loader2, Inbox,
  Clock, MoreVertical, ExternalLink, CheckCircle2,
  ArrowUpDown, Copy, Send, RotateCcw, AlertTriangle,
  FileText, Eye, ThumbsUp, XCircle, Plus, GitCompare,
  LayoutList, Columns3,
} from "lucide-react";
import {
  INTERNAL_STATUSES, PRIORITIES,
  type InternalStatus, type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { MobileFilterChips, type FilterChip } from "@/components/admin/MobileFilterChips";
import { KanbanBoard, type DueFilter } from "@/components/commercial/KanbanBoard";
import { RevisionRequestDialog } from "@/components/editor/RevisionRequestDialog";

// Pipeline groups for the commercial view
// Statuses in "solicitado" and "em_elaboracao" are read-only for commercial
const LOCKED_STATUSES: readonly string[] = [
  "requested", "triage", "assigned", "in_progress", "waiting_info", "blocked",
];

const PIPELINE_SECTIONS = {
  solicitado: {
    label: "Solicitado",
    statuses: ["requested"] as InternalStatus[],
    icon: FileText,
    accent: "text-primary",
  },
  em_elaboracao: {
    label: "Em Elaboração",
    statuses: ["triage", "assigned", "in_progress", "waiting_info", "blocked", "revision_requested"] as InternalStatus[],
    icon: Clock,
    accent: "text-warning",
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
  fechado: {
    label: "Contrato Fechado",
    statuses: ["sent_to_client"] as InternalStatus[],
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
  public_id: string | null;
  status: string;
  version_number: number | null;
  version_group_id: string | null;
  is_current_version: boolean | null;
  is_published_version: boolean | null;
}

interface ProfileRow { id: string; full_name: string; }

export default function CommercialDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("urgente");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [commercialFilter, setCommercialFilter] = useState<string>("all");
  const [confirmCloseBudgetId, setConfirmCloseBudgetId] = useState<string | null>(null);
  const [revisionBudget, setRevisionBudget] = useState<BudgetRow | null>(null);

  useEffect(() => { if (user && profile) loadData(); }, [user, profile]);

  async function loadData() {
    setLoading(true);
    const isAdmin = profile?.roles.includes("admin");
    let budgetQuery = supabase
      .from("budgets")
      .select("id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, updated_at, commercial_owner_id, estimator_owner_id, public_id, status, version_number, version_group_id, is_current_version, is_published_version")
      .order("created_at", { ascending: false });
    if (!isAdmin) {
      budgetQuery = budgetQuery.eq("commercial_owner_id", user!.id);
    }
    const [budgetsRes, profilesRes] = await Promise.all([
      budgetQuery,
      supabase.from("profiles").select("id, full_name"),
    ]);
    if (budgetsRes.data) setBudgets(budgetsRes.data as BudgetRow[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    setLoading(false);
  }

  const getProfileName = useCallback(
    (id: string | null) => (id ? profiles.find(p => p.id === id)?.full_name || "—" : "—"),
    [profiles],
  );

  const getDueInfo = (dueAt: string | null) => {
    if (!dueAt) return { label: null, variant: "default" as const };
    const dueDate = new Date(dueAt);
    const days = differenceInCalendarDays(dueDate, new Date());
    if (isPast(dueDate) && !isToday(dueDate)) return { label: `${Math.abs(days)}d atrasado`, variant: "overdue" as const };
    if (isToday(dueDate)) return { label: "Vence hoje", variant: "today" as const };
    if (days <= 2) return { label: `${days}d restante${days > 1 ? "s" : ""}`, variant: "soon" as const };
    return { label: format(dueDate, "dd MMM", { locale: ptBR }), variant: "default" as const };
  };

  // Counts per pipeline section
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const [key, sec] of Object.entries(PIPELINE_SECTIONS)) {
      c[key] = budgets.filter(b => (sec.statuses as readonly string[]).includes(b.internal_status)).length;
    }
    c.total = budgets.length;
    c.needsAction = budgets.filter(b =>
      (["delivered_to_sales"] as string[]).includes(b.internal_status)
    ).length;
    return c;
  }, [budgets]);

  const isAdmin = profile?.roles.includes("admin");

  // Unique commercial owners for filter (admin only)
  const commercialOptions = useMemo(() => {
    if (!isAdmin) return [];
    const ids = [...new Set(budgets.map(b => b.commercial_owner_id).filter(Boolean))] as string[];
    return ids.map(id => ({ id, name: getProfileName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [isAdmin, budgets, getProfileName]);

  const filtered = useMemo(() => {
    let result = budgets.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.client_name.toLowerCase().includes(q) || b.project_name.toLowerCase().includes(q) || (b.bairro ?? "").toLowerCase().includes(q);
      const matchCommercial = commercialFilter === "all" || b.commercial_owner_id === commercialFilter;
      if (!matchCommercial) return false;
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
  }, [budgets, search, statusFilter, sortBy, commercialFilter]);

  async function changeStatus(budgetId: string, newStatus: InternalStatus) {
    const current = budgets.find(b => b.id === budgetId);
    const { error } = await supabase
      .from("budgets")
      .update({ internal_status: newStatus, updated_at: new Date().toISOString() } as any)
      .eq("id", budgetId);
    if (error) { toast.error("Erro ao atualizar status."); return; }

    // Log event
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

  function copyPublicLink(publicId: string | null) {
    if (!publicId) { toast.error("Orçamento não possui link público."); return; }
    navigator.clipboard.writeText(getPublicBudgetUrl(publicId));
    toast.success("Link copiado!");
  }

  function handleRevisionRequestSuccess() {
    const currentRevisionBudget = revisionBudget;
    if (!currentRevisionBudget) return;

    const now = new Date().toISOString();
    setBudgets(prev => prev.map(b =>
      b.id === currentRevisionBudget.id
        ? { ...b, internal_status: "revision_requested", updated_at: now }
        : b
    ));
    setRevisionBudget(null);
  }

  const dueVariantStyles = {
    overdue: "bg-destructive/10 text-destructive border-destructive/20",
    today: "bg-warning/10 text-warning border-warning/20",
    soon: "bg-warning/10 text-warning border-warning/20",
    default: "text-muted-foreground",
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b border-border bg-card sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-lg font-semibold font-display text-foreground">Meus Orçamentos</h1>
                <p className="text-sm text-muted-foreground font-body">
                  {profile?.full_name || "Comercial"} · {counts.total} orçamento{counts.total !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Button size="sm" onClick={() => navigate("/admin/solicitacoes/nova")}>
              <Plus className="h-4 w-4 mr-1.5" />
              Nova Solicitação
            </Button>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-5">
          {/* Pipeline summary cards — desktop */}
          <div className="hidden lg:grid grid-cols-7 gap-3">
            {Object.entries(PIPELINE_SECTIONS).map(([key, sec]) => {
              const Icon = sec.icon;
              return (
                <SummaryCard
                  key={key}
                  label={sec.label}
                  count={counts[key] ?? 0}
                  icon={<Icon className="h-4 w-4" />}
                  accent={sec.accent}
                  active={statusFilter === key}
                  onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
                  alert={key === "entregue" && (counts[key] ?? 0) > 0}
                />
              );
            })}
          </div>

          {/* Mobile filter chips */}
          <MobileFilterChips
            chips={[
              { id: "all", label: "Todos", count: counts.total },
              { id: "entregue", label: "Entregues", icon: CheckCircle2, count: counts["entregue"] ?? 0 },
              { id: "em_elaboracao", label: "Em Elaboração", icon: Clock, count: counts["em_elaboracao"] ?? 0 },
              { id: "enviado", label: "Enviados", icon: Send, count: counts["enviado"] ?? 0 },
              { id: "solicitado", label: "Solicitados", icon: FileText, count: counts["solicitado"] ?? 0 },
              { id: "fechado", label: "Fechados", icon: ThumbsUp, count: counts["fechado"] ?? 0 },
            ] as FilterChip[]}
            activeChipId={statusFilter}
            onChipChange={(id) => setStatusFilter(id)}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar cliente, projeto..."
          />

          {/* Needs-action banner */}
          {counts.needsAction > 0 && statusFilter === "all" && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg border border-success/20 bg-success/5 cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setStatusFilter("entregue")}
            >
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              <span className="text-sm font-medium text-success">
                {counts.needsAction} orçamento{counts.needsAction > 1 ? "s" : ""} entregue{counts.needsAction > 1 ? "s" : ""} — pronto{counts.needsAction > 1 ? "s" : ""} para enviar ao cliente
              </span>
            </div>
          )}

          {/* Filters */}
          <div className="hidden lg:flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por cliente, projeto, bairro..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Pipeline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(PIPELINE_SECTIONS).map(([key, sec]) => (
                  <SelectItem key={key} value={key}>{sec.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
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
            {/* Due filter */}
            <Select value={dueFilter} onValueChange={v => setDueFilter(v as DueFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os prazos</SelectItem>
                <SelectItem value="overdue">🔴 Vencidos / Hoje</SelectItem>
                <SelectItem value="due_soon">🟡 Próximos (≤2d)</SelectItem>
              </SelectContent>
            </Select>
            {/* Commercial owner filter (admin only) */}
            {isAdmin && commercialOptions.length > 0 && (
              <Select value={commercialFilter} onValueChange={setCommercialFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <User className="h-3.5 w-3.5 mr-1.5" />
                  <SelectValue placeholder="Comercial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os comerciais</SelectItem>
                  {commercialOptions.map(opt => (
                    <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {/* View toggle */}
            <div className="flex border border-border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none px-2.5"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "kanban" ? "secondary" : "ghost"}
                size="sm"
                className="rounded-none px-2.5"
                onClick={() => setViewMode("kanban")}
              >
                <Columns3 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}

          {/* Empty state */}
          {!loading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Inbox className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-lg font-semibold font-display text-foreground mb-1">
                {search || statusFilter !== "all" ? "Nenhum resultado" : "Nenhum orçamento ainda"}
              </h2>
              <p className="text-sm text-muted-foreground font-body max-w-sm">
                {search || statusFilter !== "all"
                  ? "Ajuste os filtros para encontrar o que procura."
                  : "Crie uma nova solicitação de orçamento para começar."}
              </p>
              {!search && statusFilter === "all" && (
                <Button className="mt-4" onClick={() => navigate("/admin/solicitacoes/nova")}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nova Solicitação
                </Button>
              )}
            </div>
          )}

          {/* Kanban view */}
          {!loading && viewMode === "kanban" && budgets.length > 0 && (
            <KanbanBoard
              budgets={commercialFilter === "all" ? budgets : budgets.filter(b => b.commercial_owner_id === commercialFilter)}
              onStatusChange={changeStatus}
              onCardClick={(id) => navigate(`/admin/demanda/${id}`)}
              getProfileName={getProfileName}
              dueFilter={dueFilter}
            />
          )}

          {/* List */}
          {!loading && viewMode === "list" && filtered.length > 0 && (
            <div className="space-y-2">
              {filtered.map(b => {
                const status = INTERNAL_STATUSES[b.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
                const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
                const due = getDueInfo(b.due_at);
                const isLocked = LOCKED_STATUSES.includes(b.internal_status);
                const isEntregue = b.internal_status === "delivered_to_sales";

                return (
                  <Card key={b.id} className={`p-4 hover:shadow-md transition-shadow border group ${isEntregue ? "border-success/30" : ""}`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                        {/* Row 1 */}
                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                          {isEntregue && <span className="w-2 h-2 rounded-full bg-success shrink-0" />}
                          <span className="font-semibold font-display text-foreground truncate">{b.project_name || "Sem nome"}</span>
                          <Badge variant="secondary" className={`text-xs font-body ${status.color}`}>
                            {status.icon} {status.label}
                          </Badge>
                          {b.priority !== "normal" && (
                            <Badge variant="outline" className={`text-xs font-body ${prio.color}`}>{prio.label}</Badge>
                          )}
                          {due.label && (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium font-body px-2 py-0.5 rounded-full border ${dueVariantStyles[due.variant]}`}>
                              <Calendar className="h-3 w-3" />{due.label}
                            </span>
                          )}
                          {(b.version_number ?? 1) > 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              V{b.version_number}
                            </span>
                          )}
                          {b.is_published_version && (
                            <span className="inline-flex items-center text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                              Publicada
                            </span>
                          )}
                          {!b.is_published_version && b.status === "draft" && (b.version_number ?? 1) > 1 && (
                            <span className="inline-flex items-center text-[10px] font-body font-medium px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                              Em elaboração
                            </span>
                          )}
                        </div>
                        {/* Row 2 */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground font-body flex-wrap">
                          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{b.client_name}</span>
                          {(b.bairro || b.city) && (
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{[b.bairro, b.city].filter(Boolean).join(", ")}</span>
                          )}
                          <span className="flex items-center gap-1" title="Orçamentista">
                            <FileText className="h-3.5 w-3.5" />{getProfileName(b.estimator_owner_id)}
                          </span>
                          {b.updated_at && <span className="text-xs">Atualizado {format(new Date(b.updated_at), "dd/MM HH:mm")}</span>}
                        </div>
                      </div>

                      {/* Quick actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                            <FileText className="h-4 w-4 mr-2" />Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/comercial" } })}>
                            <ExternalLink className="h-4 w-4 mr-2" />Abrir orçamento
                          </DropdownMenuItem>
                          {b.public_id && (
                            <DropdownMenuItem onClick={() => copyPublicLink(b.public_id)}>
                              <Copy className="h-4 w-4 mr-2" />Copiar link público
                            </DropdownMenuItem>
                          )}
                          {(b.version_number ?? 1) > 1 && b.version_group_id && (
                            <DropdownMenuItem onClick={() => navigate(`/admin/comparar?left=${b.version_group_id}&right=${b.id}`)}>
                              <GitCompare className="h-4 w-4 mr-2" />Comparar versões
                            </DropdownMenuItem>
                          )}
                          {/* Status actions — "Contrato fechado" available for all non-terminal statuses */}
                          {!isLocked && (
                            <>
                              <DropdownMenuSeparator />
                              {b.internal_status === "delivered_to_sales" && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "sent_to_client")}>
                                  <Send className="h-4 w-4 mr-2" />Enviar ao cliente
                                </DropdownMenuItem>
                              )}
                              {b.internal_status !== "sent_to_client" && b.internal_status !== "lost" && (
                                <DropdownMenuItem onClick={() => setConfirmCloseBudgetId(b.id)}>
                                  <ThumbsUp className="h-4 w-4 mr-2" />Contrato fechado
                                </DropdownMenuItem>
                              )}
                              {b.internal_status !== "lost" && b.internal_status !== "sent_to_client" && (
                                <DropdownMenuItem onClick={() => changeStatus(b.id, "lost")}>
                                  <XCircle className="h-4 w-4 mr-2" />Marcar como perdido
                                </DropdownMenuItem>
                              )}
                              {["delivered_to_sales", "sent_to_client"].includes(b.internal_status) && (
                                <DropdownMenuItem onClick={() => setRevisionBudget(b)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />Solicitar revisão
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <RevisionRequestDialog
        open={!!revisionBudget}
        onOpenChange={(open) => {
          if (!open) setRevisionBudget(null);
        }}
        budgetId={revisionBudget?.id ?? ""}
        currentStatus={revisionBudget?.internal_status ?? "sent_to_client"}
        onSuccess={handleRevisionRequestSuccess}
      />

      {/* Confirmation dialog for "Contrato fechado" */}
      <AlertDialog open={!!confirmCloseBudgetId} onOpenChange={(open) => { if (!open) setConfirmCloseBudgetId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Registrar contrato fechado?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação marca o orçamento como contrato fechado. Deseja continuar?
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
    </>
  );
}

function SummaryCard({ label, count, icon, accent, active, onClick, alert }: {
  label: string; count: number; icon: React.ReactNode; accent: string;
  active?: boolean; onClick?: () => void; alert?: boolean;
}) {
  return (
    <Card
      className={`p-3 flex flex-col gap-1 transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${active ? "ring-2 ring-primary" : ""} ${alert ? "border-warning/30" : ""}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-1.5 text-xs font-body ${accent}`}>
        {icon}{label}
        {alert && <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />}
      </div>
      <span className="text-2xl font-bold font-display text-foreground">{count}</span>
    </Card>
  );
}
