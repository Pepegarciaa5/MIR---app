import { useState } from 'react'
import { useTracker } from '../context/TrackerContext'
import { especialidadesMIR, especialidadNombres, getEspecialidadColor } from '../data/especialidadesMIR'

const ACCENT = '#BA7517'

function fmt(s) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

export default function TrackerBar() {
  const { activeEntry, elapsed, startTracking, stopTracking } = useTracker()
  const [desc, setDesc] = useState('')
  const [esp, setEsp] = useState('')
  const [tema, setTema] = useState('')

  const isActive = !!activeEntry
  const temas = esp ? (especialidadesMIR[esp]?.temas || []) : []

  const handlePlay = () => {
    if (isActive) {
      stopTracking()
    } else {
      if (!desc.trim()) return
      startTracking({ descripcion: desc.trim(), especialidad: esp || null, tema: tema || null })
      setDesc('')
      setEsp('')
      setTema('')
    }
  }

  if (isActive) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 20px',
        background: '#f0fdf4',
        borderBottom: '1px solid #86efac',
        flexShrink: 0,
      }}>
        <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#166534', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeEntry.descripcion}
        </div>
        {activeEntry.especialidad && (() => {
          const c = getEspecialidadColor(activeEntry.especialidad)
          return (
            <span style={{ fontSize: 11, fontWeight: 700, color: c.text, background: c.bg, border: `1px solid ${c.border}`, padding: '3px 8px', borderRadius: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {activeEntry.especialidad}{activeEntry.tema ? ` · ${activeEntry.tema}` : ''}
            </span>
          )
        })()}
        <span style={{ fontFamily: 'monospace', fontSize: 17, fontWeight: 800, color: '#16a34a', minWidth: 88, textAlign: 'right', flexShrink: 0 }}>
          {fmt(elapsed)}
        </span>
        <button
          onClick={stopTracking}
          title="Detener"
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.12)' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><rect x="1" y="1" width="10" height="10" rx="1.5"/></svg>
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '10px 20px 10px', background: '#fafafa', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
      {/* Row 1: text input + play */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handlePlay()}
          placeholder="¿Qué estás haciendo ahora?"
          style={{ flex: 1, border: 'none', outline: 'none', fontSize: 14, color: '#1a1a1a', background: 'transparent', padding: '2px 0', minWidth: 0 }}
        />
        <button
          onClick={handlePlay}
          title="Comenzar"
          style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: desc.trim() ? ACCENT : '#d1d5db', color: '#fff', cursor: desc.trim() ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', transition: 'background 0.2s' }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="white"><polygon points="2,1 11,6 2,11"/></svg>
        </button>
      </div>

      {/* Row 2: dropdowns */}
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <select
          value={esp}
          onChange={e => { setEsp(e.target.value); setTema('') }}
          style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', background: '#fff', color: esp ? '#374151' : '#9ca3af', cursor: 'pointer', maxWidth: 180 }}
        >
          <option value="">— Asignatura —</option>
          {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
          <option value="_libre">Actividad libre</option>
          <option value="_pausa">Pausa</option>
        </select>

        {esp && temas.length > 0 && (
          <select
            value={tema}
            onChange={e => setTema(e.target.value)}
            style={{ fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 6, padding: '4px 8px', background: '#fff', color: tema ? '#374151' : '#9ca3af', cursor: 'pointer', flex: 1, minWidth: 0 }}
          >
            <option value="">— Tema —</option>
            {temas.map((t, i) => <option key={i} value={t}>{t}</option>)}
          </select>
        )}
      </div>
    </div>
  )
}
