/**
 * twilio-verify-caller
 * POST { action: 'start', phone_number: '+34612345678' }  → inicia verificación (Twilio llama/SMS al agente)
 * POST { action: 'check', phone_number: '+34612345678', code: '123456' } → valida código y guarda en perfil
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // Auth
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
    const userId = claimsData.claims.sub;

    const body = await req.json();
    const { action, code } = body;

    // Normalize to E.164 (e.g. 644245679 → +34644245679)
    let phone_number: string = (body.phone_number ?? '').trim().replace(/\s+/g, '');
    if (phone_number && !phone_number.startsWith('+')) {
      if (/^[6789]/.test(phone_number)) phone_number = '+34' + phone_number;
      else if (phone_number.startsWith('0034')) phone_number = '+' + phone_number.slice(2);
      else phone_number = '+34' + phone_number;
    }

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')!;
    const authToken  = Deno.env.get('TWILIO_AUTH_TOKEN')!;

    if (!accountSid || !authToken) {
      return new Response(JSON.stringify({ error: 'Twilio not configured' }), { status: 503, headers: corsHeaders });
    }

    // REST API uses Account SID + Auth Token (not API Key/Secret)
    const twilioAuth = btoa(`${accountSid}:${authToken}`);

    if (action === 'reset') {
      // Delete an existing OutgoingCallerId from Twilio so re-verification is possible
      // First, find the SID
      const listRes = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json?${new URLSearchParams({ PhoneNumber: phone_number })}`,
        { headers: { Authorization: `Basic ${twilioAuth}` } }
      );
      const listData = await listRes.json();
      const callerIds = listData.outgoing_caller_ids || [];

      for (const callerId of callerIds) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds/${callerId.sid}.json`,
          { method: 'DELETE', headers: { Authorization: `Basic ${twilioAuth}` } }
        );
        console.log('Deleted OutgoingCallerId:', callerId.sid, callerId.phone_number);
      }

      // Reset profile
      await supabase
        .from('profiles')
        .update({ twilio_caller_id: null, twilio_caller_id_verified: false })
        .eq('user_id', userId);

      return new Response(JSON.stringify({ ok: true, deleted: callerIds.length }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'start') {
      // Step 1: Request Twilio Outbound Caller ID verification
      // Twilio will call the phone number and read a validation code
      const formBody = new URLSearchParams({
        PhoneNumber: phone_number,
        FriendlyName: 'CRM Agent Verified Number',
        CallDelay: '0',
      });

      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formBody.toString(),
        }
      );

      const data = await res.json();
      console.log('Twilio start response:', res.status, JSON.stringify(data));

      if (!res.ok) {
        // Error 21606: number is already verified in Twilio → mark as verified directly
        if (data.code === 21606 || (data.message || '').toLowerCase().includes('already been verified')) {
          await supabase
            .from('profiles')
            .update({ twilio_caller_id: phone_number, twilio_caller_id_verified: true })
            .eq('user_id', userId);
          return new Response(JSON.stringify({
            ok: true,
            already_verified: true,
            message: 'El número ya estaba verificado en Twilio. Se ha marcado como activo.',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        console.error('Twilio caller ID start error:', data);
        return new Response(JSON.stringify({ error: data.message || 'Twilio error', code: data.code }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      // Store the phone temporarily in profile (unverified)
      await supabase
        .from('profiles')
        .update({ twilio_caller_id: phone_number, twilio_caller_id_verified: false })
        .eq('user_id', userId);

      // Twilio returns snake_case: validation_code (not ValidationCode)
      const validationCode = data.validation_code ?? data.ValidationCode ?? null;
      console.log('Twilio validation_code:', validationCode, 'raw keys:', Object.keys(data));

      return new Response(JSON.stringify({
        ok: true,
        validation_code: validationCode,
        message: 'Twilio llamará a tu número con un código de validación. Introdúcelo a continuación.',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'check') {
      // Step 2: Check if the number is now verified in Twilio
      // Look up OutgoingCallerIds for this account
      const params = new URLSearchParams({ PhoneNumber: phone_number });
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/OutgoingCallerIds.json?${params}`,
        {
          headers: {
            Authorization: `Basic ${twilioAuth}`,
          },
        }
      );

      const data = await res.json();

      if (!res.ok) {
        return new Response(JSON.stringify({ error: data.message || 'Twilio error' }), {
          status: 400,
          headers: corsHeaders,
        });
      }

      const isVerified = data.outgoing_caller_ids?.length > 0;

      if (isVerified) {
        await supabase
          .from('profiles')
          .update({ twilio_caller_id: phone_number, twilio_caller_id_verified: true })
          .eq('user_id', userId);

        return new Response(JSON.stringify({ ok: true, verified: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        return new Response(JSON.stringify({ ok: true, verified: false, message: 'Número aún no verificado. Espera a que Twilio llame.' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: corsHeaders });

  } catch (err) {
    console.error('twilio-verify-caller error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: corsHeaders });
  }
});
