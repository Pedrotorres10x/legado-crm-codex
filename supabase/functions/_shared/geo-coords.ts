/**
 * Static GPS coordinate dictionary for municipalities in the Alicante / Costa Blanca region.
 * Used by the matching engine to expand demand cities to a configurable radius.
 *
 * Coordinates sourced from INE / Google Maps centroids.
 * Names are stored in normalised lowercase without accents for matching.
 */

interface Coords {
  lat: number
  lng: number
}

// Normalise: lowercase, strip accents, trim
export function normalizeCityName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Dictionary keyed by normalised name → { lat, lng }
 * Includes common aliases (e.g. "alfaz del pi" and "alfas del pi").
 */
const COORDS: Record<string, Coords> = {
  // ── Costa Blanca Norte ────────────────────────────────────
  'benidorm':              { lat: 38.5411, lng: -0.1316 },
  'finestrat':             { lat: 38.5653, lng: -0.2117 },
  'alfaz del pi':          { lat: 38.5727, lng: -0.1014 },
  'alfas del pi':          { lat: 38.5727, lng: -0.1014 },
  'el albir':              { lat: 38.5727, lng: -0.0700 },
  'la nucia':              { lat: 38.6100, lng: -0.1278 },
  'la nucia':              { lat: 38.6100, lng: -0.1278 },
  'polop':                 { lat: 38.6261, lng: -0.1283 },
  'altea':                 { lat: 38.5989, lng: -0.0511 },
  'calpe':                 { lat: 38.6447, lng: 0.0447 },
  'calpe calp':            { lat: 38.6447, lng: 0.0447 },
  'villajoyosa':           { lat: 38.5078, lng: -0.2336 },
  'la villajoyosa':        { lat: 38.5078, lng: -0.2336 },
  'la vila joiosa':        { lat: 38.5078, lng: -0.2336 },
  'orxeta':                { lat: 38.5625, lng: -0.2531 },
  'relleu':                { lat: 38.5917, lng: -0.2853 },
  'sella':                 { lat: 38.6117, lng: -0.2700 },
  'la sella':              { lat: 38.6117, lng: -0.2700 },
  'callosa d en sarria':   { lat: 38.6489, lng: -0.1222 },
  'benissa':               { lat: 38.7125, lng: 0.0461 },
  'benisa':                { lat: 38.7125, lng: 0.0461 },
  'moraira':               { lat: 38.6872, lng: 0.1411 },
  'teulada':               { lat: 38.7297, lng: 0.0922 },
  'benitachell':           { lat: 38.7378, lng: 0.1592 },
  'el poble nou de benitatxell': { lat: 38.7378, lng: 0.1592 },
  'cumbre del sol':        { lat: 38.7350, lng: 0.1700 },
  'javea':                 { lat: 38.7836, lng: 0.1647 },
  'javea xabia':           { lat: 38.7836, lng: 0.1647 },
  'denia':                 { lat: 38.8408, lng: 0.1106 },
  'el verger':             { lat: 38.8597, lng: 0.0264 },
  'pueblo mascarat':       { lat: 38.5814, lng: -0.0567 },
  'lliber':                { lat: 38.7428, lng: -0.0031 },
  'penaguila':             { lat: 38.6636, lng: -0.3728 },

  // ── Alicante metro ────────────────────────────────────────
  'alicante':              { lat: 38.3453, lng: -0.4831 },
  'alicante alacant':      { lat: 38.3453, lng: -0.4831 },
  'el campello':           { lat: 38.4286, lng: -0.3936 },
  'campello el':           { lat: 38.4286, lng: -0.3936 },
  'mutxamel':              { lat: 38.4142, lng: -0.4453 },
  'sant joan d alacant':   { lat: 38.4014, lng: -0.4361 },
  'santa pola':            { lat: 38.1919, lng: -0.5569 },
  'gran alacant':          { lat: 38.2250, lng: -0.5200 },
  'arenales del sol':      { lat: 38.2544, lng: -0.5022 },
  'vistabella':            { lat: 38.3800, lng: -0.4600 },

  // ── Elche / Medio Vinalopó ────────────────────────────────
  'elche':                 { lat: 38.2669, lng: -0.6983 },
  'elda':                  { lat: 38.4775, lng: -0.7922 },
  'aspe':                  { lat: 38.3450, lng: -0.7672 },
  'monforte del cid':      { lat: 38.3803, lng: -0.7289 },
  'pinoso':                { lat: 38.4017, lng: -1.0417 },
  'el pinos':              { lat: 38.4017, lng: -1.0417 },
  'la romana':             { lat: 38.3653, lng: -0.8914 },
  'hondon de las nieves':  { lat: 38.3133, lng: -0.8764 },
  'la canalosa':           { lat: 38.3200, lng: -0.8500 },

  // ── Costa Blanca Sur / Vega Baja ──────────────────────────
  'torrevieja':            { lat: 37.9786, lng: -0.6819 },
  'orihuela':              { lat: 38.0847, lng: -0.9442 },
  'orihuela costa':        { lat: 37.9356, lng: -0.7442 },
  'guardamar del segura':  { lat: 38.0897, lng: -0.6542 },
  'pilar de la horadada':  { lat: 37.8650, lng: -0.7892 },
  'torre de la horadada':  { lat: 37.8650, lng: -0.7800 },
  'san miguel de salinas': { lat: 37.9817, lng: -0.7883 },
  'los montesinos':        { lat: 38.0139, lng: -0.7292 },
  'rojales':               { lat: 38.0886, lng: -0.7194 },
  'ciudad quesada':        { lat: 38.0700, lng: -0.7300 },
  'benijofar':             { lat: 38.0822, lng: -0.7300 },
  'algorfa':               { lat: 38.0569, lng: -0.7867 },
  'daya nueva':            { lat: 38.1056, lng: -0.7678 },
  'dolores':               { lat: 38.1397, lng: -0.7753 },
  'san fulgencio':         { lat: 38.1092, lng: -0.6917 },
  'almoradi':              { lat: 38.1272, lng: -0.7914 },
  'cox':                   { lat: 38.1414, lng: -0.8861 },
  'rafal':                 { lat: 38.1044, lng: -0.8500 },
  'redovan':               { lat: 38.1172, lng: -0.9089 },
  'bigastro':              { lat: 38.0769, lng: -0.8939 },
  'jacarilla':             { lat: 38.1700, lng: -0.8300 },
  'formentera del segura': { lat: 38.0908, lng: -0.7283 },
  'benferri':              { lat: 38.1525, lng: -0.9369 },
  'heredades':             { lat: 38.0900, lng: -0.7500 },
  'cabo roig':             { lat: 37.9219, lng: -0.7200 },
  'punta prima':           { lat: 37.9500, lng: -0.6900 },
  'playa flamenca':        { lat: 37.9300, lng: -0.7000 },
  'dehesa de campoamor':   { lat: 37.8800, lng: -0.7600 },
  'la mata':               { lat: 38.0050, lng: -0.6700 },
  'el mojon':              { lat: 37.8700, lng: -0.7600 },
  'pinar de campoverde':   { lat: 37.8900, lng: -0.7700 },
  'la marina del pinet':   { lat: 38.1300, lng: -0.6500 },
  'el chaparral':          { lat: 37.9400, lng: -0.7500 },
  'la herrada':            { lat: 37.8800, lng: -0.7800 },
  'las colinas golf':      { lat: 37.9200, lng: -0.7800 },
  'la finca golf':         { lat: 38.0600, lng: -0.8200 },
  'la cala':               { lat: 38.5100, lng: -0.1800 },
  'nusa dua':              { lat: 38.5500, lng: -0.1500 },
  'coloma':                { lat: 38.5300, lng: -0.2000 },
  'urbanizacion sea hills': { lat: 38.5600, lng: -0.0800 },

  // ── Jaén (outlier in data) ────────────────────────────────
  'puente de genave':      { lat: 38.3319, lng: -2.8167 },
}

/**
 * Look up coordinates for a city name (handles accents, casing, etc.)
 */
export function getCoords(city: string): Coords | null {
  const key = normalizeCityName(city)
  return COORDS[key] ?? null
}

/**
 * Haversine distance in km between two points.
 */
function haversineKm(a: Coords, b: Coords): number {
  const R = 6371
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const sinLat = Math.sin(dLat / 2)
  const sinLng = Math.sin(dLng / 2)
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Given a city name and a radius (km), return all dictionary cities
 * within that radius (including the city itself). Returns normalised names.
 * If the city is not in the dictionary, returns just the normalised input.
 */
export function expandCityRadius(city: string, radiusKm: number): string[] {
  const origin = getCoords(city)
  const norm = normalizeCityName(city)
  if (!origin) return [norm]

  const result = new Set<string>()
  result.add(norm)

  for (const [name, coords] of Object.entries(COORDS)) {
    if (haversineKm(origin, coords) <= radiusKm) {
      result.add(name)
    }
  }

  return [...result]
}
