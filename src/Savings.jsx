import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'
import { effectDeltas, mergeDeltaLists, applyBalanceDeltas } from './lib/balances'

function Savings() {
  const [funds, setFunds] = useState([])
  const [entriesByFund, setEntriesByFund] = useState({})
  const [accounts, setAccounts] = useState([])
  const [expandedId, setExpandedId] = useState(null)
  const [amounts, setAmounts] = useState({})
  const [notice, setNotice] = useState(null)

  const [name, setName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const loadFunds = useCallback(async () => {
    const { data, error } = await supabase.from('savings_funds').select('*')
    if (error) {
      console.log('Failed to load savings funds', error.message)
      return
    }
    setFunds(data)
    data.forEach((fund) => loadEntries(fund.id))
  }, [])

  async function loadEntries(fundId) {
    const { data, error } = await supabase
      .from('fund_entries')
      .select('*')
      .eq('fund_id', fundId)
      .order('entry_date')
    if (error) {
      console.log('Failed to load fund entries', error.message)
      return
    }
    setEntriesByFund((prev) => ({ ...prev, [fundId]: data }))
  }

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')
    if (!error && data) setAccounts(data)
  }, [])

  useEffect(() => {
    loadFunds()
    loadAccounts()
  }, [loadFunds, loadAccounts])

  const visibleFunds = funds.filter((f) => showArchived || !f.archived)
  const emergencyFund = visibleFunds.find((f) => f.kind === 'emergency')
  const sinkingFunds = visibleFunds.filter((f) => f.kind === 'sinking')
  const hasAnyEmergency = funds.some((f) => f.kind === 'emergency')

  async function handleCreateSinking(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const payload = { name: trimmed, kind: 'sinking' }
    if (targetAmount) payload.target = Number(targetAmount)

    const { error } = await supabase.from('savings_funds').insert(payload)
    if (error) {
      console.log('Failed to create fund', error.message)
      return
    }
    setName('')
    setTargetAmount('')
    loadFunds()
  }

  async function handleCreateEmergency() {
    const { error } = await supabase
      .from('savings_funds')
      .insert({ name: 'Emergency Fund', kind: 'emergency' })
    if (error) {
      console.log('Failed to create emergency fund', error.message)
      return
    }
    loadFunds()
  }

  async function toggleArchive(fund) {
    const { error } = await supabase
      .from('savings_funds')
      .update({ archived: !fund.archived })
      .eq('id', fund.id)
    if (error) {
      console.log('Failed to archive fund', error.message)
      return
    }
    loadFunds()
  }

  function amountFor(fundId, field) {
    return amounts[fundId]?.[field] ?? ''
  }
  function setAmountFor(fundId, field, value) {
    setAmounts((prev) => ({ ...prev, [fundId]: { ...prev[fundId], [field]: value } }))
  }

  function balanceFor(fundId) {
    const entries = entriesByFund[fundId] || []
    return entries.reduce(
      (sum, e) => sum + (e.direction === 'in' ? Number(e.amount) : -Number(e.amount)),
      0,
    )
  }

  // Move real money: a transfer between a chosen account and the savings
  // bucket account (by kind), plus a fund_entry so the fund tracks its own total.
  async function moveMoney(fund, direction) {
    setNotice(null)
    const field = direction === 'in' ? 'add' : 'take'
    const acctField = direction === 'in' ? 'fromAcct' : 'toAcct'
    const amount = Number(amountFor(fund.id, field))
    const chosenAccountId = amountFor(fund.id, acctField)

    if (!amount || amount <= 0) return

    const savingsAccount = accounts.find((a) => a.kind === fund.kind)

    let transactionId = null

    if (savingsAccount && chosenAccountId) {
      const fromId = direction === 'in' ? chosenAccountId : savingsAccount.id
      const toId = direction === 'in' ? savingsAccount.id : chosenAccountId

      const { data: txn, error: txnError } = await supabase
        .from('transactions')
        .insert({
          amount,
          direction: 'transfer',
          from_account_id: fromId,
          to_account_id: toId,
          note: `${direction === 'in' ? '→' : '←'} ${fund.name}`,
        })
        .select()
        .single()

      if (txnError) {
        console.log('Failed to create transfer', txnError.message)
        return
      }
      transactionId = txn.id
      await applyBalanceDeltas(mergeDeltaLists(effectDeltas(txn, 1)))
    } else {
      setNotice(
        'Recorded in the fund. To move real money too, pick an account and make sure you have a ' +
          `${fund.kind} account set up in Accounts.`,
      )
    }

    const entry = { fund_id: fund.id, amount, direction }
    if (transactionId) entry.transaction_id = transactionId

    const { error: entryError } = await supabase.from('fund_entries').insert(entry)
    if (entryError) {
      console.log('Failed to record fund entry', entryError.message)
      return
    }

    setAmountFor(fund.id, field, '')
    loadEntries(fund.id)
    loadAccounts()
  }

  function renderFund(fund) {
    const entries = entriesByFund[fund.id] || []
    const balance = balanceFor(fund.id)
    const open = expandedId === fund.id
    const pct = fund.target
      ? Math.min(100, Math.max(0, Math.round((balance / Number(fund.target)) * 100)))
      : null

    let running = 0
    const rows = entries.map((entry) => {
      running += entry.direction === 'in' ? Number(entry.amount) : -Number(entry.amount)
      return { ...entry, running }
    })

    return (
      <div className="subcard fund-card" key={fund.id}>
        <button type="button" className="fund-card-head" onClick={() => setExpandedId(open ? null : fund.id)}>
          <span className="fund-card-name">
            {fund.name}
            {fund.archived && <span className="priority-pill fund-archived-pill">Archived</span>}
          </span>
          <span className="fund-card-right">
            <span className="money">{formatMoney(balance)}</span>
            <span className="row-action-btn">{open ? 'Close' : 'Open'}</span>
          </span>
        </button>

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

        {open && (
          <div className="fund-detail">
            <div className="fund-move">
              <span className="fund-move-label">Add money</span>
              <form className="fund-move-row" onSubmit={(e) => { e.preventDefault(); moveMoney(fund, 'in') }}>
                <input
                  type="number"
                  step="0.01"
                  value={amountFor(fund.id, 'add')}
                  onChange={(e) => setAmountFor(fund.id, 'add', e.target.value)}
                  placeholder="amount"
                  required
                />
                <select
                  value={amountFor(fund.id, 'fromAcct')}
                  onChange={(e) => setAmountFor(fund.id, 'fromAcct', e.target.value)}
                >
                  <option value="">From account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary">
                  Add
                </button>
              </form>
            </div>
            <div className="fund-move">
              <span className="fund-move-label">Take money</span>
              <form className="fund-move-row" onSubmit={(e) => { e.preventDefault(); moveMoney(fund, 'out') }}>
                <input
                  type="number"
                  step="0.01"
                  value={amountFor(fund.id, 'take')}
                  onChange={(e) => setAmountFor(fund.id, 'take', e.target.value)}
                  placeholder="amount"
                  required
                />
                <select
                  value={amountFor(fund.id, 'toAcct')}
                  onChange={(e) => setAmountFor(fund.id, 'toAcct', e.target.value)}
                >
                  <option value="">To account —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <button type="submit" className="btn-secondary">
                  Take
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

            <button
              type="button"
              className="row-action-btn"
              onClick={() => toggleArchive(fund)}
            >
              {fund.archived ? 'Unarchive fund' : 'Archive fund'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="card">
      <h2>Savings</h2>
      {notice && <p className="list-row-sub savings-notice">{notice}</p>}

      <div className="transaction-filter-bar">
        <label className="filter-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived
        </label>
      </div>

      <h3>Emergency Fund</h3>
      <div className="fund-group">
        {emergencyFund ? (
          renderFund(emergencyFund)
        ) : hasAnyEmergency ? (
          <p className="empty-text">Emergency fund is archived.</p>
        ) : (
          <div className="subcard">
            <p className="empty-text">No emergency fund yet.</p>
            <button type="button" className="btn-secondary" onClick={handleCreateEmergency}>
              Set up my Emergency Fund
            </button>
          </div>
        )}
      </div>

      <h3>Sinking Funds</h3>
      <div className="fund-group">
        {sinkingFunds.length > 0 ? (
          sinkingFunds.map(renderFund)
        ) : (
          <p className="empty-text">No sinking funds yet.</p>
        )}
      </div>

      <form onSubmit={handleCreateSinking} className="savings-add">
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="new sinking fund name"
            required
          />
          <input
            type="number"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            placeholder="target (optional)"
          />
        </div>
        <button type="submit">Create sinking fund</button>
      </form>
    </div>
  )
}

export default Savings
