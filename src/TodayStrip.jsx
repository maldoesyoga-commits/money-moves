import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { todayISO } from './lib/taskDates'
import { periodRange } from './lib/planPeriods'

// Every read here is best-effort: a module whose SQL hasn't been run yet
// just contributes nothing instead of breaking the hub.
async function safeSelect(table, build) {
  const query = build(supabase.from(table).select('*'))
  const { data, error } = await query

  if (error) {
    console.log(`Today strip skipped ${table}`, error.message)
    return []
  }

  return data || []
}

function TodayStrip() {
  const [lines, setLines] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const today = todayISO()
      const { start: weekStart, end: weekEnd } = periodRange('week', today)

      const [tasks, planned, meals, invoices, content] = await Promise.all([
        safeSelect('tasks', (q) => q.neq('status', 'done').lte('due_date', today)),
        safeSelect('meal_plan', (q) => q.eq('plan_date', today)),
        safeSelect('meals', (q) => q),
        safeSelect('invoices', (q) => q.eq('status', 'sent')),
        safeSelect('content_items', (q) =>
          q.gte('publish_date', weekStart).lte('publish_date', weekEnd).neq('stage', 'posted'),
        ),
      ])

      if (cancelled) return

      const next = []

      if (tasks.length > 0) {
        const overdue = tasks.filter((task) => task.due_date < today).length
        next.push({
          key: 'tasks',
          to: '/tasks',
          label: `${tasks.length} task${tasks.length === 1 ? '' : 's'} due`,
          detail: overdue > 0 ? `${overdue} overdue` : tasks[0].title,
          urgent: overdue > 0,
        })
      }

      if (planned.length > 0) {
        const names = planned.map(
          (row) => row.custom_title || meals.find((meal) => meal.id === row.meal_id)?.name || 'Meal',
        )
        next.push({
          key: 'meals',
          to: '/meals',
          label: 'Tonight',
          detail: names.join(', '),
        })
      }

      const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0)
      if (outstanding > 0) {
        const late = invoices.filter(
          (invoice) => invoice.due_date && invoice.due_date < today,
        ).length
        next.push({
          key: 'invoices',
          to: '/freelance/invoices',
          label: `${formatMoney(outstanding)} outstanding`,
          detail: late > 0 ? `${late} past due` : `${invoices.length} sent`,
          urgent: late > 0,
        })
      }

      if (content.length > 0) {
        next.push({
          key: 'content',
          to: '/content',
          label: `${content.length} post${content.length === 1 ? '' : 's'} to ship`,
          detail: 'this week',
        })
      }

      setLines(next)
      setLoaded(true)
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (!loaded || lines.length === 0) return null

  return (
    <div className="today-strip">
      {lines.map((line) => (
        <Link key={line.key} to={line.to} className="today-chip">
          <span className={`today-chip-label${line.urgent ? ' urgent' : ''}`}>{line.label}</span>
          <span className="today-chip-detail">{line.detail}</span>
        </Link>
      ))}
    </div>
  )
}

export default TodayStrip
