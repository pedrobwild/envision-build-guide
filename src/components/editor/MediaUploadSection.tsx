import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImagePlus, Loader2, Trash2, Play, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaTab = "3d" | "fotos" | "exec" | "video";

interface MediaFile {
  name: string;
  url: string;
}

interface MediaUploadSectionProps {
  publicId: string;
}

export function MediaUploadSection({ publicId }: MediaUploadSectionProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("3d");
  const [files, setFiles] = useState<Record<MediaTab, MediaFile[]>>({ "3d": [], fotos: [], exec: [], video: [] });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const folderMap: Record<MediaTab, string> = {
    "3d": `${publicId}/3d`,
    fotos: `${publicId}/fotos`,
    exec: `${publicId}/exec`,
    video: `${publicId}/video`,
  };

  const tabs: { id: MediaTab; label: string; icon: React.ReactNode; accept: string }[] = [
    { id: "3d", label: "Renders 3D", icon: <ImageIcon className="h-4 w-4" />, accept: "image/*" },
    { id: "fotos", label: "Fotos", icon: <ImageIcon className="h-4 w-4" />, accept: "image/*" },
    { id: "exec", label: "Projeto Executivo", icon: <FileText className="h-4 w-4" />, accept: "image/*" },
    { id: "video", label: "Vídeo 3D", icon: <Play className="h-4 w-4" />, accept: "video/*" },
  ];

  const loadFiles = async () => {
    setLoading(true);
    const result: Record<MediaTab, MediaFile[]> = { "3d": [], fotos: [], exec: [], video: [] };

    for (const tab of Object.keys(folderMap) as MediaTab[]) {
      const folder = folderMap[tab];
      const { data } = await supabase.storage.from("media").list(folder, { limit: 100, sortBy: { column: "name", order: "asc" } });
      if (data) {
        result[tab] = data
          .filter(f => f.name !== ".emptyFolderPlaceholder")
          .map(f => {
            const { data: urlData } = supabase.storage.from("media").getPublicUrl(`${folder}/${f.name}`);
            return { name: f.name, url: urlData.publicUrl };
          });
      }
    }
    setFiles(result);
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, [publicId]);

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const folder = folderMap[activeTab];
    let count = 0;

    for (const file of Array.from(fileList)) {
      const path = `${folder}/${file.name}`;
      const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true });
      if (error) {
        console.error("Upload error:", error);
        toast.error(`Erro ao subir ${file.name}: ${error.message}`);
      } else {
        count++;
      }
    }

    if (count > 0) {
      toast.success(`${count} arquivo(s) enviado(s) com sucesso!`);
      await loadFiles();
    }
    setUploading(false);
  };

  const handleDelete = async (tab: MediaTab, fileName: string) => {
    const path = `${folderMap[tab]}/${fileName}`;
    const { error } = await supabase.storage.from("media").remove([path]);
    if (error) {
      toast.error("Erro ao remover arquivo.");
    } else {
      toast.success("Arquivo removido.");
      await loadFiles();
    }
  };

  const currentTab = tabs.find(t => t.id === activeTab)!;
  const currentFiles = files[activeTab];

  return (
    <Card className="border-border">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display font-bold text-sm text-foreground">Mídia do Projeto</h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            Faça upload de renders 3D, fotos, projetos executivos e vídeos. Sem limite de tamanho (até 500MB por arquivo).
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-display font-semibold transition-colors",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.icon}
              {tab.label}
              {files[tab.id].length > 0 && (
                <span className="ml-1 bg-background/30 rounded px-1 text-[10px]">
                  {files[tab.id].length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Upload button */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
            {uploading ? "Enviando..." : "Adicionar arquivos"}
          </Button>
          <span className="text-xs text-muted-foreground font-body">
            Pasta: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{folderMap[activeTab]}</code>
          </span>
        </div>

        <input
          ref={inputRef}
          type="file"
          multiple
          accept={currentTab.accept}
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
        />

        {/* File grid */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : currentFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
            <ImagePlus className="h-8 w-8 opacity-40" />
            <p className="text-xs font-body">Nenhum arquivo na pasta {currentTab.label}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {currentFiles.map(f => (
              <div key={f.name} className="group relative rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                {activeTab === "video" ? (
                  <video src={f.url} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={f.url} alt={f.name} className="w-full h-full object-cover" loading="lazy" />
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <button
                    onClick={() => handleDelete(activeTab, f.name)}
                    className="p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-white transition-colors"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[10px] text-white/80 font-body px-2 text-center truncate max-w-full">
                    {f.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground font-body">
          ⚠️ Após o upload, atualize o arquivo <code>budget-media.ts</code> para que as imagens apareçam na galeria pública.
        </p>
      </CardContent>
    </Card>
  );
}
