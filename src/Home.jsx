import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
  Cell,
} from 'recharts'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { usePeriod } from './usePeriod'
import PeriodSelector from './PeriodSelector'
import { getRecentPeriods, periodLabel, periodShortLabel } from './lib/period'
import { isSpendingTxn } from './lib/spending'

const SAGE = '#3F6B5C'
const CLAY = '#B87333'
const TEXT_SOFT = '#6E7A75'
const BORDER = '#E1E2DC'

function greetingForHour(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function monthlyCostFor(subscription) {
  const price = Number(subscription.price) || 0
  if (subscription.cycle === 'annual') return price / 12
  if (subscription.cycle === 'weekly') return (price * 52) / 12
  return price
}

const MENU = [
  { key: 'transactions', icon: '💳', name: 'Transactions', to: '/money/transactions' },
  { key: 'budgets', icon: '🧮', name: 'Budget', to: '/money/budgets' },
  { key: 'savings', icon: '🌱', name: 'Savings', to: '/money/savings' },
  { key: 'insights', icon: '📊', name: 'Insights', to: '/money/insights' },
  { key: 'accounts', icon: '🏦', name: 'Accounts', to: '/money/accounts' },
  { key: 'debts', icon: '🤝', name: 'Debts', to: '/money/debts' },
  { key: 'receipts', icon: '🧾', name: 'Receipts', to: '/money/receipts' },
  { key: 'more', icon: '⋯', name: 'More', to: '/money/more' },
]

function Home() {
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts] = useState([])
  const [debtEntries, setDebtEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])
  const [budgets, setBudgets] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [fundEntries, setFundEntries] = useState([])

  const { period, statementDay } = usePeriod()

  useEffect(() => {
    async function loadAll() {
      const [acc, dbt, dbtE, txn, cat, bud, subs, funds] = await Promise.all([
        supabase.from('accounts').select('*').order('sort_order'),
        supabase.from('debts').select('*'),
        supabase.from('debt_entries').select('*'),
        supabase.from('transactions').select('*').order('txn_date', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('category_budgets').select('*'),
        supabase.from('subscriptions').select('*'),
        supabase.from('fund_entries').select('*'),
      ])
      if (acc.data) setAccounts(acc.data)
      if (dbt.data) setDebts(dbt.data)
      if (dbtE.data) setDebtEntries(dbtE.data)
      if (txn.data) setTransactions(txn.data)
      if (cat.data) setCategories(cat.data)
      if (bud.data) setBudgets(bud.data)
      if (subs.data) setSubscriptions(subs.data)
      if (funds.data) setFundEntries(funds.data)
    }
    loadAll()
  }, [])

  function categoryName(categoryId) {
    return categories.find((c) => c.id === categoryId)?.name || 'Uncategorized'
  }

  const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)

  const totalDebtRemaining = debts.reduce((sum, debt) => {
    const start = Number(debt.start_balance) || 0
    const draws = debtEntries
      .filter((e) => e.debt_id === debt.id && e.direction === 'draw')
      .reduce((s, e) => s + Number(e.amount || 0), 0)
    const paid = transactions
      .filter((txn) => txn.debt_id === debt.id && txn.direction === 'out')
      .reduce((s, txn) => s + Number(txn.amount || 0), 0)
    return sum + start + draws - paid
  }, 0)

  const totalSaved = fundEntries.reduce(
    (sum, e) => sum + (e.direction === 'in' ? Number(e.amount || 0) : -Number(e.amount || 0)),
    0,
  )

  const subsMonthly = subscriptions
    .filter((s) => s.active)
    .reduce((sum, s) => sum + monthlyCostFor(s), 0)

  function iaeForPeriod(p) {
    const periodTxns = transactions.filter((txn) => txn.txn_date >= p.startKey && txn.txn_date <= p.endKey)
    const moneyIn = periodTxns.filter((txn) => txn.direction === 'in').reduce((s, txn) => s + Number(txn.amount || 0), 0)
    const moneyOut = periodTxns.filter((txn) => txn.direction === 'out').reduce((s, txn) => s + Number(txn.amount || 0), 0)
    return { moneyIn, moneyOut, iae: moneyIn - moneyOut }
  }

  const periodTransactions = transactions.filter(
    (txn) => txn.txn_date >= period.startKey && txn.txn_date <= period.endKey,
  )
  const { moneyIn, moneyOut, iae: incomeAfterExpenses } = iaeForPeriod(period)
  const spentThisPeriod = periodTransactions
    .filter(isSpendingTxn)
    .reduce((s, txn) => s + Number(txn.amount || 0), 0)

  const recentPeriods = getRecentPeriods(period, statementDay, 6)
  const trendData = recentPeriods.map((p) => ({
    label: periodShortLabel(p, statementDay),
    iae: iaeForPeriod(p).iae,
  }))

  const latestTransactions = periodTransactions.slice(0, 5)

  function budgetAmountFor(category) {
    const row = budgets.find((item) => item.category_id === category.id && item.period_start === period.startKey)
    if (row) return Number(row.amount)
    return category.monthly_target != null ? Number(category.monthly_target) : 0
  }

  const budgetRows = categories
    .filter((category) => budgetAmountFor(category) > 0)
    .map((category) => {
      const target = budgetAmountFor(category)
      const spent = periodTransactions
        .filter((txn) => txn.category_id === category.id && isSpendingTxn(txn))
        .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
      return {
        id: category.id,
        name: category.name,
        spent,
        target,
        isOver: spent > target,
        overBy: spent - target,
        widthPct: Math.min(100, (spent / target) * 100),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const totalBudget = budgetRows.reduce((s, b) => s + b.target, 0)
  const totalBudgetSpent = budgetRows.reduce((s, b) => s + b.spent, 0)
  const budgetLeft = totalBudget - totalBudgetSpent

  function menuStat(key) {
    switch (key) {
      case 'transactions':
        return `${periodTransactions.length} this period`
      case 'budgets':
        if (totalBudget <= 0) return 'not set'
        return budgetLeft >= 0 ? `${formatMoney(budgetLeft)} left` : `${formatMoney(-budgetLeft)} over`
      case 'savings':
        return formatMoney(totalSaved)
      case 'accounts':
        return `${accounts.length} account${accounts.length === 1 ? '' : 's'}`
      case 'debts':
        return totalDebtRemaining > 0 ? `${formatMoney(totalDebtRemaining)} left` : 'clear'
      case 'insights':
        return 'charts & trends'
      case 'receipts':
        return 'invoices & receipts'
      case 'more':
        return 'everything else'
      default:
        return ''
    }
  }

  const now = new Date()
  const todayLabel = now.toLocaleDateString('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })

  return (
    <section className="home">
      <div className="home-greeting">
        <h1>{greetingForHour(now.getHours())}</h1>
        <p className="list-row-sub">{todayLabel}</p>
      </div>

      <div className="card home-hero">
        <p className="home-hero-label">Total balance</p>
        <p className="home-hero-amount">{formatMoney(totalBalance)}</p>
        <p className="home-hero-debt">{formatMoney(totalDebtRemaining)} in debt remaining</p>
      </div>

      <div className="insight-tiles">
        <div className="insight-tile">
          <span className="insight-num">{formatMoney(spentThisPeriod)}</span>
          <span className="insight-label">Spent this period</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{formatMoney(totalSaved)}</span>
          <span className="insight-label">Saved</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{formatMoney(subsMonthly)}</span>
          <span className="insight-label">Subscriptions / mo</span>
        </div>
        <div className="insight-tile">
          <span className="insight-num">{formatMoney(totalDebtRemaining)}</span>
          <span className="insight-label">Debt remaining</span>
        </div>
      </div>

      <div className="module-grid money-menu">
        {MENU.map((item) => (
          <Link key={item.key} to={item.to} className="module-card">
            <span className="module-card-icon">{item.icon}</span>
            <span className="module-card-name">{item.name}</span>
            <span className="module-card-stat">{menuStat(item.key)}</span>
          </Link>
        ))}
      </div>

      <PeriodSelector />

      <div className="card">
        <h2>Income after expenses</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        <ul className="list">
          <li className="list-row">
            <span className="list-row-title">Money in</span>
            <span className="amount-in">+{formatMoney(moneyIn)}</span>
          </li>
          <li className="list-row">
            <span className="list-row-title">Money out</span>
            <span className="amount-out">-{formatMoney(moneyOut)}</span>
          </li>
        </ul>
        <div className="home-net-row">
          <p>Income after expenses</p>
          <p className={`money ${incomeAfterExpenses >= 0 ? 'amount-in' : 'amount-out'}`}>
            {formatMoney(incomeAfterExpenses)}
          </p>
        </div>

        <div className="chart-body">
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={trendData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: TEXT_SOFT, fontSize: 11 }}
                axisLine={{ stroke: BORDER }}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => formatMoney(value)}
                contentStyle={{
                  background: '#fbfaf6',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="iae" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {trendData.map((entry) => (
                  <Cell key={entry.label} fill={entry.iae >= 0 ? SAGE : CLAY} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <h2>Budgets</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        {budgetRows.length > 0 ? (
          <div className="budget-list">
            {budgetRows.map((budget) => (
              <div key={budget.id}>
                <div className="budget-row-header">
                  <span className="list-row-title">{budget.name}</span>
                  <span className="list-row-sub">
                    {formatMoney(budget.spent)} of {formatMoney(budget.target)}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className={`progress-fill${budget.isOver ? ' progress-fill-over' : ''}`}
                    style={{ width: `${budget.widthPct}%` }}
                  />
                </div>
                {budget.isOver && (
                  <p className="budget-gentle-note">
                    {formatMoney(budget.overBy)} over this month — that&apos;s okay.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">
            No budget set for this period.{' '}
            <Link to="/money/budgets" className="project-link">
              Set one →
            </Link>
          </p>
        )}
      </div>

      <div className="card">
        <h2>Latest activity</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        {latestTransactions.length > 0 ? (
          <ul className="list">
            {latestTransactions.map((txn) => (
              <li key={txn.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">{categoryName(txn.category_id)}</span>
                  <span className="list-row-sub">{txn.txn_date}</span>
                </div>
                <span className={txn.direction === 'in' ? 'amount-in' : 'amount-out'}>
                  {txn.direction === 'in' ? '+' : '-'}
                  {formatMoney(txn.amount)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-text">No transactions in this period.</p>
        )}
      </div>
    </section>
  )
}

export default Home
