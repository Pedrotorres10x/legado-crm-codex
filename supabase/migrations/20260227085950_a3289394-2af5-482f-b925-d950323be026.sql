-- Migrate existing data to Horus phases
UPDATE public.captaciones SET status = 'prospecto' WHERE status = 'contactado';
UPDATE public.captaciones SET status = 'en_proceso' WHERE status = 'en_negociacion';

-- Update default to first Horus phase
ALTER TABLE public.captaciones ALTER COLUMN status SET DEFAULT 'prospecto'::captacion_status;