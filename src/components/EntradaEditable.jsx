import { useState } from 'react'
import { useTracker } from '../context/TrackerContext'
import { especialidadesMIR, especialidadNombres, getEspecialidadColor } from '../data/especialidadesMIR'
import { repasosData } from '../data/mockData'
import { upsertRepaso } from '../lib/db'

const ACCENT = '#F26522'

function toTimeStr(ts) {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function applyTime(ts, timeStr) {
  const d = new Date(ts)
  const [h, m] = timeStr.split(':').map(Number)
  d.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0)
  return d.getTime()
}

function durStr(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${s}s` : `${s}s`
}

const CONFIANZA_OPTS = [
  { id: 1, label: 'Flojo',   color: '#ef4444', bg: '#fef2f2' },
  { id: 2, label: 'Regular', color: '#f59e0b', bg: '#fffbeb' },
  { id: 3, label: 'Bien',    color: '#22c55e', bg: '#f0fdf4' },
]

export default function EntradaEditable({ entry: e }) {
  const { editEntry, deleteEntry } = useTracker()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editDesc, setEditDesc] = useState('')
  const [editEsp, setEditEsp] = useState('')
  const [editTema, setEditTema] = useState('')
  const [editInicio, setEditInicio] = useState('')
  const [editFin, setEditFin] = useState('')
  // Enviar a repasos
  const [sendingRepaso, setSendingRepaso] = useState(false)
  const [repasoTitulo, setRepasoTitulo] = useState('')
  const [repasoDestino, setRepasoDestino] = useState('')
  const [repasoConfianza, setRepasoConfianza] = useState(2)
  const [repasoEnviado, setRepasoEnviado] = useState(false)

  function abrirRepaso() {
    setRepasoTitulo(e.descripcion)
    setSendingRepaso(true)
    setEditing(false)
    setConfirmDelete(false)
  }

  function enviarARepasos() {
    const todayMs = new Date().setHours(0, 0, 0, 0)
    const durH = (e.duracionSegundos || 0) / 3600
    const minutosRepaso = Math.max(1, Math.round(durH * 8))
    const newRepaso = {
      id: Date.now(),
      titulo: repasoTitulo.trim() || e.descripcion,
      especialidad: e.especialidad || 'Sin asignar',
      tema: e.tema || null,
      destinoGuardado: repasoDestino.trim() || null,
      minutosRepaso,
      fase: 0,
      fechaProximoRepaso: todayMs,
      confianza: repasoConfianza,
    }
    repasosData.unshift(newRepaso)
    upsertRepaso(newRepaso)
    setSendingRepaso(false)
    setRepasoTitulo('')
    setRepasoDestino('')
    setRepasoConfianza(2)
    setRepasoEnviado(true)
  }

  function openEdit() {
    setEditDesc(e.descripcion)
    setEditEsp(e.especialidad || '')
    setEditTema(e.tema || '')
    setEditInicio(toTimeStr(e.inicio))
    setEditFin(toTimeStr(e.fin))
    setEditing(true)
  }

  function saveEdit() {
    const newInicio = applyTime(e.inicio, editInicio)
    const newFin = applyTime(e.fin, editFin)
    editEntry(e.id, {
      descripcion: editDesc.trim() || e.descripcion,
      especialidad: editEsp || null,
      tema: editTema || null,
      inicio: newInicio,
      fin: newFin,
    })
    setEditing(false)
  }

  const d = new Date(e.inicio)
  const hora = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  const editTemas = editEsp ? (especialidadesMIR[editEsp]?.temas || []) : []

  const previewDurSecs = (() => {
    if (!editing) return null
    const ini = applyTime(e.inicio, editInicio)
    const fin = applyTime(e.fin, editFin)
    return Math.max(0, Math.floor((fin - ini) / 1000))
  })()

  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
      {/* Row principal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.descripcion}</div>
          {e.especialidad && (() => {
            const c = getEspecialidadColor(e.especialidad)
            return <span style={{ fontSize: 11, fontWeight: 600, color: c.text, background: c.bg, border: `1px solid ${c.border}`, padding: '1px 7px', borderRadius: 10, marginTop: 3, display: 'inline-block' }}>{e.especialidad}{e.tema ? ` · ${e.tema}` : ''}</span>
          })()}
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: ACCENT }}>{durStr(e.duracionSegundos)}</div>
          <div style={{ fontSize: 10, color: '#bbb' }}>{e.fecha} {hora}</div>
        </div>
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {repasoEnviado ? (
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, padding: '4px 6px' }}>📚 ✓</span>
          ) : (
            <button
              onClick={() => sendingRepaso ? setSendingRepaso(false) : abrirRepaso()}
              title="Enviar a Repasos"
              style={{ background: sendingRepaso ? '#dcfce7' : '#f0fdf4', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: '#16a34a' }}>
              📚
            </button>
          )}
          <button
            onClick={() => { if (editing) setEditing(false); else { openEdit(); setSendingRepaso(false) } }}
            title="Editar"
            style={{ background: editing ? '#e0e7ff' : '#f0f0f0', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: editing ? '#4f46e5' : '#666' }}>
            ✏️
          </button>
          <button
            onClick={() => { setConfirmDelete(true); setEditing(false); setSendingRepaso(false) }}
            title="Eliminar"
            style={{ background: '#fef2f2', border: 'none', borderRadius: 6, padding: '4px 7px', fontSize: 13, cursor: 'pointer', color: '#ef4444' }}>
            🗑️
          </button>
        </div>
      </div>

      {/* Confirm delete */}
      {confirmDelete && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, padding: '8px 12px', background: '#fef2f2', borderRadius: 10, border: '1px solid #fecaca' }}>
          <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600, flex: 1 }}>¿Eliminar esta entrada?</span>
          <button onClick={() => { deleteEntry(e.id); setConfirmDelete(false) }}
            style={{ padding: '4px 12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
            Eliminar
          </button>
          <button onClick={() => setConfirmDelete(false)}
            style={{ padding: '4px 8px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      )}

      {/* Panel enviar a repasos */}
      {sendingRepaso && (
        <div style={{ marginTop: 10, padding: '12px 14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #86efac', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>Enviar a Repasos</div>
          <input
            value={repasoTitulo} onChange={ev => setRepasoTitulo(ev.target.value)}
            placeholder="Título del repaso"
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 13, fontWeight: 600 }}
          />
          <input
            value={repasoDestino} onChange={ev => setRepasoDestino(ev.target.value)}
            placeholder="¿Dónde está guardado el material? (Notion, Anki...)"
            style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #86efac', fontSize: 12 }}
          />
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginBottom: 6 }}>Nivel de dominio</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {CONFIANZA_OPTS.map(opt => (
                <button key={opt.id} onClick={() => setRepasoConfianza(opt.id)}
                  style={{ flex: 1, padding: '6px 0', border: repasoConfianza === opt.id ? `2px solid ${opt.color}` : '2px solid transparent', borderRadius: 8, background: opt.bg, color: opt.color, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setSendingRepaso(false)}
              style={{ padding: '6px 12px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={enviarARepasos}
              style={{ padding: '6px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Añadir a Repasos
            </button>
          </div>
        </div>
      )}

      {/* Editor inline */}
      {editing && (
        <div style={{ marginTop: 10, padding: '14px', background: '#eff6ff', borderRadius: 12, border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Nombre */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Nombre</label>
            <input
              value={editDesc}
              onChange={ev => setEditDesc(ev.target.value)}
              style={{ width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600, boxSizing: 'border-box' }}
            />
          </div>

          {/* Asignatura + Tema */}
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Asignatura</label>
              <select
                value={editEsp}
                onChange={ev => { setEditEsp(ev.target.value); setEditTema('') }}
                style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, background: '#fff', color: editEsp ? '#374151' : '#9ca3af' }}>
                <option value="">— Ninguna —</option>
                {especialidadNombres.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="_libre">Actividad libre</option>
                <option value="_pausa">Pausa</option>
              </select>
            </div>
            {editEsp && editTemas.length > 0 && (
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Tema</label>
                <select
                  value={editTema}
                  onChange={ev => setEditTema(ev.target.value)}
                  style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 12, background: '#fff', color: editTema ? '#374151' : '#9ca3af' }}>
                  <option value="">— Ninguno —</option>
                  {editTemas.map((t, i) => <option key={i} value={t}>{t}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Inicio / Fin */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Inicio</label>
              <input type="time" value={editInicio} onChange={ev => setEditInicio(ev.target.value)}
                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', display: 'block', marginBottom: 4 }}>Fin</label>
              <input type="time" value={editFin} onChange={ev => setEditFin(ev.target.value)}
                style={{ padding: '6px 8px', borderRadius: 8, border: '1px solid #bfdbfe', fontSize: 13, fontWeight: 600 }} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', paddingBottom: 8 }}>
              {previewDurSecs !== null && durStr(previewDurSecs)}
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)}
              style={{ padding: '6px 14px', background: 'none', border: 'none', color: '#94a3b8', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
              Cancelar
            </button>
            <button onClick={saveEdit}
              style={{ padding: '6px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
