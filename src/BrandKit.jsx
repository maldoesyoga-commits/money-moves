import { useEffect, useState } from 'react'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const EMPTY_FIELDS = {
  tagline: '',
  heading_font: '',
  body_font: '',
  logo_url: '',
  wordmark_url: '',
  submark_url: '',
}

const LOGO_SLOTS = [
  { field: 'logo_url', label: 'Primary logo' },
  { field: 'wordmark_url', label: 'Wordmark' },
  { field: 'submark_url', label: 'Submark / icon' },
]

function BrandKit() {
  const { kit, kitRow, saveKitField, fonts } = useBrand()

  const [fields, setFields] = useState(EMPTY_FIELDS)
  const [copied, setCopied] = useState(null)
  const [showVoice, setShowVoice] = useState(false)

  useEffect(() => {
    setFields({
      tagline: kitRow?.tagline || '',
      heading_font: kitRow?.heading_font || '',
      body_font: kitRow?.body_font || '',
      logo_url: kitRow?.logo_url || '',
      wordmark_url: kitRow?.wordmark_url || '',
      submark_url: kitRow?.submark_url || '',
    })
  }, [kitRow])

  function updateLocal(field, value) {
    setFields((prev) => ({ ...prev, [field]: value }))
  }

  function copyHex(hex) {
    try {
      navigator.clipboard.writeText(hex)
      setCopied(hex)
      setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1200)
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const tagline = fields.tagline || kit.tagline
  const headingFont = fields.heading_font || fonts.heading
  const bodyFont = fields.body_font || fonts.body

  return (
    <div className="brand-kit">
      {tagline && (
        <div className="card brand-tagline-card">
          <span className="brand-kit-eyebrow">Tagline</span>
          <p className="brand-tagline" style={{ fontFamily: headingFont }}>
            {tagline}
          </p>
        </div>
      )}

      {/* Palette */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Colour palette</h2>
          <span className="list-row-sub">tap a swatch to copy</span>
        </div>

        {kit.palette.length === 0 ? (
          <EmptyState icon="🎨" title="Palette coming soon">
            We&apos;ll pull {kit.name}&apos;s colours in when we build out this brand.
          </EmptyState>
        ) : (
          <div className="palette-grid">
            {kit.palette.map((swatch) => (
              <button
                key={swatch.hex}
                type="button"
                className="swatch"
                onClick={() => copyHex(swatch.hex)}
                title={`Copy ${swatch.hex}`}
              >
                <span className="swatch-chip" style={{ background: swatch.hex }} />
                <span className="swatch-name">{swatch.name}</span>
                <span className="swatch-hex">
                  {copied === swatch.hex ? 'Copied ✓' : swatch.hex}
                </span>
                <span className="swatch-note">{swatch.note}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Typography */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Typography</h2>
        </div>
        <div className="brand-field">
          <label className="brand-field-label" htmlFor="heading-font">
            Heading font
          </label>
          <input
            id="heading-font"
            type="text"
            value={fields.heading_font}
            placeholder={kit.headingFont || 'Georgia, serif'}
            onChange={(e) => updateLocal('heading_font', e.target.value)}
            onBlur={(e) => saveKitField('heading_font', e.target.value)}
          />
          <p className="font-preview" style={{ fontFamily: headingFont }}>
            The quiet part, said plainly.
          </p>
        </div>
        <div className="brand-field">
          <label className="brand-field-label" htmlFor="body-font">
            Body font
          </label>
          <input
            id="body-font"
            type="text"
            value={fields.body_font}
            placeholder={kit.bodyFont || 'system-ui, sans-serif'}
            onChange={(e) => updateLocal('body_font', e.target.value)}
            onBlur={(e) => saveKitField('body_font', e.target.value)}
          />
          <p className="font-preview font-preview-body" style={{ fontFamily: bodyFont }}>
            Rest is infrastructure, not a reward. Small steps still count.
          </p>
        </div>
      </div>

      {/* Logos */}
      <div className="card">
        <div className="project-scope-header">
          <h2>Logos</h2>
          <span className="list-row-sub">paste an image URL</span>
        </div>
        <div className="logo-grid">
          {LOGO_SLOTS.map((slot) => {
            const url = fields[slot.field]
            return (
              <div key={slot.field} className="logo-slot">
                <div className="logo-preview">
                  {url ? (
                    <img src={url} alt={`${kit.name} ${slot.label}`} />
                  ) : (
                    <span className="logo-placeholder">No image yet</span>
                  )}
                </div>
                <span className="brand-field-label">{slot.label}</span>
                <input
                  type="url"
                  value={url}
                  placeholder="https://…"
                  onChange={(e) => updateLocal(slot.field, e.target.value)}
                  onBlur={(e) => saveKitField(slot.field, e.target.value)}
                />
              </div>
            )
          })}
        </div>
        <p className="brand-hint">
          Tip: in Google Drive, right-click an image → Share → set to “Anyone with the
          link”, then paste the link here.
        </p>
      </div>

      {/* Voice at a glance */}
      {kit.ready && (
        <div className="card">
          <div className="project-scope-header">
            <h2>Voice at a glance</h2>
            <button
              type="button"
              className="row-action-btn"
              onClick={() => setShowVoice((open) => !open)}
            >
              {showVoice ? 'Hide' : 'Show'}
            </button>
          </div>

          {showVoice && (
            <div className="voice-block">
              <span className="brand-kit-eyebrow">Words that feel aligned</span>
              <div className="voice-chips">
                {kit.voice.aligned.map((word) => (
                  <span key={word} className="voice-chip">
                    {word}
                  </span>
                ))}
              </div>

              <span className="brand-kit-eyebrow">Words we don&apos;t use</span>
              <div className="voice-chips">
                {kit.voice.banned.map((word) => (
                  <span key={word} className="voice-chip voice-chip-banned">
                    {word}
                  </span>
                ))}
              </div>

              {kit.pillars.length > 0 && (
                <>
                  <span className="brand-kit-eyebrow">Content pillars</span>
                  <ul className="voice-pillars">
                    {kit.pillars.map((pillar) => (
                      <li key={pillar}>{pillar}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default BrandKit
