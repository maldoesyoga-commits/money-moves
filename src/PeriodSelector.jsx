import { usePeriod } from './usePeriod'
import { periodLabel, getPeriodContaining, isSamePeriod } from './lib/period'

function PeriodSelector() {
  const { period, statementDay, goToPrevious, goToNext, goToCurrent } = usePeriod()
  const current = getPeriodContaining(new Date(), statementDay)
  const isCurrent = isSamePeriod(period, current)

  return (
    <div className="period-selector">
      <button
        type="button"
        className="icon-button"
        onClick={goToPrevious}
        aria-label="Previous period"
      >
        ‹
      </button>
      <div className="period-selector-label">
        <span>{periodLabel(period, statementDay)}</span>
        {!isCurrent && (
          <button type="button" className="period-today-link" onClick={goToCurrent}>
            Jump to current
          </button>
        )}
      </div>
      <button type="button" className="icon-button" onClick={goToNext} aria-label="Next period">
        ›
      </button>
    </div>
  )
}

export default PeriodSelector
