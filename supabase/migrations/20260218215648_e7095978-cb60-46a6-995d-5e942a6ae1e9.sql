-- Add Twilio Verified Caller ID columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twilio_caller_id text NULL,
  ADD COLUMN IF NOT EXISTS twilio_caller_id_verified boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.twilio_caller_id IS 'Número verificado en Twilio para usar como caller ID en llamadas VoIP';
COMMENT ON COLUMN public.profiles.twilio_caller_id_verified IS 'true cuando Twilio ha confirmado el número';
