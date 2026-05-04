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
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Loader2, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

import { logger } from "@/lib/logger";

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
  const isMobile = useIsMobile();

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
    let stage: "upload" | "update" = "upload";
    try {
      const rawExt = (file.name.split(".").pop() || "pdf").toLowerCase();
      const ext = /^[a-z0-9]+$/.test(rawExt) ? rawExt : "pdf";
      const filePath = `${budgetId}/contracts/contrato.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("budget-assets")
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type || undefined,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("budget-assets")
        .getPublicUrl(filePath);

      const contractUrl = urlData.publicUrl;

      stage = "update";
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
    } catch (err: unknown) {
      // PostgrestError vem como objeto puro (não é instanceof Error). Storage
      // errors herdam de Error. Extraímos message/details/hint/code de ambos.
      const errObj = (err && typeof err === "object" ? err : {}) as Record<string, unknown>;
      const message = typeof errObj.message === "string" ? errObj.message
        : err instanceof Error ? err.message
        : "";
      const details = typeof errObj.details === "string" ? errObj.details : "";
      const hint    = typeof errObj.hint    === "string" ? errObj.hint    : "";
      const code    = typeof errObj.code    === "string" ? errObj.code    : "";
      const raw = [message, details, hint, code].filter(Boolean).join(" | ");

      logger.error(`Contract ${stage} error:`, { stage, budgetId, code, message, details, hint, error: err });

      const friendly = (() => {
        if (/row-level security|rls|policy|permission denied|42501/i.test(raw)) {
          return stage === "upload"
            ? "Sem permissão para enviar arquivos neste orçamento. Confirme se você é o comercial responsável ou peça a um admin."
            : "Sem permissão para fechar este orçamento. Confirme se você é o comercial responsável ou peça a um admin.";
        }
        if (/payload too large|exceed|413/i.test(raw)) {
          return "Arquivo excede o limite permitido pelo storage (máx. 50 MB).";
        }
        if (/duplicate key|uniq_current_per_group|uniq_published_per_group|unique constraint|23505/i.test(raw)) {
          return "Já existe outra versão atual deste orçamento. Atualize a página e tente novamente.";
        }
        if (/jwt|token|401|403/i.test(raw)) {
          return "Sessão expirada. Recarregue a página e faça login novamente.";
        }
        if (/check constraint|violates check|invalid input value|23514/i.test(raw)) {
          return "Transição de status não permitida pelo banco. Verifique a etapa atual do orçamento.";
        }
        if (/foreign key|23503/i.test(raw)) {
          return "Falha de integridade ao gravar o evento (cliente, perfil ou versão referenciada).";
        }
        if (/net\.|http_post|pg_net|extension/i.test(raw)) {
          return "Falha ao notificar o Portal BWild. O contrato foi salvo, mas a sincronização não disparou — use 'Re-sincronizar' na página da demanda.";
        }
        return message || "Erro desconhecido. Verifique o console / BugReporter.";
      })();

      const stageLabel = stage === "upload" ? "Erro ao anexar contrato" : "Erro ao fechar contrato";
      toast.error(stageLabel, { description: friendly });
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

  const body = (
    <div className="space-y-4 py-2">
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-border rounded-lg p-6 sm:p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 active:bg-primary/10 transition-colors cursor-pointer min-h-[140px]"
        >
          <Upload className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground" />
          <div className="text-center">
            <p className="text-sm font-medium">Toque para selecionar o contrato</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOC, DOCX ou imagem · Máx. 50 MB</p>
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
            className="h-9 w-9 shrink-0"
            onClick={() => setFile(null)}
            disabled={uploading}
            aria-label="Remover arquivo"
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
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Anexar Contrato</DrawerTitle>
            <DrawerDescription>
              Anexe o contrato assinado para <strong className="text-foreground">{projectName}</strong> antes de fechar o negócio.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 overflow-y-auto">{body}</div>
          <DrawerFooter
            className="flex flex-col gap-2 pt-2"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))" }}
          >
            <Button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full h-11 gap-2"
            >
              {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Enviar para Portal
            </Button>
            <Button
              variant="ghost"
              onClick={handleClose}
              disabled={uploading}
              className="w-full h-10"
            >
              Cancelar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Anexar Contrato</DialogTitle>
          <DialogDescription>
            Anexe o contrato assinado para <strong>{projectName}</strong> antes de fechar o negócio.
          </DialogDescription>
        </DialogHeader>

        {body}

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
