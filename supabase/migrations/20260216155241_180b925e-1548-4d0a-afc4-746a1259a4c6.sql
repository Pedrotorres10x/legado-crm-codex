
-- Add pipeline_stage column for funnel tracking
ALTER TABLE public.contacts ADD COLUMN pipeline_stage TEXT DEFAULT 'nuevo';

-- Set default stages based on contact_type for existing contacts
UPDATE public.contacts SET pipeline_stage = 'prospecto' WHERE contact_type = 'propietario' AND pipeline_stage = 'nuevo';
