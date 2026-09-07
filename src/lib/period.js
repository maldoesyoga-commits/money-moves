export function toDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function clampedStatementDate(year, monthIndex, statementDay) {
  const day = Math.min(Math.max(statementDay, 1), daysInMonth(year, monthIndex))
  return new Date(year, monthIndex, day)
}

export function getPeriodContaining(date, statementDay) {
  const day = statementDay && statementDay > 0 ? statementDay : 1
  const year = date.getFullYear()
  const monthIndex = date.getMonth()

  const candidateStart = clampedStatementDate(year, monthIndex, day)

  let startYear = year
  let startMonth = monthIndex
  if (date.getDate() < candidateStart.getDate()) {
    startMonth -= 1
    if (startMonth < 0) {
      startMonth = 11
      startYear -= 1
    }
  }

  const periodStart = clampedStatementDate(startYear, startMonth, day)

  let endYear = startYear
  let endMonth = startMonth + 1
  if (endMonth > 11) {
    endMonth = 0
    endYear += 1
  }
  const nextStart = clampedStatementDate(endYear, endMonth, day)
  const periodEnd = new Date(nextStart)
  periodEnd.setDate(periodEnd.getDate() - 1)

  return {
    start: periodStart,
    end: periodEnd,
    startKey: toDateKey(periodStart),
    endKey: toDateKey(periodEnd),
  }
}

export function getPreviousPeriod(period, statementDay) {
  const dayBefore = new Date(period.start)
  dayBefore.setDate(dayBefore.getDate() - 1)
  return getPeriodContaining(dayBefore, statementDay)
}

export function getNextPeriod(period, statementDay) {
  const dayAfter = new Date(period.end)
  dayAfter.setDate(dayAfter.getDate() + 1)
  return getPeriodContaining(dayAfter, statementDay)
}

export function getRecentPeriods(period, statementDay, count) {
  const periods = [period]
  let current = period
  for (let i = 1; i < count; i++) {
    current = getPreviousPeriod(current, statementDay)
    periods.unshift(current)
  }
  return periods
}

export function periodLabel(period, statementDay) {
  if (!statementDay || statementDay <= 1) {
    return period.start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }
  const startLabel = period.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endLabel = period.end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function periodShortLabel(period, statementDay) {
  if (!statementDay || statementDay <= 1) {
    return period.start.toLocaleDateString('en-US', { month: 'short' })
  }
  return period.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function isSamePeriod(a, b) {
  return a.startKey === b.startKey && a.endKey === b.endKey
}
