// Focus timer state lives in localStorage so it keeps running while you
// move around the app, and survives a refresh. The only thing stored is
// when the block ends — the countdown is derived from the clock.

const KEY = 'homestead-focus'
export const DEFAULT_MINUTES = 50

export function readFocus() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function writeFocus(state) {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state))
    else localStorage.removeItem(KEY)
  } catch {
    // Private window — the timer just won't survive a refresh.
  }

  window.dispatchEvent(new CustomEvent('homestead-focus-change'))
}

export function onFocusChange(handler) {
  const listener = () => handler(readFocus())
  window.addEventListener('homestead-focus-change', listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener('homestead-focus-change', listener)
    window.removeEventListener('storage', listener)
  }
}

export function startFocus({ minutes = DEFAULT_MINUTES, label = '', taskId = null }) {
  writeFocus({
    endsAt: Date.now() + minutes * 60000,
    minutes,
    label,
    taskId,
    startedAt: Date.now(),
    pausedLeft: null,
  })
}

export function pauseFocus(state) {
  if (!state || state.pausedLeft !== null) return
  writeFocus({ ...state, pausedLeft: Math.max(0, state.endsAt - Date.now()) })
}

export function resumeFocus(state) {
  if (!state || state.pausedLeft === null) return
  writeFocus({ ...state, endsAt: Date.now() + state.pausedLeft, pausedLeft: null })
}

export function clearFocus() {
  writeFocus(null)
}

export function remainingMs(state) {
  if (!state) return 0
  if (state.pausedLeft !== null) return state.pausedLeft
  return Math.max(0, state.endsAt - Date.now())
}

export function formatClock(ms) {
  const total = Math.ceil(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
}
