import { useEffect, useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  Search,
  Calendar,
  User,
  Building2,
  ArrowLeft,
  Loader2,
  FileText,
  Inbox,
  Hammer,
  Briefcase,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  INTERNAL_STATUSES,
  PRIORITIES,
  type InternalStatus,
  type Priority,
} from "@/lib/role-constants";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  commercial_owner_id: string | null;
  estimator_owner_id: string | null;
}

export default function BudgetRequestsList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useUserProfile();
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    loadBudgets();
  }, [user]);

  async function loadBudgets() {
    setLoading(true);
    const [{ data, error }, { data: profs }] = await Promise.all([
      supabase
        .from("budgets")
        .select(
          "id, client_name, project_name, property_type, city, bairro, internal_status, priority, due_at, created_at, commercial_owner_id, estimator_owner_id"
        )
        .order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name"),
    ]);

    if (!error && data) {
      setBudgets(data as BudgetRow[]);
    }
    const map: Record<string, string> = {};
    (profs || []).forEach((p) => { map[p.id] = p.full_name || "(sem nome)"; });
    setProfiles(map);
    setLoading(false);
  }

  const filtered = budgets.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      b.client_name.toLowerCase().includes(q) ||
      b.project_name.toLowerCase().includes(q) ||
      (b.bairro ?? "").toLowerCase().includes(q) ||
      (b.city ?? "").toLowerCase().includes(q);

    const matchStatus =
      statusFilter === "all" || b.internal_status === statusFilter;
    const matchPriority =
      priorityFilter === "all" || b.priority === priorityFilter;

    return matchSearch && matchStatus && matchPriority;
  });

  const isDueSoon = (dueAt: string | null) => {
    if (!dueAt) return false;
    const diff = new Date(dueAt).getTime() - Date.now();
    return diff > 0 && diff < 3 * 24 * 60 * 60 * 1000; // 3 days
  };

  const isOverdue = (dueAt: string | null) => {
    if (!dueAt) return false;
    return new Date(dueAt).getTime() < Date.now();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold font-display text-foreground">
                Solicitações de Orçamento
              </h1>
              <p className="text-sm text-muted-foreground font-body">
                {filtered.length}{" "}
                {filtered.length === 1 ? "solicitação" : "solicitações"}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate("/admin/solicitacoes/nova")}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova Solicitação</span>
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
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
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(PRIORITIES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
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
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "Nenhum resultado encontrado"
                : "Nenhuma solicitação ainda"}
            </h2>
            <p className="text-sm text-muted-foreground font-body max-w-sm mb-6">
              {search || statusFilter !== "all" || priorityFilter !== "all"
                ? "Tente ajustar os filtros para encontrar o que procura."
                : "Crie sua primeira solicitação de orçamento para começar."}
            </p>
            {!search && statusFilter === "all" && priorityFilter === "all" && (
              <Button
                onClick={() => navigate("/admin/solicitacoes/nova")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> Nova Solicitação
              </Button>
            )}
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map((b) => {
              const status =
                INTERNAL_STATUSES[b.internal_status as InternalStatus] ??
                INTERNAL_STATUSES.requested;
              const prio =
                PRIORITIES[b.priority as Priority] ?? PRIORITIES.normal;

              return (
                <Card
                  key={b.id}
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer border"
                  onClick={() => navigate(`/admin/budget/${b.id}`, { state: { from: "/admin/solicitacoes" } })}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-semibold font-display text-foreground truncate">
                          {b.project_name || "Sem nome"}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`text-xs font-body ${status.color}`}
                        >
                          {status.label}
                        </Badge>
                        {b.priority !== "normal" && (
                          <Badge
                            variant="outline"
                            className={`text-xs font-body ${prio.color}`}
                          >
                            {prio.label}
                          </Badge>
                        )}
                      </div>
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
                        {b.property_type && (
                          <span className="flex items-center gap-1">
                            <FileText className="h-3.5 w-3.5" />
                            {b.property_type}
                          </span>
                        )}
                      </div>
                      {/* Owners */}
                      {(b.commercial_owner_id || b.estimator_owner_id) && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground font-body mt-1 flex-wrap">
                          {b.commercial_owner_id && (
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {profiles[b.commercial_owner_id] || "—"}
                            </span>
                          )}
                          {b.estimator_owner_id && (
                            <span className="flex items-center gap-1">
                              <Hammer className="h-3 w-3" />
                              {profiles[b.estimator_owner_id] || "—"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {b.due_at && (
                        <span
                          className={`text-xs font-body flex items-center gap-1 ${
                            isOverdue(b.due_at)
                              ? "text-destructive font-medium"
                              : isDueSoon(b.due_at)
                              ? "text-warning font-medium"
                              : "text-muted-foreground"
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          {format(new Date(b.due_at), "dd MMM", {
                            locale: ptBR,
                          })}
                          {isOverdue(b.due_at) && " (atrasado)"}
                        </span>
                      )}
                      {b.created_at && (
                        <span className="text-xs text-muted-foreground font-body">
                          {format(new Date(b.created_at), "dd/MM/yy")}
                        </span>
                      )}
                    </div>
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
