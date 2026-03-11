import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ZoomIn, ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Lightbox } from "@/components/budget/Lightbox";
import useEmblaCarousel from "embla-carousel-react";
import ReactPlayer from "react-player";
import { motion } from "framer-motion";

type GalleryTab = "3d" | "exec";

const tabs = [
  { id: "3d", label: "Projeto 3D" },
  { id: "exec", label: "Projeto Executivo" },
] as const;

type MediaItem = { src: string; alt: string; type?: "video" | "image" };

const gallery: Record<GalleryTab, MediaItem[]> = {
  "3d": [
    { src: "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/videos/projeto-3d-tour.mp4", alt: "Projeto 3D — Vídeo Tour", type: "video" },
    { src: "/images/exemplo-projeto-3d-1.png", alt: "Projeto 3D — Planta humanizada" },
    { src: "/images/exemplo-projeto-3d-2.png", alt: "Projeto 3D — Sala e cozinha" },
  ],
  exec: [
    { src: "/images/exemplo-executivo-1.jpg", alt: "Projeto Executivo — Vistas modificações" },
    { src: "/images/exemplo-executivo-2.jpg", alt: "Projeto Executivo — Detalhamento banheiro" },
  ],
};

export function ProjectGallery() {
  const [activeTab, setActiveTab] = useState<GalleryTab>("3d");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "center" });
  const [currentSlide, setCurrentSlide] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrentSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    setCurrentSlide(0);
    emblaApi.reInit();
    emblaApi.scrollTo(0, true);
  }, [activeTab, emblaApi]);

  const images = gallery[activeTab];

  return (
    <>
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-3">
          <div>
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Exemplo de entrega real
            </p>
            <p className="text-xs text-muted-foreground font-body mt-0.5">
              Veja como é o resultado final de um projeto arquitetônico Bwild.
            </p>
          </div>

          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors ${
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <div ref={emblaRef} className="overflow-hidden rounded-lg">
              <div className="flex">
                {images.map((img) => (
                  <div key={img.src} className="min-w-0 shrink-0 grow-0 basis-full">
                    {img.type === "video" ? (
                      <div className="relative w-full rounded-lg overflow-hidden border border-border bg-muted aspect-[16/10]">
                        <ReactPlayer
                          src={img.src}
                          controls
                          playsInline
                          width="100%"
                          height="100%"
                          style={{ position: "absolute", top: 0, left: 0 }}
                        />
                        <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-display font-semibold text-white bg-primary/80 backdrop-blur-sm rounded px-2 py-0.5 z-10 pointer-events-none">
                          <Play className="h-3 w-3" /> Vídeo 3D
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          const imageOnly = images.filter(m => m.type !== "video");
                          const realIdx = imageOnly.findIndex(m => m.src === img.src);
                          setLightboxIndex(realIdx >= 0 ? realIdx : 0);
                          setLightboxOpen(true);
                        }}
                        className="group relative w-full rounded-lg overflow-hidden border border-border bg-muted aspect-[16/10] focus:outline-none focus:ring-2 focus:ring-primary active:scale-[0.98] transition-transform"
                      >
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/20 transition-colors flex items-center justify-center">
                          <ZoomIn className="h-5 w-5 sm:h-6 sm:w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                        </div>
                        <span className="absolute bottom-1.5 left-1.5 right-1.5 text-xs font-body text-white bg-foreground/60 backdrop-blur-sm rounded px-2 py-0.5 sm:py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                          {img.alt}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={() => emblaApi?.scrollPrev()}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card transition-colors"
                  aria-label="Anterior"
                >
                  <ChevronLeft className="h-4 w-4 text-foreground" />
                </button>
                <button
                  onClick={() => emblaApi?.scrollNext()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-card/80 backdrop-blur-sm border border-border shadow-sm hover:bg-card transition-colors"
                  aria-label="Próxima"
                >
                  <ChevronRight className="h-4 w-4 text-foreground" />
                </button>
              </>
            )}

            {images.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-2">
                {images.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => emblaApi?.scrollTo(idx)}
                    className={`h-1.5 rounded-full transition-all ${
                      idx === currentSlide
                        ? "w-4 bg-primary"
                        : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Lightbox
        images={images.filter(m => m.type !== "video").map((img) => ({ url: img.src, alt: img.alt }))}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </>
  );
}
