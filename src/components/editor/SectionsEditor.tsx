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
  AlertTriangle, Paperclip, Rows3, Rows4, MoreVertical,
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

/* ── BDI input (simple, no per-item warnings) ── */
function BdiInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input
      type="number"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      placeholder="0"
      step="0.01"
      className="w-full h-9 px-3 rounded border border-transparent bg-transparent text-sm font-mono text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border hover:border-border transition-colors duration-100 tabular-nums text-right"
    />
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
              "relative group w-10 h-10 rounded overflow-hidden border transition-colors flex-shrink-0 cursor-pointer",
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
            className="w-10 h-10 rounded border border-dashed border-border hover:border-muted-foreground/40 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0"
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

/* ── Global BDI calculation ── */
function calcGlobalBdi(sections: SectionData[]): { avgBdi: number; hasData: boolean } {
  let totalCost = 0;
  let totalSale = 0;
  for (const s of sections) {
    for (const item of s.items) {
      const cost = calcItemCostTotal(item);
      const sale = calcItemSaleTotal(item);
      if (cost > 0) {
        totalCost += cost;
        totalSale += sale;
      }
    }
  }
  if (totalCost === 0) return { avgBdi: 0, hasData: false };
  const avgBdi = ((totalSale - totalCost) / totalCost) * 100;
  return { avgBdi, hasData: true };
}

interface SectionsEditorProps {
  budgetId: string;
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
}

/* ── Section context menu (rename + duplicate + delete) ── */
function SectionContextMenu({
  section,
  onRename,
  onDuplicate,
  onDelete,
}: {
  section: SectionData;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(section.title);

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(section.title); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
          title="Configurações da seção"
        >
          <MoreVertical className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2.5 space-y-1" align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="space-y-1 pb-1.5 border-b border-border/40">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nome da seção</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); onRename(e.target.value); }}
            className="w-full h-8 px-2 rounded border border-input bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        <button
          onClick={() => { onDuplicate(); setOpen(false); }}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted transition-colors"
        >
          <Package className="h-3 w-3" /> Duplicar seção
        </button>
        <button
          onClick={() => {
            if (confirm("Excluir esta seção e todos os seus itens?")) {
              onDelete();
              setOpen(false);
            }
          }}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-destructive hover:bg-destructive/10 transition-colors"
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
      <div className="rounded-md border border-border/60 bg-card overflow-hidden transition-colors">
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

  const isOptional = !!(item as any).is_optional;
  const hasBdiWarning = (Number(item.bdi_percentage) || 0) > 150;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={cn(
        "group/item transition-colors duration-100 border-b border-border/40 last:border-b-0 hover:bg-muted/30",
        compact && !rowExpanded ? "h-11" : "",
        isOptional && "border-l-2 border-dashed border-muted-foreground/30",
        searchMatch && "bg-warning/5 hover:bg-warning/8",
        isDragging && "bg-muted/40 shadow-lg rounded border-b-0"
      )}
    >
      {/* ── Compact inline row ── */}
      <div className={cn(
        "flex items-center gap-0",
        compact && !rowExpanded ? "h-11" : "py-2",
      )}>
        {/* [▶ expand] — 24px */}
        <div className="w-6 flex-shrink-0 flex items-center justify-center">
          <button
            onClick={() => setRowExpanded(!rowExpanded)}
            className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            <ChevronRight className={cn(
              "h-3.5 w-3.5 transition-transform duration-200",
              rowExpanded && "rotate-90"
            )} />
          </button>
        </div>

        {/* [Título] — flex-1 */}
        <div className="flex-1 min-w-0 flex items-center gap-1 px-1">
          {compact && !rowExpanded ? (
            <>
              <span
                className="text-sm text-foreground truncate cursor-default"
                title={item.title}
              >
                {item.title}
              </span>
              {/* Compact indicators */}
              {hasDescription && (
                <span className="ml-1 text-[10px] text-muted-foreground flex-shrink-0" title="Tem descrição">📝</span>
              )}
              {isOptional && (
                <span className="ml-1 text-[10px] bg-muted text-muted-foreground rounded px-1 flex-shrink-0">OPT</span>
              )}
              {hasBdiWarning && (
                <AlertTriangle className="ml-1 h-3 w-3 text-orange-500 inline flex-shrink-0" />
              )}
            </>
          ) : (
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
              placeholder="Nome do item"
              className="w-full h-9 px-2 rounded border border-transparent bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100"
            />
          )}
        </div>

        {/* [QTD] — 48px mobile, 64px desktop */}
        <div className="w-12 md:w-16 flex-shrink-0 px-1">
          <input
            type="number"
            value={item.qty ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
            placeholder="1"
            className="w-full h-8 rounded border border-transparent bg-transparent text-sm font-mono text-center placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100 tabular-nums"
          />
        </div>

        {/* [Custo] — 80px mobile, 100px desktop */}
        <div className="w-20 md:w-[100px] flex-shrink-0 px-1">
          <input
            type="number"
            value={item.internal_unit_price ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
            placeholder="0.00"
            step="0.01"
            className="w-full h-8 rounded border border-transparent bg-transparent text-sm font-mono text-right placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100 tabular-nums"
          />
        </div>

        {/* [BDI%] — hidden mobile, 72px desktop */}
        <div className="hidden md:block w-[72px] flex-shrink-0 px-1">
          <input
            type="number"
            value={item.bdi_percentage ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "bdi_percentage", e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
            step="0.01"
            className="w-full h-8 rounded border border-transparent bg-transparent text-sm font-mono text-right placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100 tabular-nums"
          />
        </div>

        {/* [Venda] — hidden mobile, 100px desktop, readonly */}
        <div className="hidden md:block w-[100px] flex-shrink-0 px-1">
          <div className="h-8 flex items-center justify-end px-2 text-sm font-mono tabular-nums text-muted-foreground bg-muted/30 rounded">
            {formatBRL(calcSaleUnitPrice(item.internal_unit_price, item.bdi_percentage))}
          </div>
        </div>

        {/* [Total Venda] — 80px mobile, 100px desktop, primary */}
        <div className="w-20 md:w-[100px] flex-shrink-0 px-1">
          <div className="h-8 flex items-center justify-end px-2 text-xs md:text-sm font-semibold font-mono tabular-nums text-foreground">
            {formatBRL(calcItemSaleTotal(item))}
          </div>
        </div>

        {/* [⋮ ações] — 32px, hover-only */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center">
          {isItemSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground/40" />
          ) : (
            <button
              onClick={() => {
                if (confirm("Excluir este item?")) onDelete(sectionId, item.id);
              }}
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity duration-100 opacity-0 group-hover/item:opacity-100"
              title="Excluir item"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded detail area ── */}
      {rowExpanded && (
        <div className="pb-2 pl-8 pr-4 space-y-1.5 border-t border-border/20 pt-2">
          {/* Editable title when expanded */}
          <input
            type="text"
            value={item.title}
            onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
            placeholder="Nome do item"
            className="w-full max-w-xl h-8 px-2 rounded border border-transparent bg-transparent text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary hover:border-border transition-colors"
          />
          <input
            type="text"
            value={item.description || ""}
            onChange={(e) => onUpdate(sectionId, item.id, "description", e.target.value)}
            placeholder="Descrição do item"
            className="w-full max-w-xl h-7 px-2 rounded border border-transparent bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border hover:border-border transition-colors"
          />
          <div className="flex items-center gap-1.5 max-w-xl">
            <LinkIcon className="h-3 w-3 text-muted-foreground/30 shrink-0" />
            <input
              type="url"
              value={item.reference_url || ""}
              onChange={(e) => onUpdate(sectionId, item.id, "reference_url", e.target.value || null)}
              placeholder="Link de referência"
              className="w-full h-7 px-2 rounded border border-transparent bg-transparent text-xs text-muted-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-border hover:border-border transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setDetailOpen(true)}
              className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Pencil className="h-3 w-3" /> Editar detalhes
            </button>
            {!item.catalog_item_id && (
              <button
                onClick={() => onPromoteToCatalog(sectionId, item, sectionTitle)}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
              >
                <BookmarkPlus className="h-3 w-3" /> Salvar no catálogo
              </button>
            )}
          </div>
          {/* Item images */}
          <ItemImageInline
            itemId={item.id}
            itemTitle={item.title}
            budgetId={budgetId}
            images={item.images || []}
            onImagesChange={(imgs) => onImagesChange(sectionId, item.id, imgs)}
          />
        </div>
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

  const recalcTaxItem = useCallback((currentSections: SectionData[]): SectionData[] => {
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
      const priceFields = ["internal_total", "internal_unit_price", "bdi_percentage", "qty"];
      if (priceFields.includes(field)) {
        const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
        debouncedSave("sections", sectionId, { section_price: newSaleTotal });
        return { ...s, items: newItems, section_price: newSaleTotal };
      }
      return { ...s, items: newItems };
    });

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

  const duplicateSection = async (sectionId: string) => {
    const source = sections.find(s => s.id === sectionId);
    if (!source) return;
    const order = sections.length;
    const { data: newSec } = await supabase
      .from("sections")
      .insert({
        budget_id: budgetId,
        title: `${source.title} (cópia)`,
        order_index: order,
        is_optional: source.is_optional ?? false,
        subtitle: source.subtitle ?? null,
      })
      .select()
      .single();
    if (!newSec) return;
    // Duplicate items
    const newItems: any[] = [];
    for (const item of source.items) {
      const { data: newItem } = await supabase
        .from("items")
        .insert({
          section_id: newSec.id,
          title: item.title,
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          internal_unit_price: item.internal_unit_price,
          internal_total: item.internal_total,
          bdi_percentage: item.bdi_percentage,
          order_index: item.order_index,
          notes: item.notes,
        })
        .select()
        .single();
      if (newItem) newItems.push({ ...newItem, images: [] });
    }
    const newSection: SectionData = { ...newSec, items: newItems };
    onSectionsChange([...sections, newSection]);
    setExpandedSections(prev => new Set(prev).add(newSec.id));
    toast.success("Seção duplicada");
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
      const { data: catalogItem, error } = await supabase.from("catalog_items").insert({
        name: item.title.trim(),
        description: item.description || null,
        unit_of_measure: item.unit || null,
        item_type: "product" as const,
        is_active: true,
      }).select("id").single();
      if (error || !catalogItem) { toast.error("Erro ao salvar no catálogo"); return; }

      const { setItemSections } = await import("@/lib/catalog-helpers");
      const sectionKey = SCOPE_CATEGORIES.find(c => c.label === sectionTitle)?.id;
      if (sectionKey) {
        await setItemSections(catalogItem.id, [sectionKey]);
      }

      const primaryImage = item.images?.find(img => img.is_primary) || item.images?.[0];
      if (primaryImage) {
        await supabase.from("catalog_items").update({ image_url: primaryImage.url }).eq("id", catalogItem.id);
      }

      await supabase.from("items").update({
        catalog_item_id: catalogItem.id,
        catalog_snapshot: { item_type: "product", promoted_from_manual: true },
      }).eq("id", item.id);

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
  const handleSectionDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const reordered = arrayMove(sections, oldIndex, newIndex);

    const withNewOrder = reordered.map((s, i) => ({ ...s, order_index: i }));
    onSectionsChange(withNewOrder);
    await Promise.all(
      withNewOrder.map(s =>
        supabase.from("sections").update({ order_index: s.order_index }).eq("id", s.id)
      )
    );
    toast.success("Ordem das seções atualizada");
  };

  const handleItemDragEnd = (sectionId: string) => async (event: DragEndEvent) => {
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
      return { ...s, items: reordered };
    });
    onSectionsChange(updated);

    const targetSection = updated.find(s => s.id === sectionId);
    if (targetSection) {
      await Promise.all(
        targetSection.items.map(item =>
          supabase.from("items").update({ order_index: item.order_index }).eq("id", item.id)
        )
      );
    }
  };

  const highlightText = (text: string) => {
    if (!normalizedQuery || !text) return text;
    const idx = text.toLowerCase().indexOf(normalizedQuery);
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-warning/20 rounded-sm px-0.5">{text.slice(idx, idx + normalizedQuery.length)}</mark>
        {text.slice(idx + normalizedQuery.length)}
      </>
    );
  };

  const marginPercent = grandTotalSale > 0 ? (grandMargin / grandTotalSale) * 100 : 0;

  return (
    <div className="mt-8 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-display font-semibold text-foreground tracking-[-0.04em]">Seções e Itens</h2>
        <button
          onClick={addSection}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-body font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Seção
        </button>
      </div>

      {/* ── Control bar ── */}
      {sections.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
              placeholder="Buscar item..."
              className="w-full pl-7 pr-7 h-8 rounded border border-border bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-foreground/20 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-0.5 ml-auto">
            <button
              onClick={expandAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronsUpDown className="h-3 w-3" /> Expandir
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs font-body text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ChevronsDownUp className="h-3 w-3" /> Colapsar
            </button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <button
              onClick={() => {
                const next = !compactMode;
                setCompactMode(next);
                try { localStorage.setItem(densityKey, next ? "compact" : "expanded"); } catch { /* ignore */ }
              }}
              className={cn(
                "flex items-center gap-1 px-2 py-1.5 rounded text-xs font-body transition-colors",
                compactMode
                  ? "text-foreground bg-muted"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
              title={compactMode ? "Modo expandido" : "Modo compacto"}
            >
              {compactMode ? <Rows3 className="h-3 w-3" /> : <Rows4 className="h-3 w-3" />}
              {compactMode ? "Compacto" : "Expandido"}
            </button>
          </div>
        </div>
      )}

      {/* ── Global BDI warning ── */}
      {(() => {
        const { avgBdi, hasData } = calcGlobalBdi(sections);
        if (!hasData || avgBdi >= 20) return null;
        return (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded border border-warning/20 bg-warning/5 text-xs font-body text-warning">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span>BDI médio geral está em <strong className="font-mono">{avgBdi.toFixed(1)}%</strong> — abaixo de 20%.</span>
          </div>
        );
      })()}

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
          <div className="space-y-2">
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
                    <div className={cn("group/section", isSearchActive && !sectionHasMatch && "opacity-40")}>
                      {/* Section header — 48px fixed, Linear pattern */}
                      <div
                        className={cn(
                          "h-12 px-3 flex items-center cursor-pointer transition-colors duration-100",
                          isExpanded ? "bg-muted/20 hover:bg-muted/30" : "hover:bg-muted/30"
                        )}
                        onClick={() => toggleSection(section.id)}
                      >
                        {/* [⋮⋮] drag — 8px zone, hover-only */}
                        <button
                          {...dragListeners}
                          className="w-5 flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing rounded text-muted-foreground/0 group-hover/section:text-muted-foreground/40 hover:!text-muted-foreground transition-colors touch-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>

                        {/* [▶/▼] chevron — 24px zone */}
                        <div className="w-6 flex-shrink-0 flex items-center justify-center">
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out",
                            isExpanded && "rotate-90"
                          )} />
                        </div>

                        {/* [Nome da Seção] — auto, truncate */}
                        <span className="text-sm font-semibold text-foreground truncate min-w-0">
                          {isSearchActive ? highlightText(section.title || "Sem título") : (section.title || "Sem título")}
                        </span>

                        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30 ml-1.5 flex-shrink-0" />}
                        {section.is_optional && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-medium rounded bg-muted text-muted-foreground flex-shrink-0">
                            OPT
                          </span>
                        )}

                        {/* [N itens] — text-xs muted */}
                        <span className="text-xs text-muted-foreground ml-2 shrink-0 tabular-nums">
                          {section.items.length} {section.items.length === 1 ? "item" : "itens"}
                        </span>

                        {/* Right zone: [% bar] [R$ total] */}
                        <div className="ml-auto flex items-center gap-2 shrink-0">
                          {/* [% barra] — mini progress bar */}
                          <div className="hidden sm:flex items-center gap-1.5">
                            <div className="h-1 rounded-full bg-primary/10 overflow-hidden" style={{ width: '80px' }}>
                              <div
                                className="h-full rounded-full bg-primary/30 transition-all duration-300"
                                style={{ width: `${Math.min(sectionPercent, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-muted-foreground tabular-nums w-7 text-right">
                              {sectionPercent.toFixed(0)}%
                            </span>
                          </div>

                          {/* [R$ total] — monospace semibold */}
                          <span className="text-sm font-mono font-semibold text-foreground tabular-nums tracking-[-0.035em]">
                            {formatBRL(sectionSaleTotal)}
                          </span>
                        </div>

                        {/* [⋮] menu — 24px zone, hover-only */}
                        <div className="w-6 flex-shrink-0 flex items-center justify-center opacity-0 group-hover/section:opacity-100 transition-opacity duration-100">
                          <SectionContextMenu
                            section={section}
                            onRename={(name) => updateSection(section.id, "title", name)}
                            onDuplicate={() => duplicateSection(section.id)}
                            onDelete={() => deleteSection(section.id)}
                          />
                        </div>
                      </div>

                      {/* Expanded content — animated */}
                      <div
                        className={cn(
                          "overflow-hidden transition-all duration-200 ease-out",
                          isExpanded ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0"
                        )}
                      >
                        <div>
                          {/* Column headers — sticky label-caps */}
                          {section.items.length > 0 && (
                            <div className="flex items-center border-b border-border/60 bg-muted/10 px-2 h-8">
                              <div className="w-6 flex-shrink-0" />
                              <div className="flex-1 px-1">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Descrição do Item</span>
                              </div>
                              <div className="w-12 md:w-16 flex-shrink-0 px-1 text-center">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Qtd</span>
                              </div>
                              <div className="w-20 md:w-[100px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Custo Unit.</span>
                              </div>
                              <div className="hidden md:block w-[72px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">BDI%</span>
                              </div>
                              <div className="hidden md:block w-[100px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Venda Unit.</span>
                              </div>
                              <div className="w-20 md:w-[100px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total Venda</span>
                              </div>
                              <div className="w-8 flex-shrink-0" />
                            </div>
                          )}

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
                                    className="w-full py-6 text-sm font-body text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
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
                          <div className="px-3 py-1.5 border-t border-border/30">
                            <AddItemPopover
                              sectionTitle={section.title}
                              onAddItem={(itemData) => addItem(section.id, itemData)}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SortableSectionCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* ── Sticky footer summary bar ── */}
      {sections.length > 0 && (
        <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 backdrop-blur-sm py-2 md:py-3 px-3 md:px-6">
          <div className="flex items-center justify-between gap-3 md:gap-8">
            <div className="flex items-center gap-3 md:gap-8 flex-wrap">
              {/* Custo */}
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-muted-foreground">Custo</span>
                <span className="text-xs md:text-sm font-semibold font-mono text-foreground tabular-nums">
                  {formatBRL(grandTotalCost)}
                </span>
              </div>
              {/* BDI — hidden on very small screens */}
              <div className="hidden sm:flex flex-col items-end gap-0.5">
                <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-muted-foreground">BDI</span>
                <span className="text-xs md:text-sm font-semibold font-mono text-foreground tabular-nums">
                  {grandBdiPercent.toFixed(1)}%
                </span>
              </div>
              {/* Venda — destaque */}
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-muted-foreground">Venda</span>
                <span className="text-sm md:text-base font-bold font-mono text-foreground tabular-nums">
                  {formatBRL(grandTotalSale)}
                </span>
              </div>
            </div>
            {/* Margem */}
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] md:text-[11px] uppercase tracking-wide text-muted-foreground">Margem</span>
              <span className={cn(
                "text-xs md:text-sm font-semibold font-mono tabular-nums",
                grandMargin >= 0 ? "text-foreground" : "text-destructive"
              )}>
                {formatBRL(grandMargin)}
                {" "}
                <span className="text-muted-foreground font-normal">· {marginPercent.toFixed(1)}%</span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
