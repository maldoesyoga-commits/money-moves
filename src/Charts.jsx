import { useState } from 'react'

// Small chart set, built from HTML rather than SVG so bars stay crisp at any
// width and every mark is a real focusable element. Colours come from the
// --chart-* tokens, which are defined per theme in index.css.

function Tooltip({ text }) {
  return <span className="chart-tip">{text}</span>
}

// Change over time, one series: vertical bars, newest on the right.
// One series means no legend — the title names it.
export function BarChart({ title, caption, data, unit = '', color = 'var(--chart-1)' }) {
  const [hover, setHover] = useState(null)

  const max = Math.max(...data.map((row) => row.value), 1)
  const total = data.reduce((sum, row) => sum + row.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="card chart-card">
        <h3>{title}</h3>
        <p className="empty-text">Nothing recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        {caption && <span className="list-row-sub">{caption}</span>}
      </div>

      <div className="chart-plot">
        {data.map((row, index) => {
          const last = index === data.length - 1

          return (
            <button
              type="button"
              key={row.label}
              className={`chart-bar-slot${hover === index ? ' is-hover' : ''}`}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(index)}
              onBlur={() => setHover(null)}
              aria-label={`${row.label}: ${row.value}${unit}`}
            >
              {hover === index && <Tooltip text={`${row.label} · ${row.value}${unit}`} />}
              <span className="chart-bar-track">
                <span
                  className="chart-bar-fill"
                  style={{
                    height: `${Math.max((row.value / max) * 100, row.value > 0 ? 4 : 0)}%`,
                    background: color,
                  }}
                />
              </span>
              {/* Only the newest bar is direct-labelled — a number on every
                  bar is noise, and this is the one being asked about. */}
              <span className={`chart-bar-value${last ? ' is-shown' : ''}`}>
                {last ? row.value : ''}
              </span>
              <span className="chart-bar-label">{row.short || row.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Magnitude across named categories: horizontal bars, longest first, every
// bar directly labelled because the label is what's being compared.
export function HBar({ title, caption, data, color = 'var(--chart-2)', to }) {
  const max = Math.max(...data.map((row) => row.value), 1)
  const total = data.reduce((sum, row) => sum + row.value, 0)

  if (data.length === 0 || total === 0) {
    return (
      <div className="card chart-card">
        <h3>{title}</h3>
        <p className="empty-text">Nothing here yet.</p>
      </div>
    )
  }

  return (
    <div className="card chart-card">
      <div className="chart-head">
        <h3>{title}</h3>
        {caption && <span className="list-row-sub">{caption}</span>}
      </div>

      <ul className="hbar-list">
        {data.map((row) => (
          <li className="hbar-row" key={row.label}>
            <span className="hbar-label">{row.label}</span>
            <span className="hbar-track">
              <span
                className="hbar-fill"
                style={{ width: `${(row.value / max) * 100}%`, background: row.color || color }}
              />
            </span>
            <span className="hbar-value">{row.value}</span>
          </li>
        ))}
      </ul>
      {to}
    </div>
  )
}

// A single figure against a target. Not a chart — a meter, which is the right
// form when there's one number and a line it should stay under or over.
export function Meter({ label, value, max, caption, tone = 'var(--chart-1)', target }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0

  return (
    <div className="meter-block">
      <div className="budget-row-header">
        <span className="list-row-title">{label}</span>
        <span className="list-row-sub">{caption}</span>
      </div>
      <div className="meter-track">
        <div className="meter-fill" style={{ width: `${pct}%`, background: tone }} />
        {typeof target === 'number' && (
          <span className="meter-target" style={{ left: `${Math.min(100, target)}%` }} />
        )}
      </div>
    </div>
  )
}
