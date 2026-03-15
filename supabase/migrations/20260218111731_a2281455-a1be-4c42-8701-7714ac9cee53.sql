
-- Tabla de exclusiones de analítica (emails e IPs propios del equipo)
CREATE TABLE public.analytics_exclusions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('email', 'ip', 'session_prefix')),
  value text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

-- RLS
ALTER TABLE public.analytics_exclusions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage exclusions"
  ON public.analytics_exclusions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth users can view exclusions"
  ON public.analytics_exclusions
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed con los valores conocidos
INSERT INTO public.analytics_exclusions (type, value, label) VALUES
  ('email', 'pedro@pedrotorres10x.es', 'Pedro Torres (equipo)'),
  ('email', 'admin@legadocoleccion.es', 'Admin Legado (equipo)');
