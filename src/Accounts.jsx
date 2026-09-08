import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

const KINDS = [
  { value: 'income', label: 'Income hub' },
  { value: 'spending', label: 'Everyday spending' },
  { value: 'bills', label: 'Bills' },
  { value: 'tax', label: 'Tax' },
  { value: 'sinking', label: 'Sinking' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
]
const KIND_LABEL = Object.fromEntries(KINDS.map((k) => [k.value, k.label]))

function Accounts() {
  const [accounts, setAccounts] = useState([])
  const [subs, setSubs] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [kind, setKind] = useState('spending')
  const [startBalance, setStartBalance] = useState('')

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')
    if (error) {
      console.log('Failed to load accounts', error.message)
      return
    }
    setAccounts(data)
  }, [])

  const loadSubs = useCallback(async () => {
    const { data, error } = await supabase.from('subscriptions').select('*')
    if (!error && data) setSubs(data)
  }, [])

  useEffect(() => {
    loadAccounts()
    loadSubs()
  }, [loadAccounts, loadSubs])

  async function handleAdd(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return

    const { error } = await supabase.from('accounts').insert({
      name: trimmed,
      institution: institution.trim() || null,
      kind,
      balance: Number(startBalance) || 0,
      sort_order: accounts.length,
    })
    if (error) {
      console.log('Failed to add account', error.message)
      return
    }
    setName('')
    setInstitution('')
    setKind('spending')
    setStartBalance('')
    loadAccounts()
  }

  function updateLocal(id, patch) {
    setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('accounts').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to save account', error.message)
      loadAccounts()
    }
  }

  async function handleDelete(id) {
    setDeleteError(null)
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) {
      setDeleteError(
        'That account still has transactions pointing at it, so it can’t be deleted yet. Move or delete those first.',
      )
      setConfirmId(null)
      return
    }
    setConfirmId(null)
    setEditingId(null)
    loadAccounts()
  }

  const total = accounts.reduce((sum, a) => sum + Number(a.balance || 0), 0)

  function subsFor(accountId) {
    return subs.filter((s) => s.account_id === accountId)
  }

  return (
    <div className="money-page">
      <div className="card">
        <h2>Accounts</h2>
        <div className="total-row">
          <p>Total</p>
          <p className="money">{formatMoney(total)}</p>
        </div>

        {deleteError && <p className="error-text">{deleteError}</p>}

        <ul className="list">
          {accounts.map((account) => {
            const editing = editingId === account.id
            const accountSubs = subsFor(account.id)

            return (
              <li key={account.id} className="list-row account-row">
                <div className="task-row-body">
                  <div className="list-row-main">
                    <span className="list-row-title">{account.name}</span>
                    <span className="list-row-sub">
                      {account.institution ? `${account.institution} · ` : ''}
                      {KIND_LABEL[account.kind] || account.kind}
                    </span>
                  </div>
                  <span className="money">{formatMoney(account.balance)}</span>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => {
                      setEditingId(editing ? null : account.id)
                      setConfirmId(null)
                    }}
                    aria-label="Edit account"
                  >
                    ✎
                  </button>
                </div>

                {accountSubs.length > 0 && !editing && (
                  <p className="list-row-sub account-subs">
                    Subscriptions: {accountSubs.map((s) => s.name).join(', ')}
                  </p>
                )}

                {editing && (
                  <div className="account-edit">
                    <div className="field-row">
                      <input
                        type="text"
                        value={account.name}
                        onChange={(e) => updateLocal(account.id, { name: e.target.value })}
                        onBlur={(e) => persist(account.id, { name: e.target.value.trim() || 'Account' })}
                        placeholder="name"
                      />
                      <input
                        type="text"
                        value={account.institution || ''}
                        onChange={(e) => updateLocal(account.id, { institution: e.target.value })}
                        onBlur={(e) => persist(account.id, { institution: e.target.value.trim() || null })}
                        placeholder="institution"
                      />
                    </div>
                    <div className="field-row">
                      <select
                        value={account.kind || 'other'}
                        onChange={(e) => persist(account.id, { kind: e.target.value })}
                      >
                        {KINDS.map((k) => (
                          <option key={k.value} value={k.value}>
                            {k.label}
                          </option>
                        ))}
                      </select>
                      <label className="balance-edit">
                        Balance
                        <input
                          type="number"
                          step="0.01"
                          value={account.balance ?? ''}
                          onChange={(e) =>
                            updateLocal(account.id, {
                              balance: e.target.value === '' ? 0 : Number(e.target.value),
                            })
                          }
                          onBlur={(e) => persist(account.id, { balance: Number(e.target.value) || 0 })}
                        />
                      </label>
                    </div>

                    {accountSubs.length > 0 && (
                      <div className="account-subs-list">
                        <span className="list-row-sub">Subscriptions from this account</span>
                        <ul className="list">
                          {accountSubs.map((s) => (
                            <li key={s.id} className="list-row">
                              <span className="list-row-title">{s.name}</span>
                              <span className="money">{formatMoney(s.price)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {confirmId === account.id ? (
                      <div className="field-row">
                        <button
                          type="button"
                          className="row-action-btn row-action-btn-danger"
                          onClick={() => handleDelete(account.id)}
                        >
                          Confirm delete
                        </button>
                        <button
                          type="button"
                          className="row-action-btn"
                          onClick={() => setConfirmId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="row-action-btn row-action-btn-danger"
                        onClick={() => setConfirmId(account.id)}
                      >
                        Delete account
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className="card">
        <h3>Add an account</h3>
        <form className="money-form" onSubmit={handleAdd}>
          <div className="field-row">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="name — e.g. RBC Chequing"
              required
            />
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="institution (optional)"
            />
          </div>
          <div className="field-row">
            <select value={kind} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={startBalance}
              onChange={(e) => setStartBalance(e.target.value)}
              placeholder="starting balance"
            />
          </div>
          <button type="submit">Add account</button>
        </form>
      </div>
    </div>
  )
}

export default Accounts
