import { useContext } from 'react'
import { BrandContext } from './lib/brandContextObject'

export function useBrand() {
  const context = useContext(BrandContext)
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider')
  }
  return context
}
