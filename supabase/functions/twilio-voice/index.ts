/**
 * twilio-voice — TwiML webhook for outbound calls from Twilio Client SDK.
 * Twilio calls this endpoint when the browser agent dials a number.
 * Returns TwiML XML instructing Twilio to connect to the target phone number.
 * Uses the agent's verified personal number as caller ID if available.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const to = params.get('To') || '';
    // CallerIdOverride is passed by the client SDK when the agent has a verified number
    const callerIdOverride = params.get('CallerIdOverride') || '';
    const defaultCallerId = Deno.env.get('TWILIO_PHONE_NUMBER') || '';

    // Use agent's personal verified number if provided and valid E.164, else company number
    const callerId = callerIdOverride.match(/^\+[1-9]\d{6,14}$/)
      ? callerIdOverride
      : defaultCallerId;

    // Sanitize destination: only allow E.164 or local format
    const safeNumber = to.replace(/[^0-9+]/g, '');

    if (!safeNumber) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<Response><Say language="es-ES">Número no válido.</Say></Response>`, {
        status: 400,
        headers: { 'Content-Type': 'text/xml' },
      });
    }

    const statusCallback = `${Deno.env.get('SUPABASE_URL')}/functions/v1/twilio-call-status`;

    console.log('twilio-voice request:', { to: safeNumber, callerId, callerIdOverride });

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}" record="record-from-ringing-dual" recordingStatusCallback="${statusCallback}" recordingStatusCallbackMethod="POST">
    <Number statusCallback="${statusCallback}" statusCallbackMethod="POST" statusCallbackEvent="initiated ringing answered completed">${safeNumber}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  } catch (err) {
    console.error('twilio-voice error:', err);
    return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-ES">Error interno.</Say></Response>`, {
      status: 500,
      headers: { 'Content-Type': 'text/xml' },
    });
  }
});
