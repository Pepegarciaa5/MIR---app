/**
 * PublicView.jsx — Vista pública
 *
 * Layout:
 *  Header sticky con LiveBadge
 *  Stats strip horizontal (horas hoy / semana / top asignatura)
 *  ─────────────────────────────────────────────────────────
 *  Col izquierda (63%):
 *    · Sesión de hoy — timeline idéntico a SesionDia (read-only)
 *    · Diario — posts + entradas con hilo de comentarios
 *  Col derecha (37%):
 *    · Foro libre + comentarios
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getComentarios, addComentario } from '../lib/db'
import { getEspecialidadColor } from '../data/especialidadesMIR'
import { planificacionCTO } from '../data/planificacionBridge'

// ─── Constantes visuales (igual que SesionDia) ────────────────────────────────
const ACCENT      = '#F26522'
const HOUR_HEIGHT = 72
const START_HOUR  = 7
const END_HOUR    = 23
const NAME        = 'Pepe'
const POLL_MS     = 30_000
const IS_ADMIN    = !!import.meta.env.VITE_SUPABASE_SERVICE_KEY

const BLOCK_STYLES = {
  '🎬': { bg: '#fef9ec', border: '#f59e0b', text: '#92400e' },
  '📖': { bg: '#eff6ff', border: '#3b82f6', text: '#1e40af' },
  '📡': { bg: '#f5f3ff', border: '#8b5cf6', text: '#5b21b6' },
  '📝': { bg: '#fef2f2', border: '#ef4444', text: '#991b1b' },
  '🔄': { bg: '#f0fdf4', border: '#22c55e', text: '#166534' },
  '🌴': { bg: '#f0f9ff', border: '#0ea5e9', text: '#075985' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBlockStyle(titulo) {
  if (!titulo) return { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
  const emoji = [...titulo][0]
  return BLOCK_STYLES[emoji] || { bg: '#f8fafc', border: '#94a3b8', text: '#475569' }
}

function timeToMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minsToPx(mins) {
  return ((mins - START_HOUR * 60) / 60) * HOUR_HEIGHT
}

function fmt(s) {
  if (!s) return '0s'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${m}m ${String(sec).padStart(2, '0')}s`
  return `${sec}s`
}

function durStr(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return `${secs}s`
}

function getTodayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatDateHeader(dateStr, todayStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const isToday     = dateStr === todayStr
  const isYesterday = dateStr === addDays(todayStr, -1)
  const isTomorrow  = dateStr === addDays(todayStr, 1)
  const weekday = d.toLocaleDateString('es-ES', { weekday: 'long' })
  const short   = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })
  if (isToday)     return { label: 'Hoy',    sub: short, accent: true }
  if (isYesterday) return { label: 'Ayer',   sub: short, accent: false }
  if (isTomorrow)  return { label: 'Mañana', sub: short, accent: false }
  return { label: weekday.charAt(0).toUpperCase() + weekday.slice(1), sub: short, accent: false }
}

function relTime(ts) {
  const diff  = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora mismo'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function getWeekBounds() {
  const now  = new Date()
  const dow  = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon  = new Date(now)
  mon.setDate(now.getDate() + diff); mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6); sun.setHours(23, 59, 59, 999)
  return { mon, sun }
}

const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
const todayStr = getTodayStr()

// ─── Fetch functions ──────────────────────────────────────────────────────────

async function fetchAll() {
  const [
    { data: entriesRaw },
    { data: postsRaw },
    { data: compRaw },
    { data: descRaw },
    { data: adicRaw },
  ] = await Promise.all([
    supabase.from('tracker_entries').select('*').order('inicio', { ascending: false }).limit(500),
    supabase.from('diario_posts').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('bloques_completados').select('id'),
    supabase.from('bloques_descartados').select('id'),
    supabase.from('planes_adicionales').select('*'),
  ])

  const entries = (entriesRaw || []).map(e => ({
    id: e.id, descripcion: e.descripcion, especialidad: e.especialidad,
    tema: e.tema, duracionSegundos: e.duracion_segundos,
    inicio: e.inicio, fin: e.fin, fecha: e.fecha,
    _ts: e.inicio, _type: 'entry',
  }))

  const posts = (postsRaw || []).map(p => ({
    id: p.id, titulo: p.titulo, contenido: p.contenido,
    emoji: p.emoji || '📖', fecha: p.fecha,
    _ts: new Date(p.created_at).getTime(), _type: 'post',
  }))

  const completados = (compRaw || []).map(r => r.id)
  const descartados = (descRaw || []).map(r => r.id)

  const adicionales = {}
  for (const row of (adicRaw || [])) {
    if (!adicionales[row.fecha]) adicionales[row.fecha] = []
    adicionales[row.fecha].push({
      id: row.id, inicio: row.inicio, fin: row.fin,
      titulo: row.titulo, especialidad: row.especialidad, tema: row.tema,
    })
  }

  return { entries, posts, completados, descartados, adicionales }
}

// ─── LiveBadge ────────────────────────────────────────────────────────────────

function LiveBadge() {
  const [dot, setDot] = useState(true)
  useEffect(() => {
    const t = setInterval(() => setDot(d => !d), 800)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: '#fef3c7', color: ACCENT,
      border: `1px solid ${ACCENT}40`, borderRadius: 20,
      padding: '3px 10px', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dot ? ACCENT : 'transparent',
        border: `1.5px solid ${ACCENT}`, transition: 'background 0.3s',
        display: 'inline-block',
      }} />
      EN VIVO
    </span>
  )
}

// ─── Stats strip ──────────────────────────────────────────────────────────────

function StatsStrip({ entries }) {
  const { mon, sun } = getWeekBounds()
  const now = new Date()
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0)
  const todayEnd   = new Date(now); todayEnd.setHours(23, 59, 59, 999)

  const todayEnts = entries.filter(e => e.inicio >= todayStart.getTime() && e.inicio <= todayEnd.getTime())
  const weekEnts  = entries.filter(e => e.inicio >= mon.getTime() && e.inicio <= sun.getTime())

  const horasHoy = todayEnts.reduce((s, e) => s + e.duracionSegundos, 0) / 3600
  const horasSem = weekEnts.reduce((s, e) => s + e.duracionSegundos, 0) / 3600

  const byEsp = {}
  weekEnts.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_'))
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
  })
  const topEsp = Object.entries(byEsp).sort((a, b) => b[1] - a[1])[0]?.[0] || '—'

  const stats = [
    { icon: '⏱', label: 'Horas hoy',   value: `${Math.round(horasHoy * 10) / 10}h` },
    { icon: '📅', label: 'Esta semana', value: `${Math.round(horasSem * 10) / 10}h` },
    { icon: '🏆', label: 'Top semana',  value: topEsp },
  ]

  return (
    <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', background: '#fff' }}>
      {stats.map((s, i) => (
        <div key={s.label} style={{
          flex: 1, padding: '10px 20px',
          borderRight: i < stats.length - 1 ? '1px solid #f0f0f0' : 'none',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 20 }}>{s.icon}</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px', lineHeight: 1 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Timeline read-only (clone de SesionDia sin botones) ─────────────────────

function TimelinePublico({ entries, completados, descartados, adicionales }) {
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const timelineRef = useRef(null)

  const now         = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()
  const nowPx       = minsToPx(currentMins)
  const isToday     = selectedDate === todayStr

  const planBase  = planificacionCTO[selectedDate] || []
  const planExtra = adicionales[selectedDate] || []
  const plan = [...planBase, ...planExtra]
    .filter(b => !descartados.includes(String(b.id)))
    .map(b => ({
      ...b,
      startMins: timeToMins(b.inicio),
      endMins:   timeToMins(b.fin),
      completado: completados.includes(String(b.id)),
    }))

  const dateEntries = entries.filter(e => e.fecha === selectedDate)
  const totalSecs   = dateEntries.reduce((s, e) => s + e.duracionSegundos, 0)
  const dayDone     = plan.filter(b => b.completado).length
  const dateInfo    = formatDateHeader(selectedDate, todayStr)

  useEffect(() => {
    if (!timelineRef.current) return
    const target = isToday
      ? Math.max(0, nowPx - 120)
      : plan.length > 0
        ? Math.max(0, minsToPx(plan[0].startMins) - 60)
        : 0
    timelineRef.current.scrollTop = target
  }, [selectedDate])

  return (
    <div style={{
      border: '1px solid #f0f0f0', borderRadius: 16, overflow: 'hidden',
      background: '#fff', display: 'flex', flexDirection: 'column', height: 520,
    }}>
      {/* Navigator */}
      <div style={{
        padding: '10px 12px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
      }}>
        <button onClick={() => setSelectedDate(d => addDays(d, -1))} style={{
          width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: dateInfo.accent ? ACCENT : '#1a1a1a' }}>
            {dateInfo.label}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{dateInfo.sub}</div>
        </div>
        <button onClick={() => setSelectedDate(d => addDays(d, 1))} style={{
          width: 32, height: 32, border: '1px solid #e2e8f0', borderRadius: 8,
          background: '#fff', cursor: 'pointer', fontSize: 14, color: '#64748b',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>

      {/* Subheader */}
      <div style={{
        padding: '5px 14px', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b' }}>
          {plan.length > 0
            ? <>{dayDone}/{plan.length} bloques{totalSecs > 0 && <span style={{ color: ACCENT, marginLeft: 8 }}>⏱ {fmt(totalSecs)}</span>}</>
            : totalSecs > 0
              ? <span style={{ color: ACCENT }}>⏱ {fmt(totalSecs)} trackeadas</span>
              : <span style={{ color: '#bbb' }}>Sin bloques planificados</span>
          }
        </span>
        {!isToday && (
          <button onClick={() => setSelectedDate(todayStr)} style={{
            padding: '3px 10px', border: `1px solid ${ACCENT}`, borderRadius: 6,
            background: '#fff', color: ACCENT, fontWeight: 700, fontSize: 11, cursor: 'pointer',
          }}>Hoy</button>
        )}
      </div>

      {/* Timeline scroll */}
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
            {hours.map(h => (
              <div key={h} style={{ height: HOUR_HEIGHT, borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ height: HOUR_HEIGHT / 2, borderBottom: '1px dashed #f8fafc' }} />
              </div>
            ))}

            {/* Current time */}
            {isToday && nowPx >= 0 && nowPx < (END_HOUR - START_HOUR) * HOUR_HEIGHT && (
              <div style={{ position: 'absolute', top: nowPx, left: 0, right: 0, zIndex: 6, pointerEvents: 'none' }}>
                <div style={{ height: 2, background: ACCENT, position: 'relative' }}>
                  <div style={{
                    position: 'absolute', left: -4, top: -4,
                    width: 10, height: 10, borderRadius: '50%', background: ACCENT,
                  }} />
                </div>
              </div>
            )}

            {/* Plan blocks */}
            {plan.map(b => {
              if (b.endMins <= START_HOUR * 60 || b.startMins >= END_HOUR * 60) return null
              const clampedStart = Math.max(b.startMins, START_HOUR * 60)
              const clampedEnd   = Math.min(b.endMins, END_HOUR * 60)
              const top    = minsToPx(clampedStart)
              const height = Math.max(((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT - 3, 24)
              const bStyle = getBlockStyle(b.titulo)
              return (
                <div key={b.id} style={{
                  position: 'absolute', top: top + 1, left: 3,
                  width: 'calc(60% - 6px)', height,
                  background: b.completado ? '#f8fafc' : bStyle.bg,
                  border: `1.5px dashed ${b.completado ? '#cbd5e1' : bStyle.border}`,
                  borderLeft: `4px solid ${b.completado ? '#94a3b8' : bStyle.border}`,
                  borderRadius: 7, padding: '4px 8px', overflow: 'hidden',
                  zIndex: 2, opacity: b.completado ? 0.45 : 0.88,
                }}>
                  <div style={{
                    fontSize: 11, color: b.completado ? '#94a3b8' : bStyle.text,
                    fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', lineHeight: 1.3,
                  }}>
                    {b.titulo}
                  </div>
                  {height > 30 && (
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{b.inicio} – {b.fin}</div>
                  )}
                  {b.completado && height > 28 && (
                    <div style={{ fontSize: 10, color: '#22c55e', fontWeight: 700, marginTop: 2 }}>✓</div>
                  )}
                </div>
              )
            })}

            {/* Tracker entries */}
            {(() => {
              const sorted = [...dateEntries].sort((a, b) => a.inicio - b.inicio)
              let lastBottom = 0
              return sorted.map((t, idx) => {
                const startD = new Date(t.inicio)
                const endD   = new Date(t.fin || t.inicio + (t.duracionSegundos || 0) * 1000)
                const startM = startD.getHours() * 60 + startD.getMinutes()
                const endM   = endD.getHours() * 60 + endD.getMinutes()
                if (isNaN(startM) || isNaN(endM)) return null
                if (endM <= START_HOUR * 60 || startM >= END_HOUR * 60) return null

                const clampedStart = Math.max(startM, START_HOUR * 60)
                const clampedEnd   = Math.min(endM, END_HOUR * 60)
                const exactTop    = minsToPx(clampedStart)
                const exactHeight = ((clampedEnd - clampedStart) / 60) * HOUR_HEIGHT
                const height = Math.max(exactHeight - 3, 28)
                const top    = Math.max(exactTop + 1, lastBottom)
                lastBottom   = top + height + 3

                const tColor = getEspecialidadColor(t.especialidad)
                return (
                  <div key={t.id || idx} style={{
                    position: 'absolute', top, left: '40%', right: 3, height,
                    background: tColor.bg,
                    border: `1px solid ${tColor.border}`,
                    borderLeft: `5px solid ${tColor.text}`,
                    borderRadius: 7, padding: '4px 8px', overflow: 'hidden',
                    zIndex: 7, boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                    display: 'flex', flexDirection: 'column',
                  }}>
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
                        {String(endD.getHours()).padStart(2,'0')}:{String(endD.getMinutes()).padStart(2,'0')}
                      </div>
                    )}
                    {t.duracionSegundos > 0 && (
                      <div style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: tColor.text, marginTop: 2 }}>
                        ⏱ {fmt(t.duracionSegundos)}
                      </div>
                    )}
                  </div>
                )
              })
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Diario con comentarios ───────────────────────────────────────────────────

function DiarioItem({ item, comentarios, onAdd, onDelete }) {
  const [open, setOpen] = useState(false)
  const refId = String(item.id)
  const itemComments = comentarios.filter(c => c.tipo === 'timeline' && c.refId === refId)
  const isPost = item._type === 'post'

  return (
    <div style={{
      background: isPost ? '#fffbf5' : '#fff',
      border: `1px solid ${isPost ? '#fde68a' : '#f0f0f0'}`,
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {isPost ? (
              <>
                <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginBottom: 4 }}>
                  {item.emoji} Entrada del diario
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                  {item.titulo}
                </div>
                {item.contenido && (
                  <div style={{
                    fontSize: 13, color: '#64748b', lineHeight: 1.55,
                    display: '-webkit-box', WebkitLineClamp: 4,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {item.contenido}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                  {NAME} estudió <em style={{ fontStyle: 'normal' }}>{item.descripcion}</em>
                </div>
                {item.especialidad && !item.especialidad.startsWith('_') && (() => {
                  const c = getEspecialidadColor(item.especialidad)
                  return (
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                      padding: '1px 8px', borderRadius: 10, display: 'inline-block',
                    }}>
                      {item.especialidad}{item.tema ? ` · ${item.tema}` : ''}
                    </span>
                  )
                })()}
              </>
            )}
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            {!isPost && (
              <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{durStr(item.duracionSegundos)}</div>
            )}
            <div style={{ fontSize: 11, color: '#bbb', marginTop: isPost ? 0 : 2 }}>{relTime(item._ts)}</div>
          </div>
        </div>

        <button
          onClick={() => setOpen(v => !v)}
          style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            color: isPost ? '#b45309' : '#64748b', fontSize: 12, fontWeight: 600,
            padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          💬 {itemComments.length > 0
            ? `${itemComments.length} comentario${itemComments.length > 1 ? 's' : ''}`
            : 'Responder'}
          <span style={{ fontSize: 10 }}>{open ? '▲' : '▼'}</span>
        </button>
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${isPost ? '#fde68a50' : '#f8f8f8'}` }}>
          <CommentThread
            comments={itemComments}
            onAdd={(autor, texto) => onAdd({ autor, texto, tipo: 'timeline', refId })}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  )
}

function CommentThread({ comments, onAdd, onDelete }) {
  const [autor, setAutor] = useState('')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    if (!autor.trim() || !texto.trim()) { setErr('Rellena nombre y comentario'); return }
    setSending(true); setErr('')
    const ok = await onAdd(autor.trim(), texto.trim())
    if (ok) { setAutor(''); setTexto('') }
    else setErr('Error al enviar.')
    setSending(false)
  }

  return (
    <div style={{ marginTop: 12 }}>
      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {comments.map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 26, height: 26, borderRadius: '50%',
                background: `hsl(${(c.autor.charCodeAt(0) * 47) % 360}, 55%, 88%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                color: `hsl(${(c.autor.charCodeAt(0) * 47) % 360}, 45%, 35%)`,
                flexShrink: 0,
              }}>
                {c.autor[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{c.autor}</span>
                  <span style={{ fontSize: 10, color: '#bbb' }}>{relTime(c.createdAt)}</span>
                  {IS_ADMIN && (
                    <button onClick={() => onDelete(c.id)} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginTop: 2 }}>{c.texto}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6 }}>
        <input value={autor} onChange={e => setAutor(e.target.value)} placeholder="Nombre" maxLength={40}
          style={{ width: 110, padding: '6px 8px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', flexShrink: 0 }} />
        <input value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Responder..." maxLength={500}
          style={{ flex: 1, padding: '6px 8px', borderRadius: 7, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none' }} />
        <button onClick={send} disabled={sending || !autor.trim() || !texto.trim()}
          style={{
            padding: '6px 12px', background: autor.trim() && texto.trim() ? ACCENT : '#e2e8f0',
            color: autor.trim() && texto.trim() ? '#fff' : '#94a3b8',
            border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 12,
            cursor: autor.trim() && texto.trim() ? 'pointer' : 'default', flexShrink: 0,
          }}>
          {sending ? '...' : '↑'}
        </button>
      </div>
      {err && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{err}</div>}
    </div>
  )
}

// ─── Foro lateral ─────────────────────────────────────────────────────────────

function ForoPanel({ comentarios, onAdd, onDelete }) {
  const [autor, setAutor]     = useState('')
  const [texto, setTexto]     = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [err, setErr]         = useState('')

  const foroComments = comentarios
    .filter(c => c.tipo === 'foro')
    .sort((a, b) => b.createdAt - a.createdAt)

  async function send() {
    if (!autor.trim() || !texto.trim()) { setErr('Rellena nombre y mensaje'); return }
    if (texto.length > 1000) { setErr('Máximo 1000 caracteres'); return }
    setSending(true); setErr('')
    const ok = await onAdd({ autor: autor.trim(), texto: texto.trim(), tipo: 'foro', refId: null })
    if (ok) { setAutor(''); setTexto(''); setSent(true); setTimeout(() => setSent(false), 2500) }
    else setErr('Error al enviar.')
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.2px' }}>
        💬 Foro
      </div>

      <div style={{
        background: '#fff', border: `1.5px solid ${ACCENT}30`,
        borderRadius: 14, padding: '14px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <input value={autor} onChange={e => setAutor(e.target.value)}
          placeholder="Tu nombre *" maxLength={40}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }} />
        <textarea value={texto} onChange={e => setTexto(e.target.value)}
          placeholder="Escribe un mensaje, pregunta o ánimo..." maxLength={1000} rows={3}
          style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: err ? '#ef4444' : '#bbb' }}>{err || `${texto.length}/1000`}</span>
          <button onClick={send} disabled={sending || !autor.trim() || !texto.trim()}
            style={{
              padding: '7px 16px', background: autor.trim() && texto.trim() ? ACCENT : '#e2e8f0',
              color: autor.trim() && texto.trim() ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
              cursor: autor.trim() && texto.trim() ? 'pointer' : 'default', transition: 'all 0.15s',
            }}>
            {sending ? '...' : sent ? '¡Enviado! ✓' : 'Enviar'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {foroComments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: 12 }}>
            Sé el primero en escribir 👋
          </div>
        ) : foroComments.map(c => (
          <div key={c.id} style={{
            background: '#fff', border: '1px solid #f0f0f0',
            borderRadius: 12, padding: '10px 12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
          }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: `hsl(${(c.autor.charCodeAt(0) * 47) % 360}, 55%, 88%)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
                color: `hsl(${(c.autor.charCodeAt(0) * 47) % 360}, 45%, 35%)`,
                flexShrink: 0,
              }}>
                {c.autor[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{c.autor}</span>
                  <span style={{ fontSize: 10, color: '#bbb' }}>{relTime(c.createdAt)}</span>
                  {IS_ADMIN && (
                    <button onClick={() => onDelete(c.id)} style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}>×</button>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.55, marginTop: 3, wordBreak: 'break-word' }}>
                  {c.texto}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PublicView() {
  const [entries, setEntries]         = useState([])
  const [posts, setPosts]             = useState([])
  const [comentarios, setComentarios] = useState([])
  const [completados, setCompletados] = useState([])
  const [descartados, setDescartados] = useState([])
  const [adicionales, setAdicionales] = useState({})
  const [loading, setLoading]         = useState(true)
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768)

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const load = async () => {
    const [data, coms] = await Promise.all([fetchAll(), getComentarios()])
    setEntries(data.entries)
    setPosts(data.posts)
    setCompletados(data.completados)
    setDescartados(data.descartados)
    setAdicionales(data.adicionales)
    setComentarios(coms)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const poll = setInterval(load, POLL_MS)
    return () => clearInterval(poll)
  }, [])

  async function handleAddComment(args) {
    const c = await addComentario(args)
    if (c) setComentarios(prev => [...prev, c])
    return c
  }

  async function handleDeleteComment(id) {
    await supabase.from('comentarios').delete().eq('id', id)
    setComentarios(prev => prev.filter(c => c.id !== id))
  }

  const diarioItems = [...entries, ...posts].sort((a, b) => b._ts - a._ts)

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Cargando...</div>
        </div>
      </div>
    )
  }

  const header = (
    <div style={{
      background: '#fff', borderBottom: '1px solid #f0f0f0',
      padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 20,
    }}>
      <div>
        <div style={{ fontSize: 19, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
          {NAME} estudia MIR
        </div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>MIR 2027 · Progreso en directo</div>
      </div>
      <LiveBadge />
    </div>
  )

  // ── MOBILE ───────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa' }}>
        {header}
        <div style={{ position: 'sticky', top: 57, zIndex: 15, background: '#fff' }}>
          <StatsStrip entries={entries} />
        </div>
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Sesión</div>
          <TimelinePublico entries={entries} completados={completados} descartados={descartados} adicionales={adicionales} />
        </div>
        <div style={{ padding: '16px 12px 0' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>Diario</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {diarioItems.map(item => (
              <DiarioItem key={`${item._type}-${item.id}`} item={item}
                comentarios={comentarios} onAdd={handleAddComment} onDelete={handleDeleteComment} />
            ))}
          </div>
        </div>
        <div style={{ padding: '16px 12px 40px' }}>
          <ForoPanel comentarios={comentarios} onAdd={handleAddComment} onDelete={handleDeleteComment} />
        </div>
      </div>
    )
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      {header}
      <div style={{ position: 'sticky', top: 57, zIndex: 15, background: '#fff' }}>
        <StatsStrip entries={entries} />
      </div>

      <div style={{
        flex: 1, display: 'flex', maxWidth: 1200,
        margin: '0 auto', width: '100%', padding: '24px 24px 60px', gap: 24,
        alignItems: 'flex-start',
      }}>
        {/* Left: sesión + diario */}
        <div style={{ flex: '0 0 63%', maxWidth: '63%', display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Sesión de hoy</div>
            <TimelinePublico entries={entries} completados={completados} descartados={descartados} adicionales={adicionales} />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 10 }}>Diario</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {diarioItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#bbb', fontSize: 14 }}>
                  Aún no hay actividad registrada.
                </div>
              ) : diarioItems.map(item => (
                <DiarioItem key={`${item._type}-${item.id}`} item={item}
                  comentarios={comentarios} onAdd={handleAddComment} onDelete={handleDeleteComment} />
              ))}
            </div>
          </div>
        </div>

        {/* Right: foro sticky */}
        <div style={{ flex: '0 0 37%', maxWidth: '37%', position: 'sticky', top: 120 }}>
          <ForoPanel comentarios={comentarios} onAdd={handleAddComment} onDelete={handleDeleteComment} />
        </div>
      </div>
    </div>
  )
}
