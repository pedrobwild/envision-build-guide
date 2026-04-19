import { useState, useRef, useCallback } from "react";
import { Upload, ImagePlus, Check, AlertCircle, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PendingFile {
  file: File;
  itemName: string;
  previewUrl: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
}

function extractItemName(filename: string): string {
  // Remove extension and clean up
  return filename.replace(/\.[^/.]+$/, "").trim();
}

export default function PhotoLibraryUpload() {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!file.type.startsWith("image/")) continue;
      newFiles.push({
        file,
        itemName: extractItemName(file.name),
        previewUrl: URL.createObjectURL(file),
        status: "pending",
      });
    }
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].previewUrl);
      updated.splice(index, 1);
      return updated;
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFilesSelected(e.dataTransfer.files);
    },
    [handleFilesSelected]
  );

  const uploadAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return;
    }

    setUploading(true);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const pf = files[i];
      if (pf.status === "done") continue;

      setFiles((prev) => {
        const updated = [...prev];
        updated[i] = { ...updated[i], status: "uploading" };
        return updated;
      });

      try {
        const ext = pf.file.name.split(".").pop();
        const path = `item-library/${crypto.randomUUID()}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from("budget-assets")
          .upload(path, pf.file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from("budget-assets")
          .getPublicUrl(path);

        const normalized = pf.itemName.trim().toLowerCase();

        await supabase
          .from("item_photo_library")
          .upsert(
            {
              item_name: pf.itemName.trim(),
              item_name_normalized: normalized,
              url: urlData.publicUrl,
              created_by: user.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "item_name_normalized,created_by" }
          );

        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: "done" };
          return updated;
        });
        successCount++;
      } catch (err: unknown) {
        
        setFiles((prev) => {
          const updated = [...prev];
          updated[i] = { ...updated[i], status: "error", error: err instanceof Error ? err.message : String(err) };
          return updated;
        });
        errorCount++;
      }
    }

    setUploading(false);
    if (successCount > 0) toast.success(`${successCount} foto(s) salva(s) na biblioteca`);
    if (errorCount > 0) toast.error(`${errorCount} erro(s) no upload`);
  };

  const pendingCount = files.filter((f) => f.status === "pending" || f.status === "error").length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">
          Biblioteca de Fotos — Upload em Lote
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Arraste ou selecione imagens. O nome do arquivo (sem extensão) será usado como nome do item.
          <br className="hidden sm:inline" />
          Fotos existentes em orçamentos anteriores não serão alteradas — apenas novos itens usarão essas fotos.
        </p>
      </div>

      {/* Drop zone */}
      <Card
        className={cn(
          "border-2 border-dashed transition-colors cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5"
        )}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <Upload className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Arraste imagens aqui ou clique para selecionar
          </p>
          <p className="text-xs text-muted-foreground/60">
            Ex: <code className="bg-muted px-1 rounded">Piso Vinílico.jpg</code>,{" "}
            <code className="bg-muted px-1 rounded">Rodapé de MDF.png</code>
          </p>
        </CardContent>
      </Card>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFilesSelected(e.target.files);
          e.target.value = "";
        }}
      />

      {/* File list */}
      {files.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {files.length} arquivo(s) selecionado(s)
                </CardTitle>
                <CardDescription>
                  {pendingCount > 0
                    ? `${pendingCount} pendente(s) para upload`
                    : "Todos enviados!"}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
                    setFiles([]);
                  }}
                  disabled={uploading}
                >
                  Limpar
                </Button>
                <Button
                  size="sm"
                  onClick={uploadAll}
                  disabled={uploading || pendingCount === 0}
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      Enviando…
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4 mr-1" />
                      Enviar {pendingCount} foto(s)
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {files.map((pf, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "relative group rounded-lg border overflow-hidden bg-muted/30",
                    pf.status === "done" && "border-green-500/50",
                    pf.status === "error" && "border-destructive/50",
                    pf.status === "uploading" && "border-primary/50"
                  )}
                >
                  <div className="aspect-square relative">
                    <img
                      src={pf.previewUrl}
                      alt={pf.itemName}
                      className="w-full h-full object-cover"
                    />
                    {pf.status === "done" && (
                      <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                        <Check className="h-8 w-8 text-green-600" />
                      </div>
                    )}
                    {pf.status === "error" && (
                      <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
                        <AlertCircle className="h-6 w-6 text-destructive" />
                      </div>
                    )}
                    {pf.status === "uploading" && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                    {pf.status === "pending" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium truncate" title={pf.itemName}>
                      {pf.itemName}
                    </p>
                    {pf.error && (
                      <p className="text-[10px] text-destructive truncate" title={pf.error}>
                        {pf.error}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
