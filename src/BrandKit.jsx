import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'
import EmptyState from './EmptyState'

const EMPTY_EDITABLE = {
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

const DEFAULT_HEADING_FONT = 'Georgia, "Times New Roman", serif'
const DEFAULT_BODY_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

function BrandKit() {
  const { brand, kit } = useBrand()

  const [editable, setEditable] = useState(EMPTY_EDITABLE)
  const [copied, setCopied] = useState(null)
  const [showVoice, setShowVoice] = useState(false)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_kit')
      .select('*')
      .eq('brand', brand)
      .maybeSingle()

    if (error) {
      // The brand_kit table may not exist yet — the tab still works from
      // the built-in kit; saving turns on once supabase/brand.sql is run.
      console.log('brand_kit not loaded (run supabase/brand.sql to enable saving):', error.message)
      setEditable(EMPTY_EDITABLE)
      return
    }

    setEditable({ ...EMPTY_EDITABLE, ...(data || {}) })
  }, [brand])

  useEffect(() => {
    load()
  }, [load])

  function updateLocal(field, value) {
    setEditable((prev) => ({ ...prev, [field]: value }))
  }

  async function persist(field, value) {
    const clean = value.trim() ? value.trim() : null
    setEditable((prev) => ({ ...prev, [field]: clean || '' }))

    const { error } = await supabase
      .from('brand_kit')
      .upsert(
        { brand, [field]: clean, updated_at: new Date().toISOString() },
        { onConflict: 'brand' },
      )

    if (error) {
      console.log('Could not save brand kit (run supabase/brand.sql?):', error.message)
    }
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

  const tagline = editable.tagline || kit.tagline
  const headingFont = editable.heading_font || DEFAULT_HEADING_FONT
  const bodyFont = editable.body_font || DEFAULT_BODY_FONT

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
            value={editable.heading_font}
            placeholder={DEFAULT_HEADING_FONT}
            onChange={(e) => updateLocal('heading_font', e.target.value)}
            onBlur={(e) => persist('heading_font', e.target.value)}
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
            value={editable.body_font}
            placeholder={DEFAULT_BODY_FONT}
            onChange={(e) => updateLocal('body_font', e.target.value)}
            onBlur={(e) => persist('body_font', e.target.value)}
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
            const url = editable[slot.field]
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
                  onBlur={(e) => persist(slot.field, e.target.value)}
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
