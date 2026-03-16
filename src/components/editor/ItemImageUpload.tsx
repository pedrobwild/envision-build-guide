import { useState, useRef } from "react";
import { ImagePlus, X, Loader2, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { saveToPhotoLibrary } from "@/lib/item-photo-library";

export interface ItemImage {
  id: string;
  url: string;
  isPrimary: boolean;
}

interface ItemImageUploadProps {
  images: ItemImage[];
  onImagesChange: (images: ItemImage[]) => void;
  budgetId: string;
  itemLabel: string;
}

export function ItemImageUpload({ images, onImagesChange, budgetId, itemLabel }: ItemImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = async (file: File) => {
    const ext = file.name.split(".").pop();
    const path = `${budgetId}/items/${crypto.randomUUID()}.${ext}`;

    const { error } = await supabase.storage
      .from("budget-assets")
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("budget-assets")
      .getPublicUrl(path);

    return urlData.publicUrl;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newImages: ItemImage[] = [];
      for (const file of Array.from(files).slice(0, 5)) {
        if (!file.type.startsWith("image/")) continue;
        const url = await uploadFile(file);
        newImages.push({
          id: crypto.randomUUID(),
          url,
          isPrimary: images.length === 0 && newImages.length === 0,
        });
      }
      onImagesChange([...images, ...newImages]);
      toast.success(`${newImages.length} imagem(ns) adicionada(s)`);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error("Erro ao fazer upload da imagem.");
    }
    setUploading(false);
  };

  const removeImage = (id: string) => {
    const updated = images.filter(img => img.id !== id);
    if (updated.length > 0 && !updated.some(i => i.isPrimary)) {
      updated[0].isPrimary = true;
    }
    onImagesChange(updated);
  };

  const setPrimary = (id: string) => {
    onImagesChange(
      images.map(img => ({ ...img, isPrimary: img.id === id }))
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-body font-medium text-muted-foreground">
        Fotos de referência — {itemLabel}
      </p>

      <div className="flex flex-wrap gap-2">
        {images.map(img => (
          <div
            key={img.id}
            className={cn(
              "relative group w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors",
              img.isPrimary ? "border-primary" : "border-border"
            )}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
              <button
                onClick={() => setPrimary(img.id)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                title="Definir como principal"
              >
                <Star className={cn("h-3 w-3", img.isPrimary ? "text-yellow-400 fill-yellow-400" : "text-white")} />
              </button>
              <button
                onClick={() => removeImage(img.id)}
                className="p-1 rounded hover:bg-white/20 transition-colors"
                title="Remover"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          </div>
        ))}

        {images.length < 5 && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 flex items-center justify-center transition-all disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <ImagePlus className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
    </div>
  );
}
