create table if not exists public.property_source_identity (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  source_feed_id uuid null references public.xml_feeds(id) on delete set null,
  source_url text not null,
  crm_reference text not null,
  last_xml_id text null,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_source_identity_provider_source_url_key unique (provider, source_url)
);

alter table public.property_source_identity enable row level security;

create policy "Authenticated users can view property source identity"
on public.property_source_identity
for select
to authenticated
using (auth.uid() is not null);

create policy "Service role manages property source identity inserts"
on public.property_source_identity
for insert
to authenticated
with check (auth.role() = 'service_role');

create policy "Service role manages property source identity updates"
on public.property_source_identity
for update
to authenticated
using (auth.role() = 'service_role');

create index if not exists idx_property_source_identity_crm_reference
  on public.property_source_identity(crm_reference);

create index if not exists idx_property_source_identity_last_seen_at
  on public.property_source_identity(last_seen_at desc);

create trigger tr_property_source_identity_updated_at
before update on public.property_source_identity
for each row
execute function public.update_updated_at_column();

insert into public.property_source_identity (
  provider,
  source_feed_id,
  source_url,
  crm_reference,
  last_xml_id,
  last_seen_at
)
select
  deduped.source,
  deduped.source_feed_id,
  deduped.source_url,
  deduped.crm_reference,
  deduped.xml_id,
  deduped.seen_at
from (
  select distinct on (p.source, p.source_url)
    p.source,
    p.source_feed_id,
    p.source_url,
    p.crm_reference,
    p.xml_id,
    coalesce(p.updated_at, p.created_at, now()) as seen_at
  from public.properties p
  where p.source = 'habihub'
    and p.source_url is not null
    and p.source_url <> ''
    and p.crm_reference is not null
    and p.crm_reference <> ''
  order by p.source, p.source_url, coalesce(p.updated_at, p.created_at, now()) desc, p.created_at desc
) as deduped
on conflict (provider, source_url) do update
set
  crm_reference = excluded.crm_reference,
  source_feed_id = excluded.source_feed_id,
  last_xml_id = excluded.last_xml_id,
  last_seen_at = greatest(public.property_source_identity.last_seen_at, excluded.last_seen_at),
  updated_at = now();
