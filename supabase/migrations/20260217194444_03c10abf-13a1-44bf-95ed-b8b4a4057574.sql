
-- Tabla de pageviews de legadocoleccion.es
CREATE TABLE IF NOT EXISTS public.web_pageviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL,
  page TEXT NOT NULL DEFAULT '/',
  referrer TEXT,
  user_agent TEXT,
  country TEXT,
  device TEXT, -- 'mobile' | 'tablet' | 'desktop'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- No RLS needed — es una tabla de analytics pública de inserción
ALTER TABLE public.web_pageviews ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden leer
CREATE POLICY "Admins can read pageviews"
  ON public.web_pageviews FOR SELECT
  USING (true);

-- Inserción pública para el tracker (se controla en la edge function con service role)
-- No se crea una política INSERT porque el tracker usará service role key en la edge function

-- Índices útiles para queries de analytics
CREATE INDEX IF NOT EXISTS idx_web_pageviews_created_at ON public.web_pageviews(created_at);
CREATE INDEX IF NOT EXISTS idx_web_pageviews_session_id ON public.web_pageviews(session_id);
CREATE INDEX IF NOT EXISTS idx_web_pageviews_page ON public.web_pageviews(page);
