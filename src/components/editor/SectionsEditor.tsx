import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { toast } from "sonner";
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  Package, DollarSign, Hash, FileText, Loader2, ImagePlus, X, Star, ToggleRight
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { saveToPhotoLibrary } from "@/lib/item-photo-library";

/* ── Inline image management for editor items ── */
function ItemImageInline({
  itemId,
  itemTitle,
  budgetId,
  images,
  onImagesChange,
}: {
  itemId: string;
  itemTitle: string;
  budgetId: string;
  images: { id: string; url: string; is_primary?: boolean | null }[];
  onImagesChange: (imgs: { id: string; url: string; is_primary?: boolean | null }[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, 5 - images.length)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop();
        const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
        if (error) { toast.error("Erro no upload"); continue; }
        const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
        const isPrimary = images.length === 0;
        const { data: imgRow } = await supabase.from("item_images").insert({
          item_id: itemId,
          url: urlData.publicUrl,
          is_primary: isPrimary,
        }).select().single();
        if (imgRow) {
          images = [...images, imgRow];
          if (isPrimary) saveToPhotoLibrary(itemTitle, urlData.publicUrl);
        }
      }
      onImagesChange(images);
      toast.success("Imagem adicionada");
    } catch { toast.error("Erro ao fazer upload"); }
    setUploading(false);
  };

  const removeImage = async (imgId: string) => {
    await supabase.from("item_images").delete().eq("id", imgId);
    const updated = images.filter(i => i.id !== imgId);
    if (updated.length > 0 && !updated.some(i => i.is_primary)) {
      updated[0] = { ...updated[0], is_primary: true };
      await supabase.from("item_images").update({ is_primary: true }).eq("id", updated[0].id);
    }
    onImagesChange(updated);
  };

  const setPrimary = async (imgId: string) => {
    // Unset all, set new primary
    for (const img of images) {
      if (img.is_primary) await supabase.from("item_images").update({ is_primary: false }).eq("id", img.id);
    }
    await supabase.from("item_images").update({ is_primary: true }).eq("id", imgId);
    const updated = images.map(i => ({ ...i, is_primary: i.id === imgId }));
    onImagesChange(updated);
    const primary = updated.find(i => i.is_primary);
    if (primary) saveToPhotoLibrary(itemTitle, primary.url);
  };

  return (
    <div className="mt-2 ml-7 flex items-center gap-1.5 flex-wrap">
      {images.map(img => (
        <div
          key={img.id}
          className={cn(
            "relative group w-10 h-10 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0",
            img.is_primary ? "border-primary" : "border-border"
          )}
        >
          <img src={img.url} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
            <button onClick={() => setPrimary(img.id)} className="p-0.5 rounded hover:bg-white/20" title="Principal">
              <Star className={cn("h-2.5 w-2.5", img.is_primary ? "text-yellow-400 fill-yellow-400" : "text-white")} />
            </button>
            <button onClick={() => removeImage(img.id)} className="p-0.5 rounded hover:bg-white/20" title="Remover">
              <X className="h-2.5 w-2.5 text-white" />
            </button>
          </div>
        </div>
      ))}
      {images.length < 5 && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-10 h-10 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0"
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
    </div>
  );
}

interface SectionData {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  is_optional?: boolean;
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
  images?: { id: string; url: string; is_primary?: boolean | null }[];
}

interface SectionsEditorProps {
  budgetId: string;
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
}

/* ── Sortable Section wrapper ── */
function SortableSectionCard({
  section,
  children,
}: {
  section: SectionData;
  children: (listeners: any) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="border border-border rounded-xl bg-card overflow-hidden">
        {children(listeners)}
      </div>
    </div>
  );
}

/* ── Sortable Item wrapper ── */
function SortableItemRow({
  item,
  sectionId,
  budgetId,
  isItemSaving,
  onUpdate,
  onDelete,
  onImagesChange,
}: {
  item: ItemData;
  sectionId: string;
  budgetId: string;
  isItemSaving: boolean;
  onUpdate: (sectionId: string, itemId: string, field: string, value: any) => void;
  onDelete: (sectionId: string, itemId: string) => void;
  onImagesChange: (sectionId: string, itemId: string, images: ItemData["images"]) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "px-4 py-3 hover:bg-muted/20 transition-colors border-b border-border last:border-b-0",
        isDragging && "bg-muted/40 shadow-lg rounded-lg"
      )}
    >
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Drag handle + Title + description */}
        <div className="sm:col-span-5 space-y-1.5">
          <div className="flex items-center gap-2">
            <button
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/50 hover:text-muted-foreground transition-colors flex-shrink-0 touch-none"
              title="Arrastar para reordenar"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
              placeholder="Nome do item"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <input
            type="text"
            value={item.description || ""}
            onChange={(e) => onUpdate(sectionId, item.id, "description", e.target.value)}
            placeholder="Descrição (opcional)"
            className="w-full px-2.5 py-1.5 rounded-md border border-border/60 bg-background text-foreground text-xs font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ml-7"
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
            onChange={(e) => onUpdate(sectionId, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
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
            onChange={(e) => onUpdate(sectionId, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
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
            onChange={(e) => onUpdate(sectionId, item.id, "internal_total", e.target.value ? Number(e.target.value) : null)}
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
            onClick={() => {
              if (confirm("Excluir este item?")) onDelete(sectionId, item.id);
            }}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            title="Excluir item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Item image management */}
      <ItemImageInline
        itemId={item.id}
        itemTitle={item.title}
        budgetId={budgetId}
        images={item.images || []}
        onImagesChange={(imgs) => onImagesChange(sectionId, item.id, imgs)}
      />
    </div>
  );
}

export function SectionsEditor({ budgetId, sections, onSectionsChange }: SectionsEditorProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  const handleImagesChange = (sectionId: string, itemId: string, images: ItemData["images"]) => {
    const updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      return {
        ...s,
        items: s.items.map(i => i.id === itemId ? { ...i, images } : i),
      };
    });
    onSectionsChange(updated);
  };

  const getSectionTotal = (section: SectionData) => {
    const qty = Number(section.qty) || 1;
    if (section.items.length > 0) {
      const itemsSum = section.items.reduce((sum, i) => sum + (Number(i.internal_total) || 0), 0);
      if (itemsSum > 0) return itemsSum * qty;
    }
    if (section.section_price) return Number(section.section_price) * qty;
    return 0;
  };

  const grandTotal = sections.reduce((sum, s) => sum + getSectionTotal(s), 0);

  /* ── Drag handlers ── */
  const handleSectionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);

    // Update order_index locally and persist
    const withNewOrder = reordered.map((s, i) => ({ ...s, order_index: i }));
    onSectionsChange(withNewOrder);
    withNewOrder.forEach(s => {
      supabase.from("sections").update({ order_index: s.order_index }).eq("id", s.id);
    });
    toast.success("Ordem das seções atualizada");
  };

  const handleItemDragEnd = (sectionId: string) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const oldIndex = s.items.findIndex(i => i.id === active.id);
      const newIndex = s.items.findIndex(i => i.id === over.id);
      const reordered = arrayMove(s.items, oldIndex, newIndex).map((item, i) => ({
        ...item,
        order_index: i,
      }));
      // Persist new order
      reordered.forEach(item => {
        supabase.from("items").update({ order_index: item.order_index }).eq("id", item.id);
      });
      return { ...s, items: reordered };
    });
    onSectionsChange(updated);
  };

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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSectionDragEnd}
      >
        <SortableContext items={sections.map(s => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const sectionTotal = getSectionTotal(section);
              const isSaving = savingIds.has(section.id);

              return (
                <SortableSectionCard key={section.id} section={section}>
                  {(dragListeners: any) => (
                    <>
                      {/* Section header */}
                      <div className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                        <button
                          {...dragListeners}
                          className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0 touch-none"
                          title="Arrastar para reordenar seção"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <div
                          className="flex items-center gap-3 flex-1 min-w-0"
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
                              {section.is_optional && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-warning/15 text-warning border border-warning/20">
                                  Opcional
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground font-body">
                              {section.items.length} {section.items.length === 1 ? "item" : "itens"}
                            </span>
                          </div>
                          <span className="font-display font-semibold text-sm text-foreground whitespace-nowrap" style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatBRL(sectionTotal)}
                          </span>
                        </div>
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
                            <div className="space-y-1 flex items-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateSection(section.id, "is_optional", !section.is_optional);
                                }}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-body transition-all",
                                  section.is_optional
                                    ? "bg-warning/10 border-warning/30 text-warning"
                                    : "bg-background border-border text-muted-foreground hover:border-warning/30 hover:text-warning"
                                )}
                              >
                                <ToggleRight className="h-4 w-4" />
                                {section.is_optional ? "Opcional ✓" : "Marcar opcional"}
                              </button>
                            </div>
                          </div>

                          {/* Items with DnD */}
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handleItemDragEnd(section.id)}
                          >
                            <SortableContext
                              items={section.items.map(i => i.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div>
                                {section.items.map((item) => (
                                  <SortableItemRow
                                    key={item.id}
                                    item={item}
                                    sectionId={section.id}
                                    budgetId={budgetId}
                                    isItemSaving={savingIds.has(item.id)}
                                    onUpdate={updateItem}
                                    onDelete={deleteItem}
                                    onImagesChange={handleImagesChange}
                                  />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>

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
                    </>
                  )}
                </SortableSectionCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
