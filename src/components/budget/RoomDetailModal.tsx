import { useState } from "react";
import { MapPin, ImageIcon, ZoomIn } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Lightbox } from "./Lightbox";
import { motion } from "framer-motion";

import type { SectionWithItems, ItemWithImages } from "@/types/budget-common";

interface RoomDetailModalProps {
  open: boolean;
  onClose: () => void;
  roomName: string;
  sections: SectionWithItems[];
  roomId: string;
}

export function RoomDetailModal({ open, onClose, roomName, sections, roomId }: RoomDetailModalProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ url: string; alt?: string }[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Collect only LOCAL items that include this room
  const localItems: { item: ItemWithImages; sectionTitle: string }[] = [];
  sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      const ct = item.coverage_type || "geral";
      if (ct !== "geral") {
        const inc: string[] = (item.included_rooms || []) as string[];
        if (inc.includes(roomId)) {
          localItems.push({ item, sectionTitle: section.title });
        }
      }
    });
  });

  // Collect all images for gallery
  const allImages: { url: string; alt?: string }[] = [];
  localItems.forEach(({ item }) => {
    (item.images || []).forEach((img) => {
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

      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="flex items-center gap-2 font-display text-lg">
              <MapPin className="h-5 w-5 text-primary" />
              {roomName}
            </DialogTitle>
            <p className="text-xs text-muted-foreground font-body mt-1">
              {localItems.length === 0
                ? "Nenhum item específico neste ambiente"
                : `${localItems.length} ${localItems.length === 1 ? "item específico" : "itens específicos"}`}
            </p>
          </DialogHeader>

          {/* Items grouped by section */}
          <div className="px-6 py-5 space-y-5">
            {localItems.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-8">
                Este ambiente não possui itens específicos como marcenaria, box ou móveis planejados.
              </p>
            ) : (
              Object.entries(
                localItems.reduce<Record<string, { item: ItemWithImages; sectionTitle: string }[]>>((acc, entry) => {
                  (acc[entry.sectionTitle] = acc[entry.sectionTitle] || []).push(entry);
                  return acc;
                }, {})
              ).map(([sectionTitle, items], groupIdx) => (
                <motion.div
                  key={sectionTitle}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: groupIdx * 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-primary font-body">{sectionTitle}</h4>
                    <div className="flex-1 h-px bg-border/60" />
                    <span className="text-xs text-muted-foreground font-body">{items.length}</span>
                  </div>

                  <div className="space-y-3">
                    {items.map(({ item }) => {
                      const primaryImage = item.images?.find((img) => img.is_primary) || item.images?.[0];
                      const extraImages = (item.images || []).filter((img) => img !== primaryImage);

                      return (
                        <div
                          key={item.id}
                          className="flex gap-4 p-4 rounded-xl bg-muted/30 border border-border/50"
                        >
                          {primaryImage ? (
                            <button
                              onClick={() => openLightbox(primaryImage.url)}
                              className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 group cursor-zoom-in"
                            >
                              <img
                                src={primaryImage.url}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                                <ZoomIn className="h-4 w-4 text-primary-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </button>
                          ) : (
                            <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground font-body">{item.title}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground/80 mt-1.5 line-clamp-2 font-body">{item.description}</p>
                            )}

                            {extraImages.length > 0 && (
                              <div className="flex gap-1.5 mt-2">
                                {extraImages.slice(0, 4).map((img, idx) => (
                                  <button
                                    key={img.id || idx}
                                    onClick={() => openLightbox(img.url)}
                                    className="w-8 h-8 rounded-md overflow-hidden cursor-zoom-in opacity-70 hover:opacity-100 transition-opacity border border-border/50"
                                  >
                                    <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                                  </button>
                                ))}
                                {extraImages.length > 4 && (
                                  <span className="w-8 h-8 rounded-md bg-muted flex items-center justify-center text-xs text-muted-foreground font-body border border-border/50">
                                    +{extraImages.length - 4}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
