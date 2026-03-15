import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI, AIError } from '../_shared/ai.ts';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const { rawNotes, contactName, direction, result } = await req.json();

    const aiResult = await callAI('google/gemini-3-flash-preview', [
      {
        role: 'system',
        content: `Eres un asistente de CRM inmobiliario. Recibes notas en bruto de una llamada telefónica y debes generar un resumen estructurado y conciso en español. El resumen debe incluir:
- **Motivo**: Por qué se realizó o recibió la llamada
- **Puntos clave**: Los temas principales tratados (máximo 3-4 puntos)
- **Acuerdos**: Compromisos o decisiones tomadas
- **Próximos pasos**: Acciones pendientes

Si las notas son muy breves o poco claras, haz lo mejor posible con la información disponible. Responde SOLO con el resumen, sin preámbulos.`,
      },
      {
        role: 'user',
        content: `Contacto: ${contactName}\nDirección: ${direction}\nResultado: ${result}\n\nNotas en bruto:\n${rawNotes}`,
      },
    ]);

    return json({ summary: aiResult.content || '' });
  } catch (e) {
    if (e instanceof AIError) {
      return json({ error: e.message }, e.status);
    }
    console.error('ai-call-summary error:', e);
    return json({ error: e instanceof Error ? e.message : 'Unknown error' }, 500);
  }
});
