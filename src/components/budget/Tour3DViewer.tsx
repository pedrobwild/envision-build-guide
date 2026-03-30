import { useState, useCallback, useEffect, useRef } from "react";
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
  const isMobile = useIsMobile();
  const [activeRoom, setActiveRoom] = useState(rooms[0]?.id ?? "");
  const [fullscreen, setFullscreen] = useState(false);
  const [loadedRooms, setLoadedRooms] = useState<Set<string>>(new Set());
  // Staggered preload: mount active immediately, others after delay
  const [mountedRooms, setMountedRooms] = useState<Set<string>>(
    new Set(rooms[0] ? [rooms[0].id] : [])
  );

  const currentRoom = rooms.find((r) => r.id === activeRoom) ?? rooms[0];

  // Stagger preload of remaining rooms after first loads
  useEffect(() => {
    if (rooms.length <= 1) return;
    const firstId = rooms[0]?.id;
    if (!firstId) return;

    // Wait for first room to load, then mount others one by one with delays
    const timers: ReturnType<typeof setTimeout>[] = [];
    const otherRooms = rooms.filter((r) => r.id !== firstId);

    otherRooms.forEach((room, i) => {
      const timer = setTimeout(() => {
        setMountedRooms((prev) => new Set(prev).add(room.id));
      }, 2000 + i * 1500); // stagger: 2s, 3.5s, 5s...
      timers.push(timer);
    });

    return () => timers.forEach(clearTimeout);
  }, [rooms]);

  // When user clicks a room tab, mount it immediately
  const handleRoomChange = useCallback((id: string) => {
    setActiveRoom(id);
    setMountedRooms((prev) => new Set(prev).add(id));
    if (isMobile) setFullscreen(true);
  }, [isMobile]);

  const handleIframeLoad = useCallback((roomId: string) => {
    setLoadedRooms((prev) => new Set(prev).add(roomId));
  }, []);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((prev) => !prev);
  }, []);

  if (!currentRoom) return null;

  const renderIframe = (room: Tour3DRoom, isFullscreen: boolean) => (
    <div
      className={cn(
        "relative w-full bg-muted",
        isFullscreen ? "h-full" : "aspect-[16/10] rounded-lg overflow-hidden border border-border"
      )}
      style={{ touchAction: "none" }}
    >
      {!loadedRooms.has(room.id) && activeRoom === room.id && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-sm font-body text-muted-foreground animate-pulse">
            Carregando tour 3D…
          </span>
        </div>
      )}
      <iframe
        src={room.url}
        title={`Tour 3D — ${room.label}`}
        className={cn("w-full h-full border-0", activeRoom !== room.id && "hidden")}
        style={{ touchAction: "none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; magnetometer; xr-spatial-tracking; fullscreen"
        allowFullScreen
        loading={room.id === activeRoom ? "eager" : "lazy"}
        onLoad={() => handleIframeLoad(room.id)}
      />
    </div>
  );

  // Render only mounted iframes (staggered preload)
  const allIframes = (isFullscreen: boolean) => (
    <div className={cn("relative w-full", isFullscreen ? "h-full" : "")}>
      {rooms.map((room) => {
        if (!mountedRooms.has(room.id)) return null;
        return (
          <div key={room.id} className={cn(activeRoom === room.id ? (isFullscreen ? "h-full" : "") : "hidden")}>
            {renderIframe(room, isFullscreen)}
          </div>
        );
      })}
    </div>
  );

  const roomTabs = (
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
          {loadedRooms.has(room.id) && activeRoom !== room.id && (
            <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-primary/50" title="Carregado" />
          )}
        </button>
      ))}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-card border-b border-border flex-shrink-0">
          {roomTabs}
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
          {allIframes(true)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {roomTabs}
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
      {allIframes(false)}
    </div>
  );
}
