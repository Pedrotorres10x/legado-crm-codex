/**
 * AI Learning System — Shared context injection.
 *
 * Before every AI call, fetch relevant memories + knowledge base entries
 * and append them to the system prompt. After the call, log the interaction
 * and optionally save new memories.
 *
 * Usage:
 *   import { getAIContext, logAIInteraction, saveMemory } from '../_shared/ai-context.ts';
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface AIContextResult {
  contextBlock: string;          // text to inject into system prompt
  memoryIds: string[];           // ids of memories used
  kbIds: string[];               // ids of knowledge base entries used
  promptVersionId: string | null;
  systemPromptOverride: string | null; // if an active prompt version exists
}

/**
 * Fetch relevant memories and knowledge base entries for a given AI function.
 * Returns a context block to prepend/append to the system prompt.
 */
export async function getAIContext(
  supabase: SupabaseClient,
  functionName: string,
  category?: string,
): Promise<AIContextResult> {
  const [memoriesRes, kbRes, promptRes] = await Promise.all([
    // Top memories for this function/category, ordered by relevance
    supabase
      .from("ai_memory")
      .select("id, category, context_key, content, relevance_score")
      .eq("is_active", true)
      .or(category
        ? `source_function.eq.${functionName},category.eq.${category}`
        : `source_function.eq.${functionName}`)
      .order("relevance_score", { ascending: false })
      .limit(15),

    // Knowledge base entries that apply to this function
    supabase
      .from("ai_knowledge_base")
      .select("id, category, title, content, priority")
      .eq("is_active", true)
      .contains("applies_to", [functionName])
      .order("priority", { ascending: false })
      .limit(10),

    // Active prompt version for this function
    supabase
      .from("ai_prompt_versions")
      .select("id, system_prompt")
      .eq("function_name", functionName)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const memories = memoriesRes.data || [];
  const kbEntries = kbRes.data || [];
  const promptVersion = promptRes.data;

  const memoryIds = memories.map((m: any) => m.id);
  const kbIds = kbEntries.map((k: any) => k.id);

  // Build context block
  const parts: string[] = [];

  if (kbEntries.length > 0) {
    parts.push("## BASE DE CONOCIMIENTO\n" +
      kbEntries.map((k: any) => `### ${k.title}\n${k.content}`).join("\n\n"));
  }

  if (memories.length > 0) {
    parts.push("## PATRONES APRENDIDOS\n" +
      memories.map((m: any) => `- [${m.context_key}]: ${m.content}`).join("\n"));
  }

  const contextBlock = parts.length > 0
    ? "\n\n--- CONTEXTO APRENDIDO (usa esta información para mejorar tus respuestas) ---\n" + parts.join("\n\n") + "\n--- FIN CONTEXTO APRENDIDO ---\n"
    : "";

  // Bump usage_count for used memories (fire & forget)
  if (memoryIds.length > 0) {
    supabase.rpc("", {}).catch(() => {}); // no-op, we'll do raw update
    for (const id of memoryIds) {
      supabase
        .from("ai_memory")
        .update({ usage_count: memories.find((m: any) => m.id === id)?.usage_count + 1 || 1 })
        .eq("id", id)
        .then(() => {});
    }
  }

  return {
    contextBlock,
    memoryIds,
    kbIds,
    promptVersionId: promptVersion?.id || null,
    systemPromptOverride: promptVersion?.system_prompt || null,
  };
}

/**
 * Log an AI interaction for later analysis.
 */
export async function logAIInteraction(
  supabase: SupabaseClient,
  params: {
    functionName: string;
    inputSummary?: string;
    outputSummary?: string;
    promptVersionId?: string | null;
    memoryIds?: string[];
    kbIds?: string[];
    tokensUsed?: number;
    durationMs?: number;
    agentId?: string | null;
  },
): Promise<string | null> {
  try {
    const { data } = await supabase.from("ai_interactions").insert({
      function_name: params.functionName,
      input_summary: params.inputSummary?.substring(0, 500) || null,
      output_summary: params.outputSummary?.substring(0, 500) || null,
      prompt_version_id: params.promptVersionId || null,
      memory_ids_used: params.memoryIds || [],
      kb_ids_used: params.kbIds || [],
      tokens_used: params.tokensUsed || null,
      duration_ms: params.durationMs || null,
      agent_id: params.agentId || null,
    }).select("id").maybeSingle();
    return data?.id || null;
  } catch (err) {
    console.warn("[ai-context] Failed to log interaction:", err);
    return null;
  }
}

/**
 * Save a new memory pattern learned from an interaction.
 */
export async function saveMemory(
  supabase: SupabaseClient,
  params: {
    category: string;
    contextKey: string;
    content: string;
    sourceFunction: string;
    sourceInteractionId?: string;
    relevanceScore?: number;
  },
): Promise<void> {
  try {
    // Check if a similar memory already exists (same key + function)
    const { data: existing } = await supabase
      .from("ai_memory")
      .select("id, usage_count, relevance_score")
      .eq("context_key", params.contextKey)
      .eq("source_function", params.sourceFunction)
      .eq("is_active", true)
      .maybeSingle();

    if (existing) {
      // Boost existing memory's relevance
      await supabase.from("ai_memory").update({
        content: params.content,
        relevance_score: Math.min((existing.relevance_score || 1) + 0.1, 10),
        usage_count: (existing.usage_count || 0) + 1,
      }).eq("id", existing.id);
    } else {
      await supabase.from("ai_memory").insert({
        category: params.category,
        context_key: params.contextKey,
        content: params.content,
        source_function: params.sourceFunction,
        source_interaction_id: params.sourceInteractionId || null,
        relevance_score: params.relevanceScore || 1.0,
      });
    }
  } catch (err) {
    console.warn("[ai-context] Failed to save memory:", err);
  }
}
