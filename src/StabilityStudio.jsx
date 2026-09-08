import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { todayISO } from './lib/taskDates'
import {
  SS_DOC_URL,
  SS_INTRO,
  SS_TRUTHS,
  SS_LIMBS,
  SS_LIMB_STATES,
  SS_PHASES,
  SS_SEASON_ONE,
  SS_TONE,
} from './lib/stabilityStudio'

const STATE_ORDER = SS_LIMB_STATES.map((s) => s.value)
const STATE_LABEL = Object.fromEntries(SS_LIMB_STATES.map((s) => [s.value, s.label]))

function formatDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function StabilityStudio() {
  const today = todayISO()

  const [limbs, setLimbs] = useState({})
  const [history, setHistory] = useState([])

  const load = useCallback(async () => {
    const todayRes = await supabase
      .from('stability_checkins')
      .select('limbs')
      .eq('checkin_date', today)
      .maybeSingle()

    if (todayRes.error) {
      // Table may not exist yet — the check-in still works in the session,
      // saving turns on once supabase/stability.sql is run.
      console.log('stability_checkins not loaded (run supabase/stability.sql?):', todayRes.error.message)
    } else {
      setLimbs(todayRes.data?.limbs || {})
    }

    const histRes = await supabase
      .from('stability_checkins')
      .select('checkin_date, limbs')
      .lt('checkin_date', today)
      .order('checkin_date', { ascending: false })
      .limit(14)

    if (!histRes.error && histRes.data) setHistory(histRes.data)
  }, [today])

  useEffect(() => {
    load()
  }, [load])

  async function save(next) {
    setLimbs(next)
    const { error } = await supabase
      .from('stability_checkins')
      .upsert({ checkin_date: today, limbs: next }, { onConflict: 'user_id,checkin_date' })
    if (error) {
      console.log('Could not save check-in (run supabase/stability.sql?):', error.message)
    }
  }

  function cycleLimb(key) {
    const current = limbs[key]?.state || 'unset'
    const nextState = STATE_ORDER[(STATE_ORDER.indexOf(current) + 1) % STATE_ORDER.length]
    save({ ...limbs, [key]: { ...(limbs[key] || {}), state: nextState } })
  }

  function setNoteLocal(key, note) {
    setLimbs((prev) => ({ ...prev, [key]: { ...(prev[key] || {}), note } }))
  }

  function persistNote(key, note) {
    const clean = note.trim() ? note.trim() : undefined
    const next = { ...limbs, [key]: { ...(limbs[key] || {}), note: clean } }
    save(next)
  }

  return (
    <div className="brand-tab-body ss">
      {/* Intro */}
      <div className="card ss-hero">
        <span className="brand-kit-eyebrow">Stability Studio</span>
        <p className="ss-tagline">{SS_INTRO.tagline}</p>
        <p className="ss-what">{SS_INTRO.what}</p>
        <p className="ss-north">{SS_INTRO.north}</p>
        <a href={SS_DOC_URL} target="_blank" rel="noreferrer" className="row-action-btn ss-doc-link">
          Open the framework doc ↗
        </a>
      </div>

      {/* Five truths */}
      <div className="card">
        <div className="project-scope-header">
          <h2>The five truths</h2>
        </div>
        <ol className="ss-truths">
          {SS_TRUTHS.map((truth) => (
            <li key={truth.title}>
              <span className="ss-truth-title">{truth.title}</span>
              <span className="ss-truth-note">{truth.note}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Limbs check-in */}
      <div className="card">
        <div className="project-scope-header">
          <h2>The limbs we live</h2>
          <span className="list-row-sub">today’s check-in</span>
        </div>
        <p className="brand-hint ss-limbs-hint">
          You don’t balance life — you tend to your limbs. Tap a limb’s state to move it through
          strong, rebuilding, needs care; add a short note if you want. Saved by day, so you can
          look back gently.
        </p>
        <ul className="ss-limb-list">
          {SS_LIMBS.map((limb) => {
            const entry = limbs[limb.key] || {}
            const state = entry.state || 'unset'
            return (
              <li key={limb.key} className={`ss-limb-row ss-limb-${state}`}>
                <span className="ss-limb-icon">{limb.icon}</span>
                <div className="ss-limb-body">
                  <span className="ss-limb-label">{limb.label}</span>
                  <input
                    type="text"
                    className="ss-limb-note"
                    value={entry.note || ''}
                    placeholder="a short note (optional)"
                    onChange={(e) => setNoteLocal(limb.key, e.target.value)}
                    onBlur={(e) => persistNote(limb.key, e.target.value)}
                  />
                </div>
                <button
                  type="button"
                  className={`ss-limb-state-btn state-${state}`}
                  onClick={() => cycleLimb(limb.key)}
                >
                  {STATE_LABEL[state]}
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* History */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Looking back</h2>
          <span className="list-row-sub">{history.length}</span>
        </div>
        {history.length === 0 ? (
          <p className="empty-text">Your past check-ins will gather here, one day at a time.</p>
        ) : (
          <ul className="list">
            {history.map((row) => {
              const flagged = SS_LIMBS.filter((l) => {
                const s = row.limbs?.[l.key]?.state
                return s === 'injured' || s === 'rebuilding'
              })
              return (
                <li key={row.checkin_date} className="list-row">
                  <div className="task-row-body">
                    <div className="list-row-main task-main">
                      <span className="list-row-title">{formatDate(row.checkin_date)}</span>
                      <span className="ss-history-chips">
                        {flagged.length > 0 ? (
                          flagged.map((l) => (
                            <span key={l.key} className="ss-hist-chip" title={l.label}>
                              {l.icon}
                            </span>
                          ))
                        ) : (
                          <span className="list-row-sub">all steady</span>
                        )}
                      </span>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* The journey */}
      <div className="card">
        <div className="project-scope-header">
          <h2>The journey</h2>
          <span className="list-row-sub">Land → Root → Grow</span>
        </div>
        <div className="ss-phases">
          {SS_PHASES.map((phase) => (
            <div className={`ss-phase ss-phase-${phase.key}`} key={phase.key}>
              <div className="ss-phase-head">
                <span className="ss-phase-name">{phase.name}</span>
                <span className="ss-phase-theme">{phase.theme}</span>
              </div>
              <p className="ss-phase-focus">{phase.focus}</p>
              <ul className="ss-phase-tools">
                {phase.tools.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
              <p className="ss-phase-outcome">“{phase.outcome}”</p>
            </div>
          ))}
        </div>
      </div>

      {/* Season One */}
      <div className="card">
        <div className="project-scope-header">
          <h2>{SS_SEASON_ONE.name}</h2>
        </div>
        <p className="ss-season-promise">{SS_SEASON_ONE.promise}</p>
        <div className="ss-pillars">
          {SS_SEASON_ONE.pillars.map((pillar) => (
            <div className="ss-pillar" key={pillar.title}>
              <h3 className="ss-pillar-title">{pillar.title}</h3>
              <ul>
                {pillar.prompts.map((prompt) => (
                  <li key={prompt}>{prompt}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Emotional tone */}
      <div className="card brand-help-card">
        <span className="brand-kit-eyebrow">It should feel like</span>
        <ul className="ss-tone">
          {SS_TONE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default StabilityStudio
