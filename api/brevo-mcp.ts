export const config = { runtime: 'edge' };

const BREVO_MCP_URL = 'https://mcp.brevo.com/v1/brevo/mcp';
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? '';

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Session-Id',
        'Access-Control-Expose-Headers': 'Mcp-Session-Id',
      },
    });
  }

  // Forward relevant headers from the client, but always inject auth
  const forwardHeaders: Record<string, string> = {
    'Accept': req.headers.get('Accept') ?? 'application/json, text/event-stream',
    'Content-Type': req.headers.get('Content-Type') ?? 'application/json',
    'api-key': BREVO_API_KEY,
  };

  // Forward session header if present
  const sessionId = req.headers.get('Mcp-Session-Id');
  if (sessionId) forwardHeaders['Mcp-Session-Id'] = sessionId;

  const body = req.method === 'GET' ? undefined : await req.text();

  const upstream = await fetch(BREVO_MCP_URL, {
    method: req.method,
    headers: forwardHeaders,
    body: body || undefined,
  });

  // Build response headers
  const responseHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    'Cache-Control': 'no-cache, no-transform',
  });

  const contentType = upstream.headers.get('content-type');
  if (contentType) responseHeaders.set('Content-Type', contentType);

  const upstreamSession = upstream.headers.get('Mcp-Session-Id');
  if (upstreamSession) responseHeaders.set('Mcp-Session-Id', upstreamSession);

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
