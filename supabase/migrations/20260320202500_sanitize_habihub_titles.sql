create or replace function public.sanitize_imported_property_title(raw text)
returns text
language plpgsql
immutable
as $$
declare
  cleaned text;
  candidate text;
  word_count integer;
begin
  if raw is null or btrim(raw) = '' then
    return null;
  end if;

  cleaned := raw;
  cleaned := regexp_replace(cleaned, '(?is)<!\[CDATA\[(.*?)\]\]>', '\1', 'g');
  cleaned := regexp_replace(cleaned, '(?is)<br\s*/?>', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(?is)</p>', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(?is)<[^>]+>', ' ', 'g');
  cleaned := replace(cleaned, '&amp;', '&');
  cleaned := replace(cleaned, '&lt;', '<');
  cleaned := replace(cleaned, '&gt;', '>');
  cleaned := replace(cleaned, '&quot;', '"');
  cleaned := replace(cleaned, '&apos;', '''');
  cleaned := replace(cleaned, '&nbsp;', ' ');
  cleaned := regexp_replace(cleaned, '(?i)https?://\S+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '(?i)\m(not-available|undefined|null)\M', ' ', 'g');
  cleaned := regexp_replace(cleaned, '[ \t]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, E'\n{3,}', E'\n\n', 'g');
  cleaned := btrim(cleaned);

  if cleaned = '' then
    return null;
  end if;

  candidate := split_part(cleaned, E'\n', 1);
  candidate := btrim(split_part(candidate, '.', 1));
  if candidate = '' then
    candidate := cleaned;
  end if;

  word_count := coalesce(array_length(regexp_split_to_array(candidate, '\s+'), 1), 0);
  if length(candidate) > 160 or word_count > 14 then
    return null;
  end if;

  return left(candidate, 140);
end;
$$;

update public.properties p
set
  title = coalesce(
    public.sanitize_imported_property_title(p.title),
    initcap(coalesce(nullif(p.property_type::text, ''), 'propiedad')) || ' en ' || coalesce(nullif(p.city, ''), nullif(p.province, ''), 'ubicacion desconocida')
  ),
  source_metadata = jsonb_set(
    coalesce(p.source_metadata, '{}'::jsonb),
    '{raw_values,title}',
    to_jsonb(
      coalesce(
        public.sanitize_imported_property_title(p.source_metadata->'raw_values'->>'title'),
        public.sanitize_imported_property_title(p.title),
        initcap(coalesce(nullif(p.property_type::text, ''), 'propiedad')) || ' en ' || coalesce(nullif(p.city, ''), nullif(p.province, ''), 'ubicacion desconocida')
      )
    ),
    true
  )
where p.source = 'habihub'
  and (
    p.title ~* 'https?://'
    or p.title ~* '\m(not-available|undefined|null)\M'
    or char_length(coalesce(p.title, '')) > 160
  );

drop function public.sanitize_imported_property_title(text);
