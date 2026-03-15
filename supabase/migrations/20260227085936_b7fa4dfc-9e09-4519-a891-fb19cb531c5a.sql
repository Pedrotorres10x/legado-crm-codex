-- Add Horus phases to captacion_status enum
ALTER TYPE public.captacion_status ADD VALUE IF NOT EXISTS 'prospecto' BEFORE 'contactado';
ALTER TYPE public.captacion_status ADD VALUE IF NOT EXISTS 'en_proceso' AFTER 'en_negociacion';
ALTER TYPE public.captacion_status ADD VALUE IF NOT EXISTS 'activo' AFTER 'en_proceso';
ALTER TYPE public.captacion_status ADD VALUE IF NOT EXISTS 'en_cierre' AFTER 'activo';