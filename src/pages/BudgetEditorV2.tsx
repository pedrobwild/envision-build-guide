import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Save, Copy, Check, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { MetadataStep } from "@/components/editor/MetadataStep";
import { SectionsEditor } from "@/components/editor/SectionsEditor";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import { VersionHistoryPanel } from "@/components/editor/VersionHistoryPanel";

export default function BudgetEditorV2() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<any>(null);
  const [sections, setSections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadBudget();
  }, [budgetId]);

  const loadBudget = async () => {
    if (!budgetId) return;
    const { data: b } = await supabase.from("budgets").select("*").eq("id", budgetId).single();
    if (!b) { navigate("/admin"); return; }
    setBudget(b);

    // Load sections with items
    const { data: secs } = await supabase
      .from("sections")
      .select("*, items(*)")
      .eq("budget_id", budgetId)
      .order("order_index", { ascending: true });

    const sorted = (secs || []).map(s => ({
      ...s,
      items: (s.items || []).sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0)),
    }));
    setSections(sorted);
  };

  const autoSaveBudgetField = useCallback((field: string, value: string) => {
    if (!budgetId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from("budgets").update({ [field]: value }).eq("id", budgetId);
    }, 800);
  }, [budgetId]);

  const handleSaveAndPublish = async () => {
    if (!budgetId || !budget) return;
    setSaving(true);

    try {
      const publicId = budget.public_id || crypto.randomUUID().replace(/-/g, "").slice(0, 12);
      await supabase.from("budgets").update({
        status: "published",
        public_id: publicId,
      }).eq("id", budgetId);

      setBudget({ ...budget, status: "published", public_id: publicId });
      const publicUrl = getPublicBudgetUrl(publicId);
      toast.success("Orçamento publicado com sucesso!", {
        description: "O link público foi copiado para a área de transferência.",
        duration: 5000,
      });
      navigator.clipboard.writeText(publicUrl);
    } catch (err) {
      console.error("Save error:", err);
      toast.error("Erro ao salvar. Tente novamente.");
    }

    setSaving(false);
  };

  if (!budget) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground font-body">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-display font-bold text-sm text-foreground leading-tight truncate">
                {budget.project_name || "Sem nome"}
              </span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-body flex-wrap">
                {budget.client_name && budget.client_name !== "Cliente" && (
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    {budget.client_name}
                  </span>
                )}
                {budget.condominio && <span>• {budget.condominio}</span>}
                {budget.bairro && <span>• {budget.bairro}</span>}
                {budget.metragem && <span>• {budget.metragem}</span>}
                {budget.versao && <span>• v{budget.versao}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {budget.public_id && (
              <button
                onClick={() => navigator.clipboard.writeText(getPublicBudgetUrl(budget.public_id!))}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                title="Copiar link público"
              >
                <Copy className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <MetadataStep
          budget={budget}
          onFieldChange={(field, value) => {
            setBudget({ ...budget, [field]: value });
            autoSaveBudgetField(field, value);
          }}
          onNext={handleSaveAndPublish}
          saving={saving}
        />

        <SectionsEditor
          budgetId={budgetId!}
          sections={sections}
          onSectionsChange={setSections}
        />
      </main>
    </div>
  );
}
