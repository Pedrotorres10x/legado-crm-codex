
CREATE TABLE public.faktura_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event text NOT NULL,
  status text NOT NULL DEFAULT 'ok', -- 'ok' | 'error'
  http_status integer,
  response_body text,
  error_message text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.faktura_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view faktura sync logs"
  ON public.faktura_sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert faktura sync logs"
  ON public.faktura_sync_logs FOR INSERT
  WITH CHECK (true);
