import { useEffect, useState } from 'react'

const KEY = 'homestead-theme'

function readStored() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function ThemeToggle() {
  const [theme, setTheme] = useState(() => readStored() || 'system')

  useEffect(() => {
    const root = document.documentElement

    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)

    try {
      localStorage.setItem(KEY, theme)
    } catch {
      // Private windows and blocked storage — the theme just won't persist.
    }
  }, [theme])

  const next = { system: 'light', light: 'dark', dark: 'system' }
  const icon = { system: '◑', light: '☀', dark: '☾' }
  const label = { system: 'Match my device', light: 'Light', dark: 'Dark' }

  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      onClick={() => setTheme(next[theme])}
      title={label[theme]}
      aria-label={`Theme: ${label[theme]}`}
    >
      {icon[theme]}
    </button>
  )
}

export default ThemeToggle
