/**
 * PublicView.jsx — Vista pública de Pepe estudiando el MIR
 *
 * Tres pestañas:
 *  "Hoy"    → sesión diaria de hoy en modo read-only (plan + tracker entries)
 *  "Diario" → timeline de entradas de tracker + posts con comentarios
 *  "Foro"   → tablón de comentarios libres
 *
 * Layout desktop: col izquierda tabs (65%) + col derecha stats sticky (35%)
 * Layout mobile:  stats strip arriba + tab bar + contenido
 */
import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { getComentarios, addComentario } from '../lib/db'
import { getEspecialidadColor } from '../data/especialidadesMIR'
import { planificacionCTO } from '../data/planificacionBridge'

const ACCENT   = '#BA7517'
const NAME     = 'Pepe'
const POLL_MS  = 30_000
const IS_ADMIN = !!import.meta.env.VITE_SUPABASE_SERVICE_KEY

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getTodayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function relTime(ts) {
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
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

function timeToMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
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

const todayStr = getTodayStr()

// ─── Fetch functions ──────────────────────────────────────────────────────────

async function fetchEntries() {
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('*')
    .order('inicio', { ascending: false })
    .limit(300)
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

async function fetchBlockStatus() {
  const [{ data: comp }, { data: desc }] = await Promise.all([
    supabase.from('bloques_completados').select('id'),
    supabase.from('bloques_descartados').select('id'),
  ])
  return {
    completados: (comp || []).map(r => r.id),
    descartados: (desc || []).map(r => r.id),
  }
}

// ─── Shared UI pieces ─────────────────────────────────────────────────────────

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

// ─── Comment pieces ───────────────────────────────────────────────────────────

function CommentList({ comentarios, refId, tipo, onAdd, onDelete }) {
  const list = comentarios.filter(c => c.tipo === tipo && c.refId === (refId ? String(refId) : null))
  const [autor, setAutor] = useState('')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    if (!autor.trim() || !texto.trim()) { setErr('Rellena nombre y comentario'); return }
    if (texto.trim().length > 1000) { setErr('Máximo 1000 caracteres'); return }
    setSending(true); setErr('')
    const c = await onAdd({ autor: autor.trim(), texto: texto.trim(), tipo, refId: refId || null })
    if (c) { setAutor(''); setTexto('') }
    else setErr('Error al enviar. Inténtalo de nuevo.')
    setSending(false)
  }

  return (
    <div style={{ marginTop: 12, borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>
      {list.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
          {list.map(c => (
            <div key={c.id} style={{
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: '#f0f0f0',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: '#666', flexShrink: 0,
              }}>
                {c.autor[0]?.toUpperCase() || '?'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a' }}>{c.autor}</span>
                  <span style={{ fontSize: 10, color: '#bbb' }}>{relTime(c.createdAt)}</span>
                  {IS_ADMIN && (
                    <button
                      onClick={() => onDelete(c.id)}
                      style={{ fontSize: 10, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginLeft: 4 }}
                    >
                      Eliminar
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginTop: 2, wordBreak: 'break-word' }}>
                  {c.texto}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={autor}
            onChange={e => setAutor(e.target.value)}
            placeholder="Tu nombre"
            maxLength={40}
            style={{
              flex: '0 0 140px', padding: '7px 10px',
              borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 12, outline: 'none',
            }}
          />
          <input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Escribe un comentario..."
            maxLength={1000}
            style={{
              flex: 1, padding: '7px 10px',
              borderRadius: 8, border: '1px solid #e2e8f0',
              fontSize: 12, outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={sending || !autor.trim() || !texto.trim()}
            style={{
              padding: '7px 14px', background: autor.trim() && texto.trim() ? ACCENT : '#e2e8f0',
              color: autor.trim() && texto.trim() ? '#fff' : '#94a3b8',
              border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12,
              cursor: autor.trim() && texto.trim() ? 'pointer' : 'default', flexShrink: 0,
            }}
          >
            {sending ? '...' : '↑'}
          </button>
        </div>
        {err && <div style={{ fontSize: 11, color: '#ef4444' }}>{err}</div>}
      </div>
    </div>
  )
}

// ─── HOY: read-only session ───────────────────────────────────────────────────

function SesionPublica({ entries, completados, descartados }) {
  const plan = planificacionCTO[todayStr] || []
  const todayEntries = entries.filter(e => e.fecha === todayStr)

  const now = new Date()
  const currentMins = now.getHours() * 60 + now.getMinutes()

  // Detect likely-live: last entry from today if it ended < 3 min ago (heuristic)
  const lastEntry = todayEntries[0]
  const likelyLive = lastEntry && (Date.now() - lastEntry.fin) < 3 * 60_000

  const todayHours = todayEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600

  if (plan.length === 0 && todayEntries.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🌿</div>
        <div style={{ fontSize: 15, fontWeight: 600 }}>Sin plan para hoy</div>
        <div style={{ fontSize: 13, marginTop: 6 }}>Puede que sea día de descanso o aún no ha empezado.</div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

      {/* Summary bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', background: '#fafafa', borderRadius: 12,
        border: '1px solid #f0f0f0', marginBottom: 4,
      }}>
        {likelyLive && <LiveBadge />}
        <div style={{ fontSize: 13, color: '#64748b' }}>
          <span style={{ fontWeight: 800, color: ACCENT, fontSize: 16 }}>
            {Math.round(todayHours * 10) / 10}h
          </span>
          {' '}estudiadas hoy
        </div>
        <div style={{ fontSize: 12, color: '#bbb', marginLeft: 'auto' }}>
          {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
      </div>

      {/* Plan blocks */}
      {plan.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            Plan del día
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {plan.map(b => {
              const done     = completados.includes(String(b.id))
              const skipped  = descartados.includes(String(b.id))
              const startM   = timeToMins(b.inicio)
              const endM     = timeToMins(b.fin)
              const active   = !done && !skipped && currentMins >= startM && currentMins < endM
              const c        = b.especialidad ? getEspecialidadColor(b.especialidad) : null

              let statusIcon = '○'
              let statusColor = '#cbd5e1'
              let borderColor = '#f0f0f0'
              let bgColor = '#fff'
              if (done)    { statusIcon = '✓'; statusColor = '#16a34a'; borderColor = '#bbf7d0'; bgColor = '#f0fdf4' }
              if (skipped) { statusIcon = '—'; statusColor = '#94a3b8'; borderColor = '#e2e8f0'; bgColor = '#f8fafc' }
              if (active)  { statusIcon = '▶'; statusColor = ACCENT;    borderColor = ACCENT;   bgColor = '#fffbf0' }

              return (
                <div key={b.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${borderColor}`,
                  background: bgColor,
                  opacity: skipped ? 0.55 : 1,
                  transition: 'all 0.2s',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: statusColor,
                    background: done ? '#dcfce7' : active ? `${ACCENT}18` : '#f0f0f0',
                    flexShrink: 0, marginTop: 1,
                  }}>
                    {statusIcon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: skipped ? '#94a3b8' : '#1a1a1a', lineHeight: 1.3 }}>
                      {b.titulo}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#94a3b8' }}>{b.inicio} – {b.fin}</span>
                      {c && b.especialidad && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                          padding: '1px 7px', borderRadius: 8,
                        }}>
                          {b.especialidad}
                        </span>
                      )}
                      {active && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>● Activo ahora</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Tracker entries for today */}
      {todayEntries.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>
            Sesiones registradas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {todayEntries.map(e => {
              const c = e.especialidad ? getEspecialidadColor(e.especialidad) : null
              const startStr = new Date(e.inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
              const endStr   = new Date(e.fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={e.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 10,
                  border: '1px solid #f0f0f0', background: '#fff',
                }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: '#f0fdf4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, flexShrink: 0,
                  }}>⏱</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.descripcion}
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                      <span style={{ fontSize: 10, color: '#94a3b8' }}>{startStr} – {endStr}</span>
                      {c && e.especialidad && (
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: c.text, background: c.bg, border: `1px solid ${c.border}`,
                          padding: '0px 6px', borderRadius: 6,
                        }}>
                          {e.especialidad}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, flexShrink: 0 }}>
                    {durStr(e.duracionSegundos)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── DIARIO: timeline with comments ──────────────────────────────────────────

function TimelineItem({ item, comentarios, onAdd, onDelete }) {
  const [showComments, setShowComments] = useState(false)
  const refId = String(item.id)
  const itemComments = comentarios.filter(c => c.tipo === 'timeline' && c.refId === refId)

  if (item._type === 'entry') {
    const c = item.especialidad ? getEspecialidadColor(item.especialidad) : null
    return (
      <div style={{
        background: '#fff', border: '1px solid #f0f0f0',
        borderRadius: 14, overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 4 }}>
                {NAME} estudió <em style={{ fontStyle: 'normal' }}>{item.descripcion}</em>
              </div>
              {c && item.especialidad && !item.especialidad.startsWith('_') && (
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
              <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT }}>{durStr(item.duracionSegundos)}</div>
              <div style={{ fontSize: 11, color: '#bbb', marginTop: 2 }}>{relTime(item._ts)}</div>
            </div>
          </div>

          <button
            onClick={() => setShowComments(v => !v)}
            style={{
              marginTop: 10, background: 'none', border: 'none',
              cursor: 'pointer', color: '#64748b', fontSize: 12,
              fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
            }}
          >
            💬 {itemComments.length > 0 ? `${itemComments.length} comentario${itemComments.length > 1 ? 's' : ''}` : 'Comentar'}
            <span style={{ fontSize: 10 }}>{showComments ? '▲' : '▼'}</span>
          </button>
        </div>

        {showComments && (
          <div style={{ padding: '0 16px 14px', borderTop: '1px solid #f8f8f8' }}>
            <CommentList
              comentarios={comentarios}
              refId={refId}
              tipo="timeline"
              onAdd={onAdd}
              onDelete={onDelete}
            />
          </div>
        )}
      </div>
    )
  }

  // Post
  return (
    <div style={{
      background: '#fffbf5', border: '1px solid #fde68a',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
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
          </div>
          <div style={{ fontSize: 11, color: '#bbb', flexShrink: 0, marginTop: 2 }}>
            {relTime(item._ts)}
          </div>
        </div>

        <button
          onClick={() => setShowComments(v => !v)}
          style={{
            marginTop: 10, background: 'none', border: 'none',
            cursor: 'pointer', color: '#b45309', fontSize: 12,
            fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          💬 {itemComments.length > 0 ? `${itemComments.length} comentario${itemComments.length > 1 ? 's' : ''}` : 'Comentar'}
          <span style={{ fontSize: 10 }}>{showComments ? '▲' : '▼'}</span>
        </button>
      </div>

      {showComments && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #fde68a40' }}>
          <CommentList
            comentarios={comentarios}
            refId={refId}
            tipo="timeline"
            onAdd={onAdd}
            onDelete={onDelete}
          />
        </div>
      )}
    </div>
  )
}

// ─── STATS panel ──────────────────────────────────────────────────────────────

function StatsPanel({ entries, onShowMore, compact = false }) {
  const { start: todayStart, end: todayEnd } = todayBounds()
  const { mon, sun } = getWeekBounds()

  const todayEnts  = entries.filter(e => e.inicio >= todayStart && e.inicio <= todayEnd)
  const weekEnts   = entries.filter(e => e.inicio >= mon.getTime() && e.inicio <= sun.getTime())
  const horasHoy   = todayEnts.reduce((s, e) => s + e.duracionSegundos, 0) / 3600
  const horasSem   = weekEnts.reduce((s, e) => s + e.duracionSegundos, 0) / 3600

  const byEsp = {}
  weekEnts.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_')) {
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
    }
  })
  const topEsp = Object.entries(byEsp).sort((a, b) => b[1] - a[1])
  const mejorEsp = topEsp[0]?.[0] || '—'

  const statsData = [
    { label: 'Horas hoy',    value: horasHoy  > 0 ? `${Math.round(horasHoy  * 10) / 10}h` : '0h',  icon: '⏱️' },
    { label: 'Esta semana',  value: horasSem  > 0 ? `${Math.round(horasSem  * 10) / 10}h` : '0h',  icon: '📅' },
    { label: 'Top semana',   value: mejorEsp, icon: '🏆' },
  ]

  if (compact) {
    return (
      <div style={{
        display: 'flex', gap: 8, padding: '10px 16px',
        background: '#fff', borderBottom: '1px solid #f0f0f0', overflowX: 'auto',
      }}>
        {statsData.map(s => (
          <div key={s.label} style={{
            flex: '0 0 auto', background: '#fafafa', border: '1px solid #f0f0f0',
            borderRadius: 12, padding: '8px 14px', minWidth: 80, textAlign: 'center',
          }}>
            <div style={{ fontSize: 18 }}>{s.icon}</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px', lineHeight: 1.2 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
        <button onClick={onShowMore} style={{
          flex: '0 0 auto', background: '#fff', border: `1px solid ${ACCENT}`,
          borderRadius: 12, padding: '8px 14px', color: ACCENT,
          fontWeight: 700, fontSize: 11, cursor: 'pointer',
        }}>
          Ver más →
        </button>
      </div>
    )
  }

  // Desktop sidebar
  const days7   = last7Days()
  const byDay7  = days7.map(dayStart => {
    const dayEnd = dayStart + 86_400_000 - 1
    return entries
      .filter(e => e.inicio >= dayStart && e.inicio <= dayEnd)
      .reduce((s, e) => s + e.duracionSegundos / 3600, 0)
  })
  const maxDay = Math.max(...byDay7, 1)
  const DAY_NAMES = ['L','M','X','J','V','S','D']

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Mini stats */}
      {statsData.map(s => (
        <div key={s.label} style={{
          background: '#fff', border: '1px solid #f0f0f0',
          borderRadius: 14, padding: '14px 16px',
          boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
        }}>
          <div style={{ fontSize: 20 }}>{s.icon}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: '-0.8px', marginTop: 4 }}>
            {s.value}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{s.label}</div>
        </div>
      ))}

      {/* 7-day mini chart */}
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Últimos 7 días</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 60 }}>
          {byDay7.map((h, i) => {
            const barH   = Math.max(h > 0 ? 3 : 0, Math.round((h / maxDay) * 56))
            const d      = new Date(days7[i])
            const dow    = d.getDay()
            const isToday = i === 6
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', width: '100%' }}>
                  <div style={{
                    width: '100%', height: barH,
                    background: isToday ? ACCENT : '#e8c878',
                    borderRadius: '3px 3px 0 0',
                    opacity: isToday ? 1 : 0.65,
                  }} />
                </div>
                <div style={{ fontSize: 9, color: isToday ? ACCENT : '#aaa', fontWeight: isToday ? 700 : 400, marginTop: 3 }}>
                  {DAY_NAMES[dow === 0 ? 6 : dow - 1]}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top specialties mini */}
      {topEsp.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 10 }}>Asignaturas (semana)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {topEsp.slice(0, 5).map(([nombre, horas]) => {
              const pct = Math.round((horas / (topEsp[0][1] || 1)) * 100)
              const c   = getEspecialidadColor(nombre)
              return (
                <div key={nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text }}>{nombre}</span>
                    <span style={{ fontSize: 11, color: '#64748b' }}>{Math.round(horas * 10) / 10}h</span>
                  </div>
                  <div style={{ background: '#f0f0f0', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: c.text, height: '100%', borderRadius: 4, opacity: 0.8 }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FORO: general comment board ──────────────────────────────────────────────

function Foro({ comentarios, onAdd, onDelete }) {
  const foroComments = comentarios
    .filter(c => c.tipo === 'foro')
    .sort((a, b) => b.createdAt - a.createdAt)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.5, background: '#fafafa', borderRadius: 12, padding: '12px 14px', border: '1px solid #f0f0f0' }}>
        💬 Deja aquí tus mensajes, preguntas o palabras de ánimo. Responde libremente, sin registro.
      </div>

      {/* New comment form */}
      <div style={{
        background: '#fff', border: `1.5px solid ${ACCENT}30`,
        borderRadius: 14, padding: '16px',
        boxShadow: '0 1px 6px rgba(0,0,0,0.04)',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Nuevo mensaje</div>
        <ForoForm onAdd={onAdd} />
      </div>

      {/* Comments list */}
      {foroComments.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontSize: 13 }}>
          Aún no hay mensajes. ¡Sé el primero!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {foroComments.map(c => (
            <div key={c.id} style={{
              background: '#fff', border: '1px solid #f0f0f0',
              borderRadius: 12, padding: '12px 14px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: `hsl(${c.autor.charCodeAt(0) * 47 % 360}, 60%, 88%)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: `hsl(${c.autor.charCodeAt(0) * 47 % 360}, 50%, 35%)`,
                  flexShrink: 0,
                }}>
                  {c.autor[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>{c.autor}</span>
                    <span style={{ fontSize: 11, color: '#bbb' }}>{relTime(c.createdAt)}</span>
                    {IS_ADMIN && (
                      <button
                        onClick={() => onDelete(c.id)}
                        style={{ fontSize: 11, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, wordBreak: 'break-word' }}>
                    {c.texto}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ForoForm({ onAdd }) {
  const [autor, setAutor] = useState('')
  const [texto, setTexto] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  async function send() {
    if (!autor.trim() || !texto.trim()) { setErr('Rellena tu nombre y el mensaje'); return }
    if (texto.trim().length > 1000) { setErr('Máximo 1000 caracteres'); return }
    setSending(true); setErr('')
    const c = await onAdd({ autor: autor.trim(), texto: texto.trim(), tipo: 'foro', refId: null })
    if (c) {
      setAutor(''); setTexto('')
      setSent(true)
      setTimeout(() => setSent(false), 3000)
    } else {
      setErr('Error al enviar. Inténtalo de nuevo.')
    }
    setSending(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        value={autor}
        onChange={e => setAutor(e.target.value)}
        placeholder="Tu nombre o alias *"
        maxLength={40}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none' }}
      />
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        placeholder="Escribe tu mensaje..."
        maxLength={1000}
        rows={3}
        style={{ padding: '9px 12px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 11, color: err ? '#ef4444' : '#bbb' }}>{err || `${texto.length}/1000`}</div>
        <button
          onClick={send}
          disabled={sending || !autor.trim() || !texto.trim()}
          style={{
            padding: '8px 20px', background: autor.trim() && texto.trim() ? ACCENT : '#e2e8f0',
            color: autor.trim() && texto.trim() ? '#fff' : '#94a3b8',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13,
            cursor: autor.trim() && texto.trim() ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {sending ? 'Enviando...' : sent ? '¡Enviado! ✓' : 'Enviar mensaje'}
        </button>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'hoy',    label: '📅 Hoy' },
  { id: 'diario', label: '📖 Diario' },
  { id: 'foro',   label: '💬 Foro' },
]

export default function PublicView() {
  const [tab, setTab]           = useState('hoy')
  const [entries, setEntries]   = useState([])
  const [posts, setPosts]       = useState([])
  const [comentarios, setComentarios] = useState([])
  const [completados, setCompletados] = useState([])
  const [descartados, setDescartados] = useState([])
  const [loading, setLoading]   = useState(true)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handle)
    return () => window.removeEventListener('resize', handle)
  }, [])

  const load = async () => {
    const [ents, psts, coms, blocks] = await Promise.all([
      fetchEntries(),
      fetchPosts(),
      getComentarios(),
      fetchBlockStatus(),
    ])
    setEntries(ents)
    setPosts(psts)
    setComentarios(coms)
    setCompletados(blocks.completados)
    setDescartados(blocks.descartados)
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
    const { supabase: sb } = await import('../lib/supabase')
    await sb.from('comentarios').delete().eq('id', id)
    setComentarios(prev => prev.filter(c => c.id !== id))
  }

  const timeline = [...entries, ...posts].sort((a, b) => b._ts - a._ts)

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Cargando progreso de {NAME}...</div>
        </div>
      </div>
    )
  }

  // ── Tab content ────────────────────────────────────────────────────────────

  function renderTab() {
    if (tab === 'hoy') {
      return (
        <SesionPublica
          entries={entries}
          completados={completados}
          descartados={descartados}
        />
      )
    }
    if (tab === 'diario') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {timeline.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: '#bbb', fontSize: 14 }}>
              Aún no hay actividad registrada.
            </div>
          ) : timeline.map(item => (
            <TimelineItem
              key={`${item._type}-${item.id}`}
              item={item}
              comentarios={comentarios}
              onAdd={handleAddComment}
              onDelete={handleDeleteComment}
            />
          ))}
        </div>
      )
    }
    if (tab === 'foro') {
      return (
        <Foro
          comentarios={comentarios}
          onAdd={handleAddComment}
          onDelete={handleDeleteComment}
        />
      )
    }
  }

  // ── Tab bar ────────────────────────────────────────────────────────────────

  function TabBar({ fullWidth = false }) {
    const foroCount = comentarios.filter(c => c.tipo === 'foro').length
    return (
      <div style={{
        display: 'flex', gap: 0,
        background: '#f0f0f0', borderRadius: 12, padding: 4,
        ...(fullWidth ? { width: '100%' } : {}),
      }}>
        {TABS.map(t => {
          const badge = t.id === 'foro' && foroCount > 0 ? foroCount : null
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                flex: 1, padding: '8px 16px', border: 'none', borderRadius: 9,
                background: tab === t.id ? '#fff' : 'transparent',
                color: tab === t.id ? ACCENT : '#666',
                fontWeight: tab === t.id ? 700 : 500,
                fontSize: 13, cursor: 'pointer',
                boxShadow: tab === t.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              }}
            >
              {t.label}
              {badge && (
                <span style={{
                  background: ACCENT, color: '#fff',
                  borderRadius: 20, fontSize: 9, fontWeight: 700,
                  padding: '1px 5px',
                }}>
                  {badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ── MOBILE layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa' }}>
        {/* Header */}
        <div style={{ background: '#fff', borderBottom: '1px solid #f0f0f0', padding: '14px 16px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
                {NAME} estudia MIR
              </div>
              <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>MIR 2027 · Progreso en directo</div>
            </div>
            <LiveBadge />
          </div>
        </div>

        {/* Stats strip */}
        <StatsPanel entries={entries} compact onShowMore={() => setTab('hoy')} />

        {/* Tab bar */}
        <div style={{ padding: '10px 12px 0', background: '#fafafa' }}>
          <TabBar fullWidth />
        </div>

        {/* Content */}
        <div style={{ padding: '12px 12px 40px' }}>
          {renderTab()}
        </div>
      </div>
    )
  }

  // ── DESKTOP layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        padding: '14px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: '#1a1a1a', letterSpacing: '-0.3px' }}>
            {NAME} estudia MIR
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>MIR 2027 · Progreso en directo</div>
        </div>
        <LiveBadge />
      </div>

      {/* Body */}
      <div style={{
        flex: 1, display: 'flex', maxWidth: 1160,
        margin: '0 auto', width: '100%', padding: '24px 24px 40px', gap: 24,
        alignItems: 'flex-start',
      }}>

        {/* Left: tabs + content */}
        <div style={{ flex: '0 0 63%', maxWidth: '63%', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <TabBar />
          {renderTab()}
        </div>

        {/* Right: sticky stats */}
        <div style={{
          flex: '0 0 37%', maxWidth: '37%',
          position: 'sticky', top: 80, display: 'flex', flexDirection: 'column', gap: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>
            Estadísticas
          </div>
          <StatsPanel entries={entries} />
          <div style={{ fontSize: 11, color: '#cbd5e1', textAlign: 'center', marginTop: 10 }}>
            Actualiza cada 30 segundos
          </div>
        </div>
      </div>
    </div>
  )
}
