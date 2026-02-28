import { useState } from "react";
import { MapPin, Eye } from "lucide-react";
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

// Distinct hue-based colors for each room (HSL based, mapped to tailwind-friendly inline styles)
const ROOM_COLORS = [
  { fill: "hsla(28, 80%, 52%, 0.12)", fillHover: "hsla(28, 80%, 52%, 0.28)", fillActive: "hsla(28, 80%, 52%, 0.35)", stroke: "hsla(28, 80%, 52%, 0.6)", strokeActive: "hsla(28, 80%, 52%, 0.9)", chip: "hsl(28, 80%, 52%)", dot: "hsl(28, 80%, 52%)" },
  { fill: "hsla(200, 70%, 50%, 0.12)", fillHover: "hsla(200, 70%, 50%, 0.28)", fillActive: "hsla(200, 70%, 50%, 0.35)", stroke: "hsla(200, 70%, 50%, 0.6)", strokeActive: "hsla(200, 70%, 50%, 0.9)", chip: "hsl(200, 70%, 50%)", dot: "hsl(200, 70%, 50%)" },
  { fill: "hsla(152, 60%, 40%, 0.12)", fillHover: "hsla(152, 60%, 40%, 0.28)", fillActive: "hsla(152, 60%, 40%, 0.35)", stroke: "hsla(152, 60%, 40%, 0.6)", strokeActive: "hsla(152, 60%, 40%, 0.9)", chip: "hsl(152, 60%, 40%)", dot: "hsl(152, 60%, 40%)" },
  { fill: "hsla(280, 60%, 55%, 0.12)", fillHover: "hsla(280, 60%, 55%, 0.28)", fillActive: "hsla(280, 60%, 55%, 0.35)", stroke: "hsla(280, 60%, 55%, 0.6)", strokeActive: "hsla(280, 60%, 55%, 0.9)", chip: "hsl(280, 60%, 55%)", dot: "hsl(280, 60%, 55%)" },
  { fill: "hsla(350, 70%, 50%, 0.12)", fillHover: "hsla(350, 70%, 50%, 0.28)", fillActive: "hsla(350, 70%, 50%, 0.35)", stroke: "hsla(350, 70%, 50%, 0.6)", strokeActive: "hsla(350, 70%, 50%, 0.9)", chip: "hsl(350, 70%, 50%)", dot: "hsl(350, 70%, 50%)" },
  { fill: "hsla(45, 80%, 50%, 0.12)", fillHover: "hsla(45, 80%, 50%, 0.28)", fillActive: "hsla(45, 80%, 50%, 0.35)", stroke: "hsla(45, 80%, 50%, 0.6)", strokeActive: "hsla(45, 80%, 50%, 0.9)", chip: "hsl(45, 80%, 50%)", dot: "hsl(45, 80%, 50%)" },
  { fill: "hsla(180, 55%, 45%, 0.12)", fillHover: "hsla(180, 55%, 45%, 0.28)", fillActive: "hsla(180, 55%, 45%, 0.35)", stroke: "hsla(180, 55%, 45%, 0.6)", strokeActive: "hsla(180, 55%, 45%, 0.9)", chip: "hsl(180, 55%, 45%)", dot: "hsl(180, 55%, 45%)" },
  { fill: "hsla(15, 75%, 55%, 0.12)", fillHover: "hsla(15, 75%, 55%, 0.28)", fillActive: "hsla(15, 75%, 55%, 0.35)", stroke: "hsla(15, 75%, 55%, 0.6)", strokeActive: "hsla(15, 75%, 55%, 0.9)", chip: "hsl(15, 75%, 55%)", dot: "hsl(15, 75%, 55%)" },
];

export function FloorPlanViewer({
  floorPlanUrl,
  rooms,
  sections,
  activeRoom,
  onRoomClick,
}: FloorPlanViewerProps) {
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

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

  const getColor = (index: number) => ROOM_COLORS[index % ROOM_COLORS.length];

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
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
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
          <defs>
            {rooms.map((room, idx) => {
              const color = getColor(idx);
              return (
                <filter key={`glow-${room.id}`} id={`glow-${room.id}`} x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="0.004" result="blur" />
                  <feFlood floodColor={color.stroke} floodOpacity="0.4" />
                  <feComposite in2="blur" operator="in" />
                  <feMerge>
                    <feMergeNode />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              );
            })}
          </defs>

          {rooms.map((room, idx) => {
            const points = room.polygon.map((p) => p.join(",")).join(" ");
            const [cx, cy] = getPolygonCenter(room.polygon);
            const isActive = activeRoom === room.id;
            const isHovered = hoveredRoom === room.id;
            const count = roomItemCounts[room.id] || 0;
            const color = getColor(idx);

            const fillColor = isActive ? color.fillActive : isHovered ? color.fillHover : color.fill;
            const strokeColor = isActive ? color.strokeActive : color.stroke;
            const strokeWidth = isActive ? 0.004 : isHovered ? 0.003 : 0.0015;

            return (
              <g
                key={room.id}
                onClick={() => onRoomClick(isActive ? null : room.id)}
                onMouseEnter={() => setHoveredRoom(room.id)}
                onMouseLeave={() => setHoveredRoom(null)}
                className="cursor-pointer"
                filter={isActive || isHovered ? `url(#glow-${room.id})` : undefined}
              >
                <polygon
                  points={points}
                  style={{
                    fill: fillColor,
                    stroke: strokeColor,
                    strokeWidth,
                    transition: "all 0.25s ease",
                  }}
                />
                {/* Room name label with background */}
                <rect
                  x={cx - 0.045}
                  y={cy - 0.022}
                  width={0.09}
                  height={isActive || isHovered ? 0.038 : 0.024}
                  rx={0.004}
                  style={{
                    fill: isActive ? strokeColor : isHovered ? "hsla(0,0%,100%,0.85)" : "hsla(0,0%,100%,0.6)",
                    transition: "all 0.25s ease",
                  }}
                  className="pointer-events-none"
                />
                <text
                  x={cx}
                  y={isActive || isHovered ? cy - 0.006 : cy - 0.01}
                  textAnchor="middle"
                  dominantBaseline="central"
                  style={{
                    fontSize: "0.018px",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fill: isActive ? "white" : isHovered ? strokeColor : "hsl(220, 20%, 25%)",
                    transition: "all 0.25s ease",
                  }}
                  className="pointer-events-none select-none"
                >
                  {room.name}
                </text>
                {(isActive || isHovered) && (
                  <text
                    x={cx}
                    y={cy + 0.01}
                    textAnchor="middle"
                    dominantBaseline="central"
                    style={{
                      fontSize: "0.013px",
                      fontFamily: "var(--font-body)",
                      fontWeight: 500,
                      fill: isActive ? "hsla(0,0%,100%,0.9)" : strokeColor,
                    }}
                    className="pointer-events-none select-none"
                  >
                    {count} {count === 1 ? "item" : "itens"}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend + Room chips */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body">
          <Eye className="h-3.5 w-3.5" />
          <span>Clique em um cômodo para filtrar os itens do orçamento</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {rooms.map((room, idx) => {
            const count = roomItemCounts[room.id] || 0;
            const isActive = activeRoom === room.id;
            const color = getColor(idx);
            return (
              <button
                key={room.id}
                onClick={() => onRoomClick(isActive ? null : room.id)}
                className={cn(
                  "text-xs font-body px-3 py-1.5 rounded-full border transition-all flex items-center gap-1.5",
                  isActive
                    ? "text-primary-foreground border-transparent shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground"
                )}
                style={isActive ? { backgroundColor: color.chip, borderColor: color.chip } : undefined}
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: color.dot }}
                />
                {room.name} ({count})
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
