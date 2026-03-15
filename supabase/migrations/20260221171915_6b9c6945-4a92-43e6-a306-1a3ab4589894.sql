
-- Create satellite_config table
CREATE TABLE public.satellite_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  satellite_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  base_url text NOT NULL DEFAULT '',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  last_heartbeat timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.satellite_config ENABLE ROW LEVEL SECURITY;

-- SELECT: any authenticated user
CREATE POLICY "Auth users can view satellite_config"
  ON public.satellite_config FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: admin only
CREATE POLICY "Admin insert satellite_config"
  ON public.satellite_config FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update satellite_config"
  ON public.satellite_config FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete satellite_config"
  ON public.satellite_config FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role can update heartbeat (from edge function)
CREATE POLICY "Service can update heartbeat"
  ON public.satellite_config FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_satellite_config_updated_at
  BEFORE UPDATE ON public.satellite_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed initial satellites
INSERT INTO public.satellite_config (satellite_key, display_name, base_url, config) VALUES
  ('legado', 'Legado Colección', 'https://legadocoleccion.es', '{"theme": "dark", "show_price": true}'::jsonb),
  ('faktura', 'Faktura', 'https://lbcdxtrsuscdflczcjex.supabase.co', '{}'::jsonb),
  ('multichannel', 'MultiChannel', 'https://fwzsxcwqwyezprqavcnc.supabase.co', '{}'::jsonb),
  ('mls', 'MLS Network', 'https://osbpegzxqhhsxaemjwvk.supabase.co', '{}'::jsonb),
  ('linkinbio', 'Link In Bio', '', '{}'::jsonb);
