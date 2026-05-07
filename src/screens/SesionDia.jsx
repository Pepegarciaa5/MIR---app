import { useState, useEffect, useRef } from 'react'
import { planDia, repasosData, tareasPendientesGlobal, planesAdicionales, todayStr, bloquesCompletados, bloquesDescartados } from '../data/mockData'
import { upsertRepaso } from '../lib/db'
import { useTracker } from '../context/TrackerContext'
import { especialidadesMIR, especialidadNombres, getEspecialidadColor } from '../data/especialidadesMIR'

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

function toTimeStr(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}
function applyTime(ts, timeStr) {
  const d = new Date(ts)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0)
  return d.getTime()
}

export default function SesionDia() {
  const { entries, activeEntry, elapsed, startTracking, stopTracking, getBlockSeconds, editEntry, deleteEntry } = useTracker()
  const [now, setNow] = useState(new Date())
  const [manualCompleted, setManualCompleted] = useState([...bloquesCompletados])
  const [removedBlocks, setRemovedBlocks] = useState([...bloquesDescartados])
  const [hoveredBlock, setHoveredBlock] = useState(null)
  const [hoveredTracker, setHoveredTracker] = useState(null)
  const [finishingBlock, setFinishingBlock] = useState(null)
  const [skippingBlock, setSkippingBlock] = useState(null)
  const [wantsReview, setWantsReview] = useState(null)
  const [destino, setDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  // Edit tracker entry state
  const [editingTracker, setEditingTracker] = useState(null)
  const [editDesc, setEditDesc] = useState('')
  const [editEsp, setEditEsp] = useState('')
  const [editTema, setEditTema] = useState('')
  const [editInicio, setEditInicio] = useState('')
  const [editFin, setEditFin] = useState('')
  const [confirmDeleteTracker, setConfirmDeleteTracker] = useState(null)
  // Send to repasos state
  const [repasoTracker, setRepasoTracker] = useState(null)
  const [repasoTitulo, setRepasoTitulo] = useState('')
  const [repasoDestino, setRepasoDestino] = useState('')
  const [repasoConfianza, setRepasoConfianza] = useState(2)
  const [repasoEnviados, setRepasoEnviados] = useState(new Set())

  function openEditTracker(t) {
    setEditingTracker(t)
    setEditDesc(t.descripcion)
    setEditEsp(t.especialidad || '')
    setEditTema(t.tema || '')
    setEditInicio(toTimeStr(t.inicio))
    setEditFin(toTimeStr(t.fin))
    setRepasoTracker(null)
    setFinishingBlock(null)
    setSkippingBlock(null)
  }

  function openRepasoTracker(t) {
    setRepasoTracker(t)
    setRepasoTitulo(t.descripcion)
    setRepasoDestino('')
    setRepasoConfianza(2)
    setEditingTracker(null)
    setFinishingBlock(null)
    setSkippingBlock(null)
  }

  function enviarTrackerARepasos() {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const durH = (repasoTracker.duracionSegundos || 0) / 3600
    const minutosRepaso = Math.max(1, Math.round(durH * 8))
    const newRepaso = {
      id: Date.now(),
      titulo: repasoTitulo.trim() || repasoTracker.descripcion,
      especialidad: repasoTracker.especialidad || 'Sin asignar',
      tema: repasoTracker.tema || null,
      destinoGuardado: repasoDestino.trim() || null,
      minutosRepaso,
      fase: 0,
      fechaProximoRepaso: todayMs,
      confianza: repasoConfianza,
    }
    repasosData.unshift(newRepaso)
    upsertRepaso(newRepaso)
    setRepasoEnviados(prev => new Set([...prev, repasoTracker.id]))
    setRepasoTracker(null)
  }

  function saveEditTracker() {
    const newInicio = applyTime(editingTracker.inicio, editInicio)
    const newFin = applyTime(editingTracker.fin, editFin)
    editEntry(editingTracker.id, {
      descripcion: editDesc.trim() || editingTracker.descripcion,
      especialidad: editEsp || null,
      tema: editTema || null,
      inicio: newInicio,
      fin: newFin,
    })
    setEditingTracker(null)
  }

  const timelineRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!timelineRef.current) return
    const scrollTo = Math.max(0, nowPx - 120)
    timelineRef.current.scrollTop = scrollTo
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    const newRepaso = { id: Date.now(), titulo: b.titulo, especialidad: b.especialidad || 'Sin asignar', tema: b.tema, destinoGuardado: destino, minutosRepaso, fase: 0, fechaProximoRepaso: new Date().setHours(0,0,0,0), confianza: numConfianza }
    repasosData.unshift(newRepaso)
    upsertRepaso(newRepaso)
    bloquesCompletados.push(b.id)
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const guardarBloqueSinRepaso = (b) => {
    bloquesCompletados.push(b.id)
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
      <div ref={timelineRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
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

                const dur = t.duracionSegundos || 0
                const isHovered = hoveredTracker === (t.id || idx)
                const isBeingEdited = editingTracker?.id === t.id
                const tColor = getEspecialidadColor(t.especialidad)

                return (
                  <div
                    key={t.id || idx}
                    onMouseEnter={() => setHoveredTracker(t.id || idx)}
                    onMouseLeave={() => setHoveredTracker(null)}
                    style={{
                      position: 'absolute', top, left: '40%', right: 3, height,
                      background: isBeingEdited ? '#eff6ff' : t.isActivo ? tColor.bg : tColor.bg,
                      border: `1px solid ${isBeingEdited ? '#3b82f6' : t.isActivo ? ACCENT : tColor.border}`,
                      borderLeft: `5px solid ${isBeingEdited ? '#3b82f6' : t.isActivo ? ACCENT : tColor.text}`,
                      borderRadius: 7,
                      padding: '4px 8px',
                      overflow: 'hidden',
                      zIndex: t.isActivo ? 10 : 7,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, height: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ fontSize: 11, color: tColor.text, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
                          {t.descripcion}
                        </div>
                        {height > 35 && (
                          <div style={{ fontSize: 9, color: tColor.text, marginTop: 2, opacity: 0.7 }}>
                            {String(startD.getHours()).padStart(2,'0')}:{String(startD.getMinutes()).padStart(2,'0')} – {t.isActivo ? '...' : `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        {dur > 0 && (
                          <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: t.isActivo ? ACCENT : tColor.text }}>
                            ⏱ {fmt(dur)}
                          </div>
                        )}
                        {!t.isActivo && (isHovered || isBeingEdited || repasoTracker?.id === t.id) && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            {repasoEnviados.has(t.id) ? (
                              <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 800 }}>📚✓</span>
                            ) : (
                              <button
                                onClick={() => repasoTracker?.id === t.id ? setRepasoTracker(null) : openRepasoTracker(t)}
                                style={{ padding: '2px 4px', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: repasoTracker?.id === t.id ? '#dcfce7' : tColor.border, color: '#16a34a', fontWeight: 700 }}>
                                📚
                              </button>
                            )}
                            <button
                              onClick={() => isBeingEdited ? setEditingTracker(null) : openEditTracker(t)}
                              style={{ padding: '2px 4px', border: 'none', borderRadius: 4, fontSize: 10, cursor: 'pointer', background: isBeingEdited ? '#3b82f6' : tColor.border, color: isBeingEdited ? '#fff' : tColor.text, fontWeight: 700 }}>
                              ✏️
                            </button>
                          </div>
                        )}
                      </div>
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

      {/* Send to repasos panel */}
      {repasoTracker && (
        <div style={{ borderTop: '1px solid #86efac', padding: '14px 16px', background: '#f0fdf4', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 12 }}>
            Enviar a Repasos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 4 }}>Título</label>
              <input
                value={repasoTitulo} onChange={e => setRepasoTitulo(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 4 }}>¿Dónde está guardado?</label>
              <input
                value={repasoDestino} onChange={e => setRepasoDestino(e.target.value)}
                placeholder="Notion, Anki, libreta..."
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 6 }}>Nivel de dominio</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CONFIANZA_OPTS.map(opt => (
                  <button key={opt.id} onClick={() => setRepasoConfianza(opt.id)}
                    style={{ flex: 1, padding: '8px 0', border: repasoConfianza === opt.id ? `2px solid ${opt.color}` : '2px solid transparent', borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setRepasoTracker(null)}
                style={{ padding: '7px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={enviarTrackerARepasos}
                style={{ padding: '7px 18px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                Añadir a Repasos
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit tracker panel */}
      {editingTracker && (() => {
        const editTemas = editEsp ? (especialidadesMIR[editEsp]?.temas || []) : []
        const previewSecs = Math.max(0, Math.floor((applyTime(editingTracker.fin, editFin) - applyTime(editingTracker.inicio, editInicio)) / 1000))
        const previewH = Math.floor(previewSecs / 3600)
        const previewM = Math.floor((previewSecs % 3600) / 60)
        const previewStr = previewH > 0 ? `${previewH}h ${previewM}m` : `${previewM}m`
        return (
          <div style={{ borderTop: '1px solid #bfdbfe', padding: '14px 16px', background: '#eff6ff', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>
              Editar actividad trackeada
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Nombre */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Nombre</label>
                <input value={editDesc} onChange={ev => setEditDesc(ev.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }} />
              </div>
              {/* Asignatura + Tema */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Asignatura</label>
                  <select value={editEsp} onChange={ev => { setEditEsp(ev.target.value); setEditTema('') }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, background: '#fff', color: editEsp ? '#374151' : '#9ca3af' }}>
                    <option value="">— Ninguna —</option>
                    {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="_libre">Actividad libre</option>
                    <option value="_pausa">Pausa</option>
                  </select>
                </div>
                {editEsp && editTemas.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Tema</label>
                    <select value={editTema} onChange={ev => setEditTema(ev.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, background: '#fff', color: editTema ? '#374151' : '#9ca3af' }}>
                      <option value="">— Ninguno —</option>
                      {editTemas.map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              {/* Inicio / Fin */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Inicio</label>
                  <input type="time" value={editInicio} onChange={ev => setEditInicio(ev.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Fin</label>
                  <input type="time" value={editFin} onChange={ev => setEditFin(ev.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600 }} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', paddingBottom: 8 }}>{previewStr}</div>
              </div>
              {/* Botones */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => { setConfirmDeleteTracker(editingTracker.id) }}
                  style={{ padding: '6px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#ef4444', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  🗑️ Eliminar
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditingTracker(null)}
                    style={{ padding: '6px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Cancelar
                  </button>
                  <button onClick={saveEditTracker}
                    style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Guardar
                  </button>
                </div>
              </div>
              {/* Confirm delete */}
              {confirmDeleteTracker && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                  <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, flex: 1 }}>¿Eliminar esta entrada?</span>
                  <button onClick={() => { deleteEntry(confirmDeleteTracker); setEditingTracker(null); setConfirmDeleteTracker(null) }}
                    style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    Eliminar
                  </button>
                  <button onClick={() => setConfirmDeleteTracker(null)}
                    style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                    Cancelar
                  </button>
                </div>
              )}
            </div>
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
