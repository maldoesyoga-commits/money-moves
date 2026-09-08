// Static brand kit data for the Brand module.
// Creating Mal (cm) is fully populated from the Creating Mal brand kit.
// Hope Heals (hh) and Ollie & Me (om) are stubbed until we pull their kits in.
// Editable pieces (fonts, logo URLs, tagline overrides) live in the Supabase
// `brand_kit` table and layer on top of these constants.

export const BRANDS = [
  { value: 'cm', label: 'Creating Mal', short: 'CM' },
  { value: 'hh', label: 'Hope Heals', short: 'HH' },
  { value: 'om', label: 'Ollie & Me', short: 'OM' },
]

export const BRAND_KITS = {
  cm: {
    name: 'Creating Mal',
    tagline: "We don't let shame live here anymore.",
    ready: true,
    // 'Hanging' is Mal's title font (self-hosted once the file is added);
    // Lora is the loaded fallback + body font.
    headingFont: "'Hanging', 'Lora', Georgia, serif",
    bodyFont: "'Lora', Georgia, serif",
    palette: [
      { name: 'Soft Sand', hex: '#F6EFE7', note: 'warmth, safety, foundation' },
      { name: 'Muted Terracotta', hex: '#C97A63', note: 'grounding, earth, realness' },
      { name: 'Dusty Rose', hex: '#D9A6A1', note: 'softness, vulnerability, compassion' },
      { name: 'Olive Clay', hex: '#8A8F73', note: 'stability, nature, calm' },
      { name: 'Deep Charcoal', hex: '#2F2E2E', note: 'depth, grounding, contrast' },
    ],
    pillars: [
      'Messy Brain Tools',
      'Gentle Systems & Soft Productivity',
      'Templates That Hold You',
      'The Recovery Diaries',
      'Creating Mal: The Story',
      'The Limbs We Live',
    ],
    voice: {
      aligned: [
        'soft', 'gentle', 'grounded', 'regulate', 'anchor', 'reset', 'reflect',
        'unfold', 'stability', 'messy', 'real', 'recovery', 'non-linear',
        'small steps', 'safe', 'being', 'becoming', 'still here', 'allowed', 'enough',
      ],
      banned: [
        'hustle', 'grind', 'optimize', 'fix yourself', 'should', 'must',
        'just do it', 'bounce back', 'push through', 'failing', 'failed', 'failure',
        'overcome', 'conquer', 'warrior', 'battle',
      ],
    },
    hashtagStrategy:
      'Aim for 10–15 per post — mix niche + broad, and always include #creatingmal.',
  },
  hh: {
    name: 'Hope Heals',
    tagline: '',
    ready: false,
    headingFont: '',
    bodyFont: '',
    palette: [],
    pillars: [],
    voice: { aligned: [], banned: [] },
    hashtagStrategy: '',
  },
  om: {
    name: 'Ollie & Me',
    tagline: '',
    ready: false,
    headingFont: '',
    bodyFont: '',
    palette: [],
    pillars: [],
    voice: { aligned: [], banned: [] },
    hashtagStrategy: '',
  },
}
