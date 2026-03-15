import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // ── Auth: require valid JWT ──────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsErr } = await authSupabase.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = claimsData.claims.sub as string

    // ── Authorisation: admin only ───────────────────────────────────────
    const serviceSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: adminRole } = await serviceSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle()

    if (!adminRole) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ── Business logic ──────────────────────────────────────────────────
    const BREVO_API_KEY = Deno.env.get('BREVO_API_KEY')
    if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY not configured')

    const { announcement_id } = await req.json()
    if (!announcement_id) throw new Error('announcement_id required')

    const { data: announcement, error: annErr } = await serviceSupabase
      .from('announcements')
      .select('*')
      .eq('id', announcement_id)
      .single()

    if (annErr || !announcement) throw new Error('Announcement not found')

    // Get all users with email from auth
    const { data: { users }, error: usersErr } = await serviceSupabase.auth.admin.listUsers({ perPage: 500 })
    if (usersErr) throw new Error('Could not list users')

    const emails = (users || [])
      .map(u => ({ email: u.email, name: u.user_metadata?.full_name || u.email?.split('@')[0] || '' }))
      .filter(u => u.email)

    if (emails.length === 0) throw new Error('No users with email found')

    const categoryEmoji: Record<string, string> = {
      mejora: '✨', correccion: '🔧', nueva_funcion: '🚀', mantenimiento: '⚙️', importante: '🔴',
    }
    const categoryLabel: Record<string, string> = {
      mejora: 'Mejora', correccion: 'Corrección', nueva_funcion: 'Nueva función', mantenimiento: 'Mantenimiento', importante: 'Importante',
    }

    const emoji = categoryEmoji[announcement.category] || '📢'
    const label = categoryLabel[announcement.category] || announcement.category

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #fff;">
        <div style="text-align: center; padding: 20px 0; border-bottom: 2px solid #1a365d;">
          <h1 style="color: #1a365d; margin: 0; font-size: 22px;">Legado Colección CRM</h1>
        </div>
        <div style="padding: 24px 0;">
          <div style="display: inline-block; background: #f0f4ff; color: #1a365d; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; margin-bottom: 16px;">
            ${emoji} ${label}
          </div>
          <h2 style="color: #1a365d; margin: 8px 0; font-size: 20px;">${announcement.title}</h2>
          <div style="color: #555; font-size: 15px; line-height: 1.6; white-space: pre-line;">${announcement.content}</div>
        </div>
        <div style="border-top: 1px solid #eee; padding: 16px 0; text-align: center;">
          <p style="color: #999; font-size: 12px;">Legado Colección CRM · Actualización del sistema</p>
        </div>
      </div>
    `

    // Send via Brevo
    const sendResp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: 'Legado Colección CRM', email: 'info@planhogar.es' },
        to: emails.map(e => ({ email: e.email, name: e.name })),
        subject: `${emoji} ${announcement.title} — CRM Legado Colección`,
        htmlContent,
        headers: { 'X-Mailin-Tag': 'crm-announcement' },
      }),
    })

    if (!sendResp.ok) {
      const errText = await sendResp.text()
      throw new Error(`Brevo error: ${errText}`)
    }

    // Mark as emailed
    await serviceSupabase.from('announcements').update({ emailed: true }).eq('id', announcement_id)

    // Post message to "General" chat channel
    try {
      const { data: generalChannel } = await serviceSupabase
        .from('chat_channels')
        .select('id')
        .eq('name', 'General')
        .eq('is_direct', false)
        .limit(1)
        .single()

      if (generalChannel) {
        const chatMessage = `${emoji} **${label}: ${announcement.title}**\n\n${announcement.content}`
        await serviceSupabase.from('chat_messages').insert({
          channel_id: generalChannel.id,
          user_id: userId,
          content: chatMessage,
        })
      }
    } catch (chatErr) {
      console.error('Error posting to chat:', chatErr)
    }

    return new Response(JSON.stringify({ success: true, recipients: emails.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('send-announcement error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
