-- Announcements table for CRM changelog/updates
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  content text NOT NULL,
  category text NOT NULL DEFAULT 'mejora',
  created_by uuid,
  emailed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view announcements" ON public.announcements
  FOR SELECT USING (true);

CREATE POLICY "Admin insert announcements" ON public.announcements
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin delete announcements" ON public.announcements
  FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin update announcements" ON public.announcements
  FOR UPDATE USING (has_role(auth.uid(), 'admin'::app_role));