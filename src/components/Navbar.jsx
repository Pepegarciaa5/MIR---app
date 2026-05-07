const ACCENT = '#BA7517'

const IcoHome = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? ACCENT : 'none'}
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
)

const IcoCalendar = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const IcoClock = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const IcoRepeat = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="1 4 1 10 7 10" />
    <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
  </svg>
)

const IcoChart = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6"  y1="20" x2="6"  y2="14" />
  </svg>
)

const IcoTimer = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="13" r="8" />
    <polyline points="12 9 12 13 14.5 15" />
    <path d="M9 3h6M12 3v2" />
  </svg>
)

const TABS = [
  { id: 'inicio',     label: 'Inicio',     Icon: IcoHome     },
  { id: 'calendario', label: 'Calendario', Icon: IcoCalendar },
  { id: 'repasos',    label: 'Repasos',    Icon: IcoRepeat   },
  { id: 'progreso',   label: 'Progreso',   Icon: IcoChart    },
]

export default function Navbar({ active, setActive }) {
  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'column',
      width: 200,
      background: '#fff',
      borderRight: '1px solid #f0f0f0',
      padding: '20px 0',
    }}>
      {TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => setActive(id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              padding: '12px 20px',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              borderRadius: isActive ? '8px' : '0',
              backgroundColor: isActive ? '#fef3e2' : 'transparent',
            }}
          >
            <Icon active={isActive} />
            <span style={{
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? ACCENT : '#666',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
