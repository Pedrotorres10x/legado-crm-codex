CREATE OR REPLACE FUNCTION public.find_property_by_id_suffix(suffix text)
RETURNS TABLE(id uuid) AS $$
  SELECT p.id
  FROM public.properties p
  WHERE p.status IN ('disponible', 'reservado')
    AND replace(p.id::text, '-', '') LIKE '%' || suffix
  LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;