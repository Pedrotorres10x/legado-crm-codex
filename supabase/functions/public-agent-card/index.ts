import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AgentCardProperty {
  id: string;
  title: string | null;
  city: string | null;
  zone: string | null;
  price: number | null;
  property_type: string | null;
  operation: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  surface_area: number | null;
  images: string[] | null;
  portal_token: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      return new Response(JSON.stringify({ error: 'Missing slug parameter' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch agent profile by slug
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('user_id, full_name, email, phone, avatar_url, bio, whatsapp, linkedin_url, instagram_url, facebook_url, public_slug')
      .eq('public_slug', slug)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify they are an active agent
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', profile.user_id)
      .in('role', ['agent', 'admin', 'coordinadora'])
      .maybeSingle();

    if (!role) {
      return new Response(JSON.stringify({ error: 'Agent not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch their available properties (summary only)
    const { data: properties } = await supabase
      .from('properties')
      .select('id, title, city, zone, price, property_type, operation, bedrooms, bathrooms, surface_area, images, portal_token')
      .eq('agent_id', profile.user_id)
      .eq('status', 'disponible')
      .order('created_at', { ascending: false })
      .limit(50);

    // Build property summaries with first image only
    const propertySummaries = ((properties || []) as AgentCardProperty[]).map((p) => ({
      id: p.id,
      title: p.title,
      city: p.city,
      zone: p.zone,
      price: p.price,
      type: p.property_type,
      operation: p.operation,
      bedrooms: p.bedrooms,
      bathrooms: p.bathrooms,
      surface: p.surface_area,
      image: p.images?.[0] || null,
      portal_token: p.portal_token,
    }));

    // Fetch shared link-in-bio config from settings
    const { data: configRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'link_in_bio_config')
      .single();

    // Build public response
    const agentCard = {
      agent_id: profile.user_id,
      name: profile.full_name,
      slug: profile.public_slug,
      avatar: profile.avatar_url,
      email: profile.email,
      phone: profile.phone,
      whatsapp: profile.whatsapp || profile.phone,
      bio: profile.bio,
      linkedin: profile.linkedin_url,
      instagram: profile.instagram_url,
      facebook: profile.facebook_url,
      role: role.role,
      properties: propertySummaries,
      properties_count: propertySummaries.length,
      link_in_bio_config: configRow?.value || null,
    };

    return new Response(JSON.stringify(agentCard), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' },
    });
  } catch (err) {
    console.error('public-agent-card error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
