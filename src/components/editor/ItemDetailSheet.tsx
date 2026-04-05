import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Lock, ImagePlus, Loader2, Star, Trash2 } from "lucide-react";
import { formatBRL } from "@/lib/formatBRL";
import { cn } from "@/lib/utils";
import { saveToPhotoLibrary } from "@/lib/item-photo-library";

interface ItemImage {
  id?: string;
  url: string;
  is_primary?: boolean | null;
}

interface ItemDetailData {
  id: string;
  title: string;
  description?: string | null;
  reference_url?: string | null;
  qty?: number | null;
  unit?: string | null;
  internal_unit_price?: number | null;
  internal_total?: number | null;
  bdi_percentage?: number | null;
  notes?: string | null;
  images?: ItemImage[];
}

interface ItemDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ItemDetailData;
  sectionId: string;
  budgetId: string;
  onUpdate: (sectionId: string, itemId: string, field: string, value: any) => void;
  onImagesChange: (sectionId: string, itemId: string, images: ItemImage[]) => void;
}

function calcSaleUnit(cost: number | null | undefined, bdi: number | null | undefined): number {
  return (Number(cost) || 0) * (1 + (Number(bdi) || 0) / 100);
}

function calcMargin(cost: number | null | undefined, bdi: number | null | undefined): number {
  return (Number(cost) || 0) * ((Number(bdi) || 0) / 100);
}

export function ItemDetailSheet({ open, onOpenChange, item, sectionId, budgetId, onUpdate, onImagesChange }: ItemDetailSheetProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const images = item.images || [];

  const saleUnit = calcSaleUnit(item.internal_unit_price, item.bdi_percentage);
  const qty = Number(item.qty) || 1;
  const totalCost = item.internal_total != null && Number(item.internal_total) > 0
    ? Number(item.internal_total)
    : (Number(item.internal_unit_price) || 0) * qty;
  const totalSale = saleUnit * qty;

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let updated = [...images];
    try {
      for (const file of Array.from(files).slice(0, 5 - images.length)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop();
        const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
        if (error) { toast.error("Erro no upload"); continue; }
        const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
        const isPrimary = updated.length === 0;
        const { data: imgRow } = await supabase.from("item_images").insert({
          item_id: item.id,
          url: urlData.publicUrl,
          is_primary: isPrimary,
        }).select().single();
        if (imgRow) {
          updated = [...updated, imgRow];
          if (isPrimary) saveToPhotoLibrary(item.title, urlData.publicUrl);
        }
      }
      onImagesChange(sectionId, item.id, updated);
      toast.success("Imagem adicionada");
    } catch { toast.error("Erro ao fazer upload"); }
    setUploading(false);
  };

  const removeImage = async (imgId: string) => {
    await supabase.from("item_images").delete().eq("id", imgId);
    const updated = images.filter(i => i.id !== imgId);
    if (updated.length > 0 && !updated.some(i => i.is_primary)) {
      updated[0] = { ...updated[0], is_primary: true };
      await supabase.from("item_images").update({ is_primary: true }).eq("id", updated[0].id);
    }
    onImagesChange(sectionId, item.id, updated);
  };

  const setPrimary = async (imgId: string) => {
    for (const img of images) {
      if (img.is_primary) await supabase.from("item_images").update({ is_primary: false }).eq("id", img.id);
    }
    await supabase.from("item_images").update({ is_primary: true }).eq("id", imgId);
    const updated = images.map(i => ({ ...i, is_primary: i.id === imgId }));
    onImagesChange(sectionId, item.id, updated);
    const primary = updated.find(i => i.is_primary);
    if (primary) saveToPhotoLibrary(item.title, primary.url);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">Detalhes do Item</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Basic fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Título</Label>
              <Input
                value={item.title}
                onChange={(e) => onUpdate(sectionId, item.id, "title", e.target.value)}
                className="font-body"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Descrição</Label>
              <Textarea
                value={item.description || ""}
                onChange={(e) => onUpdate(sectionId, item.id, "description", e.target.value)}
                className="font-body text-sm min-h-[60px]"
                placeholder="Descrição do item..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-body">Link de referência</Label>
              <Input
                type="url"
                value={item.reference_url || ""}
                onChange={(e) => onUpdate(sectionId, item.id, "reference_url", e.target.value || null)}
                placeholder="https://..."
                className="font-body text-sm"
              />
            </div>
          </div>

          {/* Financial fields */}
          <div className="space-y-3">
            <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Financeiro</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Quantidade</Label>
                <Input
                  type="number"
                  value={item.qty ?? ""}
                  onChange={(e) => onUpdate(sectionId, item.id, "qty", e.target.value ? Number(e.target.value) : null)}
                  placeholder="1"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Unidade</Label>
                <Input
                  value={item.unit || ""}
                  onChange={(e) => onUpdate(sectionId, item.id, "unit", e.target.value || null)}
                  placeholder="un, m², m..."
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">Custo unitário</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.internal_unit_price ?? ""}
                  onChange={(e) => onUpdate(sectionId, item.id, "internal_unit_price", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0.00"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body">BDI %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={item.bdi_percentage ?? ""}
                  onChange={(e) => onUpdate(sectionId, item.id, "bdi_percentage", e.target.value ? Number(e.target.value) : null)}
                  placeholder="0"
                  className="tabular-nums"
                />
              </div>
            </div>
            {/* Readonly calculated */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-body flex items-center gap-1">
                  Margem <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
                </Label>
                <div className="px-3 py-2 rounded-md bg-muted/40 text-sm tabular-nums text-muted-foreground" title="Margem = Custo × BDI%">
                  {formatBRL(calcMargin(item.internal_unit_price, item.bdi_percentage))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body flex items-center gap-1">
                  Total custo <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
                </Label>
                <div className="px-3 py-2 rounded-md bg-muted/40 text-sm tabular-nums text-muted-foreground" title="Campo calculado automaticamente">
                  {formatBRL(totalCost)}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-body flex items-center gap-1">
                  Total venda <Lock className="h-2.5 w-2.5 text-muted-foreground/40" />
                </Label>
                <div className="px-3 py-2 rounded-md bg-primary/5 text-sm font-semibold tabular-nums text-foreground" title="Campo calculado automaticamente">
                  {formatBRL(totalSale)}
                </div>
              </div>
            </div>
          </div>

          {/* Images */}
          <div className="space-y-3">
            <h4 className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wider">Imagens do item</h4>
            <div className="grid grid-cols-3 gap-2">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "relative group aspect-square rounded-lg overflow-hidden border-2 transition-colors",
                    img.is_primary ? "border-primary" : "border-border"
                  )}
                >
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button onClick={() => setPrimary(img.id)} className="p-1.5 rounded-full bg-background/80 hover:bg-background" title="Principal">
                      <Star className={cn("h-3.5 w-3.5", img.is_primary ? "text-yellow-400 fill-yellow-400" : "text-foreground")} />
                    </button>
                    <button onClick={() => removeImage(img.id)} className="p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-white" title="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
              {images.length < 5 && (
                <button
                  onClick={() => inputRef.current?.click()}
                  disabled={uploading}
                  className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex flex-col items-center justify-center gap-1 transition-all disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <ImagePlus className="h-5 w-5 text-muted-foreground/50" />
                      <span className="text-[10px] text-muted-foreground/50 font-body">Adicionar</span>
                    </>
                  )}
                </button>
              )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-body">Notas internas</Label>
            <Textarea
              value={item.notes || ""}
              onChange={(e) => onUpdate(sectionId, item.id, "notes", e.target.value || null)}
              className="font-body text-sm min-h-[80px]"
              placeholder="Anotações internas sobre este item..."
            />
          </div>

          <Button onClick={() => onOpenChange(false)} className="w-full">
            Fechar e salvar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
