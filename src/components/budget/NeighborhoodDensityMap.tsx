import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, ArrowLeft, MessageCircle, ChevronLeft, ChevronRight, Camera, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { getIndividualProjects, type IndividualProject } from "@/data/brooklin-projects";

/* ── Data ── */
type Neighborhood = {
  id: string;
  name: string;
  count: number;
  avgSqm: number | null;
  lat: number;
  lng: number;
};

const NEIGHBORHOOD_DATA: Neighborhood[] = [
  { id: "brooklin", name: "Brooklin", count: 17, avgSqm: 25.7, lat: -23.6273, lng: -46.6957 },
  { id: "pinheiros", name: "Pinheiros", count: 11, avgSqm: 26.6, lat: -23.5614, lng: -46.6845 },
  { id: "perdizes", name: "Perdizes", count: 8, avgSqm: 28.0, lat: -23.5352, lng: -46.6698 },
  { id: "vila-clementino", name: "Vila Clementino", count: 6, avgSqm: 25.3, lat: -23.6069, lng: -46.6389 },
  { id: "santo-amaro", name: "Santo Amaro", count: 6, avgSqm: 26.8, lat: -23.6536, lng: -46.7108 },
  { id: "campo-belo", name: "Campo Belo", count: 5, avgSqm: 25.2, lat: -23.6163, lng: -46.6691 },
  { id: "butanta", name: "Butantã", count: 5, avgSqm: 26.2, lat: -23.5718, lng: -46.7302 },
  { id: "vila-madalena", name: "Vila Madalena", count: 3, avgSqm: 26.3, lat: -23.5541, lng: -46.6916 },
  { id: "bela-vista", name: "Bela Vista", count: 3, avgSqm: 24.0, lat: -23.5594, lng: -46.6431 },
  { id: "vila-nova-conceicao", name: "Vila Nova Conceição", count: 2, avgSqm: 25.0, lat: -23.5962, lng: -46.6735 },
  { id: "chacara-klabin", name: "Chácara Klabin", count: 2, avgSqm: 23.0, lat: -23.5881, lng: -46.6344 },
  { id: "liberdade", name: "Liberdade", count: 2, avgSqm: 26.0, lat: -23.5599, lng: -46.6378 },
  { id: "jardim-paulista", name: "Jardim Paulista", count: 4, avgSqm: 31.0, lat: -23.5701, lng: -46.6659 },
  { id: "vila-mariana", name: "Vila Mariana", count: 2, avgSqm: 25.5, lat: -23.5887, lng: -46.6388 },
  { id: "vila-olimpia", name: "Vila Olímpia", count: 2, avgSqm: 26.5, lat: -23.5956, lng: -46.6858 },
  { id: "consolacao", name: "Consolação", count: 5, avgSqm: 24.5, lat: -23.5518, lng: -46.6569 },
  { id: "paraiso", name: "Paraíso", count: 2, avgSqm: 24.0, lat: -23.5726, lng: -46.6421 },
  { id: "itaim", name: "Itaim Bibi", count: 5, avgSqm: 33.0, lat: -23.5858, lng: -46.6784 },
  { id: "ipiranga", name: "Ipiranga", count: 1, avgSqm: 28.0, lat: -23.5896, lng: -46.6079 },
  { id: "cerqueira-cesar", name: "Cerqueira César", count: 4, avgSqm: 27.0, lat: -23.5570, lng: -46.6617 },
  { id: "pompeia", name: "Pompeia", count: 1, avgSqm: null, lat: -23.5360, lng: -46.6760 },
  { id: "sumarezinho", name: "Sumarezinho", count: 1, avgSqm: null, lat: -23.5449, lng: -46.6831 },
  { id: "vila-guilhermina", name: "Vila Guilhermina", count: 1, avgSqm: null, lat: -23.5274, lng: -46.5580 },
];

const TOTAL_PROJECTS = 124;
const TOTAL_NEIGHBORHOODS = 26;

const TOP_5 = [
  { name: "Brooklin", id: "brooklin", count: 17 },
  { name: "Pinheiros", id: "pinheiros", count: 11 },
  { name: "Perdizes", id: "perdizes", count: 8 },
  { name: "Vila Clementino", id: "vila-clementino", count: 6 },
  { name: "Santo Amaro", id: "santo-amaro", count: 6 },
];

function getPinStyle(count: number) {
  if (count >= 8) return { bg: "#004c7f", size: 48, mobileSize: 40, shadow: "0 3px 12px rgba(0,76,127,0.5)", fontSize: 14, showLabel: true };
  if (count >= 3) return { bg: "#366478", size: 38, mobileSize: 32, shadow: "0 2px 8px rgba(54,100,120,0.4)", fontSize: 12, showLabel: true };
  return { bg: "#243d58", size: 28, mobileSize: 24, shadow: "0 1px 4px rgba(36,61,88,0.3)", fontSize: 11, showLabel: false };
}

const DEFAULT_CENTER: [number, number] = [-46.6679, -23.5874];
const DEFAULT_ZOOM = 11.5;
const MAPTILER_STYLE = "https://api.maptiler.com/maps/streets-v2/style.json";
const FALLBACK_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const SECONDARY_FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
const STYLE_LOAD_TIMEOUT_MS = 8000;

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

/* ── Component ── */
interface NeighborhoodDensityMapProps {
  clientNeighborhood?: string;
}

export function NeighborhoodDensityMap({ clientNeighborhood }: NeighborhoodDensityMapProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const autoSelectedRef = useRef(false);
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
  const styleCandidates = useMemo(
    () =>
      [apiKey ? `${MAPTILER_STYLE}?key=${apiKey}` : null, FALLBACK_STYLE, SECONDARY_FALLBACK_STYLE]
        .filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index),
    [apiKey]
  );

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const selectedData = NEIGHBORHOOD_DATA.find((n) => n.id === selected) || null;

  const handleSelect = useCallback((id: string | null) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

  // Auto-select client neighborhood on mount
  useEffect(() => {
    if (!mapLoaded || !clientNeighborhood || autoSelectedRef.current) return;
    const match = NEIGHBORHOOD_DATA.find((n) => normalize(n.name) === normalize(clientNeighborhood));
    if (match) {
      autoSelectedRef.current = true;
      setTimeout(() => handleSelect(match.id), 800);
    }
  }, [mapLoaded, clientNeighborhood, handleSelect]);

  // Sync map with selection
  useEffect(() => {
    if (!mapRef.current) return;
    if (selected) {
      const n = NEIGHBORHOOD_DATA.find((d) => d.id === selected);
      if (n) mapRef.current.flyTo({ center: [n.lng, n.lat], zoom: 14, duration: 800 });
    } else {
      mapRef.current.flyTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, duration: 600 });
    }

    // Update marker styles
    markersRef.current.forEach((entry, id) => {
      const isActive = id === selected;
      const count = NEIGHBORHOOD_DATA.find((d) => d.id === id)!.count;
      const style = getPinStyle(count);
      const sz = isMobile ? style.mobileSize : style.size;
      entry.el.style.width = `${isActive ? sz + 6 : sz}px`;
      entry.el.style.height = `${isActive ? sz + 6 : sz}px`;
      entry.el.style.boxShadow = isActive
        ? `0 0 0 4px rgba(0,76,127,0.35), ${style.shadow}`
        : style.shadow;
      entry.el.style.transform = isActive ? "scale(1.12)" : "scale(1)";
      entry.el.style.borderWidth = isActive ? "3px" : "2px";
    });

    if (selected && isMobile && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected, isMobile]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;

    let map: maplibregl.Map | null = null;
    let disposed = false;
    let styleIndex = 0;
    let styleLoadTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearStyleLoadTimeout = () => {
      if (styleLoadTimeout) {
        clearTimeout(styleLoadTimeout);
        styleLoadTimeout = null;
      }
    };

    const safeResize = () => map?.resize();

    const clearMarkers = () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
    };

    const renderMarkers = () => {
      if (!map) return;
      clearMarkers();

      const mobile = window.innerWidth < 768;
      NEIGHBORHOOD_DATA.forEach((n) => {
        const style = getPinStyle(n.count);
        const sz = mobile ? style.mobileSize : style.size;

        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;";

        const el = document.createElement("div");
        el.style.cssText = `
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${style.bg};display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:${style.fontSize}px;
          cursor:pointer;transition:transform 150ms, box-shadow 150ms;
          box-shadow:${style.shadow};
          font-family:'SF Mono','Fira Code',ui-monospace,monospace;
          border:2px solid rgba(255,255,255,0.8);
        `;
        el.textContent = String(n.count);

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.12)";
        });

        el.addEventListener("mouseleave", () => {
          el.style.transform = "scale(1)";
        });

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSelect(n.id);
        });

        wrapper.appendChild(el);

        if (style.showLabel) {
          const labelEl = document.createElement("div");
          labelEl.style.cssText = `
            font-size:10px;font-weight:600;color:#004c7f;
            white-space:nowrap;font-family:var(--font-body,'Inter',sans-serif);
            text-shadow:0 0 3px white,0 0 3px white,0 0 3px white;
            pointer-events:none;
          `;
          labelEl.textContent = n.name;
          wrapper.appendChild(labelEl);
        }

        const marker = new maplibregl.Marker({ element: wrapper, anchor: "center" })
          .setLngLat([n.lng, n.lat])
          .addTo(map);

        markersRef.current.set(n.id, { marker, el });
      });
    };

    const setStyleByIndex = (nextIndex: number) => {
      if (!map) return false;
      if (nextIndex < 0 || nextIndex >= styleCandidates.length) return false;

      styleIndex = nextIndex;
      clearStyleLoadTimeout();
      styleLoadTimeout = setTimeout(() => {
        const switched = setStyleByIndex(styleIndex + 1);
        if (!switched && !disposed) {
          setMapLoaded(false);
          setMapFailed(true);
          clearMarkers();
        }
      }, STYLE_LOAD_TIMEOUT_MS);

      map.setStyle(styleCandidates[styleIndex]);
      return true;
    };

    try {
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: styleCandidates[0],
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        pitch: 0,
        bearing: 0,
        minZoom: 10,
        maxZoom: 16,
        maxBounds: [[-47.0, -23.85], [-46.3, -23.35]],
      });
    } catch {
      setMapLoaded(false);
      setMapFailed(true);
      return;
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    styleLoadTimeout = setTimeout(() => {
      const switched = setStyleByIndex(styleIndex + 1);
      if (!switched && !disposed) {
        setMapLoaded(false);
        setMapFailed(true);
        clearMarkers();
      }
    }, STYLE_LOAD_TIMEOUT_MS);

    map.on("style.load", () => {
      clearStyleLoadTimeout();
      setMapFailed(false);
      setMapLoaded(true);
      renderMarkers();
      requestAnimationFrame(() => safeResize());
    });

    map.on("error", (event: any) => {
      const message = String(event?.error?.message ?? "").toLowerCase();
      const isStyleError =
        message.includes("style") ||
        message.includes("maptiler") ||
        message.includes("401") ||
        message.includes("403") ||
        message.includes("failed to fetch") ||
        message.includes("networkerror");

      if (!isStyleError || disposed) return;

      const switched = setStyleByIndex(styleIndex + 1);
      if (!switched) {
        clearStyleLoadTimeout();
        setMapLoaded(false);
        setMapFailed(true);
        clearMarkers();
      }
    });

    map.on("webglcontextlost", () => {
      setMapLoaded(false);
      setMapFailed(true);
      clearMarkers();
    });

    const resizeObserver = new ResizeObserver(() => safeResize());
    resizeObserver.observe(mapContainer.current);
    window.addEventListener("resize", safeResize, { passive: true });
    window.addEventListener("orientationchange", safeResize, { passive: true });

    mapRef.current = map;

    return () => {
      disposed = true;
      clearStyleLoadTimeout();
      resizeObserver.disconnect();
      window.removeEventListener("resize", safeResize);
      window.removeEventListener("orientationchange", safeResize);
      clearMarkers();
      map?.remove();
      mapRef.current = null;
    };
  }, [handleSelect, styleCandidates]);

  const whatsappUrl = selectedData
    ? `https://wa.me/5511911906183?text=${encodeURIComponent(`Olá! Tenho um imóvel no ${selectedData.name} e gostaria de um orçamento.`)}`
    : "#";

  return (
    <div className="py-12 lg:py-16" data-pdf-hide>
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          124 projetos realizados pela Bwild em São Paulo
        </h2>
        <p className="text-muted-foreground text-sm mt-1 font-body">
          Estamos presentes em mais de {TOTAL_NEIGHBORHOODS} bairros na região metropolitana
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-[3] min-w-0">
          {!mapFailed ? (
            <div
              ref={mapContainer}
              className="w-full h-[280px] md:h-[600px] rounded-xl overflow-hidden border border-border"
              aria-label="Mapa de densidade por bairro"
            />
          ) : (
            <MapFallback height={isMobile ? "280px" : "600px"} />
          )}
        </div>
        <div className="flex-[2] md:max-h-[600px] overflow-y-auto" ref={panelRef}>
          {selectedData ? (
            <NeighborhoodDetail data={selectedData} onBack={() => setSelected(null)} whatsappUrl={whatsappUrl} />
          ) : (
            <SummaryPanel onSelectNeighborhood={handleSelect} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function MapFallback({ height }: { height: string }) {
  return (
    <div className="bg-muted rounded-xl flex flex-col items-center justify-center gap-3" style={{ height }}>
      <MapPin className="h-12 w-12 text-muted-foreground/30" />
      <span className="text-sm text-muted-foreground font-body">Mapa indisponível</span>
    </div>
  );
}

function SummaryPanel({ onSelectNeighborhood }: { onSelectNeighborhood: (id: string) => void }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 h-full flex flex-col">
      <p className="text-lg font-display font-bold text-foreground mb-4">🏙️ Presença em SP</p>

      <div className="flex gap-6 mb-4">
        <div>
          <span className="font-mono text-3xl font-bold text-primary">{TOTAL_PROJECTS}</span>
          <p className="text-sm text-muted-foreground font-body">projetos entregues</p>
        </div>
        <div>
          <span className="font-mono text-3xl font-bold text-primary">{TOTAL_NEIGHBORHOODS}</span>
          <p className="text-sm text-muted-foreground font-body">bairros atendidos</p>
        </div>
      </div>

      <div className="mt-1 pt-5 border-t border-border">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Bairros mais ativos
        </p>
        {TOP_5.map((b, i) => (
          <button
            key={b.id}
            onClick={() => onSelectNeighborhood(b.id)}
            className="w-full flex items-center justify-between py-2 px-2 -mx-0 hover:bg-muted rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono w-4">{i + 1}</span>
              <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                {b.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div
                className="h-1.5 rounded-full bg-primary/20"
                style={{ width: `${(b.count / 17) * 56}px` }}
              />
              <span className="text-xs font-mono font-semibold text-primary w-8 text-right">
                {b.count}
              </span>
            </div>
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground font-body mt-auto pt-4 text-center">
        Clique em um bairro no mapa para ver detalhes
      </p>
    </div>
  );
}

function NeighborhoodDetail({
  data,
  onBack,
}: {
  data: Neighborhood;
  onBack: () => void;
}) {
  const projects = getIndividualProjects(data.name);

  return (
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body transition-colors min-h-[44px] self-start"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <div>
        <h3 className="text-xl font-display font-bold text-foreground">{data.name}</h3>
        <Badge className="mt-1 bg-primary text-primary-foreground text-xs">
          {data.count} {data.count === 1 ? "projeto entregue" : "projetos entregues"}
        </Badge>
      </div>

      {/* Individual project cards */}
      {projects.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-border">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Empreendimentos
          </p>
          {projects.map((proj) => (
            <IndividualProjectCard key={proj.id} project={proj} />
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground font-body leading-relaxed">
        Já entregamos {data.count} {data.count === 1 ? "studio reformado" : "studios reformados"} no{" "}
        {data.name}, um dos bairros com maior demanda de short stay em SP.
      </p>
    </div>
  );
}

/* ── Individual Project Card with Carousel ── */
function IndividualProjectCard({ project }: { project: IndividualProject }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [activeSlide, setActiveSlide] = useState(0);
  const [hovering, setHovering] = useState(false);

  const onSlideChange = useCallback(() => {
    if (!emblaApi) return;
    setActiveSlide(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSlideChange);
    onSlideChange();
  }, [emblaApi, onSlideChange]);

  return (
    <div
      className="rounded-xl border border-border overflow-hidden bg-card"
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      {/* Photo carousel */}
      <div className="relative aspect-[16/10] overflow-hidden" ref={emblaRef}>
        <div className="flex h-full">
          {project.fotos.map((foto, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0 relative">
              <img
                src={foto}
                alt={`${project.displayName} — foto ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  const el = e.target as HTMLImageElement;
                  el.style.display = "none";
                  const parent = el.parentElement;
                  if (parent) {
                    const fallback = parent.querySelector(".fallback-bg") as HTMLElement;
                    if (fallback) fallback.style.display = "flex";
                  }
                }}
              />
              <div className="fallback-bg absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center hidden">
                <Camera className="h-8 w-8 text-muted-foreground/40" />
              </div>
            </div>
          ))}
        </div>

        {/* Dots */}
        {project.fotos.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {project.fotos.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  i === activeSlide ? "bg-white" : "bg-white/40"
                )}
              />
            ))}
          </div>
        )}

        {/* Arrows on hover */}
        {hovering && project.fotos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
            >
              <ChevronRight className="h-4 w-4 text-foreground" />
            </button>
          </>
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <h4 className="text-sm font-display font-bold text-foreground leading-tight truncate">
            {project.displayName}
          </h4>
          <p className="text-xs text-muted-foreground font-body">{project.metragem}m²</p>
        </div>
      </div>
    </div>
  );
}
