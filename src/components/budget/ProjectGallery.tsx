import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ZoomIn, ChevronLeft, ChevronRight, Play, Camera, Loader2 } from "lucide-react";
import { Lightbox } from "@/components/budget/Lightbox";
import useEmblaCarousel from "embla-carousel-react";
import ReactPlayer from "react-player";
import { motion } from "framer-motion";
import { useBudgetMedia } from "@/hooks/useBudgetMedia";
import { useBudgetTours } from "@/hooks/useBudgetTours";
import { Tour3DViewer } from "@/components/budget/Tour3DViewer";

type GalleryTab = "video3d" | "fotos3d" | "fotos" | "tour3d";

type MediaItem = { src: string; alt: string; type?: "video" | "image" };

const defaultGallery: { video3d: MediaItem[]; fotos3d: MediaItem[]; fotos: MediaItem[] } = {
  video3d: [
    { src: "https://pieenhgjulsrjlioozsy.supabase.co/storage/v1/object/public/media/videos/projeto-3d-tour.mp4", alt: "Projeto 3D — Vídeo Tour", type: "video" },
  ],
  fotos3d: [
    { src: "/images/exemplo-projeto-3d-1.png", alt: "Projeto 3D — Planta humanizada" },
    { src: "/images/exemplo-projeto-3d-2.png", alt: "Projeto 3D — Sala e cozinha" },
  ],
  fotos: [
    { src: "/images/exemplo-executivo-1.jpg", alt: "Projeto Executivo — Vistas modificações" },
    { src: "/images/exemplo-executivo-2.jpg", alt: "Projeto Executivo — Detalhamento banheiro" },
  ],
};

function ImageWithFallback({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className={`bg-muted rounded-lg flex flex-col items-center justify-center gap-2 ${className}`}>
        <Camera className="h-8 w-8 text-muted-foreground/50" />
        <span className="text-xs text-muted-foreground font-body">Imagem indisponível</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

interface ProjectGalleryProps {
  publicId?: string;
}

export function ProjectGallery({ publicId }: ProjectGalleryProps) {
  const { media, loading: mediaLoading } = useBudgetMedia(publicId);
  const { rooms: tourRooms, loading: toursLoading } = useBudgetTours(publicId);

  const hasMedia = media && (media.projeto3d.length > 0 || media.projetoExecutivo.length > 0 || media.fotos.length > 0 || !!media.video3d);

  // Build available tabs based on dynamic media
  const availableTabs: { id: GalleryTab; label: string }[] = [];
  const galleryData: Record<GalleryTab, MediaItem[]> = { video3d: [], fotos3d: [], fotos: [], tour3d: [] };

  // --- Vídeo 3D tab (only the video) ---
  if (hasMedia && media!.video3d) {
    galleryData.video3d = [{ src: media!.video3d, alt: "Projeto 3D — Vídeo Tour", type: "video" }];
    availableTabs.push({ id: "video3d", label: "Vídeo 3D" });
  } else if (!hasMedia && !mediaLoading && defaultGallery.video3d.length > 0) {
    galleryData.video3d = defaultGallery.video3d;
    availableTabs.push({ id: "video3d", label: "Vídeo 3D" });
  }

  // --- Fotos 3D tab (3D renders / images, fallback to fotos) ---
  if (hasMedia) {
    const source3d = media!.projeto3d.length > 0 ? media!.projeto3d : media!.fotos;
    if (source3d.length > 0) {
      galleryData.fotos3d = source3d.map((src, i) => ({ src, alt: `Projeto 3D — ${i + 1}` }));
      availableTabs.push({ id: "fotos3d", label: "Fotos 3D" });
    }
  } else if (!hasMedia && !mediaLoading) {
    galleryData.fotos3d = defaultGallery.fotos3d;
    availableTabs.push({ id: "fotos3d", label: "Fotos 3D" });
  }

  // --- Fotos tab (photos + executivo combined) ---
  const allPhotos: MediaItem[] = [];
  if (hasMedia) {
    media!.fotos.forEach((src, i) => {
      allPhotos.push({ src, alt: `Foto da obra — ${i + 1}` });
    });
    media!.projetoExecutivo.forEach((src, i) => {
      allPhotos.push({ src, alt: `Projeto Executivo — ${i + 1}` });
    });
  }
  if (allPhotos.length > 0) {
    galleryData.fotos = allPhotos;
    availableTabs.push({ id: "fotos", label: "Fotos" });
  } else if (!hasMedia && !mediaLoading) {
    galleryData.fotos = defaultGallery.fotos;
    availableTabs.push({ id: "fotos", label: "Fotos" });
  }

  // --- Tour 3D tab ---
  if (tourRooms.length > 0) {
    availableTabs.push({ id: "tour3d", label: "Tour 3D" });
  }

  const [activeTab, setActiveTab] = useState<GalleryTab>(availableTabs[0]?.id ?? "video3d");
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

  const images = galleryData[activeTab] ?? [];

  if (mediaLoading || toursLoading) {
    return (
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border overflow-hidden">
        <CardContent className="p-4 sm:p-5 md:p-6 space-y-3">
          <div>
            <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
              Galeria do Projeto
            </p>
          </div>

          {availableTabs.length > 0 && (
            <div className="flex gap-2">
              {availableTabs.map((tab) => (
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
          )}

          {/* Preload Tour 3D hidden so iframe is warm when user switches tab */}
          {tourRooms.length > 0 && (
            <div className={activeTab === "tour3d" ? "" : "hidden"}>
              <Tour3DViewer rooms={tourRooms} />
            </div>
          )}

          {activeTab === "tour3d" ? null : (
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
                          <ImageWithFallback
                            src={img.src}
                            alt={img.alt}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
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
          )}
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
