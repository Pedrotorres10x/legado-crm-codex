alter table public.contacts
  add column if not exists buyer_intent jsonb,
  add column if not exists intent_score integer,
  add column if not exists intent_stage text,
  add column if not exists intent_top_area_slug text,
  add column if not exists intent_top_topic text;
