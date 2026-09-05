import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function Debts() {
  const [debts, setDebts] = useState([])
  const [entriesByDebt, setEntriesByDebt] = useState({})
  const [paymentsByDebt, setPaymentsByDebt] = useState({})
  const [name, setName] = useState('')
  const [startBalance, setStartBalance] = useState('')
  const [amounts, setAmounts] = useState({})

  async function loadDebts() {
    const { data, error } = await supabase.from('debts').select('*')

    if (error) {
      console.log(error.message)
      return
    }

    setDebts(data)
    data.forEach((debt) => {
      loadEntries(debt.id)
      loadPayments(debt.id)
    })
  }

  async function loadEntries(debtId) {
    const { data, error } = await supabase
      .from('debt_entries')
      .select('*')
      .eq('debt_id', debtId)
      .order('entry_date')

    if (error) {
      console.log(error.message)
      return
    }

    setEntriesByDebt((prev) => ({ ...prev, [debtId]: data }))
  }

  async function loadPayments(debtId) {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('debt_id', debtId)
      .eq('direction', 'out')
      .order('txn_date')

    if (error) {
      console.log(error.message)
      return
    }

    setPaymentsByDebt((prev) => ({ ...prev, [debtId]: data }))
  }

  useEffect(() => {
    loadDebts()
  }, [])

  async function handleCreateDebt(e) {
    e.preventDefault()

    const amount = Number(startBalance) || 0

    const { error } = await supabase.from('debts').insert({
      name,
      kind: 'credit_line',
      start_balance: amount,
      balance: amount,
    })

    if (error) {
      console.log(error.message)
      return
    }

    setName('')
    setStartBalance('')
    loadDebts()
  }

  function amountFor(debtId, field) {
    return amounts[debtId]?.[field] ?? ''
  }

  function setAmountFor(debtId, field, value) {
    setAmounts((prev) => ({ ...prev, [debtId]: { ...prev[debtId], [field]: value } }))
  }

  function drawsSumFor(debtId) {
    const entries = entriesByDebt[debtId] || []
    return entries
      .filter((entry) => entry.direction === 'draw')
      .reduce((sum, entry) => sum + Number(entry.amount), 0)
  }

  function paidSoFarFor(debtId) {
    const payments = paymentsByDebt[debtId] || []
    return payments.reduce((sum, payment) => sum + Number(payment.amount), 0)
  }

  async function handleDraw(e, debtId) {
    e.preventDefault()

    const amount = Number(amountFor(debtId, 'draw'))

    const { error } = await supabase.from('debt_entries').insert({
      debt_id: debtId,
      amount,
      direction: 'draw',
    })

    if (error) {
      console.log(error.message)
      return
    }

    setAmountFor(debtId, 'draw', '')
    loadEntries(debtId)
  }

  async function handlePayment(e, debtId) {
    e.preventDefault()

    const amount = Number(amountFor(debtId, 'payment'))

    const { error } = await supabase.from('transactions').insert({
      amount,
      direction: 'out',
      debt_id: debtId,
    })

    if (error) {
      console.log(error.message)
      return
    }

    setAmountFor(debtId, 'payment', '')
    loadPayments(debtId)
  }

  function renderDebt(debt) {
    const payments = paymentsByDebt[debt.id] || []
    const startAmount = Number(debt.start_balance) || 0
    const paidSoFar = paidSoFarFor(debt.id)
    const remaining = startAmount + drawsSumFor(debt.id) - paidSoFar

    const pct =
      startAmount > 0 ? Math.min(100, Math.max(0, Math.round((paidSoFar / startAmount) * 100))) : 0

    return (
      <div className="subcard" key={debt.id}>
        <div className="fund-header">
          <h4>{debt.name}</h4>
        </div>

        <ul className="list">
          <li className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Initial debt</span>
            </div>
            <span className="money">{formatMoney(startAmount)}</span>
          </li>
          <li className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Paid so far</span>
            </div>
            <span className="money">{formatMoney(paidSoFar)}</span>
          </li>
          <li className="list-row">
            <div className="list-row-main">
              <span className="list-row-title">Remaining</span>
            </div>
            <span className="debt-balance">{formatMoney(remaining)}</span>
          </li>
        </ul>

        {startAmount > 0 && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="list-row-sub">
              {formatMoney(paidSoFar)} of {formatMoney(startAmount)} paid ({pct}%)
            </p>
          </div>
        )}

        <div className="field-row">
          <form className="mini-form" onSubmit={(e) => handleDraw(e, debt.id)}>
            <input
              type="number"
              value={amountFor(debt.id, 'draw')}
              onChange={(e) => setAmountFor(debt.id, 'draw', e.target.value)}
              placeholder="amount"
              required
            />
            <button type="submit" className="btn-secondary">
              They lent me
            </button>
          </form>
          <form className="mini-form" onSubmit={(e) => handlePayment(e, debt.id)}>
            <input
              type="number"
              value={amountFor(debt.id, 'payment')}
              onChange={(e) => setAmountFor(debt.id, 'payment', e.target.value)}
              placeholder="amount"
              required
            />
            <button type="submit" className="btn-secondary">
              I paid them back
            </button>
          </form>
        </div>

        <h3>Payment history</h3>
        {payments.length > 0 ? (
          <ul className="ledger-list">
            {payments.map((payment) => (
              <li key={payment.id} className="ledger-row">
                <span className="list-row-sub">{payment.txn_date}</span>
                <span className="amount-in">-{formatMoney(payment.amount)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-text">No payments yet.</p>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Debts</h2>

      <form onSubmit={handleCreateDebt}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="who (e.g. Parents)"
            required
          />
          <input
            type="number"
            value={startBalance}
            onChange={(e) => setStartBalance(e.target.value)}
            placeholder="starting amount owed"
            required
          />
        </div>
        <button type="submit">Create</button>
      </form>

      <div className="fund-group">
        {debts.length > 0 ? debts.map(renderDebt) : <p className="empty-text">No debts yet.</p>}
      </div>
    </div>
  )
}

export default Debts
