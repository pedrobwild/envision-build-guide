import { useState, useCallback } from "react";
import { Maximize2, Minimize2, Loader2, MousePointer, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Tour3DRoom } from "@/hooks/useBudgetTours";

interface Tour3DViewerProps {
  rooms: Tour3DRoom[];
}

function TourHint() {
  const isMobile = useIsMobile();
  return (
    <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-md bg-muted/60 text-xs text-muted-foreground font-body">
      {isMobile ? (
        <>
          <Smartphone className="h-3.5 w-3.5 shrink-0" />
          <span>Mova o celular ou arraste com o dedo para explorar o ambiente</span>
        </>
      ) : (
        <>
          <MousePointer className="h-3.5 w-3.5 shrink-0" />
          <span>Clique e arraste com o cursor para explorar o ambiente</span>
        </>
      )}
    </div>
  );
}

export function Tour3DViewer({ rooms }: Tour3DViewerProps) {
  const [activeRoom, setActiveRoom] = useState(rooms[0]?.id ?? "");
  const [fullscreen, setFullscreen] = useState(false);
  const [loading, setLoading] = useState(true);

  const currentRoom = rooms.find((r) => r.id === activeRoom) ?? rooms[0];

  const handleIframeLoad = useCallback(() => setLoading(false), []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  const handleRoomChange = useCallback((id: string) => {
    setActiveRoom(id);
    setLoading(true);
  }, []);

  if (!currentRoom) return null;

  const iframeContent = (
    <div className={cn(
      "relative w-full bg-muted",
      fullscreen ? "h-full" : "aspect-[16/10] rounded-lg overflow-hidden border border-border"
    )}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-body text-muted-foreground animate-pulse">
            Carregando tour 3D…
          </span>
        </div>
      )}
      <iframe
        key={currentRoom.id}
        src={currentRoom.url}
        title={`Tour 3D — ${currentRoom.label}`}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; xr-spatial-tracking; fullscreen"
        allowFullScreen
        onLoad={handleIframeLoad}
      />
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            {rooms.length > 1 && rooms.map((room) => (
              <button
                key={room.id}
                onClick={() => handleRoomChange(room.id)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors",
                  activeRoom === room.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {room.label}
              </button>
            ))}
          </div>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-md hover:bg-muted transition-colors"
            aria-label="Sair da tela cheia"
          >
            <Minimize2 className="h-4 w-4 text-foreground" />
          </button>
        </div>
        <TourHint />
        <div className="flex-1 min-h-0">
          {iframeContent}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {rooms.length > 1 && rooms.map((room) => (
            <button
              key={room.id}
              onClick={() => handleRoomChange(room.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors",
                activeRoom === room.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {room.label}
            </button>
          ))}
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display font-semibold bg-muted text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Tela cheia"
        >
          <Maximize2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Tela cheia</span>
        </button>
      </div>

      <TourHint />
      {iframeContent}
    </div>
  );
}