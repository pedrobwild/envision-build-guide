import { useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { ChevronDown, ChevronUp, Check, X, ImageIcon, ZoomIn, Info, Package } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";

interface SectionCardProps {
  section: any;
  compact: boolean;
  showItemQty: boolean;
  highlightZone?: string | null;
}

export function SectionCard({ section, compact, showItemQty, highlightZone }: SectionCardProps) {
  const [expanded, setExpanded] = useState(!compact);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; alt?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const subtotal = calculateSectionSubtotal(section);
  const items = section.items || [];
  const included = Array.isArray(section.included_bullets) ? section.included_bullets : [];
  const excluded = Array.isArray(section.excluded_bullets) ? section.excluded_bullets : [];
  const visibleItems = expanded ? items : items.slice(0, 4);

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
        className="rounded-xl overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-all duration-300"
      >
        {/* Header — compact when no cover image */}
        {hasCover ? (
          <div
            className="relative h-32 sm:h-40 overflow-hidden cursor-zoom-in group"
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
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 sm:px-5 sm:pb-4">
              <h2 className="font-display text-base sm:text-lg font-bold text-white leading-tight">{section.title}</h2>
              {section.subtitle && (
                <p className="text-white/70 text-xs mt-0.5 font-body line-clamp-1">{section.subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-0">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Package className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold text-foreground leading-tight">{section.title}</h2>
                {section.subtitle && (
                  <p className="text-muted-foreground text-xs mt-0.5 font-body line-clamp-1">{section.subtitle}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Subtotal strip */}
        <div className="px-4 sm:px-5 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-body">
            {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}Subtotal
          </span>
          <span className="font-display font-bold text-sm sm:text-base text-primary">{formatBRL(subtotal)}</span>
        </div>

        {/* Items */}
        <div className="px-4 sm:px-5 py-3 sm:py-4">
          {items.length > 0 && (
            <>
              <div className="space-y-1.5">
                {visibleItems.map((item: any, i: number) => {
                  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
                  const isZoneMatch = highlightZone && (() => {
                    const ct = item.coverage_type || "geral";
                    const inc: string[] = item.included_rooms || [];
                    const exc: string[] = item.excluded_rooms || [];
                    if (ct === "geral") return !exc.includes(highlightZone);
                    return inc.includes(highlightZone);
                  })();

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors ${
                        isZoneMatch
                          ? 'bg-primary/10 ring-1 ring-primary/20'
                          : i % 2 === 0 ? 'bg-transparent' : 'bg-muted/20'
                      }`}
                    >
                      {primaryImage ? (
                        <button
                          onClick={() => openLightbox(primaryImage.url)}
                          className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-md overflow-hidden group cursor-zoom-in flex-shrink-0"
                        >
                          <img
                            src={primaryImage.url}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                          />
                        </button>
                      ) : (
                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-md bg-muted/50 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-medium text-foreground font-body truncate">{item.title}</p>
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
                    </div>
                  );
                })}
              </div>

              {items.length > 4 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-2.5 flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors py-1 w-full justify-center"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Ocultar
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Ver todos os {items.length} itens
                    </>
                  )}
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
                      <li key={i} className="text-[11px] sm:text-xs text-foreground/80 font-body flex items-start gap-1.5">
                        <Check className="h-3 w-3 text-success mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {excluded.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1.5 font-body flex items-center gap-1">
                    <X className="h-3 w-3" /> Não incluso
                  </h4>
                  <ul className="space-y-1">
                    {excluded.map((b: string, i: number) => (
                      <li key={i} className="text-[11px] sm:text-xs text-foreground/60 font-body flex items-start gap-1.5">
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
            <p className="mt-3 pt-2.5 border-t border-border text-[10px] sm:text-[11px] text-muted-foreground font-body italic">
              {section.notes}
            </p>
          )}
        </div>
      </motion.div>
    </>
  );
}
