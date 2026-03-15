
-- Add OTP verification fields to contract_signers
ALTER TABLE public.contract_signers
  ADD COLUMN signer_email text,
  ADD COLUMN otp_code text,
  ADD COLUMN otp_expires_at timestamp with time zone,
  ADD COLUMN otp_verified boolean NOT NULL DEFAULT false;
