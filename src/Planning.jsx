import { useMemo, useState } from 'react'
import { todayISO } from './lib/taskDates'
import {
  HORIZONS,
  periodRange,
  shiftPeriod,
  periodLabel,
  isCurrentPeriod,
} from './lib/planPeriods'
import CyclePanel from './CyclePanel'
import PlanningDay from './PlanningDay'
import PlanningWeek from './PlanningWeek'
import PlanningMonth from './PlanningMonth'
import PlanningQuarter from './PlanningQuarter'
import PlanningYear from './PlanningYear'

// A shell: pick a horizon and a period, then hand off to the view that
// knows how to plan at that scale.
function Planning() {
  const [horizon, setHorizon] = useState('week')
  const [anchor, setAnchor] = useState(todayISO())
  const [cameFrom, setCameFrom] = useState(null)

  const { start, end } = useMemo(() => periodRange(horizon, anchor), [horizon, anchor])

  function goTo(nextHorizon, nextAnchor, from = null) {
    setAnchor(nextAnchor)
    setHorizon(nextHorizon)
    setCameFrom(from)
  }

  return (
    <section className="planning-module">
      <div className="home-greeting">
        <h1>Planning</h1>
        <p className="list-row-sub">Zoom in on a day, or out to the whole year.</p>
      </div>

      <nav className="segmented-nav">
        {HORIZONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={`segmented-tab${horizon === key ? ' active' : ''}`}
            onClick={() => {
              setHorizon(key)
              setCameFrom(null)
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="period-selector">
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, -1))}
          aria-label="Previous period"
        >
          ‹
        </button>
        <div className="period-selector-label">
          <span>{periodLabel(horizon, anchor)}</span>
          {!isCurrentPeriod(horizon, anchor) && (
            <button
              type="button"
              className="period-today-link"
              onClick={() => setAnchor(todayISO())}
            >
              Back to today
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => setAnchor(shiftPeriod(horizon, anchor, 1))}
          aria-label="Next period"
        >
          ›
        </button>
      </div>

      {horizon === 'day' && (
        <PlanningDay
          date={anchor}
          backLabel={cameFrom}
          onBackToMonth={cameFrom ? () => goTo(cameFrom, anchor) : null}
        />
      )}

      {horizon === 'week' && (
        <>
          <CyclePanel horizon={horizon} start={start} end={end} />
          <PlanningWeek start={start} end={end} onPickDay={(iso) => goTo('day', iso, 'week')} />
        </>
      )}

      {horizon === 'month' && (
        <PlanningMonth
          anchor={anchor}
          start={start}
          end={end}
          onPickDay={(iso) => goTo('day', iso, 'month')}
        />
      )}

      {horizon === 'quarter' && (
        <PlanningQuarter
          anchor={anchor}
          start={start}
          end={end}
          onPickWeek={(iso) => goTo('week', iso)}
          onPickMonth={(iso) => goTo('month', iso)}
        />
      )}

      {horizon === 'year' && (
        <PlanningYear
          start={start}
          end={end}
          onPickMonth={(iso) => goTo('month', iso)}
          onPickQuarter={(iso) => goTo('quarter', iso)}
        />
      )}
    </section>
  )
}

export default Planning
