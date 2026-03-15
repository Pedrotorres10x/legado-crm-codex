
-- Add negotiation fields to offers table
ALTER TABLE public.offers
  ADD COLUMN IF NOT EXISTS counter_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS expiry_date timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS response_date timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'compra',
  ADD COLUMN IF NOT EXISTS conditions text DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.offers.status IS 'presentada, contraoferta, aceptada, rechazada, retirada, expirada';
COMMENT ON COLUMN public.offers.counter_amount IS 'Counter-offer amount proposed by the seller';
COMMENT ON COLUMN public.offers.expiry_date IS 'Deadline for the offer';
COMMENT ON COLUMN public.offers.offer_type IS 'compra or alquiler';
COMMENT ON COLUMN public.offers.conditions IS 'Special conditions or contingencies';
