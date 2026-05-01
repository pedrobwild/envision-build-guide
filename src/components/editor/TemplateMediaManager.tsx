import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Video, Camera, Plus, Trash2, Upload, Loader2, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────

export interface MediaConfig {
  video3d?: string;
  projeto3d: string[];
  projetoExecutivo: string[];
  fotos: string[];
}

export const EMPTY_MEDIA_CONFIG: MediaConfig = {
  projeto3d: [],
  projetoExecutivo: [],
  fotos: [],
};

interface Props {
  templateId: string;
  mediaConfig: MediaConfig;
  onChange: (mc: MediaConfig) => void;
}

type MediaCategory = "video3d" | "projeto3d" | "projetoExecutivo" | "fotos";

const CATEGORIES: { key: MediaCategory; label: string; icon: React.ReactNode; isArray: boolean; accept: string }[] = [
  { key: "video3d", label: "Vídeo 3D", icon: <Video className="h-4 w-4" />, isArray: false, accept: "video/mp4,video/webm,video/quicktime" },
  { key: "projeto3d", label: "Fotos 3D", icon: <Camera className="h-4 w-4" />, isArray: true, accept: "image/*" },
  { key: "projetoExecutivo", label: "Projeto Executivo", icon: <Camera className="h-4 w-4" />, isArray: true, accept: "image/*" },
  { key: "fotos", label: "Fotos do Projeto", icon: <Camera className="h-4 w-4" />, isArray: true, accept: "image/*" },
];

const BUCKET = "media";

// ─── Component ───────────────────────────────────────────────────

export default function TemplateMediaManager({ templateId, mediaConfig, onChange }: Props) {
  const [uploading, setUploading] = useState<MediaCategory | null>(null);
  const [urlInput, setUrlInput] = useState<Record<MediaCategory, string>>({
    video3d: "", projeto3d: "", projetoExecutivo: "", fotos: "",
  });

  const uploadFile = useCallback(async (file: File, category: MediaCategory) => {
    const ext = file.name.split(".").pop() ?? "bin";
    const path = `templates/${templateId}/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return urlData.publicUrl;
  }, [templateId]);

  const handleFileUpload = useCallback(async (files: FileList | null, category: MediaCategory) => {
    if (!files || files.length === 0) return;
    setUploading(category);

    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        const url = await uploadFile(file, category);
        urls.push(url);
      }

      const updated: MediaConfig = {
        ...EMPTY_MEDIA_CONFIG,
        ...mediaConfig,
        projeto3d: Array.isArray(mediaConfig?.projeto3d) ? [...mediaConfig.projeto3d] : [],
        projetoExecutivo: Array.isArray(mediaConfig?.projetoExecutivo) ? [...mediaConfig.projetoExecutivo] : [],
        fotos: Array.isArray(mediaConfig?.fotos) ? [...mediaConfig.fotos] : [],
      };
      if (category === "video3d") {
        updated.video3d = urls[0];
      } else {
        const current = Array.isArray(updated[category]) ? (updated[category] as string[]) : [];
        updated[category] = [...current, ...urls];
      }
      onChange(updated);
      toast.success(`${urls.length} arquivo(s) enviado(s)`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erro no upload: ${msg}`);
    } finally {
      setUploading(null);
    }
  }, [mediaConfig, onChange, uploadFile]);

  const addUrl = useCallback((category: MediaCategory) => {
    const url = urlInput[category]?.trim();
    if (!url) return;

    const updated: MediaConfig = {
      ...EMPTY_MEDIA_CONFIG,
      ...mediaConfig,
      projeto3d: Array.isArray(mediaConfig?.projeto3d) ? [...mediaConfig.projeto3d] : [],
      projetoExecutivo: Array.isArray(mediaConfig?.projetoExecutivo) ? [...mediaConfig.projetoExecutivo] : [],
      fotos: Array.isArray(mediaConfig?.fotos) ? [...mediaConfig.fotos] : [],
    };
    if (category === "video3d") {
      updated.video3d = url;
    } else {
      const current = Array.isArray(updated[category]) ? (updated[category] as string[]) : [];
      updated[category] = [...current, url];
    }
    onChange(updated);
    setUrlInput(prev => ({ ...prev, [category]: "" }));
  }, [mediaConfig, onChange, urlInput]);

  const removeItem = useCallback((category: MediaCategory, index?: number) => {
    const updated: MediaConfig = {
      ...EMPTY_MEDIA_CONFIG,
      ...mediaConfig,
      projeto3d: Array.isArray(mediaConfig?.projeto3d) ? [...mediaConfig.projeto3d] : [],
      projetoExecutivo: Array.isArray(mediaConfig?.projetoExecutivo) ? [...mediaConfig.projetoExecutivo] : [],
      fotos: Array.isArray(mediaConfig?.fotos) ? [...mediaConfig.fotos] : [],
    };
    if (category === "video3d") {
      updated.video3d = undefined;
    } else {
      const arr = Array.isArray(updated[category]) ? [...(updated[category] as string[])] : [];
      if (index !== undefined) arr.splice(index, 1);
      updated[category] = arr;
    }
    onChange(updated);
  }, [mediaConfig, onChange]);

  const getCount = (cat: MediaCategory) => {
    if (cat === "video3d") return mediaConfig.video3d ? 1 : 0;
    return (mediaConfig[cat] as string[])?.length ?? 0;
  };

  const totalMedia = CATEGORIES.reduce((s, c) => s + getCount(c.key), 0);

  return (
    <div className="rounded-xl border border-border/60 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold font-display">Mídia do Template</span>
          {totalMedia > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-full">
              {totalMedia}
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground font-body">
          Mídias copiadas automaticamente para novos orçamentos
        </p>
      </div>

      {/* Categories */}
      <div className="divide-y divide-border/30">
        {CATEGORIES.map(cat => {
          const count = getCount(cat.key);
          const isUploading = uploading === cat.key;
          const items = cat.key === "video3d"
            ? (mediaConfig.video3d ? [mediaConfig.video3d] : [])
            : ((mediaConfig[cat.key] as string[]) ?? []);

          return (
            <div key={cat.key} className="px-4 py-3">
              {/* Category header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="text-muted-foreground">{cat.icon}</span>
                <span className="text-xs font-semibold font-body text-foreground">{cat.label}</span>
                {count > 0 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full">
                    {count}
                  </Badge>
                )}
              </div>

              {/* Existing items */}
              {items.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {items.map((url, idx) => (
                    <MediaItemRow
                      key={`${cat.key}-${idx}`}
                      url={url}
                      isVideo={cat.key === "video3d"}
                      onRemove={() => removeItem(cat.key, cat.key === "video3d" ? undefined : idx)}
                    />
                  ))}
                </div>
              )}

              {/* Add controls */}
              <div className="flex items-center gap-2">
                {/* File upload button */}
                <label className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors",
                  "bg-primary/10 text-primary hover:bg-primary/20",
                  isUploading && "opacity-50 pointer-events-none"
                )}>
                  {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  Upload
                  <input
                    type="file"
                    className="sr-only"
                    accept={cat.accept}
                    multiple={cat.isArray}
                    onChange={e => handleFileUpload(e.target.files, cat.key)}
                    disabled={isUploading}
                  />
                </label>

                {/* URL input */}
                <div className="flex-1 flex items-center gap-1.5">
                  <Input
                    value={urlInput[cat.key]}
                    onChange={e => setUrlInput(prev => ({ ...prev, [cat.key]: e.target.value }))}
                    placeholder="ou cole uma URL..."
                    className="h-7 text-[11px]"
                    onKeyDown={e => e.key === "Enter" && addUrl(cat.key)}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => addUrl(cat.key)}
                    disabled={!urlInput[cat.key]?.trim()}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sub-component: single media item row ────────────────────────

function MediaItemRow({ url, isVideo, onRemove }: { url: string; isVideo: boolean; onRemove: () => void }) {
  const filename = decodeURIComponent(url.split("/").pop() ?? url).slice(0, 40);

  return (
    <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors">
      {/* Thumbnail */}
      <div className="h-8 w-8 rounded bg-background border border-border/50 overflow-hidden shrink-0 flex items-center justify-center">
        {isVideo ? (
          <Video className="h-4 w-4 text-muted-foreground" />
        ) : (
          <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>

      {/* Filename */}
      <span className="text-[11px] text-muted-foreground font-mono truncate flex-1 min-w-0">
        {filename}
      </span>

      {/* Actions */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <ExternalLink className="h-3 w-3" />
      </a>
      <button
        onClick={onRemove}
        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}
