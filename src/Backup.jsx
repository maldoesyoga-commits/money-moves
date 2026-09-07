import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'

// Every table Homestead owns. Missing ones (module SQL not run yet)
// are reported as skipped rather than failing the whole backup.
const TABLES = [
  'settings',
  'accounts',
  'categories',
  'transactions',
  'income_events',
  'savings_funds',
  'fund_entries',
  'debts',
  'debt_entries',
  'subscriptions',
  'documents',
  'projects',
  'tasks',
  'plan_entries',
  'goals',
  'learning_items',
  'learning_notes',
  'content_items',
  'clients',
  'freelance_projects',
  'time_entries',
  'invoices',
  'meals',
  'meal_plan',
  'grocery_items',
  'notes',
  'journal_entries',
  'tags',
  'taggings',
  'daily_logs',
  'habits',
  'habit_logs',
  'mood_words',
  'twy_cycles',
  'twy_goals',
  'twy_tactics',
  'twy_tactic_logs',
  'time_blocks',
  'focus_sessions',
  'category_budgets',
]

function download(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

function toCsv(rows) {
  if (rows.length === 0) return ''

  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))]

  const escape = (value) => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  const lines = [columns.join(',')]
  rows.forEach((row) => lines.push(columns.map((column) => escape(row[column])).join(',')))
  return lines.join('\n')
}

function Backup() {
  const [counts, setCounts] = useState(null)
  const [working, setWorking] = useState(false)
  const [message, setMessage] = useState(null)

  const loadCounts = useCallback(async () => {
    const results = await Promise.all(
      TABLES.map(async (table) => {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true })

        if (error) return [table, null]
        return [table, count ?? 0]
      }),
    )

    setCounts(Object.fromEntries(results))
  }, [])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  async function fetchAll() {
    const dump = {}
    const skipped = []

    for (const table of TABLES) {
      const { data, error } = await supabase.from(table).select('*')

      if (error) {
        skipped.push(table)
        continue
      }

      dump[table] = data || []
    }

    return { dump, skipped }
  }

  async function handleJson() {
    setWorking(true)
    setMessage(null)

    const { dump, skipped } = await fetchAll()
    const rows = Object.values(dump).reduce((sum, list) => sum + list.length, 0)

    download(
      `homestead-backup-${todayISO()}.json`,
      JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }, null, 2),
      'application/json',
    )

    setWorking(false)
    setMessage(
      `Saved ${rows} rows across ${Object.keys(dump).length} tables.` +
        (skipped.length ? ` Skipped: ${skipped.join(', ')}.` : ''),
    )
  }

  async function handleCsvBundle() {
    setWorking(true)
    setMessage(null)

    const { dump } = await fetchAll()
    let files = 0

    // One CSV per non-empty table, downloaded in sequence.
    for (const [table, rows] of Object.entries(dump)) {
      if (rows.length === 0) continue
      download(`homestead-${table}-${todayISO()}.csv`, toCsv(rows), 'text/csv')
      files += 1
      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    setWorking(false)
    setMessage(`Saved ${files} CSV file${files === 1 ? '' : 's'}.`)
  }

  const known = counts
    ? Object.entries(counts).filter(([, count]) => count !== null && count > 0)
    : []
  const totalRows = known.reduce((sum, [, count]) => sum + count, 0)

  return (
    <section className="backup-module">
      <div className="home-greeting">
        <h1>Backup</h1>
        <p className="list-row-sub">Your data, on your own disk.</p>
      </div>

      <div className="card">
        <div className="total-row">
          <p>Everything in Homestead</p>
          <span className="money">{totalRows} rows</span>
        </div>

        <p className="list-row-sub">
          The JSON file is the real backup — it holds every table, exactly as stored. The CSVs are
          for opening in Excel; they lose the links between tables.
        </p>

        <div className="field-row backup-actions">
          <button type="button" onClick={handleJson} disabled={working}>
            {working ? 'Working…' : 'Download JSON backup'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={handleCsvBundle}
            disabled={working}
          >
            Download CSVs
          </button>
        </div>

        {message && <p className="list-row-sub backup-message">{message}</p>}
      </div>

      <div className="card">
        <h2>What's in there</h2>
        {counts === null ? (
          <p className="empty-text">Counting…</p>
        ) : known.length === 0 ? (
          <p className="empty-text">Nothing saved yet.</p>
        ) : (
          <ul className="list">
            {known.map(([table, count]) => (
              <li key={table} className="list-row">
                <span className="list-row-title">{table.replace(/_/g, ' ')}</span>
                <span className="money">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

export default Backup
