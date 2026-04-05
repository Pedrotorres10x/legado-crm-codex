import fs from 'node:fs';
import path from 'node:path';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://edeprsrdumcnhixijlfu.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const MAX_REF = 1_000_000;
const CLUSTER_GAP = 3;
const MIN_SUSPICIOUS_SPAN = 500;

function refNum(ref) {
  const match = /^LGD-(\d+)$/.exec(ref || '');
  return match ? Number(match[1]) : null;
}

function refCode(num) {
  return `LGD-${String(num).padStart(4, '0')}`;
}

async function rest(pathname, options = {}) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function buildClusters(rows) {
  const sorted = [...rows].sort((a, b) => a.ref_num - b.ref_num);
  const clusters = [];
  let current = [];

  for (const row of sorted) {
    if (
      current.length === 0 ||
      row.ref_num - current[current.length - 1].ref_num <= CLUSTER_GAP
    ) {
      current.push(row);
      continue;
    }

    clusters.push(current);
    current = [row];
  }

  if (current.length > 0) clusters.push(current);
  return clusters;
}

function selectCanonicalCluster(clusters) {
  return [...clusters].sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    return a[0].ref_num - b[0].ref_num;
  })[0];
}

function normalizeSample(row) {
  return {
    id: row.id,
    crm_reference: row.crm_reference,
    city: row.city,
    title: row.title,
    xml_id: row.xml_id,
    price: row.price,
    surface_area: row.surface_area,
    bedrooms: row.bedrooms,
    bathrooms: row.bathrooms,
  };
}

function nextAvailableRefGenerator(usedSet, startAt) {
  let cursor = startAt;

  return () => {
    for (let attempts = 0; attempts < MAX_REF; attempts += 1) {
      cursor += 1;
      if (cursor > MAX_REF) cursor = 1;
      const candidate = refCode(cursor);
      if (!usedSet.has(candidate)) {
        usedSet.add(candidate);
        return candidate;
      }
    }

    throw new Error('No free CRM references available in the full cycle');
  };
}

async function main() {
  const properties = await rest(
    "properties?select=id,crm_reference,title,address,city,price,surface_area,bedrooms,bathrooms,status,source,xml_id,source_url,created_at,updated_at&source=eq.habihub&crm_reference=not.is.null&order=crm_reference.asc&limit=5000",
  );

  const rows = properties
    .map((row) => ({ ...row, ref_num: refNum(row.crm_reference) }))
    .filter((row) => row.ref_num !== null);

  const maxRefNum = rows.reduce(
    (max, row) => Math.max(max, row.ref_num || 0),
    0,
  );
  const usedRefs = new Set(rows.map((row) => row.crm_reference));
  const allocateRef = nextAvailableRefGenerator(usedRefs, maxRefNum);

  const byDevelopment = new Map();
  for (const row of rows) {
    const key = row.source_url || `xml:${row.xml_id}`;
    if (!byDevelopment.has(key)) byDevelopment.set(key, []);
    byDevelopment.get(key).push(row);
  }

  const proposals = [];

  for (const [developmentUrl, devRows] of byDevelopment.entries()) {
    if (devRows.length < 2) continue;

    const sorted = [...devRows].sort((a, b) => a.ref_num - b.ref_num);
    const span = sorted[sorted.length - 1].ref_num - sorted[0].ref_num;
    if (span < MIN_SUSPICIOUS_SPAN) continue;

    const clusters = buildClusters(sorted);
    if (clusters.length < 2) continue;

    const canonicalCluster = selectCanonicalCluster(clusters);
    const canonicalIds = new Set(canonicalCluster.map((row) => row.id));
    const intruders = sorted.filter((row) => !canonicalIds.has(row.id));
    if (intruders.length === 0) continue;

    const proposedChanges = intruders.map((row) => ({
      id: row.id,
      from: row.crm_reference,
      to: allocateRef(),
      city: row.city,
      title: row.title,
      xml_id: row.xml_id,
      price: row.price,
    }));

    proposals.push({
      development_url: developmentUrl,
      count: sorted.length,
      span,
      canonical_cluster: canonicalCluster.map(normalizeSample),
      intruders: intruders.map(normalizeSample),
      proposed_changes: proposedChanges,
    });
  }

  proposals.sort((a, b) => b.span - a.span || b.intruders.length - a.intruders.length);

  const report = {
    generated_at: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    total_properties: rows.length,
    suspicious_developments: proposals.length,
    proposed_reference_changes: proposals.reduce(
      (sum, item) => sum + item.proposed_changes.length,
      0,
    ),
    proposals,
  };

  const outPath = path.resolve(
    APPLY
      ? 'tmp_state_ref_fix_apply_result.json'
      : 'tmp_state_ref_fix_dry_run.json',
  );

  if (APPLY) {
    for (const proposal of proposals) {
      for (const change of proposal.proposed_changes) {
        await rest(`properties?id=eq.${change.id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ crm_reference: change.to }),
        });
      }
    }
  }

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(
    `${APPLY ? 'Applied' : 'Prepared'} ${report.proposed_reference_changes} reference changes across ${report.suspicious_developments} developments.`,
  );
  console.log(outPath);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
