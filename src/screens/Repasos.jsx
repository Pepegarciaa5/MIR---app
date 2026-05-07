import { useState } from 'react'
import { repasosData } from '../data/mockData'
import { upsertRepaso, deleteRepaso } from '../lib/db'
import { useTracker } from '../context/TrackerContext'
import { especialidadNombres } from '../data/especialidadesMIR'

const ACCENT = '#BA7517'

const CONF = {
  1: { label: 'Flojo',   color: '#ef4444', bg: '#fef2f2' },
  2: { label: 'Regular', color: '#f59e0b', bg: '#fffbeb' },
  3: { label: 'Bien',    color: '#22c55e', bg: '#f0fdf4' },
}

function fmt(s) {
  if (!s) return '00:00:00'
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

const CONFIANZA_OPTS = [
  { id: 1, label: 'Flojo',   color: '#ef4444', bg: '#fef2f2' },
  { id: 2, label: 'Regular', color: '#f59e0b', bg: '#fffbeb' },
  { id: 3, label: 'Bien',    color: '#22c55e', bg: '#f0fdf4' },
]

export default function Repasos() {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const { activeEntry, elapsed, startTracking, stopTracking } = useTracker()

  const [items, setItems] = useState(() => {
    return repasosData
      .filter(r => r.fechaProximoRepaso <= todayMs)
      .map(r => ({ ...r, estado: null }));
  });

  // Manual add form
  const [showForm, setShowForm] = useState(false)
  const [formTitulo, setFormTitulo] = useState('')
  const [formEsp, setFormEsp] = useState('')
  const [formTema, setFormTema] = useState('')
  const [formDestino, setFormDestino] = useState('')
  const [formConfianza, setFormConfianza] = useState(2)

  const crearRepasoManual = () => {
    if (!formTitulo.trim()) return
    const newRepaso = {
      id: Date.now(),
      titulo: formTitulo.trim(),
      especialidad: formEsp || 'Sin asignar',
      tema: formTema.trim() || null,
      destinoGuardado: formDestino.trim() || null,
      minutosRepaso: 10,
      fase: 0,
      fechaProximoRepaso: todayMs,
      confianza: formConfianza,
    }
    repasosData.unshift(newRepaso)
    upsertRepaso(newRepaso)
    setItems(prev => [{ ...newRepaso, estado: null }, ...prev])
    setShowForm(false)
    setFormTitulo(''); setFormEsp(''); setFormTema(''); setFormDestino(''); setFormConfianza(2)
  }

  const FASES_DIAS = { 0: 3, 1: 7, 2: 21, 3: 0 };

  // Check if a specific review item is currently being tracked
  const isReviewActive = (itemId) => activeEntry?.repasoId === String(itemId)

  // Start tracking a review session
  const empezarRepaso = (item) => {
    startTracking({
      descripcion: `🔄 Repaso: ${item.titulo || item.tema}`,
      especialidad: item.especialidad || null,
      tema: item.tema || null,
      bloqueId: `repaso-${item.id}`,
      repasoId: String(item.id),
    })
  }

  // Stop tracking and finalize the review (advance phase)
  const finalizarRepaso = (item) => {
    stopTracking()
    const globalItem = repasosData.find(g => g.id === item.id)
    if (globalItem) {
      globalItem.fase = item.fase + 1
      globalItem.fechaProximoRepaso = todayMs + (FASES_DIAS[item.fase] || 1) * 86400000
      upsertRepaso(globalItem)
    }
    setItems(prev => prev.map(r =>
      r.id === item.id ? { ...r, estado: 'repasado' } : r
    ))
  }

  const setEstado = (id, estado) => {
    const r = items.find(x => x.id === id)
    if (!r) return
    const globalItem = repasosData.find(g => g.id === id)
    if (globalItem) {
      if (estado === 'repasado') {
        globalItem.fase = r.fase + 1
        globalItem.fechaProximoRepaso = todayMs + (FASES_DIAS[r.fase] || 1) * 86400000
        upsertRepaso(globalItem)
      } else if (estado === 'pospuesto') {
        globalItem.fechaProximoRepaso = todayMs + 86400000
        upsertRepaso(globalItem)
      } else if (estado === 'eliminado') {
        deleteRepaso(id)
        const index = repasosData.findIndex(g => g.id === id)
        if (index !== -1) repasosData.splice(index, 1)
      } else if (estado === null) {
        globalItem.fase = r.fase
        globalItem.fechaProximoRepaso = todayMs
        upsertRepaso(globalItem)
      }
    }
    setItems(prev => prev.map(x => x.id === id ? { ...x, estado } : x))
  }

  const confirmarTodos = () => {
    if (activeEntry?.repasoId) stopTracking()
    const updates = []
    setItems(prev => prev.map(r => {
      if (r.estado) return r
      const globalItem = repasosData.find(g => g.id === r.id)
      if (globalItem) {
        globalItem.fase = r.fase + 1
        globalItem.fechaProximoRepaso = todayMs + (FASES_DIAS[r.fase] || 1) * 86400000
        updates.push({ ...globalItem })
      }
      return { ...r, estado: 'repasado' }
    }))
    updates.forEach(g => upsertRepaso(g))
  }

  const pendientes = items.filter(r => !r.estado)

  // Cola completa: todo lo que está en repasosData y NO es pendiente hoy
  const [colaItems, setColaItems] = useState(() =>
    repasosData.filter(r => r.fechaProximoRepaso > todayMs)
      .sort((a, b) => a.fechaProximoRepaso - b.fechaProximoRepaso)
  )
  const [showCola, setShowCola] = useState(false)

  const eliminarDeCola = (id) => {
    deleteRepaso(id)
    const index = repasosData.findIndex(g => g.id === id)
    if (index !== -1) repasosData.splice(index, 1)
    setColaItems(prev => prev.filter(r => r.id !== id))
  }

  function diasHasta(ts) {
    const diff = ts - todayMs
    const dias = Math.round(diff / 86400000)
    if (dias === 0) return 'hoy'
    if (dias === 1) return 'mañana'
    return `en ${dias} días`
  }

  return (
    <div style={{ paddingBottom: 0 }}>
      {/* Header */}
      <div style={{
        padding: '0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        position: 'sticky',
        top: 0,
        background: '#fff',
        zIndex: 10,
        borderBottom: '1px solid #f5f5f5',
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>Repasos</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#999' }}>
            {pendientes.length > 0 ? `${pendientes.length} temas pendientes hoy` : '¡Todo repasado! 🎉'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ background: showForm ? '#e0e7ff' : '#f0f0f0', color: showForm ? '#4f46e5' : '#555', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            + Añadir
          </button>
          <button
            onClick={confirmarTodos}
            disabled={pendientes.length === 0}
            style={{ background: pendientes.length === 0 ? '#f0f0f0' : ACCENT, color: pendientes.length === 0 ? '#bbb' : '#fff', border: 'none', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: pendientes.length === 0 ? 'default' : 'pointer', transition: 'background 0.2s', whiteSpace: 'nowrap' }}>
            Confirmar todos
          </button>
        </div>
      </div>

      {/* Formulario manual */}
      {showForm && (
        <div style={{ margin: '12px 0 4px', padding: '16px', background: '#f8faff', border: '1px solid #c7d2fe', borderRadius: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#3730a3' }}>Nuevo repaso manual</div>
          <input
            value={formTitulo} onChange={e => setFormTitulo(e.target.value)}
            placeholder="Título o tema del repaso *"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #c7d2fe', fontSize: 13, fontWeight: 500 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={formEsp} onChange={e => setFormEsp(e.target.value)}
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1px solid #c7d2fe', fontSize: 12, background: '#fff', color: formEsp ? '#374151' : '#9ca3af' }}>
              <option value="">— Asignatura —</option>
              {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <input value={formTema} onChange={e => setFormTema(e.target.value)}
              placeholder="Tema (opcional)"
              style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #c7d2fe', fontSize: 12 }}
            />
          </div>
          <input value={formDestino} onChange={e => setFormDestino(e.target.value)}
            placeholder="¿Dónde está guardado? (Notion, Anki...)"
            style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #c7d2fe', fontSize: 12 }}
          />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 6 }}>Nivel de dominio inicial</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {CONFIANZA_OPTS.map(opt => (
                <button key={opt.id} onClick={() => setFormConfianza(opt.id)}
                  style={{ flex: 1, padding: '8px 0', border: formConfianza === opt.id ? `2px solid ${opt.color}` : '2px solid transparent', borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '7px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={crearRepasoManual}
              style={{ padding: '7px 18px', background: formTitulo.trim() ? '#4f46e5' : '#e0e7ff', color: formTitulo.trim() ? '#fff' : '#a5b4fc', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: formTitulo.trim() ? 'pointer' : 'default' }}>
              Añadir repaso
            </button>
          </div>
        </div>
      )}

      {/* Cards */}
      <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map(item => {
          if (item.estado === 'eliminado') return null;
          const conf = CONF[item.confianza]
          const done = !!item.estado
          const tracking = isReviewActive(item.id)
          return (
            <div key={item.id} style={{
              background: tracking ? '#fffbfa' : done ? '#fafafa' : '#fff',
              border: `1px solid ${tracking ? ACCENT : done ? '#f0f0f0' : '#ebebeb'}`,
              borderLeft: tracking ? `4px solid ${ACCENT}` : undefined,
              borderRadius: 16,
              padding: '14px 14px',
              opacity: done ? 0.55 : 1,
              transition: 'opacity 0.3s, background 0.3s, border 0.3s',
              boxShadow: tracking ? `0 3px 16px ${ACCENT}20` : done ? 'none' : '0 1px 6px rgba(0,0,0,0.04)',
            }}>
              {/* Top row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ flex: 1, paddingRight: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.2 }}>{item.titulo || item.tema}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 3 }}>
                    {item.especialidad}{item.tema && item.titulo ? ` · ${item.tema}` : ''}
                  </div>
                </div>
                <div style={{
                  background: conf.bg,
                  color: conf.color,
                  borderRadius: 7,
                  padding: '4px 9px',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  {conf.label}
                </div>
              </div>

              {/* Meta row */}
              <div style={{ display: 'flex', gap: 14, marginBottom: done && !tracking ? 0 : 12, fontSize: 12, color: '#aaa' }}>
                <span>⏱ Fase {item.fase}</span>
                <span>⏳ {item.minutosRepaso} min.</span>
                {tracking && (
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: ACCENT }}>
                    🔴 {fmt(elapsed)}
                  </span>
                )}
              </div>

              {/* Active tracking controls */}
              {tracking && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => finalizarRepaso(item)}
                    style={{
                      flex: 1,
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 9,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}>
                    ✓ Finalizar repaso ({fmt(elapsed)})
                  </button>
                </div>
              )}

              {/* Action buttons (when NOT tracking and NOT done) */}
              {!done && !tracking && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => empezarRepaso(item)}
                    disabled={!!activeEntry}
                    style={{
                      flex: 1,
                      background: activeEntry ? '#e2e8f0' : ACCENT,
                      color: activeEntry ? '#94a3b8' : '#fff',
                      border: 'none',
                      borderRadius: 9,
                      padding: '9px 0',
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: activeEntry ? 'default' : 'pointer',
                    }}>
                    {activeEntry ? 'Otra tarea activa...' : '▶ Empezar repaso'}
                  </button>
                  <button
                    onClick={() => setEstado(item.id, 'pospuesto')}
                    style={{
                      flex: 1,
                      background: '#f5f5f5',
                      color: '#666',
                      border: 'none',
                      borderRadius: 9,
                      padding: '9px 0',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}>
                    Posponer
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Seguro que quieres eliminar este repaso permanentemente?")) {
                        setEstado(item.id, 'eliminado')
                      }
                    }}
                    style={{
                      flex: 0.3,
                      background: '#fef2f2',
                      color: '#ef4444',
                      border: 'none',
                      borderRadius: 9,
                      padding: '9px 0',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                    🗑️
                  </button>
                </div>
              )}

              {done && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, color: item.estado === 'repasado' ? '#22c55e' : '#f59e0b', fontWeight: 600 }}>
                    {item.estado === 'repasado' ? '✓ Repasado hoy' : '→ Pospuesto para mañana'}
                  </span>
                  <button
                    onClick={() => setEstado(item.id, null)}
                    style={{ background: 'none', border: 'none', fontSize: 11, color: '#bbb', cursor: 'pointer' }}>
                    Deshacer
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Visor de la cola completa */}
      <div style={{ padding: '0 0 24px' }}>
        <button
          onClick={() => setShowCola(v => !v)}
          style={{ width: '100%', padding: '12px 16px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#475569' }}>
          <span>📋 Cola de repasos ({colaItems.length})</span>
          <span style={{ fontSize: 16, color: '#94a3b8' }}>{showCola ? '▲' : '▼'}</span>
        </button>

        {showCola && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {colaItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: 13 }}>
                No hay repasos programados.
              </div>
            ) : (
              colaItems.map(r => {
                const conf = CONF[r.confianza] || CONF[2]
                return (
                  <div key={r.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.titulo || r.tema}
                      </div>
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {r.especialidad}{r.tema && r.titulo ? ` · ${r.tema}` : ''} · Fase {r.fase}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: conf.color, background: conf.bg, padding: '2px 8px', borderRadius: 8 }}>
                        {conf.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: 8, whiteSpace: 'nowrap' }}>
                        {diasHasta(r.fechaProximoRepaso)}
                      </span>
                      <button
                        onClick={() => eliminarDeCola(r.id)}
                        style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 12, cursor: 'pointer', color: '#ef4444' }}>
                        🗑️
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>

    </div>
  )
}
