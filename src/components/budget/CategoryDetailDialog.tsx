import { useState, useRef } from "react";
import { calculateSectionSubtotal } from "@/lib/supabase-helpers";
import { formatBRL } from "@/lib/formatBRL";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ImagePlus, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CategorizedGroup } from "@/lib/scope-categories";

interface CategoryDetailDialogProps {
  open: boolean;
  onClose: () => void;
  group: CategorizedGroup | null;
  budgetId?: string;
}

function ItemImageSlot({ item, budgetId }: { item: any; budgetId: string }) {
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(() => {
    const primary = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
    return primary?.url || null;
  });
  const [imageId, setImageId] = useState<string | null>(() => {
    const primary = item.images?.find((img: any) => img.is_primary) || item.images?.[0];
    return primary?.id || null;
  });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
      const url = urlData.publicUrl;

      // If replacing, delete old record first
      if (imageId) {
        await supabase.from("item_images").delete().eq("id", imageId);
      }

      const { data: inserted } = await supabase.from("item_images").insert({ item_id: item.id, url, is_primary: true }).select("id").single();
      setImageUrl(url);
      setImageId(inserted?.id || null);
      toast.success("Imagem adicionada");
    } catch (err) {
      console.error(err);
      toast.error("Erro no upload");
    }
    setUploading(false);
  };

  const handleRemove = async () => {
    if (!imageId) return;
    setUploading(true);
    try {
      await supabase.from("item_images").delete().eq("id", imageId);
      setImageUrl(null);
      setImageId(null);
      toast.success("Imagem removida");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover");
    }
    setUploading(false);
  };

  return (
    <div className="flex-shrink-0 relative group">
      {imageUrl ? (
        <>
          <img
            src={imageUrl}
            alt={item.title}
            className="w-12 h-12 rounded-lg object-cover border border-border cursor-pointer"
            onClick={() => inputRef.current?.click()}
            title="Clique para trocar a imagem"
          />
          <button
            onClick={handleRemove}
            disabled={uploading}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm disabled:opacity-50"
            title="Remover imagem"
          >
            <X className="h-3 w-3" />
          </button>
        </>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-12 h-12 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ImagePlus className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

export function CategoryDetailDialog({ open, onClose, group, budgetId }: CategoryDetailDialogProps) {
  if (!group) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="left" className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl p-0 overflow-y-auto">
        <SheetHeader className="sticky top-0 z-10 bg-card border-b border-border px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display">
            <div className={`w-1.5 h-5 rounded-full ${group.category.bgClass}`} />
            <span className="truncate">{group.category.label}</span>
            <span className={`ml-auto text-base font-mono tabular-nums shrink-0 ${group.category.colorClass}`}>
              {formatBRL(group.subtotal)}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="p-5 space-y-4">
          {group.sections.map((section) => {
            const subtotal = calculateSectionSubtotal(section);
            const items = section.items || [];

            return (
              <div key={section.id} className="rounded-xl border border-border bg-muted/30 overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/50">
                  <span className="text-sm font-display font-semibold text-foreground">
                    {section.qty && section.qty > 1 ? `${section.qty}× ` : ""}{section.title}
                  </span>
                  <span className="text-base font-mono tabular-nums text-foreground font-semibold">
                    {formatBRL(subtotal)}
                  </span>
                </div>

                {/* Items list */}
                {items.length > 0 && (
                  <div className="divide-y divide-border/30">
                    {items.map((item: any) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 min-h-[56px]">
                        {budgetId && <ItemImageSlot item={item} budgetId={budgetId} />}

                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-body font-medium text-foreground">{item.title}</p>
                          {item.qty && (
                            <p className="text-xs text-muted-foreground font-body">
                              {item.qty} {item.unit || "un"}
                            </p>
                          )}
                        </div>

                        {Number(item.internal_total) > 0 && (
                          <span className="text-sm font-mono tabular-nums text-muted-foreground font-medium flex-shrink-0">
                            {formatBRL(Number(item.internal_total))}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
