create or replace function public.extract_habihub_localized_text(raw text, tag_name text, lang text)
returns text
language plpgsql
immutable
as $$
declare
  tag_block text;
  localized text;
begin
  if raw is null or raw = '' or tag_name is null or lang is null then
    return null;
  end if;

  select (regexp_match(raw, format('(?is)<%s[^>]*>(.*?)</%s>', tag_name, tag_name)))[1]
    into tag_block;

  if tag_block is null or tag_block = '' then
    return null;
  end if;

  select (regexp_match(tag_block, format('(?is)<%s[^>]*>(.*?)</%s>', lang, lang)))[1]
    into localized;

  if localized is null or localized = '' then
    return null;
  end if;

  localized := regexp_replace(localized, '(?is)<!\[CDATA\[(.*?)\]\]>', '\1', 'g');
  localized := regexp_replace(localized, '(?is)<br\s*/?>', E'\n', 'g');
  localized := regexp_replace(localized, '(?is)</p>', E'\n', 'g');
  localized := regexp_replace(localized, '(?is)<[^>]+>', '', 'g');
  localized := replace(localized, '&amp;', '&');
  localized := replace(localized, '&lt;', '<');
  localized := replace(localized, '&gt;', '>');
  localized := replace(localized, '&quot;', '"');
  localized := replace(localized, '&apos;', '''');
  localized := replace(localized, '&nbsp;', ' ');
  localized := regexp_replace(localized, '[ \t]+', ' ', 'g');
  localized := regexp_replace(localized, E'\n{3,}', E'\n\n', 'g');
  localized := btrim(localized);

  if localized = '' then
    return null;
  end if;

  return localized;
end;
$$;

with habihub_updates as (
  select
    id,
    left(
      coalesce(
        public.extract_habihub_localized_text(source_raw_xml, 'desc', 'en'),
        public.extract_habihub_localized_text(source_raw_xml, 'description', 'en'),
        source_metadata->'raw_tags'->'description_en'->>0,
        source_metadata->'raw_tags'->'desc_en'->>0
      ),
      5000
    ) as english_description,
    nullif(
      coalesce(
        public.extract_habihub_localized_text(source_raw_xml, 'title', 'en'),
        public.extract_habihub_localized_text(source_raw_xml, 'name', 'en'),
        public.extract_habihub_localized_text(source_raw_xml, 'headline', 'en'),
        source_metadata->'raw_tags'->'title_en'->>0,
        source_metadata->'raw_tags'->'name_en'->>0
      ),
      ''
    ) as english_title
  from public.properties
  where source = 'habihub'
)
update public.properties p
set
  description = coalesce(u.english_description, p.description),
  title = coalesce(u.english_title, p.title),
  source_metadata = jsonb_set(
    jsonb_set(
      jsonb_set(
        coalesce(p.source_metadata, '{}'::jsonb),
        '{import_notes,translated_to_spanish}',
        'false'::jsonb,
        true
      ),
      '{import_notes,preserved_source_language}',
      'true'::jsonb,
      true
    ),
    '{import_notes,preferred_language}',
    to_jsonb('en'::text),
    true
  )
from habihub_updates u
where p.id = u.id
  and (u.english_description is not null or u.english_title is not null);

drop function public.extract_habihub_localized_text(text, text, text);
