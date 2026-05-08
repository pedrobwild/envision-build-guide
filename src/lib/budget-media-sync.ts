/**
 * Sincroniza `budgets.media_config` a partir do estado real do Storage
 * em `media/{publicId}/{3d,fotos,exec,video}`.
 *
 * REGRA CRÍTICA (preserva herança do catálogo padrão via template):
 *  - SE o Storage do publicId atual tem arquivos → media_config passa a
 *    refletir 100% o Storage (uploads manuais sobrescrevem template).
 *  - SE o Storage está VAZIO → NÃO toca em media_config (preserva URLs do
 *    catálogo/template que podem ter sido herdadas via apply-default-media).
 *
 * Esta função é a fonte única de verdade para "promover" uploads manuais
 * feitos na aba Mídia para o que é exibido no /o/{publicId}.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { logger } from "@/lib/logger";

type StorageTab = "3d" | "fotos" | "exec" | "video";

const FOLDERS: StorageTab[] = ["3d", "fotos", "exec", "video"];

const isVideo = (url: string) => /\.(mp4|webm|mov)$/i.test(url);
const isHidden = (name: string) =>
  !name || name.startsWith(".") || name === ".emptyFolderPlaceholder" || name === ".lovkeep";

export type SyncMediaConfigResult =
  | { synced: true; reason: "storage_has_files"; counts: Record<StorageTab, number> }
  | { synced: false; reason: "storage_empty_preserve_inheritance" }
  | { synced: false; reason: "no_public_id" }
  | { synced: false; reason: "db_error"; message: string };

/**
 * Lista o Storage do publicId e devolve URLs públicas por pasta.
 */
async function listStorage(publicId: string): Promise<Record<StorageTab, string[]>> {
  const result: Record<StorageTab, string[]> = { "3d": [], fotos: [], exec: [], video: [] };

  await Promise.all(
    FOLDERS.map(async (tab) => {
      const folder = `${publicId}/${tab}`;
      const { data, error } = await supabase.storage
        .from("media")
        .list(folder, { limit: 1000, sortBy: { column: "name", order: "asc" } });
      if (error) {
        logger.warn(`[budget-media-sync] list ${folder} falhou:`, error.message);
        return;
      }
      result[tab] = (data || [])
        .filter((f) => !isHidden(f.name))
        .map((f) => supabase.storage.from("media").getPublicUrl(`${folder}/${f.name}`).data.publicUrl);
    })
  );

  return result;
}

/**
 * Sincroniza media_config do orçamento a partir do Storage do seu publicId.
 *
 * Preserva herança do catálogo: quando o Storage está vazio, NÃO altera o
 * media_config (que pode conter URLs do template/catálogo padrão).
 */
export async function syncMediaConfigFromStorage(
  budgetId: string,
  publicId: string | null | undefined
): Promise<SyncMediaConfigResult> {
  if (!publicId) {
    return { synced: false, reason: "no_public_id" };
  }

  const storage = await listStorage(publicId);
  const counts: Record<StorageTab, number> = {
    "3d": storage["3d"].length,
    fotos: storage.fotos.length,
    exec: storage.exec.length,
    video: storage.video.length,
  };
  const totalFiles = counts["3d"] + counts.fotos + counts.exec + counts.video;

  if (totalFiles === 0) {
    logger.debug(
      `[budget-media-sync] Storage vazio para publicId=${publicId} — preservando media_config (herança do catálogo).`
    );
    return { synced: false, reason: "storage_empty_preserve_inheritance" };
  }

  // Lê primary atual para preservá-lo (validando que ainda existe).
  const { data: existing } = await supabase
    .from("budgets")
    .select("media_config")
    .eq("id", budgetId)
    .maybeSingle();

  const existingPrimary =
    ((existing?.media_config as { primary?: Record<string, string> } | null)?.primary) ?? {};

  const projeto3d = storage["3d"].filter((u) => !isVideo(u));
  const projetoExecutivo = storage.exec.filter((u) => !isVideo(u));
  const fotos = storage.fotos.filter((u) => !isVideo(u));
  const videoUrls = storage.video.filter((u) => isVideo(u));
  const video3d = videoUrls[0] ?? storage["3d"].find((u) => isVideo(u));

  const safePrimary = {
    projeto3d:
      existingPrimary.projeto3d && projeto3d.includes(existingPrimary.projeto3d)
        ? existingPrimary.projeto3d
        : undefined,
    fotos:
      existingPrimary.fotos && fotos.includes(existingPrimary.fotos)
        ? existingPrimary.fotos
        : undefined,
    projetoExecutivo:
      existingPrimary.projetoExecutivo && projetoExecutivo.includes(existingPrimary.projetoExecutivo)
        ? existingPrimary.projetoExecutivo
        : undefined,
    video3d:
      existingPrimary.video3d && videoUrls.includes(existingPrimary.video3d)
        ? existingPrimary.video3d
        : undefined,
  };

  const mediaConfig = {
    video3d,
    projeto3d,
    projetoExecutivo,
    fotos,
    primary: safePrimary,
  };

  const { error: updErr } = await supabase
    .from("budgets")
    .update({ media_config: mediaConfig as unknown as Json })
    .eq("id", budgetId);

  if (updErr) {
    logger.warn(`[budget-media-sync] update falhou para ${budgetId}:`, updErr.message);
    return { synced: false, reason: "db_error", message: updErr.message };
  }

  return { synced: true, reason: "storage_has_files", counts };
}
