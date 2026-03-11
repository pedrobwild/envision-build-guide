import { useState, useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin, ArrowLeft, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
  { id: "brooklin", name: "Brooklin", count: 14, avgSqm: 25.7, lat: -23.6273, lng: -46.6957 },
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
  { id: "jardim-paulista", name: "Jardim Paulista", count: 2, avgSqm: 31.0, lat: -23.5701, lng: -46.6659 },
  { id: "vila-mariana", name: "Vila Mariana", count: 2, avgSqm: 25.5, lat: -23.5887, lng: -46.6388 },
  { id: "vila-olimpia", name: "Vila Olímpia", count: 2, avgSqm: 26.5, lat: -23.5956, lng: -46.6858 },
  { id: "consolacao", name: "Consolação", count: 2, avgSqm: 24.5, lat: -23.5518, lng: -46.6569 },
  { id: "paraiso", name: "Paraíso", count: 2, avgSqm: 24.0, lat: -23.5726, lng: -46.6421 },
  { id: "itaim", name: "Itaim Bibi", count: 1, avgSqm: 33.0, lat: -23.5858, lng: -46.6784 },
  { id: "ipiranga", name: "Ipiranga", count: 1, avgSqm: 28.0, lat: -23.5896, lng: -46.6079 },
  { id: "cerqueira-cesar", name: "Cerqueira César", count: 1, avgSqm: 27.0, lat: -23.5570, lng: -46.6617 },
  { id: "pompeia", name: "Pompeia", count: 1, avgSqm: null, lat: -23.5360, lng: -46.6760 },
  { id: "sumarezinho", name: "Sumarezinho", count: 1, avgSqm: null, lat: -23.5449, lng: -46.6831 },
  { id: "vila-guilhermina", name: "Vila Guilhermina", count: 1, avgSqm: null, lat: -23.5274, lng: -46.5580 },
];

const TOTAL_PROJECTS = 86;
const TOTAL_NEIGHBORHOODS = 26;

type Tier = "high" | "mid" | "low";

function getTier(count: number): Tier {
  if (count >= 8) return "high";
  if (count >= 3) return "mid";
  return "low";
}

const TIER_CONFIG = {
  high: { bgColor: "hsl(204,100%,25%)", size: 48, mobileSize: 40, fontSize: 14, showLabel: true },
  mid: { bgColor: "hsl(200,35%,34%)", size: 38, mobileSize: 32, fontSize: 12, showLabel: true },
  low: { bgColor: "hsl(210,40%,24%)", size: 28, mobileSize: 24, fontSize: 11, showLabel: false },
};

const DEFAULT_CENTER: [number, number] = [-46.6679, -23.5874];
const DEFAULT_ZOOM = 11.5;

/* ── Component ── */
export function NeighborhoodDensityMap() {
  const [selected, setSelected] = useState<string | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement; labelEl?: HTMLDivElement }>>(new Map());
  const panelRef = useRef<HTMLDivElement>(null);
  const apiKey = (import.meta.env.VITE_MAPTILER_API_KEY as string) || "FQaugVdcxiB24tG5rETf";

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const selectedData = NEIGHBORHOOD_DATA.find((n) => n.id === selected) || null;

  const handleSelect = useCallback((id: string | null) => {
    setSelected((prev) => (prev === id ? null : id));
  }, []);

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
      const tier = getTier(NEIGHBORHOOD_DATA.find((d) => d.id === id)!.count);
      const cfg = TIER_CONFIG[tier];
      const sz = isMobile ? cfg.mobileSize : cfg.size;
      entry.el.style.width = `${isActive ? sz + 6 : sz}px`;
      entry.el.style.height = `${isActive ? sz + 6 : sz}px`;
      entry.el.style.boxShadow = isActive
        ? "0 0 0 4px rgba(0,76,127,0.35), 0 4px 12px rgba(0,0,0,0.25)"
        : "0 2px 8px rgba(0,76,127,0.4)";
      entry.el.style.transform = isActive ? "scale(1.12)" : "scale(1)";
    });

    // Mobile: scroll panel into view
    if (selected && isMobile && panelRef.current) {
      panelRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selected, isMobile]);

  // Init map
  useEffect(() => {
    if (!mapContainer.current || !apiKey) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
      bearing: 0,
      minZoom: 10,
      maxZoom: 16,
      maxBounds: [[-47.0, -23.85], [-46.3, -23.35]],
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      const mobile = window.innerWidth < 768;
      NEIGHBORHOOD_DATA.forEach((n) => {
        const tier = getTier(n.count);
        const cfg = TIER_CONFIG[tier];
        const sz = mobile ? cfg.mobileSize : cfg.size;

        // Wrapper for pin + label
        const wrapper = document.createElement("div");
        wrapper.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;";

        // Pin circle
        const el = document.createElement("div");
        el.style.cssText = `
          width:${sz}px;height:${sz}px;border-radius:50%;
          background:${cfg.bgColor};display:flex;align-items:center;justify-content:center;
          color:white;font-weight:700;font-size:${cfg.fontSize}px;
          cursor:pointer;transition:transform 150ms, box-shadow 150ms;
          box-shadow:0 2px 8px rgba(0,76,127,0.4);
          font-family:'SF Mono','Fira Code',ui-monospace,monospace;
          border:2px solid rgba(255,255,255,0.8);
        `;
        el.textContent = String(n.count);

        el.addEventListener("mouseenter", () => {
          el.style.transform = "scale(1.12)";
        });
        el.addEventListener("mouseleave", () => {
          if (selected !== n.id) el.style.transform = "scale(1)";
        });
        el.addEventListener("click", (e) => {
          e.stopPropagation();
          handleSelect(n.id);
        });

        wrapper.appendChild(el);

        // Label below pin (only high/mid)
        let labelEl: HTMLDivElement | undefined;
        if (cfg.showLabel) {
          labelEl = document.createElement("div");
          labelEl.style.cssText = `
            font-size:10px;font-weight:600;color:hsl(204,100%,25%);
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

        markersRef.current.set(n.id, { marker, el, labelEl });
      });
    });

    mapRef.current = map;

    return () => {
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  const whatsappUrl = selectedData
    ? `https://wa.me/5511911906183?text=${encodeURIComponent(`Olá! Tenho um imóvel no ${selectedData.name} e gostaria de um orçamento.`)}`
    : "#";

  return (
    <div className="py-12 lg:py-16" data-pdf-hide>
      {/* Header */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-3 font-body">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          {TOTAL_PROJECTS} projetos entregues em São Paulo
        </span>
        <h2 className="text-2xl lg:text-3xl font-display font-bold text-foreground tracking-tight">
          Onde já entregamos
        </h2>
        <p className="text-muted-foreground text-sm mt-1 font-body">
          Projetos realizados em {TOTAL_NEIGHBORHOODS} bairros — clique em um bairro para ver detalhes.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-[3] min-w-0">
          {apiKey ? (
            <div
              ref={mapContainer}
              className="w-full h-[280px] md:h-[600px] rounded-xl overflow-hidden border border-border"
            />
          ) : (
            <MapFallback height="600px" />
          )}
        </div>
        <div className="flex-[2] md:max-h-[600px]" ref={panelRef}>
          {selectedData ? (
            <NeighborhoodDetail data={selectedData} onBack={() => setSelected(null)} whatsappUrl={whatsappUrl} />
          ) : (
            <SummaryPanel />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function MapFallback({ height }: { height: string }) {
  return (
    <div
      className="bg-muted rounded-xl flex flex-col items-center justify-center gap-3"
      style={{ height }}
    >
      <MapPin className="h-12 w-12 text-muted-foreground/30" />
      <span className="text-sm text-muted-foreground font-body">Mapa indisponível</span>
    </div>
  );
}

function SummaryPanel({ top5 }: { top5: Neighborhood[] }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 h-full flex flex-col">
      <p className="text-lg font-display font-bold text-foreground mb-4">🏙️ Presença em SP</p>

      <div className="flex gap-6 mb-6">
        <div>
          <span className="font-mono text-3xl font-bold text-primary">{TOTAL_PROJECTS}</span>
          <p className="text-sm text-muted-foreground font-body">projetos entregues</p>
        </div>
        <div>
          <span className="font-mono text-3xl font-bold text-primary">{TOTAL_NEIGHBORHOODS}</span>
          <p className="text-sm text-muted-foreground font-body">bairros atendidos</p>
        </div>
      </div>

      <div className="border-t border-border pt-4 flex-1">
        <p className="text-sm font-semibold text-foreground font-body mb-3">Bairros mais ativos:</p>
        <ul className="space-y-2">
          {top5.map((n) => (
            <li key={n.id} className="flex items-center justify-between text-sm font-body">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {n.name}
              </span>
              <span className="text-muted-foreground tabular-nums">{n.count} proj.</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-xs text-muted-foreground font-body mt-6 text-center">
        Clique em um bairro no mapa para ver detalhes
      </p>
    </div>
  );
}

function NeighborhoodDetail({
  data,
  onBack,
  whatsappUrl,
}: {
  data: Neighborhood;
  onBack: () => void;
  whatsappUrl: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 h-full flex flex-col">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-body mb-4 transition-colors min-h-[44px] self-start"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </button>

      <h3 className="text-xl font-display font-bold text-foreground">{data.name}</h3>
      <Badge className="mt-1 mb-5 self-start bg-primary text-primary-foreground text-xs">
        {data.count} {data.count === 1 ? "projeto entregue" : "projetos entregues"}
      </Badge>

      <div className="flex gap-3 mb-5">
        <div className="flex-1 bg-muted rounded-xl p-4 text-center">
          <span className="font-mono text-2xl font-bold text-primary">{data.count}</span>
          <p className="text-xs text-muted-foreground font-body mt-1">projetos</p>
        </div>
        <div className="flex-1 bg-muted rounded-xl p-4 text-center">
          <span className="font-mono text-2xl font-bold text-primary">
            {data.avgSqm ? `${data.avgSqm}m²` : "—"}
          </span>
          <p className="text-xs text-muted-foreground font-body mt-1">média</p>
        </div>
      </div>

      <p className="text-sm text-muted-foreground font-body leading-relaxed flex-1">
        Já entregamos {data.count} {data.count === 1 ? "studio reformado" : "studios reformados"} no{" "}
        {data.name}, um dos bairros com maior demanda de short stay em SP.
      </p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm py-3 min-h-[44px] hover:bg-primary/90 transition-colors"
      >
        <MessageCircle className="h-4 w-4" />
        Tenho um imóvel no {data.name}
      </a>
    </div>
  );
}
