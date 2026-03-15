
-- Add closing workflow fields to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS reservation_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reservation_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deed_date date DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deed_notary text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS closing_notes text DEFAULT NULL;

COMMENT ON COLUMN public.properties.reservation_date IS 'Date the reservation deposit was made';
COMMENT ON COLUMN public.properties.reservation_amount IS 'Reservation deposit amount in euros';
COMMENT ON COLUMN public.properties.deed_date IS 'Scheduled date for deed signing (escritura)';
COMMENT ON COLUMN public.properties.deed_notary IS 'Notary name/office for the deed signing';
COMMENT ON COLUMN public.properties.closing_notes IS 'Internal notes about the closing process';
