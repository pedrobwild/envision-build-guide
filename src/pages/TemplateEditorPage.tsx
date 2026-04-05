import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatBRL";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, ChevronDown, ChevronRight,
  LayoutTemplate, Loader2, MoreVertical, Package, Check, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ───────────────────────────────────────────────────────

interface TemplateData {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface TemplateSectionData {
  id: string;
  template_id: string;
  title: string;
  subtitle: string | null;
  order_index: number;
  is_optional: boolean;
  notes: string | null;
  items: TemplateItemData[];
}

interface TemplateItemData {
  id: string;
  template_section_id: string;
  title: string;
  description: string | null;
  unit: string | null;
  qty: number | null;
  order_index: number;
  coverage_type: string;
  reference_url: string | null;
  internal_unit_price: number | null;
  internal_total: number | null;
  bdi_percentage: number | null;
}

// ─── Calculation helpers ─────────────────────────────────────────

function calcSaleUnit(cost: number | null, bdi: number | null): number {
  return (Number(cost) || 0) * (1 + (Number(bdi) || 0) / 100);
}

function calcItemSaleTotal(item: TemplateItemData): number {
  const qty = Number(item.qty) || 1;
  return calcSaleUnit(item.internal_unit_price, item.bdi_percentage) * qty;
}

function calcItemCostTotal(item: TemplateItemData): number {
  if (item.internal_total != null && Number(item.internal_total) > 0) return Number(item.internal_total);
  return (Number(item.internal_unit_price) || 0) * (Number(item.qty) || 1);
}

function calcSectionCostTotal(section: TemplateSectionData): number {
  return section.items.reduce((s, i) => s + calcItemCostTotal(i), 0);
}

function calcSectionSaleTotal(section: TemplateSectionData): number {
  return section.items.reduce((s, i) => s + calcItemSaleTotal(i), 0);
}

// ─── Inline number input ─────────────────────────────────────────

function NumInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder={placeholder}
      step="any"
      className={cn(
        "w-full h-8 px-2 rounded border border-transparent bg-transparent text-sm font-mono text-right",
        "placeholder:text-muted-foreground/30 focus:outline-none focus:border-border hover:border-border",
        "transition-colors duration-100 tabular-nums font-body",
        className
      )}
    />
  );
}

// ─── Section context menu ────────────────────────────────────────

function SectionMenu({
  onDuplicate,
  onDelete,
}: {
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44 p-2 space-y-1" align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <button
          onClick={() => { onDuplicate(); setOpen(false); }}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted transition-colors"
        >
          <Package className="h-3 w-3" /> Duplicar seção
        </button>
        <button
          onClick={() => { if (confirm("Excluir esta seção e todos os seus itens?")) { onDelete(); setOpen(false); } }}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Excluir seção
        </button>
      </PopoverContent>
    </Popover>
  );
}

// ─── Sortable section wrapper ────────────────────────────────────

function SortableSectionCard({
  section,
  children,
}: {
  section: TemplateSectionData;
  children: (dragListeners: Record<string, unknown> | undefined) => React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      {children(listeners)}
    </div>
  );
}

// ─── Sortable item row ──────────────────────────────────────────

function SortableItemRow({
  item,
  sectionId,
  onUpdate,
  onDelete,
}: {
  item: TemplateItemData;
  sectionId: string;
  onUpdate: (sectionId: string, itemId: string, field: string, value: string | number | null) => void;
  onDelete: (sectionId: string, itemId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const saleTotal = calcItemSaleTotal(item);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="grid grid-cols-[1fr_80px_60px_100px_70px_100px_36px] gap-px items-center px-4 py-1 border-t border-border/20 hover:bg-muted/20 transition-colors group"
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <button {...listeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none">
          <GripVertical className="h-3 w-3 text-muted-foreground/20" />
        </button>
        <input
          type="text"
          value={item.title}
          onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
          className="flex-1 bg-transparent border-none outline-none text-sm text-foreground font-body truncate h-8 focus:ring-0"
          placeholder="Nome do item"
        />
      </div>
      <input
        type="text"
        value={item.unit ?? ""}
        onChange={(e) => onUpdate(sectionId, item.id, "unit", e.target.value || null)}
        className="h-8 px-2 bg-transparent border-none outline-none text-sm text-right text-muted-foreground font-body focus:ring-0 hover:border-border"
        placeholder="un"
      />
      <NumInput value={item.qty} onChange={(v) => onUpdate(sectionId, item.id, "qty", v)} />
      <NumInput value={item.internal_unit_price} onChange={(v) => onUpdate(sectionId, item.id, "internal_unit_price", v)} />
      <NumInput value={item.bdi_percentage} onChange={(v) => onUpdate(sectionId, item.id, "bdi_percentage", v)} className="text-muted-foreground" />
      <span className="text-sm font-mono tabular-nums text-right text-foreground pr-1">
        {saleTotal > 0 ? formatBRL(saleTotal) : "—"}
      </span>
      <button
        onClick={() => onDelete(sectionId, item.id)}
        className="h-7 w-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 transition-all"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Auto-save status chip ───────────────────────────────────────

type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

function AutoSaveChip({ status }: { status: AutoSaveStatus }) {
  if (status === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground font-body px-2.5 py-1 rounded-full bg-muted/60">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvando…
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive font-body px-2.5 py-1 rounded-full bg-destructive/10">
        <X className="h-3 w-3" />
        Erro ao salvar
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-success font-body px-2.5 py-1 rounded-full bg-success/10">
        <Check className="h-3 w-3" />
        Salvo
      </span>
    );
  }
  return null;
}

// ─── Main page ───────────────────────────────────────────────────

export default function TemplateEditorPage() {
  const { templateId } = useParams<{ templateId: string }>();
  const navigate = useNavigate();
  const [template, setTemplate] = useState<TemplateData | null>(null);
  const [sections, setSections] = useState<TemplateSectionData[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [autoSaveStatus, setAutoSaveStatus] = useState<AutoSaveStatus>("idle");

  // Auto-save refs
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const isInitialLoadRef = useRef(true);
  const templateRef = useRef(template);
  const sectionsRef = useRef(sections);
  templateRef.current = template;
  sectionsRef.current = sections;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Load ────────────────────────────────────────────────────
  const loadTemplate = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);

    const { data: tpl } = await supabase
      .from("budget_templates")
      .select("*")
      .eq("id", templateId)
      .single();
    if (!tpl) { navigate("/admin/templates"); return; }
    setTemplate(tpl);

    const { data: secs } = await supabase
      .from("budget_template_sections")
      .select("*")
      .eq("template_id", templateId)
      .order("order_index");

    const sectionList = (secs ?? []) as any[];
    const sectionIds = sectionList.map((s) => s.id);

    const { data: items } = await supabase
      .from("budget_template_items")
      .select("*")
      .in("template_section_id", sectionIds.length ? sectionIds : ["__none__"])
      .order("order_index");

    const enriched: TemplateSectionData[] = sectionList.map((sec) => ({
      ...sec,
      items: ((items ?? []) as any[]).filter((i) => i.template_section_id === sec.id),
    }));

    setSections(enriched);
    setExpandedSections(new Set(sectionList.map((s) => s.id)));
    setLoading(false);
    // Allow auto-save to kick in only after initial load
    setTimeout(() => { isInitialLoadRef.current = false; }, 100);
  }, [templateId, navigate]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  // ─── Persist (auto-save core) ─────────────────────────────────
  const persistAll = useCallback(async () => {
    const tpl = templateRef.current;
    const secs = sectionsRef.current;
    if (!tpl) return;
    setAutoSaveStatus("saving");
    try {
      await supabase
        .from("budget_templates")
        .update({ name: tpl.name, description: tpl.description })
        .eq("id", tpl.id);

      for (const section of secs) {
        await supabase
          .from("budget_template_sections")
          .update({
            title: section.title,
            subtitle: section.subtitle,
            order_index: section.order_index,
            is_optional: section.is_optional,
            notes: section.notes,
          })
          .eq("id", section.id);

        for (const item of section.items) {
          await supabase
            .from("budget_template_items")
            .update({
              title: item.title,
              description: item.description,
              unit: item.unit,
              qty: item.qty,
              order_index: item.order_index,
              internal_unit_price: item.internal_unit_price,
              internal_total: item.internal_total,
              bdi_percentage: item.bdi_percentage,
              reference_url: item.reference_url,
            })
            .eq("id", item.id);
        }
      }

      setAutoSaveStatus("saved");
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setAutoSaveStatus("idle"), 3000);
    } catch {
      setAutoSaveStatus("error");
    }
  }, []);

  // ─── Schedule auto-save on data changes ─────────────────────
  const scheduleSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistAll(), 1500);
  }, [persistAll]);

  useEffect(() => {
    if (isInitialLoadRef.current) return;
    scheduleSave();
  }, [template, sections, scheduleSave]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  // ─── Section mutations ───────────────────────────────────────
  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const updateSection = (sectionId: string, field: string, value: any) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, [field]: value } : s))
    );
  };

  const addSection = async () => {
    if (!templateId) return;
    const { data, error } = await supabase
      .from("budget_template_sections")
      .insert({
        template_id: templateId,
        title: "Nova Seção",
        order_index: sections.length,
      } as any)
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar seção"); return; }
    const newSec: TemplateSectionData = { ...(data as any), items: [] };
    setSections((prev) => [...prev, newSec]);
    setExpandedSections((prev) => new Set(prev).add(newSec.id));
  };

  const duplicateSection = async (section: TemplateSectionData) => {
    if (!templateId) return;
    const { data: newSec } = await supabase
      .from("budget_template_sections")
      .insert({
        template_id: templateId,
        title: `${section.title} (cópia)`,
        subtitle: section.subtitle,
        order_index: sections.length,
        is_optional: section.is_optional,
        notes: section.notes,
      } as any)
      .select("*")
      .single();
    if (!newSec) { toast.error("Erro ao duplicar"); return; }

    const newItems: TemplateItemData[] = [];
    for (const item of section.items) {
      const { data: newItem } = await supabase
        .from("budget_template_items")
        .insert({
          template_section_id: (newSec as any).id,
          title: item.title,
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          order_index: item.order_index,
          internal_unit_price: item.internal_unit_price,
          internal_total: item.internal_total,
          bdi_percentage: item.bdi_percentage,
          reference_url: item.reference_url,
        } as any)
        .select("*")
        .single();
      if (newItem) newItems.push(newItem as any);
    }

    setSections((prev) => [...prev, { ...(newSec as any), items: newItems }]);
    toast.success("Seção duplicada");
  };

  const deleteSection = async (sectionId: string) => {
    await supabase.from("budget_template_items").delete().eq("template_section_id", sectionId);
    await supabase.from("budget_template_sections").delete().eq("id", sectionId);
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
    toast.success("Seção excluída");
  };

  // ─── Drag & drop: sections ──────────────────────────────────
  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex((s) => s.id === active.id);
    const newIndex = sections.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(sections, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order_index: i,
    }));
    setSections(reordered);

    // Persist
    await Promise.all(
      reordered.map((s) =>
        supabase.from("budget_template_sections").update({ order_index: s.order_index }).eq("id", s.id)
      )
    );
  };

  // ─── Drag & drop: items within a section ────────────────────
  const handleItemDragEnd = (sectionId: string) => async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const oldIdx = s.items.findIndex((i) => i.id === active.id);
        const newIdx = s.items.findIndex((i) => i.id === over.id);
        if (oldIdx === -1 || newIdx === -1) return s;
        const reordered = arrayMove(s.items, oldIdx, newIdx).map((item, i) => ({
          ...item,
          order_index: i,
        }));

        // Persist in background
        Promise.all(
          reordered.map((item) =>
            supabase.from("budget_template_items").update({ order_index: item.order_index }).eq("id", item.id)
          )
        );

        return { ...s, items: reordered };
      })
    );
  };

  // ─── Item mutations ──────────────────────────────────────────
  const updateItem = (sectionId: string, itemId: string, field: string, value: any) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              items: s.items.map((i) =>
                i.id === itemId ? { ...i, [field]: value } : i
              ),
            }
          : s
      )
    );
  };

  const addItem = async (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return;
    const { data, error } = await supabase
      .from("budget_template_items")
      .insert({
        template_section_id: sectionId,
        title: "",
        order_index: section.items.length,
      } as any)
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar item"); return; }
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, data as any] } : s
      )
    );
  };

  const deleteItem = async (sectionId: string, itemId: string) => {
    await supabase.from("budget_template_items").delete().eq("id", itemId);
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, items: s.items.filter((i) => i.id !== itemId) }
          : s
      )
    );
  };

  // ─── Totals ──────────────────────────────────────────────────
  const totalCost = sections.reduce((s, sec) => s + calcSectionCostTotal(sec), 0);
  const totalSale = sections.reduce((s, sec) => s + calcSectionSaleTotal(sec), 0);
  const totalItems = sections.reduce((s, sec) => s + sec.items.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/templates")} className="shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate className="h-5 w-5 text-primary shrink-0" />
            <input
              type="text"
              value={template.name}
              onChange={(e) => setTemplate({ ...template, name: e.target.value })}
              className="text-lg font-semibold font-display bg-transparent border-none outline-none w-full focus:ring-0 text-foreground"
              placeholder="Nome do template"
            />
          </div>
          <input
            type="text"
            value={template.description ?? ""}
            onChange={(e) => setTemplate({ ...template, description: e.target.value || null })}
            className="text-sm text-muted-foreground bg-transparent border-none outline-none w-full focus:ring-0 mt-0.5 font-body"
            placeholder="Descrição do template..."
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <AutoSaveChip status={autoSaveStatus} />
          <Button onClick={persistAll} disabled={autoSaveStatus === "saving"} variant="outline" size="sm" className="gap-1.5">
            <Save className="h-3.5 w-3.5" />
            Salvar agora
          </Button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground font-body bg-muted/50 rounded-lg px-4 py-2.5 flex-wrap">
        <span>{sections.length} seções</span>
        <span className="text-border">•</span>
        <span>{totalItems} itens</span>
        <span className="text-border">•</span>
        <span>Custo: <strong className="text-foreground">{formatBRL(totalCost)}</strong></span>
        <span className="text-border">•</span>
        <span>Venda: <strong className="text-foreground">{formatBRL(totalSale)}</strong></span>
        {totalCost > 0 && (
          <>
            <span className="text-border">•</span>
            <span>BDI médio: <strong className="text-foreground">{(((totalSale - totalCost) / totalCost) * 100).toFixed(1)}%</strong></span>
          </>
        )}
      </div>

      {/* Sections with DnD */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {sections.map((section) => {
              const isExpanded = expandedSections.has(section.id);
              const sectionSale = calcSectionSaleTotal(section);

              return (
                <SortableSectionCard key={section.id} section={section}>
                  {(dragListeners) => (
                    <div className="rounded-md border border-border/60 bg-card overflow-hidden">
                      {/* Section header */}
                      <button
                        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
                        onClick={() => toggleSection(section.id)}
                      >
                        <span {...dragListeners} className="cursor-grab active:cursor-grabbing shrink-0 touch-none" onClick={(e) => e.stopPropagation()}>
                          <GripVertical className="h-4 w-4 text-muted-foreground/30" />
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <input
                          type="text"
                          value={section.title}
                          onChange={(e) => updateSection(section.id, "title", e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-foreground font-body"
                          placeholder="Nome da seção"
                        />
                        {section.is_optional && (
                          <Badge variant="secondary" className="text-[10px] shrink-0">Opcional</Badge>
                        )}
                        <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                          {section.items.length} itens
                        </span>
                        {sectionSale > 0 && (
                          <span className="text-xs font-medium text-foreground font-mono tabular-nums shrink-0">
                            {formatBRL(sectionSale)}
                          </span>
                        )}
                        <SectionMenu
                          onDuplicate={() => duplicateSection(section)}
                          onDelete={() => deleteSection(section.id)}
                        />
                      </button>

                      {/* Items table with DnD */}
                      {isExpanded && (
                        <div className="border-t border-border/40">
                          {/* Table header */}
                          <div className="grid grid-cols-[1fr_80px_60px_100px_70px_100px_36px] gap-px bg-muted/50 px-4 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground font-body">
                            <span>Item</span>
                            <span className="text-right">Unidade</span>
                            <span className="text-right">Qtd</span>
                            <span className="text-right">Custo Unit.</span>
                            <span className="text-right">BDI %</span>
                            <span className="text-right">Venda Total</span>
                            <span />
                          </div>

                          {/* Items */}
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd(section.id)}>
                            <SortableContext items={section.items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                              {section.items.map((item) => (
                                <SortableItemRow
                                  key={item.id}
                                  item={item}
                                  sectionId={section.id}
                                  onUpdate={updateItem}
                                  onDelete={deleteItem}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>

                          {/* Add item */}
                          <div className="px-4 py-2 border-t border-border/20">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => addItem(section.id)}
                            >
                              <Plus className="h-3.5 w-3.5" /> Adicionar item
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </SortableSectionCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add section */}
      <Button variant="outline" className="gap-2 w-full" onClick={addSection}>
        <Plus className="h-4 w-4" /> Adicionar seção
      </Button>
    </div>
  );
}
