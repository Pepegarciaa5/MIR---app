/**
 * Archivo: db.js
 * Descripción: Capa de abstracción (wrapper) sobre Supabase para realizar operaciones de base de datos (CRUD) en el diario y repasos.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-08
 */

/**
 * db.js — Capa de persistencia Supabase
 * Reemplaza localStorage para todos los datos personales del usuario.
 * Los datos del calendario CTO siguen siendo estáticos (planificacionCTO.json).
 */
import { supabase } from './supabase'

// ─── TRACKER ENTRIES ────────────────────────────────────────────────────────

export async function getTrackerEntries() {
  try {
    const { data, error } = await supabase
      .from('tracker_entries')
      .select('*')
      .order('inicio', { ascending: false })
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    // Normalize field names (snake_case → camelCase)
    return data.map(e => ({
      id: e.id,
      descripcion: e.descripcion,
      especialidad: e.especialidad,
      tema: e.tema,
      bloqueId: e.bloque_id,
      repasoId: e.repaso_id,
      inicio: e.inicio,
      fin: e.fin,
      duracionSegundos: e.duracion_segundos,
      fecha: e.fecha,
    }))
  } catch {
    return []
  }
}

export async function upsertTrackerEntry(entry) {
  try {
    await supabase.from('tracker_entries').upsert({
      id: String(entry.id),
      descripcion: entry.descripcion,
      especialidad: entry.especialidad,
      tema: entry.tema,
      bloque_id: entry.bloqueId || null,
      repaso_id: entry.repasoId || null,
      inicio: entry.inicio,
      fin: entry.fin,
      duracion_segundos: entry.duracionSegundos,
      fecha: entry.fecha,
    }).catch?.(() => {})
  } catch {}
}

export async function deleteTrackerEntry(id) {
  try {
    await supabase.from('tracker_entries').delete().eq('id', String(id)).catch?.(() => {})
  } catch {}
}

// ─── REPASOS ────────────────────────────────────────────────────────────────

export async function getRepasos() {
  try {
    const { data, error } = await supabase
      .from('repasos')
      .select('*')
      .order('fecha_proximo_repaso', { ascending: true })
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    return data.map(r => ({
      id: r.id,
      titulo: r.titulo,
      especialidad: r.especialidad,
      tema: r.tema,
      destinoGuardado: r.destino_guardado,
      minutosRepaso: r.minutos_repaso,
      fase: r.fase,
      fechaProximoRepaso: r.fecha_proximo_repaso,
      confianza: r.confianza,
    }))
  } catch {
    return []
  }
}

export async function upsertRepaso(repaso) {
  try {
    await supabase.from('repasos').upsert({
      id: repaso.id,
      titulo: repaso.titulo,
      especialidad: repaso.especialidad,
      tema: repaso.tema,
      destino_guardado: repaso.destinoGuardado,
      minutos_repaso: repaso.minutosRepaso,
      fase: repaso.fase,
      fecha_proximo_repaso: repaso.fechaProximoRepaso,
      confianza: repaso.confianza,
    }).catch?.(() => {})
  } catch {}
}

export async function deleteRepaso(id) {
  try {
    await supabase.from('repasos').delete().eq('id', id).catch?.(() => {})
  } catch {}
}

// ─── BLOQUES COMPLETADOS ─────────────────────────────────────────────────────

export async function getBloquesCompletados() {
  try {
    const { data, error } = await supabase.from('bloques_completados').select('id')
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    return data.map(r => r.id)
  } catch {
    return []
  }
}

export async function addBloqueCompletado(id) {
  try {
    await supabase.from('bloques_completados').upsert({ id: String(id) }).catch?.(() => {})
  } catch {}
}

// ─── BLOQUES DESCARTADOS ─────────────────────────────────────────────────────

export async function getBloquesDescartados() {
  try {
    const { data, error } = await supabase.from('bloques_descartados').select('id')
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    return data.map(r => r.id)
  } catch {
    return []
  }
}

export async function addBloqueDescartado(id) {
  try {
    await supabase.from('bloques_descartados').upsert({ id: String(id) }).catch?.(() => {})
  } catch {}
}

// ─── PLANES ADICIONALES ──────────────────────────────────────────────────────

export async function getPlanesAdicionales() {
  try {
    const { data, error } = await supabase.from('planes_adicionales').select('*')
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return {}
    // Rebuild the { 'YYYY-MM-DD': [...] } structure
    const result = {}
    for (const row of data) {
      if (!result[row.fecha]) result[row.fecha] = []
      result[row.fecha].push({
        id: row.id,
        inicio: row.inicio,
        fin: row.fin,
        titulo: row.titulo,
        especialidad: row.especialidad,
        tema: row.tema,
      })
    }
    return result
  } catch {
    return {}
  }
}

export async function addPlanAdicional(fecha, bloque) {
  try {
    await supabase.from('planes_adicionales').upsert({
      id: String(bloque.id),
      fecha,
      inicio: bloque.inicio,
      fin: bloque.fin,
      titulo: bloque.titulo,
      especialidad: bloque.especialidad || null,
      tema: bloque.tema || null,
    }).catch?.(() => {})
  } catch {}
}

// ─── MIGRACIÓN DESDE localStorage ───────────────────────────────────────────
// Ejecutar una sola vez para mover datos existentes a Supabase

export async function migrarDesdeLocalStorage() {
  const results = { entries: 0, repasos: 0, completados: 0, descartados: 0, adicionales: 0 }

  // Tracker entries
  const savedEntries = localStorage.getItem('trackerEntries')
  if (savedEntries) {
    const entries = JSON.parse(savedEntries)
    for (const e of entries) {
      await upsertTrackerEntry(e)
      results.entries++
    }
  }

  // Repasos
  const savedRepasos = localStorage.getItem('repasosData')
  if (savedRepasos) {
    const repasos = JSON.parse(savedRepasos)
    for (const r of repasos) {
      await upsertRepaso(r)
      results.repasos++
    }
  }

  // Bloques completados
  const savedCompletados = localStorage.getItem('bloquesCompletados')
  if (savedCompletados) {
    const ids = JSON.parse(savedCompletados)
    for (const id of ids) {
      await addBloqueCompletado(id)
      results.completados++
    }
  }

  // Bloques descartados
  const savedDescartados = localStorage.getItem('bloquesDescartados')
  if (savedDescartados) {
    const ids = JSON.parse(savedDescartados)
    for (const id of ids) {
      await addBloqueDescartado(id)
      results.descartados++
    }
  }

  // Planes adicionales
  const savedAdicionales = localStorage.getItem('planesAdicionales')
  if (savedAdicionales) {
    const planes = JSON.parse(savedAdicionales)
    for (const [fecha, bloques] of Object.entries(planes)) {
      for (const b of bloques) {
        await addPlanAdicional(fecha, b)
        results.adicionales++
      }
    }
  }

  console.log('✅ Migración completada:', results)
  return results
}

// ─── COMENTARIOS ─────────────────────────────────────────────────────────────

export async function getComentarios() {
  try {
    const { data, error } = await supabase
      .from('comentarios')
      .select('*')
      .order('created_at', { ascending: true })
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    return data.map(c => ({
      id: c.id,
      autor: c.autor,
      texto: c.texto,
      tipo: c.tipo,         // 'foro' | 'timeline'
      refId: c.ref_id,     // null para foro, id de entry/post para timeline
      createdAt: new Date(c.created_at).getTime(),
    }))
  } catch {
    return []
  }
}

export async function addComentario({ autor, texto, tipo = 'foro', refId = null }) {
  try {
    const { data, error } = await supabase.from('comentarios').insert({
      autor: autor.trim(),
      texto: texto.trim(),
      tipo,
      ref_id: refId ? String(refId) : null,
    }).select().single().catch?.(() => ({ data: null, error: null })) || {}
    if (error || !data) return null
    return {
      id: data.id,
      autor: data.autor,
      texto: data.texto,
      tipo: data.tipo,
      refId: data.ref_id,
      createdAt: new Date(data.created_at).getTime(),
    }
  } catch {
    return null
  }
}

export async function deleteComentario(id) {
  try {
    await supabase.from('comentarios').delete().eq('id', id).catch?.(() => {})
  } catch {}
}

// ─── DIARIO / BLOG POSTS ─────────────────────────────────────────────────────

export async function getDiarioPosts() {
  try {
    const { data, error } = await supabase
      .from('diario_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .catch?.(() => ({ data: [], error: null })) || {}
    if (error || !data || !Array.isArray(data)) return []
    return data.map(p => ({
      id: p.id,
      titulo: p.titulo,
      contenido: p.contenido,
      emoji: p.emoji,
      horasEstudiadas: p.horas_estudiadas,
      asignaturas: p.asignaturas || [],
      fecha: p.fecha,
      createdAt: p.created_at,
    }))
  } catch {
    return []
  }
}

export async function upsertDiarioPost(post) {
  try {
    await supabase.from('diario_posts').upsert({
      id: post.id,
      titulo: post.titulo,
      contenido: post.contenido,
      emoji: post.emoji || '📖',
      horas_estudiadas: post.horasEstudiadas || 0,
      asignaturas: post.asignaturas || [],
      fecha: post.fecha,
    }).catch?.(() => {})
  } catch {}
}

export async function deleteDiarioPost(id) {
  try {
    await supabase.from('diario_posts').delete().eq('id', id).catch?.(() => {})
  } catch {}
}

