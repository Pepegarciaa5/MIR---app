import { useState, useEffect, useRef } from 'react'
import {
  planesCalendarioGlobal, repasosData, tareasPendientesGlobal,
  planesAdicionales, todayStr, bloquesCompletados, bloquesDescartados,
} from '../data/mockData'
import { upsertRepaso, addBloqueCompletado, addBloqueDescartado, addPlanAdicional } from '../lib/db'
import { saveMnemotecnia } from '../lib/mnemotecnias'
import { useTracker } from '../context/TrackerContext'
import { especialidadesMIR, especialidadNombres, getEspecialidadColor } from '../data/especialidadesMIR'

const ACCENT = '#F26522'
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

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateHeader(dateStr, todayStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const isToday = dateStr === todayStr
  const isYesterday = dateStr === addDays(todayStr, -1)
  const isTomorrow = dateStr === addDays(todayStr, 1)
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' })
  const short = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  if (isToday)     return { label: 'Hoy', sub: short, accent: true }
  if (isYesterday) return { label: 'Ayer', sub: short, accent: false }
  if (isTomorrow)  return { label: 'Mañana', sub: short, accent: false }
  return { label: weekday.charAt(0).toUpperCase() + weekday.slice(1), sub: short, accent: false }
}

// ─── Timeline helpers ─────────────────────────────────────────────────────────

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToPx(mins) {
  return ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function fmt(s) {
  if (!s) return '0s'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2,'0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`
  return `${sec}s`
}

function getBlockStyle(titulo) {
  if (!titulo) return { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
  const emoji = [...titulo][0]
  return BLOCK_STYLES[emoji] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
}

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

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

// ─── Day summary bar ──────────────────────────────────────────────────────────

function DaySummary({ entries, plan, completados }) {
  const totalSecs = entries.reduce((s, e) => s + e.duracionSegundos, 0)
  const doneBlocks = plan.filter(b => completados.includes(b.id)).length
  if (totalSecs === 0 && doneBlocks === 0) return null
  return (
    <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#64748b' }}>
      {totalSecs > 0 && <span>⏱ {fmt(totalSecs)}</span>}
      {doneBlocks > 0 && <span>✓ {doneBlocks}/{plan.length} bloques</span>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SesionDia() {
  const { entries, activeEntry, elapsed, startTracking, stopTracking, getBlockSeconds, editEntry, deleteEntry } = useTracker()

  const [selectedDate, setSelectedDate] = useState(todayStr)
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
  // Add/Edit task state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false)
  const [showMnemotecniaForm, setShowMnemotecniaForm] = useState(false)
  const [mneTexto, setMneTexto] = useState('')
  const [mneAsig, setMneAsig] = useState('')

  useEffect(() => {
    if (showMnemotecniaForm && activeEntry) {
      setMneAsig(activeEntry.especialidad || '')
    }
  }, [showMnemotecniaForm, activeEntry])

  const crearMnemotecnia = () => {
    if (!mneTexto.trim()) return
    saveMnemotecnia({
      id: `MNE-${Date.now()}`,
      texto: mneTexto.trim(),
      asignatura: mneAsig,
      bloqueId: activeEntry?.bloqueId || null,
      importancia: 'mnemotecnia'
    })
    setShowMnemotecniaForm(false)
    setMneTexto('')
  }
  const [editingTask, setEditingTask] = useState(null)
  const [taskTitulo, setTaskTitulo] = useState('')
  const [taskInicio, setTaskInicio] = useState('')
  const [taskFin, setTaskFin] = useState('')
  const [taskEsp, setTaskEsp] = useState('')
  const [taskTema, setTaskTema] = useState('')
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
  const [repasoConfianza, setRepasoConfianza] = useState('regular')
  const [repasoEnviados, setRepasoEnviados] = useState(new Set())

  const timelineRef = useRef(null)
  const isToday = selectedDate === todayStr

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  // Sync completed/removed when they change externally
  useEffect(() => {
    setManualCompleted([...bloquesCompletados])
    setRemovedBlocks([...bloquesDescartados])
  }, [bloquesCompletados.length, bloquesDescartados.length])

  // Auto-scroll: scroll to current time on today, to top on other days
  useEffect(() => {
    if (!timelineRef.current) return
    if (isToday) {
      const nowMins = now.getHours() * 60 + now.getMinutes()
      const nowPx = minsToPx(nowMins)
      timelineRef.current.scrollTop = Math.max(0, nowPx - 120)
    } else {
      // Scroll to first block of the day
      const dayBlocks = [...(planesCalendarioGlobal[selectedDate] || []), ...(planesAdicionales[selectedDate] || [])]
      if (dayBlocks.length > 0) {
        const firstMins = timeToMins(dayBlocks[0].inicio || '08:00')
        timelineRef.current.scrollTop = Math.max(0, minsToPx(firstMins) - 60)
      } else {
        timelineRef.current.scrollTop = minsToPx(8 * 60) // 08:00
      }
    }
  }, [selectedDate]) // eslint-disable-line react-hooks/exhaustive-deps

  // Navigate days
  function goDay(delta) {
    setSelectedDate(prev => addDays(prev, delta))
    setFinishingBlock(null)
    setSkippingBlock(null)
    setEditingTracker(null)
    setRepasoTracker(null)
    setHoveredBlock(null)
    setHoveredTracker(null)
    setIsTaskModalOpen(false)
  }

  function goToday() {
    setSelectedDate(todayStr)
    setFinishingBlock(null)
    setSkippingBlock(null)
    setEditingTracker(null)
    setRepasoTracker(null)
    setIsTaskModalOpen(false)
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowPx = minsToPx(nowMins)

  // Plan for selected date
  const rawPlan = [
    ...(planesCalendarioGlobal[selectedDate] || []),
    ...(planesAdicionales[selectedDate] || []),
  ].filter(b => !removedBlocks.includes(b.id))

  const dynamicPlan = rawPlan.map(b => {
    const startMins = timeToMins(b.inicio)
    const endMins = timeToMins(b.fin)
    const activo = isToday && nowMins >= startMins && nowMins < endMins
    const completado = manualCompleted.includes(b.id)
    return { ...b, activo, completado, startMins, endMins }
  })

  const dayDone = dynamicPlan.filter(b => b.completado).length

  // Tracker entries for selected date
  const dateTrackers = entries.filter(e => e.fecha === selectedDate)
  if (isToday && activeEntry?.fecha === selectedDate) {
    dateTrackers.unshift({ ...activeEntry, isActivo: true, fin: now.getTime(), duracionSegundos: elapsed })
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  function openTaskModal(task = null) {
    if (task) {
      setEditingTask(task)
      setTaskTitulo(task.titulo)
      setTaskInicio(task.inicio)
      setTaskFin(task.fin)
      setTaskEsp(task.especialidad || '')
      setTaskTema(task.tema || '')
    } else {
      setEditingTask(null)
      setTaskTitulo('')
      setTaskInicio('16:00')
      setTaskFin('17:00')
      setTaskEsp('')
      setTaskTema('')
    }
    setIsTaskModalOpen(true)
    setFinishingBlock(null)
    setSkippingBlock(null)
  }

  function saveTask() {
    if (!taskTitulo.trim() || !taskInicio || !taskFin) {
      alert('Por favor, rellena al menos el título, inicio y fin.')
      return
    }
    
    if (editingTask) {
      const esAdicional = planesAdicionales[selectedDate]?.find(b => b.id === editingTask.id)
      if (!esAdicional) {
        bloquesDescartados.push(editingTask.id)
        addBloqueDescartado(editingTask.id)
        setRemovedBlocks(prev => [...prev, editingTask.id])
      }
    }
    
    const newTask = {
      id: editingTask && planesAdicionales[selectedDate]?.find(b => b.id === editingTask.id) ? editingTask.id : Date.now(),
      titulo: taskTitulo.trim(),
      inicio: taskInicio,
      fin: taskFin,
      especialidad: taskEsp || null,
      tema: taskTema || null
    }

    if (!planesAdicionales[selectedDate]) planesAdicionales[selectedDate] = []
    
    if (editingTask && planesAdicionales[selectedDate]?.find(b => b.id === editingTask.id)) {
      const idx = planesAdicionales[selectedDate].findIndex(b => b.id === editingTask.id)
      if (idx !== -1) planesAdicionales[selectedDate][idx] = newTask
    } else {
      planesAdicionales[selectedDate].push(newTask)
    }
    
    addPlanAdicional(selectedDate, newTask)
    setIsTaskModalOpen(false)
    setEditingTask(null)
  }

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
    setRepasoConfianza('regular')
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
      confianza: { flojo: 1, regular: 2, bien: 3 }[repasoConfianza] ?? (typeof repasoConfianza === 'number' ? repasoConfianza : 2),
      bloqueOrigenId: repasoTracker.bloqueId || null,
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

  const guardarBloque = (b, confStr) => {
    if (!destino.trim()) { alert('Indica dónde vas a guardar los contenidos primero.'); return }
    const workedSeconds = getBlockSeconds(b.id)
    const durationHours = workedSeconds > 0 ? workedSeconds / 3600 : (b.endMins - b.startMins) / 60
    const minutosRepaso = Math.max(1, Math.round(durationHours * 8))
    const numConfianza = { flojo: 1, regular: 2, bien: 3 }[confStr]
    const newRepaso = {
      id: Date.now(),
      titulo: b.titulo,
      especialidad: b.especialidad || 'Sin asignar',
      tema: b.tema,
      destinoGuardado: destino,
      minutosRepaso,
      fase: 0,
      fechaProximoRepaso: new Date().setHours(0, 0, 0, 0),
      confianza: numConfianza,
      bloqueOrigenId: b.id,
    }
    repasosData.unshift(newRepaso)
    upsertRepaso(newRepaso)
    bloquesCompletados.push(b.id)
    addBloqueCompletado(b.id)
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const guardarBloqueSinRepaso = (b) => {
    bloquesCompletados.push(b.id)
    addBloqueCompletado(b.id)
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setManualCompleted(prev => [...prev, b.id])
    setFinishingBlock(null)
    setWantsReview(null)
    setDestino('')
  }

  const descartarBloque = (b, accion) => {
    if (accion === 'pendientes') { tareasPendientesGlobal.push(b) }
    else if (accion === 'reasignar') {
      if (!nuevaFecha.match(/^\d{4}-\d{2}-\d{2}$/)) { alert('Usa el formato YYYY-MM-DD'); return }
      const nb = { ...b, id: Date.now() }
      if (!planesAdicionales[nuevaFecha]) planesAdicionales[nuevaFecha] = []
      planesAdicionales[nuevaFecha].push(nb)
      addPlanAdicional(nuevaFecha, nb)
    }
    bloquesDescartados.push(b.id)
    addBloqueDescartado(b.id)
    if (activeEntry?.bloqueId === b.id) stopTracking()
    setRemovedBlocks(prev => [...prev, b.id])
    setSkippingBlock(null)
    setNuevaFecha('')
  }

  const dateInfo = formatDateHeader(selectedDate, todayStr)
  const hasPlan = dynamicPlan.length > 0
  const dateEntries = entries.filter(e => e.fecha === selectedDate)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff' }}>

      {/* ── Day navigator ── */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
        background: '#fff',
      }}>
        {/* prev */}
        <button onClick={() => goDay(-1)} style={{
          width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>‹</button>

        {/* date display */}
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            fontSize: 14, fontWeight: 800, letterSpacing: '-0.2px',
            color: dateInfo.accent ? ACCENT : '#1a1a1a',
          }}>
            {dateInfo.label}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>
            {dateInfo.sub}
          </div>
        </div>

        {/* next */}
        <button onClick={() => goDay(1)} style={{
          width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>›</button>
      </div>

      {/* ── Subheader: stats + "Hoy" button ── */}
      <div style={{
        padding: '6px 14px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0, minHeight: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {hasPlan ? (
            <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
              {dayDone}/{dynamicPlan.length} bloques
              {dateEntries.length > 0 && (
                <span style={{ color: ACCENT, marginLeft: 8 }}>
                  ⏱ {fmt(dateEntries.reduce((s, e) => s + e.duracionSegundos, 0))}
                </span>
              )}
            </span>
          ) : (
            <span style={{ fontSize: 11, color: '#bbb' }}>
              {dateEntries.length > 0
                ? `⏱ ${fmt(dateEntries.reduce((s, e) => s + e.duracionSegundos, 0))} trackeadas`
                : 'Sin bloques planificados'}
            </span>
          )}
          <button onClick={() => setShowMnemotecniaForm(true)} style={{
            padding: '4px 10px', border: 'none', borderRadius: 6, marginRight: 8,
            background: '#fdf4ff', color: '#c026d3', fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            🧠 Mnemotecnia
          </button>
          <button onClick={() => openTaskModal()} style={{
            padding: '4px 10px', border: 'none', borderRadius: 6,
            background: '#e0f2fe', color: '#0369a1', fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            ➕ Añadir
          </button>
        </div>

        {!isToday && (
          <button onClick={goToday} style={{
            padding: '3px 10px', border: `1px solid ${ACCENT}`, borderRadius: 6,
            background: '#fff', color: ACCENT, fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>
            Hoy
          </button>
        )}
      </div>

      {/* ── Timeline ── */}
      <div ref={timelineRef} style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
        <div style={{
          display: 'flex',
          minHeight: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`,
          position: 'relative',
        }}>

          {/* Hour labels */}
          <div style={{ width: 52, flexShrink: 0 }}>
            {hours.map(h => (
              <div key={h} style={{
                height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start',
                justifyContent: 'flex-end', paddingRight: 10, paddingTop: 6,
              }}>
                <span style={{ fontSize: 11, color: '#b0bec5', fontWeight: 500, userSelect: 'none' }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day column */}
          <div style={{
            flex: 1, position: 'relative',
            borderLeft: '1px solid #e2e8f0',
            background: isToday ? '#fffdf7' : '#fafafa',
          }}>

            {/* Hour lines */}
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ height: HOUR_HEIGHT / 2, borderBottom: '1px dashed #f8fafc' }} />
              </div>
            ))}

            {/* Current time indicator (only today) */}
            {isToday && nowPx >= 0 && nowPx < (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
              <div style={{
                position: 'absolute', top: nowPx, left: 0, right: 0,
                zIndex: 6, pointerEvents: 'none',
              }}>
                <div style={{ height: 2, background: ACCENT, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -4, top: -4,
                    width: 10, height: 10, borderRadius: '50%', background: ACCENT,
                  }} />
                </div>
              </div>
            )}

            {/* Plan blocks */}
            {dynamicPlan.map(b => {
              const { startMins, endMins } = b
              if (endMins <= START_HOUR * 60 || startMins >= END_HOUR * 60) return null
              const clampedStart = Math.max(startMins, START_HOUR * 60)
              const clampedEnd = Math.min(endMins, END_HOUR * 60)
              const top = minsToPx(clampedStart)
              const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 3, 24)
              const bStyle = getBlockStyle(b.titulo)
              const isActive = isToday && activeEntry?.bloqueId === b.id
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
                    position: 'absolute', top: top + 1, left: 3,
                    width: 'calc(60% - 6px)', height,
                    background: b.completado ? '#f8fafc' : bStyle.bg,
                    border: `1.5px dashed ${isActive ? ACCENT : b.completado ? '#cbd5e1' : bStyle.border}`,
                    borderLeft: `4px solid ${isActive ? ACCENT : b.completado ? '#94a3b8' : bStyle.border}`,
                    borderRadius: 7, padding: '4px 8px', overflow: 'hidden',
                    zIndex: isActive || isFinishing || isSkipping ? 8 : 2,
                    boxShadow: isActive ? `0 3px 12px ${ACCENT}35` : isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                    opacity: b.completado ? 0.4 : 0.85,
                    transition: 'box-shadow 0.15s',
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <div style={{
                      fontSize: 11, color: b.completado ? '#94a3b8' : bStyle.text,
                      fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap', lineHeight: 1.3,
                    }}>
                      {b.titulo}
                    </div>
                    {height > 30 && (
                      <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                        {b.inicio} – {b.fin}
                      </div>
                    )}
                    {height > 48 && workedSecs > 0 && (
                      <div style={{
                        fontFamily: 'monospace', fontSize: 10,
                        fontWeight: 700, color: isActive ? ACCENT : '#64748b', marginTop: 3,
                      }}>
                        ⏱ {fmt(workedSecs)}
                      </div>
                    )}
                    {b.completado && height > 28 && (
                      <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>
                        ✓ Completado
                      </div>
                    )}
                  </div>

                  {/* Buttons */}
                  {!b.completado && (isHovered || isActive) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'flex-end' }}>
                      {isToday && (
                        <button
                          onClick={() => isActive
                            ? stopTracking()
                            : startTracking({ descripcion: b.titulo, especialidad: b.especialidad, tema: b.tema, bloqueId: b.id })}
                          style={{
                            padding: '3px 8px', border: 'none', borderRadius: 5,
                            fontSize: 10, fontWeight: 700, cursor: 'pointer',
                            background: isActive ? '#2563eb' : '#e2e8f0',
                            color: isActive ? '#fff' : '#334155',
                          }}
                        >
                          {isActive ? `⏸ ${fmt(workedSecs)}` : '▶ Empezar'}
                        </button>
                      )}
                      
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            openTaskModal(b)
                          }}
                          style={{ padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#e0f2fe', color: '#0369a1' }}
                        >✏️ Editar</button>

                        {isToday && height > 52 && (
                          <>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setFinishingBlock(b.id); setWantsReview(null); setSkippingBlock(null)
                                if (activeEntry?.bloqueId === b.id) stopTracking()
                              }}
                              style={{ padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#10b981', color: '#fff' }}
                            >✓ Fin</button>
                            <button
                              onClick={e => {
                                e.stopPropagation()
                                setSkippingBlock(b.id); setFinishingBlock(null)
                                if (activeEntry?.bloqueId === b.id) stopTracking()
                              }}
                              style={{ padding: '2px 6px', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer', background: '#fee2e2', color: '#ef4444' }}
                            >✗</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Tracker entries */}
            {(() => {
              const sorted = [...dateTrackers].sort((a, b) => a.inicio - b.inicio)
              let lastBottom = 0
              return sorted.map((t, idx) => {
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
                      background: isBeingEdited ? '#eff6ff' : tColor.bg,
                      border: `1px solid ${isBeingEdited ? '#3b82f6' : t.isActivo ? ACCENT : tColor.border}`,
                      borderLeft: `5px solid ${isBeingEdited ? '#3b82f6' : t.isActivo ? ACCENT : tColor.text}`,
                      borderRadius: 7, padding: '4px 8px', overflow: 'hidden',
                      zIndex: t.isActivo ? 10 : 7,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                      display: 'flex', flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, height: '100%' }}>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <div style={{
                          fontSize: 11, color: tColor.text, fontWeight: 800,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3,
                        }}>
                          {t.descripcion}
                        </div>
                        {height > 35 && (
                          <div style={{ fontSize: 9, color: tColor.text, marginTop: 2, opacity: 0.7 }}>
                            {String(startD.getHours()).padStart(2,'0')}:{String(startD.getMinutes()).padStart(2,'0')}
                            {' – '}
                            {t.isActivo ? '...' : `${String(endD.getHours()).padStart(2,'0')}:${String(endD.getMinutes()).padStart(2,'0')}`}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {/* Edit/repaso buttons — only for non-active entries */}
                        {!t.isActivo && (isHovered || isBeingEdited || repasoTracker?.id === t.id) && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            {repasoEnviados.has(t.id) ? (
                              <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 800 }}>📚✓</span>
                            ) : (
                              <button
                                onClick={() => repasoTracker?.id === t.id ? setRepasoTracker(null) : openRepasoTracker(t)}
                                style={{
                                  padding: '2px 4px', border: 'none', borderRadius: 4,
                                  fontSize: 10, cursor: 'pointer',
                                  background: repasoTracker?.id === t.id ? '#dcfce7' : tColor.border,
                                  color: '#16a34a', fontWeight: 700,
                                }}>
                                📚
                              </button>
                            )}
                            <button
                              onClick={() => isBeingEdited ? setEditingTracker(null) : openEditTracker(t)}
                              style={{
                                padding: '2px 4px', border: 'none', borderRadius: 4,
                                fontSize: 10, cursor: 'pointer',
                                background: isBeingEdited ? '#3b82f6' : tColor.border,
                                color: isBeingEdited ? '#fff' : tColor.text, fontWeight: 700,
                              }}>
                              ✏️
                            </button>
                          </div>
                        )}
                        {dur > 0 && (
                          <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: t.isActivo ? ACCENT : tColor.text }}>
                            ⏱ {fmt(dur)}
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

      {/* ── Task modal/panel ── */}
      {isTaskModalOpen && (() => {
        const editTemas = taskEsp ? (especialidadesMIR[taskEsp]?.temas || []) : []
        return (
          <div style={{ borderTop: '1px solid #bfdbfe', padding: '14px 16px', background: '#f0f9ff', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 12 }}>
              {editingTask ? 'Editar tarea' : 'Nueva tarea'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: 4 }}>Título *</label>
                <input value={taskTitulo} onChange={ev => setTaskTitulo(ev.target.value)}
                  placeholder="Ej: 📖 Estudio Cardiología"
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: 4 }}>Asignatura</label>
                  <select value={taskEsp} onChange={ev => { setTaskEsp(ev.target.value); setTaskTema('') }}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, background: '#fff', color: taskEsp ? '#374151' : '#9ca3af' }}>
                    <option value="">— Ninguna —</option>
                    {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
                    <option value="_libre">Actividad libre</option>
                  </select>
                </div>
                {taskEsp && editTemas.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: 4 }}>Tema</label>
                    <select value={taskTema} onChange={ev => setTaskTema(ev.target.value)}
                      style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 12, background: '#fff', color: taskTema ? '#374151' : '#9ca3af' }}>
                      <option value="">— Ninguno —</option>
                      {editTemas.map((t, i) => <option key={i} value={t}>{t}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: 4 }}>Inicio *</label>
                  <input type="time" value={taskInicio} onChange={ev => setTaskInicio(ev.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 13, fontWeight: 600 }} />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'block', marginBottom: 4 }}>Fin *</label>
                  <input type="time" value={taskFin} onChange={ev => setTaskFin(ev.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bae6fd', fontSize: 13, fontWeight: 600 }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
                <button onClick={() => setIsTaskModalOpen(false)}
                  style={{ padding: '6px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                  Cancelar
                </button>
                <button onClick={saveTask}
                  style={{ padding: '6px 16px', background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Guardar Tarea
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ── Finalizar panel ── */}
      {finishingBlock && (() => {
        const b = dynamicPlan.find(x => x.id === finishingBlock)
        if (!b) return null
        const workedSecs = getBlockSeconds(b.id)
        return (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 16px', background: '#f8fafc', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
              Finalizar: <span style={{ color: ACCENT }}>{b.titulo}</span>
            </div>
            {workedSecs > 0 && (
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 10 }}>
                Tiempo: {fmt(workedSecs)}
              </div>
            )}
            {wantsReview === null ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>
                  ¿Has generado material para repasar?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setWantsReview(true)}
                    style={{ flex: 1, padding: '8px 0', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#0f172a', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                    Sí, a Repasos
                  </button>
                  <button onClick={() => guardarBloqueSinRepaso(b)}
                    style={{ flex: 1, padding: '8px 0', border: 'none', borderRadius: 8, background: '#10b981', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    No, solo finalizar ✓
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={destino} onChange={e => setDestino(e.target.value)}
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
            <button onClick={() => { setFinishingBlock(null); setWantsReview(null) }}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', marginTop: 6 }}>
              Cancelar
            </button>
          </div>
        )
      })()}

      {/* ── Send to Repasos panel ── */}
      {repasoTracker && (
        <div style={{ borderTop: '1px solid #86efac', padding: '14px 16px', background: '#f0fdf4', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 12 }}>
            Enviar a Repasos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 4 }}>Título</label>
              <input value={repasoTitulo} onChange={e => setRepasoTitulo(e.target.value)}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 4 }}>¿Dónde está guardado?</label>
              <input value={repasoDestino} onChange={e => setRepasoDestino(e.target.value)}
                placeholder="Notion, Anki, libreta..."
                style={{ width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 6 }}>Nivel de dominio</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CONFIANZA_OPTS.map(opt => (
                  <button key={opt.id} onClick={() => setRepasoConfianza(opt.id)}
                    style={{
                      flex: 1, padding: '8px 0',
                      border: repasoConfianza === opt.id ? `2px solid ${opt.color}` : '2px solid transparent',
                      borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>
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

      {/* ── Edit tracker panel ── */}
      {editingTracker && (() => {
        const editTemas = editEsp ? (especialidadesMIR[editEsp]?.temas || []) : []
        const previewSecs = Math.max(0, Math.floor(
          (applyTime(editingTracker.fin, editFin) - applyTime(editingTracker.inicio, editInicio)) / 1000
        ))
        const previewStr = fmt(previewSecs)
        return (
          <div style={{ borderTop: '1px solid #bfdbfe', padding: '14px 16px', background: '#eff6ff', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', marginBottom: 12 }}>
              Editar actividad trackeada
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Nombre</label>
                <input value={editDesc} onChange={ev => setEditDesc(ev.target.value)}
                  style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }} />
              </div>
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
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setConfirmDeleteTracker(editingTracker.id)}
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

      {/* ── Skip block panel ── */}
      {skippingBlock && (() => {
        const b = dynamicPlan.find(x => x.id === skippingBlock)
        if (!b) return null
        return (
          <div style={{ borderTop: '1px solid #e2e8f0', padding: '14px 16px', background: '#fff7ed', flexShrink: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 10 }}>
              ¿Qué hacer con: <span style={{ color: '#ea580c' }}>{b.titulo}</span>?
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              <button onClick={() => descartarBloque(b, 'pendientes')}
                style={{ flex: 1, padding: '8px', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Enviar a Pendientes
              </button>
              <button onClick={() => descartarBloque(b, 'eliminar')}
                style={{ flex: 1, padding: '8px', background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                Eliminar
              </button>
              <div style={{ display: 'flex', gap: 6, flex: 2, minWidth: 160 }}>
                <input value={nuevaFecha} onChange={e => setNuevaFecha(e.target.value)}
                  placeholder="YYYY-MM-DD"
                  style={{ width: 100, padding: '8px', borderRadius: 8, border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 600, fontSize: 12 }} />
                <button onClick={() => descartarBloque(b, 'reasignar')}
                  style={{ flex: 1, padding: '8px', background: '#e0e7ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  Reasignar
                </button>
              </div>
            </div>
            <button onClick={() => setSkippingBlock(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        )
      })()}

      {/* Modal Mnemotecnia */}
      {showMnemotecniaForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 400,
            padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 18, color: '#0f172a' }}>🧠 Crear Mnemotecnia</h3>
            
            <select
              value={mneAsig} onChange={e => setMneAsig(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 12, fontSize: 14 }}
            >
              <option value="">— Asignatura —</option>
              {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            
            <textarea
              value={mneTexto} onChange={e => setMneTexto(e.target.value)}
              placeholder="Escribe tu truco o regla mnemotécnica aquí..."
              rows={4}
              style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '1px solid #cbd5e1', marginBottom: 16, fontSize: 14, resize: 'none', fontFamily: 'inherit' }}
            />
            
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowMnemotecniaForm(false)}
                style={{ flex: 1, padding: '10px', background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: 10, fontWeight: 600, cursor: 'pointer' }}>
                Cancelar
              </button>
              <button onClick={crearMnemotecnia} disabled={!mneTexto.trim()}
                style={{ flex: 1, padding: '10px', background: '#c026d3', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: mneTexto.trim() ? 'pointer' : 'default', opacity: mneTexto.trim() ? 1 : 0.5 }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
