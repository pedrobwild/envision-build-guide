import { useState } from "react";
import { ChevronDown, ChevronRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Room } from "./RoomDrawingStep";
import type { ParsedPackage, ParsedItem } from "./SpreadsheetImportStep";
import { ItemImageUpload, type ItemImage } from "./ItemImageUpload";

interface CoverageMappingStepProps {
  floorPlanUrl: string;
  rooms: Room[];
  packages: ParsedPackage[];
  onPackagesChange: (packages: ParsedPackage[]) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
  budgetId: string;
}

interface CoverageState {
  [itemKey: string]: {
    includedRooms: string[];
    excludedRooms: string[];
  };
}

export function CoverageMappingStep({
  floorPlanUrl,
  rooms,
  packages,
  onPackagesChange,
  onSave,
  onBack,
  saving,
  budgetId,
}: CoverageMappingStepProps) {
  const [expandedPkg, setExpandedPkg] = useState<string | null>(packages[0]?.name || null);
  const [selectedItem, setSelectedItem] = useState<{ pkgIdx: number; itemIdx: number } | null>(null);

  // Image state per item key
  const [itemImages, setItemImages] = useState<Record<string, ItemImage[]>>({});

  // Build a unique key for each item
  const getItemKey = (pkgIdx: number, itemIdx: number) => `${pkgIdx}-${itemIdx}`;

  // Coverage state stored per item
  const [coverage, setCoverage] = useState<CoverageState>(() => {
    const state: CoverageState = {};
    packages.forEach((pkg, pi) => {
      pkg.items.forEach((item, ii) => {
        state[getItemKey(pi, ii)] = {
          includedRooms: [],
          excludedRooms: [],
        };
      });
    });
    return state;
  });

  const currentItem = selectedItem
    ? packages[selectedItem.pkgIdx]?.items[selectedItem.itemIdx]
    : null;
  const currentKey = selectedItem ? getItemKey(selectedItem.pkgIdx, selectedItem.itemIdx) : null;
  const currentCoverage = currentKey ? coverage[currentKey] : null;

  const toggleRoom = (roomId: string) => {
    if (!currentItem || !currentKey || !currentCoverage) return;

    const newCoverage = { ...coverage };
    const itemCov = { ...currentCoverage };

    if (currentItem.coverageType === "geral") {
      // Toggle exclusion
      if (itemCov.excludedRooms.includes(roomId)) {
        itemCov.excludedRooms = itemCov.excludedRooms.filter(r => r !== roomId);
      } else {
        itemCov.excludedRooms = [...itemCov.excludedRooms, roomId];
      }
    } else {
      // Toggle inclusion
      if (itemCov.includedRooms.includes(roomId)) {
        itemCov.includedRooms = itemCov.includedRooms.filter(r => r !== roomId);
      } else {
        itemCov.includedRooms = [...itemCov.includedRooms, roomId];
      }
    }

    newCoverage[currentKey] = itemCov;
    setCoverage(newCoverage);
  };

  const markAll = () => {
    if (!currentItem || !currentKey) return;
    const newCoverage = { ...coverage };
    if (currentItem.coverageType === "geral") {
      newCoverage[currentKey] = { includedRooms: [], excludedRooms: [] };
    } else {
      newCoverage[currentKey] = { includedRooms: rooms.map(r => r.id), excludedRooms: [] };
    }
    setCoverage(newCoverage);
  };

  const clearAll = () => {
    if (!currentItem || !currentKey) return;
    const newCoverage = { ...coverage };
    if (currentItem.coverageType === "geral") {
      newCoverage[currentKey] = { includedRooms: [], excludedRooms: rooms.map(r => r.id) };
    } else {
      newCoverage[currentKey] = { includedRooms: [], excludedRooms: [] };
    }
    setCoverage(newCoverage);
  };

  const isRoomCovered = (roomId: string): boolean => {
    if (!currentItem || !currentCoverage) return false;
    if (currentItem.coverageType === "geral") {
      return !currentCoverage.excludedRooms.includes(roomId);
    }
    return currentCoverage.includedRooms.includes(roomId);
  };

  const getPolygonCenter = (polygon: number[][]): [number, number] => {
    const cx = polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const cy = polygon.reduce((s, p) => s + p[1], 0) / polygon.length;
    return [cx, cy];
  };

  // Count mapped items - "geral" items are always considered mapped (they cover all by default)
  const mappedCount = packages.reduce((count, pkg, pi) => {
    return count + pkg.items.filter((item, ii) => {
      if (item.coverageType === "geral") return true; // geral always mapped
      const key = getItemKey(pi, ii);
      const cov = coverage[key];
      return cov && cov.includedRooms.length > 0;
    }).length;
  }, 0);
  const totalItems = packages.reduce((s, p) => s + p.items.length, 0);

  const handleSaveWithCoverage = () => {
    // Merge coverage and images into packages before saving
    const updated = packages.map((pkg, pi) => ({
      ...pkg,
      items: pkg.items.map((item, ii) => {
        const key = getItemKey(pi, ii);
        const cov = coverage[key] || { includedRooms: [], excludedRooms: [] };
        const imgs = itemImages[key] || [];
        return {
          ...item,
          includedRooms: cov.includedRooms,
          excludedRooms: cov.excludedRooms,
          images: imgs,
        } as typeof item;
      }),
    }));
    onPackagesChange(updated);
    onSave();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-xl text-foreground mb-1">Mapear Cobertura</h3>
        <p className="text-sm text-muted-foreground font-body">
          Selecione um item e clique nos cômodos da planta para definir onde ele contempla.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Package/item list */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {packages.map((pkg, pkgIdx) => (
            <div key={pkg.name} className="rounded-lg border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpandedPkg(expandedPkg === pkg.name ? null : pkg.name)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors"
              >
                {expandedPkg === pkg.name ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-body font-medium text-foreground flex-1 truncate">{pkg.name}</span>
                <span className="text-xs text-muted-foreground font-body">{pkg.items.length}</span>
              </button>

              {expandedPkg === pkg.name && (
                <div className="border-t border-border">
                  {pkg.items.map((item, itemIdx) => {
                    const isSelected =
                      selectedItem?.pkgIdx === pkgIdx && selectedItem?.itemIdx === itemIdx;
                    const key = getItemKey(pkgIdx, itemIdx);
                    const cov = coverage[key];
                    const hasCoverage = cov && (cov.includedRooms.length > 0 || cov.excludedRooms.length > 0);

                    return (
                      <button
                        key={itemIdx}
                        onClick={() => setSelectedItem({ pkgIdx, itemIdx })}
                        className={cn(
                          "w-full flex items-center gap-2 px-4 py-2 text-left text-sm font-body transition-all border-l-2",
                          isSelected
                            ? "bg-primary/10 border-l-primary text-foreground"
                            : "border-l-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded text-xs font-medium shrink-0",
                          item.coverageType === "geral"
                            ? "bg-primary/10 text-primary"
                            : "bg-accent text-accent-foreground"
                        )}>
                          {item.coverageType}
                        </span>
                        {hasCoverage && (
                          <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Floor plan + instruction */}
        <div className="lg:col-span-2 space-y-3">
          {/* Instruction banner */}
          {currentItem ? (
            <div className={cn(
              "flex items-start gap-2 p-3 rounded-lg border",
              currentItem.coverageType === "geral"
                ? "bg-primary/5 border-primary/20"
                : "bg-accent/50 border-accent-foreground/20"
            )}>
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-foreground" />
              <div className="flex-1">
                <p className="text-sm font-body font-medium text-foreground">
                  {currentItem.name}
                </p>
                <p className="text-xs font-body text-muted-foreground mt-0.5">
                  {currentItem.coverageType === "geral"
                    ? "Este item contempla TODOS os cômodos. Clique nos que NÃO contempla (exceções)."
                    : "Este item NÃO contempla nenhum cômodo. Clique nos que contempla."}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={markAll}
                    className="px-2.5 py-1 rounded text-xs font-body font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors"
                  >
                    {currentItem.coverageType === "geral" ? "Nenhuma exceção" : "Marcar todos"}
                  </button>
                  <button
                    onClick={clearAll}
                    className="px-2.5 py-1 rounded text-xs font-body font-medium bg-muted hover:bg-muted/80 text-muted-foreground transition-colors"
                  >
                    {currentItem.coverageType === "geral" ? "Excluir todos" : "Limpar"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground font-body text-center">
                ← Selecione um item para mapear sua cobertura na planta
              </p>
            </div>
          )}

          {/* Image upload for selected item */}
          {currentItem && currentKey && (
            <ItemImageUpload
              images={itemImages[currentKey] || []}
              onImagesChange={(imgs) =>
                setItemImages(prev => ({ ...prev, [currentKey]: imgs }))
              }
              budgetId={budgetId}
              itemLabel={currentItem.name}
            />
          )}

          {/* Floor plan with rooms */}
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/20">
            <img src={floorPlanUrl} alt="Planta" className="w-full select-none pointer-events-none" />
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 1 1"
              preserveAspectRatio="none"
            >
              {rooms.map((room) => {
                const points = room.polygon.map(p => p.join(",")).join(" ");
                const [cx, cy] = getPolygonCenter(room.polygon);
                const covered = currentItem ? isRoomCovered(room.id) : true;
                const isExcluded = currentItem?.coverageType === "geral" && !covered;
                const isIncluded = currentItem?.coverageType === "local" && covered;

                return (
                  <g
                    key={room.id}
                    onClick={() => currentItem && toggleRoom(room.id)}
                    className={cn(currentItem ? "cursor-pointer" : "cursor-default")}
                  >
                    <polygon
                      points={points}
                      className={cn(
                        "transition-all",
                        !currentItem && "fill-primary/15 stroke-primary/60 stroke-[0.002]",
                        currentItem && covered && "fill-primary/25 stroke-primary stroke-[0.003]",
                        currentItem && !covered && currentItem.coverageType === "geral" && "fill-destructive/15 stroke-destructive/40 stroke-[0.002]",
                        currentItem && !covered && currentItem.coverageType === "local" && "fill-muted-foreground/10 stroke-muted-foreground/30 stroke-[0.002]",
                      )}
                    />
                    {/* Hatch pattern for excluded */}
                    {isExcluded && (
                      <>
                        <line
                          x1={room.polygon[0]?.[0]} y1={room.polygon[0]?.[1]}
                          x2={room.polygon[2]?.[0]} y2={room.polygon[2]?.[1]}
                          className="stroke-destructive/30 stroke-[0.001]"
                        />
                        <line
                          x1={room.polygon[1]?.[0]} y1={room.polygon[1]?.[1]}
                          x2={room.polygon[3]?.[0] || room.polygon[0]?.[0]} y2={room.polygon[3]?.[1] || room.polygon[0]?.[1]}
                          className="stroke-destructive/30 stroke-[0.001]"
                        />
                      </>
                    )}
                    <text
                      x={cx}
                      y={cy - 0.012}
                      textAnchor="middle"
                      dominantBaseline="central"
                      className="fill-foreground text-[0.025px] font-semibold pointer-events-none select-none"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {room.name}
                    </text>
                    {currentItem && (
                      <text
                        x={cx}
                        y={cy + 0.015}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className={cn(
                          "text-[0.018px] pointer-events-none select-none",
                          covered ? "fill-primary" : "fill-destructive/60"
                        )}
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {covered ? "✓ incluso" : "✗ não incluso"}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={onBack}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-body text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Voltar
        </button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground font-body">
            {mappedCount}/{totalItems} itens mapeados
          </span>
          <button
            onClick={handleSaveWithCoverage}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar e Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}
