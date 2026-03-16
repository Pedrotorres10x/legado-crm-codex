-- =============================================
-- HARDEN RLS: settings
-- =============================================
DROP POLICY IF EXISTS "Anyone authenticated can view settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.settings;

CREATE POLICY "Safe settings for authenticated" ON public.settings
FOR SELECT TO authenticated
USING (
  key IN (
    'agent_monthly_cost',
    'point_weights',
    'popular_features',
    'kpi_targets',
    'match_sender_enabled'
  )
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
);

CREATE POLICY "Admin coord update settings" ON public.settings
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
);

CREATE POLICY "Admin coord insert settings" ON public.settings
FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
);

-- =============================================
-- HARDEN RLS: property_documents
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view property documents" ON public.property_documents;
DROP POLICY IF EXISTS "Authenticated users can insert property documents" ON public.property_documents;
DROP POLICY IF EXISTS "Authenticated users can update property documents" ON public.property_documents;
DROP POLICY IF EXISTS "Authenticated users can delete property documents" ON public.property_documents;

CREATE POLICY "Agent admin coord view property documents" ON public.property_documents
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
);

CREATE POLICY "Agent admin coord insert property documents" ON public.property_documents
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
);

CREATE POLICY "Agent admin coord update property documents" ON public.property_documents
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
);

CREATE POLICY "Agent admin coord delete property documents" ON public.property_documents
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = property_documents.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
);

-- =============================================
-- HARDEN RLS: documents registry
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can insert documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can update documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can delete documents" ON public.documents;
DROP POLICY IF EXISTS "Authenticated users can view document contacts" ON public.document_contacts;
DROP POLICY IF EXISTS "Authenticated users can insert document contacts" ON public.document_contacts;
DROP POLICY IF EXISTS "Authenticated users can delete document contacts" ON public.document_contacts;
DROP POLICY IF EXISTS "Authenticated users can view document properties" ON public.document_properties;
DROP POLICY IF EXISTS "Authenticated users can insert document properties" ON public.document_properties;
DROP POLICY IF EXISTS "Authenticated users can delete document properties" ON public.document_properties;

CREATE POLICY "Agent admin coord view documents" ON public.documents
FOR SELECT TO authenticated
USING (
  uploaded_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.document_contacts dc
    JOIN public.contacts c ON c.id = dc.contact_id
    WHERE dc.document_id = documents.id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.document_properties dp
    JOIN public.properties p ON p.id = dp.property_id
    WHERE dp.document_id = documents.id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.generated_contracts gc
    WHERE gc.id = documents.contract_id
      AND gc.agent_id = auth.uid()
  )
);

CREATE POLICY "Agent admin coord insert documents" ON public.documents
FOR INSERT TO authenticated
WITH CHECK (
  (
    uploaded_by = auth.uid()
    OR uploaded_by IS NULL
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  )
  AND (
    contract_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.generated_contracts gc
      WHERE gc.id = documents.contract_id
        AND (
          gc.agent_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'coordinadora'::app_role)
        )
    )
  )
);

CREATE POLICY "Agent admin coord update documents" ON public.documents
FOR UPDATE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.document_contacts dc
    JOIN public.contacts c ON c.id = dc.contact_id
    WHERE dc.document_id = documents.id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.document_properties dp
    JOIN public.properties p ON p.id = dp.property_id
    WHERE dp.document_id = documents.id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.generated_contracts gc
    WHERE gc.id = documents.contract_id
      AND gc.agent_id = auth.uid()
  )
)
WITH CHECK (
  (
    uploaded_by = auth.uid()
    OR uploaded_by IS NULL
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordinadora'::app_role)
  )
  AND (
    contract_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.generated_contracts gc
      WHERE gc.id = documents.contract_id
        AND (
          gc.agent_id = auth.uid()
          OR has_role(auth.uid(), 'admin'::app_role)
          OR has_role(auth.uid(), 'coordinadora'::app_role)
        )
    )
  )
);

CREATE POLICY "Agent admin coord delete documents" ON public.documents
FOR DELETE TO authenticated
USING (
  uploaded_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.document_contacts dc
    JOIN public.contacts c ON c.id = dc.contact_id
    WHERE dc.document_id = documents.id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.document_properties dp
    JOIN public.properties p ON p.id = dp.property_id
    WHERE dp.document_id = documents.id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.generated_contracts gc
    WHERE gc.id = documents.contract_id
      AND gc.agent_id = auth.uid()
  )
);

CREATE POLICY "Agent admin coord view document contacts" ON public.document_contacts
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = document_contacts.contact_id
      AND (
        c.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_contacts.document_id
      AND d.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Agent admin coord insert document contacts" ON public.document_contacts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = document_contacts.contact_id
      AND (
        c.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_contacts.document_id
      AND d.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Agent admin coord delete document contacts" ON public.document_contacts
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = document_contacts.contact_id
      AND (
        c.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_contacts.document_id
      AND d.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Agent admin coord view document properties" ON public.document_properties
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = document_properties.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_properties.document_id
      AND d.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Agent admin coord insert document properties" ON public.document_properties
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = document_properties.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_properties.document_id
      AND d.uploaded_by = auth.uid()
  )
);

CREATE POLICY "Agent admin coord delete document properties" ON public.document_properties
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = document_properties.property_id
      AND (
        p.agent_id = auth.uid()
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'coordinadora'::app_role)
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.documents d
    WHERE d.id = document_properties.document_id
      AND d.uploaded_by = auth.uid()
  )
);

-- =============================================
-- HARDEN RLS: contact_invoices
-- =============================================
DROP POLICY IF EXISTS "Authenticated users can view invoices" ON public.contact_invoices;
DROP POLICY IF EXISTS "Authenticated users can create invoices" ON public.contact_invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.contact_invoices;

CREATE POLICY "Agent admin coord view invoices" ON public.contact_invoices
FOR SELECT TO authenticated
USING (
  agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = contact_invoices.contact_id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = contact_invoices.property_id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.commissions cm
    WHERE cm.id = contact_invoices.commission_id
      AND (
        cm.agent_id = auth.uid()
        OR cm.listing_agent_id = auth.uid()
        OR cm.buying_agent_id = auth.uid()
        OR cm.listing_field_agent_id = auth.uid()
        OR cm.buying_field_agent_id = auth.uid()
        OR cm.listing_origin_agent_id = auth.uid()
        OR cm.buying_origin_agent_id = auth.uid()
      )
  )
);

CREATE POLICY "Agent admin coord insert invoices" ON public.contact_invoices
FOR INSERT TO authenticated
WITH CHECK (
  agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = contact_invoices.contact_id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = contact_invoices.property_id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.commissions cm
    WHERE cm.id = contact_invoices.commission_id
      AND (
        cm.agent_id = auth.uid()
        OR cm.listing_agent_id = auth.uid()
        OR cm.buying_agent_id = auth.uid()
        OR cm.listing_field_agent_id = auth.uid()
        OR cm.buying_field_agent_id = auth.uid()
        OR cm.listing_origin_agent_id = auth.uid()
        OR cm.buying_origin_agent_id = auth.uid()
      )
  )
);

CREATE POLICY "Agent admin coord update invoices" ON public.contact_invoices
FOR UPDATE TO authenticated
USING (
  agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = contact_invoices.contact_id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = contact_invoices.property_id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.commissions cm
    WHERE cm.id = contact_invoices.commission_id
      AND (
        cm.agent_id = auth.uid()
        OR cm.listing_agent_id = auth.uid()
        OR cm.buying_agent_id = auth.uid()
        OR cm.listing_field_agent_id = auth.uid()
        OR cm.buying_field_agent_id = auth.uid()
        OR cm.listing_origin_agent_id = auth.uid()
        OR cm.buying_origin_agent_id = auth.uid()
      )
  )
)
WITH CHECK (
  agent_id = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = contact_invoices.contact_id
      AND c.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.properties p
    WHERE p.id = contact_invoices.property_id
      AND p.agent_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.commissions cm
    WHERE cm.id = contact_invoices.commission_id
      AND (
        cm.agent_id = auth.uid()
        OR cm.listing_agent_id = auth.uid()
        OR cm.buying_agent_id = auth.uid()
        OR cm.listing_field_agent_id = auth.uid()
        OR cm.buying_field_agent_id = auth.uid()
        OR cm.listing_origin_agent_id = auth.uid()
        OR cm.buying_origin_agent_id = auth.uid()
      )
  )
);
