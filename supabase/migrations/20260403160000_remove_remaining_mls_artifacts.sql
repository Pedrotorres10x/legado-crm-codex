delete from public.notifications
where entity_type in ('mls', 'mls_incoming', 'mls_listing');

delete from public.erp_sync_logs
where target = 'mls';

delete from public.satellite_config
where satellite_key = 'mls'
   or display_name = 'MLS Network'
   or base_url = 'https://osbpegzxqhhsxaemjwvk.supabase.co';

drop trigger if exists trg_auto_mls_non_xml on public.properties;
drop trigger if exists trg_auto_sync_mls on public.properties;

drop function if exists public.auto_publish_non_xml_to_mls();
drop function if exists public.auto_sync_mls_on_property_change();

drop table if exists public.mls_listings cascade;
drop table if exists public.mls_incoming cascade;
