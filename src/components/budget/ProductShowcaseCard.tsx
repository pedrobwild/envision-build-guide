import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { motion } from "framer-motion";
import { Lightbox } from "./Lightbox";
import { ItemImageGallery } from "./ItemImageGallery";

interface ProductShowcaseCardProps {
  item: any;
  budgetId?: string;
  editable?: boolean;
  showGallery?: boolean;
}

export function ProductShowcaseCard({ item, budgetId, editable = false, showGallery = false }: ProductShowcaseCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const hasImages = item.images && item.images.length > 0;
  const primaryImage = item.images?.find((img: any) => img.is_primary) || item.images?.[0];

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
              className="relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden cursor-zoom-in bg-muted/30"
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
            <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-muted/20 flex items-center justify-center">
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
                Qtd: {item.qty} {item.unit || "un"}
              </p>
            )}
          </div>
        </div>

      </motion.div>
    </>
  );
}
