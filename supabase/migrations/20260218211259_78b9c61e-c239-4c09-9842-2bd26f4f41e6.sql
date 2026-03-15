
-- Add VoIP call fields to interactions table
ALTER TABLE public.interactions
  ADD COLUMN IF NOT EXISTS call_sid text,
  ADD COLUMN IF NOT EXISTS call_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS call_status text;

-- Index for deduplication by call_sid
CREATE UNIQUE INDEX IF NOT EXISTS interactions_call_sid_unique
  ON public.interactions (call_sid)
  WHERE call_sid IS NOT NULL;
