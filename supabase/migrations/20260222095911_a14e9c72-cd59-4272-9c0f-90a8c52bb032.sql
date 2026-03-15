
-- Create communication_logs table
CREATE TABLE public.communication_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  direction text NOT NULL DEFAULT 'outbound' CHECK (direction IN ('outbound', 'inbound')),
  source text,
  subject text,
  body_preview text,
  html_preview text,
  provider_msg_id text,
  status text NOT NULL DEFAULT 'enviado' CHECK (status IN ('enviado', 'entregado', 'abierto', 'rebotado', 'error')),
  error_message text,
  agent_id uuid,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  demand_id uuid REFERENCES public.demands(id) ON DELETE SET NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_communication_logs_contact ON public.communication_logs(contact_id);
CREATE INDEX idx_communication_logs_provider ON public.communication_logs(provider_msg_id) WHERE provider_msg_id IS NOT NULL;
CREATE INDEX idx_communication_logs_created ON public.communication_logs(created_at DESC);

-- Updated_at trigger
CREATE TRIGGER update_communication_logs_updated_at
  BEFORE UPDATE ON public.communication_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as interactions)
CREATE POLICY "Agent view own communication_logs"
  ON public.communication_logs FOR SELECT
  USING (
    agent_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );

CREATE POLICY "System insert communication_logs"
  ON public.communication_logs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System update communication_logs"
  ON public.communication_logs FOR UPDATE
  USING (true);

CREATE POLICY "Admin delete communication_logs"
  ON public.communication_logs FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));
