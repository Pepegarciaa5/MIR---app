import { useState } from 'react'
import { MIR_DATE } from '../data/mockData'
import { curiosidadesHumanisticas, datosMedicos } from '../data/pildorasDiarias'
import SesionDia from './SesionDia'
import SesionCalendario from './SesionCalendario'

const ACCENT = '#BA7517'
const ACCENT_BG = '#fef3e2'
const BLUE = '#2563eb'
const BLUE_BG = '#eff6ff'

function getDaysUntilMIR() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.ceil((MIR_DATE - today) / (1000 * 60 * 60 * 24))
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

function getDayOfYear() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  return Math.floor((now - start) / 86400000) + 1
}

export default function Inicio() {
  const [view, setView] = useState('dia') // 'dia' | 'semana'
  const days = getDaysUntilMIR()

  const today = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const todayCap = today.charAt(0).toUpperCase() + today.slice(1)

  const dayOfYear = getDayOfYear()
  const curiosidadHumanistica = curiosidadesHumanisticas[dayOfYear % curiosidadesHumanisticas.length]
  const datoMedico = datosMedicos[dayOfYear % datosMedicos.length]

  return (
    <div style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 13, color: '#999', fontWeight: 400 }}>{getGreeting()} · {todayCap}</p>
        <h1 style={{ margin: '6px 0 0', fontSize: 24, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.5px' }}>
          Quedan{' '}
          <span style={{ color: ACCENT }}>{days} días</span>
          {' '}para el MIR
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#bbb' }}>MIR 2027 · 25 de enero</p>
      </div>

      {/* Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <div style={{ background: ACCENT_BG, borderRadius: 14, padding: '12px 12px', borderTop: `3px solid ${ACCENT}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Cultura</div>
          <p style={{ margin: 0, fontSize: 12, color: '#5a3e00', lineHeight: 1.55 }}>{curiosidadHumanistica.contenido}</p>
        </div>
        <div style={{ background: BLUE_BG, borderRadius: 14, padding: '12px 12px', borderTop: `3px solid ${BLUE}` }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: BLUE, marginBottom: 7, textTransform: 'uppercase', letterSpacing: '0.8px' }}>{datoMedico.especialidad}</div>
          <p style={{ margin: 0, fontSize: 12, color: '#1e3a8a', lineHeight: 1.55 }}>{datoMedico.contenido}</p>
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: '#f0f0f0', borderRadius: 10, padding: 4, alignSelf: 'flex-start' }}>
        {[['dia', 'Plan del día'], ['semana', 'Vista semanal']].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            style={{ padding: '6px 16px', borderRadius: 7, border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: view === id ? '#fff' : 'transparent', color: view === id ? ACCENT : '#888', boxShadow: view === id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, minHeight: 480, border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden' }}>
        {view === 'dia' ? <SesionDia /> : <SesionCalendario />}
      </div>
    </div>
  )
}
