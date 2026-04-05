import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ImageOrderEntry = {
  name?: string;
  label?: string;
  source?: string;
  url?: string;
  path?: string;
};

type PropertyImageMigrationRow = {
  id: string;
  images: string[] | null;
  image_order: unknown;
};

function normalizeUrl(value: string): string {
  return value.split('?')[0];
}

function rewriteImageOrder(
  imageOrder: unknown,
  migratedUrlMap: Map<string, { newUrl: string; fileName: string }>,
): unknown {
  if (!Array.isArray(imageOrder)) return imageOrder;

  return imageOrder.map((item) => {
    if (!item || typeof item !== 'object') return item;

    const entry = item as ImageOrderEntry;
    const name = typeof entry.name === 'string' ? entry.name : null;
    const url = typeof entry.url === 'string' ? entry.url : null;
    const path = typeof entry.path === 'string' ? entry.path : null;

    const directUrl = name?.startsWith('xmlurl_')
      ? name.replace('xmlurl_', '')
      : name?.startsWith('http')
        ? name
        : url ?? path;

    if (!directUrl) return item;

    const migrated = migratedUrlMap.get(normalizeUrl(directUrl));
    if (!migrated) return item;

    return {
      ...entry,
      name: migrated.fileName,
      source: 'storage',
      url: undefined,
      path: undefined,
    };
  });
}

/**
 * Batch migration: downloads external images (medianewbuild, etc.) to our own
 * storage bucket and rewrites the `images` array in each property.
 *
 * Call with POST { batch_size?: number } (default 5 properties per run).
 * Safe to run repeatedly — only processes properties that still have external URLs.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const batchSize = Math.min(body.batch_size || 5, 20);
    const targetPropertyId: string | undefined = body.property_id;

    // Find properties with external images
    let query = supabase
      .from('properties')
      .select('id, images, image_order');

    if (targetPropertyId) {
      query = query.eq('id', targetPropertyId);
    } else {
      query = query.in('status', ['disponible', 'reservado'])
        .order('updated_at', { ascending: true })
        .limit(200);
    }

    const { data: properties, error } = await query;

    if (error) throw error;

    // Filter to only those with external URLs
    const withExternal = ((properties || []) as PropertyImageMigrationRow[]).filter((p) =>
      p.images?.some((url: string) => !url.includes(supabaseUrl))
    );

    const toProcess = withExternal.slice(0, batchSize);
    let totalMigrated = 0;
    let totalFailed = 0;
    const results: Array<{ id: string; migrated: number; failed: number; total: number }> = [];

    for (const prop of toProcess) {
      const newImages: string[] = [];
      let migrated = 0;
      let failed = 0;
      const migratedUrlMap = new Map<string, { newUrl: string; fileName: string }>();

      for (const imgUrl of (prop.images || [])) {
        // Already our storage URL → keep
        if (imgUrl.includes(supabaseUrl)) {
          newImages.push(imgUrl);
          continue;
        }

        try {
          // Download the image
          const res = await fetch(imgUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            },
          });

          if (!res.ok) {
            console.warn(`[migrate] ${prop.id} - ${res.status} for ${imgUrl}`);
            failed++;
            continue;
          }

          const blob = await res.arrayBuffer();

          // Skip tiny/broken images (< 2KB)
          if (blob.byteLength < 2000) {
            console.warn(`[migrate] ${prop.id} - too small (${blob.byteLength}B): ${imgUrl}`);
            failed++;
            continue;
          }

          // Determine extension from content-type
          const ct = res.headers.get('content-type') || 'image/jpeg';
          const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';

          // Generate a unique filename
          const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${ext}`;
          const storagePath = `${prop.id}/${fileName}`;

          const { error: uploadErr } = await supabase.storage
            .from('property-media')
            .upload(storagePath, blob, {
              contentType: ct,
              upsert: false,
            });

          if (uploadErr) {
            console.error(`[migrate] upload error for ${prop.id}:`, uploadErr.message);
            failed++;
            continue;
          }

          const newUrl = `${supabaseUrl}/storage/v1/object/public/property-media/${storagePath}`;
          newImages.push(newUrl);
          migratedUrlMap.set(normalizeUrl(imgUrl), { newUrl, fileName });
          migrated++;
        } catch (err) {
          console.error(`[migrate] fetch error for ${imgUrl}:`, err);
          failed++;
        }
      }

      // Update property images array
      if (migrated > 0) {
        const rewrittenImageOrder = rewriteImageOrder(prop.image_order, migratedUrlMap);
        const { error: updateErr } = await supabase
          .from('properties')
          .update({ images: newImages, image_order: rewrittenImageOrder })
          .eq('id', prop.id);

        if (updateErr) {
          console.error(`[migrate] update error for ${prop.id}:`, updateErr.message);
        } else {
          console.log(`[migrate] ${prop.id}: migrated ${migrated} images, ${failed} failed`);
        }
      }

      totalMigrated += migrated;
      totalFailed += failed;
      results.push({ id: prop.id, migrated, failed, total: prop.images?.length || 0 });
    }

    return new Response(JSON.stringify({
      ok: true,
      remaining: withExternal.length - toProcess.length,
      processed: toProcess.length,
      totalMigrated,
      totalFailed,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[migrate-property-images] error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
