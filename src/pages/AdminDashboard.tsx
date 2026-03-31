import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import {
  Plus, Copy, ExternalLink, FileText, Upload, FileSpreadsheet,
  Search, TrendingUp, FolderOpen, CheckCircle, Clock,
  MoreHorizontal, Trash2, Archive, Eye, Bell, Pencil, ShoppingBag,
  Handshake, BarChart3, Hammer, Briefcase, Settings, Users,
  ArrowRight, GitCompare, Send, LayoutDashboard, ClipboardList,
  Settings2, DollarSign,
} from "lucide-react";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { toast } from "sonner";
import { OptionalSelectionsPanel } from "@/components/admin/OptionalSelectionsPanel";
import { TeamMetricsPanel } from "@/components/admin/TeamMetricsPanel";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { INTERNAL_STATUSES } from "@/lib/role-constants";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, isAdmin, isComercial, isOrcamentista } = useUserProfile();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [duplicateConfirmId, setDuplicateConfirmId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    loadBudgets();
    loadNotifications();
  }, []);

  const loadBudgets = async () => {
    const { data } = await supabase
      .from("budgets")
      .select("*, sections(id, title, section_price, qty, items(id, internal_total)), adjustments(id, sign, amount)")
      .order("created_at", { ascending: false });
    setBudgets(data || []);
    setLoading(false);
  };

  const loadNotifications = async () => {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("read", false)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications(data || []);
  };

  const markNotificationsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const createBudget = async () => {
    if (!user) return;
    const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data } = await supabase
      .from("budgets")
      .insert({ project_name: "Novo Projeto", client_name: "Cliente", created_by: user.id, public_id: publicId })
      .select()
      .single();
    if (data) {
      try {
        const { appendUtensiliosTemplate } = await import("@/lib/utensilios-template");
        await appendUtensiliosTemplate(data.id, 0);
      } catch (e) {
        console.warn("[CreateBudget] Utensílios template failed (non-critical):", e);
      }
      navigate(`/admin/budget/${data.id}`);
    }
  };

  const publishBudget = async (id: string) => {
    const existing = budgets.find((b) => b.id === id);
    const publicId = existing?.public_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    await supabase.from("budgets").update({ status: "published", public_id: publicId }).eq("id", id);
    toast.success("Orçamento publicado!");
    loadBudgets();
  };

  const markAsClosed = async (id: string) => {
    await supabase
      .from("budgets")
      .update({ status: "contrato_fechado", closed_at: new Date().toISOString() } as any)
      .eq("id", id);
    toast.success("Contrato marcado como fechado!");
    setMenuOpen(null);
    loadBudgets();
  };

  const archiveBudget = async (id: string) => {
    await supabase.from("budgets").update({ status: "archived" }).eq("id", id);
    toast.success("Orçamento arquivado");
    setMenuOpen(null);
    loadBudgets();
  };

  const deleteBudget = async (id: string) => {
    const { data: sections } = await supabase.from("sections").select("id").eq("budget_id", id);
    if (sections && sections.length > 0) {
      const sIds = sections.map((s) => s.id);
      const { data: items } = await supabase.from("items").select("id").in("section_id", sIds);
      if (items && items.length > 0) {
        const itemIds = items.map((i) => i.id);
        await supabase.from("item_images").delete().in("item_id", itemIds);
      }
      await supabase.from("items").delete().in("section_id", sIds);
      await supabase.from("sections").delete().eq("budget_id", id);
    }
    await supabase.from("rooms").delete().eq("budget_id", id);
    await supabase.from("adjustments").delete().eq("budget_id", id);
    await supabase.from("budget_optional_selections").delete().eq("budget_id", id);
    await supabase.from("budgets").delete().eq("id", id);
    toast.success("Orçamento excluído");
    setMenuOpen(null);
    loadBudgets();
  };

  const duplicateAsNew = async (sourceBudgetId: string) => {
    if (!user) return;
    setDuplicating(true);
    try {
      const { data: source } = await supabase.from("budgets").select("*").eq("id", sourceBudgetId).single();
      if (!source) throw new Error("Orçamento não encontrado");

      const {
        id, created_at, updated_at, public_id, public_token_hash, view_count, last_viewed_at,
        approved_at, approved_by_name, generated_at, client_name, project_name, condominio, bairro,
        unit, metragem, lead_email, lead_name, closed_at, version_group_id, version_number,
        is_current_version, versao, status, ...keepMeta
      } = source;

      const newPublicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data: newBudget, error: budgetErr } = await supabase
        .from("budgets")
        .insert({
          ...keepMeta,
          project_name: "Novo Projeto (cópia)",
          client_name: "",
          status: "draft",
          created_by: user.id,
          view_count: 0,
          version_number: 1,
          is_current_version: true,
          versao: "1",
          public_id: newPublicId,
        })
        .select()
        .single();

      if (budgetErr || !newBudget) throw budgetErr || new Error("Falha ao duplicar");

      const { data: srcSections } = await supabase.from("sections").select("*").eq("budget_id", sourceBudgetId).order("order_index");
      const sectionMapping: Record<string, string> = {};
      if (srcSections && srcSections.length > 0) {
        for (const sec of srcSections) {
          const { id: oldSecId, created_at: _ca, budget_id: _bid, ...secData } = sec;
          const { data: newSec, error: secErr } = await supabase.from("sections").insert({ ...secData, budget_id: newBudget.id }).select("id").single();
          if (secErr) { console.error("Erro ao copiar seção:", sec.title, secErr); continue; }
          if (newSec) sectionMapping[oldSecId] = newSec.id;
        }
      }

      const oldSectionIds = Object.keys(sectionMapping);
      if (oldSectionIds.length > 0) {
        const { data: allItems } = await supabase.from("items").select("*").in("section_id", oldSectionIds).order("order_index");
        const itemMapping: Record<string, string> = {};
        for (const item of allItems || []) {
          const { id: oldItemId, created_at: _ica, section_id: oldSid, ...itemData } = item;
          const newSectionId = sectionMapping[oldSid];
          if (!newSectionId) continue;
          const { data: newItem, error: itemErr } = await supabase.from("items").insert({ ...itemData, section_id: newSectionId }).select("id").single();
          if (itemErr) { console.error("Erro ao copiar item:", item.title, itemErr); continue; }
          if (newItem) itemMapping[oldItemId] = newItem.id;
        }
        const oldItemIds = Object.keys(itemMapping);
        if (oldItemIds.length > 0) {
          const { data: allImages } = await supabase.from("item_images").select("*").in("item_id", oldItemIds);
          if (allImages && allImages.length > 0) {
            const newImages = allImages.filter((img) => itemMapping[img.item_id]).map(({ id, created_at, item_id, ...imgData }) => ({ ...imgData, item_id: itemMapping[item_id] }));
            if (newImages.length > 0) {
              const { error: imgErr } = await supabase.from("item_images").insert(newImages);
              if (imgErr) console.error("Erro ao copiar imagens:", imgErr);
            }
          }
        }
      }

      const { data: adjustments } = await supabase.from("adjustments").select("*").eq("budget_id", sourceBudgetId);
      if (adjustments && adjustments.length > 0) {
        await supabase.from("adjustments").insert(adjustments.map(({ id, created_at, budget_id, ...adjData }) => ({ ...adjData, budget_id: newBudget.id })));
      }
      const { data: rooms } = await supabase.from("rooms").select("*").eq("budget_id", sourceBudgetId);
      if (rooms && rooms.length > 0) {
        await supabase.from("rooms").insert(rooms.map(({ id, created_at, budget_id, ...roomData }) => ({ ...roomData, budget_id: newBudget.id })));
      }

      toast.success("Orçamento duplicado! Preencha os dados do novo cliente.");
      await loadBudgets();
      navigate(`/admin/budget/${newBudget.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao duplicar orçamento");
    } finally {
      setDuplicating(false);
    }
  };

  const getBudgetTotal = (budget: any) => {
    const sectionsTotal = (budget.sections || []).reduce((sum: number, s: any) => sum + calculateSectionSubtotal(s), 0);
    const adjustmentsTotal = (budget.adjustments || []).reduce((sum: number, adj: any) => sum + adj.sign * Number(adj.amount), 0);
    return sectionsTotal + adjustmentsTotal;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = budgets.length;
    const published = budgets.filter((b) => b.status === "published").length;
    const drafts = budgets.filter((b) => b.status === "draft").length;
    const closed = budgets.filter((b) => b.status === "contrato_fechado").length;
    const inProgress = budgets.filter((b) => b.internal_status === "in_progress").length;
    const totalValue = budgets.reduce((sum, b) => sum + getBudgetTotal(b), 0);
    return { total, published, drafts, closed, inProgress, totalValue };
  }, [budgets]);

  // Monthly billing
  const monthlyBilling = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const closedThisMonth = budgets.filter((b) => {
      if (b.status !== "contrato_fechado") return false;
      const closedAt = (b as any).closed_at;
      if (!closedAt) return false;
      const d = new Date(closedAt);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const revenue = closedThisMonth.reduce((sum, b) => sum + getBudgetTotal(b), 0);
    const cost = closedThisMonth.reduce((sum, b) => sum + (Number((b as any).internal_cost) || 0), 0);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    return { monthName, count: closedThisMonth.length, revenue, cost, profit, margin };
  }, [budgets]);

  // Filtered
  const filtered = useMemo(() => {
    return budgets.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return b.project_name?.toLowerCase().includes(q) || b.client_name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [budgets, searchQuery, statusFilter]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    minuta_solicitada: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    contrato_fechado: "bg-primary/10 text-primary",
    approved: "bg-primary/10 text-primary",
    expired: "bg-destructive/10 text-destructive",
    archived: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    published: "Publicado",
    minuta_solicitada: "Minuta Solicitada",
    contrato_fechado: "Contrato Fechado",
    approved: "Aprovado",
    expired: "Expirado",
    archived: "Arquivado",
  };

  // Quick-access shortcuts based on role
  const shortcuts = useMemo(() => {
    const items: { icon: React.ElementType; label: string; description: string; href: string; borderColor: string; iconColor: string; descColor?: string }[] = [];

    if (isAdmin || isOrcamentista) {
      const inProd = metrics.inProgress;
      items.push({
        icon: Hammer, label: "Produção",
        description: inProd > 0 ? `${inProd} em produção` : "Nada em produção",
        href: "/admin/producao",
        borderColor: inProd > 0 ? "border-l-blue-500" : "border-l-transparent",
        iconColor: inProd > 0 ? "text-blue-500" : "text-muted-foreground",
        descColor: inProd > 0 ? "text-blue-600 font-medium" : undefined,
      });
    }
    if (isAdmin || isComercial) {
      items.push({
        icon: LayoutDashboard, label: "Pipeline Comercial",
        description: `${metrics.published} publicados`,
        href: "/admin/comercial",
        borderColor: "border-l-green-500", iconColor: "text-green-500",
        descColor: "text-green-600 font-medium",
      });
      items.push({
        icon: ClipboardList, label: "Solicitações",
        description: "Novas demandas",
        href: "/admin/solicitacoes",
        borderColor: "border-l-amber-500", iconColor: "text-amber-500",
      });
    }
    if (isAdmin) {
      items.push({
        icon: Settings2, label: "Operações",
        description: "Visão geral",
        href: "/admin/operacoes",
        borderColor: "border-l-transparent", iconColor: "text-muted-foreground",
      });
      const hasFinancial = monthlyBilling.count > 0;
      items.push({
        icon: DollarSign, label: "Financeiro",
        description: hasFinancial ? formatBRL(monthlyBilling.revenue) : "Sem contratos fechados",
        href: "/admin/financeiro",
        borderColor: hasFinancial ? "border-l-emerald-500" : "border-l-transparent",
        iconColor: hasFinancial ? "text-emerald-500" : "text-muted-foreground",
        descColor: hasFinancial ? "text-emerald-600 font-medium" : "text-muted-foreground italic",
      });
      items.push({
        icon: Users, label: "Usuários",
        description: "Gestão de equipe",
        href: "/admin/usuarios",
        borderColor: "border-l-transparent", iconColor: "text-muted-foreground",
      });
    }

    return items;
  }, [isAdmin, isComercial, isOrcamentista, metrics, monthlyBilling]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Welcome + Notifications + New Budget */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold font-display text-foreground">
            Olá, {profile?.full_name?.split(" ")[0] || user?.email || "Usuário"} 👋
          </h1>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="secondary" className="text-xs font-body">📋 {metrics.total} orçamentos</Badge>
            <Badge variant="secondary" className="text-xs font-body">✅ {metrics.published} publicados</Badge>
            <Badge
              variant={metrics.closed > 0 ? "default" : "outline"}
              className={`text-xs font-body ${metrics.closed > 0 ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-muted-foreground"}`}
            >
              🤝 {metrics.closed} contratos fechados
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notifications */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              onClick={() => {
                setShowNotifications(!showNotifications);
                if (!showNotifications && unreadCount > 0) markNotificationsRead();
              }}
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </Button>
            {showNotifications && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-80 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                  <div className="p-3 border-b border-border">
                    <h3 className="font-display font-semibold text-sm text-foreground">Notificações</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted-foreground font-body">Nenhuma notificação</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={`p-3 border-b border-border last:border-0 ${!n.read ? "bg-primary/5" : ""}`}>
                          <p className="text-sm font-body font-medium text-foreground">{n.title}</p>
                          <p className="text-xs text-muted-foreground font-body mt-0.5">{n.message}</p>
                          <p className="text-xs text-muted-foreground font-body mt-1">{formatDate(n.created_at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* New budget button */}
          <div className="relative">
            <Button size="sm" className="gap-1.5" onClick={() => setNewMenuOpen(!newMenuOpen)}>
              <Plus className="h-4 w-4" /> Novo
            </Button>
            {newMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-lg py-1">
                  <button
                    onClick={() => { setNewMenuOpen(false); createBudget(); }}
                    className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" /> Em branco
                  </button>
                  <button
                    onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("pdf"); }}
                    className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" /> Importar PDF
                  </button>
                  <button
                    onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType("excel"); }}
                    className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Importar Planilha
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Quick Access Shortcuts */}
      {shortcuts.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {shortcuts.map((s) => (
            <Link key={s.href} to={s.href}>
              <Card className={`cursor-pointer hover:bg-accent/50 transition-colors duration-150 border-l-4 ${s.borderColor} h-full`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <s.icon className={`h-5 w-5 ${s.iconColor} shrink-0`} />
                  <div>
                    <p className="font-medium text-sm font-body text-foreground">{s.label}</p>
                    <p className={`text-xs font-body ${s.descColor || "text-muted-foreground"}`}>{s.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total */}
        <Card className="border bg-card">
          <CardContent className="p-5 flex items-start gap-4">
            <FileText className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{metrics.total}</p>
              <p className="text-xs text-muted-foreground font-body">Total de orçamentos</p>
            </div>
          </CardContent>
        </Card>

        {/* Publicados */}
        <Card className="border bg-card">
          <CardContent className="p-5 flex items-start gap-4">
            <Send className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-2xl font-display font-bold text-blue-600">{metrics.published}</p>
              <p className="text-xs text-muted-foreground font-body">Publicados</p>
              <p className="text-xs text-muted-foreground font-body">
                ({metrics.total > 0 ? Math.round((metrics.published / metrics.total) * 100) : 0}% do total)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contratos */}
        <Card className="border bg-card">
          <CardContent className="p-5 flex items-start gap-4">
            <Handshake className={`h-5 w-5 mt-0.5 shrink-0 ${metrics.closed > 0 ? "text-green-500" : "text-muted-foreground"}`} />
            <div>
              <p className={`text-2xl font-display font-bold ${metrics.closed > 0 ? "text-green-600" : "text-muted-foreground"}`}>{metrics.closed}</p>
              <p className="text-xs text-muted-foreground font-body">Contratos fechados</p>
              {metrics.closed === 0 && (
                <p className="text-xs text-muted-foreground font-body">Nenhum contrato fechado ainda</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Valor Total — hero metric */}
        <Card className="border bg-card border-l-4 border-l-emerald-500">
          <CardContent className="p-5 flex items-start gap-4">
            <TrendingUp className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xl font-display font-bold text-emerald-600 truncate">{formatBRL(metrics.totalValue)}</p>
              <p className="text-xs text-muted-foreground font-body">Valor em carteira</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Billing (only if there's data) */}
      {monthlyBilling.count > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🤝</span>
              <span className="text-xs text-muted-foreground font-body capitalize">{monthlyBilling.monthName}</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground">{formatBRL(monthlyBilling.revenue)}</p>
            <p className="text-xs text-muted-foreground font-body">{monthlyBilling.count} contrato{monthlyBilling.count !== 1 ? "s" : ""}</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">🧱</span>
              <span className="text-xs text-muted-foreground font-body">Custo das obras</span>
            </div>
            <p className="text-lg font-display font-bold text-foreground">{formatBRL(monthlyBilling.cost)}</p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📈</span>
              <span className="text-xs text-muted-foreground font-body">Lucro · Margem {monthlyBilling.margin.toFixed(0)}%</span>
            </div>
            <p className={`text-lg font-display font-bold ${monthlyBilling.profit >= 0 ? "text-green-600" : "text-destructive"}`}>
              {formatBRL(monthlyBilling.profit)}
            </p>
          </div>
        </div>
      )}

      {/* Optional selections */}
      <OptionalSelectionsPanel />

      {/* Team Metrics (admin only) */}
      {isAdmin && <TeamMetricsPanel />}

      {/* Budget List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold font-display text-foreground">Todos os orçamentos</h2>
          <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 font-body text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-md border border-input bg-background text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex-shrink-0"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunhos</option>
              <option value="published">Publicados</option>
              <option value="contrato_fechado">Contratos</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 flex flex-col items-center text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-body">
                {searchQuery || statusFilter !== "all" ? "Nenhum resultado para os filtros." : "Nenhum orçamento ainda."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card divide-y divide-border">
              {paginated.map((budget) => {
                const total = getBudgetTotal(budget);
                const sectionCount = (budget.sections || []).length;
                const internalCost = Number(budget.internal_cost) || 0;
                const isClosed = budget.status === "contrato_fechado";
                const profit = total - internalCost;
                const profitMargin = total > 0 ? (profit / total) * 100 : 0;

                return (
                  <div key={budget.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                    {/* Status badge */}
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium font-body border ${
                      budget.status === "published" ? "border-green-500 text-green-600 bg-green-50 dark:bg-green-950/30" :
                      budget.status === "contrato_fechado" ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" :
                      budget.status === "draft" ? "border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-950/30" :
                      "border-amber-400 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                    }`}>
                      {statusLabels[budget.status] || budget.status}
                    </span>

                    {/* Title + metadata */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          to={`/admin/budget/${budget.id}`}
                          className="font-medium text-sm text-foreground hover:text-primary transition-colors font-body truncate"
                        >
                          {budget.project_name || "Sem nome"}
                        </Link>
                        {(budget.version_number ?? 1) > 1 && (
                          <span className="text-[10px] bg-muted border border-border rounded-full px-1.5 py-0.5 font-body">
                            V{budget.version_number}
                          </span>
                        )}
                        {budget.is_published_version && (
                          <span className="text-[10px] bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-full px-1.5 py-0.5 font-body">
                            Publicada
                          </span>
                        )}
                        {budget.show_optional_items && (
                          <ShoppingBag className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-body mt-0.5">
                        {budget.client_name}
                        {budget.date && <> · {formatDate(budget.date)}</>}
                        {" · "}{sectionCount} {sectionCount === 1 ? "seção" : "seções"}
                        {budget.view_count >= 5 && (
                          <span className="inline-flex items-center gap-0.5 ml-1">
                            · <Eye className="h-3 w-3 inline" /> {budget.view_count}
                          </span>
                        )}
                        {budget.view_count > 0 && budget.view_count < 5 && <> · {budget.view_count} view{budget.view_count !== 1 ? "s" : ""}</>}
                      </p>
                      {isClosed && internalCost > 0 && (
                        <p className="text-xs font-body mt-0.5">
                          <span className="text-muted-foreground">Custo: {formatBRL(internalCost)}</span>
                          <span className={` ml-2 ${profit >= 0 ? "text-green-600" : "text-destructive"}`}>
                            Lucro: {formatBRL(profit)} ({profitMargin.toFixed(0)}%)
                          </span>
                        </p>
                      )}
                    </div>

                    {/* Price */}
                    <span className="text-sm font-display font-semibold text-foreground whitespace-nowrap text-right">{formatBRL(total)}</span>

                    {/* Action icons with tooltips */}
                    <TooltipProvider delayDuration={300}>
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/admin/budget/${budget.id}`)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Editar orçamento</p></TooltipContent>
                        </Tooltip>
                        {budget.status === "draft" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => publishBudget(budget.id)}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Publicar</p></TooltipContent>
                          </Tooltip>
                        )}
                        {budget.public_id && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(getPublicBudgetUrl(budget.public_id!), "_blank")}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Visualizar página pública</p></TooltipContent>
                          </Tooltip>
                        )}
                        <div className="relative">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMenuOpen(menuOpen === budget.id ? null : budget.id)}>
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Mais ações</p></TooltipContent>
                          </Tooltip>
                          {menuOpen === budget.id && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg border border-border bg-popover shadow-lg py-1">
                                {budget.public_id && (
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!));
                                      toast.success("Link copiado!");
                                      setMenuOpen(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <Copy className="h-3.5 w-3.5" /> Copiar link público
                                  </button>
                                )}
                                {budget.version_group_id && (
                                  <button
                                    onClick={() => { setMenuOpen(null); navigate(`/admin/comparar?group=${budget.version_group_id}`); }}
                                    className="w-full px-3 py-2 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <GitCompare className="h-3.5 w-3.5" /> Comparar versões
                                  </button>
                                )}
                                {(budget.status === "published" || budget.status === "approved") && (
                                  <button
                                    onClick={() => markAsClosed(budget.id)}
                                    className="w-full px-3 py-2 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <Handshake className="h-3.5 w-3.5 text-primary" /> Contrato Fechado
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    const newVal = !budget.show_optional_items;
                                    await supabase.from("budgets").update({ show_optional_items: newVal }).eq("id", budget.id);
                                    setBudgets((prev) => prev.map((b) => (b.id === budget.id ? { ...b, show_optional_items: newVal } : b)));
                                    toast.success(newVal ? "Opcionais ativados" : "Opcionais desativados");
                                    setMenuOpen(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                >
                                  <ShoppingBag className="h-3.5 w-3.5 text-amber-500" />
                                  {budget.show_optional_items ? "Desativar opcionais" : "Incluir opcionais"}
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(null); setDuplicateConfirmId(budget.id); }}
                                  className="w-full px-3 py-2 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                >
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicar como novo
                                </button>
                                {budget.status !== "archived" && (
                                  <button
                                    onClick={() => archiveBudget(budget.id)}
                                    className="w-full px-3 py-2 text-left text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <Archive className="h-3.5 w-3.5" /> Arquivar
                                  </button>
                                )}
                                <button
                                  onClick={() => { if (confirm("Excluir este orçamento permanentemente?")) deleteBudget(budget.id); }}
                                  className="w-full px-3 py-2 text-left text-sm font-body text-destructive hover:bg-destructive/10 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </TooltipProvider>
                  </div>
                );
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <p className="text-xs text-muted-foreground font-body">
                  {filtered.length} orçamento{filtered.length !== 1 ? "s" : ""} · Página {currentPage}/{totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="text-xs h-7">
                    Anterior
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="text-xs h-7">
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <ImportExcelModal open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) loadBudgets(); }} fileFilter={importType} />

      {(duplicateConfirmId || duplicating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !duplicating && setDuplicateConfirmId(null)}>
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-md mx-4 border border-border" onClick={(e) => e.stopPropagation()}>
            {duplicating ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm font-body text-muted-foreground">Duplicando orçamento…</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-display font-semibold text-foreground mb-2">Duplicar orçamento?</h3>
                <p className="text-sm text-muted-foreground mb-6">O escopo será copiado, mas os dados do cliente ficarão em branco.</p>
                <div className="flex gap-3 justify-end">
                  <Button variant="outline" onClick={() => setDuplicateConfirmId(null)}>Cancelar</Button>
                  <Button onClick={() => { const id = duplicateConfirmId; setDuplicateConfirmId(null); duplicateAsNew(id!); }}>Duplicar</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
