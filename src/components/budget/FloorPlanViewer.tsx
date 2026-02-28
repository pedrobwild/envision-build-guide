import { useState, useRef, useEffect } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloorPlanRoom {
  id: string;
  name: string;
  polygon: number[][];
}

interface FloorPlanViewerProps {
  floorPlanUrl: string;
  rooms: FloorPlanRoom[];
  sections: any[];
  activeRoom: string | null;
  onRoomClick: (roomId: string | null) => void;
}

export function FloorPlanViewer({
  floorPlanUrl,
  rooms,
  sections,
  activeRoom,
  onRoomClick,
}: FloorPlanViewerProps) {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  // Count items per room based on coverage_type + included_rooms / excluded_rooms
  const roomItemCounts: Record<string, number> = {};
  rooms.forEach((r) => {
    let count = 0;
    sections.forEach((s: any) => {
      (s.items || []).forEach((item: any) => {
        const coverageType = item.coverage_type || "geral";
        const included: string[] = item.included_rooms || [];
        const excluded: string[] = item.excluded_rooms || [];

        if (coverageType === "geral") {
          if (!excluded.includes(r.id)) count++;
        } else {
          if (included.includes(r.id)) count++;
        }
      });
    });
    roomItemCounts[r.id] = count;
  });

  const getPolygonCenter = (polygon: number[][]): [number, number] => {
    if (!polygon || polygon.length === 0) return [0.5, 0.5];
    const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
    return [cx, cy];
  };

  if (!rooms || rooms.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <MapPin className="h-4 w-4 text-primary" />
          <h3 className="font-display font-bold text-foreground text-sm">Planta do Apartamento</h3>
        </div>
        <div className="relative">
          <img src={floorPlanUrl} alt="Planta baixa" className="w-full h-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h3 className="font-display font-bold text-foreground text-sm">Planta do Apartamento</h3>
        {activeRoom && (
          <button
            onClick={() => onRoomClick(null)}
            className="ml-auto text-xs text-primary hover:text-primary/80 font-body font-medium transition-colors"
          >
            Limpar filtro
          </button>
        )}
      </div>

      <div className="relative">
        <img src={floorPlanUrl} alt="Planta baixa do apartamento" className="w-full h-auto select-none" />
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
        >
          {rooms.map((room) => {
            const points = room.polygon.map((p) => p.join(",")).join(" ");
            const [cx, cy] = getPolygonCenter(room.polygon);
            const isActive = activeRoom === room.id;
            const isHovered = hoveredRoom === room.id;
            const count = roomItemCounts[room.id] || 0;

            return (
              <g
                key={room.id}
                onClick={() => onRoomClick(isActive ? null : room.id)}
                onMouseEnter={() => setHoveredRoom(room.id)}
                onMouseLeave={() => setHoveredRoom(null)}
                className="cursor-pointer"
              >
                <polygon
                  points={points}
                  className={cn(
                    "transition-all duration-200",
                    isActive
                      ? "fill-primary/20 stroke-primary stroke-[0.003]"
                      : isHovered
                        ? "fill-primary/10 stroke-primary/60 stroke-[0.002]"
                        : "fill-primary/5 stroke-primary/30 stroke-[0.001]"
                  )}
                />
                <text
                  x={cx}
                  y={cy - 0.012}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={cn(
                    "text-[0.022px] font-semibold pointer-events-none select-none",
                    isActive || isHovered ? "fill-primary" : "fill-foreground/70"
                  )}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {room.name}
                </text>
                {(isActive || isHovered) && (
                  <text
                    x={cx}
                    y={cy + 0.014}
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="fill-primary/80 text-[0.016px] pointer-events-none select-none"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {count} {count === 1 ? "item" : "itens"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Room chips */}
      <div className="p-4 flex flex-wrap gap-2">
        {rooms.map((room) => {
          const count = roomItemCounts[room.id] || 0;
          const isActive = activeRoom === room.id;
          return (
            <button
              key={room.id}
              onClick={() => onRoomClick(isActive ? null : room.id)}
              className={cn(
                "text-xs font-body px-3 py-1.5 rounded-full border transition-all",
                isActive
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              )}
            >
              {room.name} ({count})
            </button>
          );
        })}
      </div>
    </div>
  );
}
