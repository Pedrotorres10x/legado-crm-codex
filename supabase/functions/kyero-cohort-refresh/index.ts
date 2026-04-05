import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COHORT_TAG = 'portal_cohort_alicante_50';
const FEED_NAME = 'HabiHub · Blanca Cálida';
const TARGET_COUNT = 50;
const ALLOWED_TYPES = new Set(['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio']);
const KYERO_REFRESH_KEY = '7a6b6fb9-0b6f-4b9a-98d3-4a8d31f61c52';

type Candidate = {
  id: string;
  crm_reference: string | null;
  title: string;
  description: string | null;
  property_type: string | null;
  price: number | null;
  city: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[] | null;
  floor_plans: string[] | null;
  videos: string[] | null;
  virtual_tour_url: string | null;
  surface_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  has_garage: boolean | null;
  has_pool: boolean | null;
  has_terrace: boolean | null;
  has_garden: boolean | null;
  has_elevator: boolean | null;
  tags: string[] | null;
  qualityScore: number;
  photoCount: number;
  zoneKey: string;
  cityKey: string;
  priceBand: string;
  zoneRank: number;
  selectionScore?: number;
  selectionReason?: string;
};

type SnapshotRow = {
  id: string;
  crm_reference: string | null;
  title: string;
  description: string | null;
  property_type: string | null;
  price: number | null;
  city: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[] | null;
  floor_plans: string[] | null;
  videos: string[] | null;
  virtual_tour_url: string | null;
  surface_area: number | null;
  built_area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  has_garage: boolean | null;
  has_pool: boolean | null;
  has_terrace: boolean | null;
  has_garden: boolean | null;
  has_elevator: boolean | null;
  tags: string[] | null;
  source: string | null;
  source_feed_name: string | null;
  province: string | null;
  status: string | null;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeText(value: string | null | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function countMedia(items: unknown): number {
  return Array.isArray(items) ? items.filter((item) => typeof item === 'string' && item.trim()).length : 0;
}

function getPriceBand(price: number | null): string {
  const value = price || 0;
  if (value <= 250000) return 'up_to_250k';
  if (value <= 500000) return '250k_500k';
  if (value <= 1000000) return '500k_1m';
  return '1m_plus';
}

function getDescriptionLength(description: string | null | undefined): number {
  return (description || '').trim().length;
}

function getQualityScore(property: Omit<Candidate, 'qualityScore' | 'zoneKey' | 'cityKey' | 'priceBand' | 'zoneRank' | 'selectionScore' | 'selectionReason'>): number {
  const photoCount = countMedia(property.images);
  const hasFloorPlan = countMedia(property.floor_plans) > 0;
  const hasVideo = countMedia(property.videos) > 0;
  const hasVirtualTour = Boolean(property.virtual_tour_url);
  const hasCover = photoCount > 0;
  const descriptionLength = getDescriptionLength(property.description);
  const amenityCount = [
    property.has_garage,
    property.has_pool,
    property.has_terrace,
    property.has_garden,
    property.has_elevator,
  ].filter(Boolean).length;

  let mediaScore = 0;
  if (photoCount >= 15) mediaScore += 22;
  else if (photoCount >= 10) mediaScore += 18;
  else if (photoCount >= 8) mediaScore += 12;
  else if (photoCount >= 6) mediaScore += 8;
  if (hasFloorPlan) mediaScore += 6;
  if (hasVideo) mediaScore += 4;
  if (hasVirtualTour) mediaScore += 5;
  if (hasCover) mediaScore += 3;

  let completenessScore = 0;
  if (descriptionLength >= 700) completenessScore += 8;
  else if (descriptionLength >= 400) completenessScore += 6;
  if ((property.surface_area || property.built_area || 0) > 0) completenessScore += 4;
  if ((property.bedrooms || 0) > 0) completenessScore += 3;
  if ((property.bathrooms || 0) > 0) completenessScore += 3;
  if (property.zone || property.city) completenessScore += 2;
  if ((property.price || 0) > 0) completenessScore += 3;
  if (property.latitude && property.longitude) completenessScore += 2;

  let commercialScore = 0;
  if (['piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex'].includes(property.property_type || '')) commercialScore += 6;
  else if (property.property_type === 'estudio') commercialScore += 4;
  const priceBand = getPriceBand(property.price);
  if (priceBand === '250k_500k' || priceBand === '500k_1m') commercialScore += 5;
  else commercialScore += 4;
  if (photoCount >= 10 && descriptionLength >= 400) commercialScore += 4;
  commercialScore += Math.min(3, amenityCount);

  let confidenceScore = 0;
  if (property.latitude && property.longitude) confidenceScore += 4;
  if (ALLOWED_TYPES.has(property.property_type || '')) confidenceScore += 3;
  if (descriptionLength >= 250 && photoCount >= 6 && (property.price || 0) > 0) confidenceScore += 4;
  if (photoCount > 0) confidenceScore += 2;
  if (property.city || property.zone) confidenceScore += 2;

  return Math.min(100, mediaScore + completenessScore + commercialScore + confidenceScore);
}

function buildSelectionReason(candidate: Candidate, coverageBonus: number, priceBonus: number, concentrationPenalty: number, pricePenalty: number): string {
  const reasons: string[] = [`calidad ${candidate.qualityScore}`];
  if (coverageBonus >= 30) reasons.push('zona nueva');
  else if (coverageBonus >= 10) reasons.push('ciudad nueva');
  if (priceBonus >= 18) reasons.push('tramo de precio nuevo');
  else if (priceBonus >= 8) reasons.push('equilibrio de precio');
  if (candidate.photoCount >= 15) reasons.push('media premium');
  else if (candidate.photoCount >= 10) reasons.push('media fuerte');
  if (countMedia(candidate.floor_plans) > 0) reasons.push('con plano');
  if (candidate.virtual_tour_url) reasons.push('con tour virtual');
  if (concentrationPenalty > 0) reasons.push('repite zona');
  if (pricePenalty > 0) reasons.push('tramo ya representado');
  return reasons.join(' · ');
}

function toCandidate(row: SnapshotRow): Candidate {
  const candidateBase = {
    ...row,
    photoCount: countMedia(row.images),
  } as Omit<Candidate, 'qualityScore' | 'zoneKey' | 'cityKey' | 'priceBand' | 'zoneRank' | 'selectionScore' | 'selectionReason'>;

  return {
    ...candidateBase,
    zoneKey: normalizeText(row.zone || row.city),
    cityKey: normalizeText(row.city || row.zone),
    qualityScore: getQualityScore(candidateBase),
    priceBand: getPriceBand(row.price),
    zoneRank: 1,
  };
}

function buildPayloadFromSelection(selected: Candidate[], taggedAdded = 0, taggedRemoved = 0) {
  const zoneCounts = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  const priceBandCounts = new Map<string, number>();

  for (const item of selected) {
    zoneCounts.set(item.zoneKey, (zoneCounts.get(item.zoneKey) || 0) + 1);
    cityCounts.set(item.cityKey, (cityCounts.get(item.cityKey) || 0) + 1);
    priceBandCounts.set(item.priceBand, (priceBandCounts.get(item.priceBand) || 0) + 1);
  }

  return {
    cohort_tag: COHORT_TAG,
    selected_count: selected.length,
    distinct_zones: zoneCounts.size,
    distinct_cities: cityCounts.size,
    price_band_counts: Object.fromEntries(priceBandCounts.entries()),
    tagged_added: taggedAdded,
    tagged_removed: taggedRemoved,
    sample: selected.slice(0, 12).map((item) => ({
      id: item.id,
      crm_reference: item.crm_reference,
      title: item.title,
      city: item.city,
      zone: item.zone,
      property_type: item.property_type,
      price: item.price,
      photo_count: item.photoCount,
      quality_score: item.qualityScore,
      selection_score: item.selectionScore,
      zone_rank: item.zoneRank,
      selection_reason: item.selectionReason,
    })),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return json({ error: 'Missing Supabase runtime secrets' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const url = new URL(req.url);
    const refreshKey = req.headers.get('x-kyero-refresh-key')?.trim() || url.searchParams.get('key')?.trim() || '';
    if (refreshKey !== KYERO_REFRESH_KEY) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return json({ error: 'No authorization' }, 401);
      }

      const token = authHeader.replace('Bearer ', '').trim();
      const { data: authData, error: authErr } = await supabase.auth.getUser(token);
      const user = authData?.user;

      if (authErr || !user) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const [{ data: isAdmin }, { data: isCoord }] = await Promise.all([
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'coordinadora' }),
      ]);

      if (!isAdmin && !isCoord) {
        return json({ error: 'Admin or coordinadora only' }, 403);
      }
    }

    const { data: rows, error } = await supabase
      .from('properties')
      .select(`
        id, crm_reference, title, description, property_type, price, city, zone, latitude, longitude,
        images, floor_plans, videos, virtual_tour_url, surface_area, built_area, bedrooms, bathrooms,
        has_garage, has_pool, has_terrace, has_garden, has_elevator, tags, source, source_feed_name,
        province, status
      `)
      .eq('source', 'habihub')
      .eq('source_feed_name', FEED_NAME)
      .eq('province', 'Alicante')
      .eq('status', 'disponible')
      .in('property_type', Array.from(ALLOWED_TYPES));

    if (error) throw error;

    const candidatesBase = ((rows || []) as SnapshotRow[])
      .filter((row) => {
        const title = (row.title || '').trim();
        const description = (row.description || '').trim();
        const photoCount = countMedia(row.images);
        return Boolean(title)
          && Boolean(description)
          && (row.price || 0) > 0
          && row.latitude !== null
          && row.longitude !== null
          && Boolean((row.zone || '').trim() || (row.city || '').trim())
          && photoCount >= 6;
      })
      .map((row) => {
        const candidate = {
          ...row,
          photoCount: countMedia(row.images),
        } as Omit<Candidate, 'qualityScore' | 'zoneKey' | 'cityKey' | 'priceBand' | 'zoneRank' | 'selectionScore' | 'selectionReason'>;

        return {
          ...candidate,
          zoneKey: normalizeText(row.zone || row.city),
          cityKey: normalizeText(row.city || row.zone),
          qualityScore: getQualityScore(candidate),
          priceBand: getPriceBand(row.price),
          zoneRank: 0,
        } as Candidate;
      });

    if (candidatesBase.length < TARGET_COUNT) {
      return json({ error: `Solo hay ${candidatesBase.length} candidatos válidos para construir la cohorte de ${TARGET_COUNT}.` }, 422);
    }

    const ranked: Candidate[] = [];
    const byZone = new Map<string, Candidate[]>();
    for (const candidate of candidatesBase) {
      if (!byZone.has(candidate.zoneKey)) byZone.set(candidate.zoneKey, []);
      byZone.get(candidate.zoneKey)!.push(candidate);
    }

    for (const candidates of byZone.values()) {
      candidates.sort((a, b) =>
        b.qualityScore - a.qualityScore
        || b.photoCount - a.photoCount
        || countMedia(b.floor_plans) - countMedia(a.floor_plans)
        || Number(Boolean(b.virtual_tour_url)) - Number(Boolean(a.virtual_tour_url))
        || getDescriptionLength(b.description) - getDescriptionLength(a.description)
        || (b.price || 0) - (a.price || 0)
      );
      candidates.forEach((candidate, index) => ranked.push({ ...candidate, zoneRank: index + 1 }));
    }

    const selected: Candidate[] = [];
    const selectedIds = new Set<string>();
    const zoneCounts = new Map<string, number>();
    const cityCounts = new Map<string, number>();
    const priceBandCounts = new Map<string, number>();

    const getDynamicScore = (candidate: Candidate) => {
      const currentZoneCount = zoneCounts.get(candidate.zoneKey) || 0;
      const currentCityCount = cityCounts.get(candidate.cityKey) || 0;
      const currentPriceBandCount = priceBandCounts.get(candidate.priceBand) || 0;
      if (currentZoneCount >= 3) return null;

      const coverageBonus = currentZoneCount === 0 ? 30 : currentCityCount === 0 ? 10 : 0;
      const concentrationPenalty = currentZoneCount === 0 ? 0 : currentZoneCount === 1 ? 25 : 60;
      const cityPenalty = currentCityCount >= 2 ? 15 : 0;
      const averageBandCount = selected.length > 0 ? selected.length / 4 : 0;
      const priceDiversityBonus = currentPriceBandCount === 0 ? 18 : currentPriceBandCount < Math.ceil(averageBandCount) ? 8 : 0;

      let priceConcentrationPenalty = 0;
      if (selected.length >= 8 && currentPriceBandCount > Math.ceil(selected.length / 3)) priceConcentrationPenalty = 10;
      if (selected.length >= 16 && currentPriceBandCount > Math.ceil(selected.length / 2)) priceConcentrationPenalty = 25;

      return {
        selectionScore: candidate.qualityScore + coverageBonus + priceDiversityBonus - concentrationPenalty - cityPenalty - priceConcentrationPenalty,
        coverageBonus,
        priceDiversityBonus,
        concentrationPenalty: concentrationPenalty + cityPenalty,
        priceConcentrationPenalty,
      };
    };

    for (let phase = 1; phase <= 3 && selected.length < TARGET_COUNT; phase += 1) {
      while (selected.length < TARGET_COUNT) {
        let best: Candidate | null = null;
        let bestScore = Number.NEGATIVE_INFINITY;
        let bestMeta: ReturnType<typeof getDynamicScore> | null = null;

        for (const candidate of ranked) {
          if (selectedIds.has(candidate.id) || candidate.zoneRank > phase) continue;
          const meta = getDynamicScore(candidate);
          if (!meta) continue;
          if (meta.selectionScore > bestScore) {
            best = candidate;
            bestScore = meta.selectionScore;
            bestMeta = meta;
          }
        }

        if (!best || !bestMeta) break;

        const finalized: Candidate = {
          ...best,
          selectionScore: bestMeta.selectionScore,
          selectionReason: buildSelectionReason(
            best,
            bestMeta.coverageBonus,
            bestMeta.priceDiversityBonus,
            bestMeta.concentrationPenalty,
            bestMeta.priceConcentrationPenalty,
          ),
        };

        selected.push(finalized);
        selectedIds.add(finalized.id);
        zoneCounts.set(finalized.zoneKey, (zoneCounts.get(finalized.zoneKey) || 0) + 1);
        cityCounts.set(finalized.cityKey, (cityCounts.get(finalized.cityKey) || 0) + 1);
        priceBandCounts.set(finalized.priceBand, (priceBandCounts.get(finalized.priceBand) || 0) + 1);
      }
    }

    if (selected.length !== TARGET_COUNT) {
      return json({ error: `No se pudo cerrar una cohorte exacta de ${TARGET_COUNT}. Seleccionados: ${selected.length}.` }, 422);
    }

    const { data: taggedRows, error: taggedError } = await supabase
      .from('properties')
      .select('id, tags')
      .contains('tags', [COHORT_TAG]);

    if (taggedError) throw taggedError;

    const selectedSet = new Set(selected.map((item) => item.id));

    let taggedAdded = 0;
    for (const item of selected) {
      const currentTags = Array.isArray(item.tags) ? item.tags : [];
      if (currentTags.includes(COHORT_TAG)) continue;
      const { error: updateError } = await supabase
        .from('properties')
        .update({ tags: Array.from(new Set([...currentTags, COHORT_TAG])) })
        .eq('id', item.id);
      if (updateError) throw updateError;
      taggedAdded += 1;
    }

    let taggedRemoved = 0;
    for (const row of taggedRows || []) {
      if (selectedSet.has(row.id)) continue;
      const currentTags = Array.isArray(row.tags) ? row.tags : [];
      const { error: updateError } = await supabase
        .from('properties')
        .update({ tags: currentTags.filter((tag) => tag !== COHORT_TAG) })
        .eq('id', row.id);
      if (updateError) throw updateError;
      taggedRemoved += 1;
    }

    const payload = {
      ...buildPayloadFromSelection(selected, taggedAdded, taggedRemoved),
      snapshot_locked: false,
      snapshot_source: 'last_snapshot_wins',
    };

    await supabase.from('erp_sync_logs').insert({
      target: 'kyero-cohort',
      event: 'selection_refreshed',
      status: 'success',
      http_status: 200,
      payload,
    });

    return json({ ok: true, ...payload });
  } catch (error) {
    console.error('[kyero-cohort-refresh] error:', error);
    return json({ error: String(error) }, 500);
  }
});
