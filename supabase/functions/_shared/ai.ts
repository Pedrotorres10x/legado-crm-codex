/**
 * Shared AI wrapper with standard error handling.
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveModelCandidates = (model: string) => {
  if (model.startsWith('google/') || model.includes('gemini')) {
    return ['gpt-4o-mini', 'gpt-4.1-mini'];
  }

  if (model.startsWith('openai/')) {
    return [model.replace('openai/', '')];
  }

  return [model];
};

/**
 * Call OpenAI chat completions. Returns the parsed result or throws on error.
 * Handles 429 (rate limit) and 402 (credits exhausted) with typed errors.
 */
export async function callAI(
  model: string,
  messages: AIMessage[],
  options?: AIOptions,
): Promise<AIResult> {
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  if (!OPENAI_API_KEY) throw new AIError('OPENAI_API_KEY is not configured', 500);

  const body: Record<string, unknown> = { model, messages };
  if (options?.max_tokens) body.max_tokens = options.max_tokens;
  if (options?.tools) body.tools = options.tools;
  if (options?.tool_choice) body.tool_choice = options.tool_choice;
  if (options?.stream !== undefined) body.stream = options.stream;
  const modelCandidates = resolveModelCandidates(model);
  let lastRateLimitError: AIError | null = null;

  for (const openAIModel of modelCandidates) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...body,
          model: openAIModel,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const choice = data.choices?.[0]?.message;

        return {
          content: choice?.content || null,
          tool_calls: choice?.tool_calls,
          raw: data,
        };
      }

      const text = await res.text();
      if (res.status === 429) {
        lastRateLimitError = new AIError('Límite de peticiones excedido, inténtalo más tarde.', 429);
        if (attempt < 2) {
          await sleep(900 * (attempt + 1));
          continue;
        }
        break;
      }
      if (res.status === 402) throw new AIError('Créditos de IA agotados.', 402);
      throw new AIError(`OpenAI error [${res.status}]: ${text}`, res.status);
    }
  }

  throw lastRateLimitError || new AIError('No se pudo completar la petición de IA.', 500);
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
