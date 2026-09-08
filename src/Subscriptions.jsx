import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

function monthlyCostFor(subscription) {
  const price = Number(subscription.price) || 0
  if (subscription.cycle === 'annual') return price / 12
  if (subscription.cycle === 'weekly') return (price * 52) / 12
  return price
}

function capitalize(text) {
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function ordinal(n) {
  const d = n % 100
  if (d >= 11 && d <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [editingId, setEditingId] = useState(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cycle, setCycle] = useState('monthly')
  const [billingDay, setBillingDay] = useState('')
  const [accountId, setAccountId] = useState('')

  const loadSubscriptions = useCallback(async () => {
    const { data, error } = await supabase.from('subscriptions').select('*').order('name')
    if (error) {
      console.log('Failed to load subscriptions', error.message)
      return
    }
    setSubscriptions(data)
  }, [])

  const loadAccounts = useCallback(async () => {
    const { data, error } = await supabase.from('accounts').select('*').order('sort_order')
    if (!error && data) setAccounts(data)
  }, [])

  useEffect(() => {
    loadSubscriptions()
    loadAccounts()
  }, [loadSubscriptions, loadAccounts])

  async function handleAdd(e) {
    e.preventDefault()

    const payload = {
      name: name.trim(),
      price: Number(price),
      cycle,
      active: true,
    }
    if (billingDay) payload.billing_day = Number(billingDay)
    if (accountId) payload.account_id = accountId
    if (!payload.name) return

    const { error } = await supabase.from('subscriptions').insert(payload)
    if (error) {
      console.log(error.message)
      return
    }

    setName('')
    setPrice('')
    setCycle('monthly')
    setBillingDay('')
    setAccountId('')
    loadSubscriptions()
  }

  function updateLocal(id, patch) {
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)))
  }

  async function persist(id, patch) {
    updateLocal(id, patch)
    const { error } = await supabase.from('subscriptions').update(patch).eq('id', id)
    if (error) {
      console.log('Failed to update subscription', error.message)
      loadSubscriptions()
    }
  }

  async function handleToggleActive(subscription) {
    persist(subscription.id, { active: !subscription.active })
  }

  async function handleDelete(id) {
    setSubscriptions((prev) => prev.filter((s) => s.id !== id))
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) {
      console.log('Failed to delete subscription', error.message)
      loadSubscriptions()
    }
  }

  function accountName(id) {
    return accounts.find((a) => a.id === id)?.name
  }

  const activeSubscriptions = subscriptions.filter((s) => s.active)
  const totalMonthly = activeSubscriptions.reduce((sum, s) => sum + monthlyCostFor(s), 0)
  const totalAnnual = totalMonthly * 12

  const upcoming = activeSubscriptions
    .filter((s) => s.billing_day)
    .slice()
    .sort((a, b) => a.billing_day - b.billing_day)

  return (
    <div className="card">
      <h2>Subscriptions</h2>

      <form className="money-form" onSubmit={handleAdd}>
        <div className="field-row">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="name"
            required
          />
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="price"
            step="0.01"
            required
          />
          <select value={cycle} onChange={(e) => setCycle(e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div className="field-row">
          <label className="billing-day-field">
            Bills on day
            <input
              type="number"
              min="1"
              max="31"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              placeholder="1–31"
            />
          </label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">From account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <button type="submit">Add subscription</button>
      </form>

      <div className="total-row">
        <p>Monthly cost</p>
        <p className="money">{formatMoney(totalMonthly)}</p>
      </div>
      <p className="list-row-sub">{formatMoney(totalAnnual)} per year, active subscriptions only</p>

      {upcoming.length > 0 && (
        <div className="upcoming-subs">
          <h3>Coming up this month</h3>
          <ul className="list">
            {upcoming.map((s) => (
              <li key={s.id} className="list-row">
                <div className="list-row-main">
                  <span className="list-row-title">
                    {ordinal(s.billing_day)} · {s.name}
                  </span>
                  <span className="list-row-sub">
                    {accountName(s.account_id) ? `from ${accountName(s.account_id)}` : 'no account set'}
                  </span>
                </div>
                <span className="money">{formatMoney(s.price)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h3>All subscriptions</h3>
      {subscriptions.length > 0 ? (
        <ul className="list">
          {subscriptions.map((subscription) => {
            const editing = editingId === subscription.id
            return (
              <li key={subscription.id} className="list-row">
                <div className="task-row-body">
                  <div className="list-row-main">
                    <span className="list-row-title">{subscription.name}</span>
                    <span className="list-row-sub">
                      {capitalize(subscription.cycle)}
                      {subscription.billing_day ? ` · ${ordinal(subscription.billing_day)}` : ''}
                      {accountName(subscription.account_id)
                        ? ` · from ${accountName(subscription.account_id)}`
                        : ''}
                      {` · ${subscription.active ? 'Active' : 'Paused'}`}
                    </span>
                  </div>
                  <div className="subscription-actions">
                    <span className="money">{formatMoney(subscription.price)}</span>
                    <button
                      type="button"
                      className={`toggle${subscription.active ? ' toggle-on' : ''}`}
                      onClick={() => handleToggleActive(subscription)}
                      aria-label={subscription.active ? 'Pause subscription' : 'Activate subscription'}
                      aria-pressed={subscription.active}
                    >
                      <span className="toggle-knob" />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => setEditingId(editing ? null : subscription.id)}
                      aria-label="Edit subscription"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => handleDelete(subscription.id)}
                      aria-label="Delete subscription"
                    >
                      ×
                    </button>
                  </div>
                </div>

                {editing && (
                  <div className="account-edit">
                    <div className="field-row">
                      <input
                        type="text"
                        value={subscription.name}
                        onChange={(e) => updateLocal(subscription.id, { name: e.target.value })}
                        onBlur={(e) => persist(subscription.id, { name: e.target.value.trim() || 'Subscription' })}
                        placeholder="name"
                      />
                      <input
                        type="number"
                        step="0.01"
                        value={subscription.price ?? ''}
                        onChange={(e) => updateLocal(subscription.id, { price: e.target.value })}
                        onBlur={(e) => persist(subscription.id, { price: Number(e.target.value) || 0 })}
                        placeholder="price"
                      />
                    </div>
                    <div className="field-row">
                      <select
                        value={subscription.cycle || 'monthly'}
                        onChange={(e) => persist(subscription.id, { cycle: e.target.value })}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                        <option value="weekly">Weekly</option>
                      </select>
                      <label className="billing-day-field">
                        Day
                        <input
                          type="number"
                          min="1"
                          max="31"
                          value={subscription.billing_day ?? ''}
                          onChange={(e) => updateLocal(subscription.id, { billing_day: e.target.value })}
                          onBlur={(e) =>
                            persist(subscription.id, {
                              billing_day: e.target.value ? Number(e.target.value) : null,
                            })
                          }
                          placeholder="1–31"
                        />
                      </label>
                      <select
                        value={subscription.account_id || ''}
                        onChange={(e) => persist(subscription.id, { account_id: e.target.value || null })}
                      >
                        <option value="">From account —</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="empty-text">No subscriptions yet.</p>
      )}
    </div>
  )
}

export default Subscriptions
