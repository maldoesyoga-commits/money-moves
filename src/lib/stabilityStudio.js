// Stability Studio framework — Mal's recovery-informed "gentle structure lab".
// Sourced from the Stability Studio Framework doc. Rendered as an in-app
// reference in the Brand module. Content only; no logic here.

export const SS_DOC_URL =
  'https://docs.google.com/document/d/1R6yM_vRe9gdxnWv-J7SznMMcOHBQlzMpuWz-sHI9wA8/edit'

export const SS_INTRO = {
  tagline: 'Where messy minds stabilize.',
  what:
    'A seasonal, shame-free skill space helping messy minds move from chaos to calm through community, gentle systems, and embodied tools.',
  north:
    'You don’t need to become exceptional. You need to become steady. And steadiness is radical when you’ve lived in chaos.',
}

export const SS_TRUTHS = [
  { title: 'Messy minds need containers, not criticism.', note: 'Structure should feel like safety, not pressure.' },
  { title: 'Regulation comes before routine.', note: 'If the nervous system isn’t stable, no planner will work.' },
  { title: 'Tiny consistency beats intense bursts.', note: 'Stability is built in micro-commitments.' },
  { title: 'Growth must match capacity.', note: 'No forced scaling. No rushing.' },
  { title: 'Your life has limbs.', note: 'You don’t balance life — you tend to your limbs.' },
]

// The Limbs We Live — life framed as a body. Each limb is tended, not perfected.
export const SS_LIMBS = [
  { key: 'mind', icon: '🧠', label: 'Mind' },
  { key: 'emotions', icon: '❤️', label: 'Emotions' },
  { key: 'shelter', icon: '🏠', label: 'Shelter / Environment' },
  { key: 'survival', icon: '💰', label: 'Survival / Money' },
  { key: 'connection', icon: '🤝', label: 'Connection' },
  { key: 'recovery', icon: '🌗', label: 'Recovery' },
  { key: 'growth', icon: '🌿', label: 'Growth' },
  { key: 'expression', icon: '🎨', label: 'Expression' },
  { key: 'purpose', icon: '🔥', label: 'Purpose' },
]

// Tap-through states for the limbs check-in (private, saved in the browser).
export const SS_LIMB_STATES = [
  { value: 'unset', label: 'Tap to set' },
  { value: 'strong', label: 'Strong' },
  { value: 'rebuilding', label: 'Rebuilding' },
  { value: 'injured', label: 'Needs care' },
]

export const SS_PHASES = [
  {
    key: 'land',
    name: 'Land',
    theme: 'Grounding',
    focus: 'Stop spiraling.',
    outcome: 'I can land here.',
    tools: ['Messy brain dump', 'Daily check-in', '3-task rule', 'Safe dashboard', 'Weekly soft reset'],
  },
  {
    key: 'root',
    name: 'Root',
    theme: 'Structure',
    focus: 'Build steadiness.',
    outcome: 'I can trust myself a little.',
    tools: ['Limb mapping', 'Gentle routines', 'Energy tracking', 'Light project container', 'Weekly reflection'],
  },
  {
    key: 'grow',
    name: 'Grow',
    theme: 'Expansion',
    focus: 'Create without destabilizing yourself.',
    outcome: 'I can build without breaking.',
    tools: ['Creative rhythm', 'Income mapping (gentle)', 'Content container', 'Purpose mapping', 'Seasonal planning'],
  },
]

export const SS_SEASON_ONE = {
  name: 'Season One — Awareness',
  promise:
    'Season One helps messy minds build awareness of their patterns, capacity, and emotional rhythms — without shame. It’s about noticing without judgment.',
  pillars: [
    {
      title: 'Capacity Awareness',
      prompts: ['Low / Medium / High check-ins', 'Energy tracking', '“What kind of day is this?”'],
    },
    {
      title: 'Pattern Awareness',
      prompts: ['What happens before I spiral?', 'When do I ghost my systems?', 'What does shame feel like in my body?'],
    },
    {
      title: 'Emotional Awareness',
      prompts: ['Naming feelings', 'Trigger mapping', '“What do I need right now?”'],
    },
    {
      title: 'System Awareness',
      prompts: ['What tools actually support me?', 'What tools shame me?'],
    },
  ],
}

export const SS_TONE = [
  'A warm desk lamp in a dark room.',
  'A notebook that doesn’t judge you.',
  'A friend who understands relapse and reset.',
  'A system that expects imperfection.',
]
