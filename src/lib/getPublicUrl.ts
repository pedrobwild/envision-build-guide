/**
 * Returns the public-facing URL for a budget.
 * Uses the published domain when available, falling back to window.location.origin for local dev.
 */
export function getPublicBudgetUrl(publicId: string): string {
  const publishedDomain = "https://envision-build-guide.lovable.app";
  return `${publishedDomain}/o/${publicId}`;
}
