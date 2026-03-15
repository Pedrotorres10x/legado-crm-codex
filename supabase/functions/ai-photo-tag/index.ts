import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

// Room labels for classification
const ROOM_ORDER: Record<string, number> = {
  fachada: 1, entrada: 2, salon: 3, comedor: 4, cocina: 5,
  dormitorio_principal: 6, dormitorio: 7, bano: 8, aseo: 9,
  terraza: 10, balcon: 11, jardin: 12, piscina: 13, garaje: 14,
  trastero: 15, escalera: 16, pasillo: 17, vistas: 18, plano: 19, otro: 20,
};

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Invalid token" }, 401);
    }

    const { images } = await req.json();

    if (!images || !Array.isArray(images) || images.length === 0) {
      return json({ error: "No images provided" }, 400);
    }

    const roomLabels = Object.keys(ROOM_ORDER);

    const userContent: any[] = [
      {
        type: "text",
        text: `Eres un experto en fotografía inmobiliaria y marketing digital. Analiza estas ${images.length} imágenes de un inmueble.

Para cada imagen (numeradas del 0 al ${images.length - 1}), haz DOS cosas:

1. **Clasifica** qué estancia o zona muestra.
   Categorías válidas: ${roomLabels.join(", ")}

2. **Puntúa de 1 a 100** su atractivo visual como foto de portada para un anuncio inmobiliario.
   Criterios de puntuación:
   - Luminosidad y calidad de luz natural (0-20 pts)
   - Composición y encuadre profesional (0-20 pts)
   - Amplitud y sensación de espacio (0-20 pts)
   - Atractivo emocional (0-25 pts)
   - Orden, limpieza y home staging (0-15 pts)

Responde SOLO con un JSON array: [{"index": 0, "label": "salon", "score": 85}, ...]
Si hay varios dormitorios, usa "dormitorio_principal" para el más grande.
No añadas texto extra, solo el JSON array.`,
      },
    ];

    for (const img of images) {
      userContent.push({ type: "image_url", image_url: { url: img.url } });
    }

    const aiResult = await callAI('google/gemini-2.5-flash', [
      { role: 'user', content: userContent as any },
    ]);

    const rawText = aiResult.content || "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    let labels: { index: number; label: string; score?: number }[] = [];
    if (jsonMatch) {
      try { labels = JSON.parse(jsonMatch[0]); } catch { labels = []; }
    }

    const result = labels.map((item) => ({
      index: item.index,
      label: roomLabels.includes(item.label) ? item.label : "otro",
      score: typeof item.score === "number" ? Math.min(100, Math.max(0, item.score)) : 50,
      order: ROOM_ORDER[item.label] ?? ROOM_ORDER["otro"],
    }));

    result.sort((a, b) => b.score - a.score || a.order - b.order);

    return json({ labels: result });
  } catch (e) {
    if (e instanceof AIError) return json({ error: e.message }, e.status);
    console.error("ai-photo-tag error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
