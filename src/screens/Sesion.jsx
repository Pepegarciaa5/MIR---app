import { useState, useEffect } from 'react'
import { planDia, repasosData, tareasPendientesGlobal, planesAdicionales, todayStr, persistData, bloquesCompletados, bloquesDescartados } from '../data/mockData'
import { useTracker } from '../context/TrackerContext'

const ACCENT = '#F26522'

const CONFIANZA_OPTS = [
  { id: 'flojo',   label: 'Flojo',   color: '#ef4444', bg: '#fef2f2' },
  { id: 'regular', label: 'Regular', color: '#f59e0b', bg: '#fffbeb' },
  { id: 'bien',    label: 'Bien',    color: '#22c55e', bg: '#f0fdf4' },
]

function formatTime(totalSeconds) {
  if (!totalSeconds) return '00:00:00'
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
}

export default function Sesion() {
  const { activeEntry, startTracking, stopTracking, getBlockSeconds } = useTracker()
  const [currentTime, setCurrentTime] = useState(new Date())
  const [manualCompleted, setManualCompleted] = useState([...bloquesCompletados])
  const [finishingBlock, setFinishingBlock] = useState(null)
  const [wantsReview, setWantsReview] = useState(null)
  const [skippingBlock, setSkippingBlock] = useState(null)
  const [destino, setDestino] = useState('')
  const [nuevaFecha, setNuevaFecha] = useState('')
  const [removedBlocks, setRemovedBlocks] = useState([...bloquesDescartados])

  useEffect(() => {
    const id = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const currentMins = currentTime.getHours() * 60 + currentTime.getMinutes()
  const combinedPlan = [...planDia, ...(planesAdicionales[todayStr] || [])].filter(b => !removedBlocks.includes(b.id))

  const dynamicPlan = combinedPlan.map(b => {
    const [sh, sm] = b.inicio.split(':').map(Number)
    const [eh, em] = b.fin.split(':').map(Number)
    const startMins = sh * 60 + sm
    const endMins   = eh * 60 + em
    const activo    = currentMins >= startMins && currentMins < endMins
    const completado = manualCompleted.includes(b.id)
    return { ...b, activo, completado, startMins, endMins }
  })

  // Register planned hours in the tracker if user didn't use the chronometer
  const registrarTiempoSiNecesario = (b) => {
    const workedSeconds = getBlockSeconds(b.id)
    if (workedSeconds < 10) {
      // No chronometer was used — create a synthetic tracker entry with planned duration
      const plannedSeconds = (b.endMins - b.startMins) * 60
      const [sh, sm] = b.inicio.split(':').map(Number)
      const today = new Date()
      const inicio = new Date(today.getFullYear(), today.getMonth(), today.getDate(), sh, sm).getTime()
      startTracking({ descripcion: b.titulo, especialidad: b.especialidad, tema: b.tema, bloqueId: b.id })
      // Immediately stop with overridden start time so it records the planned duration
      stopTracking()
    } else {
      if (activeEntry?.bloqueId === b.id) stopTracking()
    }
  }

  const guardarBloque = (b, confStr) => {
    if (!destino.trim()) {
      alert('Indica dónde vas a guardar los contenidos primero.')
      return
    }

    registrarTiempoSiNecesario(b)
    const workedSeconds = getBlockSeconds(b.id)
    let durationHours = workedSeconds > 0 ? workedSeconds / 3600 : (b.endMins - b.startMins) / 60
    let minutosRepaso = Math.max(1, Math.round(durationHours * 8))
    const numConfianza = { flojo: 1, regular: 2, bien: 3 }[confStr]

    repasosData.unshift({
      id: Date.now(),
      titulo: b.titulo,
      especialidad: b.especialidad || 'Sin asignar',
      tema: b.tema,
      destinoGuardado: destino,
      minutosRepaso,
      fase: 0,
      fechaProximoRepaso: new Date().setHours(0, 0, 0, 0),
      confianza: numConfianza,
    })
    bloquesCompletados.push(b.id)
    persistData()

    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const guardarBloqueSinRepaso = (b) => {
    registrarTiempoSiNecesario(b)
    bloquesCompletados.push(b.id)
    persistData()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const descartarBloque = (b, accion) => {
    if (accion === 'pendientes') {
      tareasPendientesGlobal.push(b)
      alert('Añadida a Tareas Pendientes en el Calendario.')
    } else if (accion === 'eliminar') {
      alert('Tarea eliminada del plan de hoy.')
    } else if (accion === 'reasignar') {
      if (!nuevaFecha.match(/^\d{4}-\d{2}-\d{2}$/)) {
        alert('Por favor, usa el formato YYYY-MM-DD (ej: 2026-05-07)')
        return
      }
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

  const dayDone = dynamicPlan.filter(b => b.completado).length
  const dayPct  = dynamicPlan.length === 0 ? 0 : (dayDone / dynamicPlan.length) * 100

  return (
    <div style={{ padding: '0', maxWidth: '800px', margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.3px', color: '#1e293b' }}>
        Sesión de estudio en curso
      </h2>

      <div style={{ background: '#f8fafc', borderRadius: 16, padding: 20, border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Plan del día
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>
            {dayDone} de {dynamicPlan.length} completados
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ background: '#e2e8f0', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ width: `${dayPct}%`, background: ACCENT, height: '100%', borderRadius: 6, transition: 'width 0.5s ease-out' }} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dynamicPlan.map(b => {
            const isActiveTimer = activeEntry?.bloqueId === b.id
            const workedTime = getBlockSeconds(b.id)

            return (
              <div key={b.id} style={{
                padding: '16px',
                borderRadius: 12,
                background: b.activo ? '#fff' : '#fcfcfc',
                border: `1px solid ${isActiveTimer ? '#3b82f6' : b.activo ? '#cbd5e1' : '#e2e8f0'}`,
                borderLeft: `4px solid ${isActiveTimer ? '#3b82f6' : b.completado ? '#22c55e' : b.activo ? ACCENT : '#cbd5e1'}`,
                opacity: b.completado ? 0.6 : 1,
                transition: 'all 0.2s',
                boxShadow: isActiveTimer ? '0 4px 12px rgba(59,130,246,0.15)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 4 }}>
                      {b.inicio}–{b.fin}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', lineHeight: 1.3 }}>
                      {b.titulo}
                    </div>
                  </div>

                  {!b.completado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: isActiveTimer ? '#eff6ff' : '#f1f5f9', padding: '6px 12px', borderRadius: 8 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: isActiveTimer ? '#2563eb' : '#475569', minWidth: '85px', textAlign: 'center' }}>
                          {formatTime(workedTime)}
                        </span>
                        {isActiveTimer ? (
                          <button
                            onClick={() => stopTracking()}
                            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.2)' }}>
                            Pausar
                          </button>
                        ) : (
                          <button
                            onClick={() => startTracking({ descripcion: b.titulo, especialidad: b.especialidad, tema: b.tema, bloqueId: b.id })}
                            style={{ background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            Comenzar
                          </button>
                        )}
                      </div>

                      {finishingBlock !== b.id && skippingBlock !== b.id && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button
                            onClick={() => { setFinishingBlock(b.id); setWantsReview(null); setSkippingBlock(null) }}
                            style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
                            Finalizar
                          </button>
                          <button
                            onClick={() => { setSkippingBlock(b.id); setFinishingBlock(null) }}
                            style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                            No Hecha
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {b.completado && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#64748b' }}>
                        Trabajado: {formatTime(workedTime)}
                      </span>
                      <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 800, background: '#dcfce7', padding: '4px 10px', borderRadius: 20 }}>
                        ✓ Completado
                      </span>
                    </div>
                  )}
                </div>

                {finishingBlock === b.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {workedTime > 0 && (
                      <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
                        ⏱ Tiempo cronometrado: <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>{formatTime(workedTime)}</span>
                        {!workedTime && <span style={{ color: '#f59e0b' }}> (se registrarán las horas planificadas)</span>}
                      </div>
                    )}
                    {wantsReview === null ? (
                      <>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>
                          ¿Has generado material nuevo para repasar en el futuro?
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => setWantsReview(true)}
                            style={{ flex: 1, padding: '10px 0', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                            Sí, mandar a Repasos
                          </button>
                          <button onClick={() => guardarBloqueSinRepaso(b)}
                            style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                            No, solo finalizar ✓
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>
                            ¿Dónde vas a guardar los contenidos generados?
                          </div>
                          <input
                            value={destino}
                            onChange={e => setDestino(e.target.value)}
                            placeholder="Ej: Notion, Anki, Libreta, iPad..."
                            style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 8, border: '1px solid #cbd5e1', outline: 'none', boxSizing: 'border-box' }}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>
                            ¿Cómo te ha salido?
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {CONFIANZA_OPTS.map(opt => (
                              <button
                                key={opt.id}
                                onClick={() => guardarBloque(b, opt.id)}
                                style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={() => { setFinishingBlock(null); setWantsReview(null) }} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {skippingBlock === b.id && (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>
                      ¿Qué quieres hacer con esta tarea no realizada?
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => descartarBloque(b, 'pendientes')} style={{ flex: 1, padding: '10px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                        Enviar a Pendientes
                      </button>
                      <button onClick={() => descartarBloque(b, 'eliminar')} style={{ flex: 1, padding: '10px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                        Eliminar Tarea
                      </button>
                      <div style={{ display: 'flex', gap: 8, flex: 2 }}>
                        <input
                          value={nuevaFecha}
                          onChange={e => setNuevaFecha(e.target.value)}
                          placeholder="YYYY-MM-DD"
                          style={{ width: '80px', padding: '10px', borderRadius: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600 }}
                        />
                        <button onClick={() => descartarBloque(b, 'reasignar')} style={{ flex: 1, padding: '10px', background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>
                          Reasignar Fecha
                        </button>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 12 }}>
                      <button onClick={() => setSkippingBlock(null)} style={{ background: 'transparent', border: 'none', color: '#64748b', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: '4px 8px' }}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
