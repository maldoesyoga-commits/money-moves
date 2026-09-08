import { useEffect, useState } from 'react'
import { BrandContext } from './lib/brandContextObject'
import { BRANDS, BRAND_KITS } from './lib/brandKit'

const STORAGE_KEY = 'homestead.brand'

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

  function setBrand(next) {
    setBrandState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore write failures
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-brand', brand)
  }, [brand])

  const value = {
    brand,
    setBrand,
    brands: BRANDS,
    kit: BRAND_KITS[brand],
  }

  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>
}
