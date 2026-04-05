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
  for (const word of lower.split(/[\s\-_/.,]+/)) {
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

type ParsedProperty = {
  xml_id: string
  title: string
  property_type: string
  operation: string
  price: number | null
  secondary_property_type: string | null
  surface_area: number | null
  built_area: number | null
  bedrooms: number | null
  bathrooms: number | null
  city: string | null
  province: string | null
  zip_code: string | null
  address: string | null
  zone: string | null
  floor: string | null
  description: string | null
  energy_cert: string | null
  images: string[] | null
  videos: string[] | null
  floor_plans: string[] | null
  source_url: string | null
  virtual_tour_url: string | null
  latitude: number | null
  longitude: number | null
  reference: string | null
  features: string[] | null
  year_built: number | null
  key_location: string
  source_metadata: Record<string, unknown> | null
  source_raw_xml: string | null
  has_garage?: boolean
  has_pool?: boolean
  has_terrace?: boolean
  has_garden?: boolean
  has_elevator?: boolean
}

type ImportResult = {
  feed: string
  error?: string
  imported?: number
  deleted?: number
  skipped_cleanup_reason?: string | null
}

type ExistingImportedProperty = {
  id: string
  xml_id: string | null
  source_url: string | null
  images: string[] | null
  videos: string[] | null
  virtual_tour_url: string | null
  floor_plans: string[] | null
}

type ExistingImportedPropertyId = {
  id: string
  xml_id: string | null
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

function extractCompactLocalizedValue(
  container: string,
  preferredLanguages: string[],
  fallbackToAnyLanguage = false,
): string {
  if (!container) return ''
  if (!container.includes('<')) return cleanText(container)

  for (const lang of preferredLanguages) {
    const match = container.match(new RegExp(`<${lang}[^>]*>([\\s\\S]*?)<\\/${lang}>`, 'i'))
    if (match?.[1]) return cleanText(match[1])
  }

  if (!fallbackToAnyLanguage) return ''
  const anyLanguageMatch = container.match(/<[a-z_]{2,10}[^>]*>([\s\S]*?)<\/[a-z_]{2,10}>/i)
  return cleanText(anyLanguageMatch?.[1] || container)
}

function serializeRelevantRawTags(tags: Map<string, string[]>): Record<string, string[]> {
  const compact: Record<string, string[]> = {}
  const add = (key: string, value: string) => {
    const cleaned = value.trim()
    if (cleaned) compact[key] = [cleaned]
  }

  const titleContainer = getFirst(tags, ['title', 'titulo', 'name', 'headline', 'title_en', 'name_en', 'headline_en'])
  const descContainer = getFirst(tags, [
    'description', 'descripcion', 'desc', 'comments',
    'description_en', 'desc_en',
    'description_de', 'desc_de', 'description_german',
    'description_fr', 'desc_fr', 'description_french',
    'description_nl', 'desc_nl', 'description_dutch',
  ])

  add('title_en', extractCompactLocalizedValue(titleContainer, ['en', 'en_gb', 'en_us', 'english'], true))
  add('title', extractCompactLocalizedValue(titleContainer, ['es', 'es_es', 'spanish', 'espanol', 'español'], true))
  add('description_en', extractCompactLocalizedValue(descContainer, ['en', 'en_gb', 'en_us', 'english'], true))
  add('description_de', extractCompactLocalizedValue(descContainer, ['de', 'de_de', 'german'], true))
  add('description_fr', extractCompactLocalizedValue(descContainer, ['fr', 'fr_fr', 'french'], true))
  add('description_nl', extractCompactLocalizedValue(descContainer, ['nl', 'nl_nl', 'dutch'], true))

  add('catastral', getFirst(tags, ['catastral', 'cadastral_reference', 'catastro_ref', 'catastro']))
  add('street_number', getFirst(tags, ['street_number', 'numero', 'number']))

  return compact
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

function sanitizeImportedText(val: string): string {
  return cleanText(val)
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/\bnot-available\b/gi, ' ')
    .replace(/\bundefined\b/gi, ' ')
    .replace(/\bnull\b/gi, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function sanitizeImportedTitle(val: string): string {
  const cleaned = sanitizeImportedText(val)
  if (!cleaned) return ''

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned
  const candidate = firstSentence.length >= 8 ? firstSentence : cleaned
  const wordCount = candidate.split(/\s+/).filter(Boolean).length

  if (candidate.length > 160 || wordCount > 14) return ''

  return candidate.slice(0, 140).trim()
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
  const isCadastral = addr === addr.toUpperCase() && /^[A-ZÁÉÍÓÚÑÜ\s,.\d/]+$/.test(addr)

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
    const match = addr.match(/^([A-Za-zÁÉÍÓÚÑÜ./]+)\s+/)
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

function parseProperty(block: string): ParsedProperty | null {
  const tags = extractAllTags(block)

  // ── Helper: extract a localized value from a multilang container (prefer <en>) ──
  function getLocalized(container: string): string {
    const enMatch = container.match(/<(?:en|en_GB|en_US|english)[^>]*>([\s\S]*?)<\/(?:en|en_GB|en_US|english)>/i)
    if (enMatch) return stripCdata(enMatch[1])
    const esMatch = container.match(/<(?:es|es_ES|spanish|espanol|español)[^>]*>([\s\S]*?)<\/(?:es|es_ES|spanish|espanol|español)>/i)
    if (esMatch) return stripCdata(esMatch[1])
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
  // Also check explicit language-specific description tags, preferring English
  if (!descRaw) {
    descRaw = getFirst(tags, [
      'description_en', 'desc_en', 'description_english',
      'description_es', 'desc_es', 'descripcion_es', 'description_spanish',
    ]) || ''
  }
  const description = sanitizeImportedText(descRaw)

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
  let titleRaw = ''
  for (const titleTag of ['title', 'titulo', 'name', 'headline', 'subject']) {
    const container = getFirst(tags, [titleTag])
    if (!container) continue
    if (container.includes('<')) {
      const localized = getLocalized(container)
      if (localized) { titleRaw = localized; break }
    } else {
      titleRaw = container
      break
    }
  }
  if (!titleRaw) {
    titleRaw = getFirst(tags, [
      'title_en', 'name_en', 'headline_en',
      'title_es', 'titulo_es',
    ])
  }
  const title = sanitizeImportedTitle(titleRaw) || `${typeLabels[property_type] || 'Propiedad'} en ${city || province || 'ubicación desconocida'}`

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
  const builtNum = parseNum(builtAreaVal)
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
    // Persist only the raw fields that downstream portal exports still reuse.
    // Keeping every nested XML tag here makes recurring feed imports much heavier.
    raw_tags: serializeRelevantRawTags(tags),
    raw_values: {
      property_type: rawType || null,
      operation: opRaw || null,
      price: getFirst(tags, ['price', 'precio', 'amount', 'originalprice', 'sale_price', 'rent_price', 'precio_venta', 'precio_alquiler']) || null,
      title: sanitizeImportedTitle(titleRaw) || null,
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
      preserved_source_language: true,
      preferred_language: 'en',
    },
  }

  const prop: ParsedProperty = {
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
    // Storing the whole XML block for every recurring sync is too expensive for large feeds.
    source_raw_xml: null,
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
    const apiKeyHeader = req.headers.get('apikey')?.trim() || ''
    const authToken = authHeader?.replace('Bearer ', '').trim() || ''

    if (!authToken && !apiKeyHeader) {
      return new Response(JSON.stringify({ error: 'No authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: runtimeSettings } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['service_role_key'])

    const configuredServiceRoleKey = Array.isArray(runtimeSettings)
      ? runtimeSettings.find((entry) => entry.key === 'service_role_key')?.value
      : null

    const settingsServiceRoleKey =
      typeof configuredServiceRoleKey === 'string'
        ? configuredServiceRoleKey
        : configuredServiceRoleKey && typeof configuredServiceRoleKey === 'object' && '{}' in configuredServiceRoleKey
          ? String((configuredServiceRoleKey as Record<string, unknown>)['{}'] ?? '')
          : ''

    const internalTokens = new Set([serviceKey, settingsServiceRoleKey].filter(Boolean))
    const isInternalCron = internalTokens.has(authToken) || internalTokens.has(apiKeyHeader)

    if (!isInternalCron) {
      const token = authToken || apiKeyHeader
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

    const results: ImportResult[] = []
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
        const parsedProperties: ParsedProperty[] = []
        for (const block of blocks) {
          const prop = parseProperty(block)
          if (prop) parsedProperties.push(prop)
        }
        console.log(`Parsed ${parsedProperties.length} valid properties`)

        // Feed snapshots should be deterministic by xml_id. If the provider repeats
        // the same listing in one run, keep the latest parsed version only.
        const propertyByXmlId = new Map<string, ParsedProperty>()
        for (const prop of parsedProperties) {
          if (prop?.xml_id) propertyByXmlId.set(prop.xml_id, prop)
        }
        const properties = Array.from(propertyByXmlId.values())
        const duplicateCount = parsedProperties.length - properties.length
        if (duplicateCount > 0) {
          console.log(`Collapsed ${duplicateCount} duplicate rows by xml_id for feed "${feed.name}"`)
        }

        // Fetch existing media data to avoid overwriting with empty values
        const xmlIds = properties.map(p => p.xml_id).filter(Boolean)
        const previousSyncCount = Number(feed.last_sync_count || 0)
        const allowSnapshotShrinkCleanup = requestBody?.allow_snapshot_shrink_cleanup === true
        const { data: existingByXml } = await supabase
          .from('properties')
          // Keep this read lean. Pulling the full historical source payload back into the
          // worker makes large HabiHub imports much heavier and encourages recursive growth.
          .select('id, xml_id, source_url, images, videos, virtual_tour_url, floor_plans')
          .in('xml_id', xmlIds)

        const existingMap = new Map<string, ExistingImportedProperty>()
        for (const ep of (existingByXml as ExistingImportedProperty[] | null) || []) {
          if (!ep?.id) continue
          const normalized: ExistingImportedProperty = {
            id: ep.id,
            xml_id: ep.xml_id,
            source_url: ep.source_url,
            images: ep.images,
            videos: ep.videos,
            virtual_tour_url: ep.virtual_tour_url,
            floor_plans: ep.floor_plans,
          }
          if (ep.xml_id) existingMap.set(ep.xml_id, normalized)
        }

        let upserted = 0
        for (let i = 0; i < properties.length; i += 50) {
          const batch = properties.slice(i, i + 50).map((p) => {
            const existing = existingMap.get(p.xml_id)
            const merged: ParsedProperty & {
              agent_id: null
              owner_id: string
              source: string
              source_feed_id: string
              source_feed_name: string
            } = {
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
            }

            // Always persist the latest normalized payload only. Chaining previous snapshots
            // inside source_metadata causes unbounded row growth across recurring imports.
            merged.source_metadata = {
              ...(merged.source_metadata || {}),
              feed: {
                id: feed.id,
                name: feed.name,
                url: feed.url,
                assignment: 'oficina',
              },
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
          const staleIds = ((existingAll as ExistingImportedPropertyId[] | null) || [])
            .filter((property) => property.xml_id && !feedXmlIdSet.has(property.xml_id))
            .map((property) => property.id)

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
