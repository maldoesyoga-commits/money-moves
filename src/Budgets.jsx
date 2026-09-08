import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { formatMoney } from './lib/format'
import { usePeriod } from './usePeriod'
import {
  getPeriodContaining,
  getPreviousPeriod,
  getRecentPeriods,
  periodLabel,
  periodShortLabel,
} from './lib/period'
import { isSpendingTxn } from './lib/spending'
import EmptyState from './EmptyState'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

const LOOKBACK = 6

const SAGE = '#3F6B5C'
const CLAY = '#B87333'
const TEXT_SOFT = '#6E7A75'
const BORDER = '#E1E2DC'

const CHART_TOOLTIP = {
  background: '#fbfaf6',
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  fontSize: 13,
}

function Budgets() {
  const { period, statementDay } = usePeriod()

  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState([])
  const [txns, setTxns] = useState([])
  const [drafts, setDrafts] = useState({})
  const [showAll, setShowAll] = useState(false)
  const [expandedCat, setExpandedCat] = useState(null)

  const load = useCallback(async () => {
    const { data: categoryRows, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .order('category_group')
      .order('name')

    if (categoryError) {
      report('Failed to load categories', categoryError)
      return
    }

    setCategories(categoryRows)

    const { data: budgetRows, error: budgetError } = await supabase
      .from('category_budgets')
      .select('*')

    if (budgetError) {
      report('Failed to load budgets', budgetError)
      return
    }

    setBudgets(budgetRows)

    const { data: txnRows, error: txnError } = await supabase
      .from('transactions')
      .select('*')

    if (txnError) {
      report('Failed to load transactions', txnError)
      return
    }

    setTxns(txnRows)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const periods = useMemo(
    () => getRecentPeriods(period, statementDay, LOOKBACK),
    [period, statementDay],
  )

  function budgetFor(categoryId, startKey) {
    const row = budgets.find(
      (budget) => budget.category_id === categoryId && budget.period_start === startKey,
    )
    return row ? Number(row.amount) : null
  }

  function spentIn(categoryId, range) {
    return txns
      .filter(
        (txn) =>
          txn.category_id === categoryId &&
          isSpendingTxn(txn) &&
          txn.txn_date >= range.startKey &&
          txn.txn_date <= range.endKey,
      )
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  }

  // Average actual spend across the previous periods that had any activity —
  // the number worth looking at when deciding what to budget.
  function averageFor(categoryId) {
    const past = periods.filter((row) => row.startKey !== period.startKey)
    const values = past.map((row) => spentIn(categoryId, row)).filter((value) => value > 0)
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }

  async function saveBudget(categoryId, value) {
    const amount = Number(value)

    if (!value || Number.isNaN(amount) || amount <= 0) {
      const existing = budgets.find(
        (budget) => budget.category_id === categoryId && budget.period_start === period.startKey,
      )
      if (!existing) return

      setBudgets((prev) => prev.filter((budget) => budget.id !== existing.id))
      const { error } = await supabase.from('category_budgets').delete().eq('id', existing.id)
      if (error) report('Failed to clear the budget', error)
      return
    }

    const { data, error } = await supabase
      .from('category_budgets')
      .upsert(
        {
          category_id: categoryId,
          period_start: period.startKey,
          amount,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category_id,period_start' },
      )
      .select()
      .single()

    if (error) {
      report('Failed to save the budget', error)
      return
    }

    setBudgets((prev) => [
      ...prev.filter(
        (budget) =>
          !(budget.category_id === categoryId && budget.period_start === period.startKey),
      ),
      data,
    ])
  }

  async function copyPrevious() {
    const previous = getPreviousPeriod(period, statementDay)
    const source = budgets.filter((budget) => budget.period_start === previous.startKey)

    if (source.length === 0) {
      report('Nothing to copy', { message: 'The previous period has no budget set.' })
      return
    }

    const { error } = await supabase.from('category_budgets').upsert(
      source.map((budget) => ({
        category_id: budget.category_id,
        period_start: period.startKey,
        amount: budget.amount,
      })),
      { onConflict: 'user_id,category_id,period_start' },
    )

    if (error) {
      report('Failed to copy last period', error)
      return
    }

    setDrafts({})
    load()
  }

  async function useAverages() {
    const rows = categories
      .map((category) => ({ category, average: averageFor(category.id) }))
      .filter((row) => row.average !== null)
      .map((row) => ({
        category_id: row.category.id,
        period_start: period.startKey,
        amount: Math.round(row.average),
      }))

    if (rows.length === 0) return

    const { error } = await supabase
      .from('category_budgets')
      .upsert(rows, { onConflict: 'user_id,category_id,period_start' })

    if (error) {
      report('Failed to apply averages', error)
      return
    }

    setDrafts({})
    load()
  }

  const rows = categories
    .map((category) => ({
      category,
      budget: budgetFor(category.id, period.startKey),
      spent: spentIn(category.id, period),
      average: averageFor(category.id),
    }))
    .filter((row) => showAll || row.budget !== null || row.spent > 0)

  const totalBudget = rows.reduce((sum, row) => sum + (row.budget || 0), 0)
  const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0)
  const left = totalBudget - totalSpent

  const groups = [...new Set(rows.map((row) => row.category.category_group || 'Other'))]

  const budgetTrend = periods.map((row) => {
    const budgeted = budgets
      .filter((budget) => budget.period_start === row.startKey)
      .reduce((sum, budget) => sum + Number(budget.amount), 0)
    const actual = categories.reduce((sum, category) => sum + spentIn(category.id, row), 0)
    return { label: periodShortLabel(row, statementDay), budget: budgeted, actual }
  })
  const hasBudgetTrend = budgetTrend.some((entry) => entry.budget > 0 || entry.actual > 0)

  return (
    <section className="budgets-page">
      <div className="card">
        <div className="project-scope-header">
          <h2>Budget</h2>
          <span className="list-row-sub">{periodLabel(period, statementDay)}</span>
        </div>

        <div className="total-row">
          <p>{formatMoney(totalSpent)} of {formatMoney(totalBudget)}</p>
          <span className={`money ${left < 0 ? 'over' : ''}`}>
            {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`}
          </span>
        </div>

        <div className="progress-track">
          <div
            className={`progress-fill${totalSpent > totalBudget ? ' progress-fill-over' : ''}`}
            style={{
              width: `${totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0}%`,
            }}
          />
        </div>

        <div className="budget-actions">
          <button type="button" className="btn-secondary" onClick={copyPrevious}>
            Copy last period
          </button>
          <button type="button" className="row-action-btn" onClick={useAverages}>
            Use my averages
          </button>
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
            />
            Show every category
          </label>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="🧮" title="No budget for this period yet">
            Tick &ldquo;show every category&rdquo; and put a number against the ones you want
            to watch — or hit <strong>Use my averages</strong> to start from what you
            actually spend.
          </EmptyState>
        </div>
      ) : (
        groups.map((group) => {
          const groupRows = rows.filter(
            (row) => (row.category.category_group || 'Other') === group,
          )

          return (
            <div className="card" key={group}>
              <h3 className="budget-group-title">{group}</h3>

              <ul className="list">
                {groupRows.map(({ category, budget, spent, average }) => {
                  const pct = budget ? Math.min(100, Math.round((spent / budget) * 100)) : null
                  const over = budget !== null && spent > budget

                  return (
                    <li key={category.id} className="list-row budget-row">
                      <div className="budget-row-top">
                        <span className="list-row-title">{category.name}</span>
                        <div className="budget-inputs">
                          <span className="list-row-sub">{formatMoney(spent)} spent</span>
                          <input
                            type="number"
                            step="1"
                            className="target-input"
                            value={drafts[category.id] ?? (budget ?? '')}
                            placeholder="—"
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [category.id]: e.target.value }))
                            }
                            onBlur={(e) => {
                              saveBudget(category.id, e.target.value)
                              setDrafts((prev) => {
                                const next = { ...prev }
                                delete next[category.id]
                                return next
                              })
                            }}
                          />
                        </div>
                      </div>

                      {budget !== null && (
                        <div className="progress-track">
                          <div
                            className={`progress-fill${over ? ' progress-fill-over' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )}

                      <div className="budget-row-foot">
                        {budget === null ? (
                          <span className="list-row-sub">No budget set</span>
                        ) : over ? (
                          <span className="budget-gentle-note">
                            {formatMoney(spent - budget)} over — that&apos;s okay.
                          </span>
                        ) : (
                          <span className="list-row-sub">
                            {formatMoney(budget - spent)} left
                          </span>
                        )}

                        {average !== null && (
                          <button
                            type="button"
                            className="row-action-btn"
                            onClick={() => saveBudget(category.id, Math.round(average))}
                            title="Set the budget to this average"
                          >
                            avg {formatMoney(average)}
                          </button>
                        )}
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() =>
                            setExpandedCat(expandedCat === category.id ? null : category.id)
                          }
                        >
                          {expandedCat === category.id ? 'Hide history' : 'History'}
                        </button>
                      </div>

                      {expandedCat === category.id && (
                        <div className="budget-history">
                          {periods.map((row) => {
                            const set = budgetFor(category.id, row.startKey)
                            const act = spentIn(category.id, row)
                            const diff = (set || 0) - act
                            return (
                              <div className="budget-history-row" key={row.startKey}>
                                <span className="budget-history-period">
                                  {periodShortLabel(row, statementDay)}
                                </span>
                                <span className="list-row-sub">
                                  set {set != null ? formatMoney(set) : '—'}
                                </span>
                                <span className="list-row-sub">actual {formatMoney(act)}</span>
                                {set != null && (
                                  <span className={diff < 0 ? 'task-overdue' : 'amount-in'}>
                                    {diff >= 0
                                      ? `${formatMoney(diff)} under`
                                      : `${formatMoney(-diff)} over`}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })
      )}

      <div className="card">
        <h2>Budget vs actual</h2>
        <p className="list-row-sub">Last {LOOKBACK} periods</p>
        <div className="chart-body">
          {hasBudgetTrend ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={budgetTrend} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={BORDER} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: TEXT_SOFT, fontSize: 12 }}
                  axisLine={{ stroke: BORDER }}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) => formatMoney(value)}
                  tick={{ fill: TEXT_SOFT, fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={CHART_TOOLTIP} />
                <Legend verticalAlign="top" height={28} wrapperStyle={{ fontSize: 13, color: TEXT_SOFT }} />
                <Bar dataKey="budget" name="Budget" fill={SAGE} radius={[4, 4, 0, 0]} maxBarSize={20} />
                <Bar dataKey="actual" name="Actual" fill={CLAY} radius={[4, 4, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="empty-text">No budget history yet.</p>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Last {LOOKBACK} periods</h2>
        <p className="list-row-sub">Budget against what actually went out.</p>

        <div className="table-scroll">
          <table className="review-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Budget</th>
                <th>Actual</th>
                <th>Difference</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((row) => {
                const budgeted = budgets
                  .filter((budget) => budget.period_start === row.startKey)
                  .reduce((sum, budget) => sum + Number(budget.amount), 0)
                const actual = categories.reduce(
                  (sum, category) => sum + spentIn(category.id, row),
                  0,
                )
                const diff = budgeted - actual

                return (
                  <tr key={row.startKey}>
                    <td>{periodShortLabel(row, statementDay)}</td>
                    <td>{budgeted > 0 ? formatMoney(budgeted) : '—'}</td>
                    <td>{formatMoney(actual)}</td>
                    <td className={diff < 0 ? 'task-overdue' : undefined}>
                      {budgeted > 0
                        ? diff >= 0
                          ? `${formatMoney(diff)} under`
                          : `${formatMoney(-diff)} over`
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

export default Budgets

// Used by the monthly planner so it agrees with this page.
export function periodForDate(iso, statementDay) {
  return getPeriodContaining(new Date(`${iso}T12:00:00`), statementDay)
}
