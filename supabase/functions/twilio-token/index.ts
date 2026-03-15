import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data, error } = await supabase.auth.getClaims(token);
    if (error || !data?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = data.claims.sub;

    // Twilio credentials
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKey = Deno.env.get('TWILIO_API_KEY');
    const apiSecret = Deno.env.get('TWILIO_API_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build Twilio Access Token manually (JWT)
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour

    // Voice Grant
    const voiceGrant = {
      outgoing: { application_sid: twimlAppSid },
      incoming: { allow: true },
    };

    // JWT Header
    const header = btoa(JSON.stringify({ typ: 'JWT', alg: 'HS256', cty: 'twilio-fpa;v=1' }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // JWT Payload
    const payload = btoa(JSON.stringify({
      jti: `${apiKey}-${now}`,
      iss: apiKey,
      sub: accountSid,
      iat: now,
      exp,
      grants: {
        identity: `agent_${userId}`,
        voice: voiceGrant,
      },
    })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    // Sign with HMAC-SHA256
    const enc = new TextEncoder();
    const keyData = enc.encode(apiSecret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(`${header}.${payload}`));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sig)))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

    const accessToken = `${header}.${payload}.${signature}`;

    // Fetch agent's verified caller ID from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('twilio_caller_id, twilio_caller_id_verified')
      .eq('user_id', userId)
      .single();

    const callerId = profile?.twilio_caller_id_verified && profile?.twilio_caller_id
      ? profile.twilio_caller_id
      : null;

    return new Response(JSON.stringify({ token: accessToken, identity: `agent_${userId}`, callerId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('twilio-token error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
