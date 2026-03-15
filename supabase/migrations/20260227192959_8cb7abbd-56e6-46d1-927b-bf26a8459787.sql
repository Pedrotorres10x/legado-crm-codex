
-- Table to track daily WhatsApp send counts (global across all functions)
CREATE TABLE IF NOT EXISTS public.wa_daily_counter (
  day date NOT NULL DEFAULT CURRENT_DATE,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (day)
);

-- Function to atomically increment and check the daily WA counter
-- Returns the NEW count after increment. Caller checks if it exceeds limit.
CREATE OR REPLACE FUNCTION public.wa_increment_daily()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_count int;
BEGIN
  INSERT INTO wa_daily_counter (day, count)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (day) DO UPDATE SET count = wa_daily_counter.count + 1
  RETURNING count INTO new_count;
  RETURN new_count;
END;
$$;
