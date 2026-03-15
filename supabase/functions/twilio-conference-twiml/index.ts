/**
 * twilio-conference-twiml
 * Returns TwiML to place a caller into a named conference room.
 * Used by twilio-transfer to redirect both parties into the conference.
 * Query params: ?room=<conferenceName>&beep=<true|false>
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const room = url.searchParams.get('room') || 'default';
  const beep = url.searchParams.get('beep') === 'true' ? 'true' : 'false';

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Conference beep="${beep}" startConferenceOnEnter="true" endConferenceOnExit="false" waitUrl="http://twimlets.com/holdmusic?Bucket=com.twilio.music.classical">
      ${room}
    </Conference>
  </Dial>
</Response>`;

  return new Response(twiml, {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'text/xml' },
  });
});
