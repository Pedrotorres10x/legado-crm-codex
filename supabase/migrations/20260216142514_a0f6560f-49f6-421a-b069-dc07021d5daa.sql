
-- ========== ENUMS ==========
CREATE TYPE public.app_role AS ENUM ('admin', 'agent');
CREATE TYPE public.property_type AS ENUM ('piso', 'casa', 'chalet', 'adosado', 'atico', 'duplex', 'estudio', 'local', 'oficina', 'nave', 'terreno', 'garaje', 'trastero', 'otro');
CREATE TYPE public.property_status AS ENUM ('disponible', 'reservado', 'vendido', 'alquilado', 'retirado');
CREATE TYPE public.contact_type AS ENUM ('propietario', 'comprador', 'ambos');
CREATE TYPE public.contact_status AS ENUM ('nuevo', 'en_seguimiento', 'activo', 'cerrado');
CREATE TYPE public.match_status AS ENUM ('pendiente', 'enviado', 'interesado', 'descartado');
CREATE TYPE public.interaction_type AS ENUM ('llamada', 'email', 'visita', 'whatsapp', 'reunion', 'nota');
CREATE TYPE public.captacion_status AS ENUM ('contactado', 'en_negociacion', 'captado', 'descartado');
CREATE TYPE public.operation_type AS ENUM ('venta', 'alquiler', 'ambas');

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== USER ROLES (table first, then function, then policies) ==========
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Now create the function (table exists)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Now policies that use has_role
CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== CONTACTOS ==========
CREATE TABLE public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type public.contact_type NOT NULL DEFAULT 'comprador',
  full_name TEXT NOT NULL,
  email TEXT, phone TEXT, phone2 TEXT, address TEXT, city TEXT, notes TEXT,
  status public.contact_status NOT NULL DEFAULT 'nuevo',
  tags TEXT[] DEFAULT '{}',
  agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert contacts" ON public.contacts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update contacts" ON public.contacts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete contacts" ON public.contacts FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== PROPIEDADES ==========
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT UNIQUE,
  property_type public.property_type NOT NULL DEFAULT 'piso',
  operation public.operation_type NOT NULL DEFAULT 'venta',
  title TEXT NOT NULL, description TEXT,
  price NUMERIC(12,2), surface_area NUMERIC(10,2), built_area NUMERIC(10,2),
  bedrooms INTEGER DEFAULT 0, bathrooms INTEGER DEFAULT 0,
  floor TEXT, has_elevator BOOLEAN DEFAULT false, has_garage BOOLEAN DEFAULT false,
  has_pool BOOLEAN DEFAULT false, has_terrace BOOLEAN DEFAULT false, has_garden BOOLEAN DEFAULT false,
  energy_cert TEXT, address TEXT, city TEXT, province TEXT, zip_code TEXT,
  latitude NUMERIC(10,7), longitude NUMERIC(10,7),
  status public.property_status NOT NULL DEFAULT 'disponible',
  features TEXT[] DEFAULT '{}', images TEXT[] DEFAULT '{}',
  owner_id UUID REFERENCES public.contacts(id),
  agent_id UUID REFERENCES auth.users(id),
  xml_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view properties" ON public.properties FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update properties" ON public.properties FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete properties" ON public.properties FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== DEMANDAS ==========
CREATE TABLE public.demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  property_type public.property_type, operation public.operation_type DEFAULT 'venta',
  min_price NUMERIC(12,2), max_price NUMERIC(12,2), min_surface NUMERIC(10,2),
  min_bedrooms INTEGER, min_bathrooms INTEGER,
  zones TEXT[] DEFAULT '{}', cities TEXT[] DEFAULT '{}', features TEXT[] DEFAULT '{}',
  notes TEXT, is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.demands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view demands" ON public.demands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert demands" ON public.demands FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update demands" ON public.demands FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete demands" ON public.demands FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== MATCHES ==========
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demand_id UUID REFERENCES public.demands(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  compatibility INTEGER DEFAULT 0, status public.match_status NOT NULL DEFAULT 'pendiente',
  agent_id UUID REFERENCES auth.users(id), notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(demand_id, property_id)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view matches" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update matches" ON public.matches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin delete matches" ON public.matches FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ========== INTERACCIONES ==========
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  interaction_type public.interaction_type NOT NULL DEFAULT 'nota',
  subject TEXT, description TEXT,
  interaction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view interactions" ON public.interactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert interactions" ON public.interactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update interactions" ON public.interactions FOR UPDATE TO authenticated USING (true);

-- ========== CAPTACIONES ==========
CREATE TABLE public.captaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  status public.captacion_status NOT NULL DEFAULT 'contactado',
  address TEXT, estimated_price NUMERIC(12,2), notes TEXT,
  agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.captaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view captaciones" ON public.captaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert captaciones" ON public.captaciones FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update captaciones" ON public.captaciones FOR UPDATE TO authenticated USING (true);

-- ========== VISITAS ==========
CREATE TABLE public.visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  visit_date TIMESTAMPTZ NOT NULL, notes TEXT, result TEXT,
  agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view visits" ON public.visits FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert visits" ON public.visits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update visits" ON public.visits FOR UPDATE TO authenticated USING (true);

-- ========== OFERTAS ==========
CREATE TABLE public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(12,2) NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente',
  notes TEXT, agent_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view offers" ON public.offers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert offers" ON public.offers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update offers" ON public.offers FOR UPDATE TO authenticated USING (true);

-- ========== TRIGGERS ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER tr_profiles BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_contacts BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_properties BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_demands BEFORE UPDATE ON public.demands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_matches BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_captaciones BEFORE UPDATE ON public.captaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER tr_offers BEFORE UPDATE ON public.offers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== AUTO-CREATE PROFILE ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== INDEXES ==========
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_type ON public.properties(property_type);
CREATE INDEX idx_properties_city ON public.properties(city);
CREATE INDEX idx_contacts_type ON public.contacts(contact_type);
CREATE INDEX idx_demands_contact ON public.demands(contact_id);
CREATE INDEX idx_matches_demand ON public.matches(demand_id);
CREATE INDEX idx_matches_property ON public.matches(property_id);
CREATE INDEX idx_interactions_contact ON public.interactions(contact_id);
CREATE INDEX idx_captaciones_status ON public.captaciones(status);
CREATE INDEX idx_visits_date ON public.visits(visit_date);
