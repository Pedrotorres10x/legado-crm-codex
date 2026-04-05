import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

interface ScoreToolCall {
  function: {
    arguments: string;
  };
}

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

    const { demand, property } = await req.json();

    const prompt = `Analiza la compatibilidad entre esta demanda de un comprador y esta propiedad inmobiliaria. Responde SOLO con un JSON válido.

DEMANDA DEL COMPRADOR:
${JSON.stringify(demand)}

PROPIEDAD:
${JSON.stringify(property)}

Evalúa estos criterios (0-100 cada uno):
1. Tipo de inmueble (¿coincide el tipo solicitado?)
2. Precio (¿está dentro del rango del comprador?)
3. Ubicación (¿coincide la ciudad/zona?)
4. Superficie (¿cumple el mínimo solicitado?)
5. Habitaciones (¿cumple el mínimo?)
6. Características extra (garaje, piscina, terraza, etc.)

Responde SOLO con este JSON:
{"score": <número 0-100>, "reasons": ["razón1", "razón2"], "recommendation": "<texto corto>"}`;

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      { role: 'system', content: 'Eres un sistema de scoring inmobiliario. Responde siempre con JSON válido, sin markdown ni texto adicional.' },
      { role: 'user', content: prompt },
    ], {
      tools: [{
        type: 'function',
        function: {
          name: 'score_match',
          description: 'Return compatibility score between demand and property',
          parameters: {
            type: 'object',
            properties: {
              score: { type: 'number', description: '0-100 compatibility score' },
              reasons: { type: 'array', items: { type: 'string' }, description: 'Key reasons for the score' },
              recommendation: { type: 'string', description: 'Short recommendation in Spanish' }
            },
            required: ['score', 'reasons', 'recommendation'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: { type: 'function', function: { name: 'score_match' } },
    });

    let result;
    const toolCall = aiResult.tool_calls?.[0] as ScoreToolCall | undefined;
    if (toolCall) {
      result = JSON.parse(toolCall.function.arguments);
    } else {
      const content = aiResult.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 0, reasons: ['No se pudo evaluar'], recommendation: 'Revisar manualmente' };
    }

    return json(result);
  } catch (e) {
    if (e instanceof AIError) {
      return json({ error: e.message }, e.status);
    }
    console.error('ai-scoring error:', e);
    return json({ error: e instanceof Error ? e.message : 'Error desconocido' }, 500);
  }
});
