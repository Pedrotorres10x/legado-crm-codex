/**
 * twilio-transfer
 * Transfers an active call to another agent using a Twilio Conference.
 *
 * Flow:
 * 1. Frontend sends { parentCallSid, targetAgentUserId }
 * 2. This function redirects the customer's call leg to a named conference room.
 * 3. It then dials the target agent (via their Twilio Client identity) into the same room.
 * 4. The transferring agent can hang up their own SDK connection.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ─────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    // ── Payload ───────────────────────────────────────────────────────────
    const { parentCallSid, targetAgentUserId } = await req.json();
    if (!parentCallSid || !targetAgentUserId) {
      return new Response(JSON.stringify({ error: 'parentCallSid and targetAgentUserId are required' }), {
        status: 400, headers: corsHeaders,
      });
    }

    // ── Twilio credentials ────────────────────────────────────────────────
    const accountSid   = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken    = Deno.env.get('TWILIO_AUTH_TOKEN')!;
    const twilioNumber = Deno.env.get('TWILIO_PHONE_NUMBER')!;
    const supabaseUrl  = Deno.env.get('SUPABASE_URL')!;

    if (!accountSid || !authToken || !twilioNumber) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), { status: 503, headers: corsHeaders });
    }

    const twilioAuth = btoa(`${accountSid}:${authToken}`);
    const conferenceName = `transfer_${parentCallSid}`;
    const conferenceTwimlUrl =
      `${supabaseUrl}/functions/v1/twilio-conference-twiml?room=${encodeURIComponent(conferenceName)}&beep=false`;
    const conferenceTwimlUrlWithBeep =
      `${supabaseUrl}/functions/v1/twilio-conference-twiml?room=${encodeURIComponent(conferenceName)}&beep=true`;

    console.log(`Transferring call ${parentCallSid} to agent ${targetAgentUserId} via conference ${conferenceName}`);

    // ── Step 1: Redirect customer's call to conference ────────────────────
    const redirectRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${parentCallSid}.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          Url: conferenceTwimlUrl,
          Method: 'GET',
        }).toString(),
      }
    );

    if (!redirectRes.ok) {
      const errData = await redirectRes.json();
      console.error('Failed to redirect customer call:', errData);
      return new Response(JSON.stringify({ error: errData.message || 'Failed to redirect call' }), {
        status: 400, headers: corsHeaders,
      });
    }

    console.log('Customer call redirected to conference.');

    // ── Step 2: Dial target agent into the conference ─────────────────────
    const agentIdentity = `agent_${targetAgentUserId}`;

    const dialRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To:     `client:${agentIdentity}`,
          From:   twilioNumber,
          Url:    conferenceTwimlUrlWithBeep,
          Method: 'GET',
        }).toString(),
      }
    );

    if (!dialRes.ok) {
      const errData = await dialRes.json();
      console.error('Failed to dial target agent:', errData);
      return new Response(JSON.stringify({ error: errData.message || 'Failed to dial agent' }), {
        status: 400, headers: corsHeaders,
      });
    }

    const dialData = await dialRes.json();
    console.log(`Target agent dialed. New call SID: ${dialData.sid}`);

    return new Response(JSON.stringify({ ok: true, conferenceName, agentCallSid: dialData.sid }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('twilio-transfer error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
