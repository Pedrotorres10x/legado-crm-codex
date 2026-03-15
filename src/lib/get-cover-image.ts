// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SUPABASE_URL: string = (import.meta as any).env?.VITE_SUPABASE_URL ?? '';

/**
 * Returns the cover image URL respecting image_order.
 * The first entry in image_order is always the cover photo.
 *
 * When the first entry has `source: "storage"`, builds a public URL
 * from the `property-media` bucket using the propertyId.
 */
export const getCoverImage = (
  images?: string[] | null,
  imageOrder?: any[] | null,
  propertyId?: string | null,
): string | null => {
  // 1. Check image_order for storage-backed cover
  if (imageOrder && Array.isArray(imageOrder) && imageOrder.length > 0) {
    const firstEntry = imageOrder[0];
    if (typeof firstEntry === 'object' && firstEntry !== null) {
      if (firstEntry.source === 'storage' && propertyId && firstEntry.name) {
        return `${SUPABASE_URL}/storage/v1/object/public/property-media/${propertyId}/${firstEntry.name}`;
      }
    }
  }

  if (!images || images.length === 0) return null;

  if (imageOrder && Array.isArray(imageOrder) && imageOrder.length > 0) {
    const firstEntry = imageOrder[0];
    const name = typeof firstEntry === 'string' ? firstEntry : firstEntry?.name;

    if (typeof name === 'string') {
      // New format: xmlurl_<URL> — URL is embedded in the name
      if (name.startsWith('xmlurl_')) {
        return name.replace('xmlurl_', '');
      }

      // Legacy format: xml_N index
      if (name.startsWith('xml_')) {
        const idx = parseInt(name.replace('xml_', ''), 10);
        if (!isNaN(idx) && idx < images.length) return images[idx];
      }

      const found = images.find((url: string) => url.includes(name));
      if (found) return found;
    }
  }

  return images[0];
};
