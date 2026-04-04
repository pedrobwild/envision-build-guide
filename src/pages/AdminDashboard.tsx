import { useEffect, useState, useMemo } from "react";
import { motion } from "framer-motion";
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
  Settings2, DollarSign, ArrowUpDown, ArrowUp, ArrowDown,
  LayoutTemplate,
} from "lucide-react";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { TemplateSelectorDialog } from "@/components/editor/TemplateSelectorDialog";
import { toast } from "sonner";

import { TeamMetricsPanel } from "@/components/admin/TeamMetricsPanel";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { INTERNAL_STATUSES } from "@/lib/role-constants";
import { BudgetListCard, BudgetListSkeleton } from "@/components/admin/BudgetListCard";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, loading: profileLoading, isAdmin, isComercial, isOrcamentista } = useUserProfile();

  // Redirect orcamentistas to their dedicated workspace
  useEffect(() => {
    if (!profileLoading && profile && isOrcamentista && !isAdmin) {
      navigate("/admin/producao", { replace: true });
    }
  }, [profileLoading, profile, isOrcamentista, isAdmin, navigate]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importType, setImportType] = useState<"pdf" | "excel">("pdf");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "value" | "status">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [duplicateConfirmId, setDuplicateConfirmId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateBudgetId, setTemplateBudgetId] = useState<string | null>(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (user) {
      loadBudgets();
      loadNotifications();
    }
  }, [user]);

  const loadBudgets = async () => {
    const { data } = await supabase
      .from("budgets")
      .select("*, sections(id, title, section_price, qty, items(id, internal_total, internal_unit_price, qty, bdi_percentage)), adjustments(id, sign, amount)")
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
        const { seedFromTemplate } = await import("@/lib/seed-from-template");
        await seedFromTemplate(data.id, "a01da86a-9184-4693-bd07-6798c2bf79b2");
      } catch (e) {
        console.warn("[CreateBudget] Template seed failed (non-critical):", e);
      }
      navigate(`/admin/budget/${data.id}`);
    }
  };

  const createBudgetForTemplate = async () => {
    if (!user) return;
    const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data } = await supabase
      .from("budgets")
      .insert({ project_name: "Novo Projeto", client_name: "Cliente", created_by: user.id, public_id: publicId })
      .select()
      .single();
    if (data) {
      setTemplateBudgetId(data.id);
      setTemplateDialogOpen(true);
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
    const inProgress = budgets.filter((b) => ["requested", "novo", "triage", "assigned", "in_progress", "waiting_info", "blocked", "ready_for_review"].includes(b.internal_status)).length;
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
  const statusOrder: Record<string, number> = { draft: 0, published: 1, minuta_solicitada: 2, contrato_fechado: 3, archived: 4 };

  const filtered = useMemo(() => {
    const list = budgets.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return b.project_name?.toLowerCase().includes(q) || b.client_name?.toLowerCase().includes(q);
      }
      return true;
    });

    list.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "date") {
        cmp = new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      } else if (sortBy === "value") {
        cmp = getBudgetTotal(a) - getBudgetTotal(b);
      } else if (sortBy === "status") {
        cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [budgets, searchQuery, statusFilter, sortBy, sortDir]);

  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground",
    published: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    minuta_solicitada: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    contrato_fechado: "bg-primary/10 text-primary",
    
    expired: "bg-destructive/10 text-destructive",
    archived: "bg-muted text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    draft: "Rascunho",
    published: "Publicado",
    minuta_solicitada: "Minuta Solicitada",
    contrato_fechado: "Contrato Fechado",
    
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
      <motion.div
        className="flex items-start justify-between gap-4"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div>
          <h1 className="text-xl font-semibold font-display text-foreground tracking-tight">
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
      </motion.div>


      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: FileText, iconClass: "text-muted-foreground", value: metrics.total, valueClass: "text-foreground", label: "Total de orçamentos", extra: null, cardClass: "" },
          { icon: Send, iconClass: "text-primary", value: metrics.published, valueClass: "text-primary", label: "Publicados", extra: `(${metrics.total > 0 ? Math.round((metrics.published / metrics.total) * 100) : 0}% do total)`, cardClass: "" },
          { icon: Handshake, iconClass: metrics.closed > 0 ? "text-success" : "text-muted-foreground", value: metrics.closed, valueClass: metrics.closed > 0 ? "text-success" : "text-muted-foreground", label: "Contratos fechados", extra: metrics.closed === 0 ? "Nenhum contrato fechado ainda" : null, cardClass: "" },
          { icon: TrendingUp, iconClass: "text-success", value: formatBRL(metrics.totalValue), valueClass: "text-success", label: "Valor em carteira", extra: null, cardClass: "border-l-4 border-l-success" },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
          >
            <Card className={`border bg-card ${kpi.cardClass}`}>
              <CardContent className="p-5 flex items-start gap-4">
                <kpi.icon className={`h-5 w-5 ${kpi.iconClass} mt-0.5 shrink-0`} />
                <div>
                  <p className={`text-2xl font-display font-bold ${kpi.valueClass} tracking-tight`}>
                    {typeof kpi.value === "number" ? kpi.value : kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">{kpi.label}</p>
                  {kpi.extra && <p className="text-xs text-muted-foreground font-body">{kpi.extra}</p>}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Monthly Billing */}
      {monthlyBilling.count > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🤝</span>
                <span className="text-xs text-muted-foreground font-body capitalize">{monthlyBilling.monthName}</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground tracking-tight">{formatBRL(monthlyBilling.revenue)}</p>
              <p className="text-xs text-muted-foreground font-body">{monthlyBilling.count} contrato{monthlyBilling.count !== 1 ? "s" : ""}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">🧱</span>
                <span className="text-xs text-muted-foreground font-body">Custo das obras</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground tracking-tight">{formatBRL(monthlyBilling.cost)}</p>
            </div>
            <div className="p-3 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">📈</span>
                <span className="text-xs text-muted-foreground font-body">Lucro · Margem {monthlyBilling.margin.toFixed(0)}%</span>
              </div>
              <p className={`text-lg font-display font-bold tracking-tight ${monthlyBilling.profit >= 0 ? "text-success" : "text-destructive"}`}>
                {formatBRL(monthlyBilling.profit)}
              </p>
            </div>
          </div>
        </motion.div>
      )}



      {/* Team Metrics (admin only) */}
      {isAdmin && <TeamMetricsPanel />}

      {/* Budget List */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
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

          {/* Sort chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[11px] text-muted-foreground font-body shrink-0 mr-0.5">Ordenar:</span>
            {([
              { key: "date" as const, label: "Data" },
              { key: "value" as const, label: "Valor" },
              { key: "status" as const, label: "Status" },
            ]).map((opt) => {
              const isActive = sortBy === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (isActive) {
                      setSortDir((d) => d === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(opt.key);
                      setSortDir(opt.key === "value" ? "desc" : opt.key === "date" ? "desc" : "asc");
                    }
                  }}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-body font-medium whitespace-nowrap transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:bg-muted/50 active:scale-95"
                  }`}
                >
                  {opt.label}
                  {isActive && (sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <BudgetListSkeleton />
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
            <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
              {paginated.map((budget) => {
                const total = getBudgetTotal(budget);
                const sectionCount = (budget.sections || []).length;

                return (
                  <BudgetListCard
                    key={budget.id}
                    budget={budget}
                    total={total}
                    sectionCount={sectionCount}
                    statusLabel={statusLabels[budget.status] || budget.status}
                    statusColor={statusColors[budget.status] || ""}
                    onPublish={publishBudget}
                    onCopyLink={(publicId) => {
                      navigator.clipboard.writeText(getPublicBudgetUrl(publicId));
                      toast.success("Link copiado!");
                    }}
                    onMarkClosed={markAsClosed}
                    onToggleOptionals={async (id, current) => {
                      const newVal = !current;
                      await supabase.from("budgets").update({ show_optional_items: newVal }).eq("id", id);
                      setBudgets((prev) => prev.map((b) => (b.id === id ? { ...b, show_optional_items: newVal } : b)));
                      toast.success(newVal ? "Opcionais ativados" : "Opcionais desativados");
                    }}
                    onDuplicate={(id) => setDuplicateConfirmId(id)}
                    onArchive={archiveBudget}
                    onDelete={(id) => { if (confirm("Excluir este orçamento permanentemente?")) deleteBudget(id); }}
                    onCompareVersions={(groupId) => navigate(`/admin/comparar?group=${groupId}`)}
                  />
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
