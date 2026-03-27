import { useState } from "react";
import { ChevronDown, Camera } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { parseItemDescription, isDescriptionExpandable } from "@/lib/parse-item-description";
import { formatBRL } from "@/lib/formatBRL";
import { ItemImageGallery } from "./ItemImageGallery";
import { Lightbox } from "./Lightbox";

interface ExpandableItemRowProps {
  item: any;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  showItemQty: boolean;
  showItemPrices: boolean;
  highlightZone?: string | null;
  showImageGallery: boolean;
  budgetId?: string;
  editable?: boolean;
  onOpenLightbox: (url: string) => void;
}

export function ExpandableItemRow({
  item,
  index,
  isLast,
  isExpanded,
  onToggle,
  showItemQty,
  showItemPrices,
  highlightZone,
  showImageGallery,
  budgetId,
  editable = false,
  onOpenLightbox,
}: ExpandableItemRowProps) {
  const [itemLightboxOpen, setItemLightboxOpen] = useState(false);

  const expandable = isDescriptionExpandable(item.description);
  const parsed = isExpanded ? parseItemDescription(item.description) : null;

  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
  const hasImages = item.images && item.images.length > 0;

  const isZoneMatch =
    highlightZone &&
    (() => {
      const ct = item.coverage_type || "geral";
      const inc: string[] = item.included_rooms || [];
      const exc: string[] = item.excluded_rooms || [];
      if (ct === "geral") return !exc.includes(highlightZone);
      return inc.includes(highlightZone);
    })();

  const itemTotal = Number(item.internal_total) || 0;
  const itemUnitPrice = Number(item.internal_unit_price) || 0;
  const itemQty = Number(item.qty) || 0;

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
      {/* Item lightbox for expanded photos */}
      <Lightbox
        images={itemImages}
        initialIndex={0}
        open={itemLightboxOpen}
        onClose={() => setItemLightboxOpen(false)}
      />

      <div
        className={cn(
          "transition-colors",
          isZoneMatch && "bg-primary/10 ring-1 ring-primary/20 rounded-lg",
          !isLast && !isExpanded && "border-b border-border/50",
          isExpanded && "border-b border-border/50 bg-muted/10 rounded-lg",
          index % 2 === 1 && !isExpanded && "bg-muted/20"
        )}
      >
        {/* ── Clickable header row ── */}
        <button
          onClick={expandable ? onToggle : undefined}
          className={cn(
            "w-full flex items-center gap-2 sm:gap-2.5 px-2 sm:px-3 py-2 sm:py-2.5 min-h-[44px] sm:min-h-[48px] text-left",
            expandable && "cursor-pointer hover:bg-muted/30 transition-colors"
          )}
          disabled={!expandable}
          type="button"
        >
          {/* Thumbnail */}
          {showImageGallery && budgetId ? (
            <div onClick={(e) => e.stopPropagation()}>
              <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />
            </div>
          ) : primaryImage ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenLightbox(primaryImage.url);
              }}
              className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-full overflow-hidden group cursor-zoom-in flex-shrink-0"
              type="button"
            >
              <img
                src={primaryImage.url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                loading="lazy"
              />
            </button>
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
              <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-primary/40" />
            </div>
          )}

          {/* Name + qty */}
          <div className="min-w-0 flex-1">
            <p className="text-xs sm:text-sm font-medium text-foreground font-body truncate leading-relaxed">
              {item.title}
            </p>
            {showItemQty && item.qty && (
              <p className="text-xs text-muted-foreground font-body">
                {item.qty} {item.unit || "un"}
              </p>
            )}
          </div>

          {/* Prices */}
          <AnimatePresence>
            {showItemPrices && itemTotal > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
                className="text-right flex-shrink-0"
              >
                <p className="text-xs sm:text-sm font-mono font-semibold text-foreground tabular-nums">
                  {formatBRL(itemTotal)}
                </p>
                {itemQty > 1 && itemUnitPrice > 0 && (
                  <p className="text-xs text-muted-foreground font-body tabular-nums">
                    ({formatBRL(itemUnitPrice)}/un)
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chevron */}
          {expandable && (
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0"
            >
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </motion.div>
          )}
        </button>

      </div>
    </>
  );
}
