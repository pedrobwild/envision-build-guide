import { useState, useEffect, useCallback } from "react";
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
import { calcItemSaleTotal, calcSaleUnitPrice } from "@/lib/budget-calc";
import { cn } from "@/lib/utils";
import { Check, Percent, TrendingUp, DollarSign, Link as LinkIcon } from "lucide-react";
import type { ItemData } from "./SortableItemRow";

const BDI_PRESETS = [
  { label: "15%", value: 15 },
  { label: "25%", value: 25 },
  { label: "35%", value: 35 },
  { label: "50%", value: 50 },
  { label: "70%", value: 70 },
];

interface MobileItemEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemData;
  sectionId: string;
  onUpdate: (sectionId: string, itemId: string, field: string, value: string | number | boolean | Record<string, unknown> | null) => void;
}

function getHealthColor(bdi: number): string {
  if (bdi >= 30) return "text-success";
  if (bdi >= 15) return "text-warning";
  return "text-destructive";
}

function getHealthBg(bdi: number): string {
  if (bdi >= 30) return "bg-success/10 border-success/30";
  if (bdi >= 15) return "bg-warning/10 border-warning/30";
  return "bg-destructive/10 border-destructive/30";
}

export function MobileItemEditor({
  open,
  onOpenChange,
  item,
  sectionId,
  onUpdate,
}: MobileItemEditorProps) {
  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description || "");
  const [qty, setQty] = useState<string>(item.qty != null ? String(item.qty) : "");
  const [unit, setUnit] = useState(item.unit || "");
  const [unitCost, setUnitCost] = useState<string>(item.internal_unit_price != null ? String(item.internal_unit_price) : "");
  const [bdi, setBdi] = useState<number>(Number(item.bdi_percentage) || 0);
  const [refUrl, setRefUrl] = useState(item.reference_url || "");

  // Sync local state when item changes
  useEffect(() => {
    setTitle(item.title);
    setDescription(item.description || "");
    setQty(item.qty != null ? String(item.qty) : "");
    setUnit(item.unit || "");
    setUnitCost(item.internal_unit_price != null ? String(item.internal_unit_price) : "");
    setBdi(Number(item.bdi_percentage) || 0);
    setRefUrl(item.reference_url || "");
  }, [item]);

  // Live calc values
  const costNum = parseFloat(unitCost) || 0;
  const qtyNum = parseFloat(qty) || 1;
  const saleUnit = calcSaleUnitPrice(costNum, bdi);
  const margin = costNum * (bdi / 100);
  const totalCost = costNum * qtyNum;
  const totalSale = saleUnit * qtyNum;
  const totalMargin = margin * qtyNum;
  const marginPercent = saleUnit > 0 ? (margin / saleUnit) * 100 : 0;

  const handleSave = useCallback(() => {
    onUpdate(sectionId, item.id, "title", title);
    onUpdate(sectionId, item.id, "description", description || null);
    onUpdate(sectionId, item.id, "qty", qty ? Number(qty) : null);
    onUpdate(sectionId, item.id, "unit", unit || null);
    onUpdate(sectionId, item.id, "internal_unit_price", unitCost ? Number(unitCost) : null);
    onUpdate(sectionId, item.id, "bdi_percentage", bdi > 0 ? bdi : null);
    onUpdate(sectionId, item.id, "reference_url", refUrl || null);
    onOpenChange(false);
  }, [sectionId, item.id, title, description, qty, unit, unitCost, bdi, refUrl, onUpdate, onOpenChange]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader className="pb-1 px-4">
          <DrawerTitle className="font-display text-sm truncate">Editar item</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 space-y-4 overflow-y-auto flex-1 pb-2">
          {/* ── Title ── */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Nome</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nome do item"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>

          {/* ── Description ── */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do item (opcional)"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
            />
          </div>

          {/* ── Qty + Unit + Cost row ── */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Qtd</label>
              <input
                type="number"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="1"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono tabular-nums text-center placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Unidade</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="un, m²"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-body text-center placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Custo un.</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="0.00"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-mono tabular-nums text-right placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>
          </div>

          {/* ── BDI Section ── */}
          <div className={cn("rounded-xl border p-3 space-y-3 transition-colors", getHealthBg(bdi))}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Percent className={cn("h-4 w-4", getHealthColor(bdi))} />
                <span className="text-xs font-semibold font-body text-foreground">BDI</span>
              </div>
              <div className="flex items-baseline gap-1">
                <input
                  type="number"
                  inputMode="decimal"
                  value={bdi || ""}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setBdi(isNaN(v) ? 0 : Math.min(200, Math.max(0, v)));
                  }}
                  placeholder="0"
                  step="0.5"
                  className={cn(
                    "w-16 text-right text-2xl font-bold font-mono tabular-nums bg-transparent focus:outline-none",
                    getHealthColor(bdi)
                  )}
                />
                <span className={cn("text-lg font-bold", getHealthColor(bdi))}>%</span>
              </div>
            </div>

            {/* Slider */}
            <Slider
              value={[bdi]}
              onValueChange={(v) => setBdi(v[0])}
              max={100}
              min={0}
              step={0.5}
              className="w-full"
            />

            {/* Presets */}
            <div className="flex gap-1.5 justify-between">
              {BDI_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setBdi(p.value)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg border text-xs font-bold font-mono tabular-nums transition-all active:scale-95",
                    bdi === p.value
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/50 bg-card text-muted-foreground hover:border-primary/30"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Live calculations ── */}
          {costNum > 0 && (
            <div className="rounded-xl border border-border/40 bg-muted/20 overflow-hidden">
              <div className="grid grid-cols-2 divide-x divide-border/30">
                <div className="p-3 space-y-0.5">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body flex items-center gap-1">
                    <DollarSign className="h-2.5 w-2.5" /> Venda un.
                  </span>
                  <p className="text-sm font-mono tabular-nums font-bold text-foreground">
                    {formatBRL(saleUnit)}
                  </p>
                </div>
                <div className="p-3 space-y-0.5">
                  <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-body flex items-center gap-1">
                    <TrendingUp className="h-2.5 w-2.5" /> Margem un.
                  </span>
                  <p className={cn("text-sm font-mono tabular-nums font-bold", getHealthColor(bdi))}>
                    {formatBRL(margin)}
                  </p>
                </div>
              </div>
              <div className="border-t border-border/30 grid grid-cols-3 divide-x divide-border/30">
                <div className="p-2 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Total custo</span>
                  <p className="text-xs font-mono tabular-nums font-semibold text-muted-foreground">
                    {formatBRL(totalCost)}
                  </p>
                </div>
                <div className="p-2 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Total venda</span>
                  <p className="text-xs font-mono tabular-nums font-bold text-foreground">
                    {formatBRL(totalSale)}
                  </p>
                </div>
                <div className="p-2 space-y-0.5">
                  <span className="text-[8px] text-muted-foreground uppercase tracking-wider font-body">Margem %</span>
                  <p className={cn("text-xs font-mono tabular-nums font-bold", getHealthColor(bdi))}>
                    {marginPercent.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ── Reference URL ── */}
          <div className="space-y-1">
            <label className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground flex items-center gap-1">
              <LinkIcon className="h-2.5 w-2.5" /> Referência
            </label>
            <input
              type="url"
              value={refUrl}
              onChange={(e) => setRefUrl(e.target.value)}
              placeholder="https://exemplo.com/produto"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm font-body text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
        </div>

        <DrawerFooter className="pt-2 pb-4">
          <Button
            onClick={handleSave}
            className="w-full h-12 text-sm font-semibold gap-2 rounded-xl"
          >
            <Check className="h-4 w-4" />
            Salvar alterações
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
