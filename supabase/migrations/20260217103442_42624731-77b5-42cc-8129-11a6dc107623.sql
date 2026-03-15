-- Table to log daily-match-sender runs
CREATE TABLE public.match_sender_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_at timestamp with time zone NOT NULL DEFAULT now(),
  demands_total integer NOT NULL DEFAULT 0,
  contacts_processed integer NOT NULL DEFAULT 0,
  contacts_skipped integer NOT NULL DEFAULT 0,
  emails_sent integer NOT NULL DEFAULT 0,
  emails_failed integer NOT NULL DEFAULT 0,
  whatsapp_queued integer NOT NULL DEFAULT 0,
  matches_created integer NOT NULL DEFAULT 0,
  matches_skipped_already_sent integer NOT NULL DEFAULT 0,
  errors text[] DEFAULT '{}'::text[],
  duration_ms integer DEFAULT 0
);

ALTER TABLE public.match_sender_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view match_sender_logs" ON public.match_sender_logs
  FOR SELECT USING (true);

CREATE POLICY "Service insert match_sender_logs" ON public.match_sender_logs
  FOR INSERT WITH CHECK (true);