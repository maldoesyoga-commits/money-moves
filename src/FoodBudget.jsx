import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { getPeriodContaining, periodLabel } from './lib/period'
import { isSpendingTxn } from './lib/spending'

// Shows the Food category group's budget against real spending this
// statement period, and what the outstanding grocery list would add.
function FoodBudget({ estimate }) {
  const [state, setState] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const { data: settings, error: settingsError } = await supabase
        .from('settings')
        .select('statement_day')
        .single()

      if (settingsError) {
        console.log('Food budget skipped settings', settingsError.message)
        return
      }

      const statementDay = Number(settings?.statement_day) || 1
      const period = getPeriodContaining(new Date(), statementDay)

      const { data: categories, error: categoryError } = await supabase
        .from('categories')
        .select('*')
        .eq('category_group', 'Food')

      if (categoryError) {
        console.log('Food budget skipped categories', categoryError.message)
        return
      }

      const budgeted = (categories || []).filter(
        (category) => category.monthly_target != null && Number(category.monthly_target) > 0,
      )

      if (budgeted.length === 0) {
        if (!cancelled) setState({ noBudget: true })
        return
      }

      const { data: txns, error: txnError } = await supabase
        .from('transactions')
        .select('*')
        .gte('txn_date', period.startKey)
        .lte('txn_date', period.endKey)

      if (txnError) {
        console.log('Food budget skipped transactions', txnError.message)
        return
      }

      const ids = budgeted.map((category) => category.id)
      const spent = (txns || [])
        .filter((txn) => ids.includes(txn.category_id) && isSpendingTxn(txn))
        .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

      const target = budgeted.reduce((sum, category) => sum + Number(category.monthly_target), 0)

      if (!cancelled) {
        setState({
          target,
          spent,
          label: periodLabel(period, statementDay),
          names: budgeted.map((category) => category.name),
        })
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [])

  if (!state) return null

  if (state.noBudget) {
    return (
      <div className="food-budget">
        <p className="list-row-sub">
          No food budget set. Add a monthly target to your Food categories under{' '}
          <Link to="/money/more" className="project-link">
            Money Moves → More
          </Link>
          .
        </p>
      </div>
    )
  }

  const { target, spent, label } = state
  const left = target - spent
  const projected = spent + estimate
  const spentPct = Math.min(100, Math.round((spent / target) * 100))
  const estimatePct = Math.min(100 - spentPct, Math.round((estimate / target) * 100))
  const wouldGoOver = projected > target

  return (
    <div className="food-budget">
      <div className="budget-row-header">
        <span className="list-row-title">Food budget</span>
        <span className="money">
          {formatMoney(spent)} of {formatMoney(target)}
        </span>
      </div>

      <div className="progress-track">
        <div
          className={`progress-fill${spent > target ? ' progress-fill-over' : ''}`}
          style={{ width: `${spentPct}%` }}
        />
        {estimate > 0 && (
          <div className="progress-fill-estimate" style={{ width: `${estimatePct}%` }} />
        )}
      </div>

      <p className="list-row-sub">
        {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`} · {label}
      </p>

      {estimate > 0 && (
        <p className={wouldGoOver ? 'budget-gentle-note' : 'list-row-sub'}>
          {wouldGoOver
            ? `This list would put you ${formatMoney(projected - target)} over — that's okay, but worth a look.`
            : `This list would leave ${formatMoney(target - projected)}.`}
        </p>
      )}
    </div>
  )
}

export default FoodBudget
