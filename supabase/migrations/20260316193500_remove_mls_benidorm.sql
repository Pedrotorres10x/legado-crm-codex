delete from public.notifications
where entity_type = 'mls_incoming';

delete from public.erp_sync_logs
where target = 'mls';

delete from public.satellite_config
where satellite_key = 'mls';

drop trigger if exists update_mls_listings_updated_at on public.mls_listings;
drop trigger if exists update_mls_incoming_updated_at on public.mls_incoming;

drop table if exists public.mls_listings cascade;
drop table if exists public.mls_incoming cascade;
