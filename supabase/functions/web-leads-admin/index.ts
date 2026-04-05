import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, json, handleCors } from '../_shared/cors.ts';

type LeadSource = 'web' | 'portal' | 'fb';

interface PropertySummary {
  id: string;
  title: string | null;
  crm_reference: string | null;
}

interface InteractionSummary {
  property_id: string | null;
  created_at: string | null;
  properties: PropertySummary | null;
}

interface ContactLeadRow {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  agent_id: string | null;
  status: string | null;
  pipeline_stage: string | null;
  created_at: string;
  tags: string[] | null;
  buyer_intent: Record<string, unknown> | null;
  intent_score: number | null;
  intent_stage: string | null;
  intent_top_area_slug: string | null;
  intent_top_topic: string | null;
  interactions: InteractionSummary[] | null;
}

interface TaskRow {
  contact_id: string;
  completed: boolean | null;
}

interface VisitRow {
  id: string;
  contact_id: string;
}

interface OfferRow {
  id: string;
  contact_id: string;
}

function normalizePositiveInt(value: string | null, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

function buildLeadSource(tags: string[]): { lead_source: LeadSource; portal_name: string | null } {
  const isFbLead = tags.includes('fb-lead-ads');
  const isPortalLead = tags.includes('portal-lead');
  const portalTag = tags.find((tag) => tag.startsWith('portal:'));
  const portalName = portalTag ? portalTag.split(':')[1] : null;

  return {
    lead_source: isFbLead ? 'fb' : isPortalLead ? 'portal' : 'web',
    portal_name: isFbLead
      ? 'Facebook Ads'
      : portalName
        ? portalName.charAt(0).toUpperCase() + portalName.slice(1)
        : null,
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, serviceKey);

  const authHeader = req.headers.get('Authorization');
  const apiKey = req.headers.get('x-api-key') || '';
  const websiteApiKey = Deno.env.get('WEBSITE_API_KEY') || '';

  let authorized = false;
  let accessMode: 'admin_jwt' | 'satellite_key' | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (!authErr && user) {
      const [{ data: isAdmin }, { data: isCoordinator }] = await Promise.all([
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'coordinadora' }),
      ]);
      if (isAdmin || isCoordinator) {
        authorized = true;
        accessMode = 'admin_jwt';
      }
    }
  }

  if (!authorized && websiteApiKey && apiKey === websiteApiKey) {
    authorized = true;
    accessMode = 'satellite_key';
  }

  if (!authorized) {
    return json({ error: 'Unauthorized' }, 401);
  }

  try {
    const url = new URL(req.url);
    const scope = (url.searchParams.get('scope') || 'legado').toLowerCase();
    const source = (url.searchParams.get('source') || 'all').toLowerCase();
    const search = (url.searchParams.get('search') || '').trim();
    const limit = normalizePositiveInt(url.searchParams.get('limit'), 50, 200);
    const offset = normalizePositiveInt(url.searchParams.get('offset'), 0, 5000);

    let query = supabase
      .from('contacts')
      .select(`
        id, full_name, email, phone, agent_id, status, pipeline_stage, created_at, tags,
        buyer_intent, intent_score, intent_stage, intent_top_area_slug, intent_top_topic,
        interactions(property_id, created_at, properties(id, title, crm_reference))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (scope === 'legado') {
      query = query.contains('tags', ['web-lead', 'legadocoleccion']);
    } else if (scope === 'all') {
      query = query.or('tags.cs.{web-lead},tags.cs.{portal-lead},tags.cs.{fb-lead-ads}');
    } else {
      return json({ error: 'Invalid scope. Valid: legado, all' }, 400);
    }

    if (source === 'web') {
      query = query.contains('tags', ['web-lead']);
    } else if (source === 'portal') {
      query = query.contains('tags', ['portal-lead']);
    } else if (source === 'fb') {
      query = query.contains('tags', ['fb-lead-ads']);
    } else if (source !== 'all') {
      return json({ error: 'Invalid source. Valid: all, web, portal, fb' }, 400);
    }

    if (search) {
      query = query.or(
        `full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
      );
    }

    const { data: contacts, error, count } = await query;
    if (error) return json({ error: error.message }, 500);

    const contactRows: ContactLeadRow[] = (contacts ?? []) as ContactLeadRow[];
    const contactIds = contactRows.map((contact) => contact.id);

    let tasksByContact = new Map<string, Array<{ completed: boolean | null }>>();
    let visitsByContact = new Map<string, Array<{ id: string }>>();
    let offersByContact = new Map<string, Array<{ id: string }>>();

    if (contactIds.length > 0) {
      const [tasksResult, visitsResult, offersResult] = await Promise.all([
        supabase
          .from('tasks')
          .select('id, contact_id, completed')
          .in('contact_id', contactIds),
        supabase
          .from('visits')
          .select('id, contact_id')
          .in('contact_id', contactIds),
        supabase
          .from('offers')
          .select('id, contact_id')
          .in('contact_id', contactIds),
      ]);

      if (tasksResult.error) return json({ error: tasksResult.error.message }, 500);
      if (visitsResult.error) return json({ error: visitsResult.error.message }, 500);
      if (offersResult.error) return json({ error: offersResult.error.message }, 500);

      tasksByContact = ((tasksResult.data ?? []) as TaskRow[]).reduce((map, task) => {
        const list = map.get(task.contact_id) ?? [];
        list.push(task);
        map.set(task.contact_id, list);
        return map;
      }, new Map<string, Array<{ completed: boolean | null }>>());

      visitsByContact = ((visitsResult.data ?? []) as VisitRow[]).reduce((map, visit) => {
        const list = map.get(visit.contact_id) ?? [];
        list.push(visit);
        map.set(visit.contact_id, list);
        return map;
      }, new Map<string, Array<{ id: string }>>());

      offersByContact = ((offersResult.data ?? []) as OfferRow[]).reduce((map, offer) => {
        const list = map.get(offer.contact_id) ?? [];
        list.push(offer);
        map.set(offer.contact_id, list);
        return map;
      }, new Map<string, Array<{ id: string }>>());
    }

    const leads = contactRows.map((contact) => {
      const tags: string[] = contact.tags ?? [];
      const interactions: InteractionSummary[] = contact.interactions ?? [];
      const propertyInteraction = interactions.find((interaction) => interaction.property_id && interaction.properties);
      const lastInteractionAt = interactions
        .map((interaction) => interaction.created_at)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null;
      const tasks = tasksByContact.get(contact.id) ?? [];
      const visits = visitsByContact.get(contact.id) ?? [];
      const offers = offersByContact.get(contact.id) ?? [];
      const openTaskCount = tasks.filter((task) => !task.completed).length;
      const totalTaskCount = tasks.length;
      const visitCount = visits.length;
      const offerCount = offers.length;
      const lossReasonTag = tags.find((tag) => tag.startsWith('loss_reason:'));
      const lossReason = lossReasonTag ? lossReasonTag.replace('loss_reason:', '').replace(/_/g, ' ') : null;
      const isDiscarded = ['sin_interes', 'inactivo'].includes(contact.pipeline_stage || '');
      const needsFollowUp =
        !isDiscarded &&
        openTaskCount === 0 &&
        visitCount === 0 &&
        offerCount === 0 &&
        (!contact.pipeline_stage || ['nuevo', 'contactado'].includes(contact.pipeline_stage));

      const metadata =
        contact.buyer_intent ??
        (contact.intent_score || contact.intent_stage || contact.intent_top_area_slug || contact.intent_top_topic
          ? {
              score: contact.intent_score ?? null,
              stage: contact.intent_stage ?? null,
              topAreaSlug: contact.intent_top_area_slug ?? null,
              topTopic: contact.intent_top_topic ?? null,
            }
          : null);

      return {
        id: contact.id,
        full_name: contact.full_name,
        email: contact.email,
        phone: contact.phone,
        agent_id: contact.agent_id,
        status: contact.status,
        pipeline_stage: contact.pipeline_stage,
        created_at: contact.created_at,
        tags,
        linked_property: propertyInteraction?.properties
          ? {
              id: propertyInteraction.properties.id,
              title: propertyInteraction.properties.title ?? null,
              reference: propertyInteraction.properties.crm_reference ?? null,
            }
          : null,
        ...buildLeadSource(tags),
        open_task_count: openTaskCount,
        total_task_count: totalTaskCount,
        visit_count: visitCount,
        offer_count: offerCount,
        last_interaction_at: lastInteractionAt,
        needs_follow_up: needsFollowUp,
        is_discarded: isDiscarded,
        loss_reason: lossReason,
        metadata,
      };
    });

    const stats = {
      total: count ?? leads.length,
      web: leads.filter((lead) => lead.lead_source === 'web').length,
      portal: leads.filter((lead) => lead.lead_source === 'portal').length,
      fb: leads.filter((lead) => lead.lead_source === 'fb').length,
      needs_follow_up: leads.filter((lead) => lead.needs_follow_up).length,
      with_visits: leads.filter((lead) => lead.visit_count > 0).length,
      with_offers: leads.filter((lead) => lead.offer_count > 0).length,
      discarded: leads.filter((lead) => lead.is_discarded).length,
    };

    return json({
      ok: true,
      access_mode: accessMode,
      scope,
      source,
      search,
      pagination: {
        limit,
        offset,
        returned: leads.length,
        total: count ?? leads.length,
      },
      stats,
      leads,
    });
  } catch (err) {
    console.error('[web-leads-admin] error:', err);
    return json({ error: String(err) }, 500);
  }
});
