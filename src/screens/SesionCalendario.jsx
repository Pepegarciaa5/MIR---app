import { useState, useEffect } from 'react'
import { planesCalendarioGlobal, bloquesCompletados, persistData, repasosData } from '../data/mockData'
import { useTracker } from '../context/TrackerContext'

const ACCENT = '#F26522'
const HOUR_HEIGHT = 80
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

const DAY_LABELS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE']

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function minsToPx(mins) {
  return ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function formatMinutes(totalMins) {
  if (!totalMins) return '0h'
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  return h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`
}

function fmt(s) {
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

function dateToKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getWeekDays(referenceDate) {
  const d = new Date(referenceDate)
  const dow = d.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return Array.from({ length: 5 }, (_, i) => {
    const day = new Date(d)
    day.setDate(d.getDate() + i)
    return day
  })
}

function getWeekNumber(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7)
  const yearStart = new Date(d.getFullYear(), 0, 4)
  return 1 + Math.round(((d - yearStart) / 86400000 - 3 + (yearStart.getDay() + 6) % 7) / 7)
}

function getBlockStyle(titulo) {
  if (!titulo) return { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
  const emoji = [...titulo][0]
  return BLOCK_STYLES[emoji] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
}

export default function SesionCalendario() {
  const { activeEntry, elapsed, startTracking, stopTracking, getBlockSeconds, entries } = useTracker()
  const [weekOffset, setWeekOffset] = useState(0)
  const [now, setNow] = useState(new Date())
  const [completados, setCompletados] = useState(new Set(bloquesCompletados))
  const [goalsOpen, setGoalsOpen] = useState(true)
  const [hoveredBlock, setHoveredBlock] = useState(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayKey = dateToKey(today)

  const refDate = new Date()
  refDate.setDate(refDate.getDate() + weekOffset * 7)
  const weekDays = getWeekDays(refDate)
  const weekNum = getWeekNumber(weekDays[0])
  const isCurrentWeek = weekOffset === 0

  const weekLabel = (() => {
    const s = weekDays[0], e = weekDays[4]
    const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
    if (s.getMonth() === e.getMonth())
      return `${s.getDate()} – ${e.getDate()} ${months[s.getMonth()]}`
    return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]}`
  })()

  const weekTotalMins = weekDays.reduce((acc, day) => {
    const blocks = planesCalendarioGlobal[dateToKey(day)] || []
    return acc + blocks.reduce((s, b) => s + timeToMins(b.fin) - timeToMins(b.inicio), 0)
  }, 0)

  const nowMins = now.getHours() * 60 + now.getMinutes()
  const nowPx = minsToPx(nowMins)

  const handleBlockClick = (b) => {
    if (completados.has(b.id)) return
    if (activeEntry?.bloqueId === b.id) {
      stopTracking()
    } else {
      startTracking({ descripcion: b.titulo, especialidad: b.especialidad, tema: b.tema, bloqueId: b.id })
    }
  }

  const markComplete = (b) => {
    bloquesCompletados.push(b.id)
    persistData()
    setCompletados(prev => new Set([...prev, b.id]))
    if (activeEntry?.bloqueId === b.id) stopTracking()
  }

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)

  // Tracker entries for this week as calendar blocks
  const trackerBlocksByDay = {}
  entries.forEach(e => {
    if (!trackerBlocksByDay[e.fecha]) trackerBlocksByDay[e.fecha] = []
    trackerBlocksByDay[e.fecha].push(e)
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontFamily: 'system-ui,-apple-system,sans-serif', background: '#fff', minWidth: 0 }}>

      {/* ── Navigation bar ──────────────────────────────────────── */}
      <div style={{ padding: '8px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12, background: '#fafafa', flexShrink: 0, flexWrap: 'wrap', rowGap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', overflow: 'hidden' }}>
          <button onClick={() => setWeekOffset(p => p - 1)} style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>‹</button>
          <div style={{ padding: '5px 12px', borderLeft: '1px solid #e2e8f0', borderRight: '1px solid #e2e8f0', fontSize: 13, fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            <span>📅</span>
            <span>{isCurrentWeek ? 'Esta semana' : weekLabel}</span>
            <span style={{ color: '#94a3b8', fontWeight: 400 }}>· S{weekNum}</span>
          </div>
          <button onClick={() => setWeekOffset(p => p + 1)} style={{ padding: '5px 10px', border: 'none', background: 'none', cursor: 'pointer', color: '#64748b', fontSize: 16 }}>›</button>
        </div>

        <div style={{ fontSize: 12, color: '#64748b', fontWeight: 500, whiteSpace: 'nowrap' }}>
          TOTAL <span style={{ fontWeight: 800, color: '#1e293b' }}>{formatMinutes(weekTotalMins)}</span>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ padding: '5px 14px', border: '1px solid #e2e8f0', borderRadius: 8, background: '#fff', fontSize: 13, fontWeight: 700, color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}>
          Calendario
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

          {/* Day headers */}
          <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: '#fff', zIndex: 10 }}>
            <div style={{ width: 60, flexShrink: 0 }} />
            {weekDays.map((day, i) => {
              const key = dateToKey(day)
              const isToday = key === todayKey
              const blocks = planesCalendarioGlobal[key] || []
              const dayMins = blocks.reduce((s, b) => s + timeToMins(b.fin) - timeToMins(b.inicio), 0)
              const done = blocks.filter(b => completados.has(b.id)).length

              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', padding: '10px 4px 8px', borderLeft: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: isToday ? ACCENT : '#94a3b8', marginBottom: 4 }}>
                    {DAY_LABELS[i]}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: isToday ? '#fff' : '#1e293b', background: isToday ? ACCENT : 'transparent', width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 4px' }}>
                    {day.getDate()}
                  </div>
                  <div style={{ fontSize: 10, color: '#94a3b8' }}>
                    {dayMins > 0 ? formatMinutes(dayMins) : '—'}
                    {done > 0 && <span style={{ marginLeft: 4, color: '#22c55e' }}>✓{done}</span>}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scrollable grid */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', minHeight: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px`, position: 'relative' }}>

              {/* Hour labels */}
              <div style={{ width: 60, flexShrink: 0 }}>
                {hours.map(h => (
                  <div key={h} style={{ height: HOUR_HEIGHT, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingRight: 10, paddingTop: 6 }}>
                    <span style={{ fontSize: 11, color: '#b0bec5', fontWeight: 500, userSelect: 'none' }}>
                      {`${String(h).padStart(2, '0')}:00`}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {weekDays.map((day, i) => {
                const key = dateToKey(day)
                const isToday = key === todayKey
                const blocks = planesCalendarioGlobal[key] || []
                const trackerBlocks = trackerBlocksByDay[key] || []

                return (
                  <div key={i} style={{ flex: 1, position: 'relative', borderLeft: '1px solid #e2e8f0', background: isToday ? '#fffdf7' : '#fff' }}>
                    {hours.map(h => (
                      <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }}>
                        <div style={{ height: HOUR_HEIGHT / 2, borderBottom: '1px dashed #f8fafc' }} />
                      </div>
                    ))}

                    {/* Current time indicator */}
                    {isToday && isCurrentWeek && nowPx >= 0 && nowPx < (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
                      <div style={{ position: 'absolute', top: nowPx, left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
                        <div style={{ height: 2, background: ACCENT, position: 'relative' }}>
                          <div style={{ position: 'absolute', left: -4, top: -4, width: 10, height: 10, borderRadius: '50%', background: ACCENT }} />
                        </div>
                      </div>
                    )}

                    {/* Tracker entries as thin left-strip blocks */}
                    {trackerBlocks.map(e => {
                      const startD = new Date(e.inicio)
                      const endD = new Date(e.fin || e.inicio + e.duracionSegundos * 1000)
                      const startMins = startD.getHours() * 60 + startD.getMinutes()
                      const endMins = endD.getHours() * 60 + endD.getMinutes()
                      if (endMins <= START_HOUR * 60 || startMins >= END_HOUR * 60) return null
                      const clampedStart = Math.max(startMins, START_HOUR * 60)
                      const clampedEnd = Math.min(endMins, END_HOUR * 60)
                      const top = minsToPx(clampedStart)
                      const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 1, 4)
                      return (
                        <div key={e.id} title={`${e.descripcion} (${fmt(e.duracionSegundos)})`} style={{ position: 'absolute', top: top + 1, left: 3, width: 5, height, background: '#22c55e', borderRadius: 3, opacity: 0.7, zIndex: 3 }} />
                      )
                    })}

                    {/* Plan blocks */}
                    {blocks.map(b => {
                      const startMins = timeToMins(b.inicio)
                      const endMins = timeToMins(b.fin)
                      if (endMins <= START_HOUR * 60 || startMins >= END_HOUR * 60) return null
                      const clampedStart = Math.max(startMins, START_HOUR * 60)
                      const clampedEnd = Math.min(endMins, END_HOUR * 60)
                      const top = minsToPx(clampedStart)
                      const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 3, 18)
                      const style = getBlockStyle(b.titulo)
                      const isCompleted = completados.has(b.id)
                      const isActive = activeEntry?.bloqueId === b.id
                      const isHovered = hoveredBlock === b.id
                      const workedSecs = getBlockSeconds(b.id)

                      return (
                        <div
                          key={b.id}
                          onClick={() => handleBlockClick(b)}
                          onMouseEnter={() => setHoveredBlock(b.id)}
                          onMouseLeave={() => setHoveredBlock(null)}
                          title={`${b.titulo}\n${b.inicio}–${b.fin}`}
                          style={{
                            position: 'absolute', top: top + 1, left: 10, right: 3, height,
                            background: isCompleted ? '#f8fafc' : style.bg,
                            border: `1.5px solid ${isActive ? ACCENT : isCompleted ? '#cbd5e1' : style.border}`,
                            borderLeft: `4px solid ${isActive ? ACCENT : isCompleted ? '#94a3b8' : style.border}`,
                            borderRadius: 6,
                            padding: '3px 6px 3px 5px',
                            cursor: isCompleted ? 'default' : 'pointer',
                            overflow: 'hidden', zIndex: isActive ? 5 : 2,
                            boxShadow: isActive ? `0 3px 12px ${ACCENT}35` : isHovered ? '0 2px 8px rgba(0,0,0,0.1)' : '0 1px 3px rgba(0,0,0,0.04)',
                            opacity: isCompleted ? 0.55 : 1,
                            transition: 'box-shadow 0.15s',
                          }}
                        >
                          <div style={{ fontSize: 10, fontWeight: 700, color: isCompleted ? '#94a3b8' : style.text, lineHeight: 1.35, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: height > 36 ? 2 : 1, WebkitBoxOrient: 'vertical', textOverflow: 'ellipsis' }}>
                            {b.titulo}
                          </div>
                          {height > 32 && (
                            <div style={{ fontSize: 9, color: isCompleted ? '#cbd5e1' : style.border, marginTop: 2, opacity: 0.85 }}>
                              {b.inicio} – {b.fin}
                            </div>
                          )}
                          {height > 44 && workedSecs > 0 && (
                            <div style={{ fontSize: 9, color: isActive ? ACCENT : '#64748b', fontWeight: 700, marginTop: 2, fontFamily: 'monospace' }}>
                              ⏱ {fmt(workedSecs)}
                            </div>
                          )}
                          {isCompleted && height > 28 && (
                            <div style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓ Completado</div>
                          )}
                          {!isCompleted && isHovered && height > 40 && (
                            <button
                              onClick={e => { e.stopPropagation(); markComplete(b) }}
                              style={{ position: 'absolute', bottom: 4, right: 4, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 4, fontSize: 9, fontWeight: 700, padding: '2px 5px', cursor: 'pointer' }}
                            >
                              ✓ Hecho
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────── */}
        <div style={{ width: 200, borderLeft: '1px solid #e2e8f0', background: '#fafafa', flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <button
              onClick={() => setGoalsOpen(p => !p)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#334155', padding: 0 }}
            >
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{goalsOpen ? '▾' : '▸'}</span>
              Objetivos
            </button>
          </div>

          {goalsOpen && (
            <div style={{ padding: '12px 14px', overflowY: 'auto', flex: 1 }}>
              {[
                { label: 'Bloques completados', current: weekDays.reduce((acc, d) => acc + (planesCalendarioGlobal[dateToKey(d)] || []).filter(b => completados.has(b.id)).length, 0), total: 5, color: '#22c55e' },
                { label: 'Repasos pendientes', current: repasosData.length, total: 20, color: '#3b82f6' },
              ].map((goal, i) => {
                const pct = Math.min(100, (goal.current / goal.total) * 100)
                return (
                  <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 8 }}>{goal.label}</div>
                    <div style={{ background: '#f1f5f9', borderRadius: 4, height: 5, overflow: 'hidden', marginBottom: 5 }}>
                      <div style={{ width: `${pct}%`, background: goal.color, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: goal.color }}>{goal.current}</span>
                      <span>{goal.total}</span>
                    </div>
                  </div>
                )
              })}

              {activeEntry && (
                <div style={{ marginTop: 8, background: `${ACCENT}12`, border: `1.5px solid ${ACCENT}40`, borderRadius: 10, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, marginBottom: 5, letterSpacing: '0.5px' }}>EN CURSO</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 6, lineHeight: 1.35 }}>{activeEntry.descripcion}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 800, color: ACCENT }}>{fmt(elapsed)}</div>
                  <button
                    onClick={stopTracking}
                    style={{ marginTop: 8, width: '100%', padding: '6px 0', background: ACCENT, color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    Pausar
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
