/**
 * Shared CORS headers and JSON response helper for all Edge Functions.
 * Import: import { corsHeaders, json } from '../_shared/cors.ts';
 */

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-api-key, x-faktura-key, x-webhook-secret, x-multichannel-key, x-portal-key, x-brevo-key, x-greenapi-key',
};

/** Return a JSON Response with CORS headers. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Handle preflight OPTIONS and return true if handled. */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  return null;
}
