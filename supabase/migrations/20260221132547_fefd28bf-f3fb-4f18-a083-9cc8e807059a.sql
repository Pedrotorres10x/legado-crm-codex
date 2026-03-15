
-- Unified ERP sync logs table
CREATE TABLE public.erp_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target text NOT NULL,
  event text NOT NULL,
  status text NOT NULL DEFAULT 'ok',
  http_status integer,
  response_body text,
  error_message text,
  payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for dashboard queries
CREATE INDEX idx_erp_sync_logs_target_created ON public.erp_sync_logs (target, created_at DESC);
CREATE INDEX idx_erp_sync_logs_status ON public.erp_sync_logs (status) WHERE status = 'error';

-- Enable RLS
ALTER TABLE public.erp_sync_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view logs
CREATE POLICY "Admins can view erp sync logs"
  ON public.erp_sync_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role (edge functions) can insert logs
CREATE POLICY "Service role can insert erp sync logs"
  ON public.erp_sync_logs FOR INSERT
  WITH CHECK (true);
