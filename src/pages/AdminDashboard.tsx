import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, Link } from "react-router-dom";
import { formatBRL, formatDate } from "@/lib/formatBRL";
import { Plus, Copy, ExternalLink, LogOut, FileText, Upload } from "lucide-react";
import { ImportExcelModal } from "@/components/budget/ImportExcelModal";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    checkAuth();
    loadBudgets();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) navigate("/login");
  };

  const loadBudgets = async () => {
    const { data } = await supabase
      .from('budgets')
      .select('*, sections(id, title, section_price, qty, items(id, internal_total))')
      .order('created_at', { ascending: false });
    setBudgets(data || []);
    setLoading(false);
  };

  const createBudget = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('budgets')
      .insert({ project_name: 'Novo Projeto', client_name: 'Cliente', created_by: user.id })
      .select()
      .single();
    if (data) navigate(`/admin/budget/${data.id}`);
  };

  const publishBudget = async (id: string) => {
    const publicId = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await supabase.from('budgets').update({ status: 'published', public_id: publicId }).eq('id', id);
    loadBudgets();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

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
            <h1 className="font-display font-bold text-lg text-foreground">Bwild Admin</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-body">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Orçamentos</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 text-sm font-medium font-body transition-colors"
            >
              <Upload className="h-4 w-4" /> Importar Excel
            </button>
            <button
              onClick={createBudget}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" /> Novo Orçamento
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        ) : budgets.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-lg font-semibold text-foreground mb-1">Nenhum orçamento ainda</h3>
            <p className="text-muted-foreground text-sm font-body">Crie seu primeiro orçamento visual!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {budgets.map(budget => {
              const sectionTotal = (budget.sections || []).reduce((sum: number, s: any) => {
                if (s.section_price) return sum + Number(s.section_price) * (s.qty || 1);
                return sum + (s.items || []).reduce((is: number, i: any) => is + (Number(i.internal_total) || 0), 0);
              }, 0);

              return (
                <div key={budget.id} className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:shadow-sm transition-shadow">
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
                      {budget.client_name} • {budget.date ? formatDate(budget.date) : '—'}
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
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/o/${budget.public_id}`)}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                        title="Copiar link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    )}
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
