const MONTH_MAP = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
}

const AMOUNT_REGEX = /\(?-?\$?\s?\d{1,3}(?:,\d{3})*\.\d{2}\)?/g

function pad2(value) {
  return String(value).padStart(2, '0')
}

function expandYear(yearStr) {
  if (yearStr.length === 4) return yearStr
  const num = Number(yearStr)
  return String(num < 70 ? 2000 + num : 1900 + num)
}

function normalizeDate(yearStr, monthStr, dayStr) {
  const year = expandYear(String(yearStr))
  const month = Number(monthStr)
  const day = Number(dayStr)
  if (!month || !day || month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

function monthNameDate(monthName, dayStr, yearStr) {
  const key = monthName.slice(0, 3).toLowerCase()
  const month = MONTH_MAP[key]
  if (!month) return null
  const year = yearStr ? yearStr : String(new Date().getFullYear())
  return normalizeDate(year, month, dayStr)
}

const DATE_PATTERNS = [
  {
    regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/,
    parse: (m) => normalizeDate(m[1], m[2], m[3]),
  },
  {
    regex: /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/,
    parse: (m) => normalizeDate(m[3], m[1], m[2]),
  },
  {
    regex: /\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?\b/,
    parse: (m) => monthNameDate(m[1], m[2], m[3]),
  },
  {
    regex: /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?,?\s*(\d{4})?\b/,
    parse: (m) => monthNameDate(m[2], m[1], m[3]),
  },
]

function findDateMatch(line) {
  let best = null
  for (const pattern of DATE_PATTERNS) {
    const match = line.match(pattern.regex)
    if (!match) continue
    if (best !== null && match.index >= best.index) continue
    const parsed = pattern.parse(match)
    if (parsed) best = { raw: match[0], index: match.index, parsed }
  }
  return best
}

function findAmountMatch(line) {
  const matches = [...line.matchAll(AMOUNT_REGEX)]
  if (matches.length === 0) return null
  const match = matches[matches.length - 1]
  const numeric = match[0].replace(/[^0-9.]/g, '')
  const value = Number(numeric)
  if (Number.isNaN(value)) return null
  return { raw: match[0], index: match.index, value: Math.abs(value) }
}

function parseLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null

  const dateMatch = findDateMatch(trimmed)
  if (!dateMatch) return null

  const amountMatch = findAmountMatch(trimmed)
  if (!amountMatch) return null

  const ranges = [
    { start: dateMatch.index, end: dateMatch.index + dateMatch.raw.length },
    { start: amountMatch.index, end: amountMatch.index + amountMatch.raw.length },
  ].sort((a, b) => a.start - b.start)

  let description = ''
  let cursor = 0
  for (const range of ranges) {
    description += trimmed.slice(cursor, range.start)
    cursor = Math.max(cursor, range.end)
  }
  description += trimmed.slice(cursor)
  description = description
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[-–—,:|\s]+|[-–—,:|\s]+$/g, '')
    .trim()

  return {
    txn_date: dateMatch.parsed,
    description: description || 'Imported transaction',
    amount: amountMatch.value,
  }
}

export function parseStatementText(text) {
  if (!text) return []

  return text
    .split(/\r?\n/)
    .map((line) => parsePipeRow(line.trim()) || parseLine(line))
    .filter(Boolean)
}

function parsePipeRow(line) {
  const parts = line.split('|').map((part) => part.trim())
  if (parts.length < 4) return null

  const [dateStr, amountStr, directionStr, ...descriptionParts] = parts

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

  const amount = Number(amountStr)
  if (Number.isNaN(amount) || amount <= 0) return null

  const direction = directionStr.toLowerCase()
  if (direction !== 'in' && direction !== 'out') return null

  const description = descriptionParts.join('|').trim()

  return {
    txn_date: dateStr,
    amount,
    direction,
    description: description || 'Imported transaction',
  }
}

export function parsePipeRows(text) {
  if (!text) return []

  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => parsePipeRow(line))
    .filter(Boolean)
}
