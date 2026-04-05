import { useState, useRef, useEffect, useCallback, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Loader2, Trash2, Play, Image as ImageIcon, FileText, GripVertical, Plus, Compass, Save, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type StorageTab = "3d" | "fotos" | "exec" | "video";
type MediaTab = StorageTab | "tour3d";

interface MediaFile {
  name: string;
  url: string;
}

interface TourEntry {
  id?: string;
  room_id: string;
  room_label: string;
  tour_url: string;
  order_index: number;
}

interface MediaUploadSectionProps {
  publicId: string;
  budgetId: string;
}

/* ── Sortable thumbnail item ── */

const SortableMediaItem = forwardRef<HTMLDivElement, {
  file: MediaFile;
  tab: StorageTab;
  onDelete: (tab: StorageTab, name: string) => void;
  reordering: boolean;
}>(function SortableMediaItem({
  file,
  tab,
  onDelete,
  reordering,
}, _ref) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.name,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative rounded-lg overflow-hidden border border-border bg-muted aspect-square",
        isDragging && "ring-2 ring-primary shadow-lg"
      )}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 z-20 p-1 rounded bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Arrastar para reordenar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {tab === "video" ? (
        <video src={file.url} className="w-full h-full object-cover" muted />
      ) : (
        <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
      )}

      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        <button
          onClick={() => onDelete(tab, file.name)}
          className="p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-white transition-colors"
          title="Remover"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-white/80 font-body px-2 text-center truncate max-w-full">
          {file.name}
        </span>
      </div>

      {reordering && (
        <div className="absolute inset-0 bg-background/30 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
});

/* ── Helpers ── */
const PREFIX_REGEX = /^(\d{2})-/;

function stripPrefix(name: string) {
  return name.replace(PREFIX_REGEX, "");
}

function addPrefix(index: number, name: string) {
  const bare = stripPrefix(name);
  const prefix = String(index + 1).padStart(2, "0");
  return `${prefix}-${bare}`;
}

export function MediaUploadSection({ publicId, budgetId }: MediaUploadSectionProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("3d");
  const [files, setFiles] = useState<Record<StorageTab, MediaFile[]>>({ "3d": [], fotos: [], exec: [], video: [] });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tour 3D state
  const [tours, setTours] = useState<TourEntry[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [toursSaving, setToursSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const folderMap: Record<StorageTab, string> = {
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
    { id: "tour3d", label: "Tour 3D", icon: <Compass className="h-4 w-4" />, accept: "" },
  ];

  const loadFiles = async () => {
    setLoading(true);
    const result: Record<StorageTab, MediaFile[]> = { "3d": [], fotos: [], exec: [], video: [] };

    for (const tab of Object.keys(folderMap) as StorageTab[]) {
      const folder = folderMap[tab];
      const { data } = await supabase.storage.from("media").list(folder, { limit: 100, sortBy: { column: "name", order: "asc" } });
      if (data) {
        result[tab] = data
          .filter(f => f.name !== ".emptyFolderPlaceholder" && f.name !== ".lovkeep")
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

  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setUploading(true);
    const folder = folderMap[activeTab as StorageTab];
    const existingCount = files[activeTab as StorageTab].length;
    let count = 0;

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const safeName = sanitizeFileName(file.name);
      // Add prefix based on current position
      const prefixed = addPrefix(existingCount + i, safeName);
      const path = `${folder}/${prefixed}`;
      const { error } = await supabase.storage.from("media").upload(path, file, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
      if (error) {
        console.error("Upload error:", error.message, error);
        if (error.message?.includes("row-level security")) {
          toast.error("Sem permissão para upload. Verifique se está logado.");
        } else if (error.message?.includes("Payload too large")) {
          toast.error(`Arquivo ${file.name} muito grande.`);
        } else {
          toast.error(`Erro ao subir ${file.name}: ${error.message}`);
        }
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

  const handleDelete = async (tab: StorageTab, fileName: string) => {
    const path = `${folderMap[tab]}/${fileName}`;
    const { error } = await supabase.storage.from("media").remove([path]);
    if (error) {
      toast.error("Erro ao remover arquivo.");
    } else {
      toast.success("Arquivo removido.");
      await loadFiles();
    }
  };

  /* ── Drag-and-drop reorder ── */
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (activeTab === "tour3d") return;
    const currentFiles = files[activeTab];
    const oldIndex = currentFiles.findIndex(f => f.name === active.id);
    const newIndex = currentFiles.findIndex(f => f.name === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(currentFiles, oldIndex, newIndex);

    // Optimistic update
    setFiles(prev => ({ ...prev, [activeTab]: reordered }));
    setReordering(true);

    const folder = folderMap[activeTab as StorageTab];

    try {
      // Collect files that need renaming
      const toProcess: { oldName: string; newName: string; blob: Blob }[] = [];

      for (let i = 0; i < reordered.length; i++) {
        const file = reordered[i];
        const finalName = addPrefix(i, file.name);
        if (finalName === file.name) continue;

        const oldPath = `${folder}/${file.name}`;
        const { data: blob, error: dlErr } = await supabase.storage.from("media").download(oldPath);
        if (dlErr || !blob) {
          console.error("Download error for reorder:", dlErr);
          throw new Error(`Falha ao baixar ${file.name}`);
        }
        toProcess.push({ oldName: file.name, newName: finalName, blob });
      }

      if (toProcess.length === 0) {
        setReordering(false);
        return;
      }

      // Delete ALL old files at once to avoid partial states
      const pathsToDelete = toProcess.map(f => `${folder}/${f.oldName}`);
      const { error: removeErr } = await supabase.storage.from("media").remove(pathsToDelete);
      if (removeErr) {
        console.error("Bulk remove error:", removeErr);
        throw new Error("Falha ao remover arquivos originais");
      }

      // Upload all with new names
      for (const entry of toProcess) {
        const finalPath = `${folder}/${entry.newName}`;
        const { error: upErr } = await supabase.storage.from("media").upload(finalPath, entry.blob, {
          upsert: true,
          contentType: entry.blob.type || "application/octet-stream",
        });
        if (upErr) {
          console.error("Upload error:", upErr);
          throw new Error(`Falha ao enviar ${entry.newName}`);
        }
      }

      toast.success("Ordem atualizada!");
      await loadFiles();
    } catch (err) {
      console.error("Reorder error:", err);
      toast.error("Erro ao reordenar. Tente novamente.");
      await loadFiles();
    }

    setReordering(false);
  }, [files, activeTab, folderMap]);

  const currentTab = tabs.find(t => t.id === activeTab)!;
  const currentFiles = activeTab !== "tour3d" ? files[activeTab as StorageTab] : [];
  const isStorageTab = activeTab !== "tour3d";

  // ── Tour 3D management ──
  const loadTours = useCallback(async () => {
    setToursLoading(true);
    const { data, error } = await supabase
      .from("budget_tours")
      .select("id, room_id, room_label, tour_url, order_index")
      .eq("budget_id", budgetId)
      .order("order_index", { ascending: true });
    if (error) console.error('Failed to load tours:', error.message);
    setTours((data ?? []).map((t) => ({
      id: t.id,
      room_id: t.room_id,
      room_label: t.room_label,
      tour_url: t.tour_url,
      order_index: t.order_index,
    })));
    setToursLoading(false);
  }, [budgetId]);

  useEffect(() => { loadTours(); }, [loadTours]);

  const addTourRow = () => {
    setTours(prev => [...prev, {
      room_id: `room-${Date.now()}`,
      room_label: "",
      tour_url: "",
      order_index: prev.length,
    }]);
  };

  const updateTourRow = (index: number, field: keyof TourEntry, value: string) => {
    setTours(prev => prev.map((t, i) => i === index ? { ...t, [field]: value } : t));
  };

  const removeTourRow = (index: number) => {
    setTours(prev => prev.filter((_, i) => i !== index));
  };

  const saveTours = async () => {
    setToursSaving(true);
    try {
      // Delete all existing tours for this budget
      await supabase.from("budget_tours").delete().eq("budget_id", budgetId);

      // Insert all current tours
      const toInsert = tours
        .filter(t => t.room_label.trim() && t.tour_url.trim())
        .map((t, i) => ({
          budget_id: budgetId,
          room_id: t.room_label.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
          room_label: t.room_label,
          tour_url: t.tour_url,
          order_index: i,
        }));

      if (toInsert.length > 0) {
        const { error } = await supabase.from("budget_tours").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Tours 3D salvos com sucesso!");
      await loadTours();
    } catch (err) {
      console.error("Error saving tours:", err);
      toast.error("Erro ao salvar tours.");
    }
    setToursSaving(false);
  };

  return (
    <Card className="border-border">
      <CardContent className="p-4 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display font-bold text-sm text-foreground">Mídia do Projeto</h3>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            Faça upload de renders 3D, fotos, projetos executivos e vídeos. Arraste para reordenar.
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
              {tab.id !== "tour3d" && files[tab.id as StorageTab].length > 0 && (
                <span className="ml-1 bg-background/30 rounded px-1 text-xs">
                  {files[tab.id as StorageTab].length}
                </span>
              )}
              {tab.id === "tour3d" && tours.length > 0 && (
                <span className="ml-1 bg-background/30 rounded px-1 text-xs">
                  {tours.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tour 3D management */}
        {activeTab === "tour3d" ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground font-body">
              Adicione links de tours 3D interativos para cada cômodo. Eles aparecerão na aba "Tour 3D" da galeria pública.
            </p>

            {toursLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {tours.map((tour, index) => (
                  <div key={index} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-display font-semibold text-muted-foreground w-16 flex-shrink-0">Cômodo</span>
                        <Input
                          value={tour.room_label}
                          onChange={(e) => updateTourRow(index, "room_label", e.target.value)}
                          placeholder="Ex: Dormitório, Cozinha, Banho..."
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-display font-semibold text-muted-foreground w-16 flex-shrink-0">Link</span>
                        <Input
                          value={tour.tour_url}
                          onChange={(e) => updateTourRow(index, "tour_url", e.target.value)}
                          placeholder="https://api2.enscape3d.com/v3/view/..."
                          className="h-8 text-sm font-mono"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => removeTourRow(index)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors mt-1"
                      title="Remover cômodo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={addTourRow} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Adicionar cômodo
                  </Button>
                  <Button size="sm" onClick={saveTours} disabled={toursSaving} className="gap-1.5">
                    {toursSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Salvar tours
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Upload button */}
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => inputRef.current?.click()}
                disabled={uploading || reordering}
                className="gap-2"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? "Enviando..." : "Adicionar arquivos"}
              </Button>
              <span className="text-xs text-muted-foreground font-body">
                Pasta: <code className="bg-muted px-1 py-0.5 rounded text-xs">{folderMap[activeTab as StorageTab]}</code>
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
              <div
                className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-border/50 rounded-lg text-muted-foreground gap-2 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); handleUpload(e.dataTransfer.files); }}
              >
                <Upload className="h-8 w-8 opacity-30" />
                <p className="text-sm font-body font-medium text-foreground/60">Arraste imagens aqui</p>
                <p className="text-xs font-body text-muted-foreground/50">ou clique para selecionar</p>
                <p className="text-[10px] font-body text-muted-foreground/40 mt-1">Suporta JPG, PNG, MP4 e arquivos PDF até 50MB</p>
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={currentFiles.map(f => f.name)} strategy={rectSortingStrategy}>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {currentFiles.map(f => (
                      <SortableMediaItem
                        key={f.name}
                        file={f}
                        tab={activeTab as StorageTab}
                        onDelete={handleDelete}
                        reordering={reordering}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <p className="text-xs text-muted-foreground font-body">
              ✅ Os arquivos enviados aqui aparecem automaticamente na galeria pública do orçamento. Arraste os thumbnails para definir a ordem de exibição.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
