import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { todayISO } from './lib/taskDates'
import { formatMoney } from './lib/format'

const QUARTERS = [
  { key: 'Q1', months: [0, 1, 2] },
  { key: 'Q2', months: [3, 4, 5] },
  { key: 'Q3', months: [6, 7, 8] },
  { key: 'Q4', months: [9, 10, 11] },
]

function iso(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// The year as twelve months, grouped into quarters. Everything is
// counted from one pass of the data rather than 12 round trips.
function PlanningYear({ start, end, onPickMonth, onPickQuarter }) {
  const [data, setData] = useState(null)
  const [focus, setFocus] = useState(null)
  const [focusDraft, setFocusDraft] = useState('')

  const load = useCallback(async () => {
    const [taskRes, contentRes, invoiceRes, planRes, cycleRes] = await Promise.all([
      supabase.from('tasks').select('id, status, due_date, done_at'),
      supabase
        .from('content_items')
        .select('id, stage, publish_date, posted_at')
        .gte('publish_date', start)
        .lte('publish_date', end),
      supabase.from('invoices').select('id, amount, status, issue_date, paid_date'),
      supabase.from('plan_entries').select('*').eq('horizon', 'year').eq('start_date', start),
      supabase.from('twy_cycles').select('*'),
    ])

    if (taskRes.error) report('Failed to load tasks', taskRes.error)

    const planRows = planRes.error ? [] : planRes.data || []
    const found = planRows.find((row) => row.entry_kind === 'intention') || null
    setFocus(found)
    setFocusDraft(found?.title || '')

    setData({
      tasks: taskRes.data || [],
      content: contentRes.error ? [] : contentRes.data || [],
      invoices: invoiceRes.error ? [] : invoiceRes.data || [],
      cycles: cycleRes.error ? [] : cycleRes.data || [],
    })
  }, [start, end])

  useEffect(() => {
    load()
  }, [load])

  async function saveFocus() {
    const trimmed = focusDraft.trim()

    if (!trimmed) {
      if (!focus) return
      const { error } = await supabase.from('plan_entries').delete().eq('id', focus.id)
      if (error) report('Failed to clear the year focus', error)
      else setFocus(null)
      return
    }

    if (focus) {
      const { error } = await supabase
        .from('plan_entries')
        .update({ title: trimmed })
        .eq('id', focus.id)

      if (error) report('Failed to save the year focus', error)
      else setFocus({ ...focus, title: trimmed })
      return
    }

    const { data: row, error } = await supabase
      .from('plan_entries')
      .insert({
        horizon: 'year',
        start_date: start,
        end_date: end,
        title: trimmed,
        entry_kind: 'intention',
        sort_order: -1,
      })
      .select()
      .single()

    if (error) report('Failed to save the year focus', error)
    else setFocus(row)
  }

  if (!data) return <p className="empty-text">Pulling the year together…</p>

  const year = Number(start.slice(0, 4))
  const today = todayISO()

  const months = Array.from({ length: 12 }, (_, index) => {
    const from = iso(new Date(year, index, 1))
    const to = iso(new Date(year, index + 1, 0))

    const due = data.tasks.filter((task) => task.due_date >= from && task.due_date <= to)
    const finished = data.tasks.filter(
      (task) => task.done_at && task.done_at.slice(0, 10) >= from && task.done_at.slice(0, 10) <= to,
    )
    const posted = data.content.filter(
      (item) => item.posted_at && item.posted_at >= from && item.posted_at <= to,
    )
    const planned = data.content.filter(
      (item) => item.publish_date >= from && item.publish_date <= to,
    )
    const invoiced = data.invoices.filter(
      (invoice) => invoice.issue_date >= from && invoice.issue_date <= to,
    )
    const paid = invoiced
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0)

    const cycle = data.cycles.find(
      (row) => row.start_date <= to && row.start_date >= iso(new Date(year - 1, index, 1)),
    )

    return {
      index,
      from,
      to,
      label: new Date(year, index, 1).toLocaleDateString(undefined, { month: 'long' }),
      short: new Date(year, index, 1).toLocaleDateString(undefined, { month: 'short' }),
      open: due.filter((task) => task.status !== 'done').length,
      finished: finished.length,
      planned: planned.length,
      posted: posted.length,
      paid,
      cycleStart: cycle && cycle.start_date >= from && cycle.start_date <= to ? cycle : null,
      isNow: from <= today && to >= today,
      isPast: to < today,
    }
  })

  const yearFinished = months.reduce((sum, month) => sum + month.finished, 0)
  const yearPosted = months.reduce((sum, month) => sum + month.posted, 0)
  const yearPaid = months.reduce((sum, month) => sum + month.paid, 0)
  const busiest = months.reduce((best, month) => (month.finished > best.finished ? month : best), months[0])

  return (
    <>
      <div className="card intention-card">
        <h2>{year}</h2>
        <p className="list-row-sub">The through-line. One sentence you&apos;d be glad to have kept.</p>
        <input
          type="text"
          className="quick-add-title intention-input"
          value={focusDraft}
          onChange={(e) => setFocusDraft(e.target.value)}
          onBlur={saveFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
          placeholder="What this year is for…"
        />
      </div>

      <div className="review-grid">
        <div className="review-stat">
          <span className="review-stat-value">{yearFinished}</span>
          <span className="review-stat-label">Tasks finished</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{yearPosted}</span>
          <span className="review-stat-label">Posts shipped</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{formatMoney(yearPaid)}</span>
          <span className="review-stat-label">Invoices paid</span>
        </div>
        <div className="review-stat">
          <span className="review-stat-value">{busiest?.short || '—'}</span>
          <span className="review-stat-label">Busiest month</span>
          <span className="review-stat-sub">{busiest?.finished || 0} finished</span>
        </div>
      </div>

      {QUARTERS.map((quarter) => {
        const quarterMonths = months.filter((month) => quarter.months.includes(month.index))
        const quarterStart = quarterMonths[0].from
        const isNow = quarterMonths.some((month) => month.isNow)

        return (
          <div className={`card year-quarter${isNow ? ' now' : ''}`} key={quarter.key}>
            <div className="project-scope-header">
              <h2>{quarter.key}</h2>
              <button
                type="button"
                className="row-action-btn"
                onClick={() => onPickQuarter(quarterStart)}
              >
                Open quarter
              </button>
            </div>

            <div className="year-months">
              {quarterMonths.map((month) => (
                <button
                  key={month.index}
                  type="button"
                  className={`year-month${month.isNow ? ' now' : ''}${
                    month.isPast ? ' past' : ''
                  }`}
                  onClick={() => onPickMonth(month.from)}
                >
                  <span className="year-month-name">
                    {month.label}
                    {month.cycleStart && <span className="year-month-cycle">cycle starts</span>}
                  </span>

                  <span className="year-month-rows">
                    {month.open > 0 && (
                      <span className="year-month-row">
                        <span className="year-month-figure">{month.open}</span> open
                      </span>
                    )}
                    {month.finished > 0 && (
                      <span className="year-month-row">
                        <span className="year-month-figure">{month.finished}</span> done
                      </span>
                    )}
                    {month.planned > 0 && (
                      <span className="year-month-row">
                        <span className="year-month-figure">{month.planned}</span> posts
                      </span>
                    )}
                    {month.paid > 0 && (
                      <span className="year-month-row paid">{formatMoney(month.paid)}</span>
                    )}
                    {month.open === 0 &&
                      month.finished === 0 &&
                      month.planned === 0 &&
                      month.paid === 0 && <span className="year-month-row quiet">—</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </>
  )
}

export default PlanningYear
