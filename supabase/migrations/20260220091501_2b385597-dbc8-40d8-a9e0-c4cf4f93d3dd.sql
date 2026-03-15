
-- Table to log every individual email sent by the match engine
CREATE TABLE public.match_emails (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  demand_id uuid NOT NULL REFERENCES public.demands(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  agent_id uuid,
  email_to text NOT NULL,
  subject text NOT NULL,
  status text NOT NULL DEFAULT 'enviado',
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Indexes for fast lookup per contact & property
CREATE INDEX idx_match_emails_contact ON public.match_emails(contact_id);
CREATE INDEX idx_match_emails_property ON public.match_emails(property_id);
CREATE INDEX idx_match_emails_sent_at ON public.match_emails(sent_at DESC);

-- Enable RLS
ALTER TABLE public.match_emails ENABLE ROW LEVEL SECURITY;

-- Agents see emails of their own contacts
CREATE POLICY "Agent view own match_emails"
  ON public.match_emails FOR SELECT
  USING (
    agent_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  );

-- Service role / edge functions can insert
CREATE POLICY "System insert match_emails"
  ON public.match_emails FOR INSERT
  WITH CHECK (true);
