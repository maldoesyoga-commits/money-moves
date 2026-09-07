import { useEffect, useState } from 'react'
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

function Home() {
  const [accounts, setAccounts] = useState([])
  const [debts, setDebts] = useState([])
  const [debtEntries, setDebtEntries] = useState([])
  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])

  const { period, statementDay } = usePeriod()

  async function loadAccounts() {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')

    if (error) {
      console.error('Failed to load accounts', error)
      return
    }

    setAccounts(data)
  }

  async function loadDebts() {
    const { data, error } = await supabase.from('debts').select('*')

    if (error) {
      console.error('Failed to load debts', error)
      return
    }

    setDebts(data)
  }

  async function loadDebtEntries() {
    const { data, error } = await supabase.from('debt_entries').select('*')

    if (error) {
      console.error('Failed to load debt entries', error)
      return
    }

    setDebtEntries(data)
  }

  async function loadTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('txn_date', { ascending: false })

    if (error) {
      console.error('Failed to load transactions', error)
      return
    }

    setTransactions(data)
  }

  async function loadCategories() {
    const { data, error } = await supabase.from('categories').select('*')

    if (error) {
      console.error('Failed to load categories', error)
      return
    }

    setCategories(data)
  }

  useEffect(() => {
    loadAccounts()
    loadDebts()
    loadDebtEntries()
    loadTransactions()
    loadCategories()
  }, [])

  function categoryName(categoryId) {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : 'Uncategorized'
  }

  const totalBalance = accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)

  const totalDebtRemaining = debts.reduce((sum, debt) => {
    const start = Number(debt.start_balance) || 0
    const draws = debtEntries
      .filter((entry) => entry.debt_id === debt.id && entry.direction === 'draw')
      .reduce((s, entry) => s + Number(entry.amount || 0), 0)
    const paid = transactions
      .filter((txn) => txn.debt_id === debt.id && txn.direction === 'out')
      .reduce((s, txn) => s + Number(txn.amount || 0), 0)
    return sum + start + draws - paid
  }, 0)

  function iaeForPeriod(p) {
    const periodTxns = transactions.filter(
      (txn) => txn.txn_date >= p.startKey && txn.txn_date <= p.endKey,
    )
    const moneyIn = periodTxns
      .filter((txn) => txn.direction === 'in')
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
    const moneyOut = periodTxns
      .filter((txn) => txn.direction === 'out')
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
    return { moneyIn, moneyOut, iae: moneyIn - moneyOut }
  }

  const periodTransactions = transactions.filter(
    (txn) => txn.txn_date >= period.startKey && txn.txn_date <= period.endKey,
  )
  const { moneyIn, moneyOut, iae: incomeAfterExpenses } = iaeForPeriod(period)

  const recentPeriods = getRecentPeriods(period, statementDay, 6)
  const trendData = recentPeriods.map((p) => ({
    label: periodShortLabel(p, statementDay),
    iae: iaeForPeriod(p).iae,
  }))

  const latestTransactions = periodTransactions.slice(0, 5)

  const budgets = categories
    .filter((category) => category.monthly_target != null && Number(category.monthly_target) > 0)
    .map((category) => {
      const target = Number(category.monthly_target)
      const spent = periodTransactions
        .filter((txn) => txn.category_id === category.id && isSpendingTxn(txn))
        .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
      const isOver = spent > target
      return {
        id: category.id,
        name: category.name,
        spent,
        target,
        isOver,
        overBy: spent - target,
        widthPct: Math.min(100, (spent / target) * 100),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  const now = new Date()
  const todayLabel = now.toLocaleDateString('en-US', {
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

      <div className="card">
        <h2>Accounts</h2>
        <ul className="list">
          {accounts.map((account) => (
            <li key={account.id} className="list-row">
              <span className="list-row-title">{account.name}</span>
              <span className="money">{formatMoney(account.balance)}</span>
            </li>
          ))}
        </ul>
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
        {budgets.length > 0 ? (
          <div className="budget-list">
            {budgets.map((budget) => (
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
                    {formatMoney(budget.overBy)} over this month — that's okay.
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-text">
            No budget targets set yet. Add one under More → Manage categories.
          </p>
        )}
      </div>

      <div className="card">
        <h2>Transactions</h2>
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
