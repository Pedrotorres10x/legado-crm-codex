/**
 * Shared AI Gateway wrapper with standard error handling.
 * Import: import { callAI } from '../_shared/ai.ts';
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIOptions {
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
  stream?: boolean;
}

export interface AIResult {
  content: string | null;
  tool_calls?: unknown[];
  raw: unknown;
}

/**
 * Call the Lovable AI Gateway. Returns the parsed result or throws on error.
 * Handles 429 (rate limit) and 402 (credits exhausted) with typed errors.
 */
export async function callAI(
  model: string,
  messages: AIMessage[],
  options?: AIOptions,
): Promise<AIResult> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new AIError('LOVABLE_API_KEY is not configured', 500);

  const body: Record<string, unknown> = { model, messages };
  if (options?.max_tokens) body.max_tokens = options.max_tokens;
  if (options?.tools) body.tools = options.tools;
  if (options?.tool_choice) body.tool_choice = options.tool_choice;
  if (options?.stream !== undefined) body.stream = options.stream;

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new AIError('Límite de peticiones excedido, inténtalo más tarde.', 429);
    if (res.status === 402) throw new AIError('Créditos de IA agotados.', 402);
    throw new AIError(`AI gateway error [${res.status}]: ${text}`, res.status);
  }

  const data = await res.json();
  const choice = data.choices?.[0]?.message;

  return {
    content: choice?.content || null,
    tool_calls: choice?.tool_calls,
    raw: data,
  };
}

/** Typed error with HTTP status code for AI failures. */
export class AIError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AIError';
    this.status = status;
  }
}
