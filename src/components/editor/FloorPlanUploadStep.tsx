import { Upload, ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";

interface FloorPlanUploadStepProps {
  budgetId: string;
  floorPlanUrl: string | null;
  onUploaded: (url: string) => void;
  onNext: () => void;
}

export function FloorPlanUploadStep({ budgetId, floorPlanUrl, onUploaded, onNext }: FloorPlanUploadStepProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `floor-plans/${budgetId}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("budget-assets").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("budget-assets").getPublicUrl(path);
      await supabase.from("budgets").update({ floor_plan_url: publicUrl }).eq("id", budgetId);
      onUploaded(publicUrl);
    }
    setUploading(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleUpload(f);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-display font-bold text-xl text-foreground mb-1">Upload da Planta Baixa</h3>
        <p className="text-sm text-muted-foreground font-body">
          Envie a imagem da planta baixa (JPG, PNG ou PDF). Não precisa ter medidas.
        </p>
      </div>

      {floorPlanUrl ? (
        <div className="space-y-4">
          <div className="relative rounded-xl overflow-hidden border border-border bg-muted/30">
            <img src={floorPlanUrl} alt="Planta baixa" className="w-full max-h-[500px] object-contain" />
            <button
              onClick={() => onUploaded("")}
              className="absolute top-3 right-3 p-2 rounded-lg bg-foreground/60 text-card hover:bg-foreground/80 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={onNext}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-primary text-primary-foreground font-body font-medium text-sm hover:bg-primary/90 transition-colors"
          >
            Continuar → Definir Cômodos
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = "image/*,.pdf";
            input.onchange = (e: any) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
            };
            input.click();
          }}
          className="border-2 border-dashed border-border rounded-xl p-16 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all"
        >
          {uploading ? (
            <div className="animate-pulse">
              <ImageIcon className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-body text-muted-foreground">Enviando...</p>
            </div>
          ) : (
            <>
              <Upload className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-body text-foreground font-medium mb-1">
                Arraste a planta aqui ou clique para selecionar
              </p>
              <p className="text-xs text-muted-foreground font-body">JPG, PNG ou PDF • Sem necessidade de medidas</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
