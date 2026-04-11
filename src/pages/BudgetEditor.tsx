import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { calculateSectionSubtotal, calculateBudgetTotal } from "@/lib/supabase-helpers";
import { getPublicBudgetUrl } from "@/lib/getPublicUrl";
import type { BudgetRow, EditorSection, ItemWithImages, AdjustmentRow } from "@/types/budget-common";
import {
  Plus, Trash2, GripVertical, Save, ExternalLink, ArrowLeft,
  ChevronDown, ChevronUp, ImageIcon, Copy
} from "lucide-react";

export default function BudgetEditor() {
  const { budgetId } = useParams<{ budgetId: string }>();
  const navigate = useNavigate();
  const [budget, setBudget] = useState<BudgetRow | null>(null);
  const [sections, setSections] = useState<EditorSection[]>([]);
  const [adjustments, setAdjustments] = useState<AdjustmentRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!budgetId) return;
      const { data: b, error: bErr } = await supabase.from('budgets').select('*').eq('id', budgetId).maybeSingle();
      if (cancelled) return;
      if (bErr) { console.error('Failed to load budget:', bErr.message); return; }
      if (!b) { navigate('/admin'); return; }
      setBudget(b);

      const [sectionsRes, adjRes] = await Promise.all([
        supabase.from('sections').select('*').eq('budget_id', budgetId).order('order_index'),
        supabase.from('adjustments').select('*').eq('budget_id', budgetId),
      ]);
      if (cancelled) return;

      const sectionList = sectionsRes.data || [];
      const sectionIds = sectionList.map(sec => sec.id);
      const { data: items } = await supabase.from('items').select('*').in('section_id', sectionIds.length ? sectionIds : ['__none__']).order('order_index');
      if (cancelled) return;

      const enriched: EditorSection[] = sectionList.map(sec => ({
        ...sec,
        items: (items || []).filter(i => i.section_id === sec.id) as ItemWithImages[],
        _expanded: true,
      }));
      setSections(enriched);
      setExpandedSections(new Set(sectionList.map(sec => sec.id)));
      setAdjustments((adjRes.data || []) as AdjustmentRow[]);
    }

    load();
    return () => { cancelled = true; };
  }, [budgetId, navigate]);

  const saveBudget = async () => {
    if (!budget) return;
    if (budget.status === 'published') {
      toast.error("Orçamento publicado não pode ser editado.");
      return;
    }
    setSaving(true);
    await supabase.from('budgets').update({
      project_name: budget.project_name,
      client_name: budget.client_name,
      unit: budget.unit,
      validity_days: budget.validity_days,
      disclaimer: budget.disclaimer,
      notes: budget.notes,
      show_item_qty: budget.show_item_qty,
      show_item_prices: budget.show_item_prices,
    }).eq('id', budget.id);

    for (const section of sections) {
      await supabase.from('sections').update({
        title: section.title,
        subtitle: section.subtitle,
        section_price: section.section_price,
        qty: section.qty,
        order_index: section.order_index,
        included_bullets: section.included_bullets as import("@/integrations/supabase/types").Json,
        excluded_bullets: section.excluded_bullets as import("@/integrations/supabase/types").Json,
        notes: section.notes,
        cover_image_url: section.cover_image_url,
      }).eq('id', section.id);

      for (const item of section.items || []) {
        await supabase.from('items').update({
          title: item.title,
          description: item.description,
          reference_url: item.reference_url,
          qty: item.qty,
          unit: item.unit,
          internal_unit_price: item.internal_unit_price,
          internal_total: item.internal_total,
          order_index: item.order_index,
          coverage_type: item.coverage_type,
        }).eq('id', item.id);
      }
    }

    for (const adj of adjustments) {
      await supabase.from('adjustments').update({
        label: adj.label,
        sign: adj.sign,
        amount: adj.amount,
      }).eq('id', adj.id);
    }

    setSaving(false);
  };

  const isPublished = budget?.status === 'published';

  const addSection = async () => {
    if (!budgetId || isPublished) return;
    const { data } = await supabase.from('sections').insert({
      budget_id: budgetId,
      title: 'Nova Seção',
      order_index: sections.length,
    }).select().single();
    if (data) {
      setSections([...sections, { ...data, items: [] }]);
      setExpandedSections(prev => new Set(prev).add(data.id));
    }
  };

  const deleteSection = async (sectionId: string) => {
    if (isPublished) return;
    await supabase.from('sections').delete().eq('id', sectionId);
    setSections(sections.filter(s => s.id !== sectionId));
  };

  const addItem = async (sectionId: string) => {
    if (isPublished) return;
    const section = sections.find(s => s.id === sectionId);
    const { data } = await supabase.from('items').insert({
      section_id: sectionId,
      title: '',
      description: null,
      reference_url: null,
      order_index: (section?.items || []).length,
    }).select().single();
    if (data) {
      setSections(sections.map(s =>
        s.id === sectionId ? { ...s, items: [...(s.items || []), data as ItemWithImages] } : s
      ));
    }
  };

  const deleteItem = async (sectionId: string, itemId: string) => {
    if (isPublished) return;
    await supabase.from('items').delete().eq('id', itemId);
    setSections(sections.map(s =>
      s.id === sectionId ? { ...s, items: (s.items || []).filter((i) => i.id !== itemId) } : s
    ));
  };

  const addAdjustment = async () => {
    if (!budgetId || isPublished) return;
    const { data } = await supabase.from('adjustments').insert({
      budget_id: budgetId,
      label: 'Ajuste',
      sign: 1,
      amount: 0,
    }).select().single();
    if (data) setAdjustments([...adjustments, data as AdjustmentRow]);
  };

  const deleteAdjustment = async (adjId: string) => {
    if (isPublished) return;
    await supabase.from('adjustments').delete().eq('id', adjId);
    setAdjustments(adjustments.filter(a => a.id !== adjId));
  };

  const publishBudget = async () => {
    if (!budget) return;
    const publicId = budget.public_id || crypto.randomUUID().replace(/-/g, '').slice(0, 12);
    await supabase.from('budgets').update({ status: 'published', public_id: publicId }).eq('id', budget.id);
    setBudget({ ...budget, status: 'published', public_id: publicId });
  };

  const updateSection = (sectionId: string, field: string, value: string | number | null) => {
    setSections(sections.map(s => s.id === sectionId ? { ...s, [field]: value } : s));
  };

  const updateItem = (sectionId: string, itemId: string, field: string, value: string | number | null) => {
    setSections(sections.map(s =>
      s.id === sectionId
        ? { ...s, items: (s.items || []).map((i) => i.id === itemId ? { ...i, [field]: value } : i) }
        : s
    ));
  };

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleCoverUpload = async (sectionId: string, file: File) => {
    const ext = file.name.split('.').pop();
    const path = `covers/${sectionId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('budget-assets').upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('budget-assets').getPublicUrl(path);
      updateSection(sectionId, 'cover_image_url', publicUrl);
    }
  };

  if (!budget) return <div className="min-h-screen bg-background flex items-center justify-center"><p className="text-muted-foreground font-body">Carregando...</p></div>;

  const total = calculateBudgetTotal(sections, adjustments);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/admin')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <input
              value={budget.project_name}
              onChange={(e) => setBudget({ ...budget, project_name: e.target.value })}
              className="font-display font-bold text-lg text-foreground bg-transparent border-none focus:outline-none focus:ring-0 w-48 sm:w-auto"
              placeholder="Nome do projeto"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={saveBudget}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              onClick={publishBudget}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium font-body hover:bg-muted transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Publicar
            </button>
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

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Editor column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Budget meta */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h3 className="font-display font-bold text-foreground">Dados do Orçamento</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-body">Cliente</label>
                <input value={budget.client_name} onChange={(e) => setBudget({ ...budget, client_name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-body">Unidade</label>
                <input value={budget.unit || ''} onChange={(e) => setBudget({ ...budget, unit: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1 font-body">Validade (dias)</label>
                <input type="number" value={budget.validity_days || 30} onChange={(e) => setBudget({ ...budget, validity_days: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm text-muted-foreground font-body cursor-pointer">
                  <input type="checkbox" checked={budget.show_item_qty ?? true} onChange={(e) => setBudget({ ...budget, show_item_qty: e.target.checked })} className="rounded border-border" />
                  Mostrar qtd dos itens
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1 font-body">Disclaimer</label>
              <textarea value={budget.disclaimer || ''} onChange={(e) => setBudget({ ...budget, disclaimer: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none h-20" />
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground">Seções</h3>
              <button onClick={addSection} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-body font-medium hover:bg-primary/90 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Seção
              </button>
            </div>

            {sections.map((section) => (
              <div key={section.id} className="rounded-xl border border-border bg-card overflow-hidden">
                {/* Section header */}
                <div className="p-4 flex items-center gap-3 border-b border-border bg-muted/30">
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab" />
                  <input
                    value={section.title}
                    onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                    className="flex-1 font-display font-semibold text-foreground bg-transparent border-none focus:outline-none"
                    placeholder="Título da seção"
                  />
                  <button onClick={() => toggleSection(section.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                    {expandedSections.has(section.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <button onClick={() => deleteSection(section.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {expandedSections.has(section.id) && (
                  <div className="p-4 space-y-4">
                    {/* Cover upload */}
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1.5 font-body">Capa da Seção</label>
                      {section.cover_image_url ? (
                        <div className="relative h-32 rounded-lg overflow-hidden">
                          <img src={section.cover_image_url} alt="" className="w-full h-full object-cover" />
                          <button onClick={() => updateSection(section.id, 'cover_image_url', null)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-foreground/60 text-card hover:bg-foreground/80 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center h-24 rounded-lg border-2 border-dashed border-border hover:border-primary/50 cursor-pointer transition-colors bg-muted/30">
                          <div className="text-center">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
                            <span className="text-xs text-muted-foreground font-body">Arraste ou clique para upload</span>
                          </div>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCoverUpload(section.id, file);
                          }} />
                        </label>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1 font-body">Subtítulo</label>
                        <input value={section.subtitle || ''} onChange={(e) => updateSection(section.id, 'subtitle', e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Benefício ou descrição curta" />
                      </div>
                      <div>
                        <label className="block text-xs text-muted-foreground mb-1 font-body">Preço da Seção (R$)</label>
                        <input type="number" value={section.section_price || ''} onChange={(e) => updateSection(section.id, 'section_price', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                          placeholder="Vazio = soma dos itens" />
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs text-muted-foreground font-body font-semibold uppercase tracking-wider">Itens</label>
                        <button onClick={() => addItem(section.id)} className="flex items-center gap-1 text-xs text-primary font-body font-medium hover:text-primary/80 transition-colors">
                          <Plus className="h-3 w-3" /> Item
                        </button>
                      </div>
                      <div className="space-y-2">
                        {(section.items || []).map((item) => (
                          <div key={item.id} className="rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors p-3 space-y-3">
                            <div className="flex items-center gap-2">
                              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 cursor-grab flex-shrink-0" />
                              <input value={item.title} onChange={(e) => updateItem(section.id, item.id, 'title', e.target.value)}
                                className="flex-1 text-sm font-body text-foreground bg-transparent border-none focus:outline-none min-w-0"
                                placeholder="Nome do item" />
                              <button onClick={() => deleteItem(section.id, item.id)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <input
                                value={item.description || ''}
                                onChange={(e) => updateItem(section.id, item.id, 'description', e.target.value)}
                                className="w-full text-sm font-body text-foreground bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                placeholder="Descrição do item"
                              />
                              <input
                                type="url"
                                value={item.reference_url || ''}
                                onChange={(e) => updateItem(section.id, item.id, 'reference_url', e.target.value || null)}
                                className="w-full text-sm font-body text-foreground bg-background border border-border rounded px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                placeholder="Link de referência (interno)"
                              />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <input type="number" value={item.qty || ''} onChange={(e) => updateItem(section.id, item.id, 'qty', e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full text-sm font-body text-foreground bg-background border border-border rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                placeholder="Qtd" />
                              <input value={item.unit || ''} onChange={(e) => updateItem(section.id, item.id, 'unit', e.target.value)}
                                className="w-full text-sm font-body text-foreground bg-background border border-border rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                placeholder="Un" />
                              <input type="number" value={item.internal_total || ''} onChange={(e) => updateItem(section.id, item.id, 'internal_total', e.target.value ? parseFloat(e.target.value) : null)}
                                className="w-full text-sm font-body text-foreground bg-background border border-border rounded px-2 py-2 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                placeholder="Valor (R$)" />
                              <button
                                onClick={() => updateItem(section.id, item.id, 'coverage_type', item.coverage_type === 'geral' ? 'local' : 'geral')}
                                className={`px-2 py-2 rounded text-xs font-body font-semibold uppercase tracking-wider border transition-colors ${
                                  item.coverage_type === 'geral'
                                    ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20'
                                    : 'bg-accent/50 text-accent-foreground border-border hover:bg-accent'
                                }`}
                                title={item.coverage_type === 'geral' ? 'Geral: aplica em todos os cômodos' : 'Local: selecionar cômodos manualmente'}
                              >
                                {item.coverage_type === 'geral' ? 'Geral' : 'Local'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Adjustments */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-foreground">Taxas / Ajustes</h3>
              <button onClick={addAdjustment} className="flex items-center gap-1 text-xs text-primary font-body font-medium hover:text-primary/80">
                <Plus className="h-3 w-3" /> Ajuste
              </button>
            </div>
            {adjustments.map(adj => (
              <div key={adj.id} className="flex items-center gap-2">
                <input value={adj.label} onChange={(e) => setAdjustments(adjustments.map(a => a.id === adj.id ? { ...a, label: e.target.value } : a))}
                  className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Descrição" />
                <select value={adj.sign} onChange={(e) => setAdjustments(adjustments.map(a => a.id === adj.id ? { ...a, sign: parseInt(e.target.value) } : a))}
                  className="px-2 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body">
                  <option value={1}>+</option>
                  <option value={-1}>−</option>
                </select>
                <input type="number" value={adj.amount} onChange={(e) => setAdjustments(adjustments.map(a => a.id === adj.id ? { ...a, amount: parseFloat(e.target.value) || 0 } : a))}
                  className="w-28 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Valor" />
                <button onClick={() => deleteAdjustment(adj.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Live preview sidebar */}
        <div className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-display font-bold text-foreground mb-4">Resumo</h3>
              <div className="space-y-2">
                {sections.map(s => (
                  <div key={s.id} className="flex justify-between text-sm font-body">
                    <span className="text-muted-foreground truncate mr-2">{s.title || 'Sem título'}</span>
                    <span className="text-foreground font-medium whitespace-nowrap">{formatBRL(calculateSectionSubtotal(s))}</span>
                  </div>
                ))}
              </div>
              {adjustments.length > 0 && (
                <div className="border-t border-border mt-3 pt-3 space-y-1">
                  {adjustments.map(adj => (
                    <div key={adj.id} className="flex justify-between text-sm font-body">
                      <span className="text-muted-foreground">{adj.label}</span>
                      <span className={adj.sign > 0 ? 'text-foreground' : 'text-success'}>{adj.sign > 0 ? '+' : '-'}{formatBRL(Math.abs(adj.amount))}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-border mt-3 pt-3 flex justify-between items-center">
                <span className="font-display font-bold text-foreground">Total</span>
                <span className="font-display font-bold text-xl text-primary">{formatBRL(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
