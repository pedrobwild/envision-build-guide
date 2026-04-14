import { useState } from "react";
import type { Json } from "@/integrations/supabase/types";
import { formatBRL } from "@/lib/formatBRL";
import { calcItemSaleTotal } from "@/lib/budget-calc";
import {
  ChevronRight, Trash2, GripVertical, Package,
  Loader2, AlertTriangle, Pencil, BookmarkPlus,
  Link as LinkIcon, Building2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import { ItemImageInline } from "./ItemImageInline";
import { ItemDetailSheet } from "./ItemDetailSheet";
import { MobileItemEditor } from "./MobileItemEditor";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ItemData {
  id: string;
  title: string;
  description?: string | null;
  reference_url?: string | null;
  qty?: number | null;
  unit?: string | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
  order_index?: number;
  catalog_item_id?: string | null;
  catalog_snapshot?: Record<string, unknown> | Json | null;
  notes?: string | null;
  images?: { id?: string; url: string; is_primary?: boolean | null }[];
}

/* ── BDI margin helper (local) ── */
function calcMargin(cost: number | null | undefined, bdi: number | null | undefined): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (b / 100);
}

/* ── Sortable Item wrapper ── */
export function SortableItemRow({
  item,
  sectionId,
  sectionTitle,
  budgetId,
  isItemSaving,
  searchMatch,
  compact,
  suppliers,
  onUpdate,
  onDelete,
  onImagesChange,
  onPromoteToCatalog,
  disableImages,
  disableCatalog,
}: {
  item: ItemData;
  sectionId: string;
  sectionTitle: string;
  budgetId: string;
  isItemSaving: boolean;
  searchMatch?: boolean;
  compact: boolean;
  suppliers: { id: string; name: string; categoria: string | null }[];
  onUpdate: (sectionId: string, itemId: string, field: string, value: string | number | boolean | Record<string, unknown> | null) => void;
  onDelete: (sectionId: string, itemId: string) => void;
  onImagesChange: (sectionId: string, itemId: string, images: ItemData["images"]) => void;
  onPromoteToCatalog: (sectionId: string, item: ItemData, sectionTitle: string) => void;
  disableImages?: boolean;
  disableCatalog?: boolean;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [rowExpanded, setRowExpanded] = useState(false);
  const [mobileEditorOpen, setMobileEditorOpen] = useState(false);
  const isMobile = useIsMobile();
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

  const isOptional = !!(item as ItemData & { is_optional?: boolean }).is_optional;
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
        searchMatch && "bg-primary/5 hover:bg-primary/8",
        isDragging && "bg-muted/40 shadow-lg rounded border-b-0"
      )}
    >
      {/* ── Compact inline row ── */}
      <div className={cn(
        "flex items-center gap-0",
        compact && !rowExpanded ? "h-11" : "py-2",
      )}>
        {/* [⋮⋮] drag handle */}
        <button
          {...listeners}
          className="hidden sm:flex w-4 flex-shrink-0 items-center justify-center cursor-grab active:cursor-grabbing rounded text-muted-foreground/0 group-hover/item:text-muted-foreground/40 hover:!text-muted-foreground transition-colors touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3 w-3" />
        </button>

        {/* [▶ expand] — 20px mobile, 24px desktop */}
        <div className="w-5 sm:w-6 flex-shrink-0 flex items-center justify-center">
          <button
            onClick={() => {
              if (isMobile && compact && !rowExpanded) {
                setMobileEditorOpen(true);
              } else {
                setRowExpanded(!rowExpanded);
              }
            }}
            className="p-0.5 rounded text-muted-foreground/30 hover:text-muted-foreground transition-colors"
          >
            <ChevronRight className={cn(
              "h-3 sm:h-3.5 w-3 sm:w-3.5 transition-transform duration-200",
              rowExpanded && "rotate-90"
            )} />
          </button>
        </div>

        {/* [Título] — flex-1 */}
        <div className="flex-1 min-w-0 flex items-center gap-1 px-0.5 sm:px-1">
          {compact && !rowExpanded ? (
            <>
              <span
                className={cn("text-xs sm:text-sm font-body text-foreground truncate", isMobile ? "cursor-pointer active:text-primary" : "cursor-default")}
                title={item.title}
                onClick={(e) => {
                  if (isMobile) { e.stopPropagation(); setMobileEditorOpen(true); }
                }}
              >
                {item.title}
              </span>
              {hasDescription && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRowExpanded(true); }}
                  className="ml-0.5 text-[10px] text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                  title="Tem descrição — clique para expandir"
                >📝</button>
              )}
              {hasImages && (
                <button
                  onClick={(e) => { e.stopPropagation(); setRowExpanded(true); }}
                  className="ml-0.5 text-[10px] text-muted-foreground hover:text-foreground flex-shrink-0 transition-colors"
                  title={`${imageCount} imagem(ns) — clique para expandir`}
                >📷 {imageCount > 1 ? imageCount : ""}</button>
              )}
              {isOptional && (
                <span className="ml-0.5 text-[9px] font-body bg-muted text-muted-foreground rounded px-1 flex-shrink-0">OPT</span>
              )}
              {hasBdiWarning && (
                <AlertTriangle className="ml-0.5 h-3 w-3 text-warning inline flex-shrink-0" />
              )}
            </>
          ) : (
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
              placeholder="Nome do item"
              className="w-full h-8 sm:h-9 px-1.5 sm:px-2 rounded border border-transparent bg-transparent text-xs sm:text-sm font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100"
            />
          )}
        </div>

        {/* [QTD] — 36px mobile, 64px desktop */}
        <div className="w-9 sm:w-16 flex-shrink-0 px-0.5 sm:px-1">
          <input
            type="number"
            value={item.qty ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
            placeholder="1"
            className="w-full h-7 sm:h-8 rounded border border-transparent bg-transparent text-[11px] sm:text-sm font-mono text-center placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100 tabular-nums"
          />
        </div>

        {/* [Custo] — 56px mobile, 100px desktop */}
        <div className="w-14 sm:w-[100px] flex-shrink-0 px-0.5 sm:px-1">
          <input
            type="number"
            value={item.internal_unit_price ?? ""}
            onChange={(e) => onUpdate(sectionId, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
            placeholder="0.00"
            step="0.01"
            className="w-full h-7 sm:h-8 rounded border border-transparent bg-transparent text-[11px] sm:text-sm font-mono text-right placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary transition-colors duration-100 tabular-nums"
          />
        </div>

        {/* [BDI%] — hidden mobile */}
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

        {/* [Margem] — hidden mobile */}
        <div className="hidden md:block w-[100px] flex-shrink-0 px-1">
          <div className="h-8 flex items-center justify-end px-2 text-sm font-mono tabular-nums text-muted-foreground bg-muted/30 rounded">
            {formatBRL(calcMargin(item.internal_unit_price, item.bdi_percentage))}
          </div>
        </div>

        {/* [BDI badge] — mobile only, opens editor */}
        <div className="md:hidden flex-shrink-0 flex items-center">
          <button
            onClick={(e) => { e.stopPropagation(); setMobileEditorOpen(true); }}
            className={cn(
              "inline-flex items-center h-6 px-1.5 rounded-md text-[10px] font-mono tabular-nums font-bold transition-all active:scale-95 shrink-0 border",
              (Number(item.bdi_percentage) || 0) > 0
                ? (Number(item.bdi_percentage) || 0) >= 30
                  ? "bg-success/10 text-success border-success/20"
                  : (Number(item.bdi_percentage) || 0) >= 15
                  ? "bg-warning/10 text-warning border-warning/20"
                  : "bg-destructive/10 text-destructive border-destructive/20"
                : "bg-muted/50 text-muted-foreground/50 border-dashed border-border/40"
            )}
          >
            {(Number(item.bdi_percentage) || 0) > 0 ? `${Number(item.bdi_percentage)}%` : "BDI"}
          </button>
        </div>

        {/* [Total Venda] — 72px mobile, 100px desktop */}
        <div className="w-[72px] sm:w-[100px] flex-shrink-0 px-0.5 sm:px-1">
          <div className="h-7 sm:h-8 flex items-center justify-end px-1 sm:px-2 text-[11px] sm:text-sm font-semibold font-mono tabular-nums text-foreground">
            {formatBRL(calcItemSaleTotal(item))}
          </div>
        </div>

        {/* [⋮ ações] — 24px mobile, 32px desktop */}
        <div className="w-6 sm:w-8 flex-shrink-0 flex items-center justify-center">
          {isItemSaving ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
          ) : (
            <button
              onClick={() => {
                if (confirm("Excluir este item?")) onDelete(sectionId, item.id);
              }}
              className="p-0.5 sm:p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-opacity duration-100 sm:opacity-0 sm:group-hover/item:opacity-100"
              title="Excluir item"
            >
              <Trash2 className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Expanded detail area ── */}
      {rowExpanded && (
        <div className="pb-3 pl-6 sm:pl-8 pr-2 sm:pr-4 space-y-2.5 border-t border-border/20 pt-3 bg-muted/5">
          {/* Editable title when expanded */}
          <div className="space-y-0.5">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">Nome</label>
            <input
              type="text"
              value={item.title}
              onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
              placeholder="Nome do item"
              className="w-full max-w-xl h-8 px-2.5 rounded-md border border-border/40 bg-background text-sm font-body font-medium text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>

          {/* Description */}
          <div className="space-y-0.5">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">Descrição</label>
            <textarea
              value={item.description || ""}
              onChange={(e) => onUpdate(sectionId, item.id, "description", e.target.value)}
              placeholder="Descrição do item (opcional)"
              rows={2}
              className="w-full max-w-xl px-2.5 py-1.5 rounded-md border border-border/40 bg-background text-xs font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all resize-none leading-relaxed"
            />
          </div>

          {/* Reference link */}
          <div className="space-y-0.5">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">Referência</label>
            <div className="flex items-center gap-1.5 max-w-xl">
              <LinkIcon className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <input
                type="url"
                value={item.reference_url || ""}
                onChange={(e) => onUpdate(sectionId, item.id, "reference_url", e.target.value || null)}
                placeholder="https://exemplo.com/produto"
                className="w-full h-7 px-2.5 rounded-md border border-border/40 bg-background text-xs font-body text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
              />
            </div>
          </div>

          {/* Supplier selector */}
          {!disableCatalog && (
          <div className="space-y-0.5">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">Fornecedor</label>
            <div className="flex items-center gap-1.5 max-w-xl">
              <Building2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <select
                value={(item.catalog_snapshot as Record<string, unknown> | null)?.supplier_id as string || ""}
                onChange={(e) => {
                  const supplierId = e.target.value || null;
                  const supplier = suppliers.find(s => s.id === supplierId);
                  const prev = (typeof item.catalog_snapshot === 'object' && item.catalog_snapshot && !Array.isArray(item.catalog_snapshot)) ? item.catalog_snapshot : {};
                  const autoCategory = supplier?.categoria
                    ? (supplier.categoria === "Prestadores" ? "prestador" : "produto")
                    : prev.item_category;
                  const updatedSnapshot = {
                    ...prev,
                    supplier_id: supplierId,
                    supplier_name: supplier?.name || null,
                    item_category: autoCategory || null,
                  };
                  onUpdate(sectionId, item.id, "catalog_snapshot", updatedSnapshot);
                }}
                className="w-full h-7 px-2 rounded-md border border-border/40 bg-background text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all appearance-none cursor-pointer"
              >
                <option value="">Sem fornecedor</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          )}

          {/* Item category selector */}
          {!disableCatalog && (
          <div className="space-y-0.5">
            <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">Categoria</label>
            <div className="flex items-center gap-1.5 max-w-xl">
              <Package className="h-3 w-3 text-muted-foreground/40 shrink-0" />
              <select
                value={(item.catalog_snapshot as Record<string, unknown> | null)?.item_category as string || ""}
                onChange={(e) => {
                  const category = e.target.value || null;
                  const prev = (typeof item.catalog_snapshot === 'object' && item.catalog_snapshot && !Array.isArray(item.catalog_snapshot)) ? item.catalog_snapshot : {};
                  const updatedSnapshot = { ...prev, item_category: category };
                  onUpdate(sectionId, item.id, "catalog_snapshot", updatedSnapshot);
                }}
                className="w-full h-7 px-2 rounded-md border border-border/40 bg-background text-xs font-body text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all appearance-none cursor-pointer"
              >
                <option value="">Sem categoria</option>
                <option value="produto">Produto</option>
                <option value="prestador">Prestador</option>
              </select>
            </div>
          </div>
          )}

          <div className="flex items-center gap-3 md:hidden pt-0.5">
            <button
              onClick={() => setMobileEditorOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-card hover:bg-muted/50 transition-all active:scale-[0.98]"
            >
              <span className="text-[10px] font-mono tabular-nums font-bold text-primary">BDI {Number(item.bdi_percentage) || 0}%</span>
              <span className="text-[10px] text-muted-foreground font-body">
                Margem: <span className="font-mono tabular-nums font-semibold">{formatBRL(calcMargin(item.internal_unit_price, item.bdi_percentage))}</span>
              </span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 pt-1 flex-wrap">
            {!disableImages && (
            <button
              onClick={() => setDetailOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-body font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border/40 transition-all"
            >
              <Pencil className="h-3 w-3" /> Editar detalhes
            </button>
            )}
            {!disableCatalog && !item.catalog_item_id && (
              <button
                onClick={() => onPromoteToCatalog(sectionId, item, sectionTitle)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-body font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all"
              >
                <BookmarkPlus className="h-3 w-3" /> Salvar no catálogo
              </button>
            )}
          </div>

          {/* Item images */}
          {!disableImages && (
          <ItemImageInline
            itemId={item.id}
            itemTitle={item.title}
            budgetId={budgetId}
            images={item.images || []}
            onImagesChange={(imgs) => onImagesChange(sectionId, item.id, imgs)}
          />
          )}
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

      {/* Mobile item editor */}
      <MobileItemEditor
        open={mobileEditorOpen}
        onOpenChange={setMobileEditorOpen}
        item={item}
        sectionId={sectionId}
        onUpdate={onUpdate}
      />
    </div>
  );
}
