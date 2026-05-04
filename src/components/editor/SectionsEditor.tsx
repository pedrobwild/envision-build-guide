import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { formatBRL } from "@/lib/formatBRL";
import { calcSaleUnitPrice, calcItemSaleTotal, calcItemCostTotal, calcSectionCostTotal, calcSectionSaleTotal, calcGrandTotals } from "@/lib/budget-calc";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { SCOPE_CATEGORIES } from "@/lib/scope-categories";
import { TAX_ITEM_TITLE, TAX_RATE } from "@/lib/default-budget-sections";
import {
  ChevronDown, ChevronRight, Plus, Trash2, GripVertical,
  Package, DollarSign, Hash, FileText, FileSpreadsheet, Loader2, ImagePlus, X, Star, ToggleRight, Pencil,
  PenLine, BookOpen, BookmarkPlus, Link as LinkIcon, Lock, Search, ChevronsUpDown, ChevronsDownUp,
  AlertTriangle, Paperclip, Rows3, Rows4, MoreVertical, Building2, BadgePercent, MinusCircle,
} from "lucide-react";
import { EmptyState } from "@/components/editor/EmptyState";
import { ItemImageLightbox } from "@/components/editor/ItemImageLightbox";
import { ItemDetailSheet } from "@/components/editor/ItemDetailSheet";
import { MobileItemEditor } from "@/components/editor/MobileItemEditor";
import { AddItemPopover } from "@/components/editor/AddItemPopover";
import { ItemImageInline } from "@/components/editor/ItemImageInline";
import { useIsMobile } from "@/hooks/use-mobile";
import { useConfirm } from "@/hooks/useConfirm";
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
  TouchSensor,
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

interface SectionData {
  id: string;
  title: string;
  subtitle?: string | null;
  order_index: number;
  qty?: number | null;
  section_price?: number | null;
  is_optional?: boolean;
  /** Addendum: marks section as added/removed by addendum (only used in addendum mode) */
  addendum_action?: "add" | "remove" | null;
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
  order_index?: number;
  catalog_item_id?: string | null;
  catalog_snapshot?: Record<string, unknown> | Json | null;
  notes?: string | null;
  /** Addendum: marks item as added/removed by addendum (only used in addendum mode) */
  addendum_action?: "add" | "remove" | null;
  images?: { id?: string; url: string; is_primary?: boolean | null }[];
}

/* ── BDI margin helper (local, not in budget-calc) ── */
function calcMargin(cost: number | null | undefined, bdi: number | null | undefined): number {
  const c = Number(cost) || 0;
  const b = Number(bdi) || 0;
  return c * (b / 100);
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

/* ── Table configuration for multi-table support ── */
export interface TableConfig {
  sectionTable: "sections" | "budget_template_sections";
  itemTable: "items" | "budget_template_items";
  sectionForeignKey: string;
  itemForeignKey: string;
  disableImages?: boolean;
  disableCatalog?: boolean;
  disableTaxRecalc?: boolean;
}

export const DEFAULT_TABLE_CONFIG: TableConfig = {
  sectionTable: "sections",
  itemTable: "items",
  sectionForeignKey: "budget_id",
  itemForeignKey: "section_id",
};

export const TEMPLATE_TABLE_CONFIG: TableConfig = {
  sectionTable: "budget_template_sections",
  itemTable: "budget_template_items",
  sectionForeignKey: "template_id",
  itemForeignKey: "template_section_id",
  disableImages: true,
  disableCatalog: true,
  disableTaxRecalc: true,
};

/** Single cast point for dynamic table access — avoids scattered `as any` */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dbFrom(table: TableConfig["sectionTable"] | TableConfig["itemTable"]): any {
  return supabase.from(table as never);
}

interface SectionsEditorProps {
  budgetId: string;
  sections: SectionData[];
  onSectionsChange: (sections: SectionData[]) => void;
  tableConfig?: TableConfig;
  loading?: boolean;
  /** Estágio de carregamento progressivo, controla a label e o nível de skeleton */
  loadingStage?: "sections" | "items" | "images" | null;
  readOnly?: boolean;
  /** When true, shows addendum controls (mark item/section as add/remove) */
  isAddendum?: boolean;
  /**
   * Called when the user attempts to mutate while readOnly is true.
   * Useful for the "auto-fork on edit of published version" pattern:
   * the parent can intercept and create a draft version transparently.
   */
  onProtectedEditAttempt?: () => void;
  /**
   * Reporta o estado do auto-save inline (campos via debounce + drag&drop)
   * para o pai exibir um único indicador centralizado no header.
   * Status possíveis: "saving" | "saved" | "error".
   */
  onSaveStatusChange?: (status: "saving" | "saved" | "error") => void;
}

/* ── Section context menu (rename + duplicate + delete) ── */
function SectionContextMenu({
  section,
  onRename,
  onDuplicate,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isAddendum = false,
  onToggleAddendumRemove,
}: {
  section: SectionData;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  isAddendum?: boolean;
  onToggleAddendumRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(section.title);
  const isMarkedRemove = section.addendum_action === "remove";
  const confirm = useConfirm();

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setName(section.title); }}>
      <PopoverTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0 tap-target"
          title="Configurações da seção"
          aria-label="Abrir menu da seção"
        >
          <MoreVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2.5 space-y-1" align="end" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="space-y-1 pb-1.5 border-b border-border/40">
          <label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Nome da seção</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); onRename(e.target.value); }}
            className="w-full h-8 px-2 rounded border border-input bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
          />
        </div>
        {(onMoveUp || onMoveDown) && (
          <div className="flex items-center gap-1 pb-1 border-b border-border/40">
            <button
              onClick={() => { onMoveUp?.(); setOpen(false); }}
              disabled={!canMoveUp}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent tap-target"
              title="Mover seção para cima"
            >
              <ChevronRight className="h-3 w-3 -rotate-90" /> Subir
            </button>
            <button
              onClick={() => { onMoveDown?.(); setOpen(false); }}
              disabled={!canMoveDown}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:hover:bg-transparent tap-target"
              title="Mover seção para baixo"
            >
              <ChevronRight className="h-3 w-3 rotate-90" /> Descer
            </button>
          </div>
        )}
        <button
          onClick={() => { onDuplicate(); setOpen(false); }}
          className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-foreground hover:bg-muted transition-colors"
        >
          <Package className="h-3 w-3" /> Duplicar seção
        </button>
        {isAddendum && onToggleAddendumRemove && (
          <button
            onClick={() => { onToggleAddendumRemove(); setOpen(false); }}
            className={cn(
              "flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs transition-colors border",
              isMarkedRemove
                ? "bg-destructive text-destructive-foreground border-destructive hover:opacity-90"
                : "text-destructive hover:bg-destructive/10 border-transparent"
            )}
            title="Marca a seção inteira para remoção do orçamento (subtrai do total)"
          >
            <Trash2 className="h-3 w-3" />
            {isMarkedRemove ? "Cancelar remoção do aditivo" : "Remover seção (aditivo)"}
          </button>
        )}
        <button
          onClick={async () => {
            const ok = await confirm({
              title: "Excluir seção",
              description: "Excluir esta seção e todos os seus itens? Esta ação não pode ser desfeita.",
              confirmText: "Excluir",
              destructive: true,
            });
            if (ok) {
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
  children: (listeners: Record<string, unknown> | undefined) => React.ReactNode;
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
  highlight,
  compact,
  suppliers,
  onUpdate,
  onDelete,
  onImagesChange,
  onPromoteToCatalog,
  disableImages,
  disableCatalog,
  isAddendum,
  sectionAddendumAction,
}: {
  item: ItemData;
  sectionId: string;
  sectionTitle: string;
  budgetId: string;
  isItemSaving: boolean;
  searchMatch?: boolean;
  highlight?: boolean;
  compact: boolean;
  suppliers: { id: string; name: string; categoria: string | null }[];
  onUpdate: (sectionId: string, itemId: string, field: string, value: string | number | boolean | Record<string, unknown> | null) => void;
  onDelete: (sectionId: string, itemId: string) => void;
  onImagesChange: (sectionId: string, itemId: string, images: ItemData["images"]) => void;
  onPromoteToCatalog: (sectionId: string, item: ItemData, sectionTitle: string) => void;
  disableImages?: boolean;
  disableCatalog?: boolean;
  isAddendum?: boolean;
  sectionAddendumAction?: "add" | "remove" | null;
}) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [rowExpanded, setRowExpanded] = useState(false);
  const confirm = useConfirm();
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

  // Effective addendum action: if section is removed, item inherits "remove"
  const effectiveAddendumAction =
    sectionAddendumAction === "remove" ? "remove" : item.addendum_action ?? null;
  const isItemRemoved = effectiveAddendumAction === "remove";
  const isItemAdded = effectiveAddendumAction === "add";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      data-item-row-id={item.id}
      className={cn(
        "group/item transition-colors duration-100 border-b border-border/40 last:border-b-0 hover:bg-muted/30",
        compact && !rowExpanded ? "h-11" : "",
        isOptional && "border-l-2 border-dashed border-muted-foreground/30",
        searchMatch && "bg-primary/5 hover:bg-primary/8",
        isDragging && "bg-muted/40 shadow-lg rounded border-b-0",
        isAddendum && isItemRemoved && "bg-destructive/5 border-l-2 border-destructive/40",
        isAddendum && isItemAdded && "bg-success/5 border-l-2 border-success/40",
        highlight && "bg-success/10 ring-2 ring-success/60 ring-inset animate-in fade-in",
      )}
    >
      {/* ── Compact inline row ── */}
      <div className={cn(
        "flex items-center gap-0",
        compact && !rowExpanded ? "h-11" : "py-2",
      )}>
        {/* [⋮⋮] drag handle — long-press em mobile, hover em desktop */}
        <button
          {...listeners}
          aria-label="Arrastar item (segure para mover)"
          className="flex w-5 sm:w-4 flex-shrink-0 items-center justify-center cursor-grab active:cursor-grabbing rounded text-muted-foreground/40 sm:text-muted-foreground/0 sm:group-hover/item:text-muted-foreground/40 hover:!text-muted-foreground transition-colors touch-none"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
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
                className="text-xs sm:text-sm font-body text-foreground truncate cursor-default"
                title={item.title}
                onClick={(e) => { if (isMobile) { e.stopPropagation(); setMobileEditorOpen(true); } }}
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
              {isAddendum && isItemRemoved && (
                <span className="ml-0.5 text-[9px] font-bold font-body bg-destructive/15 text-destructive rounded px-1 flex-shrink-0 uppercase tracking-wide">
                  {sectionAddendumAction === "remove" ? "REM·SEÇÃO" : "REMOVER"}
                </span>
              )}
              {isAddendum && isItemAdded && (
                <span className="ml-0.5 text-[9px] font-bold font-body bg-success/15 text-success rounded px-1 flex-shrink-0 uppercase tracking-wide">NOVO</span>
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
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-muted/50 text-muted-foreground border-border/40"
            )}
          >
            {(Number(item.bdi_percentage) || 0) > 0 ? `${item.bdi_percentage}%` : "BDI"}
          </button>
        </div>

        {/* [Total Venda] — 72px mobile, 100px desktop */}
        <div className="w-[72px] sm:w-[100px] flex-shrink-0 px-0.5 sm:px-1">
          <div className="h-7 sm:h-8 flex items-center justify-end px-1 sm:px-2 text-[11px] sm:text-sm font-semibold font-mono tabular-nums text-foreground">
            {formatBRL(calcItemSaleTotal(item))}
          </div>
        </div>

        {/* [Aditivo] toggle (apenas em modo aditivo) */}
        {isAddendum && sectionAddendumAction !== "remove" && (
          <div className="flex-shrink-0 flex items-center pr-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const next = item.addendum_action === "remove" ? null : "remove";
                onUpdate(sectionId, item.id, "addendum_action", next);
              }}
              title={item.addendum_action === "remove" ? "Cancelar remoção" : "Marcar para remoção (subtrai do total)"}
              className={cn(
                "h-6 px-1.5 rounded text-[10px] font-bold font-body uppercase border transition-colors",
                item.addendum_action === "remove"
                  ? "bg-destructive text-destructive-foreground border-destructive"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/40"
              )}
            >
              {item.addendum_action === "remove" ? "✓ REM" : "−"}
            </button>
          </div>
        )}

        {/* [⋮ ações] — 24px mobile, 32px desktop */}
        <div className="w-6 sm:w-8 flex-shrink-0 flex items-center justify-center">
          {isItemSaving ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/40" />
          ) : (
            <button
              onClick={async () => {
                const ok = await confirm({
                  title: "Excluir item",
                  description: "Tem certeza que deseja excluir este item?",
                  confirmText: "Excluir",
                  destructive: true,
                });
                if (ok) onDelete(sectionId, item.id);
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
            <div className="space-y-0.5">
              <label className="text-[10px] uppercase tracking-[0.06em] font-medium font-body text-muted-foreground/60">BDI%</label>
              <input
                type="number"
                value={item.bdi_percentage ?? ""}
                onChange={(e) => onUpdate(sectionId, item.id, "bdi_percentage", e.target.value ? Number(e.target.value) : null)}
                placeholder="0"
                step="0.01"
                className="w-20 h-7 px-2 rounded-md border border-border/40 bg-background text-xs font-mono text-right placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all tabular-nums"
              />
            </div>
            <div className="pt-4">
              <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                Margem: {formatBRL(calcMargin(item.internal_unit_price, item.bdi_percentage))}
              </span>
            </div>
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
        sectionTitle={sectionTitle}
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
        sectionTitle={sectionTitle}
        onUpdate={onUpdate}
      />
    </div>
  );
}

export function SectionsEditor({ budgetId, sections, onSectionsChange, tableConfig, loading, loadingStage, readOnly = false, isAddendum = false, onProtectedEditAttempt, onSaveStatusChange }: SectionsEditorProps) {
  // Centralised guard so any mutation attempted while in readOnly mode can be
  // intercepted by the parent (e.g. to auto-fork a published version into a
  // new draft instead of silently no-op'ing the user's action).
  const blockedByReadOnly = useCallback(() => {
    if (!readOnly) return false;
    if (onProtectedEditAttempt) onProtectedEditAttempt();
    return true;
  }, [readOnly, onProtectedEditAttempt]);
  const cfg = tableConfig ?? DEFAULT_TABLE_CONFIG;
  const storageKey = `budget-sections-state-${budgetId}`;
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return new Set(JSON.parse(saved));
    } catch { /* ignore */ }
    return new Set();
  });
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Pagination progressiva por seção: quantos itens estão visíveis em cada uma.
  // Mantém DnD e edição inline funcionais (apenas reduz nodes DOM em seções grandes).
  const ITEMS_PAGE_SIZE = 25;
  const [visibleCounts, setVisibleCounts] = useState<Record<string, number>>({});
  const showMoreItems = useCallback((sectionId: string, total: number) => {
    setVisibleCounts(prev => ({
      ...prev,
      [sectionId]: Math.min((prev[sectionId] ?? ITEMS_PAGE_SIZE) + ITEMS_PAGE_SIZE, total),
    }));
  }, []);
  const showAllItems = useCallback((sectionId: string, total: number) => {
    setVisibleCounts(prev => ({ ...prev, [sectionId]: total }));
  }, []);
  const densityKey = `budget-item-density-${budgetId}`;
  const [compactMode, setCompactMode] = useState(() => {
    try {
      const stored = localStorage.getItem(densityKey);
      if (stored === "expanded") return false;
      if (stored === "compact") return true;
      // Default: compacto em mobile, expandido em desktop
      if (typeof window !== "undefined") {
        return window.matchMedia("(max-width: 767px)").matches;
      }
      return true;
    } catch { return true; }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingUpdates = useRef<Record<string, Record<string, unknown>>>({});

  // Clear all pending debounce timers on unmount to avoid orphan saves & memory leaks
  useEffect(() => {
    return () => {
      Object.values(timers.current).forEach(t => clearTimeout(t));
      timers.current = {};
      pendingUpdates.current = {};
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string; categoria: string | null }[]>([]);

  // Load suppliers once
  useEffect(() => {
    supabase.from("suppliers").select("id, name, categoria").eq("is_active", true).order("name").then(({ data }) => {
      if (data) setSuppliers(data);
    });
  }, []);

  // Persist expanded state
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify([...expandedSections])); } catch { /* ignore */ }
  }, [expandedSections, storageKey]);

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
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

  // Auto-expand matching sections on search e revela todos os itens dessas seções
  useEffect(() => {
    if (sectionMatchMap && sectionMatchMap.size > 0) {
      setExpandedSections(new Set(sectionMatchMap.keys()));
      setVisibleCounts(prev => {
        const next = { ...prev };
        for (const sid of sectionMatchMap.keys()) {
          const sec = sections.find(s => s.id === sid);
          if (sec) next[sid] = sec.items.length;
        }
        return next;
      });
    }
  }, [sectionMatchMap, sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // Mobile: long-press de 220ms inicia o drag, com tolerância a leves movimentos
    // (evita conflitar com scroll vertical da página).
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const debouncedSave = useCallback((logicalTable: string, id: string, updates: Record<string, unknown>) => {
    if (blockedByReadOnly()) return;
    const key = `${logicalTable}-${id}`;

    pendingUpdates.current[key] = {
      ...(pendingUpdates.current[key] ?? {}),
      ...updates,
    };

    if (timers.current[key]) clearTimeout(timers.current[key]);
    setSavingIds(prev => new Set(prev).add(id));
    onSaveStatusChange?.("saving");

    timers.current[key] = setTimeout(async () => {
      const actualTable = logicalTable === "sections" ? cfg.sectionTable : cfg.itemTable;
      const mergedUpdates = pendingUpdates.current[key];

      delete pendingUpdates.current[key];
      delete timers.current[key];

      let saveError: unknown = null;
      if (mergedUpdates && Object.keys(mergedUpdates).length > 0) {
        const { error } = await dbFrom(actualTable).update(mergedUpdates).eq("id", id);
        saveError = error;
      }

      setSavingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });

      if (saveError) {
        onSaveStatusChange?.("error");
      } else {
        // Só sinaliza "saved" quando não há nenhum outro item ainda em debounce/saving
        const stillPending = Object.keys(timers.current).length > 0;
        if (!stillPending) onSaveStatusChange?.("saved");
      }
    }, 600);
  }, [cfg, readOnly, onSaveStatusChange]);

  const updateSection = (sectionId: string, field: string, value: string | number | boolean | null) => {
    if (blockedByReadOnly()) return;
    const updated = sections.map(s =>
      s.id === sectionId ? { ...s, [field]: value } : s
    );
    onSectionsChange(updated);
    debouncedSave("sections", sectionId, { [field]: value });
  };

  const recalcTaxItem = useCallback((currentSections: SectionData[]): SectionData[] => {
    if (cfg.disableTaxRecalc) return currentSections;
    // Hard guard: nunca recalcular/persistir taxa em versão publicada.
    // Evita que efeitos disparados por load/refetch alterem o snapshot público.
    if (readOnly) return currentSections;
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
  }, [debouncedSave, readOnly, cfg.disableTaxRecalc]);

  // Keep a mutable ref to sections so rapid-fire updateItem calls (e.g. from MobileItemEditor batch save) accumulate correctly
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const updateItem = (sectionId: string, itemId: string, field: string, value: string | number | boolean | Record<string, unknown> | null) => {
    if (blockedByReadOnly()) return;
    const currentSections = sectionsRef.current;
    let updated = currentSections.map(s => {
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
    const editedItem = currentSections.flatMap(s => s.items).find(i => i.id === itemId);
    if (priceFields.includes(field) && editedItem?.title !== TAX_ITEM_TITLE) {
      updated = recalcTaxItem(updated);
    }

    sectionsRef.current = updated;
    onSectionsChange(updated);
    debouncedSave("items", itemId, { [field]: value });
  };

  const addSection = async () => {
    if (blockedByReadOnly()) return;
    const order = sections.length;
    const { data } = await dbFrom(cfg.sectionTable)
      .insert({ [cfg.sectionForeignKey]: budgetId, title: "Nova Seção", order_index: order })
      .select()
      .single();
    if (data) {
      const newSection: SectionData = { ...data, items: [] };
      onSectionsChange([...sections, newSection]);
      setExpandedSections(prev => new Set(prev).add(data.id));
      toast.success("Seção adicionada");
    }
  };

  /** Cria (ou reutiliza) uma seção de abatimento ("Descontos" ou "Créditos") e adiciona
   *  um item com qtd=1 e custo negativo padrão de -R$ 1.000 (editável).
   *  - Desconto: aparece como "Desconto promocional" e impacta margem.
   *  - Crédito: aparece como "Crédito" e NÃO impacta a margem interna. */
  const addAbatement = async (kind: "discount" | "credit") => {
    if (blockedByReadOnly()) return;
    const SECTION_TITLE = kind === "credit" ? "Créditos" : "Descontos";
    const ITEM_TITLE = kind === "credit" ? "Crédito" : "Desconto promocional";
    const SUBTITLE = kind === "credit"
      ? "Abatimento contratual aplicado ao total"
      : "Aplicado sobre o subtotal do projeto";
    const DEFAULT_AMOUNT = -1000;

    // 1) Reutiliza seção se já existir; senão cria
    let targetSection = sections.find(
      (s) => (s.title || "").trim().toLowerCase() === SECTION_TITLE.toLowerCase(),
    );
    let updatedSections = sections;

    if (!targetSection) {
      const order = sections.length;
      const { data: newSec, error: secErr } = await dbFrom(cfg.sectionTable)
        .insert({
          [cfg.sectionForeignKey]: budgetId,
          title: SECTION_TITLE,
          subtitle: SUBTITLE,
          order_index: order,
        })
        .select()
        .single();
      if (secErr || !newSec) {
        toast.error(`Não foi possível criar a seção de ${kind === "credit" ? "créditos" : "descontos"}`);
        return;
      }
      targetSection = { ...newSec, items: [] } as SectionData;
      updatedSections = [...sections, targetSection];
    }

    // 2) Insere o item de abatimento
    const order = targetSection.items.length;
    const insertPayload: Record<string, unknown> = {
      [cfg.itemForeignKey]: targetSection.id,
      title: ITEM_TITLE,
      description: null,
      unit: null,
      qty: 1,
      internal_unit_price: DEFAULT_AMOUNT,
      bdi_percentage: 0,
      order_index: order,
    };
    const { data: newItem, error: itemErr } = await dbFrom(cfg.itemTable)
      .insert(insertPayload)
      .select()
      .single();
    if (itemErr || !newItem) {
      toast.error(`Não foi possível adicionar o ${kind === "credit" ? "crédito" : "desconto"}`);
      return;
    }

    // 3) Atualiza estado local + section_price
    let next = updatedSections.map((s) => {
      if (s.id !== targetSection!.id) return s;
      const newItems = [...s.items, { ...newItem, images: [] } as ItemData];
      const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
      dbFrom(cfg.sectionTable).update({ section_price: newSaleTotal }).eq("id", s.id);
      return { ...s, items: newItems, section_price: newSaleTotal };
    });
    next = recalcTaxItem(next);
    onSectionsChange(next);
    setExpandedSections((prev) => new Set(prev).add(targetSection!.id));
    toast.success(
      kind === "credit"
        ? "Crédito adicionado — ajuste o valor conforme necessário"
        : "Desconto adicionado — ajuste o valor conforme necessário",
    );
  };

  const addDiscount = () => addAbatement("discount");
  const addCredit = () => addAbatement("credit");


  const duplicateSection = async (sectionId: string) => {
    if (blockedByReadOnly()) return;
    const source = sections.find(s => s.id === sectionId);
    if (!source) return;
    const order = sections.length;
    const { data: newSec } = await dbFrom(cfg.sectionTable)
      .insert({
        [cfg.sectionForeignKey]: budgetId,
        title: `${source.title} (cópia)`,
        order_index: order,
        is_optional: source.is_optional ?? false,
        subtitle: source.subtitle ?? null,
      })
      .select()
      .single();
    if (!newSec) return;
    // Duplicate items
    const newItems: ItemData[] = [];
    for (const item of source.items) {
      const { data: newItem } = await dbFrom(cfg.itemTable)
        .insert({
          [cfg.itemForeignKey]: newSec.id,
          title: item.title,
          description: item.description,
          unit: item.unit,
          qty: item.qty,
          internal_unit_price: item.internal_unit_price,
          internal_total: item.internal_total,
          bdi_percentage: item.bdi_percentage,
          order_index: item.order_index,
          ...(cfg.disableCatalog ? {} : { notes: item.notes }),
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
    catalog_snapshot: Record<string, unknown> | null;
  }): Promise<string | null> => {
    if (readOnly) return null;
    const section = sections.find(s => s.id === sectionId);
    const order = section?.items.length || 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const insertPayload: Record<string, any> = {
      [cfg.itemForeignKey]: sectionId,
      title: itemData?.title || "Novo Item",
      description: itemData?.description || null,
      unit: itemData?.unit || null,
      qty: itemData?.qty || null,
      internal_unit_price: itemData?.internal_unit_price || null,
      internal_total: itemData?.internal_total || null,
      order_index: order,
    };

    if (!cfg.disableCatalog) {
      insertPayload.catalog_item_id = itemData?.catalog_item_id || null;
      insertPayload.catalog_snapshot = itemData?.catalog_snapshot || null;
    }

    let { data, error: insertError } = await dbFrom(cfg.itemTable)
      .insert(insertPayload)
      .select()
      .single();
    // RLS code 42501 — pode ser sessão expirada silenciosamente.
    // Tenta recuperar a sessão e reexecutar uma vez antes de mostrar erro.
    if (insertError && (insertError.code === "42501" || /row-level security/i.test(insertError.message || ""))) {
      try {
        const mod = await import("@/lib/auth-session-recovery");
        await mod.triggerAuthSessionRecovery();
        const retry = await dbFrom(cfg.itemTable)
          .insert(insertPayload)
          .select()
          .single();
        data = retry.data;
        insertError = retry.error;
      } catch {
        /* fallback para o toast original abaixo */
      }
    }
    if (insertError) {
      const friendly = (insertError.code === "42501" || /row-level security/i.test(insertError.message || ""))
        ? "Sua sessão expirou. Recarregue a página e entre novamente para continuar editando."
        : `Erro ao adicionar item: ${insertError.message}`;
      toast.error(friendly, { duration: 8000 });
      return null;
    }
    if (data) {
      let itemImages: { id?: string; url: string; is_primary: boolean | null }[] = [];
      if (!cfg.disableImages) {
        const catalogImageUrl = itemData?.catalog_snapshot?.image_url;
        if (catalogImageUrl) {
          const { data: imgRow } = await supabase.from("item_images").insert({
            item_id: data.id,
            url: String(catalogImageUrl),
            is_primary: true,
          }).select().single();
          if (imgRow) itemImages = [imgRow];
        }
      }

      let updated = sections.map(s => {
        if (s.id !== sectionId) return s;
        const newItem = { ...data, images: itemImages } as ItemData;
        const newItems = [...s.items, newItem];
        const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
        if (newSaleTotal !== 0) {
          dbFrom(cfg.sectionTable).update({ section_price: newSaleTotal }).eq("id", sectionId);
        }
        return { ...s, items: newItems, section_price: newSaleTotal !== 0 ? newSaleTotal : s.section_price };
      });
      updated = recalcTaxItem(updated);
      onSectionsChange(updated);
      // Garante que o item recém-adicionado fique visível mesmo em seções paginadas
      const updatedSection = updated.find(s => s.id === sectionId);
      if (updatedSection) {
        setVisibleCounts(prev => ({ ...prev, [sectionId]: updatedSection.items.length }));
      }
      const origin = itemData?.catalog_item_id ? "Item do catálogo adicionado" : "Item manual adicionado";
      toast.success(origin);
      return data.id as string;
    }
    return null;
  };

  const deleteItem = async (sectionId: string, itemId: string) => {
    if (blockedByReadOnly()) return;
    await dbFrom(cfg.itemTable).delete().eq("id", itemId);
    let updated = sections.map(s => {
      if (s.id !== sectionId) return s;
      const newItems = s.items.filter(i => i.id !== itemId);
      const newSaleTotal = newItems.reduce((sum, i) => sum + calcItemSaleTotal(i), 0);
      dbFrom(cfg.sectionTable).update({ section_price: newSaleTotal }).eq("id", sectionId);
      return { ...s, items: newItems, section_price: newSaleTotal };
    });
    updated = recalcTaxItem(updated);
    onSectionsChange(updated);
    toast.success("Item removido");
  };

  const deleteSection = async (sectionId: string) => {
    if (blockedByReadOnly()) return;
    const section = sections.find(s => s.id === sectionId);
    if (section && section.items.length > 0) {
      const itemIds = section.items.map(i => i.id);
      await dbFrom(cfg.itemTable).delete().in("id", itemIds);
    }
    await dbFrom(cfg.sectionTable).delete().eq("id", sectionId);
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

  const grandTotalCost = useMemo(() => sections.reduce((sum, s) => sum + calcSectionCostTotal(s), 0), [sections]);
  const grandTotalSale = useMemo(() => sections.reduce((sum, s) => sum + calcSectionSaleTotal(s), 0), [sections]);
  const grandMargin = grandTotalSale - grandTotalCost;
  const grandBdiPercent = grandTotalCost > 0 ? ((grandTotalSale / grandTotalCost) - 1) * 100 : 0;

  /* ── Drag handlers with rollback ── */
  const handleSectionDragEnd = async (event: DragEndEvent) => {
    if (blockedByReadOnly()) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sections.findIndex(s => s.id === active.id);
    const newIndex = sections.findIndex(s => s.id === over.id);
    const previousOrder = [...sections];
    const reordered = arrayMove(sections, oldIndex, newIndex);

    const withNewOrder = reordered.map((s, i) => ({ ...s, order_index: i }));
    onSectionsChange(withNewOrder);
    onSaveStatusChange?.("saving");
    try {
      await Promise.all(
        withNewOrder.map(s =>
          dbFrom(cfg.sectionTable).update({ order_index: s.order_index }).eq("id", s.id)
        )
      );
      onSaveStatusChange?.("saved");
    } catch {
      onSectionsChange(previousOrder);
      onSaveStatusChange?.("error");
      toast.error("Erro ao salvar a ordem. Tente novamente.");
    }
  };

  const moveSection = async (sectionId: string, dir: -1 | 1) => {
    if (blockedByReadOnly()) return;
    const idx = sections.findIndex(s => s.id === sectionId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    const previousOrder = [...sections];
    const reordered = arrayMove(sections, idx, newIdx).map((s, i) => ({ ...s, order_index: i }));
    onSectionsChange(reordered);
    onSaveStatusChange?.("saving");
    try {
      await Promise.all(
        reordered.map(s =>
          dbFrom(cfg.sectionTable).update({ order_index: s.order_index }).eq("id", s.id)
        )
      );
      onSaveStatusChange?.("saved");
    } catch {
      onSectionsChange(previousOrder);
      onSaveStatusChange?.("error");
      toast.error("Erro ao salvar a ordem. Tente novamente.");
    }
  };

  const handleItemDragEnd = (sectionId: string) => async (event: DragEndEvent) => {
    if (blockedByReadOnly()) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const previousSections = [...sections];
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
    onSaveStatusChange?.("saving");

    try {
      const targetSection = updated.find(s => s.id === sectionId);
      if (targetSection) {
        await Promise.all(
          targetSection.items.map(item =>
            dbFrom(cfg.itemTable).update({ order_index: item.order_index }).eq("id", item.id)
          )
        );
      }
      onSaveStatusChange?.("saved");
    } catch {
      onSectionsChange(previousSections);
      onSaveStatusChange?.("error");
      toast.error("Erro ao salvar a ordem dos itens.");
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

  if (loading) {
    const stageLabel =
      loadingStage === "items"
        ? "Carregando itens das seções…"
        : loadingStage === "images"
          ? "Carregando imagens dos itens…"
          : "Carregando seções do orçamento…";
    return (
      <div className="mt-6 pb-20 space-y-3" aria-busy="true" aria-live="polite">
        <div className="flex items-center justify-between mb-4 px-1">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-md border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-48 rounded bg-muted animate-pulse" />
              <div className="ml-auto h-4 w-20 rounded bg-muted animate-pulse" />
            </div>
            <div className="space-y-2 pl-7">
              {[1, 2].map(j => (
                <div key={j} className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded bg-muted/60 animate-pulse" />
                  <div className="flex-1 h-9 rounded bg-muted/50 animate-pulse" />
                  <div className="h-9 w-20 rounded bg-muted/40 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground font-body">
          <Loader2 className="h-4 w-4 animate-spin" />
          {stageLabel}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 pb-20">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4 px-1 gap-2">
        <h2 className="text-xs sm:text-sm font-display font-bold text-foreground uppercase tracking-[0.06em]">Seções e Itens</h2>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={addDiscount}
            title={readOnly
              ? "Adicionar desconto — gera nova versão editável automaticamente"
              : "Adicionar desconto promocional (impacta margem)"}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-body font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 transition-colors"
          >
            <BadgePercent className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Adicionar</span> Desconto
          </button>
          <button
            onClick={addCredit}
            title={readOnly
              ? "Adicionar crédito — gera nova versão editável automaticamente"
              : "Adicionar crédito (abatimento contratual — não impacta margem)"}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-body font-medium text-sky-700 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/15 transition-colors"
          >
            <MinusCircle className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Adicionar</span> Crédito
          </button>
          <button
            onClick={addSection}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-body font-medium text-primary bg-primary/5 hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Nova</span> Seção
          </button>
        </div>
      </div>

      {/* ── Control bar ── */}
      {sections.length > 0 && (
        <div className="flex items-center gap-1.5 sm:gap-2 mb-3 p-1.5 sm:p-2 rounded-lg bg-muted/30 border border-border/40 flex-wrap sm:flex-nowrap">
          <div className="relative flex-1 min-w-[120px] sm:max-w-xs">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") { setSearchQuery(""); e.currentTarget.blur(); } }}
              placeholder="Buscar…"
              className="w-full pl-7 pr-6 h-8 rounded-md border border-border/60 bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/40 transition-all"
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
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md text-[11px] font-body text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title="Expandir tudo"
            >
              <ChevronsUpDown className="h-3 w-3" />
              <span className="hidden sm:inline">Expandir</span>
            </button>
            <button
              onClick={collapseAll}
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md text-[11px] font-body text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              title="Colapsar tudo"
            >
              <ChevronsDownUp className="h-3 w-3" />
              <span className="hidden sm:inline">Colapsar</span>
            </button>
            <div className="w-px h-4 bg-border/60 mx-0.5" />
            <button
              onClick={() => {
                const next = !compactMode;
                setCompactMode(next);
                try { localStorage.setItem(densityKey, next ? "compact" : "expanded"); } catch { /* ignore */ }
              }}
              className={cn(
                "flex items-center gap-1 px-1.5 sm:px-2 py-1.5 rounded-md text-[11px] font-body transition-colors",
                compactMode
                  ? "text-foreground bg-background shadow-sm border border-border/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-background"
              )}
              title={compactMode ? "Modo expandido" : "Modo compacto"}
            >
              {compactMode ? <Rows3 className="h-3 w-3" /> : <Rows4 className="h-3 w-3" />}
              <span className="hidden sm:inline">{compactMode ? "Compacto" : "Expandido"}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Global BDI warning ── */}
      {(() => {
        const { avgBdi, hasData } = calcGlobalBdi(sections);
        if (!hasData || avgBdi >= 20) return null;
        return (
          <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded border border-border bg-muted/30 text-xs font-body text-muted-foreground">
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
            {sections.map((section, sectionIdx) => {
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
                  {(dragListeners: Record<string, unknown> | undefined) => (
                    <div className={cn(
                      "group/section",
                      isSearchActive && !sectionHasMatch && "opacity-40",
                      isAddendum && section.addendum_action === "remove" && "bg-destructive/5 border-l-2 border-destructive/40",
                    )}>
                      {/* Section header — 48px fixed, Linear pattern */}
                      <div
                        className={cn(
                          "h-12 px-2 sm:px-3 flex items-center cursor-pointer transition-colors duration-100",
                          isExpanded ? "bg-muted/20 hover:bg-muted/30" : "hover:bg-muted/30"
                        )}
                        onClick={() => toggleSection(section.id)}
                      >
                        {/* [⋮⋮] drag — visível no mobile (long-press); hover desktop */}
                        <button
                          {...dragListeners}
                          aria-label="Arrastar seção (segure para mover)"
                          className="flex w-6 sm:w-5 flex-shrink-0 items-center justify-center cursor-grab active:cursor-grabbing rounded text-muted-foreground/40 sm:text-muted-foreground/0 sm:group-hover/section:text-muted-foreground/40 hover:!text-muted-foreground transition-colors touch-none tap-target"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <GripVertical className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                        </button>

                        {/* [▶/▼] chevron */}
                        <div className="w-5 sm:w-6 flex-shrink-0 flex items-center justify-center">
                          <ChevronRight className={cn(
                            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200 ease-out",
                            isExpanded && "rotate-90"
                          )} />
                        </div>

                        {/* [Nome da Seção] — auto, truncate */}
                        <span className={cn(
                          "text-xs sm:text-sm font-semibold font-display truncate min-w-0",
                          isAddendum && section.addendum_action === "remove"
                            ? "text-destructive line-through"
                            : "text-foreground"
                        )}>
                          {isSearchActive ? highlightText(section.title || "Sem título") : (section.title || "Sem título")}
                        </span>

                        {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground/30 ml-1 flex-shrink-0" />}
                        {section.is_optional && (
                          <span className="ml-1 px-1 py-0.5 text-[9px] sm:text-[10px] font-medium rounded bg-muted text-muted-foreground flex-shrink-0">
                            OPT
                          </span>
                        )}
                        {isAddendum && section.addendum_action === "remove" && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded bg-destructive text-destructive-foreground flex-shrink-0 uppercase tracking-wider">
                            Removida
                          </span>
                        )}
                        {isAddendum && section.addendum_action === "add" && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-bold rounded bg-success text-success-foreground flex-shrink-0 uppercase tracking-wider">
                            Nova
                          </span>
                        )}

                        {/* [N itens] — text-xs muted */}
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-body ml-1.5 sm:ml-2 shrink-0 tabular-nums">
                          {section.items.length} {section.items.length === 1 ? "item" : "itens"}
                        </span>

                        {/* Right zone: financial metrics */}
                        <div className="ml-auto flex items-center gap-1.5 sm:gap-3 shrink-0">
                          {/* Desktop: Custo | BDI% | Margem | Total */}
                          <div className="hidden md:flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[9px] uppercase tracking-[0.06em] font-medium text-muted-foreground/50 font-body block leading-none mb-0.5">Custo</span>
                              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{formatBRL(sectionCostTotal)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase tracking-[0.06em] font-medium text-muted-foreground/50 font-body block leading-none mb-0.5">BDI</span>
                              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{sectionCostTotal > 0 ? `${(((sectionSaleTotal / sectionCostTotal) - 1) * 100).toFixed(0)}%` : "—"}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[9px] uppercase tracking-[0.06em] font-medium text-muted-foreground/50 font-body block leading-none mb-0.5">Margem</span>
                              <span className="text-[11px] font-mono tabular-nums text-muted-foreground">{formatBRL(sectionSaleTotal - sectionCostTotal)}</span>
                            </div>
                          </div>

                          {/* [% barra] — hidden on mobile */}
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

                          {/* [R$ total] */}
                          <div className="text-right">
                            <span className="hidden md:block text-[9px] uppercase tracking-[0.06em] font-medium text-muted-foreground/50 font-body leading-none mb-0.5">Total</span>
                            <span className="text-xs sm:text-sm font-mono font-semibold text-foreground tabular-nums tracking-[-0.035em]">
                              {formatBRL(sectionSaleTotal)}
                            </span>
                          </div>
                        </div>

                        {/* [⋮] menu — sempre visível no mobile, hover no desktop */}
                        <div className="w-7 sm:w-6 flex-shrink-0 flex items-center justify-center sm:opacity-0 sm:group-hover/section:opacity-100 transition-opacity duration-100">
                          <SectionContextMenu
                            section={section}
                            onRename={(name) => updateSection(section.id, "title", name)}
                            onDuplicate={() => duplicateSection(section.id)}
                            onDelete={() => deleteSection(section.id)}
                            onMoveUp={() => moveSection(section.id, -1)}
                            onMoveDown={() => moveSection(section.id, 1)}
                            canMoveUp={sectionIdx > 0}
                            canMoveDown={sectionIdx < sections.length - 1}
                            isAddendum={isAddendum}
                            onToggleAddendumRemove={() => {
                              const next = section.addendum_action === "remove" ? null : "remove";
                              updateSection(section.id, "addendum_action", next);
                            }}
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
                            <div className="flex items-center border-b border-border/60 bg-muted/10 px-1 sm:px-2 h-7 sm:h-8">
                              <div className="w-5 sm:w-6 flex-shrink-0" />
                              <div className="flex-1 px-0.5 sm:px-1">
                                <span className="text-[10px] sm:text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">Item</span>
                              </div>
                              <div className="w-9 sm:w-16 flex-shrink-0 px-0.5 sm:px-1 text-center">
                                <span className="text-[10px] sm:text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">Qtd</span>
                              </div>
                              <div className="w-14 sm:w-[100px] flex-shrink-0 px-0.5 sm:px-1 text-right">
                                <span className="text-[10px] sm:text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">Custo</span>
                              </div>
                              <div className="hidden md:block w-[72px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">BDI%</span>
                              </div>
                              <div className="hidden md:block w-[100px] flex-shrink-0 px-1 text-right">
                                <span className="text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">Margem</span>
                              </div>
                              <div className="w-[72px] sm:w-[100px] flex-shrink-0 px-0.5 sm:px-1 text-right">
                                <span className="text-[10px] sm:text-[11px] font-medium font-body uppercase tracking-wide text-muted-foreground">Total</span>
                              </div>
                              <div className="w-6 sm:w-8 flex-shrink-0" />
                            </div>
                          )}

                          {/* Items with DnD — paginação progressiva por seção para performance em listas longas */}
                          {(() => {
                            const totalItems = section.items.length;
                            const visibleCount = Math.min(visibleCounts[section.id] ?? ITEMS_PAGE_SIZE, totalItems);
                            const visibleItems = totalItems > visibleCount ? section.items.slice(0, visibleCount) : section.items;
                            const hiddenCount = totalItems - visibleCount;
                            return (
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleItemDragEnd(section.id)}
                              >
                                <SortableContext
                                  items={visibleItems.map(i => i.id)}
                                  strategy={verticalListSortingStrategy}
                                >
                                  <div>
                                    {totalItems === 0 ? (
                                      <button
                                        onClick={() => addItem(section.id)}
                                        className="w-full py-6 text-sm font-body text-muted-foreground/40 hover:text-foreground hover:bg-muted/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                      >
                                        <Plus className="h-3.5 w-3.5" />
                                        Adicionar primeiro item
                                      </button>
                                    ) : (
                                      <>
                                        {visibleItems.map((item) => (
                                          <SortableItemRow
                                            key={item.id}
                                            item={item}
                                            sectionId={section.id}
                                            sectionTitle={section.title}
                                            budgetId={budgetId}
                                            isItemSaving={savingIds.has(item.id)}
                                            searchMatch={matchingItemIds?.has(item.id)}
                                            highlight={highlightItemId === item.id}
                                            compact={compactMode}
                                            onUpdate={updateItem}
                                            onDelete={deleteItem}
                                            onImagesChange={handleImagesChange}
                                            suppliers={suppliers}
                                            onPromoteToCatalog={promoteToCatalog}
                                            disableImages={cfg.disableImages}
                                            disableCatalog={cfg.disableCatalog}
                                            isAddendum={isAddendum}
                                            sectionAddendumAction={section.addendum_action ?? null}
                                          />
                                        ))}
                                        {hiddenCount > 0 && (
                                          <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-dashed border-border/50 bg-muted/20">
                                            <span className="text-[11px] font-body text-muted-foreground tabular-nums">
                                              Mostrando {visibleCount} de {totalItems} itens
                                            </span>
                                            <div className="flex items-center gap-2">
                                              <button
                                                type="button"
                                                onClick={() => showMoreItems(section.id, totalItems)}
                                                className="text-[11px] font-body font-medium text-primary hover:underline"
                                              >
                                                Mostrar mais {Math.min(ITEMS_PAGE_SIZE, hiddenCount)}
                                              </button>
                                              <span className="text-muted-foreground/40" aria-hidden>·</span>
                                              <button
                                                type="button"
                                                onClick={() => showAllItems(section.id, totalItems)}
                                                className="text-[11px] font-body text-muted-foreground hover:text-foreground hover:underline"
                                              >
                                                Mostrar todos
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </SortableContext>
                              </DndContext>
                            );
                          })()}

                          {/* Add item */}
                          <div className="px-3 py-1.5 border-t border-border/30">
                            <AddItemPopover
                              sectionTitle={section.title}
                              onAddItem={(itemData) => addItem(section.id, itemData)}
                              onLinkCatalog={async (rowId, catalogItemId, linkedSections, undoCatalog) => {
                                if (cfg.disableCatalog || !rowId) return;
                                await dbFrom(cfg.itemTable)
                                  .update({ catalog_item_id: catalogItemId })
                                  .eq("id", rowId);
                                onSectionsChange(
                                  sections.map((s) =>
                                    s.id !== section.id
                                      ? s
                                      : {
                                          ...s,
                                          items: s.items.map((it) =>
                                            it.id === rowId
                                              ? ({ ...it, catalog_item_id: catalogItemId } as ItemData)
                                              : it,
                                          ),
                                        },
                                  ),
                                );
                                // Visual feedback: highlight the linked row, scroll into view, clear after 3.5s
                                setHighlightItemId(rowId);
                                if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
                                requestAnimationFrame(() => {
                                  const el = document.querySelector<HTMLElement>(`[data-item-row-id="${rowId}"]`);
                                  el?.scrollIntoView({ behavior: "smooth", block: "center" });
                                });
                                highlightTimerRef.current = setTimeout(() => {
                                  setHighlightItemId((current) => (current === rowId ? null : current));
                                }, 3500);
                                // Toast com ação Desfazer
                                const sectionsCount = linkedSections.length;
                                const description =
                                  sectionsCount === 0
                                    ? "Vinculado à linha do orçamento."
                                    : sectionsCount === 1
                                      ? `Vinculado à linha e disponível na seção "${linkedSections[0]}".`
                                      : `Vinculado à linha e disponível em ${sectionsCount} seções: ${linkedSections.join(", ")}.`;
                                toast.success("Item adicionado ao catálogo", {
                                  description,
                                  duration: 8000,
                                  action: {
                                    label: "Desfazer",
                                    onClick: () => {
                                      void (async () => {
                                        try {
                                          // Reverte vínculo na linha do orçamento
                                          await dbFrom(cfg.itemTable)
                                            .update({ catalog_item_id: null })
                                            .eq("id", rowId);
                                          onSectionsChange(
                                            sections.map((s) =>
                                              s.id !== section.id
                                                ? s
                                                : {
                                                    ...s,
                                                    items: s.items.map((it) =>
                                                      it.id === rowId
                                                        ? ({ ...it, catalog_item_id: null } as ItemData)
                                                        : it,
                                                    ),
                                                  },
                                            ),
                                          );
                                          // Remove o item recém-criado do catálogo
                                          await undoCatalog();
                                          setHighlightItemId((c) => (c === rowId ? null : c));
                                          toast.success("Vínculo desfeito");
                                        } catch (err) {
                                          logger.error("Falha ao desfazer vínculo do catálogo", err);
                                          toast.error("Não foi possível desfazer");
                                        }
                                      })();
                                    },
                                  },
                                });
                              }}
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
        <div className="sticky bottom-0 z-10 border-t border-border/40 bg-card/90 backdrop-blur-xl py-2 sm:py-3 px-3 sm:px-6 shadow-[0_-4px_16px_-4px_rgba(0,0,0,0.08)]">
          <div className="grid grid-cols-4 gap-2 sm:flex sm:items-center sm:justify-between sm:gap-8">
            {/* Custo */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 font-medium">Custo</span>
              <span className="text-[11px] sm:text-sm font-semibold font-mono text-foreground tabular-nums tracking-[-0.035em]">
                {formatBRL(grandTotalCost)}
              </span>
            </div>
            {/* BDI */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 font-medium">BDI</span>
              <span className="text-[11px] sm:text-sm font-semibold font-mono text-primary tabular-nums tracking-[-0.035em]">
                {grandBdiPercent.toFixed(1)}%
              </span>
            </div>
            {/* Venda — destaque */}
            <div className="flex flex-col gap-0.5">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 font-medium">Venda</span>
              <span className="text-[11px] sm:text-base font-bold font-mono text-foreground tabular-nums tracking-[-0.035em]">
                {formatBRL(grandTotalSale)}
              </span>
            </div>
            {/* Margem */}
            <div className="flex flex-col gap-0.5 sm:items-end">
              <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.08em] text-muted-foreground/60 font-medium">Margem</span>
              <span className={cn(
                "text-[11px] sm:text-sm font-bold font-mono tabular-nums tracking-[-0.035em]",
                marginPercent >= 15 ? "text-success" : marginPercent >= 10 ? "text-warning" : "text-destructive"
              )}>
                {marginPercent.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
