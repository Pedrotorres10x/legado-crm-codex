import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LinkInBioLink {
  id: string;
  [key: string]: unknown;
}

interface LinkInBioPayload {
  company: Record<string, unknown>;
  links: LinkInBioLink[];
  social: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await req.json() as Partial<LinkInBioPayload>;

    // Validate required structure
    if (!body.company || !body.links || !body.social) {
      return new Response(JSON.stringify({ error: 'Missing required fields: company, links, social' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Remove the whatsapp link if present (agents have their own)
    const linksWithoutWhatsapp = (body.links || []).filter(
      (link: LinkInBioLink) => link.id !== 'whatsapp'
    );

    const config = {
      company: body.company,
      links: linksWithoutWhatsapp,
      social: body.social,
    };

    const { error } = await supabase
      .from('settings')
      .upsert(
        { key: 'link_in_bio_config', value: config, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      console.error('Upsert error:', error);
      return new Response(JSON.stringify({ error: 'Failed to update config' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, synced_at: new Date().toISOString() }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('sync-linkinbio error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
