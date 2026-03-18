DROP POLICY IF EXISTS "Agent admin coord view document contacts" ON public.document_contacts;
DROP POLICY IF EXISTS "Agent admin coord insert document contacts" ON public.document_contacts;
DROP POLICY IF EXISTS "Agent admin coord delete document contacts" ON public.document_contacts;

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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
);

DROP POLICY IF EXISTS "Agent admin coord view document properties" ON public.document_properties;
DROP POLICY IF EXISTS "Agent admin coord insert document properties" ON public.document_properties;
DROP POLICY IF EXISTS "Agent admin coord delete document properties" ON public.document_properties;

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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
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
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'coordinadora'::app_role)
);
