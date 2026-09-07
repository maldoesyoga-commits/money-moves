export const BRANDS = [
  { value: 'cm', label: 'Creating Mal' },
  { value: 'hh', label: 'Hope Heals' },
  { value: 'om', label: 'Ollie & Me' },
  { value: 'other', label: 'Other' },
]

export const BRAND_LABEL = Object.fromEntries(BRANDS.map((brand) => [brand.value, brand.label]))

export function formatHours(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest}m`
  if (!rest) return `${hours}h`
  return `${hours}h ${rest}m`
}

export function parseDuration(input) {
  const text = String(input).trim().toLowerCase()
  if (!text) return 0

  const hhmm = text.match(/^(\d+):(\d{1,2})$/)
  if (hhmm) return Number(hhmm[1]) * 60 + Number(hhmm[2])

  const parts = text.match(/(\d+(?:\.\d+)?)\s*(h|m)?/g)
  if (!parts) return 0

  let minutes = 0
  let matchedUnit = false

  parts.forEach((part) => {
    const value = Number(part.match(/\d+(?:\.\d+)?/)[0])
    if (part.includes('h')) {
      minutes += value * 60
      matchedUnit = true
    } else if (part.includes('m')) {
      minutes += value
      matchedUnit = true
    } else if (!matchedUnit) {
      // A bare number means hours: "2" and "1.5" are both hours.
      minutes += value * 60
    }
  })

  return Math.round(minutes)
}
