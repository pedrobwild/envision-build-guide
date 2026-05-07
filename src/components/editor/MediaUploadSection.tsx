import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ImagePlus, Loader2, Trash2, Play, Image as ImageIcon, FileText, GripVertical, Plus, Compass, Save, Upload, CheckSquare, Square, X, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { uploadWithRetry } from "@/lib/storage-upload-retry";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

import { logger } from "@/lib/logger";

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
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: (name: string) => void;
  isPrimary: boolean;
  onTogglePrimary: (tab: StorageTab, url: string) => void;
}>(function SortableMediaItem({
  file,
  tab,
  onDelete,
  reordering,
  selectionMode,
  selected,
  onToggleSelect,
  isPrimary,
  onTogglePrimary,
}, _ref) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: file.name,
    disabled: selectionMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const handleClick = () => {
    if (selectionMode) onToggleSelect(file.name);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={cn(
        "group relative rounded-lg overflow-hidden border bg-muted aspect-square transition-all",
        selectionMode && "cursor-pointer",
        selected ? "border-primary ring-2 ring-primary" : isPrimary ? "border-gold ring-2 ring-gold/60" : "border-border",
        isDragging && "ring-2 ring-primary shadow-lg"
      )}
    >
      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-1.5 left-1.5 z-30 bg-background/90 rounded p-0.5 shadow-sm">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelect(file.name)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4"
          />
        </div>
      )}

      {/* Drag handle (hidden in selection mode) */}
      {!selectionMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 z-20 p-1 rounded bg-charcoal/60 text-cream opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
          title="Arrastar para reordenar"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Primary badge (always visible when primary) */}
      {isPrimary && !selectionMode && (
        <div
          className="absolute top-1 right-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded bg-gold text-charcoal text-[10px] font-display font-bold shadow"
          title="Mídia principal — aparece primeiro na galeria pública"
        >
          <Star className="h-2.5 w-2.5 fill-current" />
          Capa
        </div>
      )}

      {tab === "video" ? (
        <video src={file.url} className="w-full h-full object-cover" muted />
      ) : (
        <img src={file.url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
      )}

      {!selectionMode && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onTogglePrimary(tab, file.url); }}
              className={cn(
                "p-1.5 rounded-full transition-colors",
                isPrimary
                  ? "bg-gold text-charcoal hover:bg-gold/80"
                  : "bg-cream/20 hover:bg-gold hover:text-charcoal text-cream"
              )}
              title={isPrimary ? "Remover como principal" : "Definir como principal (capa)"}
            >
              <Star className={cn("h-3.5 w-3.5", isPrimary && "fill-current")} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(tab, file.name); }}
              className="p-1.5 rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <span className="text-xs text-white/80 font-body px-2 text-center truncate max-w-full">
            {file.name}
          </span>
        </div>
      )}

      {selected && selectionMode && (
        <div className="absolute inset-0 bg-primary/20 pointer-events-none" />
      )}

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

type PrimaryByTab = Partial<Record<StorageTab, string>>;

// Map tab → media_config primary key
const TAB_TO_PRIMARY_KEY: Record<StorageTab, "projeto3d" | "fotos" | "projetoExecutivo" | "video3d"> = {
  "3d": "projeto3d",
  fotos: "fotos",
  exec: "projetoExecutivo",
  video: "video3d",
};

export function MediaUploadSection({ publicId, budgetId }: MediaUploadSectionProps) {
  const [activeTab, setActiveTab] = useState<MediaTab>("3d");
  const [files, setFiles] = useState<Record<StorageTab, MediaFile[]>>({ "3d": [], fotos: [], exec: [], video: [] });
  const [primary, setPrimary] = useState<PrimaryByTab>({});
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<null | { kind: "selected" | "all-tab" | "all"; count: number } | { kind: "single"; tab: StorageTab; fileName: string }>(null);
  const [confirmAllText, setConfirmAllText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Tour 3D state
  const [tours, setTours] = useState<TourEntry[]>([]);
  const [toursLoading, setToursLoading] = useState(false);
  const [toursSaving, setToursSaving] = useState(false);

  // Floor plan attachment state
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null);
  const [floorPlanUploading, setFloorPlanUploading] = useState(false);
  const floorPlanInputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const folderMap: Record<StorageTab, string> = useMemo(() => ({
    "3d": `${publicId}/3d`,
    fotos: `${publicId}/fotos`,
    exec: `${publicId}/exec`,
    video: `${publicId}/video`,
  }), [publicId]);

  const tabs: { id: MediaTab; label: string; icon: React.ReactNode; accept: string }[] = [
    { id: "3d", label: "Renders 3D", icon: <ImageIcon className="h-4 w-4" />, accept: "image/*" },
    { id: "fotos", label: "Fotos", icon: <ImageIcon className="h-4 w-4" />, accept: "image/*" },
    { id: "exec", label: "Projeto Executivo", icon: <FileText className="h-4 w-4" />, accept: "image/*" },
    { id: "video", label: "Vídeo 3D", icon: <Play className="h-4 w-4" />, accept: "video/*" },
    { id: "tour3d", label: "Tour 3D", icon: <Compass className="h-4 w-4" />, accept: "" },
  ];

  // Sync Storage state → budget.media_config so useBudgetMedia picks it up
  const syncMediaConfig = useCallback(async (
    storageFiles: Record<StorageTab, MediaFile[]>,
    primaryByTab: PrimaryByTab,
  ) => {
    const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);
    const projeto3d = storageFiles["3d"].filter(f => !isVideo(f.url)).map(f => f.url);
    const projetoExecutivo = storageFiles.exec.filter(f => !isVideo(f.url)).map(f => f.url);
    const fotos = storageFiles.fotos.filter(f => !isVideo(f.url)).map(f => f.url);
    const video3d = storageFiles.video.find(f => isVideo(f.url))?.url ?? storageFiles["3d"].find(f => isVideo(f.url))?.url;

    // Validate primary URLs still exist; drop stale ones
    const safePrimary = {
      projeto3d: primaryByTab["3d"] && projeto3d.includes(primaryByTab["3d"]) ? primaryByTab["3d"] : undefined,
      fotos: primaryByTab.fotos && fotos.includes(primaryByTab.fotos) ? primaryByTab.fotos : undefined,
      projetoExecutivo: primaryByTab.exec && projetoExecutivo.includes(primaryByTab.exec) ? primaryByTab.exec : undefined,
      video3d: primaryByTab.video,
    };

    const mediaConfig = {
      video3d,
      projeto3d,
      projetoExecutivo,
      fotos,
      primary: safePrimary,
    };
    const { error } = await supabase
      .from("budgets")
      .update({ media_config: mediaConfig as unknown as Json })
      .eq("id", budgetId);
    if (error) {
      const msg = `${error.message ?? ""} ${(error as { details?: string }).details ?? ""}`;
      if (msg.includes("published_budget_immutable")) {
        toast.error("Não foi possível salvar a foto. Verifique se o orçamento permite edição ou crie uma nova versão.");
        logger.error("[media-upload] published_budget_immutable", {
          budgetId,
          action: "syncMediaConfig",
          error,
        });
      } else {
        toast.error("Erro ao salvar configuração de mídia. Tente novamente.");
        logger.error("[media-upload] syncMediaConfig failed", { budgetId, error });
      }
      throw error;
    }
  }, [budgetId]);

  const loadFiles = useCallback(async (syncToDb = false) => {
    setLoading(true);
    const result: Record<StorageTab, MediaFile[]> = { "3d": [], fotos: [], exec: [], video: [] };

    try {
      // Parallel listing of all folders + media_config primary
      const tabs = Object.keys(folderMap) as StorageTab[];
      const [listings, configRes] = await Promise.all([
        Promise.all(
          tabs.map(tab =>
            supabase.storage.from("media").list(folderMap[tab], { limit: 100, sortBy: { column: "name", order: "asc" } })
              .then(({ data, error }) => ({ tab, data, error }))
          )
        ),
        supabase.from("budgets").select("media_config").eq("id", budgetId).maybeSingle(),
      ]);

      for (const { tab, data, error } of listings) {
        if (error) {
          logger.error(`Error listing ${folderMap[tab]}:`, error.message);
          continue;
        }
        if (data) {
          result[tab] = data
            .filter(f => f.name !== ".emptyFolderPlaceholder" && f.name !== ".lovkeep")
            .map(f => {
              const { data: urlData } = supabase.storage.from("media").getPublicUrl(`${folderMap[tab]}/${f.name}`);
              return { name: f.name, url: urlData.publicUrl };
            });
        }
      }
      setFiles(result);

      // Hydrate primary from DB
      const mc = (configRes.data?.media_config ?? {}) as { primary?: { projeto3d?: string; fotos?: string; projetoExecutivo?: string; video3d?: string } };
      const loadedPrimary: PrimaryByTab = {
        "3d": mc.primary?.projeto3d,
        fotos: mc.primary?.fotos,
        exec: mc.primary?.projetoExecutivo,
        video: mc.primary?.video3d,
      };
      setPrimary(loadedPrimary);

      if (syncToDb) {
        syncMediaConfig(result, loadedPrimary);
      }
    } catch (err) {
      logger.error("loadFiles error:", err);
    } finally {
      setLoading(false);
    }
  }, [folderMap, syncMediaConfig, budgetId]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const togglePrimary = useCallback(async (tab: StorageTab, url: string) => {
    const next: PrimaryByTab = { ...primary };
    if (next[tab] === url) {
      delete next[tab];
    } else {
      next[tab] = url;
    }
    setPrimary(next);
    await syncMediaConfig(files, next);
    toast.success(next[tab] ? "Mídia principal definida (capa)" : "Marcação de capa removida");
  }, [primary, files, syncMediaConfig]);

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
    const fileArr = Array.from(fileList);
    setUploadProgress({ done: 0, total: fileArr.length });
    try {
      const folder = folderMap[activeTab as StorageTab];
      const existingCount = files[activeTab as StorageTab].length;

      // Parallel uploads (batches of 3 to avoid overwhelming)
      const BATCH_SIZE = 3;
      let count = 0;

      for (let batch = 0; batch < fileArr.length; batch += BATCH_SIZE) {
        const chunk = fileArr.slice(batch, batch + BATCH_SIZE);
        const results = await Promise.allSettled(
          chunk.map(async (file, idx) => {
            const globalIdx = batch + idx;
            const safeName = sanitizeFileName(file.name);
            const prefixed = addPrefix(existingCount + globalIdx, safeName);
            const path = `${folder}/${prefixed}`;
            try {
              await uploadWithRetry({
                bucket: "media",
                path,
                file,
                upsert: true,
                contentType: file.type || "application/octet-stream",
                onRetry: (attempt) => {
                  toast.message(`Reenviando ${file.name} (tentativa ${attempt}/3)…`);
                },
              });
              return true;
            } catch (e) {
              const message = e instanceof Error ? e.message : "Erro desconhecido";
              throw { fileName: file.name, message };
            } finally {
              setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
            }
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            count++;
          } else {
            const err = r.reason as { fileName?: string; message?: string };
            const msg = err?.message || "Erro desconhecido";
            if (msg.includes("row-level security")) {
              toast.error("Sem permissão para upload. Verifique se está logado.");
            } else if (msg.includes("Payload too large")) {
              toast.error(`Arquivo ${err?.fileName || ""} muito grande.`);
            } else {
              toast.error(`Erro ao subir ${err?.fileName || ""}: ${msg}`);
            }
          }
        }
      }

      if (count > 0) {
        toast.success(`${count} arquivo(s) enviado(s) com sucesso!`);
        await loadFiles(true);
      }
    } catch (err) {
      logger.error("handleUpload error:", err);
      toast.error("Erro inesperado no upload. Tente novamente.");
    } finally {
      setUploading(false);
      setUploadProgress({ done: 0, total: 0 });
    }
  };

  const handleDelete = useCallback((tab: StorageTab, fileName: string) => {
    setConfirmDialog({ kind: "single", tab, fileName });
  }, []);

  /* ── Selection helpers ── */
  const toggleSelect = useCallback((name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Set());
  }, []);

  // Reset selection when changing tab
  useEffect(() => {
    setSelected(new Set());
    setSelectionMode(false);
  }, [activeTab]);

  const selectAllInTab = useCallback(() => {
    if (activeTab === "tour3d") return;
    const all = files[activeTab as StorageTab].map(f => f.name);
    setSelected(new Set(all));
  }, [activeTab, files]);

  /* ── Bulk delete ── */
  const performBulkDelete = useCallback(async (paths: string[], successMsg: string) => {
    if (paths.length === 0) return;
    setBulkDeleting(true);
    try {
      const BATCH = 100;
      const removedTotal: string[] = [];
      for (let i = 0; i < paths.length; i += BATCH) {
        const slice = paths.slice(i, i + BATCH);
        const { data, error } = await supabase.storage.from("media").remove(slice);
        if (error) throw error;
        if (data) removedTotal.push(...data.map((d: { name: string }) => d.name));
      }

      if (removedTotal.length === 0) {
        toast.warning("Nenhum arquivo foi apagado. Você pode não ter permissão para remover esses arquivos.");
        logger.error("[media-delete] zero removed", { expectedPaths: paths, publicId, budgetId });
        return;
      }

      if (removedTotal.length < paths.length) {
        toast.warning(`Apagados ${removedTotal.length} de ${paths.length} arquivos. Alguns falharam (permissão ou já removidos).`);
      } else {
        toast.success(successMsg);
      }

      // Auditoria
      try {
        const { data: auth } = await supabase.auth.getUser();
        await supabase.from("media_change_log").insert({
          budget_id: budgetId,
          public_id: publicId,
          changed_by: auth?.user?.id ?? null,
          change_type: 'storage_delete',
          deleted_paths: removedTotal,
          source: 'web_app',
        });
      } catch (auditErr) {
        logger.error("[media-delete] audit insert failed", auditErr);
      }

      exitSelectionMode();
      await loadFiles(true);
    } catch (err) {
      logger.error("Bulk delete error:", err);
      toast.error("Erro ao apagar arquivos. Tente novamente.");
    } finally {
      setBulkDeleting(false);
      setConfirmDialog(null);
      setConfirmAllText("");
    }
  }, [exitSelectionMode, loadFiles, budgetId, publicId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDialog) return;

    if (confirmDialog.kind === "single") {
      const path = `${folderMap[confirmDialog.tab]}/${confirmDialog.fileName}`;
      await performBulkDelete([path], `Arquivo removido.`);
      return;
    }

    if (confirmDialog.kind === "selected") {
      if (activeTab === "tour3d") return;
      const folder = folderMap[activeTab as StorageTab];
      const paths = Array.from(selected).map(name => `${folder}/${name}`);
      await performBulkDelete(paths, `${paths.length} arquivo(s) removido(s).`);
      return;
    }

    if (confirmDialog.kind === "all-tab") {
      if (activeTab === "tour3d") return;
      const folder = folderMap[activeTab as StorageTab];
      const paths = files[activeTab as StorageTab].map(f => `${folder}/${f.name}`);
      await performBulkDelete(paths, `Aba "${activeTab}" limpa (${paths.length} arquivo(s)).`);
      return;
    }

    if (confirmDialog.kind === "all") {
      logger.warn("[media-delete] APAGAR TUDO acionado", { budgetId, publicId, total: totalAllTabs });
      const allPaths: string[] = [];
      (Object.keys(folderMap) as StorageTab[]).forEach(tab => {
        files[tab].forEach(f => allPaths.push(`${folderMap[tab]}/${f.name}`));
      });
      await performBulkDelete(allPaths, `Todas as mídias apagadas (${allPaths.length} arquivo(s)).`);
    }
  }, [confirmDialog, activeTab, folderMap, selected, files, performBulkDelete, budgetId, publicId]);

  const totalAllTabs = Object.values(files).reduce((sum, arr) => sum + arr.length, 0);

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
          logger.error("Download error for reorder:", dlErr);
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
        logger.error("Bulk remove error:", removeErr);
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
          logger.error("Upload error:", upErr);
          throw new Error(`Falha ao enviar ${entry.newName}`);
        }
      }

      toast.success("Ordem atualizada!");
      await loadFiles(true);
    } catch (err) {
      logger.error("Reorder error:", err);
      toast.error("Erro ao reordenar. Tente novamente.");
      await loadFiles(true);
    }

    setReordering(false);
  }, [files, activeTab, folderMap, loadFiles]);

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
    if (error) logger.error('Failed to load tours:', error.message);
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

  // Load floor plan URL
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("budgets")
        .select("floor_plan_url")
        .eq("id", budgetId)
        .maybeSingle();
      if (!cancelled) setFloorPlanUrl(data?.floor_plan_url ?? null);
    })();
    return () => { cancelled = true; };
  }, [budgetId]);

  const handleFloorPlanUpload = async (file: File | null | undefined) => {
    if (!file) return;
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    if (!isPdf && !isPng) {
      toast.error("Apenas arquivos PDF ou PNG são aceitos.");
      return;
    }
    setFloorPlanUploading(true);
    try {
      const ext = isPdf ? "pdf" : "png";
      const path = `floor-plans/${budgetId}-${Date.now()}.${ext}`;
      await uploadWithRetry({
        bucket: "budget-assets",
        path,
        file,
        upsert: true,
        contentType: isPdf ? "application/pdf" : "image/png",
      });
      const { data: { publicUrl } } = supabase.storage.from("budget-assets").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("budgets")
        .update({ floor_plan_url: publicUrl })
        .eq("id", budgetId);
      if (updErr) throw updErr;
      setFloorPlanUrl(publicUrl);
      toast.success("Planta anexada com sucesso!");
    } catch (err) {
      logger.error("floor plan upload error:", err);
      toast.error("Erro ao anexar planta. Tente novamente.");
    } finally {
      setFloorPlanUploading(false);
    }
  };

  const handleFloorPlanRemove = async () => {
    try {
      const { error } = await supabase
        .from("budgets")
        .update({ floor_plan_url: null })
        .eq("id", budgetId);
      if (error) throw error;
      setFloorPlanUrl(null);
      toast.success("Planta removida.");
    } catch (err) {
      logger.error("floor plan remove error:", err);
      toast.error("Erro ao remover planta.");
    }
  };

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
      logger.error("Error saving tours:", err);
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

        {/* Floor plan attachment */}
        <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <h4 className="font-display font-semibold text-sm text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-primary" />
                Planta do imóvel
              </h4>
              <p className="text-[11px] text-muted-foreground font-body mt-0.5">
                Anexe a planta em PDF ou PNG. Uso interno do orçamentista.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => floorPlanInputRef.current?.click()}
                disabled={floorPlanUploading}
                className="gap-2"
              >
                {floorPlanUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {floorPlanUrl ? "Substituir" : "Anexar planta"}
              </Button>
              {floorPlanUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleFloorPlanRemove}
                  disabled={floorPlanUploading}
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                  Remover
                </Button>
              )}
            </div>
          </div>
          <input
            ref={floorPlanInputRef}
            type="file"
            accept="application/pdf,image/png,.pdf,.png"
            className="hidden"
            onChange={(e) => {
              handleFloorPlanUpload(e.target.files?.[0]);
              if (e.target) e.target.value = "";
            }}
          />
          {floorPlanUrl && (
            <a
              href={floorPlanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-body text-primary hover:underline break-all inline-flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              Abrir planta anexada
            </a>
          )}
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
                  <div key={tour.id ?? `${tour.room_id}-${index}`} className="flex items-start gap-2 p-3 rounded-lg border border-border bg-muted/30">
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
            {/* Action toolbar */}
            <div className="flex flex-wrap items-center gap-2">
              {!selectionMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => inputRef.current?.click()}
                    disabled={uploading || reordering || bulkDeleting}
                    className="gap-2"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    {uploading
                      ? uploadProgress.total > 0
                        ? `Enviando ${uploadProgress.done}/${uploadProgress.total}…`
                        : "Enviando..."
                      : "Adicionar arquivos"}
                  </Button>
                  {uploading && uploadProgress.total > 0 && (
                    <Progress
                      value={(uploadProgress.done / uploadProgress.total) * 100}
                      className="h-1.5 w-40"
                      aria-label="Progresso do upload"
                    />
                  )}

                  {currentFiles.length > 0 && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectionMode(true)}
                        disabled={uploading || reordering || bulkDeleting}
                        className="gap-2"
                      >
                        <CheckSquare className="h-4 w-4" />
                        Selecionar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({ kind: "all-tab", count: currentFiles.length })}
                        disabled={uploading || reordering || bulkDeleting}
                        className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Limpar aba
                      </Button>
                    </>
                  )}

                  {totalAllTabs > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmDialog({ kind: "all", count: totalAllTabs })}
                      disabled={uploading || reordering || bulkDeleting}
                      className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 ml-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      Apagar todas as mídias
                    </Button>
                  )}

                  <span className="text-xs text-muted-foreground font-body w-full sm:w-auto sm:ml-auto">
                    Pasta: <code className="bg-muted px-1 py-0.5 rounded text-xs">{folderMap[activeTab as StorageTab]}</code>
                  </span>
                </>
              ) : (
                <>
                  <span className="text-sm font-display font-semibold text-foreground">
                    {selected.size} de {currentFiles.length} selecionada(s)
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllInTab}
                    disabled={bulkDeleting}
                    className="gap-2"
                  >
                    <CheckSquare className="h-4 w-4" />
                    Selecionar tudo
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelected(new Set())}
                    disabled={bulkDeleting || selected.size === 0}
                    className="gap-2"
                  >
                    <Square className="h-4 w-4" />
                    Limpar seleção
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmDialog({ kind: "selected", count: selected.size })}
                    disabled={bulkDeleting || selected.size === 0}
                    className="gap-2"
                  >
                    {bulkDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Apagar selecionadas ({selected.size})
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectionMode}
                    disabled={bulkDeleting}
                    className="gap-2 ml-auto"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                </>
              )}
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
                        selectionMode={selectionMode}
                        selected={selected.has(f.name)}
                        onToggleSelect={toggleSelect}
                        isPrimary={primary[activeTab as StorageTab] === f.url}
                        onTogglePrimary={togglePrimary}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            <p className="text-xs text-muted-foreground font-body">
              ✅ Os arquivos enviados aqui aparecem automaticamente na galeria pública. Arraste para reordenar e clique na <Star className="inline h-3 w-3 -mt-0.5 text-gold fill-gold" /> para definir uma <strong className="text-foreground">capa principal</strong> por aba (aparece primeiro no público).
            </p>
          </>
        )}

        {/* Confirmation dialog for bulk delete */}
        <AlertDialog open={!!confirmDialog} onOpenChange={(open) => !open && !bulkDeleting && setConfirmDialog(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmDialog?.kind === "selected" && "Apagar mídias selecionadas?"}
                {confirmDialog?.kind === "all-tab" && `Limpar a aba "${currentTab.label}"?`}
                {confirmDialog?.kind === "all" && "Apagar todas as mídias do orçamento?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDialog?.kind === "selected" && `Você está prestes a apagar ${confirmDialog.count} arquivo(s). Esta ação é permanente e não pode ser desfeita.`}
                {confirmDialog?.kind === "all-tab" && `Você está prestes a apagar todos os ${confirmDialog.count} arquivo(s) desta aba. Esta ação é permanente e não pode ser desfeita.`}
                {confirmDialog?.kind === "all" && `Você está prestes a apagar TODAS as ${confirmDialog.count} mídias deste orçamento (renders 3D, fotos, projeto executivo e vídeo). Esta ação é permanente e não pode ser desfeita.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={bulkDeleting}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); handleConfirmDelete(); }}
                disabled={bulkDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {bulkDeleting ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Apagando...</>
                ) : (
                  "Apagar"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
