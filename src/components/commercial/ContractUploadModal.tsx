import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, X } from "lucide-react";

interface ContractUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  budgetId: string;
  projectName: string;
  /** Called after successful upload + status change */
  onSuccess: (contractFileUrl: string) => void;
}

export function ContractUploadModal({
  open,
  onOpenChange,
  budgetId,
  projectName,
  onSuccess,
}: ContractUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (selected.size > maxSize) {
      toast.error("Arquivo muito grande. Máximo: 50MB");
      return;
    }
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo de contrato");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const filePath = `${budgetId}/contracts/contrato.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("budget-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("budget-assets")
        .getPublicUrl(filePath);

      const contractUrl = urlData.publicUrl;

      // Update budget with contract URL and status
      const { error: updateError } = await supabase
        .from("budgets")
        .update({
          contract_file_url: contractUrl,
          internal_status: "contrato_fechado",
          closed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", budgetId);

      if (updateError) throw updateError;

      toast.success("Contrato anexado e status atualizado!");
      onSuccess(contractUrl);
      handleClose();
    } catch (err: any) {
      console.error("Contract upload error:", err);
      toast.error("Erro ao enviar contrato: " + (err.message || "Tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      setFile(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar Contrato</DialogTitle>
          <DialogDescription>
            Anexe o contrato assinado para <strong>{projectName}</strong> antes de fechar o negócio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!file ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Clique para selecionar o contrato</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX ou imagem • Máx. 50MB</p>
              </div>
            </button>
          ) : (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <FileText className="h-8 w-8 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => setFile(null)}
                disabled={uploading}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={uploading}>
            Cancelar
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Enviar para Portal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
