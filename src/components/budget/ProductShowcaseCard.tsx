import { useState } from "react";
import { ZoomIn, Camera, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { parseItemDescription, isDescriptionExpandable } from "@/lib/parse-item-description";
import { Lightbox } from "./Lightbox";
import { ItemImageGallery } from "./ItemImageGallery";

interface ProductShowcaseCardProps {
  item: any;
  budgetId?: string;
  editable?: boolean;
  showGallery?: boolean;
}

export function ProductShowcaseCard({ item, budgetId, editable = false, showGallery = false }: ProductShowcaseCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const expandable = isDescriptionExpandable(item.description);
  const parsed = expanded ? parseItemDescription(item.description) : null;
  const hasImages = item.images && item.images.length > 0;
  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];

  const shortDesc =
    !expandable && item.description && item.description.trim().length > 0
      ? item.description.trim()
      : null;

  const itemImages = (item.images || []).map((img: any) => ({
    url: img.url,
    alt: item.title,
  }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <>
      <Lightbox
        images={itemImages}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="group rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 hover:shadow-md transition-all duration-300"
      >
        <div className="flex gap-0">
          {/* Product image — large and zoomable */}
          {showGallery && budgetId ? (
            <div className="flex-shrink-0 p-3 sm:p-4" onClick={(e) => e.stopPropagation()}>
              <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />
            </div>
          ) : primaryImage ? (
            <button
              onClick={() => openLightbox(0)}
              className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 overflow-hidden cursor-zoom-in bg-muted/30"
              type="button"
            >
              <img
                src={primaryImage.url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
              </div>
              {hasImages && item.images.length > 1 && (
                <span className="absolute bottom-1 right-1 bg-foreground/70 text-background text-[10px] px-1.5 py-0.5 rounded-md font-mono backdrop-blur-sm">
                  +{item.images.length - 1}
                </span>
              )}
            </button>
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 bg-muted/20 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
              </div>
            </div>
          )}

          {/* Product info */}
          <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-center">
            <h4 className="text-sm sm:text-[15px] font-body font-semibold text-foreground leading-snug">
              {item.title}
            </h4>

            {item.qty && (
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                {item.qty} {item.unit || "un"}
              </p>
            )}

            {shortDesc && (
              <p className="text-xs text-muted-foreground/80 font-body mt-1 leading-relaxed line-clamp-2">
                {shortDesc}
              </p>
            )}

            {/* Actions row */}
            <div className="flex items-center gap-3 mt-2">
              {hasImages && item.images.length > 1 && (
                <button
                  onClick={(e) => { e.stopPropagation(); openLightbox(0); }}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium font-body transition-colors"
                  type="button"
                >
                  <Camera className="h-3 w-3" />
                  {item.images.length} fotos
                </button>
              )}

              {expandable && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium font-body transition-colors"
                  type="button"
                >
                  <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronDown className="h-3 w-3" />
                  </motion.div>
                  {expanded ? "Menos" : "Detalhes"}
                </button>
              )}
            </div>
          </div>
        </div>

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
              <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-2.5">
                {parsed.map((group, gi) => (
                  <div key={gi}>
                    {group.room && (
                      <p className="text-sm font-semibold text-foreground font-body mb-1">{group.room}</p>
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
