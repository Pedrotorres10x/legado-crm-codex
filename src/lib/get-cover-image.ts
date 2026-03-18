// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL ?? '';
const VIDEO_URL_PATTERN = /\.(mp4|mov|webm|m4v|avi)(\?|#|$)/i;
const EMBED_VIDEO_PATTERN = /(youtube\.com|youtu\.be|vimeo\.com)/i;

const isVideoValue = (value: unknown): boolean => (
  typeof value === 'string' && (VIDEO_URL_PATTERN.test(value) || EMBED_VIDEO_PATTERN.test(value))
);

const resolveCoverCandidate = (
  entry: unknown,
  images: string[],
  propertyId?: string | null,
): string | null => {
  if (!entry) return null;

  if (typeof entry === 'object' && entry !== null) {
    const candidate = entry as { source?: string; name?: string; url?: string };

    if (candidate.source === 'storage') {
      if (typeof candidate.name === 'string' && !isVideoValue(candidate.name) && propertyId) {
        return `${SUPABASE_URL}/storage/v1/object/public/property-media/${propertyId}/${candidate.name}`;
      }
      return null;
    }

    if (typeof candidate.url === 'string' && !isVideoValue(candidate.url)) return candidate.url;
  }

  const name = typeof entry === 'string' ? entry : (entry as { name?: unknown })?.name;
  if (typeof name !== 'string' || isVideoValue(name)) return null;

  if (name.startsWith('xmlurl_')) {
    const url = name.replace('xmlurl_', '');
    return isVideoValue(url) ? null : url;
  }

  if (/^https?:\/\//i.test(name)) return name;

  if (name.startsWith('xml_')) {
    const idx = parseInt(name.replace('xml_', ''), 10);
    const candidate = !isNaN(idx) ? images[idx] : null;
    return candidate && !isVideoValue(candidate) ? candidate : null;
  }

  return images.find((url: string) => !isVideoValue(url) && url.includes(name)) ?? null;
};

/**
 * Returns the cover image URL respecting image_order.
 * The first entry in image_order is always the cover photo.
 *
 * When the first entry has `source: "storage"`, builds a public URL
 * from the `property-media` bucket using the propertyId.
 */
export const getCoverImage = (
  images?: string[] | null,
  imageOrder?: unknown[] | null,
  propertyId?: string | null,
): string | null => {
  const safeImages = (images || []).filter((url) => typeof url === 'string' && !isVideoValue(url));

  if (imageOrder && Array.isArray(imageOrder) && imageOrder.length > 0) {
    for (const entry of imageOrder) {
      const candidate = resolveCoverCandidate(entry, safeImages, propertyId);
      if (candidate) return candidate;
    }
  }

  return safeImages[0] ?? null;
};
