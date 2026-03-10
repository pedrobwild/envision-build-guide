import { useState } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { ChevronDown, ChevronUp, Check, X, ImageIcon, ZoomIn, Info } from "lucide-react";
import { Lightbox } from "./Lightbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  const visibleItems = expanded ? items : items.slice(0, 3);

  // Collect all images for gallery navigation
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

  return (
    <>
      <Lightbox
        images={lightboxImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <div className="rounded-lg overflow-hidden border border-border bg-card shadow-sm hover:shadow-md transition-shadow">
        {/* Cover image */}
        {section.cover_image_url ? (
          <div
            className="relative h-36 sm:h-48 lg:h-56 overflow-hidden cursor-zoom-in group"
            onClick={() => openLightbox(section.cover_image_url)}
          >
            <img
              src={section.cover_image_url}
              alt={section.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 to-transparent" />
            <div className="absolute top-3 right-3 p-1.5 rounded-full bg-card/20 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <ZoomIn className="h-4 w-4" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-card">{section.title}</h2>
              {section.subtitle && (
                <p className="text-card/80 text-xs sm:text-sm mt-1 font-body">{section.subtitle}</p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative h-24 sm:h-32 bg-gradient-to-br from-muted to-accent flex items-center justify-center">
            <ImageIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground/40" />
            <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
              <h2 className="font-display text-lg sm:text-xl lg:text-2xl font-bold text-foreground">{section.title}</h2>
              {section.subtitle && (
                <p className="text-muted-foreground text-xs sm:text-sm mt-1 font-body">{section.subtitle}</p>
              )}
            </div>
          </div>
        )}

        {/* Section price badge */}
        <div className="px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border bg-accent/30 flex items-center justify-between">
          <span className="text-xs sm:text-sm text-muted-foreground font-body">
            {section.qty && section.qty > 1 ? `${section.qty}× ` : ''}Subtotal da seção
          </span>
          <span className="font-display font-bold text-base sm:text-lg text-primary">{formatBRL(subtotal)}</span>
        </div>

        {/* Items */}
        <div className="p-4 sm:p-5">
          {items.length > 0 && (
            <>
              <h3 className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 font-body">
                Itens Inclusos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {visibleItems.map((item: any) => {
                  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
                  const extraImages = (item.images || []).filter((img: any) => img !== primaryImage);
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
                      className={`flex gap-3 p-2.5 sm:p-3 rounded-lg transition-colors ${
                        isZoneMatch
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'bg-muted/30 hover:bg-muted/50'
                      }`}
                    >
                      {primaryImage ? (
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          <button
                            onClick={() => openLightbox(primaryImage.url)}
                            className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-md overflow-hidden group cursor-zoom-in"
                          >
                            <img
                              src={primaryImage.url}
                              alt={item.title}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                              <ZoomIn className="h-3.5 w-3.5 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          </button>
                          {extraImages.length > 0 && (
                            <div className="flex gap-0.5">
                              {extraImages.slice(0, 3).map((img: any, idx: number) => (
                                <button
                                  key={img.id || idx}
                                  onClick={() => openLightbox(img.url)}
                                  className="w-4 h-4 rounded-sm overflow-hidden cursor-zoom-in opacity-70 hover:opacity-100 transition-opacity"
                                >
                                  <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                </button>
                              ))}
                              {extraImages.length > 3 && (
                                <span className="w-4 h-4 rounded-sm bg-muted flex items-center justify-center text-[8px] text-muted-foreground font-body">
                                  +{extraImages.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs sm:text-sm font-medium text-foreground font-body truncate">{item.title}</p>
                          {item.description && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                                    <Info className="h-3.5 w-3.5" />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs text-xs font-body">
                                  {item.description}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {item.description && (
                          <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 line-clamp-2 font-body">{item.description}</p>
                        )}
                        {showItemQty && item.qty && (
                          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 font-body">
                            {item.qty} {item.unit || 'un'}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {items.length > 3 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="mt-3 flex items-center gap-1.5 text-xs sm:text-sm text-primary hover:text-primary/80 font-medium font-body transition-colors py-1"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Ocultar itens
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Ver todos os {items.length} itens
                    </>
                  )}
                </button>
              )}
            </>
          )}

          {/* Included/Excluded bullets */}
          {(included.length > 0 || excluded.length > 0) && (
            <div className="mt-4 sm:mt-5 pt-3 sm:pt-4 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {included.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-success uppercase tracking-wider mb-2 font-body flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" /> O que está incluso
                  </h4>
                  <ul className="space-y-1.5">
                    {included.map((b: string, i: number) => (
                      <li key={i} className="text-xs sm:text-sm text-foreground/80 font-body flex items-start gap-2">
                        <Check className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {excluded.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-2 font-body flex items-center gap-1.5">
                    <X className="h-3.5 w-3.5" /> O que não está incluso
                  </h4>
                  <ul className="space-y-1.5">
                    {excluded.map((b: string, i: number) => (
                      <li key={i} className="text-xs sm:text-sm text-foreground/60 font-body flex items-start gap-2">
                        <X className="h-3.5 w-3.5 text-destructive/60 mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Section notes */}
          {section.notes && (
            <p className="mt-3 sm:mt-4 pt-3 border-t border-border text-[11px] sm:text-xs text-muted-foreground font-body italic">
              {section.notes}
            </p>
          )}
        </div>
      </div>
    </>
  );
}
