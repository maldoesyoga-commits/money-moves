import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function Savings() {
  const [funds, setFunds] = useState([])
  const [entriesByFund, setEntriesByFund] = useState({})
  const [name, setName] = useState('')
  const [kind, setKind] = useState('sinking')
  const [targetAmount, setTargetAmount] = useState('')
  const [amounts, setAmounts] = useState({})

  async function loadFunds() {
    const { data, error } = await supabase.from('savings_funds').select('*')

    if (error) {
      console.error('Failed to load savings funds', error.message)
      return
    }

    setFunds(data)
    data.forEach((fund) => loadEntries(fund.id))
  }

  async function loadEntries(fundId) {
    const { data, error } = await supabase
      .from('fund_entries')
      .select('*')
      .eq('fund_id', fundId)
      .order('entry_date')

    if (error) {
      console.error('Failed to load fund entries', error.message)
      return
    }

    setEntriesByFund((prev) => ({ ...prev, [fundId]: data }))
  }

  useEffect(() => {
    loadFunds()
  }, [])

  async function handleCreateFund(e) {
    e.preventDefault()

    const payload = { name, kind }
    if (targetAmount) payload.target = Number(targetAmount)

    const { error } = await supabase.from('savings_funds').insert(payload)

    if (error) {
      console.error('Failed to create savings fund', error.message)
      return
    }

    setName('')
    setKind('sinking')
    setTargetAmount('')
    loadFunds()
  }

  function amountFor(fundId, field) {
    return amounts[fundId]?.[field] ?? ''
  }

  function setAmountFor(fundId, field, value) {
    setAmounts((prev) => ({ ...prev, [fundId]: { ...prev[fundId], [field]: value } }))
  }

  async function handleEntry(e, fundId, direction) {
    e.preventDefault()

    const field = direction === 'in' ? 'add' : 'take'
    const amount = Number(amountFor(fundId, field))

    const { error } = await supabase.from('fund_entries').insert({
      fund_id: fundId,
      amount,
      direction,
    })

    if (error) {
      console.error('Failed to add fund entry', error.message)
      return
    }

    setAmountFor(fundId, field, '')
    loadEntries(fundId)
  }

  function balanceFor(fundId) {
    const entries = entriesByFund[fundId] || []
    return entries.reduce(
      (sum, entry) => sum + (entry.direction === 'in' ? Number(entry.amount) : -Number(entry.amount)),
      0,
    )
  }

  function renderFund(fund) {
    const entries = entriesByFund[fund.id] || []
    const balance = balanceFor(fund.id)

    let running = 0
    const rows = entries.map((entry) => {
      running += entry.direction === 'in' ? Number(entry.amount) : -Number(entry.amount)
      return { ...entry, running }
    })

    const pct = fund.target
      ? Math.min(100, Math.max(0, Math.round((balance / Number(fund.target)) * 100)))
      : null

    return (
      <div className="subcard" key={fund.id}>
        <div className="fund-header">
          <h4>{fund.name}</h4>
          <span className="money">{formatMoney(balance)}</span>
        </div>

        {fund.target && (
          <div className="progress-wrap">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <p className="list-row-sub">
              {formatMoney(balance)} of {formatMoney(fund.target)} ({pct}%)
            </p>
          </div>
        )}

        <div className="field-row">
          <form className="mini-form" onSubmit={(e) => handleEntry(e, fund.id, 'in')}>
            <input
              type="number"
              value={amountFor(fund.id, 'add')}
              onChange={(e) => setAmountFor(fund.id, 'add', e.target.value)}
              placeholder="amount"
              required
            />
            <button type="submit" className="btn-secondary">
              Add money
            </button>
          </form>
          <form className="mini-form" onSubmit={(e) => handleEntry(e, fund.id, 'out')}>
            <input
              type="number"
              value={amountFor(fund.id, 'take')}
              onChange={(e) => setAmountFor(fund.id, 'take', e.target.value)}
              placeholder="amount"
              required
            />
            <button type="submit" className="btn-secondary">
              Take money
            </button>
          </form>
        </div>

        {rows.length > 0 ? (
          <ul className="ledger-list">
            {rows.map((entry) => (
              <li key={entry.id} className="ledger-row">
                <span className="list-row-sub">{entry.entry_date}</span>
                <span className={entry.direction === 'in' ? 'amount-in' : 'amount-out'}>
                  {entry.direction === 'in' ? '+' : '-'}
                  {formatMoney(entry.amount)}
                </span>
                <span className="money">{formatMoney(entry.running)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-text">No entries yet.</p>
        )}
      </div>
    )
  }

  const sinkingFunds = funds.filter((fund) => fund.kind === 'sinking')
  const emergencyFunds = funds.filter((fund) => fund.kind === 'emergency')

  return (
    <div className="card">
      <h2>Savings</h2>

      <form onSubmit={handleCreateFund}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="fund name"
            required
          />
          <select value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="sinking">Sinking</option>
            <option value="emergency">Emergency</option>
          </select>
          <input
            type="number"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="target amount (optional)"
          />
        </div>
        <button type="submit">Create fund</button>
      </form>

      <h3>Sinking Funds</h3>
      <div className="fund-group">
        {sinkingFunds.length > 0 ? (
          sinkingFunds.map(renderFund)
        ) : (
          <p className="empty-text">No sinking funds yet.</p>
        )}
      </div>

      <h3>Emergency Funds</h3>
      <div className="fund-group">
        {emergencyFunds.length > 0 ? (
          emergencyFunds.map(renderFund)
        ) : (
          <p className="empty-text">No emergency funds yet.</p>
        )}
      </div>
    </div>
  )
}

export default Savings
