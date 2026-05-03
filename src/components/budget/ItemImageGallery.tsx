import { useState, useRef } from "react";
import { ImagePlus, Loader2, X, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Lightbox } from "./Lightbox";
import { saveToPhotoLibrary } from "@/lib/item-photo-library";

interface ImageRecord {
  id: string;
  url: string;
  is_primary: boolean;
}

const MAX_IMAGES = 5;

import type { ItemWithImages } from "@/types/budget-common";

import { logger } from "@/lib/logger";

interface ItemImageGalleryProps {
  item: ItemWithImages;
  budgetId: string;
  editable: boolean;
}

export function ItemImageGallery({ item, budgetId, editable }: ItemImageGalleryProps) {
  const [images, setImages] = useState<ImageRecord[]>(() =>
    (item.images || []).map((img) => ({ id: img.id || "", url: img.url, is_primary: !!img.is_primary }))
  );
  const [activeIdx, setActiveIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    if (images.length >= MAX_IMAGES) {
      toast.error(`Máximo de ${MAX_IMAGES} imagens por item`);
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("budget-assets").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("budget-assets").getPublicUrl(path);
      const url = urlData.publicUrl;
      const isPrimary = images.length === 0;
      const { data: inserted } = await supabase
        .from("item_images")
        .insert({ item_id: item.id, url, is_primary: isPrimary })
        .select("id")
        .single();
      const newImg: ImageRecord = { id: inserted?.id || "", url, is_primary: isPrimary };
      setImages((prev) => [...prev, newImg]);
      setActiveIdx(images.length);
      // Save to global photo library (fire-and-forget)
      if (isPrimary && item.title) {
        saveToPhotoLibrary(item.title, url);
      }
      toast.success("Imagem adicionada");
    } catch (err) {
      logger.error(err);
      toast.error("Erro no upload");
    }
    setUploading(false);
  };

  const handleRemove = async (idx: number) => {
    const img = images[idx];
    if (!img) return;
    setUploading(true);
    try {
      await supabase.from("item_images").delete().eq("id", img.id);
      const updated = images.filter((_, i) => i !== idx);
      if (img.is_primary && updated.length > 0) {
        updated[0].is_primary = true;
        await supabase.from("item_images").update({ is_primary: true }).eq("id", updated[0].id);
      }
      setImages(updated);
      setActiveIdx((prev) => Math.min(prev, Math.max(0, updated.length - 1)));
      toast.success("Imagem removida");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao remover");
    }
    setUploading(false);
  };

  const handleSetPrimary = async (idx: number) => {
    const img = images[idx];
    if (!img || img.is_primary) return;
    try {
      const currentPrimary = images.find((i) => i.is_primary);
      if (currentPrimary) {
        await supabase.from("item_images").update({ is_primary: false }).eq("id", currentPrimary.id);
      }
      await supabase.from("item_images").update({ is_primary: true }).eq("id", img.id);
      setImages((prev) =>
        prev.map((im, i) => ({ ...im, is_primary: i === idx }))
      );
      // Update library with new primary
      if (item.title) {
        saveToPhotoLibrary(item.title, img.url);
      }
      toast.success("Imagem principal definida");
    } catch (err) {
      logger.error(err);
    }
  };

  const canAdd = editable && images.length < MAX_IMAGES;

  if (images.length === 0) {
    if (!editable) return null;
    return (
      <div className="flex-shrink-0">
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

  const active = images[activeIdx];

  return (
    <div className="flex-shrink-0 flex flex-col items-center gap-1.5">
      {/* Main preview */}
      <div className="relative group">
        <img
          src={active?.url}
          alt={item.title}
          className="w-16 h-16 rounded-lg object-cover border border-border cursor-zoom-in"
          onClick={() => setLightboxOpen(true)}
        />
        {editable && (
          <button
            onClick={() => handleRemove(activeIdx)}
            disabled={uploading}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm disabled:opacity-50"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        {active?.is_primary && images.length > 1 && (
          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Star className="h-2.5 w-2.5 fill-current" />
          </div>
        )}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActiveIdx((prev) => (prev - 1 + images.length) % images.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="h-3 w-3" />
            </button>
            <button
              onClick={() => setActiveIdx((prev) => (prev + 1) % images.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-5 h-5 rounded-full bg-card border border-border shadow-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      {/* Thumbnails row */}
      <div className="flex items-center gap-1">
        {images.map((img, i) => (
          <button
            key={img.id}
            onClick={() => setActiveIdx(i)}
            onDoubleClick={() => handleSetPrimary(i)}
            title={img.is_primary ? "Principal" : "Duplo clique: definir como principal"}
            className={cn(
              "w-4 h-4 rounded-sm overflow-hidden border transition-all",
              i === activeIdx ? "border-primary ring-1 ring-primary/30" : "border-border opacity-60 hover:opacity-100"
            )}
          >
            <img loading="lazy" decoding="async" src={img.url} className="w-full h-full object-cover" alt="" />
          </button>
        ))}
        {canAdd && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-4 h-4 rounded-sm border border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-2 w-2 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-2 w-2 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      {/* Lightbox */}
      <Lightbox
        images={images.map((img) => ({ url: img.url, alt: item.title }))}
        initialIndex={activeIdx}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

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
