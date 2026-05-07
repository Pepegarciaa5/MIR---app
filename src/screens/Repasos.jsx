import { useState } from 'react'
import { repasosData, persistData } from '../data/mockData'
import { useTracker } from '../context/TrackerContext'

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

export default function Repasos() {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const { activeEntry, elapsed, startTracking, stopTracking } = useTracker()

  const [items, setItems] = useState(() => {
    return repasosData
      .filter(r => r.fechaProximoRepaso <= todayMs)
      .map(r => ({ ...r, estado: null }));
  });

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
      persistData()
    }
    setItems(prev => prev.map(r =>
      r.id === item.id ? { ...r, estado: 'repasado' } : r
    ))
  }

  const setEstado = (id, estado) => {
    setItems(prev => prev.map(r => {
      if (r.id !== id) return r;
      const globalItem = repasosData.find(g => g.id === id);
      if (globalItem) {
        if (estado === 'repasado') {
          globalItem.fase = r.fase + 1;
          globalItem.fechaProximoRepaso = todayMs + (FASES_DIAS[r.fase] || 1) * 86400000;
        } else if (estado === 'pospuesto') {
          globalItem.fechaProximoRepaso = todayMs + 86400000;
        } else if (estado === 'eliminado') {
          const index = repasosData.findIndex(g => g.id === id);
          if (index !== -1) repasosData.splice(index, 1);
        } else if (estado === null) {
          globalItem.fase = r.fase;
          globalItem.fechaProximoRepaso = todayMs;
        }
        persistData();
      }
      return { ...r, estado };
    }));
  };

  const confirmarTodos = () => {
    // Stop any active review tracking first
    if (activeEntry?.repasoId) stopTracking()
    setItems(prev => {
      const nextItems = prev.map(r => {
        if (r.estado) return r;
        const globalItem = repasosData.find(g => g.id === r.id);
        if (globalItem) {
          globalItem.fase = r.fase + 1;
          globalItem.fechaProximoRepaso = todayMs + (FASES_DIAS[r.fase] || 1) * 86400000;
        }
        return { ...r, estado: 'repasado' };
      });
      persistData();
      return nextItems;
    });
  };

  const pendientes = items.filter(r => !r.estado);

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
        <button
          onClick={confirmarTodos}
          disabled={pendientes.length === 0}
          style={{
            background: pendientes.length === 0 ? '#f0f0f0' : ACCENT,
            color: pendientes.length === 0 ? '#bbb' : '#fff',
            border: 'none',
            borderRadius: 10,
            padding: '9px 14px',
            fontSize: 12,
            fontWeight: 700,
            cursor: pendientes.length === 0 ? 'default' : 'pointer',
            transition: 'background 0.2s',
            whiteSpace: 'nowrap',
          }}>
          Confirmar todos
        </button>
      </div>

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

    </div>
  )
}
