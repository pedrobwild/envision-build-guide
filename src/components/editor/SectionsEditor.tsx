import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  Package, DollarSign, Hash, FileText, Loader2
} from "lucide-react";

interface SectionData {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  items: ItemData[];
}

interface ItemData {
  id: string;
  title: string;
  description?: string | null;
  qty?: number | null;
  unit?: string | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  order_index: number;
}

interface SectionsEditorProps {
  budgetId: string;
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
}

export function SectionsEditor({ budgetId, sections, onSectionsChange }: SectionsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const debouncedSave = useCallback((table: string, id: string, updates: Record<string, any>) => {
    const key = `${table}-${id}`;
    if (timers.current[key]) clearTimeout(timers.current[key]);
    setSavingIds(prev => new Set(prev).add(id));
    timers.current[key] = setTimeout(async () => {
      await supabase.from(table as any).update(updates).eq("id", id);
      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 600);
  }, []);

  const updateSection = (sectionId: string, field: string, value: any) => {
    const updated = sections.map(s =>
      s.id === sectionId ? { ...s, [field]: value } : s
    );
    onSectionsChange(updated);
    debouncedSave("sections", sectionId, { [field]: value });
  };

  const updateItem = (sectionId: string, itemId: string, field: string, value: any) => {
    const updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = s.items.map(i =>
        i.id === itemId ? { ...i, [field]: value } : i
      );
      // If internal_total changed, recalc section_price
      if (field === "internal_total") {
        const newTotal = newItems.reduce((sum, i) => sum + (Number(i.internal_total) || 0), 0);
        debouncedSave("sections", sectionId, { section_price: newTotal });
        return { ...s, items: newItems, section_price: newTotal };
      }
      return { ...s, items: newItems };
    });
    onSectionsChange(updated);
    debouncedSave("items", itemId, { [field]: value });
  };

  const addSection = async () => {
    const order = sections.length;
    const { data } = await supabase
      .from("sections")
      .insert({ budget_id: budgetId, title: "Nova Seção", order_index: order })
      .select()
      .single();
    if (data) {
      const newSection: SectionData = { ...data, items: [] };
      onSectionsChange([...sections, newSection]);
      setExpandedSections(prev => new Set(prev).add(data.id));
      toast.success("Seção adicionada");
    }
  };

  const addItem = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    const order = section?.items.length || 0;
    const { data } = await supabase
      .from("items")
      .insert({ section_id: sectionId, title: "Novo Item", order_index: order })
      .select()
      .single();
    if (data) {
      const updated = sections.map(s => {
        if (s.id !== sectionId) return s;
        return { ...s, items: [...s.items, data as ItemData] };
      });
      onSectionsChange(updated);
    }
  };

  const deleteItem = async (sectionId: string, itemId: string) => {
    await supabase.from("items").delete().eq("id", itemId);
    const updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = s.items.filter(i => i.id !== itemId);
      const newTotal = newItems.reduce((sum, i) => sum + (Number(i.internal_total) || 0), 0);
      // Sync section_price so public view reflects the change
      supabase.from("sections").update({ section_price: newTotal }).eq("id", sectionId);
      return { ...s, items: newItems, section_price: newTotal };
    });
    onSectionsChange(updated);
    toast.success("Item removido");
  };

  const deleteSection = async (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (section && section.items.length > 0) {
      const itemIds = section.items.map(i => i.id);
      await supabase.from("items").delete().in("id", itemIds);
    }
    await supabase.from("sections").delete().eq("id", sectionId);
    onSectionsChange(sections.filter(s => s.id !== sectionId));
    toast.success("Seção removida");
  };

  const getSectionTotal = (section: SectionData) => {
    // Always sum from items when items exist, so adding/removing/editing items reflects immediately
    if (section.items.length > 0) {
      const itemsSum = section.items.reduce((sum, i) => sum + (Number(i.internal_total) || 0), 0);
      return itemsSum * (Number(section.qty) || 1);
    }
    if (section.section_price) return Number(section.section_price) * (Number(section.qty) || 1);
    return 0;
  };

  const grandTotal = sections.reduce((sum, s) => sum + getSectionTotal(s), 0);

  return (
    <div className="max-w-3xl mx-auto mt-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-display text-2xl font-bold text-foreground">Seções e Itens</h2>
          <p className="text-muted-foreground font-body text-sm mt-1">
            Total geral: <span className="font-semibold text-foreground" style={{ fontVariantNumeric: "tabular-nums" }}>{formatBRL(grandTotal)}</span>
          </p>
        </div>
        <button
          onClick={addSection}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium font-body hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> Seção
        </button>
      </div>

      {sections.length === 0 && (
        <div className="text-center py-12 border border-dashed border-border rounded-xl">
          <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-body text-sm">Nenhuma seção ainda. Importe um PDF ou adicione manualmente.</p>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((section) => {
          const isExpanded = expandedSections.has(section.id);
          const sectionTotal = getSectionTotal(section);
          const isSaving = savingIds.has(section.id);

          return (
            <div key={section.id} className="border border-border rounded-xl bg-card overflow-hidden">
              {/* Section header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-body font-medium text-sm text-foreground truncate">
                      {section.title || "Sem título"}
                    </span>
                    {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-body">
                    {section.items.length} {section.items.length === 1 ? "item" : "itens"}
                  </span>
                </div>
                <span className="font-display font-semibold text-sm text-foreground whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {formatBRL(sectionTotal)}
                </span>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Section fields */}
                  <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-3 bg-muted/30">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-xs font-medium text-muted-foreground font-body">Título da seção</label>
                      <input
                        type="text"
                        value={section.title}
                        onChange={(e) => updateSection(section.id, "title", e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground font-body">Preço da seção (R$)</label>
                      <input
                        type="number"
                        value={section.section_price ?? ""}
                        onChange={(e) => updateSection(section.id, "section_price", e.target.value ? Number(e.target.value) : null)}
                        onClick={(e) => e.stopPropagation()}
                        placeholder="Calculado pelos itens"
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      />
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-border">
                    {section.items.map((item) => {
                      const isItemSaving = savingIds.has(item.id);
                      return (
                        <div key={item.id} className="px-4 py-3 hover:bg-muted/20 transition-colors">
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            {/* Title + description */}
                            <div className="sm:col-span-5 space-y-1.5">
                              <input
                                type="text"
                                value={item.title}
                                onChange={(e) => updateItem(section.id, item.id, "title", e.target.value)}
                                placeholder="Nome do item"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                              <input
                                type="text"
                                value={item.description || ""}
                                onChange={(e) => updateItem(section.id, item.id, "description", e.target.value)}
                                placeholder="Descrição (opcional)"
                                className="w-full px-2.5 py-1.5 rounded-md border border-border/60 bg-background text-foreground text-xs font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                              />
                            </div>
                            {/* Qty */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-xs text-muted-foreground font-body flex items-center gap-1">
                                <Hash className="h-3 w-3" /> Qtd
                              </label>
                              <input
                                type="number"
                                value={item.qty ?? ""}
                                onChange={(e) => updateItem(section.id, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
                                placeholder="1"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              />
                            </div>
                            {/* Unit price */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-xs text-muted-foreground font-body flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> Unitário
                              </label>
                              <input
                                type="number"
                                value={item.internal_unit_price ?? ""}
                                onChange={(e) => updateItem(section.id, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              />
                            </div>
                            {/* Total */}
                            <div className="sm:col-span-2 space-y-1">
                              <label className="text-xs text-muted-foreground font-body flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> Total
                              </label>
                              <input
                                type="number"
                                value={item.internal_total ?? ""}
                                onChange={(e) => updateItem(section.id, item.id, "internal_total", e.target.value ? Number(e.target.value) : null)}
                                placeholder="0.00"
                                step="0.01"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                                style={{ fontVariantNumeric: "tabular-nums" }}
                              />
                            </div>
                            {/* Actions */}
                            <div className="sm:col-span-1 flex items-end justify-end gap-1">
                              {isItemSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                              <button
                                onClick={() => deleteItem(section.id, item.id)}
                                className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                title="Excluir item"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Add item + delete section */}
                  <div className="px-4 py-3 flex items-center justify-between border-t border-border bg-muted/20">
                    <button
                      onClick={() => addItem(section.id)}
                      className="flex items-center gap-1.5 text-sm font-body text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar item
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Excluir esta seção e todos os seus itens?")) deleteSection(section.id);
                      }}
                      className="flex items-center gap-1.5 text-sm font-body text-destructive hover:text-destructive/80 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Excluir seção
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
