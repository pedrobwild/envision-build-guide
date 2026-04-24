import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DynamicBudgetMedia = {
  video3d?: string;
  projeto3d: string[];
  projetoExecutivo: string[];
  fotos: string[];
};

type PrimaryMap = {
  video3d?: string;
  projeto3d?: string;
  projetoExecutivo?: string;
  fotos?: string;
};

/** Move a marked-primary URL to the front of its list */
function applyPrimary<T extends DynamicBudgetMedia>(media: T, primary?: PrimaryMap): T {
  if (!primary) return media;
  const reorder = (list: string[], pri?: string) => {
    if (!pri || !list.length) return list;
    const idx = list.indexOf(pri);
    if (idx <= 0) return list;
    return [pri, ...list.slice(0, idx), ...list.slice(idx + 1)];
  };
  return {
    ...media,
    projeto3d: reorder(media.projeto3d, primary.projeto3d),
    projetoExecutivo: reorder(media.projetoExecutivo, primary.projetoExecutivo),
    fotos: reorder(media.fotos, primary.fotos),
    // video3d is single — primary acts as override if exists in storage list
    video3d: primary.video3d ?? media.video3d,
  };
}

const BUCKET = "media";

async function listPublicUrls(folder: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folder, { limit: 100, sortBy: { column: "name", order: "asc" } });

  if (error || !data) return [];

  return data
    .filter(f => f.name !== ".emptyFolderPlaceholder" && f.name !== ".lovkeep")
    .map(f => {
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${folder}/${f.name}`);
      return urlData.publicUrl;
    });
}

function isVideo(url: string) {
  return /\.(mp4|webm|mov)$/i.test(url);
}

/**
 * Fetches media for a budget. Priority:
 * 1. media_config from DB (set by template or manual override)
 * 2. Fallback to Storage folder convention ({publicId}/3d, /fotos, etc.)
 */
export function useBudgetMedia(publicId: string | undefined, budgetId?: string | undefined) {
  const [media, setMedia] = useState<DynamicBudgetMedia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicId && !budgetId) {
      setMedia(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchMedia() {
      setLoading(true);

      // Try media_config from DB first
      if (budgetId || publicId) {
        try {
          let query = supabase.from("budgets").select("media_config");
          if (budgetId) {
            query = query.eq("id", budgetId);
          } else {
            query = query.eq("public_id", publicId!);
          }
          const { data } = await query.maybeSingle();

          if (!cancelled && data?.media_config) {
            const mc = data.media_config as unknown as DynamicBudgetMedia & { primary?: PrimaryMap };
            const hasContent = mc.video3d || mc.projeto3d?.length || mc.projetoExecutivo?.length || mc.fotos?.length;
            if (hasContent) {
              const base: DynamicBudgetMedia = {
                video3d: mc.video3d,
                projeto3d: mc.projeto3d ?? [],
                projetoExecutivo: mc.projetoExecutivo ?? [],
                fotos: mc.fotos ?? [],
              };
              setMedia(applyPrimary(base, mc.primary));
              setLoading(false);
              return;
            }
          }
        } catch {
          // fall through to storage
        }
      }

      if (cancelled) return;

      // Fallback: Storage folder convention
      if (!publicId) {
        setMedia(null);
        setLoading(false);
        return;
      }

      const [projeto3d, fotos, exec, videos] = await Promise.all([
        listPublicUrls(`${publicId}/3d`),
        listPublicUrls(`${publicId}/fotos`),
        listPublicUrls(`${publicId}/exec`),
        listPublicUrls(`${publicId}/video`),
      ]);

      if (cancelled) return;

      const images3d = projeto3d.filter(u => !isVideo(u));
      const video3d = videos.find(u => isVideo(u)) ?? projeto3d.find(u => isVideo(u));

      setMedia({
        video3d,
        projeto3d: images3d,
        projetoExecutivo: exec.filter(u => !isVideo(u)),
        fotos: fotos.filter(u => !isVideo(u)),
      });
      setLoading(false);
    }

    fetchMedia();
    return () => { cancelled = true; };
  }, [publicId, budgetId]);

  return { media, loading };
}
