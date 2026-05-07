import { useState } from 'react'
import { useTracker } from '../context/TrackerContext'
import { repasosData, planesCalendarioGlobal, bloquesCompletados } from '../data/mockData'

const ACCENT = '#BA7517'
const BLUE = '#2563eb'
const GREEN = '#22c55e'
const PURPLE = '#a855f7'

function getWeekBounds() {
  const now = new Date()
  const dow = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function MetricCard({ label, value, sub, color, progress }) {
  const pct = Math.min(progress * 100, 100)
  return (
    <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 14, padding: '14px 14px 12px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 2, letterSpacing: '-1px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 11, color: '#bbb', marginBottom: 10 }}>{sub}</div>
      <div style={{ background: '#f0f0f0', borderRadius: 3, height: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, background: color, height: '100%', borderRadius: 3, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const PLAN_HOURS = [7, 7, 7, 7, 7, 3.5, 0]

export default function Progreso() {
  const { entries, deleteEntry, editEntryDuration } = useTracker()
  const [editingId, setEditingId] = useState(null)
  const [editH, setEditH] = useState('')
  const [editM, setEditM] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const { monday, sunday } = getWeekBounds()
  const weekEntries = entries.filter(e => e.inicio >= monday.getTime() && e.inicio <= sunday.getTime())

  const horasReal = Math.round((weekEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600) * 10) / 10
  const horasPlan = 35

  const byDay = [0, 0, 0, 0, 0, 0, 0]
  weekEntries.forEach(e => {
    const dow = new Date(e.inicio).getDay()
    const idx = dow === 0 ? 6 : dow - 1
    byDay[idx] = Math.round((byDay[idx] + e.duracionSegundos / 3600) * 10) / 10
  })

  const byEsp = {}
  weekEntries.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_')) {
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
    }
  })
  const topEsp = Object.entries(byEsp).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxEspH = topEsp.length > 0 ? topEsp[0][1] : 1

  const totalBloquesCompletados = bloquesCompletados.length
  const asignaturasDistintas = Object.keys(byEsp).length
  const repasosPendientes = repasosData.filter(r => r.fechaProximoRepaso <= Date.now()).length

  const MAX_H = Math.max(...byDay, ...PLAN_HOURS, 1)

  return (
    <div style={{ padding: '0' }}>
      <h2 style={{ margin: '0 0 18px', fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>Progreso semanal</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <MetricCard
          label="Horas de estudio"
          value={`${horasReal}h`}
          sub={`/ ${horasPlan}h planificadas`}
          color={ACCENT}
          progress={horasReal / horasPlan}
        />
        <MetricCard
          label="Asignaturas"
          value={asignaturasDistintas}
          sub="trabajadas esta semana"
          color={BLUE}
          progress={asignaturasDistintas / 10}
        />
        <MetricCard
          label="Bloques completados"
          value={totalBloquesCompletados}
          sub="del calendario"
          color={GREEN}
          progress={totalBloquesCompletados / 20}
        />
        <MetricCard
          label="Repasos pendientes"
          value={repasosPendientes}
          sub="para hoy"
          color={PURPLE}
          progress={repasosPendientes / 20}
        />
      </div>

      {/* Bar chart horas real vs planificado */}
      <div style={{ background: '#fafafa', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Horas por día</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 84, gap: 2, marginBottom: 8 }}>
          {DAY_LABELS.map((dia, i) => {
            const planH = Math.round((PLAN_HOURS[i] / MAX_H) * 80)
            const realH = Math.round((byDay[i] / MAX_H) * 80)
            return (
              <div key={dia} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
                  <div style={{ width: 11, height: planH || 2, background: '#e0e0e0', borderRadius: '3px 3px 0 0' }} />
                  <div style={{ width: 11, height: realH || 0, background: byDay[i] === 0 ? '#f0f0f0' : byDay[i] >= PLAN_HOURS[i] ? ACCENT : '#fb923c', borderRadius: '3px 3px 0 0', minHeight: byDay[i] > 0 ? 2 : 0 }} />
                </div>
                <div style={{ fontSize: 10, color: '#aaa', marginTop: 5 }}>{dia}</div>
              </div>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
          {[['#e0e0e0', 'Planificado'], [ACCENT, 'Real']].map(([color, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, background: color, borderRadius: 2 }} />
              <span style={{ fontSize: 11, color: '#999' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tiempo por asignatura */}
      <div style={{ background: '#fafafa', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 14 }}>Tiempo por asignatura</div>
        {topEsp.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: '#bbb', textAlign: 'center', padding: '16px 0' }}>
            Empieza a trackear asignaturas para ver el progreso aquí.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topEsp.map(([nombre, horas]) => {
              const pct = Math.round((horas / maxEspH) * 100)
              const h = Math.floor(horas)
              const m = Math.round((horas - h) * 60)
              return (
                <div key={nombre}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: '#444', fontWeight: 500 }}>{nombre}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>
                      {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : h === 0 ? '<1m' : ''}
                    </span>
                  </div>
                  <div style={{ background: '#e8e8e8', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: ACCENT, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Últimas entradas */}
      {entries.length > 0 && (
        <div style={{ background: '#fafafa', borderRadius: 16, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 12 }}>Últimas actividades</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {entries.slice(0, 15).map(e => {
              const h = Math.floor(e.duracionSegundos / 3600)
              const m = Math.floor((e.duracionSegundos % 3600) / 60)
              const s = e.duracionSegundos % 60
              const dur = h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
              const d = new Date(e.inicio)
              const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
              const isEditing = editingId === e.id
              return (
                <div key={e.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.descripcion}</div>
                      {e.especialidad && <div style={{ fontSize: 11, color: '#999', marginTop: 1 }}>{e.especialidad}{e.tema ? ` · ${e.tema}` : ''}</div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{dur}</div>
                      <div style={{ fontSize: 10, color: '#bbb' }}>{e.fecha} {hora}</div>
                    </div>
                    {/* Edit / Delete buttons */}
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => {
                          if (isEditing) {
                            setEditingId(null)
                          } else {
                            setEditingId(e.id)
                            setEditH(String(Math.floor(e.duracionSegundos / 3600)))
                            setEditM(String(Math.floor((e.duracionSegundos % 3600) / 60)))
                          }
                        }}
                        title="Editar duración"
                        style={{ background: isEditing ? '#e0e7ff' : '#f0f0f0', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: isEditing ? '#4f46e5' : '#666' }}>
                        ✏️
                      </button>
                      <button
                        onClick={() => {
                          setConfirmDeleteId(e.id)
                          setEditingId(null)
                        }}
                        title="Eliminar entrada"
                        style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}>
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* Inline delete confirmation */}
                  {confirmDeleteId === e.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
                      <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, flex: 1 }}>¿Eliminar esta entrada?</span>
                      <button
                        onClick={() => { deleteEntry(e.id); setConfirmDeleteId(null) }}
                        style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        Eliminar
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  )}

                  {/* Inline duration editor */}
                  {isEditing && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '10px 12px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe' }}>
                      <span style={{ fontSize: 12, color: '#3b82f6', fontWeight: 600 }}>Nueva duración:</span>
                      <input
                        type="number" min="0" max="23"
                        value={editH}
                        onChange={e2 => setEditH(e2.target.value)}
                        style={{ width: 48, padding: '4px 6px', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center', fontWeight: 700, fontSize: 13 }}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>h</span>
                      <input
                        type="number" min="0" max="59"
                        value={editM}
                        onChange={e2 => setEditM(e2.target.value)}
                        style={{ width: 48, padding: '4px 6px', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center', fontWeight: 700, fontSize: 13 }}
                      />
                      <span style={{ fontSize: 12, color: '#64748b' }}>min</span>
                      <button
                        onClick={() => {
                          const newSecs = (parseInt(editH) || 0) * 3600 + (parseInt(editM) || 0) * 60
                          if (newSecs < 0) return
                          editEntryDuration(e.id, newSecs)
                          setEditingId(null)
                        }}
                        style={{ marginLeft: 4, padding: '4px 12px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
