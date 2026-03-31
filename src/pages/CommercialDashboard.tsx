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
  Search, Calendar, User, Building2, ArrowLeft, Loader2, Inbox,
  Clock, AlertTriangle, MoreVertical, ExternalLink, CheckCircle2,
  PauseCircle, ArrowUpDown, Flame, Copy, Send, RotateCcw,
  FileText, Eye, ThumbsUp, XCircle, Plus,
} from "lucide-react";
import {
  INTERNAL_STATUSES, PRIORITIES,
  type InternalStatus, type Priority,
} from "@/lib/role-constants";
import { format, differenceInCalendarDays, isToday, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";

// Pipeline groups for the commercial view
const PIPELINE_SECTIONS = {
  production: {
    label: "Em Produção",
    statuses: ["requested", "triage", "assigned", "in_progress"] as InternalStatus[],
    icon: Clock,
    accent: "text-yellow-600",
  },
  waiting_me: {
    label: "Aguardando Minha Ação",
    statuses: ["waiting_info", "delivered_to_sales"] as InternalStatus[],
    icon: AlertTriangle,
    accent: "text-amber-600",
  },
  review: {
    label: "Em Revisão",
    statuses: ["ready_for_review"] as InternalStatus[],
    icon: Eye,
    accent: "text-orange-600",
  },
  sent: {
    label: "Enviados ao Cliente",
    statuses: ["sent_to_client"] as InternalStatus[],
    icon: Send,
    accent: "text-emerald-600",
  },
  won: {
    label: "Aprovados",
    statuses: ["approved"] as InternalStatus[],
    icon: ThumbsUp,
    accent: "text-green-600",
  },
  lost: {
    label: "Perdidos",
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

  useEffect(() => { if (user) loadData(); }, [user]);

  async function loadData() {
    setLoading(true);
    const [budgetsRes, profilesRes] = await Promise.all([
      supabase
        .from("budgets")
        .select("id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, updated_at, commercial_owner_id, estimator_owner_id, public_id, status, version_number, version_group_id, is_current_version, is_published_version")
        .eq("commercial_owner_id", user!.id)
        .order("created_at", { ascending: false }),
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
      (["waiting_info", "delivered_to_sales"] as string[]).includes(b.internal_status)
    ).length;
    return c;
  }, [budgets]);

  const filtered = useMemo(() => {
    let result = budgets.filter(b => {
      const q = search.toLowerCase();
      const matchSearch = !q || b.client_name.toLowerCase().includes(q) || b.project_name.toLowerCase().includes(q) || (b.bairro ?? "").toLowerCase().includes(q);
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
  }, [budgets, search, statusFilter, sortBy]);

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
        {/* Pipeline summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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
                alert={key === "waiting_me" && (counts[key] ?? 0) > 0}
              />
            );
          })}
        </div>

        {/* Needs-action banner */}
        {counts.needsAction > 0 && statusFilter === "all" && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setStatusFilter("waiting_me")}
          >
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {counts.needsAction} orçamento{counts.needsAction > 1 ? "s" : ""} aguardando sua ação
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
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

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(b => {
              const status = INTERNAL_STATUSES[b.internal_status as InternalStatus] ?? INTERNAL_STATUSES.requested;
              const prio = PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;
              const due = getDueInfo(b.due_at);
              const isWaitingAction = ["waiting_info", "delivered_to_sales"].includes(b.internal_status);

              return (
                <Card key={b.id} className={`p-4 hover:shadow-md transition-shadow border group ${isWaitingAction ? "border-amber-300 dark:border-amber-700" : ""}`}>
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/demanda/${b.id}`)}>
                      {/* Row 1 */}
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        {isWaitingAction && <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />}
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
                        <DropdownMenuItem onClick={() => navigate(`/admin/budget/${b.id}`)}>
                          <ExternalLink className="h-4 w-4 mr-2" />Abrir orçamento
                        </DropdownMenuItem>
                        {b.public_id && (
                          <DropdownMenuItem onClick={() => copyPublicLink(b.public_id)}>
                            <Copy className="h-4 w-4 mr-2" />Copiar link público
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        {b.internal_status === "delivered_to_sales" && (
                          <DropdownMenuItem onClick={() => changeStatus(b.id, "sent_to_client")}>
                            <Send className="h-4 w-4 mr-2" />Marcar como enviado ao cliente
                          </DropdownMenuItem>
                        )}
                        {b.internal_status === "sent_to_client" && (
                          <>
                            <DropdownMenuItem onClick={() => changeStatus(b.id, "approved")}>
                              <ThumbsUp className="h-4 w-4 mr-2" />Marcar como aprovado
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => changeStatus(b.id, "lost")}>
                              <XCircle className="h-4 w-4 mr-2" />Marcar como perdido
                            </DropdownMenuItem>
                          </>
                        )}
                        {["delivered_to_sales", "sent_to_client"].includes(b.internal_status) && (
                          <DropdownMenuItem onClick={() => changeStatus(b.id, "ready_for_review")}>
                            <RotateCcw className="h-4 w-4 mr-2" />Pedir revisão
                          </DropdownMenuItem>
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
  );
}

function SummaryCard({ label, count, icon, accent, active, onClick, alert }: {
  label: string; count: number; icon: React.ReactNode; accent: string;
  active?: boolean; onClick?: () => void; alert?: boolean;
}) {
  return (
    <Card
      className={`p-3 flex flex-col gap-1 transition-shadow ${onClick ? "cursor-pointer hover:shadow-md" : ""} ${active ? "ring-2 ring-primary" : ""} ${alert ? "border-amber-300 dark:border-amber-700" : ""}`}
      onClick={onClick}
    >
      <div className={`flex items-center gap-1.5 text-xs font-body ${accent}`}>
        {icon}{label}
        {alert && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
      </div>
      <span className="text-2xl font-bold font-display text-foreground">{count}</span>
    </Card>
  );
}
