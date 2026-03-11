import { useState, useCallback, useEffect, useRef, forwardRef } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Camera, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjetoBairro } from "@/data/brooklin-projects";

interface ProjectSidebarCardProps {
  project: ProjetoBairro;
  isSelected: boolean;
  onSelect: (id: string | null) => void;
}

export const ProjectSidebarCard = forwardRef<HTMLDivElement, ProjectSidebarCardProps>(
  ({ project, isSelected, onSelect }, ref) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
    const [activeSlide, setActiveSlide] = useState(0);
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);
    const [hovering, setHovering] = useState(false);

    const onSlideChange = useCallback(() => {
      if (!emblaApi) return;
      setActiveSlide(emblaApi.selectedScrollSnap());
      setCanPrev(emblaApi.canScrollPrev());
      setCanNext(emblaApi.canScrollNext());
    }, [emblaApi]);

    useEffect(() => {
      if (!emblaApi) return;
      emblaApi.on("select", onSlideChange);
      onSlideChange();
    }, [emblaApi, onSlideChange]);

    return (
      <div
        ref={ref}
        onClick={() => onSelect(isSelected ? null : project.id)}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        className={cn(
          "bg-card rounded-xl overflow-hidden shadow-sm transition-all duration-200 cursor-pointer",
          isSelected
            ? "border-2 border-primary shadow-lg ring-2 ring-primary/10"
            : "border border-border hover:shadow-md hover:border-primary/20"
        )}
      >
        {/* Photo carousel */}
        <div className="relative aspect-video overflow-hidden" ref={emblaRef}>
          <div className="flex h-full">
            {project.fotos.map((foto, i) => (
              <div key={i} className="flex-[0_0_100%] min-w-0 relative">
                <img
                  src={foto}
                  alt={`${project.titulo} — foto ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.classList.add("fallback-active");
                  }}
                />
                <div className="fallback-bg absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center hidden">
                  <Camera className="h-8 w-8 text-muted-foreground/40" />
                </div>
              </div>
            ))}
          </div>

          {/* Dots */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {project.fotos.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === activeSlide ? "bg-white" : "bg-white/50"
                )}
              />
            ))}
          </div>

          {/* Arrows on hover */}
          {hovering && canPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
          )}
          {hovering && canNext && (
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/80 rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          )}
        </div>

        {/* Info */}
        <div className="p-3 space-y-0.5">
          <h4 className="text-base font-display font-bold text-foreground leading-tight">{project.titulo}</h4>
          <p className="text-sm text-muted-foreground font-body">
            {project.metragem} · {project.bairro}
          </p>
          <p className="text-xs text-muted-foreground font-body flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {project.cep}
          </p>
        </div>
      </div>
    );
  }
);

ProjectSidebarCard.displayName = "ProjectSidebarCard";
