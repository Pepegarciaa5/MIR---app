import { useState, useEffect } from 'react'
import { planDia, repasosData, tareasPendientesGlobal, planesAdicionales, todayStr, persistData, bloquesCompletados, bloquesDescartados } from '../data/mockData'
import { useTracker } from '../context/TrackerContext'

const ACCENT = '#BA7517'
const HOUR_HEIGHT = 72
const START_HOUR = 0
const END_HOUR = 24

const BLOCK_STYLES = {
  '🎬': { bg: '#fef9ec', border: '#f59e0b', text: '#92400e' },
  '📖': { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  '📡': { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
  '📝': { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  '🔄': { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  '🌴': { bg: '#f0f9ff', border: '#0ea5e9', text: '#075985' },
}

const CONFIANZA_OPTS = [
  { id: 'flojo',   label: 'Flojo',   color: '#ef4444', bg: '#fef2f2' },
  { id: 'regular', label: 'Regular', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'bien',    label: 'Bien',    color: '#22c55e', bg: '#f0fdf4' },
]

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToPx(mins) {
  return ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function fmt(s) {
  if (!s) return '00:00:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function getBlockStyle(titulo) {
  if (!titulo) return { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
  const emoji = [...titulo][0]
  return BLOCK_STYLES[emoji] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
}

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

export default function SesionDia() {
  const { entries, activeEntry, elapsed, startTracking, stopTracking, getBlockSeconds } = useTracker()
  const [now, setNow] = useState(new Date())
  const [manualCompleted, setManualCompleted] = useState([...bloquesCompletados])
  const [removedBlocks, setRemovedBlocks] = useState([...bloquesDescartados])
  const [hoveredBlock, setHoveredBlock] = useState(null)
  const [finishingBlock, setFinishingBlock] = useState(null)
  const [skippingBlock, setSkippingBlock] = useState(null)
  const [wantsReview, setWantsReview] = useState(null)
  const [destino, setDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowPx = minsToPx(nowMins)

  const todayTrackers = entries.filter(e => e.fecha === todayStr)
  if (activeEntry && activeEntry.fecha === todayStr) {
    todayTrackers.unshift({ ...activeEntry, isActivo: true, fin: now.getTime(), duracionSegundos: elapsed })
  }

  const combinedPlan = [...planDia, ...(planesAdicionales[todayStr] || [])].filter(b => !removedBlocks.includes(b.id))
  const dynamicPlan = combinedPlan.map(b => {
    const startMins = timeToMins(b.inicio)
    const endMins = timeToMins(b.fin)
    const activo = nowMins >= startMins && nowMins < endMins
    const completado = manualCompleted.includes(b.id)
    return { ...b, activo, completado, startMins, endMins }
  })

  const dayDone = dynamicPlan.filter(b => b.completado).length

  const guardarBloque = (b, confStr) => {
    if (!destino.trim()) { alert('Indica dónde vas a guardar los contenidos primero.'); return }
    const workedSeconds = getBlockSeconds(b.id)
    const durationHours = workedSeconds > 0 ? workedSeconds / 3600 : (b.endMins - b.startMins) / 60
    const minutosRepaso = Math.max(1, Math.round(durationHours * 8))
    const numConfianza = { flojo: 1, regular: 2, bien: 3 }[confStr]
    repasosData.unshift({ id: Date.now(), titulo: b.titulo, especialidad: b.especialidad || 'Sin asignar', tema: b.tema, destinoGuardado: destino, minutosRepaso, fase: 0, fechaProximoRepaso: new Date().setHours(0,0,0,0), confianza: numConfianza })
    bloquesCompletados.push(b.id)
    persistData()
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const guardarBloqueSinRepaso = (b) => {
    bloquesCompletados.push(b.id)
    persistData()
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const descartarBloque = (b, accion) => {
    if (accion === 'pendientes') { tareasPendientesGlobal.push(b); alert('Añadida a Tareas Pendientes.') }
    else if (accion === 'eliminar') { alert('Tarea eliminada del plan de hoy.') }
    else if (accion === 'reasignar') {
      if (!nuevaFecha.match(/^\d{4}-\d{2}-\d{2}$/)) { alert('Usa el formato YYYY-MM-DD'); return }
      if (!planesAdicionales[nuevaFecha]) planesAdicionales[nuevaFecha] = []
      planesAdicionales[nuevaFecha].push({ ...b, id: Date.now() })
      alert(`Reasignada al ${nuevaFecha}`)
    }
    bloquesDescartados.push(b.id)
    persistData()
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setRemovedBlocks(prev => [...prev, b.id])
    setSkippingBlock(null)
    setNuevaFecha('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>

      {/* Day header */}
      <div style={{ padding: '10px 16px 10px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>Hoy</span>
          <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>
          {dayDone} / {dynamicPlan.length} completados
        </span>
      </div>

      {/* Timeline */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <div style={{ display: 'flex', minHeight: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`, position: 'relative' }}>

          {/* Hour labels */}
          <div style={{ width: 52, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 10, paddingTop: 6 }}>
                <span style={{ fontSize: 11, color: '#b0bec5', fontWeight: 500, userSelect: 'none' }}>
                  {String(h).padStart(2,'0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div style={{ flex: 1, position: 'relative', borderLeft: '1px solid #e2e8f0', background: '#fffdf7' }}>

            {/* Hour lines */}
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ height: HOUR_HEIGHT / 2, borderBottom: '1px dashed #f8fafc' }} />
              </div>
            ))}

            {/* Current time indicator */}
            {nowPx >= 0 && nowPx < (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
              <div style={{ position: 'absolute', top: nowPx, left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
                <div style={{ height: 2, background: ACCENT, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', background: ACCENT }} />
                </div>
              </div>
            )}

            {/* Blocks */}
            {dynamicPlan.map(b => {
              const { startMins, endMins } = b
              if (endMins <= START_HOUR * 60 || startMins >= END_HOUR * 60) return null
              const clampedStart = Math.max(startMins, START_HOUR * 60)
              const clampedEnd = Math.min(endMins, END_HOUR * 60)
              const top = minsToPx(clampedStart)
              const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 3, 24)
              const bStyle = getBlockStyle(b.titulo)
              const isActive = activeEntry?.bloqueId === b.id
              const isHovered = hoveredBlock === b.id
              const workedSecs = getBlockSeconds(b.id)
              const isFinishing = finishingBlock === b.id
              const isSkipping = skippingBlock === b.id

              return (
                <div
                  key={b.id}
                  onMouseEnter={() => setHoveredBlock(b.id)}
                  onMouseLeave={() => setHoveredBlock(null)}
                  style={{
                    position: 'absolute', top: top + 1, left: 3, width: 'calc(60% - 6px)', height,
                    background: b.completado ? '#f8fafc' : bStyle.bg,
                    border: `1.5px dashed ${isActive ? ACCENT : b.completado ? '#cbd5e1' : bStyle.border}`,
                    borderLeft: `4px solid ${isActive ? ACCENT : b.completado ? '#94a3b8' : bStyle.border}`,
                    borderRadius: 7,
                    padding: '4px 8px',
                    overflow: 'hidden',
                    zIndex: isActive || isFinishing || isSkipping ? 8 : 2,
                    boxShadow: isActive ? `0 3px 12px ${ACCENT}35` : isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    opacity: b.completado ? 0.4 : 0.8,
                    transition: 'box-shadow 0.15s, width 0.2s',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 8,
                  }}
                >
                  {/* Left: title + time */}
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, color: b.completado ? '#94a3b8' : bStyle.text, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                      {b.titulo}
                    </div>
                    {height > 30 && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{b.inicio} – {b.fin}</div>
                    )}
                    {height > 48 && workedSecs > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: isActive ? ACCENT : '#64748b', marginTop: 3 }}>
                        ⏱ {fmt(workedSecs)}
                      </div>
                    )}
                    {b.completado && height > 28 && (
                      <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓ Completado</div>
                    )}
                  </div>

                  {/* Right: buttons */}
                  {!b.completado && (isHovered || isActive) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
                      {/* Timer button */}
                      <button
                        onClick={() => isActive ? stopTracking() : startTracking({ descripcion: b.titulo, especialidad: b.especialidad, tema: b.tema, bloqueId: b.id })}
                        style={{
                          padding: '3px 8px', border: 'none', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                          background: isActive ? '#2563eb' : '#e2e8f0',
                          color: isActive ? '#fff' : '#334155',
                        }}
                      >
                        {isActive ? `⏸ ${fmt(workedSecs)}` : '▶ Empezar'}
                      </button>

                      {/* Finalizar / No Hecha */}
                      {height > 52 && (
                        <div style={{ display: 'flex', gap: 3 }}>
                          <button
                            onClick={e => { e.stopPropagation(); setFinishingBlock(b.id); setWantsReview(null); setSkippingBlock(null); if (activeEntry?.bloqueId === b.id) stopTracking() }}
                            style={{ padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#10b981', color: '#fff' }}
                          >✓ Fin</button>
                          <button
                            onClick={e => { e.stopPropagation(); setSkippingBlock(b.id); setFinishingBlock(null); if (activeEntry?.bloqueId === b.id) stopTracking() }}
                            style={{ padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                          >✗</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Tracked Blocks */}
            {(() => {
              // 1. Sort ascending by inicio
              const sortedTrackers = [...todayTrackers].sort((a, b) => a.inicio - b.inicio)
              let lastBottom = 0

              return sortedTrackers.map((t, idx) => {
                const startD = new Date(t.inicio)
                const endD = new Date(t.fin || t.inicio + (t.duracionSegundos || 0) * 1000)
                const startMins = startD.getHours() * 60 + startD.getMinutes()
                const endMins = endD.getHours() * 60 + endD.getMinutes()
                if (isNaN(startMins) || isNaN(endMins)) return null
                if (endMins <= START_HOUR * 60 || startMins >= END_HOUR * 60) return null
                
                const clampedStart = Math.max(startMins, START_HOUR * 60)
                const clampedEnd = Math.min(endMins, END_HOUR * 60)
                
                const exactTop = minsToPx(clampedStart)
                const exactHeight = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT
                
                const height = Math.max(exactHeight - 3, 28)
                const top = Math.max(exactTop + 1, lastBottom)
                
                lastBottom = top + height + 3
                
                const bStyle = getBlockStyle(t.descripcion)
                const dur = t.duracionSegundos || 0
                
                return (
                  <div
                    key={t.id || idx}
                    style={{
                      position: 'absolute', top, left: '40%', right: 3, height,
                      background: t.isActivo ? '#fffbfa' : '#f0fdf4',
                      border: `1px solid ${t.isActivo ? ACCENT : '#4ade80'}`,
                      borderLeft: `5px solid ${t.isActivo ? ACCENT : '#22c55e'}`,
                      borderRadius: 7,
                      padding: '4px 8px',
                      overflow: 'hidden',
                      zIndex: t.isActivo ? 10 : 7,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, height: '100%' }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                      <div style={{ fontSize: 11, color: t.isActivo ? '#78350f' : '#14532d', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                        {t.descripcion}
                      </div>
                      {height > 35 && (
                        <div style={{ fontSize: 9, color: t.isActivo ? '#b45309' : '#166534', marginTop: 2, opacity: 0.8 }}>
                          {String(startD.getHours()).padStart(2,'0')}:{String(startD.getMinutes()).padStart(2,'0')} – {t.isActivo ? '...' : `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`}
                        </div>
                      )}
                    </div>
                    {dur > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: t.isActivo ? ACCENT : '#15803d', flexShrink: 0 }}>
                        ⏱ {fmt(dur)}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          })()}
          </div>
        </div>
      </div>

      {/* Finalizar panel */}
      {finishingBlock && (() => {
        const b = dynamicPlan.find(x => x.id === finishingBlock)
        if (!b) return null
        const workedSecs = getBlockSeconds(b.id)
        return (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 16px', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>Finalizar: <span style={{ color: ACCENT }}>{b.titulo}</span></div>
            {workedSecs > 0 && <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>Tiempo trabajado: {fmt(workedSecs)}</div>}
            {wantsReview === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>¿Has generado material nuevo para repasar en el futuro?</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setWantsReview(true)} style={{ flex: 1, padding: '8px 0', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>Sí, mandar a Repasos</button>
                  <button onClick={() => guardarBloqueSinRepaso(b)} style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>No, solo finalizar ✓</button>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  placeholder="¿Dónde guardas los contenidos? (Notion, Anki...)"
                  style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', marginBottom: 10, boxSizing: 'border-box' }}
                />
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  {CONFIANZA_OPTS.map(opt => (
                    <button key={opt.id} onClick={() => guardarBloque(b, opt.id)}
                      style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button onClick={() => { setFinishingBlock(null); setWantsReview(null); }} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', marginTop: 10 }}>Cancelar</button>
          </div>
        )
      })()}

      {/* No Hecha panel */}
      {skippingBlock && (() => {
        const b = dynamicPlan.find(x => x.id === skippingBlock)
        if (!b) return null
        return (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 16px', background: '#fff7ed', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10 }}>¿Qué hacer con: <span style={{ color: '#ea580c' }}>{b.titulo}</span>?</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => descartarBloque(b, 'pendientes')} style={{ flex: 1, padding: '8px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Enviar a Pendientes
              </button>
              <button onClick={() => descartarBloque(b, 'eliminar')} style={{ flex: 1, padding: '8px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Eliminar
              </button>
              <div style={{ display: 'flex', gap: 6, flex: 2 }}>
                <input value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)} placeholder="YYYY-MM-DD"
                  style={{ width: 100, padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, fontSize: 12 }} />
                <button onClick={() => descartarBloque(b, 'reasignar')} style={{ flex: 1, padding: '8px', background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  Reasignar
                </button>
              </div>
            </div>
            <button onClick={() => setSkippingBlock(null)} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          </div>
        )
      })()}
    </div>
  )
}
