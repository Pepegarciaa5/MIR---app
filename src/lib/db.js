/**
 * db.js — Capa de persistencia Supabase
 * Reemplaza localStorage para todos los datos personales del usuario.
 * Los datos del calendario CTO siguen siendo estáticos (planificacionCTO.json).
 */
import { supabase } from './supabase'

// ─── TRACKER ENTRIES ────────────────────────────────────────────────────────

export async function getTrackerEntries() {
  const { data, error } = await supabase
    .from('tracker_entries')
    .select('*')
    .order('inicio', { ascending: false })
  if (error) { console.error('getTrackerEntries:', error); return [] }
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
}

export async function upsertTrackerEntry(entry) {
  const { error } = await supabase.from('tracker_entries').upsert({
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
  })
  if (error) console.error('upsertTrackerEntry:', error)
}

export async function deleteTrackerEntry(id) {
  const { error } = await supabase.from('tracker_entries').delete().eq('id', String(id))
  if (error) console.error('deleteTrackerEntry:', error)
}

// ─── REPASOS ────────────────────────────────────────────────────────────────

export async function getRepasos() {
  const { data, error } = await supabase
    .from('repasos')
    .select('*')
    .order('fecha_proximo_repaso', { ascending: true })
  if (error) { console.error('getRepasos:', error); return [] }
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
}

export async function upsertRepaso(repaso) {
  const { error } = await supabase.from('repasos').upsert({
    id: repaso.id,
    titulo: repaso.titulo,
    especialidad: repaso.especialidad,
    tema: repaso.tema,
    destino_guardado: repaso.destinoGuardado,
    minutos_repaso: repaso.minutosRepaso,
    fase: repaso.fase,
    fecha_proximo_repaso: repaso.fechaProximoRepaso,
    confianza: repaso.confianza,
  })
  if (error) console.error('upsertRepaso:', error)
}

export async function deleteRepaso(id) {
  const { error } = await supabase.from('repasos').delete().eq('id', id)
  if (error) console.error('deleteRepaso:', error)
}

// ─── BLOQUES COMPLETADOS ─────────────────────────────────────────────────────

export async function getBloquesCompletados() {
  const { data, error } = await supabase.from('bloques_completados').select('id')
  if (error) { console.error('getBloquesCompletados:', error); return [] }
  return data.map(r => r.id)
}

export async function addBloqueCompletado(id) {
  const { error } = await supabase.from('bloques_completados').upsert({ id: String(id) })
  if (error) console.error('addBloqueCompletado:', error)
}

// ─── BLOQUES DESCARTADOS ─────────────────────────────────────────────────────

export async function getBloquesDescartados() {
  const { data, error } = await supabase.from('bloques_descartados').select('id')
  if (error) { console.error('getBloquesDescartados:', error); return [] }
  return data.map(r => r.id)
}

export async function addBloqueDescartado(id) {
  const { error } = await supabase.from('bloques_descartados').upsert({ id: String(id) })
  if (error) console.error('addBloqueDescartado:', error)
}

// ─── PLANES ADICIONALES ──────────────────────────────────────────────────────

export async function getPlanesAdicionales() {
  const { data, error } = await supabase.from('planes_adicionales').select('*')
  if (error) { console.error('getPlanesAdicionales:', error); return {} }
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
}

export async function addPlanAdicional(fecha, bloque) {
  const { error } = await supabase.from('planes_adicionales').upsert({
    id: String(bloque.id),
    fecha,
    inicio: bloque.inicio,
    fin: bloque.fin,
    titulo: bloque.titulo,
    especialidad: bloque.especialidad || null,
    tema: bloque.tema || null,
  })
  if (error) console.error('addPlanAdicional:', error)
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
