import { useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { ChevronDown, ChevronUp, Check, X, ZoomIn, Info } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { ItemImageGallery } from "./ItemImageGallery";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { getIconForSection, SECTION_ACCENT_COLORS, SECTION_ICON_BG_COLORS } from "@/lib/section-icons";
import { cn } from "@/lib/utils";
import type { ScopeCategory } from "@/lib/scope-categories";

const IMAGE_GALLERY_CATEGORIES = new Set(["marcenaria", "mobiliario", "eletro"]);

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
const HIGH_VALUE_THRESHOLD = 10000;
const MEDIUM_VALUE_THRESHOLD = 5000;
const LOW_VALUE_THRESHOLD = 1000;

export function SectionCard({ section, compact, showItemQty, showItemPrices = false, highlightZone, sectionIndex = 0, categoryColor, budgetId, editable = false }: SectionCardProps) {
  const subtotal = calculateSectionSubtotal(section);
  const isHighValue = subtotal >= HIGH_VALUE_THRESHOLD;
  const isLarge = subtotal > MEDIUM_VALUE_THRESHOLD;
  const isSmall = subtotal < LOW_VALUE_THRESHOLD;

  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; alt?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const items = section.items || [];
  const included = Array.isArray(section.included_bullets) ? section.included_bullets : [];
  const excluded = Array.isArray(section.excluded_bullets) ? section.excluded_bullets : [];
  const maxVisible = isSmall ? items.length : (items.length > 6 ? 4 : items.length);
  const visibleItems = expanded ? items : items.slice(0, maxVisible);

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
    const idx = allImages.findIndex(img => img.url === url);
    setLightboxImages(allImages);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOpen(true);
  };

  const hasCover = !!section.cover_image_url;
  const SectionIcon = getIconForSection(section.title);

  // Use category color if provided, else fallback to rotating
  const borderColor = categoryColor?.borderClass || SECTION_ACCENT_COLORS[sectionIndex % SECTION_ACCENT_COLORS.length];
  const iconColors = categoryColor
    ? `${categoryColor.bgClass}/10 ${categoryColor.colorClass}`
    : SECTION_ICON_BG_COLORS[sectionIndex % SECTION_ICON_BG_COLORS.length];

  // Small sections: compact single-line, expandable
  if (isSmall && !hasCover) {
    return (
      <>
        <Lightbox
          images={lightboxImages}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-border bg-card overflow-hidden h-full flex flex-col"
        >
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-3 p-4 min-h-[44px] text-left"
          >
            <SectionIcon className={`h-4 w-4 flex-shrink-0 ${categoryColor?.colorClass || 'text-muted-foreground'}`} />
            <span className="text-sm font-body font-medium text-foreground flex-1 truncate">{section.title}</span>
            <span className="text-base font-mono font-semibold tabular-nums text-foreground flex-shrink-0">{formatBRL(subtotal)}</span>
            {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
          </button>
          {expanded && (
            <div className="px-4 pb-3 border-t border-border/50">
              {items.map((item: any, i: number) => (
                <div key={item.id} className={cn("flex items-center gap-2.5 py-2", i < items.length - 1 && "border-b border-border/30")}>
                  <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30 flex-shrink-0" />
                  <span className="text-sm font-body text-foreground flex-1 truncate">{item.title}</span>
                  <AnimatePresence>
                    {showItemPrices && Number(item.internal_total) > 0 && (
                      <motion.span
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-xs font-mono tabular-nums text-muted-foreground"
                      >
                        {formatBRL(Number(item.internal_total))}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </>
    );
  }

  return (
    <>
      <Lightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-40px" }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "rounded-xl overflow-hidden border bg-card transition-all duration-300 h-full flex flex-col",
          !hasCover && `border-l-[3px] ${borderColor} border-border`,
          hasCover && "border-border"
        )}
      >
        {/* Header — with cover image */}
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
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg sm:text-xl font-bold text-white leading-tight">{section.title}</h2>
                {isHighValue && (
                    <span className="text-xs font-body font-medium bg-white/20 text-white rounded-full px-2 py-0.5 backdrop-blur-sm">
                      Principal
                    </span>
                )}
              </div>
              {section.subtitle && (
                <p className="text-white/70 text-xs mt-0.5 font-body line-clamp-1">{section.subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left px-4 pt-4 pb-0 min-h-[44px]"
          >
            <div className="flex items-start gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", iconColors)}>
                <SectionIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-base sm:text-lg font-bold text-foreground leading-tight">{section.title}</h2>
                  {isHighValue && (
                    <span className={cn(
                      "text-xs font-body font-medium rounded-full px-2 py-0.5",
                      categoryColor ? `${categoryColor.bgClass}/10 ${categoryColor.colorClass}` : "bg-primary/10 text-primary"
                    )}>
                      Principal
                    </span>
                  )}
                </div>
                {section.subtitle && (
                  <p className="text-muted-foreground text-xs mt-0.5 font-body line-clamp-1">{section.subtitle}</p>
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

        {/* Subtotal strip */}
        <div className="px-4 py-2 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}Subtotal
          </span>
          <span className="font-display font-bold text-base text-foreground tabular-nums">{formatBRL(subtotal)}</span>
        </div>

        {/* Items — collapsible */}
        {expanded && (
          <div className="px-4 py-3">
            {items.length > 0 && (
              <>
                <div>
                  {visibleItems.map((item: any, i: number) => {
                    const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
                    const isZoneMatch = highlightZone && (() => {
                      const ct = item.coverage_type || "geral";
                      const inc: string[] = item.included_rooms || [];
                      const exc: string[] = item.excluded_rooms || [];
                      if (ct === "geral") return !exc.includes(highlightZone);
                      return inc.includes(highlightZone);
                    })();

                    const itemTotal = Number(item.internal_total) || 0;
                    const itemUnitPrice = Number(item.internal_unit_price) || 0;
                    const itemQty = Number(item.qty) || 0;
                    const isLastItem = i === visibleItems.length - 1;

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-2.5 px-2 py-2 transition-colors min-h-[44px]",
                          isZoneMatch && "bg-primary/10 ring-1 ring-primary/20 rounded-lg",
                          !isLastItem && "border-b border-border/50",
                          i % 2 === 1 && "bg-muted/20"
                        )}
                      >
                        {primaryImage ? (
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
                            <p className="text-sm font-medium text-foreground font-body truncate leading-relaxed">{item.title}</p>
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
                              {item.qty} {item.unit || 'un'}
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
                  })}
                </div>

                {items.length > maxVisible && !expanded && (
                  <button
                    onClick={() => setExpanded(true)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1 w-full justify-center min-h-[44px]"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Ver todos os {items.length} itens
                  </button>
                )}

                {expanded && items.length > 4 && (
                  <button
                    onClick={() => setExpanded(false)}
                    className="mt-2 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1 w-full justify-center min-h-[44px]"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    Ocultar
                  </button>
                )}
              </>
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
                        <li key={i} className="text-xs text-foreground/80 font-body flex items-start gap-1.5 leading-relaxed">
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
                        <li key={i} className="text-xs text-foreground/60 font-body flex items-start gap-1.5 leading-relaxed">
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
        )}

        {/* Collapsed summary */}
        {!expanded && !hasCover && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-4 py-2.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors flex items-center justify-center gap-1.5 min-h-[44px]"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            Ver {items.length} {items.length === 1 ? 'item' : 'itens'}
          </button>
        )}
      </motion.div>
    </>
  );
}
