import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';
import { callAI } from '../_shared/ai.ts';

/**
 * Analyzes recent AI interactions and suggests improved system prompts.
 * Runs periodically (e.g., weekly via cron) or on-demand by admin.
 *
 * For each AI function with enough interactions, it:
 * 1. Gathers recent interactions + quality scores
 * 2. Identifies patterns in successful vs failed interactions
 * 3. Generates an improved system prompt version
 * 4. Saves it as a new (inactive) prompt version for admin review
 */
Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Functions to analyze
    const targetFunctions = ["ai-chat", "ai-description", "ai-search", "ai-summary", "ai-scoring"];
    const results: Record<string, any> = {};

    for (const fnName of targetFunctions) {
      // Get recent interactions (last 7 days)
      const { data: interactions } = await supabase
        .from("ai_interactions")
        .select("id, input_summary, output_summary, quality_score, feedback, duration_ms, created_at")
        .eq("function_name", fnName)
        .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
        .order("created_at", { ascending: false })
        .limit(50);

      if (!interactions || interactions.length < 5) {
        results[fnName] = { skipped: true, reason: "insufficient_data", count: interactions?.length || 0 };
        continue;
      }

      // Get current active prompt
      const { data: currentPrompt } = await supabase
        .from("ai_prompt_versions")
        .select("id, version, system_prompt")
        .eq("function_name", fnName)
        .eq("is_active", true)
        .maybeSingle();

      // Get top memories for this function
      const { data: memories } = await supabase
        .from("ai_memory")
        .select("context_key, content, usage_count, relevance_score")
        .eq("source_function", fnName)
        .eq("is_active", true)
        .order("usage_count", { ascending: false })
        .limit(20);

      // Analyze with AI
      const analysisPrompt = `Analiza estas ${interactions.length} interacciones recientes de la función "${fnName}" de un CRM inmobiliario español y genera recomendaciones de mejora.

INTERACCIONES RECIENTES:
${interactions.map((i: any) => `- Input: ${i.input_summary || "?"} → Output: ${(i.output_summary || "?").substring(0, 100)}${i.quality_score ? ` [Score: ${i.quality_score}]` : ""}${i.feedback ? ` [Feedback: ${i.feedback}]` : ""} (${i.duration_ms}ms)`).join("\n")}

MEMORIAS MÁS USADAS:
${(memories || []).map((m: any) => `- [${m.context_key}] (usado ${m.usage_count}x, relevancia ${m.relevance_score}): ${m.content.substring(0, 100)}`).join("\n") || "Sin memorias"}

PROMPT ACTUAL:
${currentPrompt?.system_prompt?.substring(0, 1000) || "No hay prompt activo guardado"}

Responde SOLO con JSON válido:
{
  "analysis": "resumen del análisis en 2-3 frases",
  "patterns_found": ["patrón 1", "patrón 2"],
  "new_memories": [
    {"category": "cat", "context_key": "key", "content": "lo aprendido"}
  ],
  "prompt_improvements": "mejoras concretas al system prompt (o null si no se necesitan)",
  "improved_prompt": "el nuevo system prompt completo mejorado (o null si no se necesita)"
}`;

      try {
        const aiResult = await callAI("google/gemini-3-flash-preview", [
          { role: "system", content: "Eres un experto en prompt engineering y optimización de sistemas IA. Analiza interacciones reales y sugiere mejoras concretas. Responde siempre en español con JSON válido." },
          { role: "user", content: analysisPrompt },
        ], { max_tokens: 2000 });

        const raw = (aiResult.content || "").replace(/```json?\n?/g, "").replace(/```/g, "").trim();
        const analysis = JSON.parse(raw);

        // Save new memories discovered
        if (analysis.new_memories?.length) {
          for (const mem of analysis.new_memories.slice(0, 5)) {
            await supabase.from("ai_memory").insert({
              category: mem.category || fnName,
              context_key: mem.context_key,
              content: mem.content,
              source_function: fnName,
              relevance_score: 1.5, // auto-discovered memories start slightly higher
            }).then(() => {});
          }
        }

        // Save improved prompt as new version (inactive, for admin review)
        if (analysis.improved_prompt) {
          const newVersion = (currentPrompt?.version || 0) + 1;
          await supabase.from("ai_prompt_versions").insert({
            function_name: fnName,
            version: newVersion,
            system_prompt: analysis.improved_prompt,
            change_reason: analysis.prompt_improvements || "Auto-mejora basada en análisis de interacciones",
            performance_notes: analysis.analysis,
            is_active: false, // Admin must activate manually
          });
        }

        results[fnName] = {
          interactions_analyzed: interactions.length,
          patterns_found: analysis.patterns_found || [],
          memories_created: analysis.new_memories?.length || 0,
          new_prompt_version: analysis.improved_prompt ? true : false,
          analysis: analysis.analysis,
        };
      } catch (aiErr) {
        console.warn(`[ai-improve-prompts] AI analysis failed for ${fnName}:`, aiErr);
        results[fnName] = { error: "ai_analysis_failed" };
      }
    }

    console.log("[ai-improve-prompts] Complete:", JSON.stringify(results));
    return json({ ok: true, results });
  } catch (err: any) {
    console.error("[ai-improve-prompts] Error:", err.message || err);
    return json({ ok: false, error: err.message || "Error interno" }, 500);
  }
});
