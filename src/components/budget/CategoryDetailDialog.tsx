import { useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ItemImageGallery } from "./ItemImageGallery";
import { Lightbox } from "./Lightbox";
import { ArrowLeft, ChevronDown, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseItemDescription, isDescriptionExpandable } from "@/lib/parse-item-description";
import type { CategorizedGroup } from "@/lib/scope-categories";
import { motion, AnimatePresence } from "framer-motion";

const IMAGE_GALLERY_CATEGORIES = new Set(["marcenaria", "mobiliario", "eletro"]);

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  group: CategorizedGroup | null;
  budgetId?: string;
  editable?: boolean;
}

function DetailItem({ item, budgetId, editable, showGallery }: { item: any; budgetId?: string; editable: boolean; showGallery: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const expandable = isDescriptionExpandable(item.description);
  const parsed = expanded ? parseItemDescription(item.description) : null;
  const hasImages = item.images && item.images.length > 0;
  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];

  // Short inline description (non-expandable)
  const shortDesc =
    !expandable && item.description && item.description.trim().length > 0
      ? item.description.trim()
      : null;

  const itemImages = (item.images || []).map((img: any) => ({
    url: img.url,
    alt: item.title,
  }));

  return (
    <>
      <Lightbox images={itemImages} initialIndex={0} open={lightboxOpen} onClose={() => setLightboxOpen(false)} />

      <div className={cn("transition-colors", expanded && "bg-muted/10")}>
        <button
          onClick={expandable ? () => setExpanded((v) => !v) : undefined}
          disabled={!expandable}
          type="button"
          className={cn(
            "w-full flex items-start gap-3 px-4 py-3 min-h-[56px] text-left",
            expandable && "cursor-pointer hover:bg-muted/30 transition-colors"
          )}
        >
          {/* Thumbnail */}
          {showGallery && budgetId ? (
            <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0 pt-0.5">
              <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />
            </div>
          ) : primaryImage ? (
            <button
              onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
              className="relative w-10 h-10 rounded-lg overflow-hidden group cursor-zoom-in flex-shrink-0 border border-border"
              type="button"
            >
              <img src={primaryImage.url} alt={item.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" loading="lazy" />
              {hasImages && item.images.length > 1 && (
                <span className="absolute bottom-0 right-0 bg-foreground/60 text-background text-[9px] px-1 rounded-tl-sm font-mono">
                  +{item.images.length - 1}
                </span>
              )}
            </button>
          ) : null}

          {/* Name + qty + short desc */}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-body font-medium text-foreground">{item.title}</p>
            {item.qty && (
              <p className="text-xs text-muted-foreground font-body">
                {item.qty} {item.unit || "un"}
              </p>
            )}
            {shortDesc && (
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                {shortDesc}
              </p>
            )}
          </div>

          {/* Chevron */}
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {expandable && (
              <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              </motion.div>
            )}
          </div>
        </button>

        {/* Expanded description */}
        <AnimatePresence>
          {expanded && parsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 pt-1 space-y-3">
                {parsed.map((group, gi) => (
                  <div key={gi}>
                    {group.room && (
                      <p className="text-sm font-semibold text-foreground font-body mb-1.5">{group.room}</p>
                    )}
                    <ul className="space-y-1 pl-1">
                      {group.items.map((bullet, bi) => (
                        <li key={bi} className="text-xs text-muted-foreground font-body leading-relaxed flex items-start gap-2">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/40 mt-1.5 flex-shrink-0" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {hasImages && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxOpen(true); }}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1.5 min-h-[44px]"
                    type="button"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Ver fotos ({item.images.length})
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export function CategoryDetailDialog({ open, onClose, group, budgetId, editable = false }: CategoryDetailDialogProps) {
  if (!group) return null;

  const showGallery = IMAGE_GALLERY_CATEGORIES.has(group.category.id);
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
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div className="divide-y divide-border/30">
                    {items.map((item: any) => (
                      <DetailItem
                        key={item.id}
                        item={item}
                        budgetId={budgetId}
                        editable={editable}
                        showGallery={showGallery}
                      />
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
