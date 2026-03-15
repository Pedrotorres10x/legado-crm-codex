import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const format = url.searchParams.get('format');

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('user_id, full_name, avatar_url, bio, phone, public_slug')
      .eq('public_slug', slug)
      .single();

    if (error || !profile) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { count } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('agent_id', profile.user_id)
      .eq('status', 'disponible');

    const propCount = count || 0;

    const canonicalUrl = `https://legadocoleccion.es/agente/${profile.public_slug}`;
    const ogTitle = `${profile.full_name} · Asesor Inmobiliario | RK Legado`;

    const bioClean = profile.bio
      ? profile.bio.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    const ogDescription = bioClean
      ? (bioClean.length > 140 ? bioClean.substring(0, 137).trimEnd() + '...' : bioClean)
      : `Asesor inmobiliario en RK Legado. ${propCount > 0 ? `${propCount} propiedades disponibles.` : ''} Contacta para una valoración gratuita.`;

    const ogImage = profile.avatar_url || 'https://legadocoleccion.es/og-image.jpg';

    const esc = (s: string) => s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(ogTitle)}</title>
  <meta name="description" content="${esc(ogDescription)}">
  <meta property="og:type" content="profile">
  <meta property="og:url" content="${esc(canonicalUrl)}">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(ogDescription)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:image:width" content="400">
  <meta property="og:image:height" content="400">
  <meta property="og:locale" content="es_ES">
  <meta property="og:site_name" content="RK Legado">
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(ogDescription)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <link rel="canonical" href="${esc(canonicalUrl)}">
  <meta http-equiv="refresh" content="0;url=${esc(canonicalUrl)}">
</head>
<body>
  <p>Redirigiendo a <a href="${esc(canonicalUrl)}">${esc(ogTitle)}</a>...</p>
</body>
</html>`;

    if (format === 'json') {
      return new Response(JSON.stringify({
        ogTitle,
        ogDescription,
        ogImage,
        canonicalUrl,
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    return new Response(html, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/html; charset=UTF-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('og-agent error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
