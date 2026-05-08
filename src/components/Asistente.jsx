/**
 * Asistente.jsx — Asistente de organización del estudio MIR
 *
 * Dos capas:
 *  1. Engine de reglas (siempre activo): analiza el plan del día,
 *     detecta saturación, gaps de la semana, prioridades.
 *  2. Chat IA (opcional): si VITE_AI_ENABLED=true y el servidor Vite
 *     tiene ANTHROPIC_KEY en .env, habilita preguntas libres a Claude.
 */
import { useState, useEffect, useRef } from 'react'
import { useTracker } from '../context/TrackerContext'
import {
  planesCalendarioGlobal, planesAdicionales, todayStr,
  repasosData, bloquesCompletados, bloquesDescartados, MIR_DATE,
} from '../data/mockData'
import {
  rentabilidad, getRentabilidad, getMediaReciente,
} from '../data/mirStats'

const ACCENT = '#BA7517'
const AI_ENABLED = import.meta.env.VITE_AI_ENABLED === 'true'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMins(t) {
  if (!t) return 0
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m || 0)
}

function daysUntilMIR() {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((MIR_DATE - today) / 86_400_000)
}

function getWeekStart() {
  const now = new Date()
  const dow = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const mon = new Date(now)
  mon.setDate(now.getDate() + diff)
  mon.setHours(0, 0, 0, 0)
  return mon.getTime()
}

// ─── Rule-based engine ────────────────────────────────────────────────────────

function analyzePlan(entries) {
  const allPlan = [
    ...(planesCalendarioGlobal[todayStr] || []),
    ...(planesAdicionales[todayStr] || []),
  ].filter(b => !bloquesDescartados.includes(b.id))

  // Total planned hours
  const totalMins = allPlan.reduce((s, b) => {
    return s + Math.max(0, timeToMins(b.fin) - timeToMins(b.inicio))
  }, 0)
  const totalH = totalMins / 60

  // Blocks with priority data
  const withPriority = allPlan.map(b => {
    const r = getRentabilidad(b.especialidad)
    return { ...b, prioridad: r.prioridad, media: getMediaReciente(b.especialidad) }
  })

  // Blocks to potentially skip (low/medium priority, not yet done)
  const skipCandidates = withPriority
    .filter(b => ['baja', 'media'].includes(b.prioridad) && !bloquesCompletados.includes(b.id))
    .sort((a, b) => a.media - b.media)
    .slice(0, 2)

  // Must-keep blocks (alta priority, not done)
  const mustKeep = withPriority
    .filter(b => b.prioridad === 'alta' && !bloquesCompletados.includes(b.id))

  return { totalH, allPlan, withPriority, skipCandidates, mustKeep }
}

function analyzeWeek(entries) {
  const weekStart = getWeekStart()
  const weekEntries = entries.filter(e => e.inicio >= weekStart)

  const studiedSet = new Set(
    weekEntries
      .filter(e => e.especialidad && !e.especialidad.startsWith('_'))
      .map(e => e.especialidad)
  )

  const hoursThisWeek = weekEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600

  // High-priority specialties not studied this week
  const gaps = Object.entries(rentabilidad)
    .filter(([esp, r]) => r.prioridad === 'alta' && !studiedSet.has(esp))
    .map(([esp]) => ({ esp, media: getMediaReciente(esp) }))
    .sort((a, b) => b.media - a.media)
    .slice(0, 4)

  // Recent per-specialty breakdown (last 14 days)
  const twoWeeksAgo = Date.now() - 14 * 86_400_000
  const recentEntries = entries.filter(e => e.inicio >= twoWeeksAgo && e.especialidad && !e.especialidad.startsWith('_'))
  const byEsp = {}
  recentEntries.forEach(e => {
    byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
  })

  return { studiedSet, hoursThisWeek, gaps, byEsp }
}

function getPendingRepasos() {
  return repasosData.filter(r => r.fechaProximoRepaso <= Date.now()).length
}

// ─── Build Claude context ─────────────────────────────────────────────────────

function buildSystemPrompt(entries) {
  const days = daysUntilMIR()
  const { totalH, skipCandidates, mustKeep } = analyzePlan(entries)
  const { gaps, byEsp, hoursThisWeek } = analyzeWeek(entries)
  const pending = getPendingRepasos()

  const weekProgressStr = Object.entries(byEsp)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([esp, h]) => `${esp}: ${Math.round(h * 10) / 10}h`)
    .join(', ') || 'Sin datos recientes'

  const gapsStr = gaps.map(g => g.esp).join(', ') || 'Ninguno'

  const planStr = [...(planesCalendarioGlobal[todayStr] || [])]
    .slice(0, 6)
    .map(b => `${b.titulo} (${b.inicio}–${b.fin}, ${getRentabilidad(b.especialidad).prioridad})`)
    .join('\n  ') || 'Sin plan para hoy'

  return `Eres un asistente personal para preparar el MIR (examen de especialidades médicas en España). Eres conciso, práctico y directo.

SITUACIÓN DEL ESTUDIANTE:
- Examen: MIR 2027 (25 enero). Quedan ${days} días.
- Horas planificadas hoy: ${totalH.toFixed(1)}h
- Horas estudiadas esta semana: ${hoursThisWeek.toFixed(1)}h
- Repasos pendientes hoy: ${pending}

PLAN DE HOY:
  ${planStr}

ESTUDIO ÚLTIMAS 2 SEMANAS:
  ${weekProgressStr}

ASIGNATURAS DE ALTA PRIORIDAD NO ESTUDIADAS ESTA SEMANA:
  ${gapsStr}

PRIORIDADES MIR (media últimas 2 convocatorias):
  Alta (≥8/conv): Cardiología(17), Digestivo(12.5), Neurología(12.5), Reumatología(10), Infecciosas(10.5), Endocrinología(9.5), Pediatría(9.5), Ginecología(9), Neumología(8), Epidemiología(8), Traumatología(8), Bioética(7)
  Media-alta (5-7): Hemato(7), Nefro(7), Psiquiatría(7.5), Urología(6), Otorrino(5.5), Oftalmo(4.5)
  Baja (<3): Anatomía, Anestesia, Bioquímica, Farmacología

INSTRUCCIONES:
- Responde en español, máximo 140 palabras
- Sin asteriscos ni markdown — usa texto plano
- Sé específico: nombra asignaturas, da tiempos concretos
- Si la pregunta tiene respuesta simple, sé muy breve
- Usa saltos de línea para separar ideas`
}

// ─── Chat API ─────────────────────────────────────────────────────────────────

async function askClaude(systemPrompt, messages) {
  const res = await fetch('/api/claude/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: systemPrompt,
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(err)
  }
  const data = await res.json()
  return data.content[0].text
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PRIORIDAD_COLORS = {
  alta:       '#b91c1c',
  media_alta: '#c2410c',
  media:      '#b45309',
  baja:       '#64748b',
}

function AlertCard({ icon, title, children, color = '#64748b', bg = '#f8fafc' }) {
  return (
    <div style={{
      background: bg, border: `1px solid ${color}30`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 10, padding: '10px 12px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color, marginBottom: 4 }}>{icon} {title}</div>
      {children}
    </div>
  )
}

const QUICK_QUESTIONS = [
  '¿A qué doy prioridad hoy?',
  '¿Qué puedo saltarme?',
  '¿Qué me falta estudiar esta semana?',
  '3 horas libres — ¿qué hago?',
  '¿Cómo voy de progreso?',
]

// ─── Main component ───────────────────────────────────────────────────────────

export default function Asistente() {
  const { entries } = useTracker()
  const [open, setOpen] = useState(false)
  const [chatMessages, setChatMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [systemPrompt, setSystemPrompt] = useState('')
  const chatEndRef = useRef(null)

  // Compute analysis
  const plan = analyzePlan(entries)
  const week = analyzeWeek(entries)
  const pendingRepasos = getPendingRepasos()
  const days = daysUntilMIR()

  // Build system prompt when entries change
  useEffect(() => {
    setSystemPrompt(buildSystemPrompt(entries))
  }, [entries.length])

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Count alerts for badge
  const alertCount =
    (plan.totalH > 8 ? 1 : 0) +
    (week.gaps.length > 0 ? 1 : 0) +
    (pendingRepasos >= 5 ? 1 : 0)

  async function sendMessage(text) {
    if (!text.trim() || loading) return
    const userMsg = { role: 'user', content: text.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)
    try {
      const reply = await askClaude(systemPrompt, newMessages)
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }])
    } catch (e) {
      setError(e.message.includes('fetch') || e.message.includes('Failed')
        ? 'No se pudo conectar. ¿Tienes ANTHROPIC_KEY en tu .env?'
        : 'Error al conectar con el asistente. Comprueba que el servidor está activo.')
    } finally {
      setLoading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ marginBottom: 14 }}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 14px',
          background: open ? '#fff' : '#fff',
          border: `1.5px solid ${open ? ACCENT + '60' : '#f0f0f0'}`,
          borderRadius: open ? '12px 12px 0 0' : 12,
          cursor: 'pointer', transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🤖</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Asistente</span>
          {!open && alertCount > 0 && (
            <span style={{
              background: '#ef4444', color: '#fff',
              borderRadius: 20, fontSize: 10, fontWeight: 700,
              padding: '1px 6px',
            }}>
              {alertCount}
            </span>
          )}
          {!open && alertCount === 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8' }}>Todo en orden</span>
          )}
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded panel */}
      {open && (
        <div style={{
          border: `1.5px solid ${ACCENT}60`, borderTop: 'none',
          borderRadius: '0 0 12px 12px',
          background: '#fff', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* ── HOY ── */}
            <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>
              HOY · {days} días para el MIR
            </div>

            {plan.allPlan.length === 0 ? (
              <AlertCard icon="📅" title="Sin plan para hoy" color="#64748b" bg="#f8fafc">
                <div style={{ color: '#64748b' }}>No hay bloques planificados. Buen momento para repasos o estudio libre.</div>
              </AlertCard>
            ) : plan.totalH > 8 ? (
              <AlertCard icon="⚠️" title={`Día saturado — ${plan.totalH.toFixed(1)}h planificadas`} color="#dc2626" bg="#fef2f2">
                <div style={{ color: '#64748b', marginBottom: 6 }}>Es mucho para un día. Considera saltar:</div>
                {plan.skipCandidates.map(b => (
                  <div key={b.id} style={{ color: PRIORIDAD_COLORS[b.prioridad], fontWeight: 600, marginBottom: 2 }}>
                    · {b.titulo.replace(/^[^\s]+\s/, '')}
                    {' '}
                    <span style={{ fontWeight: 400, color: '#94a3b8' }}>
                      ({b.media > 0 ? `${b.media} preg/MIR` : 'baja prioridad'})
                    </span>
                  </div>
                ))}
                {plan.mustKeep.length > 0 && (
                  <div style={{ marginTop: 6, color: '#64748b' }}>
                    Mantén: <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                      {plan.mustKeep.slice(0, 2).map(b => b.titulo.replace(/^[^\s]+\s/, '')).join(', ')}
                    </span>
                  </div>
                )}
              </AlertCard>
            ) : plan.totalH > 6.5 ? (
              <AlertCard icon="📋" title={`${plan.totalH.toFixed(1)}h planificadas — día intenso`} color={ACCENT} bg="#fffbf0">
                <div style={{ color: '#64748b' }}>
                  Manejable si empiezas a tiempo. Alta prioridad:
                  {' '}<span style={{ color: '#b91c1c', fontWeight: 600 }}>
                    {plan.mustKeep.slice(0, 2).map(b => b.titulo.replace(/^[^\s]+\s/, '')).join(', ')}
                  </span>
                </div>
              </AlertCard>
            ) : (
              <AlertCard icon="✅" title={`${plan.totalH.toFixed(1)}h planificadas — día equilibrado`} color="#16a34a" bg="#f0fdf4">
                <div style={{ color: '#64748b' }}>
                  Plan razonable. {plan.mustKeep.length > 0 && (
                    <>Prioridad: <span style={{ color: '#b91c1c', fontWeight: 600 }}>
                      {plan.mustKeep.slice(0, 2).map(b => b.titulo.replace(/^[^\s]+\s/, '')).join(', ')}
                    </span></>
                  )}
                </div>
              </AlertCard>
            )}

            {/* ── REPASOS PENDIENTES ── */}
            {pendingRepasos > 0 && (
              <AlertCard
                icon="📚"
                title={`${pendingRepasos} repaso${pendingRepasos > 1 ? 's' : ''} pendiente${pendingRepasos > 1 ? 's' : ''}`}
                color={pendingRepasos >= 10 ? '#dc2626' : pendingRepasos >= 5 ? '#d97706' : '#64748b'}
                bg={pendingRepasos >= 10 ? '#fef2f2' : pendingRepasos >= 5 ? '#fffbeb' : '#f8fafc'}
              >
                <div style={{ color: '#64748b' }}>
                  {pendingRepasos >= 10
                    ? 'Muchos repasos acumulados. Dedica la primera hora del día a repasar antes de nuevo contenido.'
                    : pendingRepasos >= 5
                    ? 'Dedica 30-40 min a repasar antes de empezar el plan.'
                    : 'Unos pocos repasos. Hazlos al inicio o al final del día.'}
                </div>
              </AlertCard>
            )}

            {/* ── GAPS DE LA SEMANA ── */}
            {week.gaps.length > 0 && (
              <AlertCard icon="🎯" title="Alta prioridad sin estudiar esta semana" color="#7c3aed" bg="#faf5ff">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
                  {week.gaps.map(g => (
                    <div key={g.esp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#5b21b6', fontWeight: 600 }}>· {g.esp}</span>
                      <span style={{ color: '#94a3b8', fontSize: 10 }}>{g.media} preg/MIR</span>
                    </div>
                  ))}
                </div>
              </AlertCard>
            )}

            {/* ── ESTA SEMANA stats ── */}
            {week.hoursThisWeek > 0 && (
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>
                  <span style={{ fontWeight: 700, color: ACCENT }}>{week.hoursThisWeek.toFixed(1)}h</span> esta semana
                  {' · '}
                  <span style={{ fontWeight: 700, color: '#5b21b6' }}>{week.studiedSet.size}</span> asignaturas
                </div>
              </div>
            )}

            {/* ── CHAT IA ── */}
            {AI_ENABLED && (
              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 12, marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>
                  Chat IA
                </div>

                {/* Conversation */}
                {chatMessages.length > 0 && (
                  <div style={{
                    maxHeight: 280, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: 8,
                    marginBottom: 10, paddingRight: 2,
                  }}>
                    {chatMessages.map((m, i) => (
                      <div key={i} style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '88%',
                        background: m.role === 'user' ? ACCENT : '#f8fafc',
                        color: m.role === 'user' ? '#fff' : '#1a1a1a',
                        border: m.role === 'assistant' ? '1px solid #f0f0f0' : 'none',
                        borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        padding: '8px 12px',
                        fontSize: 12,
                        lineHeight: 1.55,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
                    ))}
                    {loading && (
                      <div style={{
                        alignSelf: 'flex-start', background: '#f8fafc',
                        border: '1px solid #f0f0f0', borderRadius: '14px 14px 14px 4px',
                        padding: '8px 12px', fontSize: 12, color: '#94a3b8',
                      }}>
                        Pensando...
                      </div>
                    )}
                    {error && (
                      <div style={{
                        alignSelf: 'flex-start', background: '#fef2f2',
                        border: '1px solid #fecaca', borderRadius: 10,
                        padding: '8px 12px', fontSize: 11, color: '#ef4444',
                      }}>
                        {error}
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Quick question chips */}
                {chatMessages.length === 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {QUICK_QUESTIONS.map(q => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={loading}
                        style={{
                          padding: '5px 10px', borderRadius: 20,
                          border: `1px solid ${ACCENT}40`,
                          background: '#fffbf0', color: ACCENT,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          opacity: loading ? 0.5 : 1,
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
                    placeholder="Pregúntame sobre tu plan de estudio..."
                    disabled={loading}
                    style={{
                      flex: 1, padding: '8px 12px', borderRadius: 10,
                      border: '1px solid #e2e8f0', fontSize: 12, outline: 'none',
                      background: loading ? '#f8fafc' : '#fff',
                    }}
                  />
                  <button
                    onClick={() => sendMessage(input)}
                    disabled={!input.trim() || loading}
                    style={{
                      padding: '8px 14px', borderRadius: 10, border: 'none',
                      background: input.trim() && !loading ? ACCENT : '#e2e8f0',
                      color: input.trim() && !loading ? '#fff' : '#94a3b8',
                      fontWeight: 700, fontSize: 12, cursor: input.trim() && !loading ? 'pointer' : 'default',
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                  >
                    ↑
                  </button>
                </div>

                {chatMessages.length > 0 && (
                  <button
                    onClick={() => { setChatMessages([]); setError(null) }}
                    style={{ marginTop: 6, background: 'none', border: 'none', fontSize: 11, color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                  >
                    Nueva conversación
                  </button>
                )}
              </div>
            )}

            {!AI_ENABLED && (
              <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '4px 0' }}>
                Chat IA desactivado · Añade <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>VITE_AI_ENABLED=true</code> y <code style={{ background: '#f1f5f9', padding: '1px 4px', borderRadius: 3 }}>ANTHROPIC_KEY=...</code> en .env
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  )
}
