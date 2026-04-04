import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatBRL";
import { toast } from "sonner";
import { SCOPE_CATEGORIES } from "@/lib/scope-categories";
import { TAX_ITEM_TITLE, TAX_RATE } from "@/lib/default-budget-sections";
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  Package, DollarSign, Hash, FileText, FileSpreadsheet, Loader2, ImagePlus, X, Star, ToggleRight, Pencil,
  PenLine, BookOpen, BookmarkPlus, Link as LinkIcon, Lock, Search, ChevronsUpDown, ChevronsDownUp,
  AlertTriangle, AlertCircle, Paperclip, Rows3, Rows4, MoreVertical,
} from "lucide-react";
import { EmptyState } from "@/components/editor/EmptyState";
import { ItemImageLightbox } from "@/components/editor/ItemImageLightbox";
import { ItemDetailSheet } from "@/components/editor/ItemDetailSheet";
import { AddItemPopover } from "@/components/editor/AddItemPopover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/* ── BDI validation helpers ── */
function getBdiStatus(bdi: number | null | undefined): "zero" | "normal" | "high" | "extreme" {
  const v = Number(bdi) || 0;
  if (v === 0) return "zero";
  if (v <= 80) return "normal";
  if (v <= 150) return "high";
  return "extreme";
}

function getBdiTooltip(bdi: number | null | undefined): string {
  const v = Number(bdi) || 0;
  const status = getBdiStatus(bdi);
  if (status === "zero") return "BDI zero: o item será vendido pelo custo, sem margem";
  if (status === "high") return "BDI elevado — verifique se o valor está correto";
  if (status === "extreme") {
    const margin = (v / (100 + v) * 100).toFixed(1);
    return `BDI muito alto (acima de 150%). Isso pode ser um erro de digitação. A margem resultante será de ${margin}%.`;
  }
  return "";
}

function BdiInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  const status = getBdiStatus(value);
  const tooltip = getBdiTooltip(value);

  const input = (
    <div className="relative">
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        placeholder="0"
        step="0.01"
        className={cn(
          "w-full px-2 py-1.5 rounded-md border text-sm font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 transition-all tabular-nums cursor-text",
          status === "zero" && "border-yellow-400 dark:border-yellow-500 bg-background hover:border-yellow-500 focus:border-yellow-500 focus:ring-yellow-300/30",
          status === "normal" && "border-input bg-background hover:border-primary/40 focus:border-primary focus:ring-primary/20",
          status === "high" && "border-input bg-background hover:border-primary/40 focus:border-primary focus:ring-primary/20 pr-7",
          status === "extreme" && "border-destructive bg-background hover:border-destructive focus:border-destructive focus:ring-destructive/20 pr-7",
        )}
      />
      {status === "high" && (
        <AlertTriangle className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-500" />
      )}
      {status === "extreme" && (
        <AlertCircle className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-destructive" />
      )}
    </div>
  );

  if (status === "normal") return input;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{input}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}


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

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const handleLightboxRemove = async (imgId: string) => {
    await removeImage(imgId);
  };

  return (
    <>
      <div className="mt-2 ml-7 flex items-center gap-1.5 flex-wrap">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className={cn(
              "relative group w-10 h-10 rounded-lg overflow-hidden border-2 transition-colors flex-shrink-0 cursor-pointer",
              img.is_primary ? "border-primary" : "border-border"
            )}
            onClick={() => openLightbox(idx)}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); setPrimary(img.id); }} className="p-0.5 rounded hover:bg-white/20" title="Principal">
                <Star className={cn("h-2.5 w-2.5", img.is_primary ? "text-yellow-400 fill-yellow-400" : "text-white")} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="p-0.5 rounded hover:bg-white/20" title="Remover">
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

      <ItemImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onRemove={handleLightboxRemove}
      />
    </>
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
  reference_url?: string | null;
  qty?: number | null;
  unit?: string | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
  order_index: number;
  catalog_item_id?: string | null;
  catalog_snapshot?: Record<string, any> | null;
  notes?: string | null;
  images?: { id: string; url: string; is_primary?: boolean | null }[];
}

/* ── BDI helpers ── */
function calcSaleUnitPrice(cost: number | null | undefined, bdi: number | null | undefined): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (1 + b / 100);
}

function calcItemSaleTotal(item: ItemData): number {
  const qty = Number(item.qty) || 1;
  const saleUnit = calcSaleUnitPrice(item.internal_unit_price, item.bdi_percentage);
  return saleUnit * qty;
}

function calcItemCostTotal(item: ItemData): number {
  if (item.internal_total != null && Number(item.internal_total) > 0) return Number(item.internal_total);
  const qty = Number(item.qty) || 1;
  return (Number(item.internal_unit_price) || 0) * qty;
}

function calcSectionCostTotal(section: SectionData): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemCostTotal(i), 0);
    if (sum > 0) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

function calcSectionSaleTotal(section: SectionData): number {
  const qty = Number(section.qty) || 1;
  if (section.items.length > 0) {
    const sum = section.items.reduce((s, i) => s + calcItemSaleTotal(i), 0);
    if (sum > 0) return sum * qty;
  }
  return (Number(section.section_price) || 0) * qty;
}

interface SectionsEditorProps {
  budgetId: string;
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
}

/* ── Section context menu (rename + delete) ── */
function SectionContextMenu({
  section,
  onRename,
  onDelete,
}: {
  section: SectionData;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(section.title);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(section.title); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
          title="Configurações da seção"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 space-y-3" align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="space-y-1.5">
          <label className="text-xs font-body font-medium text-muted-foreground">Nome da seção</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); onRename(e.target.value); }}
            className="w-full px-2.5 py-1.5 rounded-md border border-input bg-background text-sm font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
          />
        </div>
        <button
          onClick={() => {
            if (confirm("Excluir esta seção e todos os seus itens?")) {
              onDelete();
              setOpen(false);
            }
          }}
          className="flex items-center gap-1.5 w-full px-2.5 py-1.5 rounded-md text-xs font-body text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="h-3 w-3" /> Excluir seção
        </button>
      </PopoverContent>
    </Popover>
  );
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
      <div className="rounded-lg border border-border/50 hover:border-border bg-card/50 overflow-hidden transition-colors">
        {children(listeners)}
      </div>
    </div>
  );
}

/* ── Sortable Item wrapper ── */
function SortableItemRow({
  item,
  sectionId,
  sectionTitle,
  budgetId,
  isItemSaving,
  searchMatch,
  compact,
  onUpdate,
  onDelete,
  onImagesChange,
  onPromoteToCatalog,
}: {
  item: ItemData;
  sectionId: string;
  sectionTitle: string;
  budgetId: string;
  isItemSaving: boolean;
  searchMatch?: boolean;
  compact: boolean;
  onUpdate: (sectionId: string, itemId: string, field: string, value: any) => void;
  onDelete: (sectionId: string, itemId: string) => void;
  onImagesChange: (sectionId: string, itemId: string, images: ItemData["images"]) => void;
  onPromoteToCatalog: (sectionId: string, item: ItemData, sectionTitle: string) => void;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [rowExpanded, setRowExpanded] = useState(false);
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

  const hasDescription = !!(item.description && item.description.trim());
  const hasImages = (item.images?.length || 0) > 0;
  const imageCount = item.images?.length || 0;
  const showExpanded = !compact || rowExpanded;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "px-4 transition-colors border-b border-border/40 last:border-b-0 group/item",
        "even:bg-muted/20",
        compact && !rowExpanded ? "py-1.5" : "py-3",
        searchMatch && "ring-1 ring-yellow-400/50 bg-yellow-50/30 dark:bg-yellow-900/10",
        isDragging && "bg-muted/40 shadow-lg rounded-lg"
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Drag handle + Title + description */}
        <div className="lg:col-span-3 space-y-1">
          <div className="flex items-center gap-1.5">
            {compact && (
              <button
                onClick={() => setRowExpanded(!rowExpanded)}
                className="p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
                title={rowExpanded ? "Recolher" : "Expandir"}
              >
                <ChevronRight className={cn("h-3 w-3 transition-transform", rowExpanded && "rotate-90")} />
              </button>
            )}
            <button
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 touch-none opacity-0 group-hover/item:opacity-100"
              title="Arrastar para reordenar"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            {item.catalog_item_id ? (
              <span className="flex-shrink-0" title="Item do catálogo">
                <BookOpen className="h-3.5 w-3.5 text-primary/60" />
              </span>
            ) : (
              <span className="flex-shrink-0" title="Item manual">
                <PenLine className="h-3 w-3 text-muted-foreground/40" />
              </span>
            )}
            {compact && !rowExpanded ? (
              <span
                className="text-sm font-body font-medium text-foreground truncate max-w-[280px] cursor-default"
                title={item.title}
              >
                {item.title}
              </span>
            ) : (
              <input
                type="text"
                value={item.title}
                onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
                placeholder="Nome do item"
                className="w-full px-2 py-1 rounded-md border border-input bg-background hover:border-primary/40 focus:border-primary text-sm font-body font-medium text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-text"
              />
            )}
            {/* Compact indicators */}
            {compact && !rowExpanded && (
              <div className="flex items-center gap-1 shrink-0">
                {hasDescription && (
                  <span title="Tem descrição"><FileText className="h-2.5 w-2.5 text-muted-foreground/40" /></span>
                )}
                {hasImages && (
                  <span className="flex items-center gap-0.5" title={`${imageCount} imagem(ns)`}>
                    <Paperclip className="h-2.5 w-2.5 text-muted-foreground/40" />
                    <span className="text-[9px] text-muted-foreground/50 tabular-nums">{imageCount}</span>
                  </span>
                )}
              </div>
            )}
          </div>
          {showExpanded && (
            <>
              <input
                type="text"
                value={item.description || ""}
                onChange={(e) => onUpdate(sectionId, item.id, "description", e.target.value)}
                placeholder="Descrição"
                className="w-full px-2 py-1 rounded-md border border-input bg-background hover:border-primary/40 focus:border-primary text-xs font-body text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 ml-6 transition-all cursor-text"
              />
              <div className="flex items-center gap-1 ml-6">
                <LinkIcon className="h-2.5 w-2.5 text-muted-foreground/40 shrink-0" />
                <input
                  type="url"
                  value={item.reference_url || ""}
                  onChange={(e) => onUpdate(sectionId, item.id, "reference_url", e.target.value || null)}
                  placeholder="Link de referência"
                  className="w-full px-2 py-1 rounded-md border border-input bg-background hover:border-primary/40 focus:border-primary text-xs font-body text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all cursor-text"
                />
              </div>
            </>
          )}
        </div>
        {/* Qty — editable */}
        <div className="lg:col-span-1 space-y-0.5">
          {showExpanded && <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">Qtd</label>}
          <input
            type="number"
            value={item.qty ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
            placeholder="1"
            className="w-full px-2 py-1.5 rounded-md border border-input bg-background hover:border-primary/40 focus:border-primary text-sm font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all tabular-nums cursor-text"
          />
        </div>
        {/* $ Custo (unit) — editable */}
        <div className="lg:col-span-1 space-y-0.5">
          {showExpanded && <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">Custo</label>}
          <input
            type="number"
            value={item.internal_unit_price ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
            placeholder="0.00"
            step="0.01"
            className="w-full px-2 py-1.5 rounded-md border border-input bg-background hover:border-primary/40 focus:border-primary text-sm font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/20 transition-all tabular-nums cursor-text"
          />
        </div>
        {/* %BDI — editable with validation */}
        <div className="lg:col-span-1 space-y-0.5">
          {showExpanded && <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">BDI %</label>}
          <BdiInput
            value={item.bdi_percentage}
            onChange={(v) => onUpdate(sectionId, item.id, "bdi_percentage", v)}
          />
        </div>
        {/* $ Venda (calculated) */}
        <div className="lg:col-span-1 space-y-0.5">
          {showExpanded && <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">Venda</label>}
          <div
            className="group/cell w-full px-2 py-1.5 rounded-md bg-muted/40 text-sm font-body tabular-nums text-muted-foreground cursor-default flex items-center justify-between"
            title="Campo calculado automaticamente"
          >
            <span>{formatBRL(calcSaleUnitPrice(item.internal_unit_price, item.bdi_percentage))}</span>
            <Lock className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        </div>
        {/* $ Total Custo (calculated) — hidden in compact */}
        {showExpanded && (
          <div className="lg:col-span-2 space-y-0.5">
            <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">Total Custo</label>
            <div
              className="group/cell w-full px-2 py-1.5 rounded-md bg-muted/40 text-sm font-body tabular-nums text-muted-foreground cursor-default flex items-center justify-between"
              title="Campo calculado automaticamente"
            >
              <span>{formatBRL(calcItemCostTotal(item))}</span>
              <Lock className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
            </div>
          </div>
        )}
        {/* $ Total Venda (calculated) */}
        <div className={cn("space-y-0.5", showExpanded ? "lg:col-span-2" : "lg:col-span-4")}>
          {showExpanded && <label className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wider">Total Venda</label>}
          <div
            className="group/cell w-full px-2 py-1.5 rounded-md bg-primary/5 text-sm font-body font-semibold tabular-nums text-foreground cursor-default flex items-center justify-between"
            title="Campo calculado automaticamente"
          >
            <span>{formatBRL(calcItemSaleTotal(item))}</span>
            <Lock className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover/cell:opacity-100 transition-opacity" />
          </div>
        </div>
        {/* Actions */}
        <div className="lg:col-span-1 flex items-end justify-end gap-1">
          {isItemSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          <button
            onClick={() => setDetailOpen(true)}
            className="p-2 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
            title="Editar detalhes"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {!item.catalog_item_id && !compact && (
            <button
              onClick={() => onPromoteToCatalog(sectionId, item, sectionTitle)}
              className="p-2 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
              title="Salvar no catálogo"
            >
              <BookmarkPlus className="h-3.5 w-3.5" />
            </button>
          )}
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

      {/* Item image management — only in expanded */}
      {showExpanded && (
        <ItemImageInline
          itemId={item.id}
          itemTitle={item.title}
          budgetId={budgetId}
          images={item.images || []}
          onImagesChange={(imgs) => onImagesChange(sectionId, item.id, imgs)}
        />
      )}

      {/* Item detail sheet */}
      <ItemDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        item={item}
        sectionId={sectionId}
        budgetId={budgetId}
        onUpdate={onUpdate}
        onImagesChange={onImagesChange}
      />
    </div>
  );
}

export function SectionsEditor({ budgetId, sections, onSectionsChange }: SectionsEditorProps) {
  const storageKey = `budget-sections-state-${budgetId}`;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set();
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const densityKey = `budget-item-density-${budgetId}`;
  const [compactMode, setCompactMode] = useState(() => {
    try { return localStorage.getItem(densityKey) !== "expanded"; } catch { return true; }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, NodeJS.Timeout>>({});

  // Persist expanded state
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...expandedSections])); } catch { /* ignore */ }
  }, [expandedSections, storageKey]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(sections.map(s => s.id)));
  const collapseAll = () => setExpandedSections(new Set());

  // Search filtering
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const sectionMatchMap = useMemo(() => {
    if (!normalizedQuery) return null;
    const map = new Map<string, Set<string>>();
    for (const s of sections) {
      const matchingItemIds = new Set<string>();
      const sectionTitleMatch = s.title.toLowerCase().includes(normalizedQuery);
      for (const item of s.items) {
        if (
          item.title.toLowerCase().includes(normalizedQuery) ||
          (item.description && item.description.toLowerCase().includes(normalizedQuery))
        ) {
          matchingItemIds.add(item.id);
        }
      }
      if (sectionTitleMatch || matchingItemIds.size > 0) {
        map.set(s.id, matchingItemIds);
      }
    }
    return map;
  }, [normalizedQuery, sections]);

  // Auto-expand matching sections on search
  useEffect(() => {
    if (sectionMatchMap && sectionMatchMap.size > 0) {
      setExpandedSections(new Set(sectionMatchMap.keys()));
    }
  }, [sectionMatchMap]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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

  /**
   * Recalculate the "Impostos e despesas administrativas" item at TAX_RATE of budget total
   * (excluding the tax item itself). Mutates the sections array in-place and persists.
   */
  const recalcTaxItem = useCallback((currentSections: SectionData[]): SectionData[] => {
    // Find the tax item across all sections
    let taxSectionId: string | null = null;
    let taxItemId: string | null = null;

    for (const s of currentSections) {
      for (const i of s.items) {
        if (i.title === TAX_ITEM_TITLE) {
          taxSectionId = s.id;
          taxItemId = i.id;
          break;
        }
      }
      if (taxItemId) break;
    }

    if (!taxItemId || !taxSectionId) return currentSections;

    // Calculate total excluding the tax item (use sale total if available, otherwise cost total)
    let totalExcludingTax = 0;
    for (const s of currentSections) {
      for (const i of s.items) {
        if (i.id === taxItemId) continue;
        const saleTotal = calcItemSaleTotal(i);
        totalExcludingTax += saleTotal > 0 ? saleTotal : calcItemCostTotal(i);
      }
    }

    const taxValue = Math.round(totalExcludingTax * TAX_RATE * 100) / 100;

    const updated = currentSections.map(s => {
      if (s.id !== taxSectionId) return s;
      const newItems = s.items.map(i => {
        if (i.id !== taxItemId) return i;
        return { ...i, internal_total: taxValue, internal_unit_price: taxValue, qty: 1, bdi_percentage: 0 };
      });
      const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
      return { ...s, items: newItems, section_price: newSaleTotal };
    });

    // Persist tax item and its section
    debouncedSave("items", taxItemId, { internal_total: taxValue, internal_unit_price: taxValue, qty: 1, bdi_percentage: 0 });
    const taxSection = updated.find(s => s.id === taxSectionId);
    if (taxSection) {
      debouncedSave("sections", taxSectionId, { section_price: taxSection.section_price });
    }

    return updated;
  }, [debouncedSave]);

  const updateItem = (sectionId: string, itemId: string, field: string, value: any) => {
    let updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = s.items.map(i =>
        i.id === itemId ? { ...i, [field]: value } : i
      );
      // Recalculate section_price as sale total whenever price-related fields change
      const priceFields = ["internal_total", "internal_unit_price", "bdi_percentage", "qty"];
      if (priceFields.includes(field)) {
        const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
        debouncedSave("sections", sectionId, { section_price: newSaleTotal });
        return { ...s, items: newItems, section_price: newSaleTotal };
      }
      return { ...s, items: newItems };
    });

    // Recalculate tax item if a price field changed (and the edited item is NOT the tax item itself)
    const priceFields = ["internal_total", "internal_unit_price", "bdi_percentage", "qty"];
    const editedItem = sections.flatMap(s => s.items).find(i => i.id === itemId);
    if (priceFields.includes(field) && editedItem?.title !== TAX_ITEM_TITLE) {
      updated = recalcTaxItem(updated);
    }

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

  const addItem = async (sectionId: string, itemData?: {
    title: string;
    description: string | null;
    unit: string | null;
    qty: number | null;
    internal_unit_price: number | null;
    internal_total: number | null;
    catalog_item_id: string | null;
    catalog_snapshot: Record<string, any> | null;
  }) => {
    const section = sections.find(s => s.id === sectionId);
    const order = section?.items.length || 0;

    const insertPayload = {
      section_id: sectionId,
      title: itemData?.title || "Novo Item",
      description: itemData?.description || null,
      unit: itemData?.unit || null,
      qty: itemData?.qty || null,
      internal_unit_price: itemData?.internal_unit_price || null,
      internal_total: itemData?.internal_total || null,
      order_index: order,
      catalog_item_id: itemData?.catalog_item_id || null,
      catalog_snapshot: (itemData?.catalog_snapshot || null) as any,
    };

    const { data } = await supabase
      .from("items")
      .insert(insertPayload)
      .select()
      .single();
    if (data) {
      // Auto-create item_images from catalog image_url
      const catalogImageUrl = itemData?.catalog_snapshot?.image_url;
      let itemImages: any[] = [];
      if (catalogImageUrl) {
        const { data: imgRow } = await supabase.from("item_images").insert({
          item_id: data.id,
          url: catalogImageUrl,
          is_primary: true,
        }).select().single();
        if (imgRow) itemImages = [imgRow];
      }

      let updated = sections.map(s => {
        if (s.id !== sectionId) return s;
        const newItem = { ...data, images: itemImages } as ItemData;
        const newItems = [...s.items, newItem];
        const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
        if (newSaleTotal > 0) {
          supabase.from("sections").update({ section_price: newSaleTotal }).eq("id", sectionId);
        }
        return { ...s, items: newItems, section_price: newSaleTotal > 0 ? newSaleTotal : s.section_price };
      });
      updated = recalcTaxItem(updated);
      onSectionsChange(updated);
      const origin = itemData?.catalog_item_id ? "Item do catálogo adicionado" : "Item manual adicionado";
      toast.success(origin);
    }
  };

  const deleteItem = async (sectionId: string, itemId: string) => {
    await supabase.from("items").delete().eq("id", itemId);
    let updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = s.items.filter(i => i.id !== itemId);
      const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
      supabase.from("sections").update({ section_price: newSaleTotal }).eq("id", sectionId);
      return { ...s, items: newItems, section_price: newSaleTotal };
    });
    updated = recalcTaxItem(updated);
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

  const promoteToCatalog = async (sectionId: string, item: ItemData, sectionTitle: string) => {
    if (!item.title.trim()) { toast.error("Item precisa ter um nome"); return; }
    try {
      // Create catalog item
      const { data: catalogItem, error } = await supabase.from("catalog_items").insert({
        name: item.title.trim(),
        description: item.description || null,
        unit_of_measure: item.unit || null,
        item_type: "product" as const,
        is_active: true,
      }).select("id").single();
      if (error || !catalogItem) { toast.error("Erro ao salvar no catálogo"); return; }

      // Link to current section
      const { setItemSections } = await import("@/lib/catalog-helpers");
      const sectionKey = SCOPE_CATEGORIES.find(c => c.label === sectionTitle)?.id;
      if (sectionKey) {
        await setItemSections(catalogItem.id, [sectionKey]);
      }

      // Copy primary image to catalog if exists
      const primaryImage = item.images?.find(img => img.is_primary) || item.images?.[0];
      if (primaryImage) {
        await supabase.from("catalog_items").update({ image_url: primaryImage.url }).eq("id", catalogItem.id);
      }

      // Update the budget item to link to catalog
      await supabase.from("items").update({
        catalog_item_id: catalogItem.id,
        catalog_snapshot: { item_type: "product", promoted_from_manual: true },
      }).eq("id", item.id);

      // Update local state
      const updated = sections.map(s => {
        if (s.id !== sectionId) return s;
        return {
          ...s,
          items: s.items.map(i => i.id === item.id
            ? { ...i, catalog_item_id: catalogItem.id, catalog_snapshot: { item_type: "product", promoted_from_manual: true } }
            : i
          ),
        };
      });
      onSectionsChange(updated);
      toast.success("Item salvo no catálogo para reuso futuro");
    } catch {
      toast.error("Erro ao promover item ao catálogo");
    }
  };

  const grandTotalCost = sections.reduce((sum, s) => sum + calcSectionCostTotal(s), 0);
  const grandTotalSale = sections.reduce((sum, s) => sum + calcSectionSaleTotal(s), 0);
  const grandMargin = grandTotalSale - grandTotalCost;
  const grandBdiPercent = grandTotalCost > 0 ? ((grandTotalSale / grandTotalCost) - 1) * 100 : 0;

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

  // Highlight helper for search
  const highlightText = (text: string) => {
    if (!normalizedQuery || !text) return text;
    const idx = text.toLowerCase().indexOf(normalizedQuery);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-800/60 rounded-sm px-0.5">{text.slice(idx, idx + normalizedQuery.length)}</mark>
        {text.slice(idx + normalizedQuery.length)}
      </>
    );
  };

  return (
    <div className="mt-10">
      {/* ── Financial summary strip ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Seções e Itens</h2>
        </div>
        <button
          onClick={addSection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-body font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Seção
        </button>
      </div>

      {/* ── Control bar: search + expand/collapse ── */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
              placeholder="Buscar item..."
              className="w-full pl-8 pr-7 py-1.5 rounded-md border border-input bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/20 focus:border-primary transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={expandAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronsUpDown className="h-3.5 w-3.5" /> Expandir
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronsDownUp className="h-3.5 w-3.5" /> Colapsar
            </button>
            <div className="w-px h-4 bg-border mx-1" />
            <button
              onClick={() => {
                const next = !compactMode;
                setCompactMode(next);
                try { localStorage.setItem(densityKey, next ? "compact" : "expanded"); } catch { /* ignore */ }
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-body transition-colors",
                compactMode
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={compactMode ? "Modo expandido" : "Modo compacto"}
            >
              {compactMode ? <Rows3 className="h-3.5 w-3.5" /> : <Rows4 className="h-3.5 w-3.5" />}
              {compactMode ? "Compacto" : "Expandido"}
            </button>
          </div>
        </div>
      )}

      {sections.length === 0 && (
        <EmptyState
          icon={FileSpreadsheet}
          title="Orçamento em branco"
          subtitle="Comece criando a primeira seção do seu orçamento"
          actions={[
            { label: "+ Criar Primeira Seção", onClick: addSection, icon: Plus },
            { label: "Ver templates disponíveis", onClick: () => {}, variant: "outline", disabled: true, tooltip: "Em breve" },
          ]}
        />
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
              const sectionCostTotal = calcSectionCostTotal(section);
              const sectionSaleTotal = calcSectionSaleTotal(section);
              const isSaving = savingIds.has(section.id);
              const sectionPercent = grandTotalSale > 0 ? (sectionSaleTotal / grandTotalSale) * 100 : 0;
              const isSearchActive = !!sectionMatchMap;
              const sectionHasMatch = !isSearchActive || sectionMatchMap?.has(section.id);
              const matchingItemIds = sectionMatchMap?.get(section.id);

              return (
                <SortableSectionCard key={section.id} section={section}>
                  {(dragListeners: any) => (
                    <div className={cn(isSearchActive && !sectionHasMatch && "opacity-40")}>
                      {/* Section header */}
                      <div className="px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <button
                            {...dragListeners}
                            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0 touch-none"
                            title="Arrastar"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </button>
                          <div
                            className="flex items-center gap-2 flex-1 min-w-0"
                            onClick={() => toggleSection(section.id)}
                          >
                            <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0 transition-transform", isExpanded && "rotate-90")} />
                            <span className="font-body font-bold text-sm text-foreground truncate">
                              {isSearchActive ? highlightText(section.title || "Sem título") : (section.title || "Sem título")}
                            </span>
                            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />}
                            {section.is_optional && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                Opcional
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground font-body ml-1 shrink-0">
                              {section.items.length} {section.items.length === 1 ? "item" : "itens"}
                            </span>
                            <div className="ml-auto flex items-center gap-3 text-xs font-body tabular-nums shrink-0">
                              <span className="text-muted-foreground/60">
                                {sectionPercent.toFixed(0)}%
                              </span>
                              <span className="font-semibold text-foreground">
                                {formatBRL(sectionSaleTotal)}
                              </span>
                            </div>
                          </div>
                          {/* Section context menu */}
                          <SectionContextMenu
                            section={section}
                            onRename={(name) => updateSection(section.id, "title", name)}
                            onDelete={() => deleteSection(section.id)}
                          />
                        </div>
                        {/* Mini progress bar */}
                        <div className="ml-9 mt-1.5 h-1 rounded-full bg-muted/50 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/40 transition-all duration-300"
                            style={{ width: `${Math.min(sectionPercent, 100)}%` }}
                          />
                        </div>
                      </div>

                      {/* Expanded content — items directly */}
                      {isExpanded && (
                        <div className="border-t border-border/40">

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
                                {section.items.length === 0 ? (
                                  <button
                                    onClick={() => addItem(section.id)}
                                    className="w-full py-6 border-2 border-dashed border-border/40 rounded-md text-sm font-body text-muted-foreground/50 hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto my-2"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Adicionar primeiro item
                                  </button>
                                ) : (
                                  section.items.map((item) => (
                                    <SortableItemRow
                                      key={item.id}
                                      item={item}
                                      sectionId={section.id}
                                      sectionTitle={section.title}
                                      budgetId={budgetId}
                                      isItemSaving={savingIds.has(item.id)}
                                      searchMatch={matchingItemIds?.has(item.id)}
                                      compact={compactMode}
                                      onUpdate={updateItem}
                                      onDelete={deleteItem}
                                      onImagesChange={handleImagesChange}
                                      onPromoteToCatalog={promoteToCatalog}
                                    />
                                  ))
                                )}
                              </div>
                            </SortableContext>
                          </DndContext>

                          {/* Add item */}
                          <div className="px-4 py-2 border-t border-border/30">
                            <AddItemPopover
                              sectionTitle={section.title}
                              onAddItem={(itemData) => addItem(section.id, itemData)}
                            />
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
    </div>
  );
}
