function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripUrls(value: string): string {
  return value.replace(/https?:\/\/\S+/gi, ' ');
}

function stripNoise(value: string): string {
  return value
    .replace(/\bnot-available\b/gi, ' ')
    .replace(/\bundefined\b/gi, ' ')
    .replace(/\bnull\b/gi, ' ');
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function sanitizePropertyTitle(value: unknown, fallback = 'Inmueble sin titulo'): string {
  if (typeof value !== 'string') return fallback;

  const cleaned = collapseWhitespace(stripNoise(stripUrls(decodeHtmlEntities(value))));
  if (!cleaned) return fallback;

  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0]?.trim() || cleaned;
  const candidate = firstSentence.length >= 8 ? firstSentence : cleaned;

  return candidate.slice(0, 140).trim() || fallback;
}
