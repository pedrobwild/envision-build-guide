import { useState, useCallback, useEffect } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import { TrendingUp, Percent, DollarSign, Check } from "lucide-react";

const BDI_PRESETS = [
  { label: "15%", value: 15, description: "Mínimo" },
  { label: "25%", value: 25, description: "Padrão" },
  { label: "35%", value: 35, description: "Bom" },
  { label: "50%", value: 50, description: "Alto" },
  { label: "70%", value: 70, description: "Premium" },
];

interface MobileBdiDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemTitle: string;
  bdiPercentage: number | null | undefined;
  unitCost: number | null | undefined;
  qty: number | null | undefined;
  onBdiChange: (value: number | null) => void;
}

function calcValues(cost: number, bdi: number, qty: number) {
  const margin = cost * (bdi / 100);
  const saleUnit = cost + margin;
  const totalCost = cost * qty;
  const totalSale = saleUnit * qty;
  const totalMargin = margin * qty;
  const marginPercent = saleUnit > 0 ? (margin / saleUnit) * 100 : 0;
  return { margin, saleUnit, totalCost, totalSale, totalMargin, marginPercent };
}

function getHealthColor(bdi: number): string {
  if (bdi >= 30) return "text-success";
  if (bdi >= 15) return "text-warning";
  return "text-destructive";
}

function getHealthBg(bdi: number): string {
  if (bdi >= 30) return "bg-success/10";
  if (bdi >= 15) return "bg-warning/10";
  return "bg-destructive/10";
}

function getGradientStop(bdi: number): string {
  if (bdi >= 30) return "hsl(var(--success))";
  if (bdi >= 15) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
}

export function MobileBdiDrawer({
  open,
  onOpenChange,
  itemTitle,
  bdiPercentage,
  unitCost,
  qty,
  onBdiChange,
}: MobileBdiDrawerProps) {
  const currentBdi = Number(bdiPercentage) || 0;
  const cost = Number(unitCost) || 0;
  const itemQty = Number(qty) || 1;
  const [localBdi, setLocalBdi] = useState(currentBdi);

  // Sync when prop changes
  useEffect(() => {
    setLocalBdi(Number(bdiPercentage) || 0);
  }, [bdiPercentage]);

  const vals = calcValues(cost, localBdi, itemQty);
  const hasCost = cost > 0;

  const handleSliderChange = useCallback((v: number[]) => {
    setLocalBdi(v[0]);
  }, []);

  const handlePreset = useCallback((value: number) => {
    setLocalBdi(value);
  }, []);

  const handleConfirm = useCallback(() => {
    onBdiChange(localBdi > 0 ? localBdi : null);
    onOpenChange(false);
  }, [localBdi, onBdiChange, onOpenChange]);

  const handleManualInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v === "") {
      setLocalBdi(0);
    } else {
      const num = parseFloat(v);
      if (!isNaN(num) && num >= 0 && num <= 200) {
        setLocalBdi(num);
      }
    }
  }, []);

  const isDirty = localBdi !== currentBdi;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="font-display text-base flex items-center gap-2">
            <div className={cn("p-1.5 rounded-lg", getHealthBg(localBdi))}>
              <Percent className={cn("h-4 w-4", getHealthColor(localBdi))} />
            </div>
            <span className="truncate">BDI — {itemTitle}</span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-5 overflow-y-auto">
          {/* ── Big BDI display ── */}
          <div className="flex items-center justify-center pt-1">
            <div className="relative">
              <div
                className={cn(
                  "w-28 h-28 rounded-full flex flex-col items-center justify-center border-4 transition-colors duration-300",
                  localBdi >= 30
                    ? "border-success/40 bg-success/5"
                    : localBdi >= 15
                    ? "border-warning/40 bg-warning/5"
                    : "border-destructive/40 bg-destructive/5"
                )}
              >
                <div className="flex items-baseline gap-0.5">
                  <input
                    type="number"
                    value={localBdi || ""}
                    onChange={handleManualInput}
                    placeholder="0"
                    className={cn(
                      "w-16 text-center text-3xl font-bold font-mono tabular-nums bg-transparent focus:outline-none",
                      getHealthColor(localBdi)
                    )}
                    step="0.5"
                    min="0"
                    max="200"
                    inputMode="decimal"
                  />
                  <span className={cn("text-lg font-bold", getHealthColor(localBdi))}>%</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-body uppercase tracking-wider mt-0.5">
                  BDI
                </span>
              </div>
            </div>
          </div>

          {/* ── Slider ── */}
          <div className="space-y-3 px-1">
            <Slider
              value={[localBdi]}
              onValueChange={handleSliderChange}
              max={100}
              min={0}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/60 font-mono tabular-nums">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* ── Presets ── */}
          <div className="flex gap-1.5 justify-center flex-wrap">
            {BDI_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => handlePreset(p.value)}
                className={cn(
                  "flex flex-col items-center px-3 py-2 rounded-xl border transition-all duration-200 min-w-[56px]",
                  localBdi === p.value
                    ? "border-primary bg-primary/10 shadow-sm scale-105"
                    : "border-border/40 bg-card hover:border-primary/30 hover:bg-primary/5 active:scale-95"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-bold font-mono tabular-nums",
                    localBdi === p.value ? "text-primary" : "text-foreground"
                  )}
                >
                  {p.label}
                </span>
                <span className="text-[9px] text-muted-foreground font-body">{p.description}</span>
              </button>
            ))}
          </div>

          {/* ── Live calculation breakdown ── */}
          {hasCost && (
            <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-border/30">
                <div className="p-3 space-y-0.5">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body flex items-center gap-1">
                    <DollarSign className="h-2.5 w-2.5" /> Custo un.
                  </span>
                  <p className="text-sm font-mono tabular-nums font-semibold text-muted-foreground">
                    {formatBRL(cost)}
                  </p>
                </div>
                <div className="p-3 space-y-0.5">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" /> Venda un.
                  </span>
                  <p className="text-sm font-mono tabular-nums font-bold text-foreground">
                    {formatBRL(vals.saleUnit)}
                  </p>
                </div>
              </div>

              <div className="border-t border-border/30 grid grid-cols-3 divide-x divide-border/30">
                <div className="p-2.5 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Margem un.</span>
                  <p className={cn("text-xs font-mono tabular-nums font-bold", getHealthColor(localBdi))}>
                    {formatBRL(vals.margin)}
                  </p>
                </div>
                <div className="p-2.5 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Total venda</span>
                  <p className="text-xs font-mono tabular-nums font-bold text-foreground">
                    {formatBRL(vals.totalSale)}
                  </p>
                </div>
                <div className="p-2.5 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Margem %</span>
                  <p className={cn("text-xs font-mono tabular-nums font-bold", getHealthColor(localBdi))}>
                    {vals.marginPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {!hasCost && (
            <div className="rounded-xl border border-border/30 bg-muted/10 p-4 text-center">
              <p className="text-xs text-muted-foreground font-body">
                Informe o custo unitário para ver a simulação de margem
              </p>
            </div>
          )}
        </div>

        <DrawerFooter className="pt-3">
          <Button
            onClick={handleConfirm}
            className={cn(
              "w-full h-12 text-sm font-semibold gap-2 rounded-xl transition-all",
              isDirty
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground"
            )}
          >
            <Check className="h-4 w-4" />
            {isDirty ? `Aplicar ${localBdi}%` : "Confirmar"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

/* ── Tappable BDI chip for mobile rows ── */
export function BdiChip({
  bdi,
  onClick,
}: {
  bdi: number | null | undefined;
  onClick: () => void;
}) {
  const value = Number(bdi) || 0;
  const hasValue = value > 0;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex items-center gap-0.5 h-6 px-1.5 rounded-md text-[10px] font-mono tabular-nums font-bold transition-all active:scale-95 shrink-0",
        hasValue
          ? cn(
              "border",
              value >= 30
                ? "bg-success/10 text-success border-success/20"
                : value >= 15
                ? "bg-warning/10 text-warning border-warning/20"
                : "bg-destructive/10 text-destructive border-destructive/20"
            )
          : "bg-muted/50 text-muted-foreground/50 border border-dashed border-border/40"
      )}
      title="Ajustar BDI"
    >
      {hasValue ? `${value}%` : "BDI"}
    </button>
  );
}
