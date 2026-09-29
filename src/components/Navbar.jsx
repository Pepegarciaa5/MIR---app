/**
 * Archivo: Navbar.jsx
 * Descripción: Barra de navegación principal (lateral o inferior) para cambiar entre las diferentes pantallas de la app.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-17
 */

import { useState } from 'react'

const ACCENT = '#F26522'
const COLLAPSED_W = 60
const EXPANDED_W = 200

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

const IcoPen = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
)

const IcoFlashcards = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const IcoSimulacros = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
)

const IcoCandle = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8" />
    <rect x="9" y="11" width="6" height="10" rx="1.5" />
    <path d="M12 11V8" />
    {active ? (
      <path d="M12 8c.6-1 1.2-2 1.2-3s-1.2-2-1.2-2-1.2 1-1.2 2 .6 2 1.2 3z" fill={ACCENT} stroke={ACCENT} />
    ) : (
      <path d="M12 8c.3-.5.6-1 .6-1.5s-.6-1-.6-1-.6.5-.6 1 .3 1 .6 1.5z" fill="none" stroke="#999" />
    )}
  </svg>
)

const IcoQuiz = ({ active }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
    stroke={active ? ACCENT : '#999'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
)

const ALL_TABS = [
  { id: 'inicio',     label: 'Inicio',            Icon: IcoHome },
  { id: 'desgloses',  label: 'Desgloses MIR',      Icon: IcoSimulacros },
  { id: 'quiz',       label: 'Banco Preguntas',    Icon: IcoQuiz },
  { id: 'adaptativo', label: 'Estudio Adaptativo', Icon: IcoRepeat },
  { id: 'simulacros', label: 'Simulacros',         Icon: IcoSimulacros },
  { id: 'calendario', label: 'Calendario',         Icon: IcoCalendar },
  { id: 'repasos',    label: 'Repasos',            Icon: IcoRepeat },
  { id: 'progreso',   label: 'Progreso',           Icon: IcoChart },
  { id: 'diario',     label: 'Diario',             Icon: IcoPen },
  { id: 'publico',    label: 'Vista Pública',      Icon: IcoHome },
]

export default function Navbar({ active, setActive }) {
  const [expanded, setExpanded] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  const isExpanded = expanded

  return (
    <nav
      onMouseEnter={() => !isTouchDevice && setExpanded(true)}
      onMouseLeave={() => !isTouchDevice && setExpanded(false)}
      onTouchStart={() => setIsTouchDevice(true)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: isExpanded ? EXPANDED_W : COLLAPSED_W,
        minWidth: isExpanded ? EXPANDED_W : COLLAPSED_W,
        background: '#fff',
        borderRight: '1px solid #f0f0f0',
        padding: '16px 0',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        overflow: 'hidden',
        zIndex: 20,
      }}
    >
      {/* Botón expandir/colapsar táctil */}
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px 20px', textAlign: 'left', color: '#94a3b8',
          fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10
        }}
      >
        <span>{isExpanded ? '◄' : '►'}</span>
        {isExpanded && <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Menú</span>}
      </button>

      {ALL_TABS.map(({ id, label, Icon }) => {
        const isActive = active === id
        return (
          <button
            key={id}
            onClick={() => setActive(id)}
            title={label}
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
              borderRadius: isActive ? '8px' : '0',
              backgroundColor: isActive ? '#fff0e6' : 'transparent',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              <Icon active={isActive} />
            </span>
            <span style={{
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? ACCENT : '#666',
              opacity: isExpanded ? 1 : 0,
              transition: 'opacity 0.15s ease',
            }}>
              {label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}

