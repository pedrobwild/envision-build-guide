import { useState, useMemo } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { ChevronDown, ChevronUp, Check, X, ZoomIn } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { ExpandableItemRow } from "./ExpandableItemRow";
import { motion, AnimatePresence } from "framer-motion";
import { getIconForSection, SECTION_ACCENT_COLORS, SECTION_ICON_BG_COLORS } from "@/lib/section-icons";
import { cn } from "@/lib/utils";
import type { ScopeCategory } from "@/lib/scope-categories";

const IMAGE_GALLERY_CATEGORIES = new Set(["marcenaria", "mobiliario", "eletro"]);
const PREVIEW_COUNT = 3;

interface SectionCardProps {
  section: any;
  compact: boolean;
  showItemQty: boolean;
  showItemPrices?: boolean;
  highlightZone?: string | null;
  sectionIndex?: number;
  categoryColor?: ScopeCategory;
  budgetId?: string;
  editable?: boolean;
}

export function SectionCard({
  section,
  compact,
  showItemQty,
  showItemPrices = false,
  highlightZone,
  sectionIndex = 0,
  categoryColor,
  budgetId,
  editable = false,
}: SectionCardProps) {
  const subtotal = calculateSectionSubtotal(section);
  const [expanded, setExpanded] = useState(false);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; alt?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const items = section.items || [];
  const included = Array.isArray(section.included_bullets) ? section.included_bullets : [];
  const excluded = Array.isArray(section.excluded_bullets) ? section.excluded_bullets : [];
  const hasCover = !!section.cover_image_url;
  const SectionIcon = getIconForSection(section.title);

  // Top items by value for preview
  const previewItems = useMemo(() => {
    if (items.length <= PREVIEW_COUNT) return items;
    const sorted = [...items].sort(
      (a: any, b: any) => (Number(b.internal_total) || 0) - (Number(a.internal_total) || 0)
    );
    return sorted.slice(0, PREVIEW_COUNT);
  }, [items]);

  const hiddenCount = items.length - PREVIEW_COUNT;

  const allImages: { url: string; alt?: string }[] = [];
  if (section.cover_image_url) {
    allImages.push({ url: section.cover_image_url, alt: section.title });
  }
  items.forEach((item: any) => {
    (item.images || []).forEach((img: any) => {
      allImages.push({ url: img.url, alt: item.title });
    });
  });

  const openLightbox = (url: string) => {
    const idx = allImages.findIndex((img) => img.url === url);
    setLightboxImages(allImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const borderColor =
    categoryColor?.borderClass ||
    SECTION_ACCENT_COLORS[sectionIndex % SECTION_ACCENT_COLORS.length];
  const iconColors = categoryColor
    ? `${categoryColor.bgClass}/10 ${categoryColor.colorClass}`
    : SECTION_ICON_BG_COLORS[sectionIndex % SECTION_ICON_BG_COLORS.length];

  // ── Render a single item row ──
  const renderItem = (item: any, i: number, isLast: boolean) => {
    const primaryImage =
      item.images?.find((img: any) => img.is_primary) || item.images?.[0];
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

    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center gap-2.5 px-2 py-2 transition-colors min-h-[44px]",
          isZoneMatch && "bg-primary/10 ring-1 ring-primary/20 rounded-lg",
          !isLast && "border-b border-border/50",
          i % 2 === 1 && "bg-muted/20"
        )}
      >
        {categoryColor && IMAGE_GALLERY_CATEGORIES.has(categoryColor.id) && budgetId ? (
          <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />
        ) : primaryImage ? (
          <button
            onClick={() => openLightbox(primaryImage.url)}
            className="relative w-8 h-8 rounded-full overflow-hidden group cursor-zoom-in flex-shrink-0"
          >
            <img
              src={primaryImage.url}
              alt={item.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
              loading="lazy"
            />
          </button>
        ) : (
          <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          </div>
        )}

        {/* Left: name + qty */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-foreground font-body truncate leading-relaxed">
              {item.title}
            </p>
            {item.description && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex-shrink-0 text-muted-foreground/50 hover:text-primary transition-colors">
                      <Info className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs font-body">
                    {item.description}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {showItemQty && item.qty && (
            <p className="text-xs text-muted-foreground font-body">
              {item.qty} {item.unit || "un"}
            </p>
          )}
        </div>

        {/* Right: prices */}
        <AnimatePresence>
          {showItemPrices && itemTotal > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.25 }}
              className="text-right flex-shrink-0"
            >
              <p className="text-sm font-mono font-semibold text-foreground tabular-nums">
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
      </div>
    );
  };

  return (
    <>
      <Lightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "rounded-xl overflow-hidden border bg-card transition-all duration-300 h-full flex flex-col",
          !hasCover && `border-l-[3px] ${borderColor} border-border`,
          hasCover && "border-border"
        )}
      >
        {/* ── Header ── */}
        {hasCover ? (
          <div
            className="relative h-28 sm:h-36 overflow-hidden cursor-zoom-in group"
            onClick={() => openLightbox(section.cover_image_url)}
          >
            <img
              src={section.cover_image_url}
              alt={section.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
            <div className="absolute top-3 right-3 p-1.5 rounded-full bg-card/20 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-3.5 w-3.5" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">
                {section.title}
              </h2>
              {section.subtitle && (
                <p className="text-white/70 text-xs mt-0.5 font-body line-clamp-1">
                  {section.subtitle}
                </p>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left px-4 pt-4 pb-0 min-h-[44px]"
          >
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
                  iconColors
                )}
              >
                <SectionIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-base sm:text-lg font-bold text-foreground leading-tight">
                  {section.title}
                </h2>
                {section.subtitle && (
                  <p className="text-muted-foreground text-xs mt-0.5 font-body line-clamp-1">
                    {section.subtitle}
                  </p>
                )}
              </div>
              <div className="flex-shrink-0 pt-1">
                {expanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </button>
        )}

        {/* ── Subtotal strip — always visible ── */}
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}
            {items.length} {items.length === 1 ? "item" : "itens"}
          </span>
          <span className="font-display font-bold text-base text-foreground tabular-nums">
            {formatBRL(subtotal)}
          </span>
        </div>

        {/* ── Preview items (collapsed) — mobile-first: show top items ── */}
        {!expanded && items.length > 0 && (
          <div className="px-4 py-2">
            {previewItems.map((item: any, i: number) => {
              const thumb = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center gap-2.5 py-2",
                    i < previewItems.length - 1 && "border-b border-border/30"
                  )}
                >
                  {/* Thumbnail or bullet */}
                  {thumb ? (
                    <img
                      src={thumb.url}
                      alt={item.title}
                      className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-border/50"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0 ml-3 mr-2.5" />
                  )}
                  <span className="text-sm font-body text-foreground flex-1 truncate">
                    {item.title}
                  </span>
                  <AnimatePresence>
                    {showItemPrices && Number(item.internal_total) > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-xs font-mono tabular-nums text-muted-foreground flex-shrink-0"
                      >
                        {formatBRL(Number(item.internal_total))}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            {hiddenCount > 0 && (
              <button
                onClick={() => setExpanded(true)}
                className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1.5 w-full justify-center min-h-[44px]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Ver todos os {items.length} itens
              </button>
            )}
          </div>
        )}

        {/* ── Full items list (expanded) ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3">
                {items.map((item: any, i: number) =>
                  renderItem(item, i, i === items.length - 1)
                )}

                {items.length > PREVIEW_COUNT && (
                  <button
                    onClick={() => setExpanded(false)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1 w-full justify-center min-h-[44px]"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Ocultar
                  </button>
                )}

                {/* Included/Excluded */}
                {(included.length > 0 || excluded.length > 0) && (
                  <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {included.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-1.5 font-body flex items-center gap-1">
                          <Check className="h-3 w-3" /> Incluso
                        </h4>
                        <ul className="space-y-1">
                          {included.map((b: string, i: number) => (
                            <li
                              key={i}
                              className="text-xs text-foreground/80 font-body flex items-start gap-1.5 leading-relaxed"
                            >
                              <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {excluded.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5 font-body flex items-center gap-1">
                          <X className="h-3 w-3" /> Não incluso
                        </h4>
                        <ul className="space-y-1">
                          {excluded.map((b: string, i: number) => (
                            <li
                              key={i}
                              className="text-xs text-foreground/60 font-body flex items-start gap-1.5 leading-relaxed"
                            >
                              <X className="h-3 w-3 text-destructive/60 mt-0.5 flex-shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {section.notes && (
                  <p className="mt-3 pt-2.5 border-t border-border text-xs text-muted-foreground font-body italic leading-relaxed">
                    {section.notes}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed: expand trigger for cover-image cards */}
        {!expanded && hasCover && items.length > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-2.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ver {items.length} {items.length === 1 ? "item" : "itens"}
          </button>
        )}
      </motion.div>
    </>
  );
}
