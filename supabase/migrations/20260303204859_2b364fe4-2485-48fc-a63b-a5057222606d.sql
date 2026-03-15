
-- Drop triggers on captaciones
DROP TRIGGER IF EXISTS update_captaciones_updated_at ON public.captaciones;

-- Drop RLS policies
DROP POLICY IF EXISTS "Agent insert captaciones" ON public.captaciones;
DROP POLICY IF EXISTS "Agent update own captaciones" ON public.captaciones;
DROP POLICY IF EXISTS "Agent view own captaciones" ON public.captaciones;

-- Drop the table
DROP TABLE IF EXISTS public.captaciones;

-- Drop the enum type
DROP TYPE IF EXISTS public.captacion_status;
