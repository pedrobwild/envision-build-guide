/**
 * Shared validation/path helpers for item image uploads.
 *
 * Item images go into the `budget-assets` bucket under
 * `{budgetId}/items/{uuid}.{ext}` and are limited to image MIME types
 * with a max size of `MAX_ITEM_IMAGE_BYTES`.
 */

export const ITEM_IMAGE_BUCKET = "budget-assets";
export const MAX_ITEM_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_MIME_PREFIX = "image/";
const ALLOWED_EXT = /^(jpg|jpeg|png|gif|webp|avif|heic|heif)$/i;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export type ItemImageValidation =
  | { ok: true; ext: string }
  | { ok: false; reason: "format" | "size" | "empty"; message: string };

/** Validate a file destined for `item_images` and resolve its safe extension. */
export function validateItemImageFile(file: File): ItemImageValidation {
  if (!file || file.size === 0) {
    return { ok: false, reason: "empty", message: "Arquivo vazio." };
  }
  const isImageMime = file.type.startsWith(ALLOWED_MIME_PREFIX);
  const rawExt = (file.name.split(".").pop() || "").toLowerCase();
  const extOk = ALLOWED_EXT.test(rawExt);
  if (!isImageMime && !extOk) {
    return { ok: false, reason: "format", message: "Apenas imagens (JPG, PNG, WEBP, GIF) são aceitas." };
  }
  if (file.size > MAX_ITEM_IMAGE_BYTES) {
    return {
      ok: false,
      reason: "size",
      message: `Imagem muito grande (máx ${Math.round(MAX_ITEM_IMAGE_BYTES / 1024 / 1024)} MB).`,
    };
  }
  const ext = extOk ? rawExt : (MIME_TO_EXT[file.type] || "jpg");
  return { ok: true, ext };
}

/**
 * Build the storage path for a new item image. Uses `crypto.randomUUID()`
 * to avoid collisions.
 */
export function buildItemImagePath(budgetId: string, ext: string): string {
  return `${budgetId}/items/${crypto.randomUUID()}.${ext}`;
}
