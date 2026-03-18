create or replace function public.chain_fotocasa_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  next_offset int;
  batch_sz int;
  sync_run_id text;
begin
  if NEW.target <> 'fotocasa' or NEW.event <> 'sync_batch_summary' then
    return NEW;
  end if;

  if (NEW.payload->>'has_more')::boolean is not true then
    return NEW;
  end if;

  next_offset := (coalesce(NEW.payload->>'offset', '0'))::int
               + (coalesce(NEW.payload->>'batch_size', '50'))::int;
  batch_sz := (coalesce(NEW.payload->>'batch_size', '50'))::int;
  sync_run_id := nullif(NEW.payload->>'sync_run_id', '');

  perform net.http_post(
    url := current_setting('app.supabase_url', true) || '/functions/v1/fotocasa-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object(
      'action', 'sync_all',
      'batch_size', batch_sz,
      'offset', next_offset,
      'sync_run_id', sync_run_id
    ),
    timeout_milliseconds := 15000
  );

  return NEW;
exception when others then
  return NEW;
end;
$$;
