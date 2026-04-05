-- Add legal and operational fields to contacts
-- Required for: notary workflows, GDPR compliance, commission attribution, scheduling

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS id_number TEXT,                     -- DNI / NIE / CIF (mandatory for notary)
  ADD COLUMN IF NOT EXISTS marital_status TEXT                 -- single / married / divorced / widowed
    CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed', 'other')),
  ADD COLUMN IF NOT EXISTS co_owner_id UUID                    -- FK to another contact (co-ownership)
    REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ownership_percentage NUMERIC(5,2)  -- e.g. 50.00 for joint ownership
    CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  ADD COLUMN IF NOT EXISTS preferred_contact_time TEXT,        -- e.g. "9-12", "16-20"
  ADD COLUMN IF NOT EXISTS source_channel TEXT                 -- attribution for commission traceability
    CHECK (source_channel IN ('habihub', 'idealista', 'fotocasa', 'kyero', 'thinkspain',
                               'referral', 'web', 'portal_lead', 'statefox', 'manual', 'other'));

-- Index for co-owner lookups
CREATE INDEX IF NOT EXISTS idx_contacts_co_owner_id ON public.contacts(co_owner_id);

-- Index for source channel reporting
CREATE INDEX IF NOT EXISTS idx_contacts_source_channel ON public.contacts(source_channel);
