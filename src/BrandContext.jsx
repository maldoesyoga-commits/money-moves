import { useCallback, useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { BrandContext } from './lib/brandContextObject'
import { BRANDS, BRAND_KITS } from './lib/brandKit'

const STORAGE_KEY = 'homestead.brand'
const DEFAULT_HEADING_FONT = 'Georgia, "Times New Roman", serif'
const DEFAULT_BODY_FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif'

export function BrandProvider({ children }) {
  const [brand, setBrandState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved && BRANDS.some((b) => b.value === saved)) return saved
    } catch {
      // localStorage unavailable — fall back to default
    }
    return 'cm'
  })

  const [kitRow, setKitRow] = useState(null)

  function setBrand(next) {
    setBrandState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore write failures
    }
  }

  const loadKit = useCallback(async () => {
    const { data, error } = await supabase
      .from('brand_kit')
      .select('*')
      .eq('brand', brand)
      .maybeSingle()

    if (error) {
      // brand_kit table may not exist yet — the kit still renders from constants
      setKitRow(null)
      return
    }

    setKitRow(data || null)
  }, [brand])

  useEffect(() => {
    loadKit()
  }, [loadKit])

  useEffect(() => {
    document.documentElement.setAttribute('data-brand', brand)
  }, [brand])

  async function saveKitField(field, value) {
    const clean = value && value.trim() ? value.trim() : null
    setKitRow((prev) => ({ ...(prev || { brand }), [field]: clean }))

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

  const kit = BRAND_KITS[brand]
  const headingFont = (kitRow && kitRow.heading_font) || kit.headingFont || DEFAULT_HEADING_FONT
  const bodyFont = (kitRow && kitRow.body_font) || kit.bodyFont || DEFAULT_BODY_FONT

  const value = {
    brand,
    setBrand,
    brands: BRANDS,
    kit,
    kitRow,
    saveKitField,
    reloadKit: loadKit,
    fonts: { heading: headingFont, body: bodyFont },
  }

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}
