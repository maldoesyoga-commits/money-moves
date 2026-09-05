import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { formatMoney } from './lib/format'

const UNUSED_THRESHOLD_DAYS = 60

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

function isUnused(subscription) {
  if (!subscription.last_used) return false
  const lastUsed = new Date(subscription.last_used)
  const daysSince = (Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24)
  return daysSince >= UNUSED_THRESHOLD_DAYS
}

function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [cycle, setCycle] = useState('monthly')

  async function loadSubscriptions() {
    const { data, error } = await supabase.from('subscriptions').select('*').order('name')

    if (error) {
      console.error('Failed to load subscriptions', error)
      return
    }

    setSubscriptions(data)
  }

  useEffect(() => {
    loadSubscriptions()
  }, [])

  async function handleAdd(e) {
    e.preventDefault()

    const { error } = await supabase.from('subscriptions').insert({
      name,
      price: Number(price),
      cycle,
      active: true,
    })

    if (error) {
      console.log(error.message)
      return
    }

    setName('')
    setPrice('')
    setCycle('monthly')
    loadSubscriptions()
  }

  async function handleToggleActive(subscription) {
    const { error } = await supabase
      .from('subscriptions')
      .update({ active: !subscription.active })
      .eq('id', subscription.id)

    if (error) {
      console.error('Failed to update subscription', error)
      return
    }

    loadSubscriptions()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)

    if (error) {
      console.error('Failed to delete subscription', error)
      return
    }

    loadSubscriptions()
  }

  const activeSubscriptions = subscriptions.filter((subscription) => subscription.active)
  const totalMonthly = activeSubscriptions.reduce(
    (sum, subscription) => sum + monthlyCostFor(subscription),
    0,
  )
  const totalAnnual = totalMonthly * 12

  return (
    <div className="card">
      <h2>Subscriptions</h2>

      <form onSubmit={handleAdd}>
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
        <button type="submit">Add subscription</button>
      </form>

      <div className="total-row">
        <p>Monthly cost</p>
        <p className="money">{formatMoney(totalMonthly)}</p>
      </div>
      <p className="list-row-sub">{formatMoney(totalAnnual)} per year, active subscriptions only</p>

      {subscriptions.length > 0 ? (
        <ul className="list">
          {subscriptions.map((subscription) => (
            <li key={subscription.id} className="list-row">
              <div className="list-row-main">
                <span className="list-row-title">{subscription.name}</span>
                <span className="list-row-sub">
                  {capitalize(subscription.cycle)} · {subscription.active ? 'Active' : 'Paused'}
                </span>
                {isUnused(subscription) && (
                  <span className="unused-note">Unused? Last used {subscription.last_used}</span>
                )}
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
                  onClick={() => handleDelete(subscription.id)}
                  aria-label="Delete subscription"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty-text">No subscriptions yet.</p>
      )}
    </div>
  )
}

export default Subscriptions
