import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import {
  Plus, Copy, ExternalLink, LogOut, FileText, Upload,
  Search, Filter, TrendingUp, FolderOpen, CheckCircle, Clock,
  MoreHorizontal, Trash2, Archive, Eye
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";
import { toast } from "sonner";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    const { data } = await supabase
      .from('budgets')
      .select('*, sections(id, title, section_price, qty, items(id, internal_total))')
      .order('created_at', { ascending: false });
    setBudgets(data || []);
    setLoading(false);
  };

  const createBudget = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('budgets')
      .insert({ project_name: 'Novo Projeto', client_name: 'Cliente', created_by: user.id })
      .select()
      .single();
    if (data) navigate(`/admin/budget/${data.id}`);
  };

  const publishBudget = async (id: string) => {
    const publicId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await supabase.from('budgets').update({ status: 'published', public_id: publicId }).eq('id', id);
    toast.success("Orçamento publicado!");
    loadBudgets();
  };

  const archiveBudget = async (id: string) => {
    await supabase.from('budgets').update({ status: 'archived' }).eq('id', id);
    toast.success("Orçamento arquivado");
    setMenuOpen(null);
    loadBudgets();
  };

  const deleteBudget = async (id: string) => {
    // Delete related data first
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

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const getBudgetTotal = (budget: any) => {
    return (budget.sections || []).reduce((sum: number, s: any) => {
      if (s.section_price) return sum + Number(s.section_price) * (s.qty || 1);
      return sum + (s.items || []).reduce((is: number, i: any) => is + (Number(i.internal_total) || 0), 0);
    }, 0);
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = budgets.length;
    const published = budgets.filter(b => b.status === 'published').length;
    const drafts = budgets.filter(b => b.status === 'draft').length;
    const totalValue = budgets.reduce((sum, b) => sum + getBudgetTotal(b), 0);
    return { total, published, drafts, totalValue };
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

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    published: 'bg-success/10 text-success',
    approved: 'bg-primary/10 text-primary',
    expired: 'bg-destructive/10 text-destructive',
    archived: 'bg-muted text-muted-foreground',
  };

  const statusLabels: Record<string, string> = {
    draft: 'Rascunho',
    published: 'Publicado',
    approved: 'Aprovado',
    expired: 'Expirado',
    archived: 'Arquivado',
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display font-bold">B</span>
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground leading-tight">Bwild Admin</h1>
              {user && <p className="text-xs text-muted-foreground font-body truncate max-w-48">{user.email}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { icon: FolderOpen, label: "Total", value: metrics.total, color: "text-foreground" },
            { icon: CheckCircle, label: "Publicados", value: metrics.published, color: "text-success" },
            { icon: Clock, label: "Rascunhos", value: metrics.drafts, color: "text-muted-foreground" },
            { icon: TrendingUp, label: "Valor total", value: formatBRL(metrics.totalValue), color: "text-primary" },
          ].map((m, i) => (
            <div key={i} className="p-4 rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 mb-1">
                <m.icon className={`h-4 w-4 ${m.color}`} />
                <span className="text-xs text-muted-foreground font-body">{m.label}</span>
              </div>
              <p className={`text-lg font-display font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar projeto ou cliente..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-body text-sm"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2.5 rounded-lg border border-border bg-card text-foreground font-body text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Todos</option>
              <option value="draft">Rascunhos</option>
              <option value="published">Publicados</option>
              <option value="archived">Arquivados</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 text-sm font-medium font-body transition-colors"
            >
              <Upload className="h-4 w-4" /> Importar
            </button>
            <button
              onClick={createBudget}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Novo
            </button>
          </div>
        </div>

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
          <div className="space-y-3">
            {filtered.map(budget => {
              const sectionTotal = getBudgetTotal(budget);
              const sectionCount = (budget.sections || []).length;
              return (
                <div key={budget.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link to={`/admin/budget/${budget.id}`} className="font-medium text-foreground hover:text-primary transition-colors font-body text-sm truncate">
                        {budget.project_name || 'Sem nome'}
                      </Link>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium font-body ${statusColors[budget.status]}`}>
                        {statusLabels[budget.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-body">
                      {budget.client_name} • {budget.date ? formatDate(budget.date) : '—'} • {sectionCount} {sectionCount === 1 ? 'seção' : 'seções'}
                    </p>
                  </div>

                  <span className="text-sm font-display font-semibold text-foreground whitespace-nowrap">
                    {formatBRL(sectionTotal)}
                  </span>

                  <div className="flex items-center gap-1">
                    {budget.status === 'draft' && (
                      <button
                        onClick={() => publishBudget(budget.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title="Publicar"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    )}
                    {budget.public_id && (
                      <>
                        <button
                          onClick={() => window.open(`/o/${budget.public_id}`, '_blank')}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Ver público"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/o/${budget.public_id}`);
                            toast.success("Link copiado!");
                          }}
                          className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                          title="Copiar link"
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === budget.id ? null : budget.id)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen === budget.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(null)} />
                          <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border border-border bg-popover shadow-lg py-1">
                            {budget.status !== 'archived' && (
                              <button
                                onClick={() => archiveBudget(budget.id)}
                                className="w-full px-3 py-2 text-left text-sm font-body text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-2"
                              >
                                <Archive className="h-3.5 w-3.5" /> Arquivar
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (confirm('Excluir este orçamento permanentemente?')) deleteBudget(budget.id);
                              }}
                              className="w-full px-3 py-2 text-left text-sm font-body text-destructive hover:bg-destructive/10 flex items-center gap-2"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
      <ImportExcelModal open={importOpen} onOpenChange={(v) => { setImportOpen(v); if (!v) loadBudgets(); }} />
    </div>
  );
}
