// Keyboard layout swap + phonetic transliteration
// Handles: "Lysghj Fqktyl" → "Дніпро Айленд"  (typed Ukrainian with EN layout active)
//          "Dnipro Island" → "Дніпро Айленд"   (English phonetic)

// ── EN keyboard → Ukrainian characters (user typed UA text with EN layout) ────
const EN_TO_UK: Record<string, string> = {
  q:'й', w:'ц', e:'у', r:'к', t:'е', y:'н', u:'г', i:'ш', o:'щ', p:'з',
  '[':'х', ']':'ї', '\\':'ґ',
  a:'ф', s:'і', d:'в', f:'а', g:'п', h:'р', j:'о', k:'л', l:'д',
  ';':'ж', "'":'є',
  z:'я', x:'ч', c:'с', v:'м', b:'и', n:'т', m:'ь', ',':'б', '.':'ю',
  // uppercase
  Q:'Й', W:'Ц', E:'У', R:'К', T:'Є', Y:'Н', U:'Г', I:'Ш', O:'Щ', P:'З',
  '{':'Х', '}':'Ї', '|':'Ґ',
  A:'Ф', S:'І', D:'В', F:'А', G:'П', H:'Р', J:'О', K:'Л', L:'Д',
  ':':'Ж', '"':'Є',
  Z:'Я', X:'Ч', C:'С', V:'М', B:'И', N:'Т', M:'Ь', '<':'Б', '>':'Ю',
}

// ── Ukrainian characters → EN keyboard (user typed EN text with UA layout) ────
const UK_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(EN_TO_UK).map(([en, uk]) => [uk, en])
)

// ── Phonetic EN → Ukrainian (standard Ukrainian transliteration) ────────────
// Multi-char sequences must come before single-char equivalents
const PHONETIC_MAP: [RegExp, string][] = [
  [/shch/gi, 'щ'], [/sch/gi, 'щ'],
  [/sh/gi, 'ш'], [/ch/gi, 'ч'],
  [/zh/gi, 'ж'], [/kh/gi, 'х'],
  [/ts/gi, 'ц'],
  [/yu/gi, 'ю'], [/iu/gi, 'ю'],
  [/ya/gi, 'я'], [/ia/gi, 'я'],
  [/ye/gi, 'є'], [/yi/gi, 'ї'],
  [/\byo\b/gi, 'ьо'], [/yo/gi, 'йо'],
  [/\by/gi, 'й'],   // y at word start → й
  [/y/gi, 'й'],
  [/a/gi, 'а'], [/b/gi, 'б'], [/v/gi, 'в'],
  [/g/gi, 'г'], [/d/gi, 'д'], [/e/gi, 'е'],
  [/z/gi, 'з'], [/i/gi, 'і'], [/k/gi, 'к'],
  [/l/gi, 'л'], [/m/gi, 'м'], [/n/gi, 'н'],
  [/o/gi, 'о'], [/p/gi, 'п'], [/r/gi, 'р'],
  [/s/gi, 'с'], [/t/gi, 'т'], [/u/gi, 'у'],
  [/f/gi, 'ф'], [/h/gi, 'х'],
  [/x/gi, 'кс'], [/c/gi, 'с'],  // fallback
  [/w/gi, 'в'], [/q/gi, 'к'],
]

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Swap each character through the mapping table, preserve spaces */
function applyCharMap(text: string, map: Record<string, string>): string {
  return text.split('').map((ch) => map[ch] ?? ch).join('')
}

/** Check what fraction of chars are Latin (a-z A-Z) */
function latinRatio(text: string): number {
  const letters = text.replace(/\s/g, '')
  if (!letters.length) return 0
  const latin = letters.match(/[a-zA-Z]/g)?.length ?? 0
  return latin / letters.length
}

/** Check what fraction of chars are Cyrillic */
function cyrillicRatio(text: string): number {
  const letters = text.replace(/\s/g, '')
  if (!letters.length) return 0
  const cyr = letters.match(/[а-яёіїєґА-ЯЁІЇЄҐ]/g)?.length ?? 0
  return cyr / letters.length
}

/** Apply phonetic transliteration to a single word */
function phoneticWord(word: string): string {
  let result = word.toLowerCase()
  for (const [re, replacement] of PHONETIC_MAP) {
    result = result.replace(re, replacement)
  }
  // Restore capitalisation for first letter
  if (word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase()) {
    result = result[0].toUpperCase() + result.slice(1)
  }
  return result
}

function phoneticToUa(text: string): string {
  return text.split(/(\s+)/).map((token) =>
    /^\s+$/.test(token) ? token : phoneticWord(token)
  ).join('')
}

// ── Public API ────────────────────────────────────────────────────────────────

export type NormalizedQuery = {
  text: string
  method: 'keyboard_swap' | 'phonetic' | 'original'
  label: string   // human-readable description
}

/**
 * Detect query encoding/layout issues and return normalised variants.
 * Returns null if query looks fine as-is.
 */
export function detectAndNormalize(raw: string): NormalizedQuery | null {
  if (!raw.trim()) return null

  const lr = latinRatio(raw)
  const cr = cyrillicRatio(raw)

  // Already Cyrillic — no transformation needed
  if (cr > 0.7) return null

  if (lr > 0.7) {
    // All-Latin input. Two strategies:

    // 1. Try keyboard swap: "Lysghj" → "Дніпро"
    const swapped = applyCharMap(raw, EN_TO_UK)
    const swappedCr = cyrillicRatio(swapped)
    if (swappedCr > 0.7) {
      return { text: swapped, method: 'keyboard_swap', label: 'Розкладка клавіатури' }
    }

    // 2. Phonetic: "Dnipro" → "Дніпро"
    const phonetic = phoneticToUa(raw)
    return { text: phonetic, method: 'phonetic', label: 'Фонетика' }
  }

  // Mixed — try swap and see
  const swapped = applyCharMap(raw, EN_TO_UK)
  if (cyrillicRatio(swapped) > 0.6) {
    return { text: swapped, method: 'keyboard_swap', label: 'Розкладка клавіатури' }
  }

  return null
}

/**
 * Return all search query variants to try: original + any normalised form.
 */
export function queryVariants(raw: string): string[] {
  const variants: string[] = [raw.trim()]
  const norm = detectAndNormalize(raw)
  if (norm && norm.text !== raw.trim()) {
    variants.push(norm.text)
  }
  return [...new Set(variants)]
}
