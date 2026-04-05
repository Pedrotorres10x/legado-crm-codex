CREATE TABLE public.voice_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  purpose_code text NOT NULL,
  purpose_prompt text,
  provider text NOT NULL DEFAULT 'elevenlabs',
  source_scope text NOT NULL DEFAULT 'database',
  status text NOT NULL DEFAULT 'draft',
  target_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  exclusion_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NOT NULL,
  launched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_campaigns_status_check CHECK (status IN ('draft', 'queued', 'running', 'paused', 'completed', 'archived')),
  CONSTRAINT voice_campaigns_source_scope_check CHECK (source_scope IN ('statefox', 'database', 'manual'))
);

CREATE TABLE public.voice_campaign_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.voice_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_agent_id uuid,
  display_name text NOT NULL,
  phone text NOT NULL,
  source_ref text,
  city text,
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 50,
  attempt_count integer NOT NULL DEFAULT 0,
  outcome_code text,
  positive_signal_score numeric(5,4),
  handoff_to_human boolean NOT NULL DEFAULT false,
  handoff_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz,
  notes text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT voice_campaign_contacts_status_check CHECK (status IN ('pending', 'queued', 'calling', 'completed', 'failed', 'excluded')),
  CONSTRAINT voice_campaign_contacts_phone_check CHECK (length(btrim(phone)) > 0)
);

CREATE TABLE public.voice_call_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_contact_id uuid NOT NULL REFERENCES public.voice_campaign_contacts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'elevenlabs',
  provider_call_id text,
  raw_status text,
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  transcript text,
  summary text,
  outcome_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  recording_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.voice_contact_flags (
  contact_id uuid PRIMARY KEY REFERENCES public.contacts(id) ON DELETE CASCADE,
  voice_allowed boolean NOT NULL DEFAULT true,
  do_not_call boolean NOT NULL DEFAULT false,
  hostile_flag boolean NOT NULL DEFAULT false,
  wrong_number_flag boolean NOT NULL DEFAULT false,
  intermediary_flag boolean NOT NULL DEFAULT false,
  last_disposition text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_campaigns_created_at ON public.voice_campaigns(created_at DESC);
CREATE INDEX idx_voice_campaigns_status ON public.voice_campaigns(status);
CREATE INDEX idx_voice_campaign_contacts_campaign_id ON public.voice_campaign_contacts(campaign_id);
CREATE INDEX idx_voice_campaign_contacts_status ON public.voice_campaign_contacts(status);
CREATE INDEX idx_voice_campaign_contacts_handoff ON public.voice_campaign_contacts(handoff_to_human) WHERE handoff_to_human = true;
CREATE INDEX idx_voice_call_runs_campaign_contact_id ON public.voice_call_runs(campaign_contact_id);

CREATE TRIGGER tr_voice_campaigns_updated_at
BEFORE UPDATE ON public.voice_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_voice_campaign_contacts_updated_at
BEFORE UPDATE ON public.voice_campaign_contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tr_voice_contact_flags_updated_at
BEFORE UPDATE ON public.voice_contact_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.voice_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_campaign_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_call_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_contact_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Voice campaigns admin/coordinadora select"
ON public.voice_campaigns
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice campaigns admin/coordinadora insert"
ON public.voice_campaigns
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role))
);

CREATE POLICY "Voice campaigns admin/coordinadora update"
ON public.voice_campaigns
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice campaign contacts admin/coordinadora select"
ON public.voice_campaign_contacts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice campaign contacts admin/coordinadora insert"
ON public.voice_campaign_contacts
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice campaign contacts admin/coordinadora update"
ON public.voice_campaign_contacts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice campaign contacts admin/coordinadora delete"
ON public.voice_campaign_contacts
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice call runs admin/coordinadora select"
ON public.voice_call_runs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice call runs admin/coordinadora insert"
ON public.voice_call_runs
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice call runs admin/coordinadora update"
ON public.voice_call_runs
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice contact flags admin/coordinadora select"
ON public.voice_contact_flags
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice contact flags admin/coordinadora insert"
ON public.voice_contact_flags
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));

CREATE POLICY "Voice contact flags admin/coordinadora update"
ON public.voice_contact_flags
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'coordinadora'::public.app_role));
