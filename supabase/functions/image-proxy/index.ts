const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { searchParams } = new URL(req.url);
    const imageUrl = searchParams.get('url');

    if (!imageUrl) {
      return new Response('Missing ?url= parameter', { status: 400, headers: corsHeaders });
    }

    // Only proxy known external domains for security
    const allowed = ['medianewbuild.com', 'media.inmobalia.com', 'habihub.com'];
    let urlObj: URL;
    try {
      urlObj = new URL(imageUrl);
    } catch {
      return new Response('Invalid URL', { status: 400, headers: corsHeaders });
    }

    if (!allowed.some(d => urlObj.hostname.endsWith(d))) {
      return new Response('Domain not allowed', { status: 403, headers: corsHeaders });
    }

    // Fetch the image with a browser-like user agent
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': urlObj.origin + '/',
      },
    });

    if (!res.ok) {
      return new Response(`Upstream error: ${res.status}`, { status: 502, headers: corsHeaders });
    }

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const body = await res.arrayBuffer();

    // Reject if response is too small (likely a placeholder/error)
    if (body.byteLength < 1000) {
      return new Response('Image too small, likely invalid', { status: 404, headers: corsHeaders });
    }

    return new Response(body, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800', // 1 day client, 7 days CDN
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[image-proxy] error:', err);
    return new Response(`Error: ${err}`, { status: 500, headers: corsHeaders });
  }
});
