import { useState } from "react";
import { ZoomIn } from "lucide-react";
import { motion } from "framer-motion";
import { Lightbox } from "./Lightbox";
import { ItemImageGallery } from "./ItemImageGallery";
import type { ItemWithImages } from "@/types/budget-common";

interface ProductShowcaseCardProps {
  item: ItemWithImages;
  budgetId?: string;
  editable?: boolean;
  showGallery?: boolean;
}

export function ProductShowcaseCard({ item, budgetId, editable = false, showGallery = false }: ProductShowcaseCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const hasImages = item.images && item.images.length > 0;
  const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];

  const itemImages = (item.images || []).map((img) => ({
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
        whileTap={{ scale: 0.98 }}
        className="group rounded-xl border border-border bg-card overflow-hidden hover:border-border/80 hover:shadow-md active:shadow-sm active:border-primary/20 transition-all duration-300"
      >
        {/* Always show clean public card — single image + title */}
        <div className="flex gap-0">
          {primaryImage ? (
            <button
              onClick={() => openLightbox(0)}
              className="budget-focus relative w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 overflow-hidden cursor-zoom-in bg-muted/30 focus-visible:ring-offset-0"
              type="button"
            >
              <img
                src={primaryImage.url}
                alt={item.title}
                width={112}
                height={112}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/10 transition-colors duration-300 flex items-center justify-center">
                <ZoomIn className="h-4 w-4 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 drop-shadow-lg" />
              </div>
            </button>
          ) : (
            <div className="w-24 h-24 sm:w-28 sm:h-28 flex-shrink-0 bg-muted/20 flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-muted/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/20" />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0 p-3 sm:p-4 flex flex-col justify-center">
            <div className="flex items-start gap-2">
              <h4 className="text-sm sm:text-[15px] font-body font-semibold text-foreground leading-snug flex-1 min-w-0">
                {item.title}
              </h4>
              {item.addendum_action === "add" && (
                <span className="shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wider bg-success/10 text-success border border-success/20 uppercase">
                  Novo
                </span>
              )}
            </div>
            {item.qty && (
              <p className="text-xs text-muted-foreground font-body mt-0.5">
                Qtd: {item.qty} {item.unit || "un"}
              </p>
            )}
            {/* Admin: inline edit button */}
            {editable && budgetId && (
              <div className="mt-1.5" onClick={(e) => e.stopPropagation()}>
                <ItemImageGallery item={item} budgetId={budgetId} editable={editable} />
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
}
