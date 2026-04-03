import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";

interface LightboxImage {
  id: string;
  url: string;
  is_primary?: boolean | null;
}

interface ItemImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (imgId: string) => void;
}

export function ItemImageLightbox({ images, initialIndex, open, onOpenChange, onRemove }: ItemImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setIndex(initialIndex);
    setConfirmDelete(false);
  }, [initialIndex, open]);

  const goNext = useCallback(() => {
    setIndex((i) => (i + 1) % images.length);
    setConfirmDelete(false);
  }, [images.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i - 1 + images.length) % images.length);
    setConfirmDelete(false);
  }, [images.length]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") goNext();
    else if (e.key === "ArrowLeft") goPrev();
  }, [goNext, goPrev]);

  const handleRemove = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onRemove(img.id);
    if (images.length <= 1) {
      onOpenChange(false);
    } else {
      setIndex((i) => Math.min(i, images.length - 2));
    }
    setConfirmDelete(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-3xl w-full p-0 gap-0 bg-background/95 backdrop-blur-sm overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        <div className="relative flex items-center justify-center min-h-[300px] max-h-[70vh] bg-black/5 dark:bg-white/5">
          <img
            src={img.url}
            alt={`Imagem ${index + 1}`}
            className="max-w-full max-h-[70vh] object-contain"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={goPrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground shadow-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={goNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-background/80 hover:bg-background text-foreground shadow-md transition-colors"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
          <div className="text-sm font-body text-muted-foreground">
            <span className="font-medium text-foreground">{index + 1}</span> de {images.length}
            {img.is_primary && (
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                Principal
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={confirmDelete ? "destructive" : "outline"}
              size="sm"
              onClick={handleRemove}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmDelete ? "Confirmar remoção" : "Remover imagem"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
