import { Link } from 'react-router-dom'
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

function BrandHome() {
  const { brand, kit } = useBrand()
  const pages = PAGES.filter((page) => !page.cmOnly || brand === 'cm')

  return (
    <div className="brand-tab-body">
      {kit.tagline && (
        <div className="card brand-help-card brand-home-hello">
          <p className="brand-help-text">{kit.tagline}</p>
        </div>
      )}

      <div className="module-grid">
        {pages.map((page) => (
          <Link key={page.key} to={page.to} className="module-card">
            <span className="module-card-icon">{page.icon}</span>
            <span className="module-card-name">{page.name}</span>
            <span className="module-card-tagline">{page.tagline}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

export default BrandHome
