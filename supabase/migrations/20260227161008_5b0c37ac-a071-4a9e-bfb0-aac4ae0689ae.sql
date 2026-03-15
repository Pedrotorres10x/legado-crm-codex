
-- Static GPS lookup for known cities (normalised lowercase, no accents)
CREATE OR REPLACE FUNCTION public.auto_geocode_property()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  norm_city text;
  coords record;
BEGIN
  -- Only act if GPS is missing and city is set
  IF (NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL) THEN
    RETURN NEW;
  END IF;

  IF NEW.city IS NULL OR trim(NEW.city) = '' THEN
    RETURN NEW;
  END IF;

  -- Normalise: lowercase, strip accents, clean
  norm_city := lower(trim(NEW.city));
  norm_city := translate(norm_city,
    'áàäâãåéèëêíìïîóòöôõúùüûñç',
    'aaaaaaeeeeiiiioooooouuuunc');
  norm_city := regexp_replace(norm_city, '[^a-z0-9 ]', ' ', 'g');
  norm_city := regexp_replace(norm_city, '\s+', ' ', 'g');
  norm_city := trim(norm_city);

  -- Lookup in static dictionary
  SELECT lat, lng INTO coords FROM (VALUES
    ('benidorm', 38.5411, -0.1316),
    ('finestrat', 38.5653, -0.2117),
    ('alfaz del pi', 38.5727, -0.1014),
    ('alfas del pi', 38.5727, -0.1014),
    ('el albir', 38.5727, -0.0700),
    ('la nucia', 38.6100, -0.1278),
    ('polop', 38.6261, -0.1283),
    ('altea', 38.5989, -0.0511),
    ('calpe', 38.6447, 0.0447),
    ('villajoyosa', 38.5078, -0.2336),
    ('la villajoyosa', 38.5078, -0.2336),
    ('la vila joiosa', 38.5078, -0.2336),
    ('orxeta', 38.5625, -0.2531),
    ('relleu', 38.5917, -0.2853),
    ('sella', 38.6117, -0.2700),
    ('callosa d en sarria', 38.6489, -0.1222),
    ('benissa', 38.7125, 0.0461),
    ('moraira', 38.6872, 0.1411),
    ('teulada', 38.7297, 0.0922),
    ('benitachell', 38.7378, 0.1592),
    ('cumbre del sol', 38.7350, 0.1700),
    ('javea', 38.7836, 0.1647),
    ('denia', 38.8408, 0.1106),
    ('el verger', 38.8597, 0.0264),
    ('lliber', 38.7428, -0.0031),
    ('alicante', 38.3453, -0.4831),
    ('el campello', 38.4286, -0.3936),
    ('mutxamel', 38.4142, -0.4453),
    ('sant joan d alacant', 38.4014, -0.4361),
    ('santa pola', 38.1919, -0.5569),
    ('gran alacant', 38.2250, -0.5200),
    ('arenales del sol', 38.2544, -0.5022),
    ('elche', 38.2669, -0.6983),
    ('elda', 38.4775, -0.7922),
    ('aspe', 38.3450, -0.7672),
    ('monforte del cid', 38.3803, -0.7289),
    ('pinoso', 38.4017, -1.0417),
    ('la romana', 38.3653, -0.8914),
    ('hondon de las nieves', 38.3133, -0.8764),
    ('torrevieja', 37.9786, -0.6819),
    ('orihuela', 38.0847, -0.9442),
    ('orihuela costa', 37.9356, -0.7442),
    ('guardamar del segura', 38.0897, -0.6542),
    ('pilar de la horadada', 37.8650, -0.7892),
    ('san miguel de salinas', 37.9817, -0.7883),
    ('los montesinos', 38.0139, -0.7292),
    ('rojales', 38.0886, -0.7194),
    ('ciudad quesada', 38.0700, -0.7300),
    ('benijofar', 38.0822, -0.7300),
    ('algorfa', 38.0569, -0.7867),
    ('daya nueva', 38.1056, -0.7678),
    ('dolores', 38.1397, -0.7753),
    ('san fulgencio', 38.1092, -0.6917),
    ('almoradi', 38.1272, -0.7914),
    ('cox', 38.1414, -0.8861),
    ('rafal', 38.1044, -0.8500),
    ('redovan', 38.1172, -0.9089),
    ('bigastro', 38.0769, -0.8939),
    ('cabo roig', 37.9219, -0.7200),
    ('punta prima', 37.9500, -0.6900),
    ('playa flamenca', 37.9300, -0.7000),
    ('dehesa de campoamor', 37.8800, -0.7600),
    ('la mata', 38.0050, -0.6700),
    ('la marina del pinet', 38.1300, -0.6500),
    ('la finca golf', 38.0600, -0.8200),
    ('la cala', 38.5100, -0.1800),
    ('nusa dua', 38.5500, -0.1500),
    ('coloma', 38.5300, -0.2000),
    ('puente de genave', 38.3319, -2.8167),
    ('penaguila', 38.6636, -0.3728),
    ('pueblo mascarat', 38.5814, -0.0567)
  ) AS d(city_name, lat, lng)
  WHERE d.city_name = norm_city
  LIMIT 1;

  IF FOUND THEN
    NEW.latitude := coords.lat;
    NEW.longitude := coords.lng;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_auto_geocode_property ON properties;
CREATE TRIGGER trg_auto_geocode_property
  BEFORE INSERT OR UPDATE ON properties
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_geocode_property();
