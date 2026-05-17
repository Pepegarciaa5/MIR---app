import { useState, useEffect, useMemo } from 'react'
import flashcardsData from '../data/flashcardsData.json'
import { getMnemotecnias, saveMnemotecnia } from '../lib/mnemotecnias'
import { especialidadNombres } from '../data/especialidadesMIR'

// Un pequeño helper para guardar y leer de localStorage
const STORAGE_KEY = 'mir_flashcards_progress'
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch (e) {
    return {}
  }
}
function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export default function ColaEstudio() {
  const [selectedSubject, setSelectedSubject] = useState('')
  const [progress, setProgress] = useState({})
  const [currentPositionOffset, setCurrentPositionOffset] = useState(0) // Contador virtual para avanzar la cola
  const [sessionSeed] = useState(() => Math.random().toString()) // Semilla para aleatoriedad
  const [mnemotecnias, setMnemotecnias] = useState([])
  
  // Estado para el modal de nueva mnemotecnia
  const [showMnemotecniaForm, setShowMnemotecniaForm] = useState(false)
  const [mneTexto, setMneTexto] = useState('')
  const [mneAsig, setMneAsig] = useState('')

  // Cargar progreso al montar
  useEffect(() => {
    setProgress(loadProgress())
    setMnemotecnias(getMnemotecnias())
  }, [])

  // Extraer lista única de asignaturas
  const asignaturas = useMemo(() => {
    const set = new Set(flashcardsData.map(f => f.asignatura))
    return Array.from(set).sort()
  }, [])

  // Filtrar y ordenar la cola
  const activeCards = useMemo(() => {
    let allCards = [...flashcardsData, ...mnemotecnias]
    let filtered = allCards
    if (selectedSubject) {
      filtered = filtered.filter(f => f.asignatura === selectedSubject)
    }

    // Calcular posición e importancia para cada tarjeta
    const mapped = filtered.map(card => {
      const p = progress[card.id] || {}
      return {
        ...card,
        importancia: p.importancia || card.importancia,
        archived: !!p.archived,
        // Si no tiene posición definida, su posición es 0 (nuevas)
        queue_position: p.queue_position !== undefined ? p.queue_position : 0
      }
    })

    // Filtrar archivadas
    const unarchived = mapped.filter(c => !c.archived)

    // Ordenar por posición. Para posiciones iguales, usamos un hash del ID mezclado
    // con la semilla de la sesión. Así cada vez que entras se barajan diferente, 
    // pero no "bailan" mientras respondes.
    unarchived.sort((a, b) => {
      if (a.queue_position !== b.queue_position) {
        return a.queue_position - b.queue_position
      }
      
      const hash = (str) => {
        let h = 0;
        const s = str + sessionSeed;
        for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return h;
      }
      
      return hash(a.id) - hash(b.id)
    })

    return unarchived
  }, [selectedSubject, progress, sessionSeed, mnemotecnias])

  const currentCard = activeCards.length > 0 ? activeCards[0] : null
  const totalInSubject = selectedSubject 
    ? flashcardsData.filter(f => f.asignatura === selectedSubject).length + mnemotecnias.filter(f => f.asignatura === selectedSubject).length
    : flashcardsData.length + mnemotecnias.length

  const crearMnemotecnia = () => {
    if (!mneTexto.trim()) return
    const nuevas = saveMnemotecnia({
      id: `MNE-${Date.now()}`,
      texto: mneTexto.trim(),
      asignatura: mneAsig || selectedSubject,
      bloqueId: null,
      importancia: 'mnemotecnia'
    })
    setMnemotecnias(nuevas)
    setShowMnemotecniaForm(false)
    setMneTexto('')
  }
  const completedCount = totalInSubject - activeCards.length

  function handleAction(actionType) {
    if (!currentCard) return

    const newProgress = { ...progress }
    const cardProg = newProgress[currentCard.id] || {}

    // La posición base es la del offset actual para que las "Nuevas" (que tienen 0)
    // se reinserten correctamente en el futuro en lugar de quedarse atascadas en 0.
    const basePos = Math.max(currentCard.queue_position, currentPositionOffset)

    if (actionType === 'fail') {
      // No me lo sé -> Volver a preguntar pronto (7 tarjetas de distancia)
      cardProg.queue_position = basePos + 7
      cardProg.archived = false
    } else if (actionType === 'doubt') {
      // Dudoso -> Volver a preguntar más tarde (21 tarjetas)
      cardProg.queue_position = basePos + 21
      cardProg.archived = false
    } else if (actionType === 'pass') {
      // Lo sé -> No se archiva, reaparece en 50 tarjetas
      cardProg.queue_position = basePos + 50
      cardProg.archived = false
    }

    newProgress[currentCard.id] = cardProg
    setProgress(newProgress)
    saveProgress(newProgress)
    setCurrentPositionOffset(prev => prev + 1)
  }

  function toggleImportance() {
    if (!currentCard) return
    const newProgress = { ...progress }
    const cardProg = newProgress[currentCard.id] || {}
    
    cardProg.importancia = currentCard.importancia === 'alta' ? 'normal' : 'alta'

    newProgress[currentCard.id] = cardProg
    setProgress(newProgress)
    saveProgress(newProgress)
  }

  function resetProgress() {
    if (confirm('¿Estás seguro de que quieres reiniciar TODO el progreso de esta asignatura? Volverás a ver todas las tarjetas.')) {
      const newProgress = { ...progress }
      const toReset = flashcardsData.filter(f => !selectedSubject || f.asignatura === selectedSubject)
      toReset.forEach(f => {
        delete newProgress[f.id]
      })
      setProgress(newProgress)
      saveProgress(newProgress)
      setCurrentPositionOffset(0)
    }
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Cabecera ── */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 4px 0' }}>Cola de Estudio</h2>
          <p style={{ fontSize: 13, color: '#64748b', margin: 0 }}>
            {totalInSubject} tarjetas en rotación continua
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <select 
            value={selectedSubject} 
            onChange={e => setSelectedSubject(e.target.value)}
            style={{
              padding: '8px 16px', borderRadius: 10, border: '1px solid #cbd5e1', 
              fontSize: 14, fontWeight: 600, background: '#fff', color: '#334155', cursor: 'pointer'
            }}
          >
            <option value="">Todas las asignaturas</option>
            {asignaturas.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <button onClick={() => setShowMnemotecniaForm(true)} style={{
            background: '#fdf4ff', color: '#c026d3', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
          }}>
            🧠 + Mnemotecnia
          </button>
            {/* Reset button only makes sense if we want to reset all positions to 0 */}
            <button onClick={resetProgress} style={{
              background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline'
            }}>
              Reiniciar posiciones
            </button>
        </div>
      </div>

      {/* ── Tarjeta Central ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
        {currentCard ? (
          <div style={{
            width: '100%',
            background: '#fff',
            borderRadius: 24,
            padding: '40px 32px',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)',
            border: currentCard.importancia === 'alta' ? '2px solid #fde047' : '1px solid #e2e8f0',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {currentCard.importancia === 'alta' && (
              <div style={{ 
                position: 'absolute', top: -12, left: 32, background: '#fef08a', color: '#854d0e', 
                fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 12, letterSpacing: 0.5 
              }}>
                ⭐ CONCEPTOS CLAVE
              </div>
            )}
            
            {currentCard.importancia === 'mnemotecnia' && (
              <div style={{ 
                position: 'absolute', top: -12, left: 32, background: '#c026d3', color: '#fff', 
                fontSize: 11, fontWeight: 800, padding: '4px 12px', borderRadius: 12, letterSpacing: 0.5 
              }}>
                🧠 REGLA MNEMOTÉCNICA
              </div>
            )}
            
            {currentCard.importancia !== 'mnemotecnia' && (
              <button 
                onClick={toggleImportance}
                title={currentCard.importancia === 'alta' ? 'Marcar como Normal' : 'Marcar como Alta Importancia'}
                style={{
                  position: 'absolute', top: 20, right: 24, background: 'none', border: 'none',
                  fontSize: 24, cursor: 'pointer', opacity: currentCard.importancia === 'alta' ? 1 : 0.2,
                  transition: 'opacity 0.2s', padding: 0
                }}
              >
                ⭐
              </button>
            )}
            
            <div style={{ fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
              {currentCard.asignatura}
            </div>
            
            <div style={{ 
              fontSize: 22, fontWeight: 500, color: '#1e293b', lineHeight: 1.6, 
              flex: 1, display: 'flex', alignItems: 'center' 
            }}>
              {currentCard.texto}
            </div>

            {/* Acciones */}
            <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
              <button 
                onClick={() => handleAction('fail')}
                style={{
                  flex: 1, padding: '16px', background: '#fee2e2', color: '#ef4444', 
                  border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer',
                  transition: 'transform 0.1s', ':active': { transform: 'scale(0.98)' }
                }}
              >
                ❌ Repasar pronto
              </button>
              <button 
                onClick={() => handleAction('doubt')}
                style={{
                  flex: 1, padding: '16px', background: '#ffedd5', color: '#f97316', 
                  border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer'
                }}
              >
                🟠 Dudoso
              </button>
              <button 
                onClick={() => handleAction('pass')}
                style={{
                  flex: 1, padding: '16px', background: '#dcfce7', color: '#22c55e', 
                  border: 'none', borderRadius: 16, fontSize: 15, fontWeight: 700, cursor: 'pointer'
                }}
              >
                ✅ Lo domino
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontSize: 20, color: '#334155', margin: '0 0 8px 0' }}>¡Enhorabuena!</h3>
            <p style={{ margin: 0 }}>Has terminado toda la cola de {selectedSubject || 'todas las asignaturas'}.</p>
          </div>
        )}
      </div>
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
