-- Add twilio-verify-caller to config (verify_jwt = false already handled by code auth)
-- This is just a note; the config.toml is auto-managed.
-- Ensure the new columns exist (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twilio_caller_id text NULL,
  ADD COLUMN IF NOT EXISTS twilio_caller_id_verified boolean NOT NULL DEFAULT false;
