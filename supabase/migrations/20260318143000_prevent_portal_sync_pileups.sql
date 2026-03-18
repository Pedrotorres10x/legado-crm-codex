create table if not exists public.portal_sync_state (
  sync_key text primary key,
  status text not null default 'idle',
  started_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.portal_sync_state enable row level security;

create or replace function public.touch_portal_sync_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_portal_sync_state_updated_at on public.portal_sync_state;
create trigger trg_touch_portal_sync_state_updated_at
before update on public.portal_sync_state
for each row
execute function public.touch_portal_sync_state_updated_at();

create or replace function public.auto_sync_fotocasa_on_property_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  supabase_url text;
  service_key  text;
begin
  supabase_url := current_setting('app.supabase_url', true);
  service_key  := current_setting('app.service_role_key', true);

  if supabase_url is null or service_key is null then
    return new;
  end if;

  if new.country is not null and new.country <> 'España' then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.status in ('vendido', 'retirado', 'reservado')
     and old.status is distinct from new.status then
    perform net.http_post(
      url := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'action', 'delete',
        'property_id', new.id
      ),
      timeout_milliseconds := 15000
    );
    return new;
  end if;

  if new.status = 'disponible'
     and new.latitude is not null
     and new.longitude is not null then
    perform net.http_post(
      url := supabase_url || '/functions/v1/fotocasa-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'action', 'sync_one',
        'property_id', new.id
      ),
      timeout_milliseconds := 15000
    );
  end if;

  return new;
exception when others then
  return new;
end;
$$;
