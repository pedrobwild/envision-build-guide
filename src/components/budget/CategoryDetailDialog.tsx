import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ItemImageGallery } from "./ItemImageGallery";
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

  const showImages = IMAGE_GALLERY_CATEGORIES.has(group.category.id);
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

        <div className="p-5 space-y-4">
          {group.sections.map((section) => {
            const subtotal = calculateSectionSubtotal(section);
            const items = section.items || [];

            return (
              <div key={section.id} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
                  <span className="text-sm font-display font-semibold text-foreground">
                    {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}{section.title}
                  </span>
                  <span className="text-base font-mono tabular-nums text-foreground font-semibold">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div className="divide-y divide-border/30">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
                        {showImages && budgetId && <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-body font-medium text-foreground">{item.title}</p>
                          {item.qty && (
                            <p className="text-xs text-muted-foreground font-body">
                              {item.qty} {item.unit || "un"}
                            </p>
                          )}
                        </div>

                        {Number(item.internal_total) > 0 && (
                          <span className="text-sm font-mono tabular-nums text-muted-foreground font-medium flex-shrink-0">
                            {formatBRL(Number(item.internal_total))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
