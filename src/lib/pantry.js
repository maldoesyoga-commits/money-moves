import { supabase } from './supabase'

export const AISLES = [
  { value: 'produce', label: 'Produce' },
  { value: 'protein', label: 'Protein' },
  { value: 'dairy', label: 'Dairy' },
  { value: 'pantry', label: 'Pantry' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'household', label: 'Household' },
  { value: 'other', label: 'Other' },
]

export const STATUSES = [
  { value: 'have', label: 'Have it', short: 'Have' },
  { value: 'low', label: 'Running low', short: 'Low' },
  { value: 'out', label: 'Out', short: 'Out' },
]

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]))

export function statusTone(status) {
  if (status === 'have') return 'score-good'
  if (status === 'low') return 'score-ok'
  return 'score-low'
}

// An item belongs on the shopping list when you're out of it, running low on a
// staple, or a recipe check has flagged it. "Low" on something you rarely use
// isn't urgent, so it only shows when you ask for it.
export function onShoppingList(item) {
  if (item.needed) return true
  if (item.status === 'out') return true
  if (item.status === 'low' && item.staple) return true
  return false
}

export function normalise(name) {
  return name.trim().toLowerCase()
}

// Find a pantry row by name or create one. Used when typing an ingredient into
// a recipe — the ingredient and the shopping-list row are the same record.
export async function ensurePantryItem(name, { aisle = 'other', status = 'out' } = {}) {
  const trimmed = name.trim()
  if (!trimmed) return { error: new Error('empty name') }

  const { data: existing, error: findError } = await supabase
    .from('pantry_items')
    .select('*')
    .ilike('name', trimmed)
    .limit(1)

  if (findError) return { error: findError }
  if (existing?.length) return { item: existing[0], created: false }

  const { data, error } = await supabase
    .from('pantry_items')
    .insert({ name: trimmed, aisle, status })
    .select()
    .single()

  if (error) return { error }
  return { item: data, created: true }
}

// Compare a meal's ingredients against the pantry and flag what's missing.
// Nothing is deleted or duplicated — the same permanent rows just change state.
export async function checkMealAgainstPantry(meal, ingredients, pantryById) {
  const missing = ingredients
    .filter((row) => !row.optional)
    .map((row) => pantryById[row.pantry_item_id])
    .filter((item) => item && item.status !== 'have')

  if (missing.length === 0) return { missing: [], flagged: 0 }

  const { error } = await supabase
    .from('pantry_items')
    .update({ needed: true, needed_note: meal.name, updated_at: new Date().toISOString() })
    .in(
      'id',
      missing.map((item) => item.id),
    )

  if (error) return { error }

  return { missing, flagged: missing.length }
}
