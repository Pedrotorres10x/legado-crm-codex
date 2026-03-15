
-- Price history table
CREATE TABLE public.price_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  old_price numeric,
  new_price numeric,
  old_owner_price numeric,
  new_owner_price numeric,
  changed_by uuid,
  changed_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;

-- Policies: same as properties visibility
CREATE POLICY "View price history" ON public.price_history
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = price_history.property_id
    AND (p.agent_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordinadora'::app_role))
  )
);

-- System insert (trigger runs as SECURITY DEFINER)
CREATE POLICY "System insert price history" ON public.price_history
FOR INSERT TO authenticated
WITH CHECK (true);

-- Index
CREATE INDEX idx_price_history_property ON public.price_history(property_id, changed_at DESC);

-- Trigger function to log price changes
CREATE OR REPLACE FUNCTION public.log_price_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.price IS DISTINCT FROM NEW.price) OR (OLD.owner_price IS DISTINCT FROM NEW.owner_price) THEN
    INSERT INTO public.price_history (property_id, old_price, new_price, old_owner_price, new_owner_price, changed_by)
    VALUES (NEW.id, OLD.price, NEW.price, OLD.owner_price, NEW.owner_price, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER trg_log_price_change
BEFORE UPDATE ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.log_price_change();
