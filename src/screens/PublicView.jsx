import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getEspecialidadColor } from '../data/especialidadesMIR'

const ACCENT = '#BA7517'
const NAME = 'Pepe'
const POLL_MS = 30_000

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(ts) {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(diff / 86_400_000)
  if (mins < 1)   return 'ahora mismo'
  if (mins < 60)  return `hace ${mins} min`
  if (hours < 24) return `hace ${hours}h`
  if (days === 1) return 'ayer'
  return `hace ${days} días`
}

function durStr(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0)           return `${h}h`
  if (m > 0)           return `${m}m`
  return `${secs}s`
}

function getWeekBounds() {
  const now = new Date()
  const dow  = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon  = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { mon, sun }
}

function todayBounds() {
  const s = new Date(); s.setHours(0, 0, 0, 0)
  const e = new Date(); e.setHours(23, 59, 59, 999)
  return { start: s.getTime(), end: e.getTime() }
}

function last7Days() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    days.push(d.getTime())
  }
  return days
}

// ─── Fetch functions ─────────────────────────────────────────────────────────

async function fetchEntries() {
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('*')
    .order('inicio', { ascending: false })
    .limit(200)
  if (error) { console.error(error); return [] }
  return data.map(e => ({
    _type:            'entry',
    id:               e.id,
    descripcion:      e.descripcion,
    especialidad:     e.especialidad,
    tema:             e.tema,
    duracionSegundos: e.duracion_segundos,
    inicio:           e.inicio,
    fin:              e.fin,
    fecha:            e.fecha,
    _ts:              e.inicio,
  }))
}

async function fetchPosts() {
  const { data, error } = await supabase
    .from('diario_posts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) { console.error(error); return [] }
  return data.map(p => ({
    _type:     'post',
    id:        p.id,
    titulo:    p.titulo,
    contenido: p.contenido,
    emoji:     p.emoji || '📖',
    fecha:     p.fecha,
    _ts:       new Date(p.created_at).getTime(),
  }))
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      border: `1px solid ${ACCENT}30`, borderRadius: 20,
      padding: '2px 10px', fontSize: 11, fontWeight: 700,
    }}>
      <span style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dot ? ACCENT : 'transparent',
        border: `1.5px solid ${ACCENT}`,
        transition: 'background 0.3s',
        display: 'inline-block',
      }} />
      EN VIVO
    </span>
  )
}

function EntryCard({ item, isLive, elapsed }) {
  const c = item.especialidad ? getEspecialidadColor(item.especialidad) : null
  const secs = isLive ? elapsed : item.duracionSegundos

  return (
    <div style={{
      background: '#fff',
      border: isLive ? `1.5px solid ${ACCENT}` : '1px solid #f0f0f0',
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: isLive ? `0 2px 16px ${ACCENT}18` : '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {isLive && (
            <div style={{ marginBottom: 6 }}>
              <LiveBadge />
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
            {isLive
              ? <>📚 {NAME} está estudiando <em style={{ fontStyle: 'normal', color: ACCENT }}>{item.descripcion}</em></>
              : <>{NAME} ha estudiado <em style={{ fontStyle: 'normal' }}>{item.descripcion}</em></>}
          </div>
          {item.especialidad && !item.especialidad.startsWith('_') && c && (
            <span style={{
              fontSize: 11, fontWeight: 600,
              color: c.text, background: c.bg, border: `1px solid ${c.border}`,
              padding: '1px 8px', borderRadius: 10, display: 'inline-block',
            }}>
              {item.especialidad}{item.tema ? ` · ${item.tema}` : ''}
            </span>
          )}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px' }}>
            {secs > 0 ? durStr(secs) : '—'}
          </div>
          <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>
            {isLive ? 'ahora mismo' : relTime(item._ts)}
          </div>
        </div>
      </div>
    </div>
  )
}

function PostCard({ item }) {
  return (
    <div style={{
      background: '#fffbf5',
      border: '1px solid #fde68a',
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: '#b45309', fontWeight: 700, marginBottom: 4 }}>
            {item.emoji} Entrada del diario
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
            {item.titulo}
          </div>
          {item.contenido && (
            <div style={{
              fontSize: 12, color: '#64748b', lineHeight: 1.5,
              display: '-webkit-box', WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              {item.contenido}
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginTop: 2 }}>
          {relTime(item._ts)}
        </div>
      </div>
    </div>
  )
}

// ─── Stats panel ──────────────────────────────────────────────────────────────

function StatsPanel({ entries, compact = false }) {
  const { start: todayStart, end: todayEnd } = todayBounds()
  const { mon, sun } = getWeekBounds()

  const todayEntries = entries.filter(e => e.inicio >= todayStart && e.inicio <= todayEnd)
  const weekEntries  = entries.filter(e => e.inicio >= mon.getTime() && e.inicio <= sun.getTime())

  const horasHoy     = todayEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600
  const horasSemana  = weekEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600

  const byEsp = {}
  weekEntries.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_')) {
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
    }
  })
  const topEsp = Object.entries(byEsp).sort((a, b) => b[1] - a[1])
  const mejorEsp = topEsp[0]?.[0] || '—'

  const stats = [
    { label: 'Horas hoy',     value: horasHoy  > 0 ? `${Math.round(horasHoy * 10) / 10}h`   : '0h',  icon: '⏱️' },
    { label: 'Esta semana',   value: horasSemana > 0 ? `${Math.round(horasSemana * 10) / 10}h` : '0h', icon: '📅' },
    { label: 'Top asignatura',value: mejorEsp,   icon: '🏆' },
  ]

  if (compact) {
    return (
      <div style={{
        display: 'flex', gap: 8,
        padding: '10px 16px',
        background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        overflowX: 'auto',
      }}>
        {stats.map(s => (
          <div key={s.label} style={{
            flex: '0 0 auto', background: '#fafafa',
            border: '1px solid #f0f0f0', borderRadius: 12,
            padding: '8px 14px', minWidth: 80, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              {s.value}
            </div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {stats.map(s => (
        <div key={s.label} style={{
          background: '#fff', border: '1px solid #f0f0f0',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 22 }}>{s.icon}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: ACCENT, letterSpacing: '-1px', marginTop: 4 }}>
            {s.value}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Full stats overlay ───────────────────────────────────────────────────────

function StatsOverlay({ entries, onClose }) {
  const { start: todayStart, end: todayEnd } = todayBounds()
  const { mon, sun } = getWeekBounds()

  const todayEntries = entries.filter(e => e.inicio >= todayStart && e.inicio <= todayEnd)
  const weekEntries  = entries.filter(e => e.inicio >= mon.getTime() && e.inicio <= sun.getTime())

  const horasHoy    = Math.round((todayEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600) * 10) / 10
  const horasSemana = Math.round((weekEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600) * 10) / 10

  const byEsp = {}
  weekEntries.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_')) {
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
    }
  })
  const topEsp   = Object.entries(byEsp).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxEspH  = topEsp[0]?.[1] || 1

  // Last 7 days chart
  const days7 = last7Days()
  const byDay7 = days7.map(dayStart => {
    const dayEnd = dayStart + 86_400_000 - 1
    return entries
      .filter(e => e.inicio >= dayStart && e.inicio <= dayEnd)
      .reduce((s, e) => s + e.duracionSegundos / 3600, 0)
  })
  const maxDay = Math.max(...byDay7, 1)
  const DAY_NAMES = ['L','M','X','J','V','S','D']

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#fff',
      zIndex: 100, overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, background: '#fff',
        borderBottom: '1px solid #f0f0f0',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12,
        zIndex: 10,
      }}>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 14, color: '#64748b', fontWeight: 600, padding: '6px 0',
        }}>
          ← Volver
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#1a1a1a' }}>
          Progreso de {NAME}
        </div>
      </div>

      <div style={{ padding: '20px', maxWidth: 600, margin: '0 auto' }}>

        {/* Top stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
          {[
            { label: 'Horas hoy',     value: `${horasHoy}h`,    sub: 'sesión activa', color: ACCENT },
            { label: 'Horas semana',  value: `${horasSemana}h`, sub: '/ 35h objetivo', color: '#2563eb' },
            { label: 'Asignaturas',   value: topEsp.length,     sub: 'esta semana', color: '#7c3aed' },
            { label: 'Entradas',      value: weekEntries.length, sub: 'esta semana', color: '#059669' },
          ].map(s => (
            <div key={s.label} style={{
              background: '#fff', border: '1px solid #f0f0f0',
              borderRadius: 14, padding: '14px',
              boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, letterSpacing: '-1px', lineHeight: 1 }}>
                {s.value}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginTop: 2 }}>{s.label}</div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* 7-day chart */}
        <div style={{ background: '#fafafa', borderRadius: 16, padding: '16px', marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Últimos 7 días</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80, marginBottom: 8 }}>
            {byDay7.map((h, i) => {
              const barH = Math.max(h > 0 ? 4 : 0, Math.round((h / maxDay) * 76))
              const d    = new Date(days7[i])
              const dow  = d.getDay()
              const isToday = days7[i] === last7Days()[6]
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: barH,
                      background: isToday ? ACCENT : '#d4a855',
                      borderRadius: '3px 3px 0 0',
                      opacity: isToday ? 1 : 0.6,
                      minHeight: h > 0 ? 4 : 0,
                    }} />
                  </div>
                  <div style={{ fontSize: 10, color: isToday ? ACCENT : '#aaa', fontWeight: isToday ? 700 : 400, marginTop: 4 }}>
                    {DAY_NAMES[dow === 0 ? 6 : dow - 1]}
                  </div>
                  {h > 0 && (
                    <div style={{ fontSize: 9, color: '#bbb' }}>
                      {Math.round(h * 10) / 10}h
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Top specialties */}
        {topEsp.length > 0 && (
          <div style={{ background: '#fafafa', borderRadius: 16, padding: '16px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>
              Tiempo por asignatura (semana)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {topEsp.map(([nombre, horas]) => {
                const pct = Math.round((horas / maxEspH) * 100)
                const h   = Math.floor(horas)
                const m   = Math.round((horas - h) * 60)
                const c   = getEspecialidadColor(nombre)
                return (
                  <div key={nombre}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                        padding: '2px 9px', borderRadius: 12,
                      }}>
                        {nombre}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: c.text }}>
                        {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : h === 0 ? '<1m' : ''}
                      </span>
                    </div>
                    <div style={{ background: '#e8e8e8', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                      <div style={{
                        width: `${pct}%`, background: c.text,
                        height: '100%', borderRadius: 4,
                        transition: 'width 0.4s', opacity: 0.85,
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PublicView() {
  const [entries, setEntries]   = useState([])
  const [posts, setPosts]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showStats, setShowStats] = useState(false)
  const [elapsed, setElapsed]   = useState(0)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  // Responsive
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  // Fetch data
  const load = async () => {
    const [e, p] = await Promise.all([fetchEntries(), fetchPosts()])
    setEntries(e)
    setPosts(p)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const poll = setInterval(load, POLL_MS)
    return () => clearInterval(poll)
  }, [])

  // Check for live tracker: entry with fin = null (started but not committed)
  // This works if the admin device has an in-progress entry stored in localStorage
  // For now we check for an entry with no fin in recent tracker_entries
  // (the active entry is only in localStorage on Pepe's device so we can't poll it;
  //  instead we detect entries from today that appear "open" via a separate column)
  // Since we can't know for sure, we skip the live detection for now.
  const liveEntry = null
  const liveElapsed = elapsed

  // Build merged timeline: entries + posts sorted newest first
  const timeline = [...entries, ...posts].sort((a, b) => b._ts - a._ts)

  if (loading) {
    return (
      <div style={{
        height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#fafafa',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>
            Cargando progreso de {NAME}...
          </div>
        </div>
      </div>
    )
  }

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa' }}>
        {showStats && (
          <StatsOverlay entries={entries} onClose={() => setShowStats(false)} />
        )}

        {/* Header */}
        <div style={{
          background: '#fff', borderBottom: '1px solid #f0f0f0',
          padding: '16px 16px 12px',
        }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
            {NAME} estudia MIR
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
            Progreso en tiempo real
          </div>
        </div>

        {/* Stats strip */}
        <StatsPanel entries={entries} compact />

        {/* Ver todo button */}
        <div style={{ padding: '10px 16px 0' }}>
          <button onClick={() => setShowStats(true)} style={{
            width: '100%', padding: '10px', background: '#fff',
            border: `1.5px solid ${ACCENT}`, borderRadius: 12,
            color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            Ver todas las estadísticas →
          </button>
        </div>

        {/* Timeline */}
        <div style={{ padding: '12px 12px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>
              Aún no hay actividad registrada.
            </div>
          ) : timeline.map(item =>
            item._type === 'entry'
              ? <EntryCard key={`e-${item.id}`} item={item} isLive={false} elapsed={0} />
              : <PostCard  key={`p-${item.id}`} item={item} />
          )}
        </div>
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      {showStats && (
        <StatsOverlay entries={entries} onClose={() => setShowStats(false)} />
      )}

      {/* Top header bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
            {NAME} estudia MIR
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
            Progreso en tiempo real
          </div>
        </div>
        <div style={{
          fontSize: 12, color: '#94a3b8', fontWeight: 500,
          background: '#f8fafc', border: '1px solid #e2e8f0',
          borderRadius: 8, padding: '4px 10px',
        }}>
          📚 Preparando el MIR 2027
        </div>
      </div>

      {/* Main body */}
      <div style={{
        flex: 1, display: 'flex', maxWidth: 1100,
        margin: '0 auto', width: '100%', padding: '24px 24px 40px', gap: 24,
        alignItems: 'flex-start',
      }}>

        {/* ── Left: timeline (5/8) ── */}
        <div style={{ flex: '0 0 62.5%', maxWidth: '62.5%', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
            Últimas actividades
          </div>

          {liveEntry && (
            <EntryCard item={liveEntry} isLive elapsed={liveElapsed} />
          )}

          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#bbb', fontSize: 14 }}>
              Aún no hay actividad registrada.
            </div>
          ) : timeline.map(item =>
            item._type === 'entry'
              ? <EntryCard key={`e-${item.id}`} item={item} isLive={false} elapsed={0} />
              : <PostCard  key={`p-${item.id}`} item={item} />
          )}
        </div>

        {/* ── Right: sticky stats (3/8) ── */}
        <div style={{
          flex: '0 0 37.5%', maxWidth: '37.5%',
          position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 4 }}>
            Estadísticas
          </div>

          <StatsPanel entries={entries} />

          <button onClick={() => setShowStats(true)} style={{
            width: '100%', padding: '12px', background: '#fff',
            border: `1.5px solid ${ACCENT}`, borderRadius: 14,
            color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = '#fffbf0'}
            onMouseLeave={e => e.currentTarget.style.background = '#fff'}
          >
            Ver todas las estadísticas →
          </button>

          {/* Small footer note */}
          <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 4 }}>
            Actualiza cada 30 segundos
          </div>
        </div>
      </div>
    </div>
  )
}
