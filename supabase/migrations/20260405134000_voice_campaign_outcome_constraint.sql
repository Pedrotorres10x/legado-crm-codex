-- Add structured outcome taxonomy to voice_campaign_contacts
-- Enables slicing reports by outcome (interested vs not_interested vs call_back_later, etc.)
-- Add handoff_due_at to track SLA for human follow-up after AI hands off

-- outcome_code constraint (voice_campaign_contacts may already have rows, so use NOT VALID
-- to avoid scanning existing data; validate separately if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'voice_campaign_contacts'
      AND constraint_name = 'voice_campaign_contacts_outcome_code_check'
  ) THEN
    ALTER TABLE public.voice_campaign_contacts
      ADD CONSTRAINT voice_campaign_contacts_outcome_code_check
      CHECK (outcome_code IS NULL OR outcome_code IN (
        'do_not_call',
        'hostile_do_not_call',
        'wrong_number',
        'intermediary_agency',
        'interested',
        'not_interested',
        'call_back_later',
        'no_answer',
        'voicemail',
        'technical_error'
      )) NOT VALID;
  END IF;
END;
$$;

-- handoff_due_at: 2-hour SLA after AI flags handoff_to_human
ALTER TABLE public.voice_campaign_contacts
  ADD COLUMN IF NOT EXISTS handoff_due_at TIMESTAMPTZ;

-- Index for finding overdue handoffs efficiently
CREATE INDEX IF NOT EXISTS idx_vcc_handoff_overdue
  ON public.voice_campaign_contacts(handoff_due_at)
  WHERE handoff_to_human = true AND handoff_due_at IS NOT NULL;

-- Index for outcome reporting
CREATE INDEX IF NOT EXISTS idx_vcc_outcome_code
  ON public.voice_campaign_contacts(outcome_code)
  WHERE outcome_code IS NOT NULL;
