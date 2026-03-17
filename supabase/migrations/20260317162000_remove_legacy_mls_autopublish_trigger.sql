drop trigger if exists trg_auto_mls_non_xml on public.properties;
drop function if exists public.auto_publish_non_xml_to_mls();
drop trigger if exists trg_auto_sync_mls on public.properties;
drop function if exists public.auto_sync_mls_on_property_change();
