import { useState } from "react";
import { floorPlanZones } from "@/lib/demo-budget-data";
import { MapPin } from "lucide-react";

interface FloorPlanViewerProps {
  floorPlanUrl: string;
  sections: any[];
  activeZone: string | null;
  onZoneClick: (zone: string | null) => void;
}

export function FloorPlanViewer({ floorPlanUrl, sections, activeZone, onZoneClick }: FloorPlanViewerProps) {
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);

  // Count items per zone
  const zoneCounts: Record<string, number> = {};
  sections.forEach((s: any) => {
    (s.items || []).forEach((item: any) => {
      const zone = item.floor_zone;
      if (zone) {
        zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
      }
    });
  });

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-foreground text-sm">Planta do Apartamento</h3>
        {activeZone && (
          <button
            onClick={() => onZoneClick(null)}
            className="ml-auto text-xs text-primary hover:text-primary/80 font-body font-medium transition-colors"
          >
            Limpar filtro
          </button>
        )}
      </div>
      <div className="relative">
        <img
          src={floorPlanUrl}
          alt="Planta baixa do apartamento"
          className="w-full h-auto"
        />
        {/* Zone overlays */}
        {Object.entries(floorPlanZones).map(([key, zone]) => {
          const isActive = activeZone === key;
          const isHovered = hoveredZone === key;
          const count = zoneCounts[key] || 0;

          return (
            <button
              key={key}
              onClick={() => onZoneClick(isActive ? null : key)}
              onMouseEnter={() => setHoveredZone(key)}
              onMouseLeave={() => setHoveredZone(null)}
              className="absolute transition-all duration-200 rounded-lg border-2 flex items-end justify-center"
              style={{
                left: `${zone.x}%`,
                top: `${zone.y}%`,
                width: `${zone.w}%`,
                height: `${zone.h}%`,
                borderColor: isActive
                  ? 'hsl(var(--primary))'
                  : isHovered
                    ? 'hsl(var(--primary) / 0.6)'
                    : 'transparent',
                backgroundColor: isActive
                  ? 'hsl(var(--primary) / 0.15)'
                  : isHovered
                    ? 'hsl(var(--primary) / 0.08)'
                    : 'transparent',
              }}
            >
              {(isActive || isHovered) && (
                <span className="mb-1 px-2 py-0.5 rounded-md text-xs font-body font-semibold bg-primary text-primary-foreground shadow-sm whitespace-nowrap">
                  {zone.label} · {count} {count === 1 ? 'item' : 'itens'}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {/* Zone legend */}
      <div className="p-4 flex flex-wrap gap-2">
        {Object.entries(floorPlanZones).map(([key, zone]) => {
          const count = zoneCounts[key] || 0;
          const isActive = activeZone === key;
          return (
            <button
              key={key}
              onClick={() => onZoneClick(isActive ? null : key)}
              className={`text-xs font-body px-3 py-1.5 rounded-full border transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
              }`}
            >
              {zone.label} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
