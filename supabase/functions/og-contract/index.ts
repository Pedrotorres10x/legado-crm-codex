import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new Response('Missing token', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Try multi-signer first
    const { data: signer } = await supabase
      .from('contract_signers')
      .select('signer_label, signature_status, contract_id, generated_contracts(content, agent_id)')
      .eq('signature_token', token)
      .maybeSingle();

    let title = '📝 Firma de Documento · Legado Inmobiliaria';
    let description = 'Has recibido un documento para firmar de forma digital. Verifica tu identidad, revisa el contenido y firma electrónicamente de forma segura.';

    if (signer) {
      const status = signer.signature_status;

      if (status === 'firmado') {
        description = '✅ Este documento ya ha sido firmado correctamente.';
      } else if (status === 'revocado') {
        description = '🚫 Este enlace de firma ha sido revocado.';
      } else {
        description = `${signer.signer_label} — Verifica tu identidad, revisa el documento y firma electrónicamente de forma segura con Legado Inmobiliaria.`;
      }
    }

    const canonicalUrl = `https://legadocrm.lovable.app/firmar/${token}`;

    // Detect bot vs real browser
    const userAgent = req.headers.get('user-agent') || '';
    const isCrawler = /whatsapp|facebookexternalhit|twitterbot|linkedinbot|telegrambot|slackbot|discordbot|applebot|googlebot|bingbot|pinterest|vkshare|curl|wget/i.test(userAgent);

    // Real users: redirect to the actual page
    if (!isCrawler) {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': canonicalUrl,
          'Cache-Control': 'no-cache, no-store',
        },
      });
    }

    // Bots: serve OG HTML
    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const ogImage = 'https://legadocoleccion.es/og-default.jpg';

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} | Legado Inmobiliaria</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="Legado Inmobiliaria">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
</head>
<body>
  <p><a href="${esc(canonicalUrl)}">${esc(title)}</a></p>
  <p>${esc(description)}</p>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  } catch (err) {
    console.error('og-contract error:', err);
    return new Response('Internal error', { status: 500 });
  }
});
