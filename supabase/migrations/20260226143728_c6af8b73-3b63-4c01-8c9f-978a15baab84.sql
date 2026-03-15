ALTER TABLE public.match_sender_logs RENAME COLUMN whatsapp_queued TO whatsapp_sent;
ALTER TABLE public.match_sender_logs ADD COLUMN IF NOT EXISTS whatsapp_failed integer NOT NULL DEFAULT 0;