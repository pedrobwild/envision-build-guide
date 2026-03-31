import { useEffect, useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";
import type { ProjetoBairro } from "@/data/brooklin-projects";

interface ProjectMapProps {
  projects: ProjetoBairro[];
  selectedProject: string | null;
  onSelectProject: (id: string | null) => void;
  center: [number, number];
  apiKey: string | undefined;
}

export function ProjectMap({
  projects,
  selectedProject,
  onSelectProject,
  center,
  apiKey,
}: ProjectMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, { marker: maplibregl.Marker; el: HTMLDivElement }>>(new Map());

  const getBounds = useCallback(() => {
    const bounds = new maplibregl.LngLatBounds();
    projects.forEach((p) => bounds.extend([p.lng, p.lat]));
    return bounds;
  }, [projects]);

  // Update marker styles when selection changes
  useEffect(() => {
    markersRef.current.forEach((entry, id) => {
      const isSelected = id === selectedProject;
      entry.el.style.width = isSelected ? "40px" : "32px";
      entry.el.style.height = isSelected ? "40px" : "32px";
      entry.el.style.opacity = isSelected ? "1" : "0.8";
      entry.el.style.boxShadow = isSelected
        ? "0 0 0 6px hsl(var(--primary) / 0.3), 0 4px 12px rgba(0,0,0,0.2)"
        : "0 2px 8px rgba(0,0,0,0.2)";
      entry.el.style.transform = isSelected ? "scale(1.15)" : "scale(1)";
    });

    if (selectedProject && mapRef.current) {
      const proj = projects.find((p) => p.id === selectedProject);
      if (proj) {
        mapRef.current.flyTo({ center: [proj.lng, proj.lat], zoom: 15.5, duration: 800 });
      }
    } else if (!selectedProject && mapRef.current) {
      mapRef.current.fitBounds(getBounds(), { padding: 60, duration: 800 });
    }
  }, [selectedProject, projects, getBounds]);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Raster-first strategy: always works, no API key needed
    const rasterStyle: maplibregl.StyleSpecification = {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    };

    const vectorStyle = apiKey
      ? `https://api.maptiler.com/maps/streets-v2/style.json?key=${apiKey}`
      : null;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: vectorStyle || rasterStyle,
      center,
      zoom: 14,
      pitch: 0,
      bearing: 0,
    });

    // If vector fails, fall back to raster
    if (vectorStyle) {
      map.on("error", (e) => {
        if (e?.error?.status === 403 || e?.error?.status === 401) {
          map.setStyle(rasterStyle);
        }
      });
    }

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");

    map.on("load", () => {
      map.fitBounds(getBounds(), { padding: 60 });

      projects.forEach((proj) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 32px; height: 32px; border-radius: 50%;
          background: hsl(var(--primary)); border: 2px solid white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;

        el.addEventListener("click", (e) => {
          e.stopPropagation();
          onSelectProject(selectedProject === proj.id ? null : proj.id);
        });

        const popup = new maplibregl.Popup({
          offset: 24,
          closeButton: false,
          closeOnClick: false,
          className: "project-map-popup",
        }).setHTML(
          `<div style="font-family: var(--font-body, sans-serif); font-size: 13px; font-weight: 500; padding: 2px 0;">${proj.titulo}<br/><span style="color: hsl(var(--muted-foreground)); font-size: 12px;">${proj.metragem}</span></div>`
        );

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([proj.lng, proj.lat])
          .addTo(map);

        el.addEventListener("mouseenter", () => popup.setLngLat([proj.lng, proj.lat]).addTo(map));
        el.addEventListener("mouseleave", () => popup.remove());

        markersRef.current.set(proj.id, { marker, el });
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

  if (!apiKey) {
    return (
      <div className="bg-muted rounded-xl h-[300px] lg:h-[600px] flex flex-col items-center justify-center gap-3">
        <MapPin className="h-12 w-12 text-muted-foreground/30" />
        <span className="text-sm text-muted-foreground font-body">Mapa indisponível</span>
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="w-full h-[300px] lg:h-[600px] rounded-xl overflow-hidden border border-border"
    />
  );
}
