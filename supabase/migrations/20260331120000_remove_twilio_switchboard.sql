DROP INDEX IF EXISTS public.interactions_call_sid_unique;

ALTER TABLE public.interactions
  DROP COLUMN IF EXISTS call_sid,
  DROP COLUMN IF EXISTS recording_url,
  DROP COLUMN IF EXISTS transcript,
  DROP COLUMN IF EXISTS transcript_status,
  DROP COLUMN IF EXISTS ai_summary,
  DROP COLUMN IF EXISTS follow_up_task_id;

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS twilio_caller_id,
  DROP COLUMN IF EXISTS twilio_caller_id_verified;
