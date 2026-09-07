import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import { sleepHours, formatSleep, shiftDate, streakFrom } from './lib/daily'
import EmptyState from './EmptyState'

const RANGES = [
  { key: 14, label: '2 weeks' },
  { key: 30, label: '30 days' },
  { key: 90, label: '90 days' },
]

function average(values) {
  const real = values.filter((value) => value !== null && value !== undefined)
  if (real.length === 0) return null
  return real.reduce((sum, value) => sum + value, 0) / real.length
}

function DailyHistory() {
  const [logs, setLogs] = useState([])
  const [days, setDays] = useState(14)

  const load = useCallback(async () => {
    const from = shiftDate(todayISO(), -(days - 1))

    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .gte('entry_date', from)
      .order('entry_date', { ascending: false })

    if (error) {
      console.log('Failed to load daily history', error.message)
      return
    }

    setLogs(data)
  }, [days])

  useEffect(() => {
    load()
  }, [load])

  const avgHappiness = average(logs.map((log) => log.happiness))
  const avgEnergy = average(logs.map((log) => log.energy))
  const avgSleep = average(logs.map((log) => sleepHours(log.bedtime, log.wake_time)))
  const avgWater = average(logs.map((log) => log.water_glasses))
  const loggedStreak = streakFrom(logs.map((log) => log.entry_date), todayISO())

  const stats = [
    { label: 'Avg happiness', value: avgHappiness ? avgHappiness.toFixed(1) : '—' },
    { label: 'Avg energy', value: avgEnergy ? avgEnergy.toFixed(1) : '—' },
    { label: 'Avg sleep', value: avgSleep ? formatSleep(avgSleep) : '—' },
    { label: 'Avg water', value: avgWater ? avgWater.toFixed(1) : '—' },
    { label: 'Days logged', value: `${logs.length}/${days}` },
    { label: 'Current streak', value: loggedStreak },
  ]

  return (
    <>
      <nav className="view-tabs history-tabs">
        {RANGES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`view-tab${days === key ? ' active' : ''}`}
            onClick={() => setDays(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="review-grid">
        {stats.map((stat) => (
          <div key={stat.label} className="review-stat">
            <span className="review-stat-value">{stat.value}</span>
            <span className="review-stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Day by day</h2>

        {logs.length === 0 ? (
          <EmptyState icon="📈" title="Nothing logged yet">
            Fill in a day or two on the Today tab and the averages and patterns show up
            here — whether short sleep tracks with low energy, that sort of thing.
          </EmptyState>
        ) : (
          <div className="table-scroll">
            <table className="review-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Sleep</th>
                  <th>Happy</th>
                  <th>Energy</th>
                  <th>Water</th>
                  <th>Words</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const hours = sleepHours(log.bedtime, log.wake_time)

                  return (
                    <tr key={log.id}>
                      <td>{log.entry_date}</td>
                      <td>{hours ? formatSleep(hours) : '—'}</td>
                      <td>{log.happiness ?? '—'}</td>
                      <td>{log.energy ?? '—'}</td>
                      <td>
                        {log.water_glasses}/{log.water_goal}
                      </td>
                      <td>{(log.mood_words || []).join(', ') || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {logs.some((log) => log.morning_gratitude || log.evening_gratitude) && (
        <div className="card">
          <h2>Gratitude</h2>
          <ul className="list">
            {logs
              .filter((log) => log.morning_gratitude || log.evening_gratitude)
              .map((log) => (
                <li key={log.id} className="list-row">
                  <div className="list-row-main">
                    <span className="list-row-title">
                      {log.evening_gratitude || log.morning_gratitude}
                    </span>
                    <span className="list-row-sub">{log.entry_date}</span>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </>
  )
}

export default DailyHistory
