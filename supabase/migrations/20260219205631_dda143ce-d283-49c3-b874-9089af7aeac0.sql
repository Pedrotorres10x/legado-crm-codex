
-- Create multichannel_sync_logs table (mirrors faktura_sync_logs)
CREATE TABLE public.multichannel_sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ok',
  http_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  payload JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.multichannel_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view multichannel sync logs"
ON public.multichannel_sync_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert logs
CREATE POLICY "Service role can insert multichannel sync logs"
ON public.multichannel_sync_logs
FOR INSERT
WITH CHECK (true);
