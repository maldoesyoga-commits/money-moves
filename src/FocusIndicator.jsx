import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readFocus, onFocusChange, remainingMs, formatClock } from './lib/focus'

// A running timer follows you around the app — otherwise you navigate away
// and forget it exists.
function FocusIndicator() {
  const [state, setState] = useState(readFocus)
  const [, setTick] = useState(0)

  useEffect(() => onFocusChange(setState), [])

  useEffect(() => {
    if (!state) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [state])

  if (!state) return null

  const left = remainingMs(state)
  const done = left === 0

  return (
    <Link
      to="/focus"
      className={`focus-chip${done ? ' done' : ''}${state.pausedLeft !== null ? ' paused' : ''}`}
    >
      {done ? 'done' : formatClock(left)}
    </Link>
  )
}

export default FocusIndicator
