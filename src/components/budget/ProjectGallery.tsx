import { useState, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ZoomIn, ChevronLeft, ChevronRight, Play, Loader2 } from "lucide-react";
import { Lightbox } from "@/components/budget/Lightbox";
import useEmblaCarousel from "embla-carousel-react";
import { motion } from "framer-motion";
import { useBudgetMedia } from "@/hooks/useBudgetMedia";
import { useBudgetTours } from "@/hooks/useBudgetTours";
import { Tour3DViewer } from "@/components/budget/Tour3DViewer";
import { ImageWithRetry } from "@/components/budget/ImageWithRetry";

type GalleryTab = "video3d" | "fotos3d" | "fotos" | "tour3d";

type MediaItem = { src: string; alt: string; type?: "video" | "image" };

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

const defaultGallery: { video3d: MediaItem[]; fotos3d: MediaItem[]; fotos: MediaItem[] } = {
  video3d: [
    { src: `${SUPABASE_URL}/storage/v1/object/public/media/videos/projeto-3d-tour.mp4`, alt: "Projeto 3D — Vídeo Tour", type: "video" },
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

// `ImageWithFallback` foi substituído pelo `ImageWithRetry` compartilhado,
// que oferece o mesmo placeholder visual + um botão "Tentar novamente"
// para casos em que o asset falha (ex.: bucket privado, CDN purgada).
/** Native video player with auto-fullscreen on play */
function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  const handlePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      // Try native video fullscreen first (works best on iOS)
      const videoEl = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
      const container = containerRef.current as HTMLElement & { webkitRequestFullscreen?: () => void } | null;
      if (videoEl.webkitEnterFullscreen) {
        await video.play();
        videoEl.webkitEnterFullscreen();
      } else if (container?.requestFullscreen) {
        await container.requestFullscreen();
        await video.play();
      } else if (container?.webkitRequestFullscreen) {
        container.webkitRequestFullscreen();
        await video.play();
      } else {
        // Fallback: just play inline
        await video.play();
      }
      setPlaying(true);
    } catch {
      // Autoplay blocked — still try to play
      try { await video.play(); } catch { /* noop */ }
      setPlaying(true);
    }
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full rounded-lg overflow-hidden border border-border bg-muted aspect-[16/10]"
    >
      <video
        ref={videoRef}
        src={src}
        controls={playing}
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
        onEnded={() => setPlaying(false)}
      />
      {!playing && (
        <button
          onClick={handlePlay}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/30 hover:bg-black/20 transition-colors cursor-pointer group"
          aria-label="Reproduzir vídeo em tela cheia"
        >
          <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
            <Play className="h-6 w-6 text-foreground fill-foreground ml-0.5" />
          </div>
          <span className="mt-2 text-xs font-body font-medium text-white/90">Vídeo 3D</span>
        </button>
      )}
      {playing && (
        <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-display font-semibold text-white bg-primary/80 backdrop-blur-sm rounded px-2 py-0.5 z-10 pointer-events-none">
          <Play className="h-3 w-3" /> Vídeo 3D
        </span>
      )}
    </div>
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

  // --- Vídeo 3D tab (only if a real video was uploaded) ---
  if (media?.video3d) {
    galleryData.video3d = [{ src: media.video3d, alt: "Projeto 3D — Vídeo Tour", type: "video" }];
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

  // --- Fotos tab (photos + executivo combined) — hidden if Fotos 3D already exists ---
  const hasFotos3dTab = availableTabs.some(t => t.id === "fotos3d");
  if (!hasFotos3dTab) {
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
  }

  // --- Tour 3D tab ---
  if (tourRooms.length > 0) {
    availableTabs.push({ id: "tour3d", label: "Tour 3D" });
  }

  const defaultTab = availableTabs.find(t => t.id === "fotos3d")?.id ?? availableTabs[0]?.id ?? "video3d";
  const [activeTab, setActiveTab] = useState<GalleryTab>(defaultTab);
  // Marca se o usuário já interagiu manualmente com as abas — assim que ele
  // escolhe uma aba, paramos de "auto-corrigir" para Fotos 3D.
  const userPickedTabRef = useRef(false);

  // Sync activeTab quando as abas disponíveis mudam (carga assíncrona da mídia).
  // Regra: se o usuário ainda não escolheu manualmente, sempre priorizamos
  // a aba "Fotos 3D" assim que ela ficar disponível, garantindo que a
  // galeria abra na posição correta independente da ordem de carregamento.
  useEffect(() => {
    if (availableTabs.length === 0) return;

    const stillExists = availableTabs.some(t => t.id === activeTab);
    const fotos3dAvailable = availableTabs.some(t => t.id === "fotos3d");

    if (!stillExists) {
      setActiveTab(defaultTab);
      return;
    }

    if (!userPickedTabRef.current && fotos3dAvailable && activeTab !== "fotos3d") {
      setActiveTab("fotos3d");
    }
  }, [availableTabs.length, defaultTab, activeTab]);

  const handleTabClick = useCallback((tabId: GalleryTab) => {
    userPickedTabRef.current = true;
    setActiveTab(tabId);
  }, []);
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
                  onClick={() => handleTabClick(tab.id)}
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
                        <VideoPlayer src={img.src} />
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
