import { useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ProductShowcaseCard } from "./ProductShowcaseCard";
import { ArrowLeft } from "lucide-react";
import type { CategorizedGroup } from "@/lib/scope-categories";

const IMAGE_GALLERY_CATEGORIES = new Set(["marcenaria", "mobiliario", "eletro"]);

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  group: CategorizedGroup | null;
  budgetId?: string;
  editable?: boolean;
}

export function CategoryDetailDialog({ open, onClose, group, budgetId, editable = false }: CategoryDetailDialogProps) {
  if (!group) return null;

  const showGallery = IMAGE_GALLERY_CATEGORIES.has(group.category.id);

  // Flatten all items across sections, keeping section context
  const allItems = group.sections.flatMap(section =>
    (section.items || []).map((item: any) => ({ ...item, _sectionTitle: section.title }))
  );

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 overflow-y-auto">
        <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display">
            <button
              onClick={onClose}
              className="flex items-center justify-center h-8 w-8 rounded-lg hover:bg-muted/60 transition-colors flex-shrink-0 -ml-1"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            <div className={`w-1.5 h-5 rounded-full ${group.category.bgClass}`} />
            <span className="truncate">{group.category.label}</span>
            <span className={`ml-auto text-base font-mono tabular-nums shrink-0 ${group.category.colorClass}`}>
              {formatBRL(group.subtotal)}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 sm:px-5 py-5">
          {/* Item count */}
          <p className="text-xs text-muted-foreground font-body mb-4">
            {allItems.length} {allItems.length === 1 ? "item" : "itens"} · Clique nas fotos para ampliar
          </p>

          {/* Product grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {allItems.map((item: any) => (
              <ProductShowcaseCard
                key={item.id}
                item={item}
                budgetId={budgetId}
                editable={editable}
                showGallery={showGallery}
              />
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
