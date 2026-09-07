import { useEffect, useRef, useState } from 'react'
import { supabase } from './lib/supabase'
import { getPeriodContaining, getPreviousPeriod, getNextPeriod } from './lib/period'
import { PeriodContext } from './lib/periodContextObject'

export function PeriodProvider({ children }) {
  const [statementDay, setStatementDay] = useState(1)
  const [period, setPeriod] = useState(() => getPeriodContaining(new Date(), 1))
  const initialized = useRef(false)

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase.from('settings').select('statement_day').single()

      if (error) {
        console.error('Failed to load settings for period', error)
        return
      }

      const day = Number(data?.statement_day) || 1
      setStatementDay(day)

      if (!initialized.current) {
        initialized.current = true
        setPeriod(getPeriodContaining(new Date(), day))
      }
    }

    loadSettings()
  }, [])

  function goToPrevious() {
    setPeriod((current) => getPreviousPeriod(current, statementDay))
  }

  function goToNext() {
    setPeriod((current) => getNextPeriod(current, statementDay))
  }

  function goToCurrent() {
    setPeriod(getPeriodContaining(new Date(), statementDay))
  }

  const value = { period, statementDay, goToPrevious, goToNext, goToCurrent }

  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>
}
