import { useState } from 'react'
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

const LIMBS_STORAGE_KEY = 'homestead.ss.limbs'
const STATE_ORDER = SS_LIMB_STATES.map((s) => s.value)
const STATE_LABEL = Object.fromEntries(SS_LIMB_STATES.map((s) => [s.value, s.label]))

function loadLimbs() {
  try {
    const saved = localStorage.getItem(LIMBS_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {
    // ignore
  }
  return {}
}

function StabilityStudio() {
  const [limbs, setLimbs] = useState(loadLimbs)

  function cycleLimb(key) {
    setLimbs((prev) => {
      const current = prev[key] || 'unset'
      const nextIndex = (STATE_ORDER.indexOf(current) + 1) % STATE_ORDER.length
      const next = { ...prev, [key]: STATE_ORDER[nextIndex] }
      try {
        localStorage.setItem(LIMBS_STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
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
          <span className="list-row-sub">tap to check in</span>
        </div>
        <p className="brand-hint ss-limbs-hint">
          You don’t balance life — you tend to your limbs. None are meant to be perfect; some
          are rebuilding. Tap a limb to note how it feels today (private, saved on this device).
        </p>
        <div className="ss-limbs">
          {SS_LIMBS.map((limb) => {
            const state = limbs[limb.key] || 'unset'
            return (
              <button
                key={limb.key}
                type="button"
                className={`ss-limb ss-limb-${state}`}
                onClick={() => cycleLimb(limb.key)}
              >
                <span className="ss-limb-icon">{limb.icon}</span>
                <span className="ss-limb-label">{limb.label}</span>
                <span className="ss-limb-state">{STATE_LABEL[state]}</span>
              </button>
            )
          })}
        </div>
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
