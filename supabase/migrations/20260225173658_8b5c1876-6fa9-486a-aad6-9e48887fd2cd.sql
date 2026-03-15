
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_ref text,
  ADD COLUMN IF NOT EXISTS listing_price numeric;

COMMENT ON COLUMN public.contacts.source_url IS 'URL del anuncio original (ej. Idealista, Fotocasa)';
COMMENT ON COLUMN public.contacts.source_ref IS 'Referencia externa del anuncio (ej. ID de Idealista)';
COMMENT ON COLUMN public.contacts.listing_price IS 'Precio publicado del inmueble del contacto';
