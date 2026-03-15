
CREATE TABLE public.app_config (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Only admins can manage config
CREATE POLICY "Admin manage app_config" ON public.app_config
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- All authenticated can read (edge functions need this)
CREATE POLICY "Auth read app_config" ON public.app_config
  FOR SELECT TO authenticated
  USING (true);

-- Service role can read (for edge functions)  
CREATE POLICY "Service read app_config" ON public.app_config
  FOR SELECT TO anon
  USING (true);

-- Insert the kill switch, OFF by default (sending enabled)
INSERT INTO public.app_config (key, value) VALUES ('messaging_enabled', 'false');
