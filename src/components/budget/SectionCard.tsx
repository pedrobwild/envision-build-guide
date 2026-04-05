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
  const stableItems = useMemo(() => section.stableItems || [], [section.stableItems]);

  // Auto-expand section when any item has media attached
  const hasItemMedia = useMemo(() => {
    return stableItems.some((item) => item.images && item.images.length > 0);
  }, [stableItems]);

  const [expanded, setExpanded] = useState(hasItemMedia);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; alt?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const included = Array.isArray(section.included_bullets) ? section.included_bullets : [];
  const excluded = Array.isArray(section.excluded_bullets) ? section.excluded_bullets : [];
  const hasCover = !!section.cover_image_url;
  const SectionIcon = getIconForSection(section.title);

  // Top stableItems by value for preview
  const previewItems = useMemo(() => {
    if (stableItems.length <= PREVIEW_COUNT) return stableItems;
    const sorted = [...stableItems].sort(
      (a, b) => (Number(b.internal_total) || 0) - (Number(a.internal_total) || 0)
    );
    return sorted.slice(0, PREVIEW_COUNT);
  }, [stableItems]);

  const hiddenCount = stableItems.length - PREVIEW_COUNT;

  const allImages: { url: string; alt?: string }[] = [];
  if (section.cover_image_url) {
    allImages.push({ url: section.cover_image_url, alt: section.title });
  }
  stableItems.forEach((item: any) => {
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

  const showGallery = true;

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
            <div className="absolute top-3 right-3 p-1.5 rounded-full bg-card/20 backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-label="Ampliar imagem">
              <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
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
            className="w-full text-left px-3 sm:px-4 pt-3 sm:pt-4 pb-0 min-h-[44px]"
          >
            <div className="flex stableItems-start gap-2.5 sm:gap-3">
              <div
                className={cn(
                  "w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex stableItems-center justify-center flex-shrink-0",
                  iconColors
                )}
              >
                <SectionIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-sm sm:text-base lg:text-lg font-bold text-foreground leading-tight">
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
                  <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
              </div>
            </div>
          </button>
        )}

        {/* ── Subtotal strip — always visible ── */}
        <div className="px-3 sm:px-4 py-1.5 sm:py-2 border-b border-border bg-muted/30 flex stableItems-center justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}
            {stableItems.length} {stableItems.length === 1 ? "item" : "itens"}
          </span>
          {showItemPrices && (
            <span className="font-display font-bold text-base text-foreground tabular-nums">
              {formatBRL(subtotal)}
            </span>
          )}
        </div>

        {/* ── Preview stableItems (collapsed) — mobile-first: show top stableItems ── */}
        {!expanded && stableItems.length > 0 && (
          <div className="px-3 sm:px-4 py-1.5 sm:py-2">
            {previewItems.map((item: any, i: number) => {
              const thumb = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
              return (
                <div
                  key={item.id}
                  className={cn(
                    "flex stableItems-center gap-2 sm:gap-2.5 py-1.5 sm:py-2",
                    i < previewItems.length - 1 && "border-b border-border/30"
                  )}
                >
                  {thumb ? (
                    <img
                      src={thumb.url}
                      alt={item.title}
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg object-cover flex-shrink-0 border border-border/50"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0 ml-2.5 sm:ml-3 mr-2 sm:mr-2.5" />
                  )}
                  <span className="text-xs sm:text-sm font-body text-foreground flex-1 truncate">
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
                className="mt-1 flex stableItems-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1.5 w-full justify-center min-h-[44px]"
              >
                <ChevronDown className="h-3.5 w-3.5" />
                Ver todos os {stableItems.length} itens
              </button>
            )}
          </div>
        )}

        {/* ── Full stableItems list (expanded) ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="px-3 sm:px-4 py-2.5 sm:py-3">
                {stableItems.map((item: any, i: number) => (
                  <ExpandableItemRow
                    key={item.id}
                    item={item}
                    index={i}
                    isLast={i === stableItems.length - 1}
                    isExpanded={expandedItemId === item.id}
                    onToggle={() => setExpandedItemId(prev => prev === item.id ? null : item.id)}
                    showItemQty={showItemQty}
                    showItemPrices={showItemPrices}
                    highlightZone={highlightZone}
                    showImageGallery={showGallery}
                    budgetId={budgetId}
                    editable={editable}
                    onOpenLightbox={openLightbox}
                  />
                ))}

                {stableItems.length > PREVIEW_COUNT && (
                  <button
                    onClick={() => setExpanded(false)}
                    className="mt-2 flex stableItems-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1 w-full justify-center min-h-[44px]"
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
                        <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-1.5 font-body flex stableItems-center gap-1">
                          <Check className="h-3 w-3" /> Incluso
                        </h4>
                        <ul className="space-y-1">
                          {included.map((b: string, i: number) => (
                            <li
                              key={i}
                              className="text-xs text-foreground/80 font-body flex stableItems-start gap-1.5 leading-relaxed"
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
                        <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5 font-body flex stableItems-center gap-1">
                          <X className="h-3 w-3" /> Não incluso
                        </h4>
                        <ul className="space-y-1">
                          {excluded.map((b: string, i: number) => (
                            <li
                              key={i}
                              className="text-xs text-foreground/60 font-body flex stableItems-start gap-1.5 leading-relaxed"
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
        {!expanded && hasCover && stableItems.length > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-2.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors flex stableItems-center justify-center gap-1.5 min-h-[44px]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ver {stableItems.length} {stableItems.length === 1 ? "item" : "itens"}
          </button>
        )}
      </motion.div>
    </>
  );
}
