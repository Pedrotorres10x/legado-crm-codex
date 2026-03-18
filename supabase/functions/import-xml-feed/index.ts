import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const typeMap: Record<string, string> = {
  // Pisos / apartamentos
  flat: 'piso', apartment: 'piso', apartments: 'piso', apartamento: 'piso', piso: 'piso',
  'ground-floor': 'piso', groundfloor: 'piso', 'ground floor': 'piso', 'ground-floor apartment': 'piso',
  'first-floor': 'piso', 'top-floor': 'piso', 'top floor': 'piso',
  penthouse: 'atico', atico: 'atico', 'ático': 'atico', attique: 'atico',
  duplex: 'duplex', 'dúplex': 'duplex', dúplex: 'duplex', maisonette: 'duplex',
  // Casas
  house: 'casa', casa: 'casa', bungalow: 'casa', finca: 'casa', cortijo: 'casa',
  country_house: 'casa', country: 'casa', cottage: 'casa', farmhouse: 'casa',
  manor: 'casa', rustic: 'casa', rural: 'casa', residential: 'casa',
  // Chalets / villas
  villa: 'chalet', chalet: 'chalet', detached: 'chalet', detachedvilla: 'chalet',
  'detached villa': 'chalet', 'detached house': 'chalet', independentvilla: 'chalet',
  unifamiliar: 'chalet', independiente: 'chalet', luxuryvilla: 'chalet',
  // Adosados
  townhouse: 'adosado', semidetached: 'adosado', semi_detached: 'adosado',
  'semi-detached': 'adosado', terraced: 'adosado', adosado: 'adosado', pareado: 'adosado',
  linked: 'adosado', townhome: 'adosado',
  // Estudios
  studio: 'estudio', loft: 'estudio', estudio: 'estudio',
  // Comercial
  commercial: 'local', shop: 'local', retail: 'local', premises: 'local', local: 'local',
  // Oficina
  office: 'oficina', oficina: 'oficina',
  // Nave
  warehouse: 'nave', industrial: 'nave', nave: 'nave',
  // Terreno
  land: 'terreno', plot: 'terreno', terreno: 'terreno', solar: 'terreno', plots: 'terreno',
  // Garaje / parking
  garage: 'garaje', parking: 'garaje', garaje: 'garaje',
  // Trastero
  storage: 'trastero', trastero: 'trastero',
}

function resolvePropertyType(rawType: string): string {
  const lower = rawType.toLowerCase().trim()
  if (!lower) return 'piso' // Default to 'piso' instead of 'otro'
  if (typeMap[lower]) return typeMap[lower]
  for (const word of lower.split(/[\s\-_\/,]+/)) {
    if (typeMap[word]) return typeMap[word]
  }
  if (lower.includes('apart') || lower.includes('flat') || lower.includes('piso')) return 'piso'
  if (lower.includes('penthouse') || lower.includes('atico') || lower.includes('ático')) return 'atico'
  if (lower.includes('duplex') || lower.includes('dúplex')) return 'duplex'
  if (lower.includes('villa') || lower.includes('chalet') || lower.includes('detach') || lower.includes('independ')) return 'chalet'
  if (lower.includes('town') || lower.includes('adosad') || lower.includes('semi') || lower.includes('paread') || lower.includes('terraced')) return 'adosado'
  if (lower.includes('house') || lower.includes('casa') || lower.includes('bungalow') || lower.includes('finca') || lower.includes('country') || lower.includes('cottage')) return 'casa'
  if (lower.includes('studio') || lower.includes('estudio') || lower.includes('loft')) return 'estudio'
  if (lower.includes('commer') || lower.includes('local') || lower.includes('shop') || lower.includes('retail') || lower.includes('premises')) return 'local'
  if (lower.includes('office') || lower.includes('oficina')) return 'oficina'
  if (lower.includes('warehouse') || lower.includes('nave') || lower.includes('industr')) return 'nave'
  if (lower.includes('land') || lower.includes('plot') || lower.includes('terreno') || lower.includes('solar')) return 'terreno'
  if (lower.includes('garag') || lower.includes('parking')) return 'garaje'
  if (lower.includes('storage') || lower.includes('trastero')) return 'trastero'
  return 'piso' // Default to 'piso' for residential unknowns
}

/** Try to infer property type from title/description when type mapping fails */
function inferTypeFromText(title: string, description: string): string {
  const text = (title + ' ' + description).toLowerCase()
  if (/\bapartamento|apartamentos|piso\b/.test(text)) return 'piso'
  if (/\bático|atico|penthouse|atic\b/.test(text)) return 'atico'
  if (/\bdúplex|duplex\b/.test(text)) return 'duplex'
  if (/\bchalet|villa|independiente|unifamiliar\b/.test(text)) return 'chalet'
  if (/\badosado|pareado|townhouse|semi.?detach\b/.test(text)) return 'adosado'
  if (/\bcasa|bungalow|finca|cortijo\b/.test(text)) return 'casa'
  if (/\bestudio|loft|studio\b/.test(text)) return 'estudio'
  if (/\blocal|comercial|tienda\b/.test(text)) return 'local'
  if (/\boficina|despacho\b/.test(text)) return 'oficina'
  if (/\bnave|almacén|industrial\b/.test(text)) return 'nave'
  if (/\bterreno|parcela|solar\b/.test(text)) return 'terreno'
  if (/\bgaraje|parking|plaza de garaje\b/.test(text)) return 'garaje'
  if (/\btrastero\b/.test(text)) return 'trastero'
  // If has bedrooms info → residential
  if (/\bdormitorio|habitacion|bedroom|bed\b/.test(text)) return 'piso'
  return 'piso' // Safe default for residential
}

const typeLabels: Record<string, string> = {
  piso: 'Piso', casa: 'Casa', chalet: 'Chalet', adosado: 'Adosado',
  atico: 'Ático', duplex: 'Dúplex', estudio: 'Estudio', local: 'Local',
  oficina: 'Oficina', nave: 'Nave', terreno: 'Terreno', garaje: 'Garaje',
  trastero: 'Trastero', otro: 'Propiedad',
}

// ── Optimized: extract all tags from a block in a single pass ──
function extractAllTags(block: string): Map<string, string[]> {
  const tags = new Map<string, string[]>()
  const regex = /<([a-zA-Z_][a-zA-Z0-9_]*)\b[^>]*>([\s\S]*?)<\/\1>/g
  let m
  while ((m = regex.exec(block)) !== null) {
    const name = m[1].toLowerCase()
    const val = m[2].trim()
    if (!tags.has(name)) tags.set(name, [])
    tags.get(name)!.push(val)
  }
  return tags
}

function serializeTags(tags: Map<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(Array.from(tags.entries()))
}

function stripCdata(val: string): string {
  return val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').trim()
}

function cleanText(val: string): string {
  return val
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/Ã¡/g, 'á').replace(/Ã©/g, 'é').replace(/Ã­/g, 'í').replace(/Ã³/g, 'ó').replace(/Ãº/g, 'ú')
    .replace(/Ã±/g, 'ñ').replace(/Ã¼/g, 'ü')
    .replace(/Ã\u0081/g, 'Á').replace(/Ã\u0089/g, 'É').replace(/Ã\u008D/g, 'Í').replace(/Ã\u0093/g, 'Ó').replace(/Ã\u009A/g, 'Ú').replace(/Ã\u0091/g, 'Ñ')
    .replace(/â€œ/g, '"').replace(/â€\u009D/g, '"').replace(/â€™/g, "'").replace(/â€˜/g, "'")
    .replace(/â€"/g, '–').replace(/â€"/g, '—').replace(/â€¦/g, '…')
    .replace(/Â /g, ' ').replace(/Â·/g, '·').replace(/Âº/g, 'º').replace(/Âª/g, 'ª')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

/** Normalize Spanish addresses from raw XML/catastro format to readable form */
function normalizeAddress(raw: string): string {
  if (!raw) return raw
  let addr = raw.trim()

  // Abbreviation map: uppercase abbreviations → proper expanded form
  const abbrMap: Record<string, string> = {
    'AV': 'Avenida', 'AVD': 'Avenida', 'AVDA': 'Avenida', 'AVNDA': 'Avenida',
    'CL': 'Calle', 'C/': 'Calle', 'C.': 'Calle',
    'PZ': 'Plaza', 'PZA': 'Plaza', 'PLZA': 'Plaza', 'PL': 'Plaza',
    'CR': 'Carretera', 'CTRA': 'Carretera', 'CTR': 'Carretera',
    'PS': 'Paseo', 'PSO': 'Paseo', 'PO': 'Paseo',
    'CM': 'Camino', 'CMO': 'Camino', 'CMN': 'Camino',
    'UR': 'Urbanización', 'URB': 'Urbanización',
    'TR': 'Travesía', 'TRAV': 'Travesía', 'TVSA': 'Travesía',
    'RD': 'Ronda', 'RNDA': 'Ronda',
    'PJ': 'Pasaje', 'PSJE': 'Pasaje',
    'GL': 'Glorieta', 'GLTA': 'Glorieta',
    'ED': 'Edificio', 'EDIF': 'Edificio',
    'BJ': 'Bajo', 'ENT': 'Entresuelo', 'ENTLO': 'Entresuelo',
    'ESC': 'Escalera',
  }

  // Detect if address is ALL-CAPS catastro style (e.g. "AV MUNICIPI DEL 3")
  const isCadastral = addr === addr.toUpperCase() && /^[A-ZÁÉÍÓÚÑÜ\s,.\d\/]+$/.test(addr)

  if (isCadastral) {
    // Split into tokens
    const tokens = addr.split(/\s+/)
    if (tokens.length >= 2) {
      const firstUpper = tokens[0].toUpperCase().replace(/\.$/,'')
      if (abbrMap[firstUpper]) {
        tokens[0] = abbrMap[firstUpper]
      }
    }

    // Fix common word-order issues: "MUNICIPI DEL" → "del Municipi"  
    // Pattern: noun + preposition at the end → preposition + noun  
    // e.g. "Avenida MUNICIPI DEL 3" → "Avenida del Municipi, 3"  
    const preps = ['DE', 'DEL', 'DE LA', 'DE LES', 'DE LOS', 'DE LAS', 'DELS', 'D\'']
    // Rejoin remaining tokens and apply Title Case
    const rest = tokens.slice(1).join(' ')
    // Check if rest matches pattern: WORD(S) PREPOSITION NUMBER
    const wordPrepNumMatch = rest.match(/^(.+?)\s+(DEL?|DE LA|DE LES|DE LOS|DE LAS|DELS)\s+(\d.*)$/i)
    if (wordPrepNumMatch) {
      const [, nameWords, prep, num] = wordPrepNumMatch
      addr = `${tokens[0]} ${prep.toLowerCase()} ${toTitleCase(nameWords)}, ${num}`
    } else {
      // Just apply title case to rest and add comma before the number
      const numberMatch = rest.match(/^(.+?)\s+(\d+.*)$/)
      if (numberMatch) {
        addr = `${tokens[0]} ${toTitleCase(numberMatch[1])}, ${numberMatch[2]}`
      } else {
        addr = `${tokens[0]} ${toTitleCase(rest)}`
      }
    }
  } else {
    // Not cadastral, but still expand abbreviations at the start
    const match = addr.match(/^([A-Za-zÁÉÍÓÚÑÜ.\/]+)\s+/)
    if (match) {
      const key = match[1].toUpperCase().replace(/\.$/,'')
      if (abbrMap[key]) {
        addr = abbrMap[key] + addr.substring(match[1].length)
      }
    }
  }

  return addr
}

function toTitleCase(str: string): string {
  const lowerWords = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'en', 'y', 'e', 'o', 'les', 'dels', 'a', 'al'])
  return str.toLowerCase().split(/\s+/).map((w, i) =>
    i === 0 || !lowerWords.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join(' ')
}


function getFirst(tags: Map<string, string[]>, names: string[]): string {
  for (const n of names) {
    const vals = tags.get(n.toLowerCase())
    if (vals && vals[0]) return stripCdata(vals[0])
  }
  return ''
}

function getAll(tags: Map<string, string[]>, name: string): string[] {
  return (tags.get(name.toLowerCase()) || []).map(v => stripCdata(v))
}

function parseBoolFromTags(tags: Map<string, string[]>, names: string[]): boolean | null {
  const val = getFirst(tags, names).toLowerCase()
  if (!val) return null
  return val === 'true' || val === 'yes' || val === 'si' || val === 'sí' || val === '1'
}

function parseNum(raw: string): number | null {
  if (!raw) return null
  // Remove units like m², m2, sqm, etc and whitespace
  const cleaned = raw.replace(/[m²²sqft\s]/gi, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) || num <= 0 ? null : num
}

function parsePrice(raw: string): number | null {
  if (!raw) return null
  let cleaned = raw.replace(/[€$£\s]/g, '')
  if (/\d\.\d{3}/.test(cleaned) && cleaned.includes(',')) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.')
  }
  const num = parseFloat(cleaned)
  return isNaN(num) ? null : num
}

function extractImages(tags: Map<string, string[]>, block: string): string[] {
  const images: string[] = []
  const seen = new Set<string>()
  const add = (url: string) => {
    const c = url.trim()
    if (c.startsWith('http') && !seen.has(c)) { seen.add(c); images.push(c) }
  }

  // Check container tags for nested images
  for (const ct of ['images', 'pictures', 'photos', 'fotos', 'imagenes', 'media', 'gallery']) {
    for (const container of getAll(tags, ct)) {
      // Extract all URLs from inside the container
      const urlRegex = /<(?:url|picture_url|image_url|foto_url|src)[^>]*>([^<]+)<\/[^>]+>/gi
      let m
      while ((m = urlRegex.exec(container)) !== null) add(stripCdata(m[1]))
      // Also check <image>/<picture>/<foto> sub-blocks
      const subRegex = /<(?:image|picture|foto|photo)[^>]*>([\s\S]*?)<\/(?:image|picture|foto|photo)>/gi
      while ((m = subRegex.exec(container)) !== null) {
        const inner = m[1]
        const urlMatch = inner.match(/<(?:url|picture_url|src)[^>]*>([^<]+)</)
        if (urlMatch) add(stripCdata(urlMatch[1]))
        else if (inner.trim().startsWith('http')) add(stripCdata(inner))
      }
      // <img src="..."/>
      const imgSrc = /src=["']([^"']+)["']/gi
      while ((m = imgSrc.exec(container)) !== null) add(m[1])
    }
  }

  // Direct image tags
  if (images.length === 0) {
    for (const tag of ['image', 'picture', 'foto', 'photo', 'imagen']) {
      for (const val of getAll(tags, tag)) {
        if (val.startsWith('http')) add(val)
        else {
          const urlMatch = val.match(/<(?:url|picture_url|src)[^>]*>([^<]+)</)
          if (urlMatch) add(stripCdata(urlMatch[1]))
        }
      }
    }
  }

  // Bare image URLs
  if (images.length === 0) {
    const bareRegex = />(https?:\/\/[^<]*\.(?:jpg|jpeg|png|webp|gif|avif)[^<]*)</gi
    let m
    while ((m = bareRegex.exec(block)) !== null) add(m[1])
  }

  return images
}

function extractVideos(tags: Map<string, string[]>, block: string): string[] {
  const videos: string[] = []
  const seen = new Set<string>()
  const add = (url: string) => {
    const c = url.trim()
    // Normalize YouTube short links
    if (c.includes('youtu.be/')) {
      const id = c.split('youtu.be/')[1]?.split('?')[0]
      if (id) { const full = `https://www.youtube.com/watch?v=${id}`; if (!seen.has(full)) { seen.add(full); videos.push(full) } }
      return
    }
    if (c.startsWith('http') && !seen.has(c)) { seen.add(c); videos.push(c) }
  }

  // Container tags: <videos>, <multimedia>, <media>
  for (const ct of ['videos', 'video_urls', 'multimedia', 'media']) {
    for (const container of getAll(tags, ct)) {
      const urlRegex = /<(?:url|video_url|src|href)[^>]*>([^<]+)<\/[^>]+>/gi
      let m
      while ((m = urlRegex.exec(container)) !== null) {
        const v = stripCdata(m[1]).trim()
        if (/youtube|youtu\.be|vimeo|mp4|webm|mov/i.test(v)) add(v)
      }
      // YouTube embed: src="https://www.youtube.com/embed/ID"
      const embedRegex = /(?:src|href)=["'](https?:\/\/(?:www\.youtube\.com\/embed|player\.vimeo\.com\/video)[^"']+)["']/gi
      while ((m = embedRegex.exec(container)) !== null) add(m[1])
    }
  }

  // Direct video tags
  for (const tag of ['video', 'video_url', 'youtube', 'youtube_url', 'youtube_id', 'vimeo', 'vimeo_url', 'videotour', 'video_tour']) {
    const val = getFirst(tags, [tag])
    if (!val) continue
    if (val.startsWith('http')) { add(val); continue }
    // Bare YouTube ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(val.trim())) {
      add(`https://www.youtube.com/watch?v=${val.trim()}`)
      continue
    }
    // Embed URL → convert to watch URL
    const embedMatch = val.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
    if (embedMatch) { add(`https://www.youtube.com/watch?v=${embedMatch[1]}`); continue }
  }

  // Scan entire block for video URLs / YouTube / Vimeo
  const bareRegex = />(https?:\/\/[^<\s]*(?:\.mp4|\.webm|\.mov|youtube\.com\/watch|youtu\.be\/|vimeo\.com\/\d)[^<\s]*)</gi
  let m
  while ((m = bareRegex.exec(block)) !== null) add(m[1])
  // YouTube embed anywhere in block
  const ytEmbedRegex = /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/gi
  while ((m = ytEmbedRegex.exec(block)) !== null) add(`https://www.youtube.com/watch?v=${m[1]}`)

  return videos
}

function extractTour(tags: Map<string, string[]>, block: string): string | null {
  // Dedicated tour tags
  const tourTags = ['virtual_tour', 'virtual_tour_url', 'virtualtour', 'tour_virtual', 'url_tour',
    '3dtour', '3d_tour', 'matterport', 'virtual_visit', 'visita_virtual', 'tour360', 'tour_360',
    'vr_tour', 'panorama', 'panoramic_tour', 'immersive_tour', 'tour_url', 'toururl']
  const val = getFirst(tags, tourTags)
  if (val && val.startsWith('http')) return val

  // Check multimedia/media containers for Matterport or 3D tour URLs
  for (const ct of ['multimedia', 'media', 'videos']) {
    for (const container of getAll(tags, ct)) {
      const matterportMatch = container.match(/https?:\/\/my\.matterport\.com\/[^\s<"']+/)
      if (matterportMatch) return matterportMatch[0]
      const tourMatch = container.match(/https?:\/\/[^\s<"']*(?:tour|3d|matterport|panoram|360|vr\.)[^\s<"']*/i)
      if (tourMatch) return tourMatch[0]
    }
  }

  // Scan entire block for Matterport or common tour patterns
  const matterport = block.match(/https?:\/\/my\.matterport\.com\/[^\s<"']+/)
  if (matterport) return matterport[0]
  const tourUrl = block.match(/https?:\/\/[^\s<"']*(?:matterport|tour360|tour3d|visita-virtual|virtual-tour)[^\s<"']*/i)
  if (tourUrl) return tourUrl[0]

  return null
}


// ── Urbanization → Municipality normalization ─────────────────────────────
// Many XML feeds use urbanization/resort names instead of the real municipality.
// This map corrects them and moves the original name to the zone field.
const urbanizationToMunicipality: Record<string, { city: string; province?: string }> = {
  'ciudad quesada':       { city: 'Rojales' },
  'orihuela costa':       { city: 'Orihuela' },
  'torre de la horadada': { city: 'Pilar de la Horadada' },
  'dehesa de campoamor':  { city: 'Orihuela' },
  'campoamor':            { city: 'Orihuela' },
  'playa flamenca':       { city: 'Orihuela' },
  'las colinas golf':     { city: 'Orihuela' },
  'punta prima':          { city: 'Orihuela' },
  'la zenia':             { city: 'Orihuela' },
  'cabo roig':            { city: 'Orihuela' },
  'villamartín':          { city: 'Orihuela' },
  'villamartin':          { city: 'Orihuela' },
  'los dolses':           { city: 'Orihuela' },
  'la finca golf':        { city: 'Algorfa' },
  'pueblo mascarat':      { city: 'Altea' },
  'la herrada':           { city: 'Los Montesinos' },
  'la marina del pinet':  { city: 'Elche' },
  'la marina':            { city: 'Elche' },
  'gran alacant':         { city: 'Santa Pola' },
  'la sella':             { city: 'Pedreguer' },
  'moraira':              { city: 'Teulada' },
  'la canalosa':          { city: 'Hondón de las Nieves' },
  'pinar de campoverde':  { city: 'Pilar de la Horadada' },
  'heredades':            { city: 'Almoradí' },
  'la mata':              { city: 'Torrevieja' },
  'cumbre del sol':       { city: 'Benitachell' },
  'el chaparral':         { city: 'Torrevieja' },
  'el mojón':             { city: 'San Pedro del Pinatar', province: 'Murcia' },
  'el mojon':             { city: 'San Pedro del Pinatar', province: 'Murcia' },
  'urbanización sea hills': { city: 'Finestrat' },
  'vistabella':           { city: 'Orihuela' },
  'la cala':              { city: 'Finestrat' },
  'coloma':               { city: 'San Fulgencio' },
  'lo crispin':           { city: 'Algorfa' },
  'montesinos':           { city: 'Los Montesinos' },
  'mil palmeras':         { city: 'Pilar de la Horadada' },
  'los altos':            { city: 'Orihuela' },
  'los balcones':         { city: 'Torrevieja' },
  'aguas nuevas':         { city: 'Torrevieja' },
  'san luis':             { city: 'Torrevieja' },
  'los alcázares':        { city: 'Los Alcázares', province: 'Murcia' },
  'sucina':               { city: 'Murcia', province: 'Murcia' },
  'roda golf':            { city: 'San Javier', province: 'Murcia' },
  'mar menor golf':       { city: 'Torre-Pacheco', province: 'Murcia' },
  'hacienda del alamo':   { city: 'Fuente Álamo', province: 'Murcia' },
  'condado de alhama':    { city: 'Alhama de Murcia', province: 'Murcia' },
  'la manga':             { city: 'Cartagena', province: 'Murcia' },
  'la manga del mar menor': { city: 'Cartagena', province: 'Murcia' },
}

/**
 * Normalize city: if it's an urbanization name, return the real municipality
 * and set the urbanization as zone. Returns { city, zone, province? }.
 */
function normalizeCity(rawCity: string, existingZone: string): { city: string; zone: string; province?: string } {
  if (!rawCity) return { city: rawCity, zone: existingZone }
  const key = rawCity.toLowerCase().trim()
    .replace(/^urbanización\s+/i, '')
    .replace(/^urb\.?\s+/i, '')
  const match = urbanizationToMunicipality[key]
  if (match) {
    return {
      city: match.city,
      zone: existingZone || rawCity, // preserve original name as zone
      ...(match.province ? { province: match.province } : {}),
    }
  }
  return { city: rawCity, zone: existingZone }
}


// ── Split XML into property blocks efficiently ──
function splitPropertyBlocks(xmlText: string): string[] {
  const blocks: string[] = []
  const lowerXml = xmlText.toLowerCase() // Only once!
  const tagNames = ['property', 'ad', 'inmueble', 'listing', 'anuncio']
  
  for (const tagName of tagNames) {
    const openTag = `<${tagName}`
    const closeTag = `</${tagName}>`
    let searchFrom = 0
    
    while (true) {
      const openIdx = lowerXml.indexOf(openTag, searchFrom)
      if (openIdx === -1) break
      // Find end of opening tag (past the >)
      const openTagEnd = xmlText.indexOf('>', openIdx)
      if (openTagEnd === -1) break
      const closeIdx = lowerXml.indexOf(closeTag, openIdx)
      if (closeIdx === -1) break
      const endIdx = closeIdx + closeTag.length
      // Extract only the INNER content (between opening and closing tags)
      blocks.push(xmlText.substring(openTagEnd + 1, closeIdx))
      searchFrom = endIdx
    }
    
    if (blocks.length > 0) break
  }
  
  return blocks
}

function parseProperty(block: string): any | null {
  const tags = extractAllTags(block)

  // ── Helper: extract a localized value from a multilang container (prefer <es>) ──
  function getLocalized(container: string): string {
    const esMatch = container.match(/<(?:es|es_ES|spanish|espanol|español)[^>]*>([\s\S]*?)<\/(?:es|es_ES|spanish|espanol|español)>/i)
    if (esMatch) return stripCdata(esMatch[1])
    const enMatch = container.match(/<(?:en|en_GB|en_US|english)[^>]*>([\s\S]*?)<\/(?:en|en_GB|en_US|english)>/i)
    if (enMatch) return stripCdata(enMatch[1])
    // First language tag found
    const anyLang = container.match(/<[a-z]{2}[^>]*>([\s\S]*?)<\/[a-z]{2}>/i)
    if (anyLang) return stripCdata(anyLang[1])
    return container
  }

  // ── Type & operation ──────────────────────────────────────────────────────
  const rawType = getFirst(tags, ['type', 'propertytype', 'tipo', 'property_type', 'typeofproperty', 'subtype', 'subtipo'])
  const property_type = resolvePropertyType(rawType)

  const opRaw = getFirst(tags, ['price_freq', 'operation', 'operacion', 'transaction', 'transaction_type', 'tipo_operacion', 'offertype']).toLowerCase()
  const operation = (opRaw.includes('rent') || opRaw.includes('alquiler') || opRaw.includes('lease')) ? 'alquiler' : 'venta'

  // ── Location: prefer <location> container (has lat/lng/zipcode/address/floor/door) ──
  const locationContainer = getFirst(tags, ['location'])
  let city = ''
  let province = ''
  let zip_code = ''
  let address = ''
  let floor = ''
  let door = ''
  let latStr = ''
  let lngStr = ''

  if (locationContainer && locationContainer.includes('<')) {
    // Extract from container
    latStr = locationContainer.match(/<latitude[^>]*>([^<]+)<\/latitude>/i)?.[1]?.trim() || ''
    lngStr = locationContainer.match(/<longitude[^>]*>([^<]+)<\/longitude>/i)?.[1]?.trim() || ''
    zip_code = locationContainer.match(/<zipcode[^>]*>([^<]+)<\/zipcode>/i)?.[1]?.trim()
      || locationContainer.match(/<postal_?code[^>]*>([^<]+)<\/postal_?code>/i)?.[1]?.trim() || ''
    const addrRaw = locationContainer.match(/<address[^>]*>([\s\S]*?)<\/address>/i)?.[1] || ''
    address = cleanText(addrRaw)
    // Floor: <floor><current>4</current></floor>
    const floorContainer = locationContainer.match(/<floor[^>]*>([\s\S]*?)<\/floor>/i)?.[1] || ''
    if (floorContainer.includes('<current>')) {
      floor = floorContainer.match(/<current[^>]*>([^<]+)<\/current>/i)?.[1]?.trim() || ''
    } else {
      floor = cleanText(floorContainer)
    }
    door = locationContainer.match(/<door[^>]*>([^<]+)<\/door>/i)?.[1]?.trim() || ''
  }

  // Flat location tags as fallback / supplement
  if (!city) city = getFirst(tags, ['town', 'city', 'ciudad', 'localidad', 'location_detail', 'area', 'municipio', 'municipality'])
  if (!province) province = getFirst(tags, ['province', 'provincia', 'region', 'state', 'comunidad'])
  let zone = getFirst(tags, ['zone', 'zona', 'barrio', 'neighborhood', 'district', 'urbanizacion', 'urbanización', 'location_detail'])
  if (!zip_code) zip_code = getFirst(tags, ['postcode', 'zip_code', 'zipcode', 'codigo_postal', 'cp', 'postalcode', 'postal_code'])
  if (!address) {
    const addrRaw = getFirst(tags, ['address', 'direccion', 'street', 'calle', 'via'])
    address = cleanText(addrRaw)
  }
  address = normalizeAddress(address)
  if (!floor) floor = getFirst(tags, ['floor', 'planta', 'level', 'piso_num', 'floor_number', 'story'])
  if (!latStr) latStr = getFirst(tags, ['latitude', 'lat', 'gps_lat', 'geo_lat'])
  if (!lngStr) lngStr = getFirst(tags, ['longitude', 'lng', 'lon', 'gps_lng', 'gps_lon', 'geo_lng', 'geo_lon'])

  const latitude = parseFloat(latStr) || null
  const longitude = parseFloat(lngStr) || null

  // ── Surface area (container <surface_area><built>X</built><plot>Y</plot>) ──
  function extractSurface(containerTagNames: string[], directTagNames: string[]): string {
    for (const name of containerTagNames) {
      const container = getFirst(tags, [name])
      if (container && container.includes('<')) {
        const subMatch = container.match(/<(?:built|habitable|usable|util|construido|construida)[^>]*>([^<]+)<\//)
        if (subMatch) { const v = subMatch[1].trim(); if (v && parseFloat(v) > 0) return v }
        const anyNum = container.match(/<[^>]+>(\d+(?:[.,]\d+)?)<\//)
        if (anyNum) { const v = anyNum[1].trim(); if (v && parseFloat(v) > 0) return v }
      }
    }
    for (const name of directTagNames) {
      const val = getFirst(tags, [name])
      if (val && !val.includes('<') && parseFloat(val) > 0) return val
    }
    return ''
  }

  // Also extract plot area from surface_area container
  function extractPlot(): number | null {
    const container = getFirst(tags, ['surface_area', 'superficie'])
    if (container && container.includes('<')) {
      const plotMatch = container.match(/<plot[^>]*>([^<]+)<\/plot>/i)
      if (plotMatch) { const v = parseFloat(plotMatch[1].trim()); if (v > 0) return v }
    }
    const plotVal = getFirst(tags, ['plot', 'plot_area', 'parcela', 'terreno_m2', 'land_area', 'lot_size'])
    return parseNum(plotVal)
  }

  const surfaceVal = extractSurface(
    ['surface_area', 'superficie'],
    ['superficie_util', 'usable_area', 'useful_area', 'living_area', 'habitablearea', 'habitable_area',
     'net_area', 'area_util', 'surface', 'm2', 'm2_util', 'm2_utiles', 'metros',
     'sqm', 'squaremeters', 'square_meters', 'built_area', 'built', 'builtarea', 'total_area', 'area'],
  )
  const builtAreaVal = extractSurface(
    ['surface_area', 'superficie'],
    ['built_area', 'superficie_construida', 'constructed_area', 'm2_construido', 'm2_construidos',
     'area_construida', 'builtarea', 'built', 'gross_area', 'living_area'],
  )
  const plotArea = extractPlot()

  // ── Description: container <desc> with multilang or direct tags ──────────
  let descRaw = ''
  for (const descTag of ['desc', 'description', 'descripcion', 'comments', 'comentarios', 'observation', 'observaciones', 'notes']) {
    const container = getFirst(tags, [descTag])
    if (container) {
      if (container.includes('<')) {
        // Multilang container
        const localized = getLocalized(container)
        if (localized) { descRaw = localized; break }
      } else if (container.length > 10) {
        descRaw = container; break
      }
    }
  }
  // Also check explicit Spanish description tags
  if (!descRaw) {
    descRaw = getFirst(tags, ['description_es', 'desc_es', 'descripcion_es', 'description_spanish']) || ''
  }
  const description = cleanText(descRaw)

  // ── XML ID & basic fields ─────────────────────────────────────────────────
  const xml_id = getFirst(tags, ['id', 'ref', 'reference', 'referencia', 'property_id', 'adid', 'code', 'codigo'])
  if (!xml_id) return null

  // ── Source URL: extract the original portal listing URL ──────────────────
  // HabiHub feeds use multilang containers: <url><es>https://...</es><en>...</en></url>
  // We need to extract the actual URL from within those language tags
  function extractSourceUrl(): string | null {
    const rawVal = getFirst(tags, [
      'url', 'link', 'property_url', 'listing_url',
      'web', 'website', 'permalink', 'canonical_url', 'href',
      'detail_url', 'page_url', 'full_url', 'ad_url'
    ])
    if (!rawVal) return null
    // If value looks like a direct URL, return it
    if (rawVal.startsWith('http') && !rawVal.includes('<')) return rawVal
    // It's a multilang container — extract <es> first, then <en>, then any language
    const esMatch = rawVal.match(/<(?:es|es_ES)[^>]*>(https?:\/\/[^<]+)<\/(?:es|es_ES)>/i)
    if (esMatch) return esMatch[1].trim()
    const enMatch = rawVal.match(/<(?:en|en_GB|en_US)[^>]*>(https?:\/\/[^<]+)<\/(?:en|en_GB|en_US)>/i)
    if (enMatch) return enMatch[1].trim()
    // Any language tag containing a URL
    const anyMatch = rawVal.match(/<[a-z]{2}[^>]*>(https?:\/\/[^<]+)<\/[a-z]{2}>/i)
    if (anyMatch) return anyMatch[1].trim()
    return null
  }
  const source_url = extractSourceUrl()

  const price = parsePrice(getFirst(tags, ['price', 'precio', 'amount', 'originalprice', 'sale_price', 'rent_price', 'precio_venta', 'precio_alquiler']))
  const titleRaw = getFirst(tags, ['title', 'titulo', 'name', 'headline', 'subject'])
  const title = cleanText(titleRaw) || `${typeLabels[property_type] || 'Propiedad'} en ${city || province || 'ubicación desconocida'}`

  const bedrooms = parseInt(getFirst(tags, ['beds', 'bedrooms', 'habitaciones', 'rooms', 'num_bedrooms', 'dormitorios', 'n_rooms'])) || 0
  const bathrooms = parseInt(getFirst(tags, ['baths', 'bathrooms', 'banos', 'num_bathrooms', 'aseos', 'n_baths'])) || 0

  // ── Energy cert: handle container <energy_rating><status>C</status> ───────
  function extractEnergyCert(): string {
    const container = getFirst(tags, ['energy_rating', 'energy_cert', 'energy', 'certificado_energetico', 'energyrating', 'energy_certificate', 'energy_class', 'clase_energetica', 'calificacion_energetica'])
    if (!container) return ''
    if (container.includes('<')) {
      // Try <status> or <rating> or <class> sub-tag
      const statusMatch = container.match(/<(?:status|rating|class|value|calificacion)[^>]*>([^<]+)<\//)
      if (statusMatch) {
        const v = statusMatch[1].trim()
        if (v.toLowerCase() === 'not-available' || v.toLowerCase() === 'en tramite') return 'En trámite'
        if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(v.toUpperCase())) return v.toUpperCase()
        if (v.toLowerCase().includes('exento')) return 'Exento'
        return 'En trámite'
      }
    } else {
      const v = container.trim().toUpperCase()
      if (['A', 'B', 'C', 'D', 'E', 'F', 'G'].includes(v)) return v
      if (v === 'EN TRAMITE' || v === 'EN TRÁMITE') return 'En trámite'
      if (v === 'EXENTO') return 'Exento'
    }
    return ''
  }
  const energy_cert = extractEnergyCert()

  // ── Virtual tour URL: use comprehensive extractor ─────────────────────────
  const virtual_tour_url = extractTour(tags, block)

  // ── Features: handle <features><feature>text</feature>... container ───────
  function extractAllFeatures(): string[] {
    const features: string[] = []
    const seen = new Set<string>()
    const add = (f: string) => {
      const c = f.trim()
      if (c && !seen.has(c.toLowerCase())) { seen.add(c.toLowerCase()); features.push(c) }
    }

    // Boolean feature tags (same as before)
    const boolFeatures: [string[], string][] = [
      [['air_conditioning', 'aire_acondicionado', 'airconditioning'], 'Aire acondicionado'],
      [['heating', 'calefaccion'], 'Calefacción'],
      [['furnished', 'amueblado'], 'Amueblado'],
      [['storage_room', 'trastero', 'storageroom'], 'Trastero'],
      [['balcony', 'balcon'], 'Balcón'],
      [['communal_pool', 'piscina_comunitaria'], 'Piscina comunitaria'],
      [['security', 'seguridad', 'alarm'], 'Seguridad'],
      [['fitted_wardrobes', 'armarios_empotrados'], 'Armarios empotrados'],
      [['sea_views', 'vistas_mar'], 'Vistas al mar'],
      [['mountain_views', 'vistas_montana'], 'Vistas a la montaña'],
    ]
    for (const [names, label] of boolFeatures) {
      if (parseBoolFromTags(tags, names) === true) add(label)
    }

    // Container <features><feature>text</feature> (HabiHub format)
    const featContainer = getFirst(tags, ['features', 'caracteristicas', 'extras'])
    if (featContainer && featContainer.includes('<')) {
      const featRegex = /<feature[^>]*>([\s\S]*?)<\/feature>/gi
      let m
      while ((m = featRegex.exec(featContainer)) !== null) {
        const raw = stripCdata(m[1]).trim()
        if (raw) add(raw)
      }
      // Also try <item> sub-tags
      const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi
      while ((m = itemRegex.exec(featContainer)) !== null) {
        const raw = stripCdata(m[1]).trim()
        if (raw) add(raw)
      }
    }

    // If plot area found, add as feature
    if (plotArea && plotArea > 0) add(`Parcela: ${plotArea} m²`)

    return features
  }

  // ── Images: standard extraction + plans ──────────────────────────────────
  function extractAllImages(): string[] {
    const images = extractImages(tags, block)
    const seen = new Set(images)
    
    // Also extract <plans><plan><url>...</url></plan>
    const plansContainer = getFirst(tags, ['plans', 'planos', 'floorplans', 'floor_plans'])
    if (plansContainer && plansContainer.includes('<')) {
      const urlRegex = /<url[^>]*>([^<]+)<\/url>/gi
      let m
      while ((m = urlRegex.exec(plansContainer)) !== null) {
        const url = stripCdata(m[1]).trim()
        // Only add image plans (not PDFs)
        if (url.startsWith('http') && !url.endsWith('.pdf') && !seen.has(url)) {
          seen.add(url)
          images.push(url)
        }
      }
    }
    return images
  }

  function extractFloorPlans(): string[] {
    const plans: string[] = []
    const seen = new Set<string>()
    const add = (url: string) => {
      const clean = url.trim()
      if (clean.startsWith('http') && !seen.has(clean)) {
        seen.add(clean)
        plans.push(clean)
      }
    }

    const plansContainer = getFirst(tags, ['plans', 'planos', 'floorplans', 'floor_plans'])
    if (plansContainer && plansContainer.includes('<')) {
      const urlRegex = /<url[^>]*>([^<]+)<\/url>/gi
      let match
      while ((match = urlRegex.exec(plansContainer)) !== null) add(stripCdata(match[1]))
    }

    return plans
  }

  let has_garage = parseBoolFromTags(tags, ['parking', 'garage', 'garaje', 'has_garage', 'cochera', 'plaza_garaje'])
  let has_pool = parseBoolFromTags(tags, ['pool', 'piscina', 'has_pool', 'swimmingpool', 'swimming_pool'])
  let has_terrace = parseBoolFromTags(tags, ['terrace', 'terraza', 'has_terrace'])
  let has_garden = parseBoolFromTags(tags, ['garden', 'jardin', 'has_garden', 'jardín'])
  let has_elevator = parseBoolFromTags(tags, ['elevator', 'lift', 'ascensor', 'has_elevator'])

  const reference = getFirst(tags, ['cadastral_reference', 'referencia_catastral', 'catastro', 'cadastral', 'ref_catastral']) || null

  const features = extractAllFeatures()
  const images = extractAllImages()
  const videos = extractVideos(tags, block)
  const floor_plans = extractFloorPlans()

  // ── Infer boolean fields from feature text when XML tags are absent ────
  if (features.length > 0) {
    const featLower = features.map(f => f.toLowerCase()).join(' | ')
    if (has_garage === null && /garag|parking|cochera|plaza.?garaje|private.?garage/i.test(featLower)) has_garage = true
    if (has_pool === null && /piscina|pool|swimming/i.test(featLower)) has_pool = true
    if (has_terrace === null && /terraza|terrace|solarium/i.test(featLower)) has_terrace = true
    if (has_garden === null && /jard[ií]n|garden/i.test(featLower)) has_garden = true
    if (has_elevator === null && /ascensor|elevator|lift/i.test(featLower)) has_elevator = true
  }

  // If type resolved to default 'piso', try to refine from title/description
  const finalType = (property_type === 'piso' && !rawType) 
    ? inferTypeFromText(title, description) 
    : property_type

  // ── Year built: extract from XML or default to current year ──────────────
  const yearRaw = getFirst(tags, ['year_built', 'year', 'ano_construccion', 'construction_year', 'built_year', 'ano', 'fecha_construccion', 'age', 'antiguedad'])
  let year_built: number | null = null
  if (yearRaw) {
    const parsed = parseInt(yearRaw)
    if (!isNaN(parsed) && parsed > 1800 && parsed <= 2100) year_built = parsed
  }
  // Default to 2026 if not found — portals penalize missing year
  if (!year_built) year_built = 2026

  // ── Surface area: default 200 m² ONLY if both surface AND built are missing ──
  let surfaceNum = parseNum(surfaceVal)
  let builtNum = parseNum(builtAreaVal)
  if (!surfaceNum && !builtNum) {
    surfaceNum = 200
  }

  // ── Normalize urbanization names to real municipalities ─────────────────
  const normalized = normalizeCity(city, zone)
  city = normalized.city
  zone = normalized.zone
  if (normalized.province) province = normalized.province

  const source_metadata = {
    provider: 'habihub',
    import_format: 'xml',
    raw_tags: serializeTags(tags),
    raw_values: {
      property_type: rawType || null,
      operation: opRaw || null,
      price: getFirst(tags, ['price', 'precio', 'amount', 'originalprice', 'sale_price', 'rent_price', 'precio_venta', 'precio_alquiler']) || null,
      title: titleRaw || null,
      city,
      province,
      zone,
      zip_code,
      address,
      floor: floor || null,
      door: door || null,
      surface: surfaceVal || null,
      built_area: builtAreaVal || null,
      plot_area: plotArea,
      energy_cert,
      reference,
    },
    media: {
      images,
      videos,
      floor_plans,
      virtual_tour_url,
      source_url,
    },
    import_notes: {
      assigned_to_office: true,
      agent_assigned: false,
      translated_to_spanish: false,
    },
  }

  const prop: any = {
    title, property_type: finalType, operation, price,
    secondary_property_type: rawType ? cleanText(rawType) : null,
    surface_area: surfaceNum,
    built_area: builtNum,
    bedrooms, bathrooms,
    city: city || null, province: province || null, zip_code: zip_code || null,
    address: address || null, zone: zone || null,
    floor: floor || null,
    description: description ? description.substring(0, 5000) : null,
    energy_cert: energy_cert || null,
    images: images.length > 0 ? images : null,
    videos: videos.length > 0 ? videos : null,
    floor_plans: floor_plans.length > 0 ? floor_plans : null,
    xml_id, source_url, virtual_tour_url, latitude, longitude, reference,
    features: features.length > 0 ? features : null,
    year_built,
    key_location: 'oficina',
    source_metadata,
    source_raw_xml: block,
  }

  // Door number (stored in floor field if no dedicated column, or skip)
  if (door && !prop.floor) prop.floor = door

  if (has_garage !== null) prop.has_garage = has_garage
  if (has_pool !== null) prop.has_pool = has_pool
  if (has_terrace !== null) prop.has_terrace = has_terrace
  if (has_garden !== null) prop.has_garden = has_garden
  if (has_elevator !== null) prop.has_elevator = has_elevator

  return prop
}

// Simple language detection: checks if text is likely Spanish
function isLikelySpanish(text: string): boolean {
  if (!text || text.length < 50) return true // too short to detect
  const lower = text.toLowerCase()
  const spanishWords = ['de ', 'en ', 'con ', 'los ', 'las ', 'del ', 'por ', 'para ', 'una ', 'este ', 'esta ', 'tiene ', 'cuenta ', 'situad', 'ubicad', 'dispone ', 'dormitorio', 'habitacion', 'baño', 'cocina', 'salón', 'salon', 'terraza', 'piscina', 'jardín', 'jardin', 'garaje', 'ampli', 'luminos']
  const germanWords = ['der ', 'die ', 'das ', 'und ', 'mit ', 'für ', 'auf ', 'den ', 'dem ', 'ein ', 'eine ', 'ist ', 'von ', 'werden ', 'sind ', 'sich ', 'nicht ', 'kann ', 'über ', 'diese']
  const englishWords = ['the ', 'and ', 'with ', 'for ', 'from ', 'this ', 'that ', 'has ', 'are ', 'which ', 'been ', 'will ', 'would ', 'features ', 'located ', 'bedroom', 'bathroom', 'property']
  
  let esCount = 0, foreignCount = 0
  for (const w of spanishWords) if (lower.includes(w)) esCount++
  for (const w of germanWords) if (lower.includes(w)) foreignCount++
  for (const w of englishWords) if (lower.includes(w)) foreignCount++
  
  return esCount > foreignCount
}

// Translate descriptions to Spanish using AI
async function translateToSpanish(texts: { idx: number; text: string }[]): Promise<Map<number, string>> {
  const results = new Map<number, string>()
  if (texts.length === 0) return results
  
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  if (!LOVABLE_API_KEY) {
    console.warn('LOVABLE_API_KEY not set, skipping translation')
    return results
  }

  // Process in batches of 5 to avoid token limits
  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5)
    const prompt = batch.map((t, j) => `[${j}]\n${t.text.substring(0, 1500)}`).join('\n\n---\n\n')
    
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'Eres un traductor profesional inmobiliario. Traduce las siguientes descripciones de propiedades al español. Mantén el formato y estructura. Responde SOLO con las traducciones, separadas por ---. No añadas numeración ni texto extra.' },
            { role: 'user', content: `Traduce estas ${batch.length} descripciones al español:\n\n${prompt}` },
          ],
          max_tokens: 4000,
        }),
      })

      if (!response.ok) {
        console.error(`Translation API error: ${response.status}`)
        continue
      }

      const data = await response.json()
      const translated = data.choices?.[0]?.message?.content || ''
      const parts = translated.split(/\n---\n|\n-{3,}\n/)
      
      for (let j = 0; j < batch.length; j++) {
        const part = (parts[j] || '').replace(/^\[\d+\]\s*/, '').trim()
        if (part && part.length > 50) {
          results.set(batch[j].idx, part)
        }
      }
    } catch (err) {
      console.error('Translation error:', err)
    }
  }
  
  return results
}

async function ensureHabihubOwnerContact(supabase: ReturnType<typeof createClient>): Promise<string> {
  const sourceRef = 'owner:habihub'
  const baseTags = ['habihub', 'sistema', 'propietario']

  const { data: bySourceRef, error: bySourceErr } = await supabase
    .from('contacts')
    .select('id, tags')
    .eq('source_ref', sourceRef)
    .limit(1)
    .maybeSingle()

  if (bySourceErr) throw bySourceErr
  if (bySourceRef?.id) {
    const mergedTags = [...new Set([...(bySourceRef.tags || []), ...baseTags])]
    await supabase
      .from('contacts')
      .update({
        full_name: 'habihub',
        contact_type: 'propietario',
        status: 'activo',
        agent_id: null,
        tags: mergedTags,
      })
      .eq('id', bySourceRef.id)
    return bySourceRef.id
  }

  const { data: byName, error: byNameErr } = await supabase
    .from('contacts')
    .select('id, tags')
    .eq('full_name', 'habihub')
    .limit(1)
    .maybeSingle()

  if (byNameErr) throw byNameErr
  if (byName?.id) {
    const mergedTags = [...new Set([...(byName.tags || []), ...baseTags])]
    const { error: updateErr } = await supabase
      .from('contacts')
      .update({
        source_ref: sourceRef,
        contact_type: 'propietario',
        status: 'activo',
        agent_id: null,
        tags: mergedTags,
      })
      .eq('id', byName.id)

    if (updateErr) throw updateErr
    return byName.id
  }

  const { data: created, error: createErr } = await supabase
    .from('contacts')
    .insert({
      full_name: 'habihub',
      contact_type: 'propietario',
      status: 'activo',
      agent_id: null,
      tags: baseTags,
      source_ref: sourceRef,
      notes: 'Propietario técnico automático para inmuebles importados desde HabiHub.',
    })
    .select('id')
    .single()

  if (createErr || !created?.id) throw createErr || new Error('Could not create habihub owner contact')
  return created.id
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '').trim()
    const isInternalCron = token === serviceKey

    if (!isInternalCron) {
      const { data: authData, error: authErr } = await supabase.auth.getUser(token)
      const user = authData?.user

      if (authErr || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const [{ data: isAdmin }, { data: isCoord }] = await Promise.all([
        supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' }),
        supabase.rpc('has_role', { _user_id: user.id, _role: 'coordinadora' }),
      ])

      if (!isAdmin && !isCoord) {
        return new Response(JSON.stringify({ error: 'Admin or coordinadora only' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let requestBody: Record<string, unknown> = {}
    let feedId: string | null = null
    try {
      requestBody = await req.json()
      feedId = typeof requestBody?.feed_id === 'string' ? requestBody.feed_id : null
    } catch { /* no body */ }

    let query = supabase.from('xml_feeds').select('*').eq('is_active', true)
    if (feedId) query = query.eq('id', feedId)
    const { data: feeds, error: feedsErr } = await query
    if (feedsErr) throw feedsErr
    if (!feeds || feeds.length === 0) {
      return new Response(JSON.stringify({ message: 'No active feeds found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results: any[] = []
    const habihubOwnerId = await ensureHabihubOwnerContact(supabase)

    for (const feed of feeds) {
      try {
        console.log(`Processing feed: ${feed.name} (${feed.url})`)
        const response = await fetch(feed.url)
        if (!response.ok) {
          results.push({ feed: feed.name, error: `HTTP ${response.status}` })
          continue
        }
        const xmlText = await response.text()
        console.log(`Downloaded ${xmlText.length} bytes`)

        // Split into blocks efficiently using indexOf instead of regex on entire doc
        const blocks = splitPropertyBlocks(xmlText)
        console.log(`Found ${blocks.length} property blocks`)

        // Parse properties from blocks
        const parsedProperties: any[] = []
        for (const block of blocks) {
          const prop = parseProperty(block)
          if (prop) parsedProperties.push(prop)
        }
        console.log(`Parsed ${parsedProperties.length} valid properties`)

        // Feed snapshots should be deterministic by xml_id. If the provider repeats
        // the same listing in one run, keep the latest parsed version only.
        const propertyByXmlId = new Map<string, any>()
        for (const prop of parsedProperties) {
          if (prop?.xml_id) propertyByXmlId.set(prop.xml_id, prop)
        }
        const properties = Array.from(propertyByXmlId.values())
        const duplicateCount = parsedProperties.length - properties.length
        if (duplicateCount > 0) {
          console.log(`Collapsed ${duplicateCount} duplicate rows by xml_id for feed "${feed.name}"`)
        }

        // Translate non-Spanish descriptions
        const toTranslate: { idx: number; text: string }[] = []
        for (let j = 0; j < properties.length; j++) {
          if (properties[j].description && !isLikelySpanish(properties[j].description)) {
            toTranslate.push({ idx: j, text: properties[j].description })
          }
        }
        if (toTranslate.length > 0) {
          console.log(`Translating ${toTranslate.length} non-Spanish descriptions...`)
          const translations = await translateToSpanish(toTranslate)
          for (const [idx, translated] of translations) {
            properties[idx].description = translated.substring(0, 5000)
            properties[idx].source_metadata = {
              ...(properties[idx].source_metadata || {}),
              import_notes: {
                ...((properties[idx].source_metadata || {}).import_notes || {}),
                translated_to_spanish: true,
              },
            }
          }
          console.log(`Translated ${translations.size} descriptions`)
        }
        // Fetch existing media data to avoid overwriting with empty values
        const xmlIds = properties.map(p => p.xml_id).filter(Boolean)
        const previousSyncCount = Number(feed.last_sync_count || 0)
        const allowSnapshotShrinkCleanup = requestBody?.allow_snapshot_shrink_cleanup === true
        const { data: existingProps } = await supabase
          .from('properties')
          .select('xml_id, images, videos, virtual_tour_url, floor_plans, source_metadata')
          .in('xml_id', xmlIds)
        
        const existingMap = new Map<string, {
          images: string[] | null
          videos: string[] | null
          virtual_tour_url: string | null
          floor_plans: string[] | null
          source_metadata: Record<string, unknown> | null
        }>()
        for (const ep of (existingProps || [])) {
          existingMap.set(ep.xml_id, {
            images: ep.images,
            videos: ep.videos,
            virtual_tour_url: ep.virtual_tour_url,
            floor_plans: ep.floor_plans,
            source_metadata: ep.source_metadata,
          })
        }

        let upserted = 0
        for (let i = 0; i < properties.length; i += 50) {
            const batch = properties.slice(i, i + 50).map(p => {
              const existing = existingMap.get(p.xml_id)
            const merged: any = {
              ...p,
              agent_id: null,
              owner_id: habihubOwnerId,
              source: 'habihub',
              key_location: 'oficina',
              source_feed_id: feed.id,
              source_feed_name: feed.name,
            }

            // Never overwrite existing images/videos/tour with empty — prefer XML if it has more
            if (existing) {
              // Images: use whichever has more (XML is usually fresher)
              if (!merged.images || merged.images.length === 0) {
                if (existing.images && existing.images.length > 0) merged.images = existing.images
              }
              // Videos: merge both sources, deduplicate
              if (existing.videos && existing.videos.length > 0) {
                const xmlVids = merged.videos || []
                const merged_vids = [...new Set([...xmlVids, ...existing.videos])]
                merged.videos = merged_vids.length > 0 ? merged_vids : null
              }
              // Tour: keep existing if XML brings nothing new
              if (!merged.virtual_tour_url && existing.virtual_tour_url) {
                merged.virtual_tour_url = existing.virtual_tour_url
              }
              // Floor plans: merge and deduplicate
              if (existing.floor_plans && existing.floor_plans.length > 0) {
                const xmlPlans = merged.floor_plans || []
                const mergedPlans = [...new Set([...xmlPlans, ...existing.floor_plans])]
                merged.floor_plans = mergedPlans.length > 0 ? mergedPlans : null
              }

              // Preserve previous source metadata while replacing raw snapshot with the latest one
              merged.source_metadata = {
                ...(existing.source_metadata || {}),
                ...(merged.source_metadata || {}),
                feed: {
                  id: feed.id,
                  name: feed.name,
                  url: feed.url,
                  assignment: 'oficina',
                },
                previous_snapshot: existing.source_metadata || null,
              }
            } else {
              merged.source_metadata = {
                ...(merged.source_metadata || {}),
                feed: {
                  id: feed.id,
                  name: feed.name,
                  url: feed.url,
                  assignment: 'oficina',
                },
              }
            }

            return merged
          })

          const { error: upsertErr } = await supabase
            .from('properties')
            .upsert(batch, { onConflict: 'xml_id', ignoreDuplicates: false })

          if (upsertErr) {
            console.error(`Upsert error batch ${i}:`, upsertErr)
          } else {
            upserted += batch.length
          }
        }

        if (xmlIds.length > 0) {
          const { data: importedProperties, error: importedErr } = await supabase
            .from('properties')
            .select('id')
            .eq('source', 'habihub')
            .eq('source_feed_id', feed.id)
            .in('xml_id', xmlIds)

          if (importedErr) {
            console.error(`Owner backfill read error for feed ${feed.name}:`, importedErr)
          } else if (importedProperties && importedProperties.length > 0) {
            const ownerLinks = importedProperties.map((property) => ({
              property_id: property.id,
              contact_id: habihubOwnerId,
              role: 'propietario',
              notes: 'Asignado automáticamente desde feed HabiHub',
            }))

            const { error: ownerLinkErr } = await supabase
              .from('property_owners')
              .upsert(ownerLinks, { onConflict: 'property_id,contact_id', ignoreDuplicates: false })

            if (ownerLinkErr) {
              console.error(`Owner backfill link error for feed ${feed.name}:`, ownerLinkErr)
            }
          }
        }

        // ── Cleanup: last snapshot wins, but skip suspiciously empty/collapsed runs ──
        let staleDeleted = 0
        let snapshotCleanupSkippedReason: string | null = null
        const snapshotLooksEmpty = xmlIds.length === 0
        const snapshotLooksSuspiciouslySmall =
          previousSyncCount >= 20 &&
          xmlIds.length > 0 &&
          xmlIds.length < Math.ceil(previousSyncCount * 0.5) &&
          !allowSnapshotShrinkCleanup

        if (snapshotLooksEmpty && previousSyncCount > 0) {
          snapshotCleanupSkippedReason = 'empty_snapshot'
          console.warn(`Skipping stale cleanup for feed "${feed.name}" because the snapshot arrived empty`)
        } else if (snapshotLooksSuspiciouslySmall) {
          snapshotCleanupSkippedReason = 'suspicious_snapshot_shrink'
          console.warn(
            `Skipping stale cleanup for feed "${feed.name}" because snapshot shrank from ${previousSyncCount} to ${xmlIds.length}`,
          )
        }

        if (xmlIds.length > 0 && !snapshotCleanupSkippedReason) {
            // Fetch only properties previously imported from this exact feed.
            const { data: existingAll } = await supabase
              .from('properties')
              .select('id, xml_id')
              .eq('source', 'habihub')
              .eq('source_feed_id', feed.id)
              .not('xml_id', 'is', null)
              .in('status', ['disponible', 'reservado'])

          const feedXmlIdSet = new Set(xmlIds)
          const staleIds = (existingAll || [])
            .filter((p: any) => p.xml_id && !feedXmlIdSet.has(p.xml_id))
            .map((p: any) => p.id)

          if (staleIds.length > 0) {
            console.log(`Deleting ${staleIds.length} properties no longer in feed "${feed.name}"`)
            for (let s = 0; s < staleIds.length; s += 50) {
              const staleBatch = staleIds.slice(s, s + 50)
              const { error: deleteErr } = await supabase
                .from('properties')
                .delete()
                .in('id', staleBatch)
              if (deleteErr) console.error('Error deleting stale properties:', deleteErr)
              else staleDeleted += staleBatch.length
            }
          }
        }

        await supabase.from('xml_feeds').update({
          last_sync_at: new Date().toISOString(),
          last_sync_count: xmlIds.length,
        }).eq('id', feed.id)

        results.push({
          feed: feed.name,
          properties_found: properties.length,
          upserted,
          stale_deleted: staleDeleted,
          snapshot_cleanup_skipped_reason: snapshotCleanupSkippedReason,
          duplicate_rows_collapsed: duplicateCount,
        })
      } catch (err) {
        console.error(`Error processing feed ${feed.name}:`, err)
        results.push({ feed: feed.name, error: String(err) })
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Import error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
