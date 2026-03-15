// Spanish zip code prefix → province mapping
// First 2 digits of a Spanish zip code identify the province
const zipToProvince: Record<string, string> = {
  '01': 'Álava', '02': 'Albacete', '03': 'Alicante', '04': 'Almería',
  '05': 'Ávila', '06': 'Badajoz', '07': 'Baleares', '08': 'Barcelona',
  '09': 'Burgos', '10': 'Cáceres', '11': 'Cádiz', '12': 'Castellón',
  '13': 'Ciudad Real', '14': 'Córdoba', '15': 'A Coruña', '16': 'Cuenca',
  '17': 'Girona', '18': 'Granada', '19': 'Guadalajara', '20': 'Guipúzcoa',
  '21': 'Huelva', '22': 'Huesca', '23': 'Jaén', '24': 'León',
  '25': 'Lleida', '26': 'La Rioja', '27': 'Lugo', '28': 'Madrid',
  '29': 'Málaga', '30': 'Murcia', '31': 'Navarra', '32': 'Ourense',
  '33': 'Asturias', '34': 'Palencia', '35': 'Las Palmas', '36': 'Pontevedra',
  '37': 'Salamanca', '38': 'Santa Cruz de Tenerife', '39': 'Cantabria',
  '40': 'Segovia', '41': 'Sevilla', '42': 'Soria', '43': 'Tarragona',
  '44': 'Teruel', '45': 'Toledo', '46': 'Valencia', '47': 'Valladolid',
  '48': 'Vizcaya', '49': 'Zamora', '50': 'Zaragoza', '51': 'Ceuta', '52': 'Melilla',
};

export const SPANISH_PROVINCES = Object.values(zipToProvince).sort();

/**
 * Get province from a Spanish zip code (first 2 digits)
 */
export function getProvinceFromZip(zip: string): string | null {
  const prefix = zip.replace(/\s/g, '').substring(0, 2);
  return zipToProvince[prefix] || null;
}

/**
 * Get the zip prefix for a province name (case-insensitive, accent-insensitive)
 */
export function getZipPrefixFromProvince(province: string): string | null {
  const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const target = normalize(province);
  for (const [prefix, prov] of Object.entries(zipToProvince)) {
    if (normalize(prov) === target) return prefix;
  }
  return null;
}
