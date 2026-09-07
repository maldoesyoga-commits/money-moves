import { useEffect, useState } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { usePeriod } from './usePeriod'
import PeriodSelector from './PeriodSelector'
import { getRecentPeriods, periodLabel, periodShortLabel } from './lib/period'

const SAGE = '#3F6B5C'
const CLAY = '#B87333'
const BLUE = '#4E6E8A'
const SAND = '#C9A66B'
const MOSS = '#8A9A5B'
const STONE = '#A89984'
const BARK = '#6B4F3A'
const TEXT = '#2D3230'
const TEXT_SOFT = '#6E7A75'
const BORDER = '#E1E2DC'

const EARTH_PALETTE = [SAGE, CLAY, BLUE, SAND, MOSS, STONE, BARK]

const BUCKET_COLORS = {
  need: SAGE,
  want: CLAY,
  future: BLUE,
}

const METHOD_LABELS = {
  debit: 'Debit',
  credit: 'Credit',
  etransfer: 'E-transfer',
  cash: 'Cash',
}

const METHOD_COLORS = {
  debit: SAGE,
  credit: CLAY,
  etransfer: BLUE,
  cash: SAND,
}

function capitalize(text) {
  if (!text) return 'Other'
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function paletteColor(index) {
  return EARTH_PALETTE[index % EARTH_PALETTE.length]
}

function tooltipStyle() {
  return {
    background: '#fbfaf6',
    border: `1px solid ${BORDER}`,
    borderRadius: 10,
    fontSize: 13,
    color: TEXT,
    boxShadow: '0 4px 16px rgba(45, 50, 48, 0.1)',
  }
}

function ChartEmpty({ height = 160 }) {
  return (
    <div className="chart-empty" style={{ height }}>
      No data yet
    </div>
  )
}

function Insights() {
  const { period, statementDay } = usePeriod()

  const [transactions, setTransactions] = useState([])
  const [categories, setCategories] = useState([])

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
    loadTransactions()
    loadCategories()
  }, [])

  function categoryFor(categoryId) {
    return categories.find((c) => c.id === categoryId) || null
  }

  const periodTxns = transactions.filter(
    (txn) => txn.txn_date >= period.startKey && txn.txn_date <= period.endKey,
  )
  const monthOutTxns = periodTxns.filter((txn) => txn.direction === 'out')

  // Spending by category (selected period)
  const categoryTotals = new Map()
  monthOutTxns.forEach((txn) => {
    const key = txn.category_id || 'none'
    categoryTotals.set(key, (categoryTotals.get(key) || 0) + Number(txn.amount || 0))
  })
  const categoryData = Array.from(categoryTotals.entries())
    .map(([categoryId, amount]) => ({
      name: categoryId === 'none' ? 'Uncategorized' : categoryFor(categoryId)?.name || 'Uncategorized',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount)

  // Need / Want / Future
  const bucketTotals = new Map()
  monthOutTxns.forEach((txn) => {
    const bucket = categoryFor(txn.category_id)?.bucket || 'other'
    bucketTotals.set(bucket, (bucketTotals.get(bucket) || 0) + Number(txn.amount || 0))
  })
  const bucketData = Array.from(bucketTotals.entries()).map(([bucket, amount]) => ({
    key: bucket,
    name: capitalize(bucket),
    amount,
  }))

  // Where money goes vs comes in (selected period)
  const moneyIn = periodTxns
    .filter((txn) => txn.direction === 'in')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
  const moneyOut = periodTxns
    .filter((txn) => txn.direction === 'out')
    .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)

  // Spending over time (last 6 periods, ending with the selected period)
  const recentPeriods = getRecentPeriods(period, statementDay, 6)
  const spendingOverTime = recentPeriods.map((p) => {
    const amount = transactions
      .filter(
        (txn) =>
          txn.direction === 'out' && txn.txn_date >= p.startKey && txn.txn_date <= p.endKey,
      )
      .reduce((sum, txn) => sum + Number(txn.amount || 0), 0)
    return { month: periodShortLabel(p, statementDay), amount }
  })
  const hasSpendingHistory = spendingOverTime.some((entry) => entry.amount > 0)

  // How it's sent (selected period, out-transactions with a method)
  const methodTotals = new Map()
  monthOutTxns
    .filter((txn) => txn.method)
    .forEach((txn) => {
      const key = String(txn.method).toLowerCase()
      methodTotals.set(key, (methodTotals.get(key) || 0) + Number(txn.amount || 0))
    })
  const methodData = Array.from(methodTotals.entries()).map(([method, amount]) => ({
    key: method,
    name: METHOD_LABELS[method] || capitalize(method),
    amount,
  }))

  return (
    <section className="insights">
      <h1>Insights</h1>

      <PeriodSelector />

      <div className="card">
        <h2>Spending by category</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        <div className="chart-body">
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(160, categoryData.length * 42)}>
              <BarChart
                data={categoryData}
                layout="vertical"
                margin={{ top: 4, right: 24, bottom: 4, left: 0 }}
              >
                <CartesianGrid horizontal={false} stroke={BORDER} />
                <XAxis
                  type="number"
                  tickFormatter={(value) => formatMoney(value)}
                  tick={{ fill: TEXT_SOFT, fontSize: 12 }}
                  axisLine={{ stroke: BORDER }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fill: TEXT, fontSize: 13 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={tooltipStyle()} />
                <Bar dataKey="amount" fill={SAGE} radius={[0, 6, 6, 0]} maxBarSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty />
          )}
        </div>
      </div>

      <div className="card">
        <h2>Need / Want / Future</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        <div className="chart-body">
          {bucketData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={bucketData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {bucketData.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={BUCKET_COLORS[entry.key] || paletteColor(index + 3)}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={tooltipStyle()} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  wrapperStyle={{ fontSize: 13, color: TEXT_SOFT }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty height={240} />
          )}
        </div>
      </div>

      <div className="card">
        <h2>Where money goes vs comes in</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        <div className="chart-body">
          {moneyIn > 0 || moneyOut > 0 ? (
            <div className="flow-summary">
              <div className="flow-stat">
                <p className="list-row-sub">Money in</p>
                <p className="flow-amount amount-in">{formatMoney(moneyIn)}</p>
              </div>
              <div className="flow-stat">
                <p className="list-row-sub">Money out</p>
                <p className="flow-amount amount-out">{formatMoney(moneyOut)}</p>
              </div>
            </div>
          ) : (
            <ChartEmpty height={100} />
          )}
        </div>
      </div>

      <div className="card">
        <h2>Spending over time</h2>
        <p className="list-row-sub">Last 6 periods</p>
        <div className="chart-body">
          {hasSpendingHistory ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={spendingOverTime} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid vertical={false} stroke={BORDER} />
                <XAxis
                  dataKey="month"
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
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={tooltipStyle()} />
                <Bar dataKey="amount" fill={CLAY} radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty height={220} />
          )}
        </div>
      </div>

      <div className="card">
        <h2>How it's sent</h2>
        <p className="list-row-sub">{periodLabel(period, statementDay)}</p>
        <div className="chart-body">
          {methodData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={methodData}
                  dataKey="amount"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {methodData.map((entry, index) => (
                    <Cell
                      key={entry.key}
                      fill={METHOD_COLORS[entry.key] || paletteColor(index + 1)}
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value)} contentStyle={tooltipStyle()} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  wrapperStyle={{ fontSize: 13, color: TEXT_SOFT }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <ChartEmpty height={240} />
          )}
        </div>
      </div>
    </section>
  )
}

export default Insights
