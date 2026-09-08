import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { useBrand } from './useBrand'

const PAGES = [
  { key: 'kit', icon: '🎨', name: 'Brand Kit', tagline: 'Palette, fonts, logos, voice', to: '/brand/kit' },
  { key: 'strategy', icon: '🧭', name: 'Strategy', tagline: 'Positioning & identity docs', to: '/brand/strategy' },
  { key: 'moodboard', icon: '🖼️', name: 'Mood Board', tagline: 'The visual vibe', to: '/brand/moodboard' },
  { key: 'calendar', icon: '🗓️', name: 'Calendar', tagline: 'Content across four views', to: '/brand/calendar' },
  { key: 'hashtags', icon: '#️⃣', name: 'Hashtags', tagline: 'Banks & sets of five', to: '/brand/hashtags' },
  { key: 'products', icon: '🌱', name: 'Products & Offers', tagline: 'What you sell', to: '/brand/products' },
  { key: 'insights', icon: '📊', name: 'Insights', tagline: 'Pipeline & performance', to: '/brand/insights' },
  { key: 'resources', icon: '🔗', name: 'Resources', tagline: 'Your Drive links', to: '/brand/resources' },
  { key: 'studio', icon: '🕯️', name: 'Stability Studio', tagline: 'The framework', to: '/brand/studio', cmOnly: true },
]

function pad(n) {
  return String(n).padStart(2, '0')
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function BrandHome() {
  const { brand, kit } = useBrand()
  const [counts, setCounts] = useState({})

  const pages = PAGES.filter((page) => !page.cmOnly || brand === 'cm')

  const loadCounts = useCallback(async () => {
    async function countOf(table, refine) {
      try {
        let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('brand', brand)
        if (refine) q = refine(q)
        const { count, error } = await q
        return error ? null : count || 0
      } catch {
        return null
      }
    }

    const now = new Date()
    const monthStart = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const monthEnd = `${nextMonth.getFullYear()}-${pad(nextMonth.getMonth() + 1)}-01`

    const [strategy, moodboard, calendar, hashtags, products, insights, resources] =
      await Promise.all([
        countOf('brand_docs'),
        countOf('brand_moodboard'),
        countOf('content_items', (q) => q.gte('publish_date', monthStart).lt('publish_date', monthEnd)),
        countOf('hashtag_banks'),
        countOf('brand_offers', (q) => q.eq('status', 'live')),
        countOf('performance_log'),
        countOf('brand_links'),
      ])

    setCounts({ strategy, moodboard, calendar, hashtags, products, insights, resources })
  }, [brand])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  function statFor(key) {
    const c = counts[key]
    if (c === null || c === undefined || c === 0) return null
    switch (key) {
      case 'strategy':
        return plural(c, 'doc')
      case 'moodboard':
        return plural(c, 'image')
      case 'calendar':
        return `${c} this month`
      case 'hashtags':
        return plural(c, 'bank')
      case 'products':
        return `${c} live`
      case 'insights':
        return `${plural(c, 'post')} logged`
      case 'resources':
        return plural(c, 'link')
      default:
        return null
    }
  }

  return (
    <div className="brand-tab-body">
      {kit.tagline && (
        <div className="card brand-help-card brand-home-hello">
          <p className="brand-help-text">{kit.tagline}</p>
        </div>
      )}

      <div className="module-grid">
        {pages.map((page) => {
          const stat = statFor(page.key)
          return (
            <Link key={page.key} to={page.to} className="module-card">
              <span className="module-card-icon">{page.icon}</span>
              <span className="module-card-name">{page.name}</span>
              {stat ? (
                <span className="module-card-stat">{stat}</span>
              ) : (
                <span className="module-card-tagline">{page.tagline}</span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default BrandHome
