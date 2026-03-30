import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import {
  Plus, Copy, ExternalLink, LogOut, FileText, Upload, FileSpreadsheet,
  Search, Filter, TrendingUp, FolderOpen, CheckCircle, Clock,
  MoreHorizontal, Trash2, Archive, Eye, Bell, Pencil, ShoppingBag,
  Handshake, DollarSign, BarChart3
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { toast } from "sonner";
import { OptionalSelectionsPanel } from "@/components/admin/OptionalSelectionsPanel";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import logoDark from "@/assets/logo-bwild-dark.png";
import logoWhite from "@/assets/logo-bwild-white.png";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [duplicateConfirmId, setDuplicateConfirmId] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [importType, setImportType] = useState<'pdf' | 'excel'>('pdf');
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
      .from('budgets')
      .select('*, sections(id, title, section_price, qty, items(id, internal_total)), adjustments(id, sign, amount)')
      .order('created_at', { ascending: false });
    setBudgets(data || []);
    setLoading(false);
  };

  const loadNotifications = async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data || []);
  };

  const markNotificationsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length > 0) {
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    }
  };

  const createBudget = async () => {
    if (!user) return;
    const publicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data } = await supabase
      .from('budgets')
      .insert({ project_name: 'Novo Projeto', client_name: 'Cliente', created_by: user.id, public_id: publicId })
      .select()
      .single();
    if (data) {
      // Append Utensílios template as last section
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
    const publicId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await supabase.from('budgets').update({ status: 'published', public_id: publicId }).eq('id', id);
    toast.success("Orçamento publicado!");
    loadBudgets();
  };

  const markAsClosed = async (id: string) => {
    await supabase.from('budgets').update({
      status: 'contrato_fechado',
      closed_at: new Date().toISOString(),
    } as any).eq('id', id);
    toast.success("Contrato marcado como fechado!");
    setMenuOpen(null);
    loadBudgets();
  };

  const archiveBudget = async (id: string) => {
    await supabase.from('budgets').update({ status: 'archived' }).eq('id', id);
    toast.success("Orçamento arquivado");
    setMenuOpen(null);
    loadBudgets();
  };

  const deleteBudget = async (id: string) => {
    const { data: sections } = await supabase.from('sections').select('id').eq('budget_id', id);
    if (sections && sections.length > 0) {
      const sIds = sections.map(s => s.id);
      await supabase.from('items').delete().in('section_id', sIds);
      await supabase.from('sections').delete().eq('budget_id', id);
    }
    await supabase.from('rooms').delete().eq('budget_id', id);
    await supabase.from('adjustments').delete().eq('budget_id', id);
    await supabase.from('budgets').delete().eq('id', id);
    toast.success("Orçamento excluído");
    setMenuOpen(null);
    loadBudgets();
  };

  const duplicateAsNew = async (sourceBudgetId: string) => {
    if (!user) return;
    setDuplicating(true);
    try {
      // 1. Load source budget
      const { data: source } = await supabase
        .from('budgets')
        .select('*')
        .eq('id', sourceBudgetId)
        .single();
      if (!source) throw new Error('Orçamento não encontrado');

      // 2. Create new budget with reset client data
      const { id, created_at, updated_at, public_id, public_token_hash, view_count, last_viewed_at,
        approved_at, approved_by_name, generated_at, client_name, project_name, condominio, bairro,
        unit, metragem, lead_email, lead_name, closed_at, version_group_id, version_number,
        is_current_version, versao, status, ...keepMeta } = source;

      const newPublicId = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      const { data: newBudget, error: budgetErr } = await supabase
        .from('budgets')
        .insert({
          ...keepMeta,
          project_name: 'Novo Projeto (cópia)',
          client_name: '',
          status: 'draft',
          created_by: user.id,
          view_count: 0,
          version_number: 1,
          is_current_version: true,
          versao: '1',
          public_id: newPublicId,
        })
        .select()
        .single();

      if (budgetErr || !newBudget) throw budgetErr || new Error('Falha ao duplicar');

      // 3. Copy sections + items + item_images
      const { data: sections } = await supabase
        .from('sections')
        .select('*')
        .eq('budget_id', sourceBudgetId)
        .order('order_index');

      // Insert all sections in batch
      const sectionMapping: Record<string, string> = {};
      if (sections && sections.length > 0) {
        for (const sec of sections) {
          const { id: oldSecId, created_at: _ca, budget_id: _bid, ...secData } = sec;
          const { data: newSec, error: secErr } = await supabase
            .from('sections')
            .insert({ ...secData, budget_id: newBudget.id })
            .select('id')
            .single();
          if (secErr) { console.error('Erro ao copiar seção:', sec.title, secErr); continue; }
          if (newSec) sectionMapping[oldSecId] = newSec.id;
        }
      }

      // Copy items for all mapped sections
      const oldSectionIds = Object.keys(sectionMapping);
      if (oldSectionIds.length > 0) {
        const { data: allItems } = await supabase
          .from('items')
          .select('*')
          .in('section_id', oldSectionIds)
          .order('order_index');

        const itemMapping: Record<string, string> = {};
        for (const item of allItems || []) {
          const { id: oldItemId, created_at: _ica, section_id: oldSid, ...itemData } = item;
          const newSectionId = sectionMapping[oldSid];
          if (!newSectionId) continue;
          const { data: newItem, error: itemErr } = await supabase
            .from('items')
            .insert({ ...itemData, section_id: newSectionId })
            .select('id')
            .single();
          if (itemErr) { console.error('Erro ao copiar item:', item.title, itemErr); continue; }
          if (newItem) itemMapping[oldItemId] = newItem.id;
        }

        // Copy all item_images in batch
        const oldItemIds = Object.keys(itemMapping);
        if (oldItemIds.length > 0) {
          const { data: allImages } = await supabase
            .from('item_images')
            .select('*')
            .in('item_id', oldItemIds);

          if (allImages && allImages.length > 0) {
            const newImages = allImages
              .filter(img => itemMapping[img.item_id])
              .map(({ id, created_at, item_id, ...imgData }) => ({
                ...imgData,
                item_id: itemMapping[item_id],
              }));
            if (newImages.length > 0) {
              const { error: imgErr } = await supabase.from('item_images').insert(newImages);
              if (imgErr) console.error('Erro ao copiar imagens:', imgErr);
            }
          }
        }
      }

      // 4. Copy adjustments
      const { data: adjustments } = await supabase
        .from('adjustments')
        .select('*')
        .eq('budget_id', sourceBudgetId);

      if (adjustments && adjustments.length > 0) {
        await supabase.from('adjustments').insert(
          adjustments.map(({ id, created_at, budget_id, ...adjData }) => ({
            ...adjData,
            budget_id: newBudget.id,
          }))
        );
      }

      // 5. Copy rooms
      const { data: rooms } = await supabase
        .from('rooms')
        .select('*')
        .eq('budget_id', sourceBudgetId);

      if (rooms && rooms.length > 0) {
        await supabase.from('rooms').insert(
          rooms.map(({ id, created_at, budget_id, ...roomData }) => ({
            ...roomData,
            budget_id: newBudget.id,
          }))
        );
      }

      toast.success('Orçamento duplicado! Preencha os dados do novo cliente.');
      await loadBudgets();
      navigate(`/admin/budget/${newBudget.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao duplicar orçamento');
    } finally {
      setDuplicating(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const getBudgetTotal = (budget: any) => {
    const sectionsTotal = (budget.sections || []).reduce(
      (sum: number, s: any) => sum + calculateSectionSubtotal(s),
      0
    );
    const adjustmentsTotal = (budget.adjustments || []).reduce(
      (sum: number, adj: any) => sum + (adj.sign * Number(adj.amount)),
      0
    );
    return sectionsTotal + adjustmentsTotal;
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = budgets.length;
    const published = budgets.filter(b => b.status === 'published').length;
    const drafts = budgets.filter(b => b.status === 'draft').length;
    const closed = budgets.filter(b => b.status === 'contrato_fechado').length;
    const totalValue = budgets.reduce((sum, b) => sum + getBudgetTotal(b), 0);
    return { total, published, drafts, closed, totalValue };
  }, [budgets]);

  // Monthly billing
  const monthlyBilling = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthName = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    const closedThisMonth = budgets.filter(b => {
      if (b.status !== 'contrato_fechado') return false;
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
    return budgets.filter(b => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return b.project_name?.toLowerCase().includes(q) || b.client_name?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [budgets, searchQuery, statusFilter]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    published: 'bg-success/10 text-success',
    minuta_solicitada: 'bg-amber-500/10 text-amber-600',
    contrato_fechado: 'bg-primary/10 text-primary',
    approved: 'bg-primary/10 text-primary',
    expired: 'bg-destructive/10 text-destructive',
    archived: 'bg-muted text-muted-foreground',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    published: 'Publicado',
    minuta_solicitada: 'Minuta Solicitada',
    contrato_fechado: 'Contrato Fechado',
    approved: 'Aprovado',
    expired: 'Expirado',
    archived: 'Arquivado',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={logoDark} alt="Bwild" className="h-6 sm:h-7 dark:hidden flex-shrink-0" />
            <img src={logoWhite} alt="Bwild" className="h-6 sm:h-7 hidden dark:block flex-shrink-0" />
            <div className="h-5 w-px bg-border hidden sm:block" />
            <div className="hidden sm:block">
              <h1 className="font-display font-semibold text-sm text-foreground leading-tight">Painel Admin</h1>
              {user && <p className="text-xs text-muted-foreground font-body truncate max-w-48">{user.email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => navigate("/admin/financeiro")}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Histórico Financeiro"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && notifications.some(n => !n.read)) {
                    markNotificationsRead();
                  }
                }}
                className="relative p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <Bell className="h-4 w-4" />
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </button>
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-[calc(100vw-2rem)] sm:w-80 max-w-80 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                    <div className="p-3 border-b border-border">
                      <h3 className="font-display font-semibold text-sm text-foreground">Notificações</h3>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="p-4 text-center text-xs text-muted-foreground font-body">Nenhuma notificação</p>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`p-3 border-b border-border last:border-0 ${!n.read ? 'bg-primary/5' : ''}`}>
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
            <ThemeToggle />
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body min-w-[44px] min-h-[44px] justify-center">
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Metrics - 5 cards */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3 mb-4 sm:mb-6">
          {[
            { icon: FolderOpen, label: "Total", value: metrics.total, color: "text-foreground" },
            { icon: CheckCircle, label: "Publicados", value: metrics.published, color: "text-success" },
            { icon: Clock, label: "Rascunhos", value: metrics.drafts, color: "text-muted-foreground" },
            { icon: Handshake, label: "Contratos Fechados", value: metrics.closed, color: "text-primary" },
            { icon: TrendingUp, label: "Valor total", value: formatBRL(metrics.totalValue), color: "text-primary" },
          ].map((m, i) => (
            <div key={i} className={`p-3 sm:p-4 rounded-lg border border-border bg-card ${i === 4 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                <m.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground font-body">{m.label}</span>
              </div>
              <p className={`text-base sm:text-lg font-display font-bold ${m.color} truncate`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Monthly Billing Section */}
        {monthlyBilling.count > 0 && (
          <div className="mb-4 sm:mb-6">
            <h2 className="font-display font-bold text-sm text-foreground mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Faturamento do Mês
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
              {/* Revenue */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🤝</span>
                  <span className="text-xs text-muted-foreground font-body">
                    Contratos Fechados — {monthlyBilling.monthName}
                  </span>
                </div>
                <p className="text-xl font-display font-bold text-foreground">{formatBRL(monthlyBilling.revenue)}</p>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {monthlyBilling.count} contrato{monthlyBilling.count !== 1 ? 's' : ''} fechado{monthlyBilling.count !== 1 ? 's' : ''} este mês
                </p>
              </div>
              {/* Cost */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">🧱</span>
                  <span className="text-xs text-muted-foreground font-body">
                    Custo das Obras — {monthlyBilling.monthName}
                  </span>
                </div>
                <p className="text-xl font-display font-bold text-foreground">{formatBRL(monthlyBilling.cost)}</p>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  Custo total das obras em andamento
                </p>
              </div>
              {/* Profit */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">📈</span>
                  <span className="text-xs text-muted-foreground font-body">
                    Lucro do Mês — {monthlyBilling.monthName}
                  </span>
                </div>
                <p className={`text-xl font-display font-bold ${monthlyBilling.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatBRL(monthlyBilling.profit)}
                </p>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  Margem: {monthlyBilling.margin.toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-body text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 flex-shrink-0"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunhos</option>
              <option value="published">Publicados</option>
              <option value="contrato_fechado">Contratos Fechados</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>

          <div className="relative sm:self-end">
            <button
              onClick={() => setNewMenuOpen(!newMenuOpen)}
              className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:bg-primary/90 transition-colors min-h-[44px]"
            >
              <Plus className="h-4 w-4" /> Novo orçamento
            </button>
            {newMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setNewMenuOpen(false)} />
                <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1 z-50 w-full sm:w-56 rounded-lg border border-border bg-popover shadow-lg py-1">
                  <button
                    onClick={() => { setNewMenuOpen(false); createBudget(); }}
                    className="w-full px-3 py-3 sm:py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" /> Em branco
                  </button>
                  <button
                    onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType('pdf'); }}
                    className="w-full px-3 py-3 sm:py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <Upload className="h-4 w-4 text-muted-foreground" /> Importar PDF
                  </button>
                  <button
                    onClick={() => { setNewMenuOpen(false); setImportOpen(true); setImportType('excel'); }}
                    className="w-full px-3 py-3 sm:py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2.5"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" /> Importar Planilha
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Optional selections */}
        <OptionalSelectionsPanel />

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">
              {searchQuery || statusFilter !== 'all' ? 'Nenhum resultado' : 'Nenhum orçamento ainda'}
            </h3>
            <p className="text-muted-foreground text-sm font-body">
              {searchQuery || statusFilter !== 'all' ? 'Tente alterar os filtros.' : 'Crie seu primeiro orçamento visual!'}
            </p>
          </div>
        ) : (
          <>
          <div className="space-y-2 sm:space-y-3">
            {paginated.map(budget => {
              const sectionTotal = getBudgetTotal(budget);
              const sectionCount = (budget.sections || []).length;
              const internalCost = Number((budget as any).internal_cost) || 0;
              const isClosed = budget.status === 'contrato_fechado';
              const profit = sectionTotal - internalCost;
              const profitMargin = sectionTotal > 0 ? (profit / sectionTotal) * 100 : 0;

              return (
                <div key={budget.id} className="p-3 sm:p-4 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow group">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Link to={`/admin/budget/${budget.id}`} className="font-medium text-foreground hover:text-primary transition-colors font-body text-sm truncate">
                          {budget.project_name || 'Sem nome'}
                        </Link>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium font-body ${statusColors[budget.status]} flex-shrink-0`}>
                          {statusLabels[budget.status] || budget.status}
                        </span>
                        {budget.show_optional_items && (
                          <span className="px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-xs font-medium font-body flex items-center gap-1 flex-shrink-0">
                            <ShoppingBag className="h-2.5 w-2.5" aria-hidden="true" /> Opcionais
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-body leading-relaxed">
                        {budget.client_name}
                        <span className="hidden sm:inline"> • {budget.date ? formatDate(budget.date) : '—'}</span>
                        {' • '}{sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
                        {budget.version_number > 1 && ` • V${budget.version_number}`}
                        {budget.view_count > 0 && <span className="hidden sm:inline"> • {budget.view_count} visualização{budget.view_count !== 1 ? 'ões' : ''}</span>}
                      </p>

                      {/* Profit info for closed contracts */}
                      {isClosed && internalCost > 0 && (
                        <div className="flex items-center gap-3 mt-1.5 text-xs font-body">
                          <span className="text-muted-foreground">Custo: {formatBRL(internalCost)}</span>
                          <span className={profit >= 0 ? 'text-success' : 'text-destructive'}>
                            Lucro: {formatBRL(profit)}
                          </span>
                          <span className="text-muted-foreground">Margem: {profitMargin.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                      <span className="text-sm font-display font-semibold text-foreground whitespace-nowrap">
                        {formatBRL(sectionTotal)}
                      </span>

                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={() => navigate(`/admin/budget/${budget.id}`)}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                          title="Editar orçamento"
                          aria-label="Editar orçamento"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        {budget.status === 'draft' && (
                          <button
                            onClick={() => publishBudget(budget.id)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                            title="Publicar"
                            aria-label="Publicar orçamento"
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {budget.public_id && (
                          <>
                            <button
                              onClick={() => window.open(getPublicBudgetUrl(budget.public_id!), '_blank')}
                              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                              title="Ver público"
                              aria-label="Ver orçamento público"
                            >
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!));
                                toast.success("Link copiado!");
                              }}
                              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center hidden sm:flex"
                              title="Copiar link"
                              aria-label="Copiar link público"
                            >
                              <Copy className="h-4 w-4" aria-hidden="true" />
                            </button>
                          </>
                        )}
                        <div className="relative">
                          <button
                            onClick={() => setMenuOpen(menuOpen === budget.id ? null : budget.id)}
                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                            aria-label="Mais opções"
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
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
                                    className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2 sm:hidden"
                                  >
                                    <Copy className="h-3.5 w-3.5" /> Copiar link
                                  </button>
                                )}
                                {/* Mark as closed */}
                                {(budget.status === 'published' || budget.status === 'approved') && (
                                  <button
                                    onClick={() => markAsClosed(budget.id)}
                                    className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <Handshake className="h-3.5 w-3.5 text-primary" />
                                    Marcar como Contrato Fechado
                                  </button>
                                )}
                                <button
                                  onClick={async () => {
                                    const newVal = !budget.show_optional_items;
                                    await supabase.from('budgets').update({ show_optional_items: newVal }).eq('id', budget.id);
                                    setBudgets(prev => prev.map(b => b.id === budget.id ? { ...b, show_optional_items: newVal } : b));
                                    toast.success(newVal ? "Opcionais ativados" : "Opcionais desativados");
                                    setMenuOpen(null);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                >
                                  <ShoppingBag className="h-3.5 w-3.5 text-warning" />
                                  {budget.show_optional_items ? "Desativar opcionais" : "Incluir opcionais"}
                                </button>
                                <button
                                  onClick={() => { setMenuOpen(null); setDuplicateConfirmId(budget.id); }}
                                  className="w-full px-3 py-2.5 text-left text-sm font-body text-foreground hover:bg-muted flex items-center gap-2"
                                >
                                  <Copy className="h-3.5 w-3.5 text-muted-foreground" /> Duplicar como novo
                                </button>
                                {budget.status !== 'archived' && (
                                  <button
                                    onClick={() => archiveBudget(budget.id)}
                                    className="w-full px-3 py-2.5 text-left text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                                  >
                                    <Archive className="h-3.5 w-3.5" /> Arquivar
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    if (confirm('Excluir este orçamento permanentemente?')) deleteBudget(budget.id);
                                  }}
                                  className="w-full px-3 py-2.5 text-left text-sm font-body text-destructive hover:bg-destructive/10 flex items-center gap-2"
                                >
                                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground font-body">
                {filtered.length} orçamento{filtered.length !== 1 ? 's' : ''} • Página {currentPage} de {totalPages}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs font-body rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs font-body rounded-md border border-border hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
          </>
        )}
      </main>
      <ImportExcelModal open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) loadBudgets(); }} fileFilter={importType} />

      {/* Duplicate confirmation dialog */}
      {(duplicateConfirmId || duplicating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !duplicating && setDuplicateConfirmId(null)}>
          <div className="bg-card rounded-xl shadow-xl p-6 max-w-md mx-4 border border-border" onClick={e => e.stopPropagation()}>
            {duplicating ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-sm font-body text-muted-foreground">Duplicando orçamento…</p>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-heading font-semibold text-foreground mb-2">Duplicar orçamento?</h3>
                <p className="text-sm text-muted-foreground mb-6">O escopo será copiado, mas os dados do cliente ficarão em branco para preenchimento.</p>
                <div className="flex gap-3 justify-end">
                  <button onClick={() => setDuplicateConfirmId(null)} className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">Cancelar</button>
                  <button onClick={() => { const id = duplicateConfirmId; setDuplicateConfirmId(null); duplicateAsNew(id!); }} className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-colors">Duplicar</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
