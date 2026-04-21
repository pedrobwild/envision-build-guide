import { useState, useEffect, useRef, useCallback, useMemo, forwardRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, ChevronLeft, ChevronRight, Camera, Building2, MapPinned } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";
import { getIndividualProjects, brooklinEmpreendimentos, type IndividualProject } from "@/data/brooklin-projects";

// All individual projects across every bairro (for the vertical carousel)
const ALL_INDIVIDUAL_PROJECTS: IndividualProject[] = Array.from(
  new Set(brooklinEmpreendimentos.map((p) => p.bairro))
).flatMap((bairro) => getIndividualProjects(bairro));

// Bairros that actually appear in the project carousel
const CAROUSEL_BAIRROS: string[] = Array.from(
  new Set(ALL_INDIVIDUAL_PROJECTS.map((p) => p.bairro))
).sort();

/* ── Shared IntersectionObserver for lazy-loading project cards ──
 * One observer instance is reused across every card to avoid the cost of
 * spinning up an IO per card on every render. Cards register/unregister via
 * `observeCard` and the observer never gets recreated.
 */
type LazyLoadCallback = (visible: boolean) => void;
const lazyCallbacks = new WeakMap<Element, LazyLoadCallback>();
let sharedLazyObserver: IntersectionObserver | null = null;

function getSharedLazyObserver(): IntersectionObserver | null {
  if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") return null;
  if (!sharedLazyObserver) {
    sharedLazyObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const cb = lazyCallbacks.get(entry.target);
          if (cb && entry.isIntersecting) cb(true);
        }
      },
      { rootMargin: "300px 0px", threshold: 0.01 }
    );
  }
  return sharedLazyObserver;
}

function observeCard(el: Element, cb: LazyLoadCallback): () => void {
  const observer = getSharedLazyObserver();
  if (!observer) {
    // SSR or unsupported — show immediately
    cb(true);
    return () => {};
  }
  lazyCallbacks.set(el, cb);
  observer.observe(el);
  return () => {
    observer.unobserve(el);
    lazyCallbacks.delete(el);
  };
}

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
  { id: "vila-olimpia", name: "Vila Olímpia", count: 12, avgSqm: 26.5, lat: -23.5956, lng: -46.6858 },
  { id: "consolacao", name: "Consolação", count: 5, avgSqm: 24.5, lat: -23.5518, lng: -46.6569 },
  { id: "paraiso", name: "Paraíso", count: 2, avgSqm: 24.0, lat: -23.5726, lng: -46.6421 },
  { id: "itaim", name: "Itaim Bibi", count: 5, avgSqm: 33.0, lat: -23.5858, lng: -46.6784 },
  { id: "ipiranga", name: "Ipiranga", count: 1, avgSqm: 28.0, lat: -23.5896, lng: -46.6079 },
  { id: "cerqueira-cesar", name: "Cerqueira César", count: 4, avgSqm: 27.0, lat: -23.5570, lng: -46.6617 },
  { id: "pompeia", name: "Pompeia", count: 1, avgSqm: null, lat: -23.5360, lng: -46.6760 },
  { id: "sumarezinho", name: "Sumarezinho", count: 1, avgSqm: null, lat: -23.5449, lng: -46.6831 },
  { id: "vila-guilhermina", name: "Vila Guilhermina", count: 1, avgSqm: null, lat: -23.5274, lng: -46.5580 },
];

const TOTAL_PROJECTS = 136;
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
const ALL_PINS_BOUNDS: [[number, number], [number, number]] = [
  [-46.7302, -23.6536], // SW corner (Butantã lng, Santo Amaro lat)
  [-46.5580, -23.5274], // NE corner (Vila Guilhermina lng/lat)
];
const MAPTILER_STYLE = "https://api.maptiler.com/maps/streets-v2/style.json";
const SECONDARY_FALLBACK_STYLE = "https://demotiles.maplibre.org/style.json";
const FALLBACK_STYLE = "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
const RASTER_FALLBACK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    "osm-raster": {
      type: "raster",
      tiles: [
        "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
        "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm-raster-layer", type: "raster", source: "osm-raster" }],
};
const STYLE_LOAD_TIMEOUT_MS = 8000;

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

// Lookup: project bairro name -> neighborhood id (for hover sync)
const BAIRRO_NAME_TO_ID = new Map<string, string>(
  NEIGHBORHOOD_DATA.map((n) => [normalize(n.name), n.id])
);
function getBairroId(bairroName: string): string | null {
  return BAIRRO_NAME_TO_ID.get(normalize(bairroName)) ?? null;
}

/* ── Component ── */
interface NeighborhoodDensityMapProps {
  clientNeighborhood?: string;
}

export function NeighborhoodDensityMap({ clientNeighborhood }: NeighborhoodDensityMapProps) {
  const [hoveredBairroId, setHoveredBairroId] = useState<string | null>(null);
  const [highlightedProjectId, setHighlightedProjectId] = useState<string | null>(null);
  const [bairroFilter, setBairroFilter] = useState<string | null>(null);
  const [scrollState, setScrollState] = useState<{ top: boolean; bottom: boolean }>({ top: true, bottom: false });
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const apiKey = import.meta.env.VITE_MAPTILER_API_KEY as string | undefined;
  const isMobileViewport = typeof window !== "undefined" && window.innerWidth < 768;
  const styleCandidates = useMemo<(string | maplibregl.StyleSpecification)[]>(() => {
    // Use the same resilient fallback chain for all devices: raster first (most reliable)
    const candidates: (string | maplibregl.StyleSpecification)[] = [
      RASTER_FALLBACK_STYLE,
      FALLBACK_STYLE,
      SECONDARY_FALLBACK_STYLE,
    ];
    // On desktop with API key, try MapTiler first for higher quality
    if (!isMobileViewport && apiKey) {
      candidates.unshift(`${MAPTILER_STYLE}?key=${apiKey}`);
    }
    return candidates;
  }, [apiKey, isMobileViewport]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const filteredProjects = useMemo(() => {
    if (!bairroFilter) return ALL_INDIVIDUAL_PROJECTS;
    return ALL_INDIVIDUAL_PROJECTS.filter((p) => normalize(p.bairro) === normalize(bairroFilter));
  }, [bairroFilter]);

  // Active bairro id is now derived purely from the filter — no separate
  // "selected" state, so there's zero chance of opening a detail panel.
  const activeBairroId = useMemo(
    () => (bairroFilter ? getBairroId(bairroFilter) : null),
    [bairroFilter]
  );

  const setCardRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  // Auto-select disabled — always show all pins on both mobile and desktop
  // to maximise perception of regional coverage.

  // Sync map with selection
  useEffect(() => {
    if (!mapRef.current) return;
    if (selected) {
      const n = NEIGHBORHOOD_DATA.find((d) => d.id === selected);
      if (n) mapRef.current.flyTo({ center: [n.lng, n.lat], zoom: 14, duration: 800 });
    } else {
      // Always show all pins (no auto-zoom to neighborhood)
      mapRef.current.fitBounds(ALL_PINS_BOUNDS, { padding: 30, duration: 600 });
    }

    // Update marker styles
    markersRef.current.forEach((entry, id) => {
      const isActive = id === selected;
      const isHovered = id === hoveredBairroId && !isActive;
      const count = NEIGHBORHOOD_DATA.find((d) => d.id === id)!.count;
      const style = getPinStyle(count);
      const sz = isMobile ? style.mobileSize : style.size;
      const bonusSize = isActive ? 6 : isHovered ? 4 : 0;
      entry.el.style.width = `${sz + bonusSize}px`;
      entry.el.style.height = `${sz + bonusSize}px`;
      entry.el.style.boxShadow = isActive
        ? `0 0 0 4px rgba(0,76,127,0.35), ${style.shadow}`
        : isHovered
        ? `0 0 0 3px rgba(0,76,127,0.25), ${style.shadow}`
        : style.shadow;
      entry.el.style.transform = isActive ? "scale(1.12)" : isHovered ? "scale(1.08)" : "scale(1)";
      entry.el.style.borderWidth = isActive ? "3px" : "2px";
      entry.el.style.zIndex = isActive || isHovered ? "10" : "1";
    });

    if (selected && isMobile && userInitiatedSelectionRef.current && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    userInitiatedSelectionRef.current = false;
  }, [selected, isMobile, hoveredBairroId]);

  // Track timer so successive pin-clicks reset the highlight cleanly
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashHighlight = useCallback((id: string, durationMs = 2400) => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightedProjectId(id);
    highlightTimerRef.current = setTimeout(() => {
      setHighlightedProjectId(null);
      highlightTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    };
  }, []);

  // Pin click → scroll first matching card into view + flash highlight
  const handlePinClickScroll = useCallback(
    (bairroId: string) => {
      const target = ALL_INDIVIDUAL_PROJECTS.find((p) => getBairroId(p.bairro) === bairroId);
      if (!target) return;
      const el = cardRefs.current.get(target.id);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      flashHighlight(target.id);
    },
    [flashHighlight]
  );

  // Track scroll position to show fade gradients (top/bottom of panel)
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const update = () => {
      const top = el.scrollTop <= 4;
      const bottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
      setScrollState({ top, bottom });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [filteredProjects.length, selectedData]);

  // Keyboard navigation inside the panel:
  // ↑/↓ — move focus between cards (with wrap-around)
  // Home/End — jump to first / last
  // Esc — clear active highlight + bairro filter, return focus to panel
  const focusCard = useCallback(
    (id: string) => {
      const el = cardRefs.current.get(id);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      flashHighlight(id, 1600);
    },
    [flashHighlight]
  );

  const handlePanelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const ids = filteredProjects.map((p) => p.id);
      if (ids.length === 0) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (highlightTimerRef.current) {
          clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = null;
        }
        setHighlightedProjectId(null);
        if (bairroFilter) setBairroFilter(null);
        panelRef.current?.focus();
        return;
      }

      const isVerticalNav = e.key === "ArrowDown" || e.key === "ArrowUp";
      const isHorizontalNav = e.key === "ArrowRight" || e.key === "ArrowLeft";
      const isJump = e.key === "Home" || e.key === "End";
      // On mobile, the panel is horizontal — use ←/→ instead.
      if (!isVerticalNav && !isHorizontalNav && !isJump) return;

      const active = document.activeElement as HTMLElement | null;
      const activeId = active?.dataset?.projectCardId;
      const currentIdx = activeId ? ids.indexOf(activeId) : -1;

      let nextIdx: number;
      if (e.key === "Home") nextIdx = 0;
      else if (e.key === "End") nextIdx = ids.length - 1;
      else {
        const forward = e.key === "ArrowDown" || e.key === "ArrowRight";
        if (currentIdx === -1) {
          nextIdx = forward ? 0 : ids.length - 1;
        } else {
          // Wrap-around for fluid keyboard exploration
          nextIdx = forward
            ? (currentIdx + 1) % ids.length
            : (currentIdx - 1 + ids.length) % ids.length;
        }
      }

      e.preventDefault();
      focusCard(ids[nextIdx]);
    },
    [filteredProjects, bairroFilter, focusCard]
  );

  // Init map
  useEffect(() => {
    if (!mapContainer.current) return;

    // Pre-check WebGL support — MapLibre requires WebGL and fails silently otherwise
    const supportsWebGL = (() => {
      try {
        const canvas = document.createElement("canvas");
        const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
        return !!gl;
      } catch {
        return false;
      }
    })();

    if (!supportsWebGL) {
      setMapLoaded(false);
      setMapFailed(true);
      return;
    }

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

        // (hover handled below in sync with React state)

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          // Filter the panel + scroll first card into view + flash highlight
          setBairroFilter((prev) => (prev === n.name ? null : n.name));
          requestAnimationFrame(() => handlePinClickScroll(n.id));
          // Fly to the bairro for context
          mapRef.current?.flyTo({ center: [n.lng, n.lat], zoom: 14, duration: 700 });
        });

        el.addEventListener("mouseenter", () => setHoveredBairroId(n.id));
        el.addEventListener("mouseleave", () => setHoveredBairroId((prev) => (prev === n.id ? null : prev)));

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
          .addTo(map!);

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
        trackResize: true,
      });

      // Fit all pins after load — show entire territory on every device
      map.on("load", () => {
        map?.fitBounds(ALL_PINS_BOUNDS, { padding: 30, duration: 0 });
        // Force a resize after load in case container was hidden/zero-width during init
        requestAnimationFrame(() => safeResize());
      });

      // Prevent map canvas from stealing page scroll position on init
      map.getCanvas().setAttribute("tabindex", "-1");
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
      // Multiple resize attempts to handle Suspense/lazy mount race conditions
      requestAnimationFrame(() => safeResize());
      setTimeout(() => safeResize(), 100);
      setTimeout(() => safeResize(), 500);
    });

    map.on("error", (event: { error?: { message?: string } }) => {
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

    // IntersectionObserver: when map enters viewport, force a resize.
    // Critical for Suspense/lazy-loaded maps that mount in hidden/zero-width containers.
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            safeResize();
            // Re-render markers if they were lost during a hidden mount
            if (markersRef.current.size === 0 && map) renderMarkers();
          }
        });
      },
      { threshold: 0.01 }
    );
    intersectionObserver.observe(mapContainer.current);

    mapRef.current = map;

    return () => {
      disposed = true;
      clearStyleLoadTimeout();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("resize", safeResize);
      window.removeEventListener("orientationchange", safeResize);
      clearMarkers();
      map?.remove();
      mapRef.current = null;
    };
  }, [handleSelect, styleCandidates, isMobileViewport]);


  return (
    <div className="py-12 lg:py-16" data-pdf-hide>
      <div className="mb-6">
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          136 projetos realizados pela Bwild em São Paulo
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
              className="w-full h-[360px] md:h-[600px] rounded-xl overflow-hidden border border-border"
              aria-label="Mapa de densidade por bairro"
            />
          ) : (
            <MapFallback height={isMobile ? "360px" : "600px"} />
          )}
        </div>

        {/* Right panel: vertical (desktop) / horizontal snap (mobile) carousel of all projects */}
        <div className="flex-[2] md:max-h-[600px] flex flex-col bg-card border border-border rounded-xl overflow-hidden">
          {/* Sticky header */}
          <div className="px-4 pt-3 pb-2 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-baseline justify-between gap-2 mb-2">
              <h3 className="font-display font-bold text-sm text-foreground tracking-tight">
                Empreendimentos entregues
              </h3>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                {filteredProjects.length} {filteredProjects.length === 1 ? "unidade" : "unidades"}
              </span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1 -mx-1 px-1 snap-x">
              <FilterChip
                label="Todos"
                active={bairroFilter === null}
                onClick={() => setBairroFilter(null)}
              />
              {CAROUSEL_BAIRROS.map((b) => (
                <FilterChip
                  key={b}
                  label={b}
                  active={normalize(bairroFilter ?? "") === normalize(b)}
                  onClick={() => {
                    setBairroFilter((prev) => (normalize(prev ?? "") === normalize(b) ? null : b));
                    const id = getBairroId(b);
                    if (id) {
                      const n = NEIGHBORHOOD_DATA.find((x) => x.id === id);
                      if (n) mapRef.current?.flyTo({ center: [n.lng, n.lat], zoom: 14, duration: 700 });
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Scroll area with fade gradients */}
          <div className="relative flex-1 min-h-0">
            {/* Fade gradients */}
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-card to-transparent z-[5] transition-opacity",
                scrollState.top ? "opacity-0" : "opacity-100"
              )}
            />
            <div
              aria-hidden
              className={cn(
                "pointer-events-none absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-card to-transparent z-[5] transition-opacity",
                scrollState.bottom ? "opacity-0" : "opacity-100"
              )}
            />

            <div
              ref={panelRef}
              onKeyDown={handlePanelKeyDown}
              className={cn(
                "h-full overflow-y-auto md:overflow-y-auto p-3",
                // mobile: horizontal snap
                "max-md:flex max-md:gap-3 max-md:overflow-x-auto max-md:overflow-y-hidden max-md:snap-x max-md:snap-mandatory",
                // desktop: vertical stack
                "md:space-y-3"
              )}
              tabIndex={0}
              role="listbox"
              aria-label="Lista de empreendimentos entregues. Use as setas para navegar e Esc para limpar o filtro."
              aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End Escape"
            >
              {filteredProjects.map((proj) => (
                <IndividualProjectCard
                  key={proj.id}
                  project={proj}
                  ref={setCardRef(proj.id)}
                  isHighlighted={highlightedProjectId === proj.id}
                  onHover={(hovered) => {
                    const id = getBairroId(proj.bairro);
                    if (!id) return;
                    setHoveredBairroId(hovered ? id : null);
                  }}
                />
              ))}
              {filteredProjects.length === 0 && (
                <div className="text-sm text-muted-foreground font-body text-center py-8">
                  Nenhum empreendimento neste filtro.
                </div>
              )}
            </div>
          </div>
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

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 snap-start px-2.5 py-1 rounded-full text-[11px] font-medium font-body whitespace-nowrap border transition-all",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

/* ── Individual Project Card with Carousel ── */

interface IndividualProjectCardProps {
  project: IndividualProject;
  isHighlighted?: boolean;
  onHover?: (hovered: boolean) => void;
}

const IndividualProjectCard = forwardRef<HTMLDivElement, IndividualProjectCardProps>(
  ({ project, isHighlighted = false, onHover }, ref) => {
    const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
    const [activeSlide, setActiveSlide] = useState(0);
    const [hovering, setHovering] = useState(false);
    const [inView, setInView] = useState(false);
    // Holds the currently observed element + its disposer so we can swap
    // observers when the DOM node changes without re-running effects.
    const observedRef = useRef<{ el: Element; dispose: () => void } | null>(null);

    const onSlideChange = useCallback(() => {
      if (!emblaApi) return;
      setActiveSlide(emblaApi.selectedScrollSnap());
    }, [emblaApi]);

    useEffect(() => {
      if (!emblaApi) return;
      emblaApi.on("select", onSlideChange);
      onSlideChange();
    }, [emblaApi, onSlideChange]);

    // Autoplay subtly while hovering
    useEffect(() => {
      if (!emblaApi || !hovering || project.fotos.length <= 1) return;
      const interval = setInterval(() => emblaApi.scrollNext(), 2000);
      return () => clearInterval(interval);
    }, [emblaApi, hovering, project.fotos.length]);

    const handleMouseEnter = () => {
      setHovering(true);
      onHover?.(true);
    };
    const handleMouseLeave = () => {
      setHovering(false);
      onHover?.(false);
    };

    // Combine forwarded ref + register element with the SHARED observer.
    // Doing this inside the ref callback (instead of a useEffect) guarantees
    // the observer attaches the moment the DOM node mounts and avoids
    // recreating an IntersectionObserver per re-render.
    const setRefs = useCallback(
      (el: HTMLDivElement | null) => {
        // Forward the ref to parent
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;

        // Swap observation target if the node changed
        if (observedRef.current && observedRef.current.el !== el) {
          observedRef.current.dispose();
          observedRef.current = null;
        }
        if (el && !observedRef.current) {
          // Eager-fire if already in viewport at mount (avoids waiting one tick)
          const rect = el.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          if (rect.top < vh + 300 && rect.bottom > -300) {
            setInView(true);
          }
          const dispose = observeCard(el, () => setInView(true));
          observedRef.current = { el, dispose };
        }
      },
      [ref]
    );

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        observedRef.current?.dispose();
        observedRef.current = null;
      };
    }, []);

    return (
      <div
        ref={setRefs}
        data-project-card-id={project.id}
        tabIndex={0}
        role="option"
        aria-selected={isHighlighted}
        aria-label={`${project.displayName}, ${project.metragem} metros quadrados, ${project.bairro}`}
        className={cn(
          "group/card rounded-xl border overflow-hidden bg-card outline-none",
          "transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform",
          "max-md:min-w-[260px] max-md:snap-start max-md:flex-shrink-0",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          isHighlighted
            ? "border-primary ring-4 ring-primary/40 shadow-xl shadow-primary/20 -translate-y-0.5 scale-[1.015]"
            : hovering
            ? "border-primary/40 shadow-md -translate-y-px"
            : "border-border"
        )}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {/* Photo carousel */}
        <div className="relative aspect-[16/10] overflow-hidden bg-muted" ref={emblaRef}>
          <div className="flex h-full">
            {project.fotos.map((foto, i) => {
              const isActiveSlide = i === activeSlide;
              return (
                <div key={i} className="flex-[0_0_100%] min-w-0 relative">
                  {inView ? (
                    <img
                      src={foto}
                      alt={`Studio reformado de ${project.metragem}m² no ${project.bairro} — ${project.displayName}, foto ${i + 1} de ${project.fotos.length}`}
                      className="w-full h-full object-cover"
                      // First slide loads eagerly so it appears the instant the
                      // card enters viewport; subsequent slides stay lazy.
                      loading={isActiveSlide ? "eager" : "lazy"}
                      decoding={isActiveSlide ? "sync" : "async"}
                      // @ts-expect-error fetchpriority is valid HTML, not yet in TS lib
                      fetchpriority={isActiveSlide ? "high" : "auto"}
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
                  ) : (
                    <div className="absolute inset-0 bg-muted animate-pulse" />
                  )}
                  <div className="fallback-bg absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center hidden">
                    <Camera className="h-8 w-8 text-muted-foreground/40" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Photo counter */}
          {project.fotos.length > 1 && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 backdrop-blur-sm text-white text-[10px] font-mono tabular-nums">
              {activeSlide + 1}/{project.fotos.length}
            </div>
          )}

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
                type="button"
                aria-label="Foto anterior"
                onClick={(e) => { e.stopPropagation(); emblaApi?.scrollPrev(); }}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
              >
                <ChevronLeft className="h-4 w-4 text-foreground" />
              </button>
              <button
                type="button"
                aria-label="Próxima foto"
                onClick={(e) => { e.stopPropagation(); emblaApi?.scrollNext(); }}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full w-7 h-7 flex items-center justify-center shadow transition-opacity"
              >
                <ChevronRight className="h-4 w-4 text-foreground" />
              </button>
            </>
          )}
        </div>

        {/* Info */}
        <div className="p-3 flex items-start gap-2">
          <Building2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-display font-bold text-foreground leading-tight truncate">
              {project.displayName}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-body tabular-nums">
                {project.metragem}m²
              </span>
              <span className="text-muted-foreground/40 text-xs">·</span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground font-body">
                <MapPinned className="h-3 w-3" />
                {project.bairro}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
IndividualProjectCard.displayName = "IndividualProjectCard";
