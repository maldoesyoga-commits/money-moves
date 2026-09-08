import { useState } from 'react'

// Plain-language definitions, kept next to the fields they explain. The
// distinction that trips everyone up is aim vs goal vs objective vs tactic —
// each one is narrower than the one before it.
export const TERMS = [
  {
    term: 'Vision',
    short: 'Years out.',
    text: 'Where all of this is heading, well past twelve weeks. The cycle is a down payment on it.',
  },
  {
    term: 'Aim',
    short: 'The ambition. No numbers.',
    text: 'The broad thing you are reaching for, in one line — "Hope Heals supports itself without me chasing every client." An aim has no number and no deadline; it is the direction the goal points in.',
  },
  {
    term: 'Goal',
    short: 'The aim, narrowed to twelve weeks, with a number.',
    text: 'The same ambition cut down to something you could genuinely finish by the end of the cycle, with a lag measure attached — "six retainer clients by Dec 12". At the end you either hit it or you did not.',
  },
  {
    term: 'Objective',
    short: 'Milestones. Ticked once each.',
    text: 'The handful of things that have to be true for the goal to land — "pricing page live", "three referral partners signed". They are done or not done, not repeated weekly. If it happens every week, it is a tactic.',
  },
  {
    term: 'Tactic',
    short: 'The weekly action you control.',
    text: 'What you actually do, on a cadence — "two outreach emails a week". This is the only thing the execution score measures. Outcomes are not in your hands week to week; these are.',
  },
]

function GoalsGlossary() {
  const [open, setOpen] = useState(false)

  return (
    <div className="card">
      <div className="project-scope-header">
        <h2>How the pieces fit</h2>
        <button type="button" className="row-action-btn" onClick={() => setOpen(!open)}>
          {open ? 'Hide' : 'Explain'}
        </button>
      </div>

      <p className="list-row-sub">
        Vision → aim → goal → objectives → tactics. Each one is narrower than the one
        before it, and only the last one gets scored.
      </p>

      {open && (
        <ul className="list">
          {TERMS.map(({ term, short, text }) => (
            <li className="list-row" key={term}>
              <div className="list-row-main">
                <span className="list-row-title">
                  {term} <span className="list-row-sub">— {short}</span>
                </span>
                <span className="list-row-sub">{text}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default GoalsGlossary
