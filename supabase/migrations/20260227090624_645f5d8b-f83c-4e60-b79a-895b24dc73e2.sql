-- Drop any remaining default (may already be dropped)
ALTER TABLE public.contacts ALTER COLUMN pipeline_stage DROP DEFAULT;

-- Convert to enum
ALTER TABLE public.contacts 
  ALTER COLUMN pipeline_stage TYPE public.pipeline_stage 
  USING pipeline_stage::public.pipeline_stage;

-- Set new enum default
ALTER TABLE public.contacts 
  ALTER COLUMN pipeline_stage SET DEFAULT 'nuevo'::public.pipeline_stage;

-- Make NOT NULL since we've cleaned all nulls
ALTER TABLE public.contacts ALTER COLUMN pipeline_stage SET NOT NULL;