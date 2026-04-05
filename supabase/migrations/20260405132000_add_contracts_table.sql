-- Contracts table: tracks signature workflow from offer to escritura
-- Closing workflow must NOT advance past "reserva" without signed_by_buyer_at + signed_by_seller_at

CREATE TABLE IF NOT EXISTS public.contracts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id                UUID NOT NULL UNIQUE REFERENCES public.offers(id) ON DELETE CASCADE,
  contract_type           TEXT NOT NULL
    CHECK (contract_type IN ('reserva', 'arras', 'compraventa', 'arrendamiento')),
  template_version        TEXT,                          -- e.g. "2024-v2" for audit trail

  -- Generation & delivery
  generated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_to_buyer_at        TIMESTAMPTZ,
  sent_to_seller_at       TIMESTAMPTZ,

  -- Signatures (all three required before notary step)
  signed_by_buyer_at      TIMESTAMPTZ,
  signed_by_seller_at     TIMESTAMPTZ,
  signed_by_agent_at      TIMESTAMPTZ,

  -- Notary coordination
  notary_id               UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notary_review_at        TIMESTAMPTZ,
  notary_approval_at      TIMESTAMPTZ,
  escritura_notary_ref    TEXT,                          -- reference number from notary

  -- Keys & possession
  keys_exchanged_at       TIMESTAMPTZ,
  keys_received_by        TEXT,                          -- name of person who took possession
  possession_confirmed_at TIMESTAMPTZ,
  possession_confirmed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Audit
  notes                   TEXT,
  created_by              UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Automatically update updated_at
CREATE OR REPLACE FUNCTION public.update_contracts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER contracts_updated_at
  BEFORE UPDATE ON public.contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_contracts_updated_at();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_offer_id ON public.contracts(offer_id);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by ON public.contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_notary_id ON public.contracts(notary_id)
  WHERE notary_id IS NOT NULL;

-- RLS
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_see_own_contracts" ON public.contracts
  FOR SELECT USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coordinadora')
    )
  );

CREATE POLICY "agents_insert_contracts" ON public.contracts
  FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "agents_update_own_contracts" ON public.contracts
  FOR UPDATE USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('admin', 'coordinadora')
    )
  );
