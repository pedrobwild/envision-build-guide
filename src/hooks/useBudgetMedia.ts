import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DynamicBudgetMedia = {
  video3d?: string;
  projeto3d: string[];
  projetoExecutivo: string[];
  fotos: string[];
};

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

export function useBudgetMedia(publicId: string | undefined) {
  const [media, setMedia] = useState<DynamicBudgetMedia | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicId) {
      setMedia(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setLoading(true);

      const [projeto3d, fotos, exec, videos] = await Promise.all([
        listPublicUrls(`${publicId}/3d`),
        listPublicUrls(`${publicId}/fotos`),
        listPublicUrls(`${publicId}/exec`),
        listPublicUrls(`${publicId}/video`),
      ]);

      if (cancelled) return;

      // Filter out videos from 3d folder (shouldn't happen but be safe)
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

    fetch();
    return () => { cancelled = true; };
  }, [publicId]);

  return { media, loading };
}
