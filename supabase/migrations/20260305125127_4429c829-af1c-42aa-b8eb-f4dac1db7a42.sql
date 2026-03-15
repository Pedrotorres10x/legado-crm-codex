
CREATE TABLE public.idealista_contact_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  idealista_contact_id integer NOT NULL,
  idealista_contact_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id),
  UNIQUE (idealista_contact_id)
);

ALTER TABLE public.idealista_contact_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read idealista contact mappings"
  ON public.idealista_contact_mappings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage idealista contact mappings"
  ON public.idealista_contact_mappings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
