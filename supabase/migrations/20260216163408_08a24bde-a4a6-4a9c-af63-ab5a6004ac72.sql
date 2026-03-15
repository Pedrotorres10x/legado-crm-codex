
CREATE TABLE public.commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid REFERENCES properties(id),
  agent_id uuid NOT NULL,
  sale_price numeric NOT NULL,
  agency_commission_pct numeric NOT NULL DEFAULT 6,
  agency_commission numeric NOT NULL DEFAULT 0,
  agent_base_pct numeric NOT NULL DEFAULT 7.5,
  agent_base_amount numeric NOT NULL DEFAULT 0,
  horus_bonus boolean NOT NULL DEFAULT false,
  horus_bonus_pct numeric NOT NULL DEFAULT 5,
  horus_bonus_amount numeric NOT NULL DEFAULT 0,
  agent_total numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'borrador',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.commissions ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver comisiones
CREATE POLICY "Auth view commissions" ON public.commissions
  FOR SELECT TO authenticated USING (true);

-- Solo admins pueden insertar/actualizar/eliminar
CREATE POLICY "Admin insert commissions" ON public.commissions
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin update commissions" ON public.commissions
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete commissions" ON public.commissions
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_commissions_updated_at
  BEFORE UPDATE ON public.commissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
