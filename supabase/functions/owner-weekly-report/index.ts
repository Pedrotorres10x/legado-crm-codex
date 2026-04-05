import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendBrevoEmail } from '../_shared/brevo.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PropertyReport {
  property_id: string;
  title: string;
  reference: string | null;
  price: number | null;
  city: string | null;
  owner_name: string;
  owner_email: string;
  visits_count: number;
  leads_count: number;
  matches_count: number;
  portals: string[];
  days_on_market: number;
  mandate_end: string | null;
}

interface OwnerSummary {
  full_name: string;
  email: string;
}

interface PropertyOwnerRow {
  id: string;
  title: string;
  crm_reference: string | null;
  price: number | null;
  city: string | null;
  created_at: string;
  mandate_end: string | null;
  contacts: OwnerSummary | null;
}

interface PortalFeedSummary {
  portal_feeds: {
    display_name: string | null;
  } | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const sb = createClient(supabaseUrl, serviceKey);

  let propertyFilter: string | null = null;
  try {
    const body = await req.json();
    propertyFilter = body?.property_id || null;
  } catch { /* cron sends empty body */ }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  // Get properties with owners that have email
  let query = sb
    .from('properties')
    .select('id, title, crm_reference, price, city, status, created_at, mandate_end, owner_id, contacts!properties_owner_id_fkey(full_name, email)')
    .in('status', ['disponible', 'reservado', 'arras']);

  if (propertyFilter) {
    query = query.eq('id', propertyFilter);
  }

  const { data: properties, error: propError } = await query;
  if (propError) {
    console.error('[OwnerReport] Error fetching properties:', propError);
    return new Response(JSON.stringify({ error: propError.message }), { status: 500, headers: corsHeaders });
  }

  const eligibleProps = ((properties || []) as PropertyOwnerRow[]).filter(
    (p) => p.contacts?.email
  );

  if (eligibleProps.length === 0) {
    console.log('[OwnerReport] No eligible properties with owner email');
    return new Response(JSON.stringify({ sent: 0, message: 'No eligible properties' }), { headers: corsHeaders });
  }

  let sent = 0;
  const errors: string[] = [];

  for (const prop of eligibleProps) {
    try {
      const owner = prop.contacts as OwnerSummary;

      // Visits in last 7 days
      const { count: visitsCount } = await sb
        .from('visits')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id)
        .gte('visit_date', sevenDaysAgo);

      // Leads / matches in last 7 days
      const { count: matchesCount } = await sb
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id)
        .gte('created_at', sevenDaysAgo);

      // Portal leads
      const { count: leadsCount } = await sb
        .from('portal_leads')
        .select('id', { count: 'exact', head: true })
        .eq('property_id', prop.id)
        .gte('created_at', sevenDaysAgo);

      // Active portals
      const { data: portalData } = await sb
        .from('portal_feed_properties')
        .select('portal_feeds(display_name)')
        .eq('property_id', prop.id)
        .is('removed_at', null);

      const portals = (portalData || [])
        .map((pf: PortalFeedSummary) => pf.portal_feeds?.display_name)
        .filter(Boolean);

      const daysOnMarket = Math.floor(
        (Date.now() - new Date(prop.created_at).getTime()) / 86400000
      );

      const report: PropertyReport = {
        property_id: prop.id,
        title: prop.title,
        reference: prop.crm_reference,
        price: prop.price,
        city: prop.city,
        owner_name: owner.full_name,
        owner_email: owner.email,
        visits_count: visitsCount || 0,
        leads_count: leadsCount || 0,
        matches_count: matchesCount || 0,
        portals,
        days_on_market: daysOnMarket,
        mandate_end: prop.mandate_end,
      };

      const html = buildReportHtml(report);

      await sendBrevoEmail(
        [{ email: owner.email, name: owner.full_name }],
        `📊 Informe semanal: ${prop.title}`,
        html,
      );

      // Log communication
      const ownerContact = await sb
        .from('contacts')
        .select('id')
        .eq('email', owner.email)
        .limit(1)
        .single();

      if (ownerContact.data) {
        await sb.from('communication_logs').insert({
          contact_id: ownerContact.data.id,
          channel: 'email',
          direction: 'outbound',
          subject: `Informe semanal: ${prop.title}`,
          body_preview: `Visitas: ${report.visits_count} | Leads: ${report.leads_count} | Matches: ${report.matches_count}`,
          status: 'sent',
          source: 'owner-report',
          property_id: prop.id,
        });
      }

      sent++;
      console.log(`[OwnerReport] Sent report for ${prop.title} to ${owner.email}`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`[OwnerReport] Error for property ${prop.id}:`, message);
      errors.push(`${prop.id}: ${message}`);
    }
  }

  return new Response(
    JSON.stringify({ sent, total: eligibleProps.length, errors }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});

function buildReportHtml(r: PropertyReport): string {
  const mandateInfo = r.mandate_end
    ? `<tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;">Mandato hasta</td><td style="padding:8px 12px;font-weight:600;">${new Date(r.mandate_end).toLocaleDateString('es-ES')}</td></tr>`
    : '';

  const portalList = r.portals.length > 0
    ? r.portals.map(p => `<span style="display:inline-block;background:#e0f2fe;color:#0369a1;padding:2px 10px;border-radius:12px;font-size:12px;margin:2px 4px 2px 0;">${p}</span>`).join('')
    : '<span style="color:#9ca3af;font-size:13px;">Sin portales activos</span>';

  const priceStr = r.price
    ? new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(r.price)
    : '—';

  return `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e3a5f 0%,#2563eb 100%);border-radius:12px 12px 0 0;padding:28px 24px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">📊 Informe Semanal</h1>
    <p style="margin:8px 0 0;color:#93c5fd;font-size:14px;">${r.title}</p>
    ${r.reference ? `<p style="margin:4px 0 0;color:#93c5fd;font-size:12px;">Ref: ${r.reference}</p>` : ''}
  </div>

  <!-- Main Card -->
  <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.08);">

    <p style="margin:0 0 20px;color:#374151;font-size:14px;">
      Hola <strong>${r.owner_name.split(' ')[0]}</strong> 👋 Aquí tienes el resumen de cómo ha ido tu inmueble esta semana.
    </p>

    <!-- KPIs -->
    <div style="display:flex;gap:12px;margin-bottom:24px;">
      <div style="flex:1;background:#f0fdf4;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#16a34a;">${r.visits_count}</div>
        <div style="font-size:12px;color:#4ade80;margin-top:4px;">Visitas</div>
      </div>
      <div style="flex:1;background:#eff6ff;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#2563eb;">${r.leads_count}</div>
        <div style="font-size:12px;color:#60a5fa;margin-top:4px;">Leads</div>
      </div>
      <div style="flex:1;background:#fdf4ff;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:28px;font-weight:800;color:#9333ea;">${r.matches_count}</div>
        <div style="font-size:12px;color:#c084fc;margin-top:4px;">Matches</div>
      </div>
    </div>

    <!-- Details Table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;">Precio publicado</td>
        <td style="padding:8px 12px;font-weight:600;">${priceStr}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;">Ciudad</td>
        <td style="padding:8px 12px;font-weight:600;">${r.city || '—'}</td>
      </tr>
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;color:#6b7280;font-size:13px;">Días en mercado</td>
        <td style="padding:8px 12px;font-weight:600;">${r.days_on_market}</td>
      </tr>
      ${mandateInfo}
    </table>

    <!-- Portals -->
    <div style="margin-bottom:20px;">
      <p style="font-size:13px;color:#6b7280;margin:0 0 8px;">Publicado en portales:</p>
      <div>${portalList}</div>
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        Te mando este resumen cada lunes para que estés al día.<br>
        Cualquier duda, aquí estoy 🙂 — Alicia, Legado Inmobiliaria
      </p>
    </div>
  </div>
</div>
</body></html>`;
}
