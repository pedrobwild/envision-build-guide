import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ImagePlus, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveToPhotoLibrary } from "@/lib/item-photo-library";
import { ItemImageLightbox } from "@/components/editor/ItemImageLightbox";

interface ItemImage {
  id?: string;
  url: string;
  is_primary?: boolean | null;
}

/* ── Inline image management for editor items ── */
export function ItemImageInline({
  itemId,
  itemTitle,
  budgetId,
  images,
  onImagesChange,
}: {
  itemId: string;
  itemTitle: string;
  budgetId: string;
  images: ItemImage[];
  onImagesChange: (imgs: ItemImage[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let currentImages = [...images];
    try {
      for (const file of Array.from(files).slice(0, 5 - currentImages.length)) {
        if (!file.type.startsWith("image/")) continue;
        const ext = file.name.split(".").pop();
        const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
        if (error) { toast.error("Erro no upload"); continue; }
        const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
        const isPrimary = currentImages.length === 0;
        const { data: imgRow } = await supabase.from("item_images").insert({
          item_id: itemId,
          url: urlData.publicUrl,
          is_primary: isPrimary,
        }).select().single();
        if (imgRow) {
          currentImages = [...currentImages, imgRow];
          if (isPrimary) saveToPhotoLibrary(itemTitle, urlData.publicUrl);
        }
      }
      onImagesChange(currentImages);
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
    onImagesChange(updated);
  };

  const setPrimary = async (imgId: string) => {
    for (const img of images) {
      if (img.is_primary) await supabase.from("item_images").update({ is_primary: false }).eq("id", img.id);
    }
    await supabase.from("item_images").update({ is_primary: true }).eq("id", imgId);
    const updated = images.map(i => ({ ...i, is_primary: i.id === imgId }));
    onImagesChange(updated);
    const primary = updated.find(i => i.is_primary);
    if (primary) saveToPhotoLibrary(itemTitle, primary.url);
  };

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setLightboxOpen(true);
  };

  const handleLightboxRemove = async (imgId: string) => {
    await removeImage(imgId);
  };

  return (
    <>
      <div className="mt-2 ml-7 flex items-center gap-1.5 flex-wrap">
        {images.map((img, idx) => (
          <div
            key={img.id}
            className={cn(
              "relative group w-10 h-10 rounded overflow-hidden border transition-colors flex-shrink-0 cursor-pointer",
              img.is_primary ? "border-primary" : "border-border"
            )}
            onClick={() => openLightbox(idx)}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
              <button onClick={(e) => { e.stopPropagation(); setPrimary(img.id!); }} className="p-0.5 rounded hover:bg-white/20" title="Principal">
                <Star className={cn("h-2.5 w-2.5", img.is_primary ? "text-primary fill-primary" : "text-white")} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); removeImage(img.id!); }} className="p-0.5 rounded hover:bg-white/20" title="Remover">
                <X className="h-2.5 w-2.5 text-white" />
              </button>
            </div>
          </div>
        ))}
        {images.length < 5 && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-10 h-10 rounded border border-dashed border-border hover:border-muted-foreground/40 flex items-center justify-center transition-all disabled:opacity-50 flex-shrink-0"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> : <ImagePlus className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleUpload(e.target.files)} />
      </div>

      <ItemImageLightbox
        images={images}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        onRemove={handleLightboxRemove}
      />
    </>
  );
}
