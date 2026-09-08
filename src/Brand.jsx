import { Routes, Route, Navigate, NavLink } from 'react-router-dom'
import { BrandProvider } from './BrandContext'
import { useBrand } from './useBrand'
import BrandKit from './BrandKit'
import Strategy from './Strategy'
import Hashtags from './Hashtags'
import Resources from './Resources'
import Products from './Products'
import MoodBoard from './MoodBoard'
import Calendar from './Calendar'
import EmptyState from './EmptyState'

const TABS = [
  { to: '/brand', label: 'Brand Kit', end: true },
  { to: '/brand/strategy', label: 'Strategy' },
  { to: '/brand/moodboard', label: 'Mood Board' },
  { to: '/brand/calendar', label: 'Calendar' },
  { to: '/brand/hashtags', label: 'Hashtags' },
  { to: '/brand/products', label: 'Products & Offers' },
  { to: '/brand/insights', label: 'Insights' },
  { to: '/brand/resources', label: 'Resources' },
  { to: '/brand/studio', label: 'Stability Studio' },
]

function ComingSoon({ title }) {
  return (
    <div className="card">
      <EmptyState icon="🌱" title={`${title} — coming soon`}>
        The shell and your brand switcher are ready. We&apos;ll build this tab out next.
      </EmptyState>
    </div>
  )
}

function BrandSwitcher() {
  const { brand, setBrand, brands } = useBrand()

  return (
    <div className="brand-switcher" role="tablist" aria-label="Brand">
      {brands.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={brand === option.value}
          className={`brand-chip${brand === option.value ? ' active' : ''}`}
          onClick={() => setBrand(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

function BrandInner() {
  const { kit, fonts } = useBrand()

  const brandStyle = {
    '--brand-heading': fonts.heading,
    '--brand-body': fonts.body,
  }

  return (
    <section className="brand-module" style={brandStyle}>
      <div className="home-greeting">
        <h1>Brand</h1>
        <p className="list-row-sub">
          Your brand HQ — strategy, kit, and content in one place.
        </p>
      </div>

      <BrandSwitcher />

      <nav className="brand-tabs">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `segmented-tab brand-tab${isActive ? ' active' : ''}`}
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {!kit.ready && (
        <div className="card brand-stub-note">
          <p className="list-row-sub">
            {kit.name}&apos;s kit isn&apos;t filled in yet — the switcher and layout work,
            and we&apos;ll pull this brand&apos;s colours and voice in when you&apos;re ready.
            Editable fields still save.
          </p>
        </div>
      )}

      <Routes>
        <Route path="/" element={<BrandKit />} />
        <Route path="strategy" element={<Strategy />} />
        <Route path="moodboard" element={<MoodBoard />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="hashtags" element={<Hashtags />} />
        <Route path="products" element={<Products />} />
        <Route path="insights" element={<ComingSoon title="Insights" />} />
        <Route path="resources" element={<Resources />} />
        <Route path="studio" element={<ComingSoon title="Stability Studio" />} />
        <Route path="*" element={<Navigate to="/brand" replace />} />
      </Routes>
    </section>
  )
}

function Brand() {
  return (
    <BrandProvider>
      <BrandInner />
    </BrandProvider>
  )
}

export default Brand
