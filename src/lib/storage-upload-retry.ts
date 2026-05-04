import { supabase } from "@/integrations/supabase/client";

export interface UploadWithRetryOptions {
  bucket: string;
  path: string;
  file: File | Blob;
  upsert?: boolean;
  contentType?: string;
  /** Max retry attempts on failure (default 3). */
  maxRetries?: number;
  /** Called with error message on each retry. */
  onRetry?: (attempt: number, error: string) => void;
}

const NON_RETRIABLE_PATTERNS = [
  "row-level security",
  "Payload too large",
  "Duplicate",
  "already exists",
  "invalid_mime_type",
];

function isNonRetriable(message: string): boolean {
  return NON_RETRIABLE_PATTERNS.some((p) => message.includes(p));
}

/**
 * Upload a file to Supabase Storage with exponential backoff retry.
 * Skips retry for permission/size/duplicate errors that won't recover.
 */
export async function uploadWithRetry({
  bucket,
  path,
  file,
  upsert = true,
  contentType,
  maxRetries = 3,
  onRetry,
}: UploadWithRetryOptions): Promise<void> {
  let lastError = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      upsert,
      contentType: contentType || (file as File).type || "application/octet-stream",
    });
    if (!error) return;
    lastError = error.message;
    if (isNonRetriable(lastError) || attempt === maxRetries) {
      throw new Error(lastError);
    }
    onRetry?.(attempt + 1, lastError);
    // Exponential backoff: 500ms, 1s, 2s
    await new Promise((r) => setTimeout(r, Math.min(500 * 2 ** attempt, 4000)));
  }
  throw new Error(lastError || "Upload falhou");
}
