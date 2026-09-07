import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { report } from './lib/report'
import { formatMoney } from './lib/format'
import { getPeriodContaining, periodLabel } from './lib/period'
import { isSpendingTxn } from './lib/spending'

// The month planner's read-only view of the budget for that month. Editing
// lives in Money Moves so there's only ever one place to change a number.
function BudgetPanel({ anchor }) {
  const [state, setState] = useState(null)

  const load = useCallback(async () => {
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('statement_day')
      .single()

    if (settingsError) {
      report('Failed to load settings', settingsError)
      return
    }

    const statementDay = Number(settings?.statement_day) || 1
    const period = getPeriodContaining(new Date(`${anchor}T12:00:00`), statementDay)

    const { data: budgets, error: budgetError } = await supabase
      .from('category_budgets')
      .select('*')
      .eq('period_start', period.startKey)

    if (budgetError) {
      report('Failed to load budgets', budgetError)
      return
    }

    const { data: txns, error: txnError } = await supabase
      .from('transactions')
      .select('*')
      .gte('txn_date', period.startKey)
      .lte('txn_date', period.endKey)

    if (txnError) {
      report('Failed to load transactions', txnError)
      return
    }

    const { data: categories } = await supabase.from('categories').select('*')

    const budgeted = (budgets || []).reduce((sum, row) => sum + Number(row.amount), 0)
    const spent = (txns || [])
      .filter(isSpendingTxn)
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

    const worst = (budgets || [])
      .map((row) => {
        const category = (categories || []).find((item) => item.id === row.category_id)
        const used = (txns || [])
          .filter((txn) => txn.category_id === row.category_id && isSpendingTxn(txn))
          .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
        return { name: category?.name || 'Category', budget: Number(row.amount), used }
      })
      .filter((row) => row.used > row.budget)
      .sort((a, b) => b.used - b.budget - (a.used - a.budget))
      .slice(0, 3)

    setState({ period, statementDay, budgeted, spent, worst, count: (budgets || []).length })
  }, [anchor])

  useEffect(() => {
    load()
  }, [load])

  if (!state) return null

  const { budgeted, spent, worst, period, statementDay } = state
  const left = budgeted - spent
  const pct = budgeted > 0 ? Math.min(100, Math.round((spent / budgeted) * 100)) : 0

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>Budget</h2>
        <Link to="/money/budgets" className="row-action-btn">
          {state.count === 0 ? 'Set a budget' : 'Edit budget'}
        </Link>
      </div>

      <p className="list-row-sub">{periodLabel(period, statementDay)}</p>

      {state.count === 0 ? (
        <p className="empty-text">No budget set for this period.</p>
      ) : (
        <>
          <div className="total-row">
            <p>
              {formatMoney(spent)} of {formatMoney(budgeted)}
            </p>
            <span className="money">
              {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`}
            </span>
          </div>

          <div className="progress-track">
            <div
              className={`progress-fill${spent > budgeted ? ' progress-fill-over' : ''}`}
              style={{ width: `${pct}%` }}
            />
          </div>

          {worst.length > 0 && (
            <p className="budget-gentle-note">
              Over in {worst.map((row) => row.name).join(', ')}.
            </p>
          )}
        </>
      )}
    </div>
  )
}

export default BudgetPanel
