import { useState, useEffect } from 'react'
import { isAdminMode } from '../lib/supabase'
import { getDiarioPosts, upsertDiarioPost, deleteDiarioPost } from '../lib/db'
import { useTracker } from '../context/TrackerContext'

const ACCENT = '#F26522'

const EMOJI_OPTIONS = ['📖', '🔥', '😤', '💪', '🧠', '😴', '🎉', '📝', '🏥', '☕']

function formatFecha(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function getHorasHoy(entries) {
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
  const todayEntries = entries.filter(e => e.fecha === hoyStr)
  const secs = todayEntries.reduce((s, e) => s + e.duracionSegundos, 0)
  return Math.round((secs / 3600) * 10) / 10
}

function getAsignaturasHoy(entries) {
  const hoy = new Date()
  const hoyStr = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
  const todayEntries = entries.filter(e => e.fecha === hoyStr && e.especialidad)
  return [...new Set(todayEntries.map(e => e.especialidad))]
}

export default function Diario() {
  const { entries } = useTracker()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  // Editor state (admin only)
  const [showEditor, setShowEditor] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [contenido, setContenido] = useState('')
  const [emoji, setEmoji] = useState('📖')
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    getDiarioPosts().then(data => { setPosts(data); setLoading(false) })
  }, [])

  const horasHoy = getHorasHoy(entries)
  const asignaturasHoy = getAsignaturasHoy(entries)

  const publicar = async () => {
    if (!titulo.trim() || !contenido.trim()) return
    const hoy = new Date()
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}-${String(hoy.getDate()).padStart(2,'0')}`
    const post = {
      id: Date.now(),
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      emoji,
      horasEstudiadas: horasHoy,
      asignaturas: asignaturasHoy,
      fecha,
    }
    await upsertDiarioPost(post)
    setPosts(prev => [{ ...post, createdAt: new Date().toISOString() }, ...prev])
    setTitulo('')
    setContenido('')
    setEmoji('📖')
    setShowEditor(false)
  }

  const eliminar = async (id) => {
    await deleteDiarioPost(id)
    setPosts(prev => prev.filter(p => p.id !== id))
    setConfirmDelete(null)
  }

  return (
    <div style={{ padding: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px' }}>
            {isAdminMode ? '📓 Mi Diario MIR' : '📓 Diario de preparación MIR'}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
            {isAdminMode ? 'Escribe tus reflexiones del día' : 'Seguimiento público de mi preparación'}
          </p>
        </div>
        {isAdminMode && !showEditor && (
          <button
            onClick={() => setShowEditor(true)}
            style={{ background: ACCENT, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(242,101,34,0.3)' }}>
            + Nuevo post
          </button>
        )}
      </div>

      {/* Editor (admin only) */}
      {isAdminMode && showEditor && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 16, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                style={{ fontSize: 22, padding: '4px 8px', borderRadius: 8, border: emoji === e ? `2px solid ${ACCENT}` : '2px solid transparent', background: emoji === e ? '#fff' : 'transparent', cursor: 'pointer' }}>
                {e}
              </button>
            ))}
          </div>

          <input
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            placeholder="Título del post..."
            style={{ width: '100%', padding: '10px 14px', fontSize: 16, fontWeight: 700, borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none', marginBottom: 12, boxSizing: 'border-box' }}
          />
          <textarea
            value={contenido}
            onChange={e => setContenido(e.target.value)}
            placeholder="¿Cómo ha ido el día? ¿Qué has aprendido? ¿Cómo te sientes?"
            rows={6}
            style={{ width: '100%', padding: '10px 14px', fontSize: 14, borderRadius: 10, border: '1px solid #e2e8f0', outline: 'none', resize: 'vertical', lineHeight: 1.6, fontFamily: 'inherit', marginBottom: 12, boxSizing: 'border-box' }}
          />

          {/* Auto-filled metrics */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ background: '#fff', padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              ⏱ <strong>{horasHoy}h</strong> estudiadas hoy
            </div>
            {asignaturasHoy.length > 0 && (
              <div style={{ background: '#fff', padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                📚 {asignaturasHoy.join(', ')}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowEditor(false)}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 8, background: '#f1f5f9', color: '#64748b', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={publicar}
              style={{ padding: '8px 20px', border: 'none', borderRadius: 8, background: ACCENT, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: (!titulo.trim() || !contenido.trim()) ? 0.5 : 1 }}>
              Publicar
            </button>
          </div>
        </div>
      )}

      {/* Posts list */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>Cargando...</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: '#f8fafc', borderRadius: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📓</div>
          <div style={{ fontSize: 15, color: '#94a3b8', fontWeight: 500 }}>
            {isAdminMode ? 'Aún no has escrito ningún post. ¡Empieza tu diario!' : 'Todavía no hay entradas en el diario.'}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, padding: '20px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
                    {post.emoji} {post.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    {formatFecha(post.fecha)}
                  </div>
                </div>
                {isAdminMode && (
                  <div style={{ display: 'flex', gap: 4 }}>
                    {confirmDelete === post.id ? (
                      <>
                        <button onClick={() => eliminar(post.id)} style={{ padding: '4px 10px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Eliminar</button>
                        <button onClick={() => setConfirmDelete(null)} style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => setConfirmDelete(post.id)} style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}>🗑️</button>
                    )}
                  </div>
                )}
              </div>

              <p style={{ margin: '0 0 12px', fontSize: 14, color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {post.contenido}
              </p>

              {/* Metrics badges */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {post.horasEstudiadas > 0 && (
                  <span style={{ background: '#f0fdf4', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    ⏱ {post.horasEstudiadas}h estudiadas
                  </span>
                )}
                {post.asignaturas.map(a => (
                  <span key={a} style={{ background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
