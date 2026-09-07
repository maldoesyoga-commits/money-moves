function Icon({ children, className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export function HomeIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M3.5 10.5 12 3.5l8.5 7" />
      <path d="M5.5 9.5V19a1 1 0 0 0 1 1h4v-6h3v6h4a1 1 0 0 0 1-1V9.5" />
    </Icon>
  )
}

export function InsightsIcon({ className }) {
  return (
    <Icon className={className}>
      <polyline points="3.5 16.5 9 11 12.5 14.5 20.5 6.5" />
      <polyline points="14.5 6.5 20.5 6.5 20.5 12.5" />
    </Icon>
  )
}

export function AccountsIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v1h1a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />
      <circle cx="16.5" cy="13" r="1.2" fill="currentColor" stroke="none" />
    </Icon>
  )
}

export function TransactionsIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M4 7.5h13" />
      <polyline points="13.5 3.5 17 7.5 13.5 11.5" />
      <path d="M20 16.5H7" />
      <polyline points="10.5 12.5 7 16.5 10.5 20.5" />
    </Icon>
  )
}

export function IncomeIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M12 3.5v11" />
      <polyline points="7.5 10.5 12 15 16.5 10.5" />
      <path d="M4.5 20h15" />
    </Icon>
  )
}

export function SavingsIcon({ className }) {
  return (
    <Icon className={className}>
      <ellipse cx="12" cy="17.5" rx="7.5" ry="2.2" />
      <ellipse cx="12" cy="12.5" rx="7.5" ry="2.2" />
      <ellipse cx="12" cy="7.5" rx="7.5" ry="2.2" />
    </Icon>
  )
}

export function DebtsIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.25 12h7.5" />
    </Icon>
  )
}

export function ImportIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M12 15V4" />
      <polyline points="7.5 8.5 12 4 16.5 8.5" />
      <path d="M4.5 20h15" />
    </Icon>
  )
}

export function ReceiptsIcon({ className }) {
  return (
    <Icon className={className}>
      <path d="M6 3.5h9l3 3v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1z" />
      <path d="M15 3.5v3h3" />
      <path d="M8 12h8M8 15.5h8M8 8.5h5" />
    </Icon>
  )
}

export function MoreIcon({ className }) {
  return (
    <Icon className={className}>
      <circle cx="5" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.3" fill="currentColor" stroke="none" />
    </Icon>
  )
}
