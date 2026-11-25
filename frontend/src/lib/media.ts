import { API_ORIGIN } from "@/lib/api";

/**
 * Resolve an API-provided media URL against the API origin when it is a
 * root-relative `/storage/...` path. Absolute URLs (S3/R2, Laravel `asset()`,
 * data URIs, blob URLs) are returned unchanged.
 */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (url.startsWith("/storage/")) return `${API_ORIGIN}${url}`;
  if (url.startsWith("storage/")) return `${API_ORIGIN}/${url}`;
  return url;
}
