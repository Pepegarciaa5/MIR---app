/**
 * Archivo: simulacrosMeta.js
 * Descripción: Envoltorio de metadatos para ordenar cronológicamente e identificar los simulacros JSON crudos de CTO.
 * Creado: 2026-08-29
 * Última actualización: 2026-08-29
 */

import rawData from './simulacrosCTO.json'

// Support v1 (flat array) and v2 ({ meta, simulacros[], preguntas[] })
const richSims = Array.isArray(rawData) ? [] : (rawData.simulacros || [])

const percentilesOficiales = {
  1: { p10: 30.67, p25: 42.67, p50: 57.33, p75: 74.67, p90: 94.33 },
  2: { p10: 29.6,  p25: 42.67, p50: 58.67, p75: 76,    p90: 95.67 },
  3: { p10: 29.33, p25: 42.67, p50: 57.33, p75: 76,    p90: 96.33 },
  4: { p10: 40,    p25: 57.67, p50: 75.67, p75: 94,    p90: 113.33 },
  5: { p10: 34.33, p25: 53,    p50: 72.33, p75: 92,    p90: 110.67 },
  6: { p10: 32,    p25: 49.33, p50: 65.33, p75: 84,    p90: 103.27 },
  7: { p10: 37.67, p25: 54,    p50: 70.67, p75: 88,    p90: 105.33 },
  8: { p10: 55.67, p25: 76.33, p50: 97.33, p75: 117.33, p90: 136 },
  9: { p10: 52.33, p25: 70.33, p50: 86.67, p75: 102.67, p90: 118 },
  10: { p10: 43.8,  p25: 64,    p50: 83.67, p75: 104,   p90: 121.33 },
  11: { p10: 55.33, p25: 73.33, p50: 92,    p75: 109.67, p90: 126.67 },
  12: { p10: 55,    p25: 74,    p50: 93.33, p75: 110.92, p90: 126.67 }
};

export const SIMULACROS_FECHAS = {
  1: '2025-09-13',
  2: '2025-10-10',
  3: '2025-11-14',
  4: '2025-12-20',
  5: '2026-02-06',
  6: '2026-03-14',
  7: '2026-04-25',
  8: '2026-05-30',
  9: '2026-06-20',
  10: '2026-07-11',
  11: '2026-08-01',
  12: '2026-08-22',
  13: '2026-09-05',
  14: '2026-09-19',
  15: '2026-09-26',
  16: '2026-10-03',
}

// Default/historical metadata for v1/fallback
const historicalMeta = [
  { numero: 1, fecha: '2025-09-13', neta: 128, percentil_global: 25, cuenta_total: 3894, campo: { p25: 128, p50: 169, p75: 220 } },
  { numero: 2, fecha: '2025-10-10', neta: 160, percentil_global: 43, cuenta_total: 3576, campo: { p25: 127, p50: 171, p75: 220 } },
  { numero: 3, fecha: '2025-11-14', neta: 168, percentil_global: 52, cuenta_total: 2985, campo: { p25: 124, p50: 164, p75: 213 } },
  { numero: 4, fecha: '2025-12-20', neta: 222, percentil_global: 52, cuenta_total: 2857, campo: { p25: 168, p50: 218, p75: 268 } },
  { numero: 5, fecha: '2026-02-06', neta: 206, percentil_global: 45, cuenta_total: 3393, campo: { p25: 157, p50: 214, p75: 269 } },
  { numero: 6, fecha: '2026-03-14', neta: 132, percentil_global: 20, cuenta_total: 3336, campo: { p25: 146, p50: 192, p75: 247 } },
  { numero: 7, fecha: '2026-04-25', neta: 247, percentil_global: 67, cuenta_total: 3277, campo: null }
]

// Build dynamic metadata list
export const simulacrosMeta = richSims.map(s => {
  const hist = historicalMeta.find(h => h.numero === s.numero)
  
  let neta = s.stats?.neta ?? hist?.neta ?? 0
  // Fix CTO returning points instead of netas
  if (s.stats && s.stats.acertadas != null && s.stats.falladas != null) {
    neta = Math.round((s.stats.acertadas - (s.stats.falladas / 3)) * 100) / 100;
  }

  const percentil_global = s.stats?.percentil_total != null 
    ? Math.round(s.stats.percentil_total * 100) 
    : (hist?.percentil_global ?? 0)
  const cuenta_total = s.stats?.cuenta_total ?? hist?.cuenta_total ?? null
  
  const campo = percentilesOficiales[s.numero] || (s.percentiles_campo 
    ? { p25: s.percentiles_campo.p25, p50: s.percentiles_campo.p50, p75: s.percentiles_campo.p75 }
    : (hist?.campo ?? null));

  const fechaFull = SIMULACROS_FECHAS[s.numero] || s.fecha || hist?.fecha || null
  const fecha = fechaFull || `Simulacro ${s.numero}`

  return {
    numero: s.numero,
    fecha,
    fechaFull,
    fechaTimestamp: fechaFull ? new Date(fechaFull).getTime() : 0,
    neta,
    percentil_global,
    cuenta_total,
    campo
  }
})

if (simulacrosMeta.length === 0) {
  simulacrosMeta.push(...historicalMeta.map(h => ({
    ...h,
    fechaFull: SIMULACROS_FECHAS[h.numero] || h.fecha,
    fechaTimestamp: new Date(SIMULACROS_FECHAS[h.numero] || h.fecha).getTime()
  })))
}

// Order chronologically by:
// 1. If we have historical order, respect it.
// 2. Otherwise, order by numero ascending.
// Chronological order for historical: 1, 2, 3, 4, 6, 5, 7
const chronologicalHistorical = [1, 2, 3, 4, 6, 5, 7]

export const simulacrosOrdenCronologico = [...simulacrosMeta]
  .sort((a, b) => {
    const idxA = chronologicalHistorical.indexOf(a.numero)
    const idxB = chronologicalHistorical.indexOf(b.numero)
    
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB
    }
    if (idxA !== -1) return -1
    if (idxB !== -1) return 1
    return a.numero - b.numero
  })
  .map(s => s.numero)

export function getMetaSimulacro(numero) {
  return simulacrosMeta.find(s => s.numero === numero) || null
}
