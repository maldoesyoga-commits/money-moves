// Shown when a module has nothing in it at all — the first thing you see
// on a fresh install, so it explains what the module is for rather than
// just saying "empty".
function EmptyState({ icon, title, children }) {
  return (
    <div className="empty-state">
      {icon && <span className="empty-state-icon">{icon}</span>}
      <p className="empty-state-title">{title}</p>
      {children && <p className="empty-state-body">{children}</p>}
    </div>
  )
}

export default EmptyState
