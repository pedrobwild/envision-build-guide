/**
 * Helpers to extract the storage object path from a Supabase public URL.
 *
 * Public URLs follow the shape:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path...>
 *
 * Item image URLs persisted in `item_images.url` and template/budget media
 * URLs are stored as the full public URL — when we need to delete the
 * underlying storage object we must convert it back to the bucket-relative
 * path expected by `supabase.storage.from(bucket).remove([path])`.
 */

const PUBLIC_PREFIX = "/storage/v1/object/public/";

/**
 * Returns the bucket-relative path for a public URL, or `null` if the URL
 * doesn't point at the expected bucket. Tolerates query strings and trailing
 * slashes.
 */
export function extractStoragePath(url: string | null | undefined, bucket: string): string | null {
  if (!url) return null;
  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const idx = pathname.indexOf(PUBLIC_PREFIX);
  if (idx === -1) return null;
  const tail = pathname.slice(idx + PUBLIC_PREFIX.length);
  const prefix = `${bucket}/`;
  if (!tail.startsWith(prefix)) return null;
  const path = tail.slice(prefix.length);
  return path ? decodeURIComponent(path) : null;
}

/**
 * Convenience: extract paths for many URLs, dropping ones that don't match
 * the bucket. Used to clean up storage for cascading deletes.
 */
export function extractStoragePaths(urls: Array<string | null | undefined>, bucket: string): string[] {
  const paths: string[] = [];
  for (const u of urls) {
    const p = extractStoragePath(u, bucket);
    if (p) paths.push(p);
  }
  return paths;
}
