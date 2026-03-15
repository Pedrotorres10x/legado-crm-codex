ALTER TABLE public.wa_daily_counter ENABLE ROW LEVEL SECURITY;

-- Allow service-role and authenticated users to use the counter
CREATE POLICY "Authenticated users can manage wa_daily_counter"
  ON public.wa_daily_counter
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);