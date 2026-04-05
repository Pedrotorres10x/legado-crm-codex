import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PropertyImageRow {
  id: string;
  images: string[] | null;
  image_order: string[] | null;
}

interface StorageFile {
  name: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all available properties
    const { data: properties, error } = await supabase
      .from("properties")
      .select("id, images, image_order")
      .eq("status", "disponible");

    if (error) throw error;

    let synced = 0;
    let skipped = 0;

    for (const prop of (properties || []) as PropertyImageRow[]) {
      // List files in storage for this property
      const { data: files } = await supabase.storage
        .from("property-media")
        .list(prop.id, { limit: 200 });

      const imageFiles = ((files || []) as StorageFile[]).filter((f) =>
        /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(f.name)
      );

      if (imageFiles.length === 0) {
        skipped++;
        continue;
      }

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const storageUrls = imageFiles.map(
        (f) => `${supabaseUrl}/storage/v1/object/public/property-media/${prop.id}/${f.name}`
      );

      const currentImages: string[] = prop.images || [];

      // Normalize URLs for comparison (strip query params)
      const normalize = (u: string) => u.split('?')[0];
      const currentNorm = new Set(currentImages.map(normalize));
      const missingUrls = storageUrls.filter((u: string) => !currentNorm.has(normalize(u)));

      if (missingUrls.length === 0) {
        skipped++;
        continue;
      }

      // Only append missing URLs at the end — never reorder existing images
      // This preserves the manual image_order the user set
      const finalImages = [...currentImages, ...missingUrls];

      const { error: updateErr } = await supabase
        .from("properties")
        .update({ images: finalImages })
        .eq("id", prop.id);

      if (updateErr) {
        console.error(`Failed to update ${prop.id}:`, updateErr.message);
      } else {
        synced++;
        console.log(`Synced ${prop.id}: +${missingUrls.length} images`);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, total: (properties || []).length, synced, skipped }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("sync-property-images error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
