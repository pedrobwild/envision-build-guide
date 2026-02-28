import { useState, useRef, useCallback } from "react";
import { Plus, Trash2, Edit3, Check, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export interface Room {
  id: string;
  name: string;
  polygon: number[][]; // normalized coordinates 0-1 [[x,y], ...]
}

interface RoomDrawingStepProps {
  floorPlanUrl: string;
  rooms: Room[];
  onRoomsChange: (rooms: Room[]) => void;
  onNext: () => void;
  onBack: () => void;
}

type DrawMode = "idle" | "drawing";

export function RoomDrawingStep({ floorPlanUrl, rooms, onRoomsChange, onNext, onBack }: RoomDrawingStepProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>("idle");
  const [currentPoints, setCurrentPoints] = useState<number[][]>([]);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [tempName, setTempName] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [imgSize, setImgSize] = useState({ w: 1, h: 1 });
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);
  const [namingRoom, setNamingRoom] = useState<Room | null>(null);
  const [namingValue, setNamingValue] = useState("");

  const getNormalizedCoords = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    return [Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y))];
  }, []);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (drawMode !== "drawing") return;
    const coords = getNormalizedCoords(e);
    if (!coords) return;

    const newPoints = [...currentPoints, coords];
    setCurrentPoints(newPoints);

    if (newPoints.length >= 3) {
      const first = newPoints[0];
      const last = coords;
      const dist = Math.sqrt((first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2);
      if (dist < 0.03 && newPoints.length >= 4) {
        finishPolygon(newPoints.slice(0, -1));
      }
    }
  }, [drawMode, currentPoints, getNormalizedCoords]);

  const finishPolygon = (points: number[][]) => {
    const newRoom: Room = {
      id: crypto.randomUUID(),
      name: `Cômodo ${rooms.length + 1}`,
      polygon: points,
    };
    onRoomsChange([...rooms, newRoom]);
    setCurrentPoints([]);
    setDrawMode("idle");
    // Open naming dialog for the new room
    setNamingRoom(newRoom);
    setNamingValue(newRoom.name);
  };

  const startRectangleDraw = () => {
    setDrawMode("drawing");
    setCurrentPoints([]);
    setSelectedRoom(null);
  };

  const handleDoubleClick = useCallback(() => {
    if (drawMode === "drawing" && currentPoints.length >= 3) {
      finishPolygon(currentPoints);
    }
  }, [drawMode, currentPoints]);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    onRoomsChange(rooms.filter(r => r.id !== deleteTarget.id));
    if (selectedRoom === deleteTarget.id) setSelectedRoom(null);
    setDeleteTarget(null);
  };

  const confirmName = () => {
    if (!namingRoom) return;
    const name = namingValue.trim() || namingRoom.name;
    onRoomsChange(rooms.map(r => r.id === namingRoom.id ? { ...r, name } : r));
    setNamingRoom(null);
  };

  const renameRoom = (id: string) => {
    onRoomsChange(rooms.map(r => r.id === id ? { ...r, name: tempName } : r));
    setEditingName(null);
  };

  const getPolygonCenter = (polygon: number[][]): [number, number] => {
    const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
    return [cx, cy];
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-xl text-foreground mb-1">Definir Cômodos</h3>
        <p className="text-sm text-muted-foreground font-body">
          Desenhe contornos sobre a planta e nomeie cada cômodo. Dê duplo-clique para fechar o polígono.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Floor plan canvas */}
        <div className="lg:col-span-3">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={startRectangleDraw}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-body font-medium transition-all",
                drawMode === "drawing"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
              )}
            >
              <Square className="h-4 w-4" />
              {drawMode === "drawing" ? "Desenhando..." : "Desenhar Cômodo"}
            </button>
            {drawMode === "drawing" && (
              <span className="text-xs text-muted-foreground font-body animate-pulse">
                Clique para adicionar pontos • Duplo-clique para fechar
              </span>
            )}
          </div>

          <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
            <img
              src={floorPlanUrl}
              alt="Planta"
              className="w-full select-none pointer-events-none"
              onLoad={(e) => {
                const img = e.currentTarget;
                setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
              }}
            />
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full cursor-crosshair"
              onClick={handleSvgClick}
              onDoubleClick={handleDoubleClick}
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {rooms.map((room) => {
                const points = room.polygon.map(p => p.join(",")).join(" ");
                const [cx, cy] = getPolygonCenter(room.polygon);
                const isSelected = selectedRoom === room.id;

                return (
                  <g key={room.id} onClick={(e) => { e.stopPropagation(); setSelectedRoom(room.id); }}>
                    <polygon
                      points={points}
                      className={cn(
                        "transition-all cursor-pointer",
                        isSelected
                          ? "fill-primary/30 stroke-primary stroke-[0.003]"
                          : "fill-primary/15 stroke-primary/60 stroke-[0.002] hover:fill-primary/25"
                      )}
                    />
                    <text
                      x={cx}
                      y={cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-foreground text-[0.028px] font-semibold pointer-events-none select-none"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {room.name}
                    </text>
                  </g>
                );
              })}

              {currentPoints.length > 0 && (
                <>
                  <polyline
                    points={currentPoints.map(p => p.join(",")).join(" ")}
                    fill="none"
                    className="stroke-primary stroke-[0.003]"
                    strokeDasharray="0.008 0.004"
                  />
                  {currentPoints.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r="0.006" className="fill-primary" />
                  ))}
                </>
              )}
            </svg>
          </div>
        </div>

        {/* Room list */}
        <div className="space-y-3">
          <h4 className="font-display font-semibold text-foreground text-sm">Cômodos ({rooms.length})</h4>

          {rooms.length === 0 ? (
            <p className="text-xs text-muted-foreground font-body">
              Nenhum cômodo definido. Use a ferramenta de desenho.
            </p>
          ) : (
            <div className="space-y-2">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg border transition-all",
                    selectedRoom === room.id
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:border-primary/30"
                  )}
                  onClick={() => setSelectedRoom(room.id)}
                >
                  {editingName === room.id ? (
                    <form
                      onSubmit={(e) => { e.preventDefault(); renameRoom(room.id); }}
                      className="flex items-center gap-1 flex-1"
                    >
                      <input
                        autoFocus
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        className="flex-1 text-sm font-body bg-transparent border-none focus:outline-none text-foreground"
                        onBlur={() => renameRoom(room.id)}
                      />
                      <button type="submit" className="p-1 text-primary">
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-body text-foreground truncate">{room.name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingName(room.id); setTempName(room.name); }}
                        className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(room); }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          <button
            onClick={startRectangleDraw}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-border text-sm font-body text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Adicionar Cômodo
          </button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Excluir Cômodo</DialogTitle>
            <DialogDescription className="font-body">
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={confirmDelete}
              className="px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-body text-sm font-medium hover:bg-destructive/90 transition-colors"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Naming dialog for newly created room */}
      <Dialog open={!!namingRoom} onOpenChange={(open) => { if (!open) confirmName(); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Nomear Cômodo</DialogTitle>
            <DialogDescription className="font-body">
              Dê um nome para o cômodo recém-criado.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); confirmName(); }}>
            <input
              autoFocus
              value={namingValue}
              onChange={(e) => setNamingValue(e.target.value)}
              placeholder="Ex: Sala de estar"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-body focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <DialogFooter className="mt-4">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-body text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Confirmar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar
        </button>
        <button
          onClick={onNext}
          disabled={rooms.length === 0}
          className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar → Planilha
        </button>
      </div>
    </div>
  );
}
