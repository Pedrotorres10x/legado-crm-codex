
-- Table to track CRM properties published to the MLS
CREATE TABLE public.mls_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  mls_property_id text, -- ID of the property in the MLS database
  status text NOT NULL DEFAULT 'pending', -- pending, published, error, removed
  published_at timestamptz,
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(property_id)
);

-- Table to track properties received FROM the MLS
CREATE TABLE public.mls_incoming (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mls_property_id text NOT NULL,
  mls_agency_name text,
  title text NOT NULL,
  price numeric,
  property_type text,
  operation_type text,
  city text,
  zone text,
  address text,
  bedrooms integer,
  bathrooms integer,
  surface_area numeric,
  description text,
  images text[],
  features text[],
  reference_code text,
  energy_certificate text,
  latitude numeric,
  longitude numeric,
  status text NOT NULL DEFAULT 'pendiente', -- pendiente, revisada, importada, descartada
  reviewed_by uuid,
  imported_property_id uuid REFERENCES public.properties(id),
  raw_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mls_property_id)
);

-- Enable RLS
ALTER TABLE public.mls_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mls_incoming ENABLE ROW LEVEL SECURITY;

-- RLS for mls_listings
CREATE POLICY "Auth users can view mls_listings" ON public.mls_listings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can insert mls_listings" ON public.mls_listings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update mls_listings" ON public.mls_listings
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin delete mls_listings" ON public.mls_listings
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for mls_incoming
CREATE POLICY "Auth users can view mls_incoming" ON public.mls_incoming
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert mls_incoming" ON public.mls_incoming
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admin coord can update mls_incoming" ON public.mls_incoming
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role));

CREATE POLICY "Admin delete mls_incoming" ON public.mls_incoming
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_mls_listings_updated_at BEFORE UPDATE ON public.mls_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mls_incoming_updated_at BEFORE UPDATE ON public.mls_incoming
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
