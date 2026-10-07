/**
 * Archivo: simulacros.js
 * Descripción: Lógica central de análisis. Fusiona textos y estadísticas de simulacros, calcula percentiles, prioridades y fallos graves.
 * Creado: 2026-08-29
 * Última actualización: 2026-08-29
 */

/**
 * simulacros.js — Utilidades para analizar datos de simulacros CTO
 *
 * Datos exportados con extractor_simulacros_cto.js (consola del navegador en campus-app.grupocto.com)
 * Fuente: src/data/simulacrosCTO.json — 6 simulacros, 1260 preguntas (210 por simulacro)
 *
 * Formato de cada pregunta:
 *   simulacro, pregunta_id, numero, asignatura (código 2 letras), clasificaciones,
 *   dificultad (1=fácil→5=difícil), acertada/fallada/nula (0/1), neta (+3/-1/0),
 *   tiempo (segundos), dudas (0/1), respuesta_dada, respuesta_correcta, ignorar,
 *   pct_misma_respuesta, pct_correcta (cuenta de alumnos que eligieron esa opción)
 */

import rawData from '../data/simulacrosCTO.json'
import { simulacrosMeta, simulacrosOrdenCronologico } from '../data/simulacrosMeta'
import textosSimulacros from '../data/simulacros_textos.json'

// Construir un mapa rápido de textos: "simulacro-numero" -> datos de texto
const mapaTextos = new Map()
if (Array.isArray(textosSimulacros)) {
  textosSimulacros.forEach(t => {
    mapaTextos.set(`${t.simulacro}-${t.numero_pregunta || t.numero}`, t)
  })
}

/**
 * Adjunta el texto (enunciado, respuestas, comentario) a una pregunta dada.
 */
export function attachTextoToPregunta(p) {
  const textInfo = mapaTextos.get(`${p.simulacro}-${p.numero}`)
  return {
    ...p,
    texto: textInfo || null
  }
}


// Support v1 (flat array) and v2 ({ meta, simulacros[], preguntas[] })
const preguntas       = Array.isArray(rawData) ? rawData : rawData.preguntas
const _simulacrosRich = Array.isArray(rawData) ? null    : (rawData.simulacros || null)

/**
 * Datos enriquecidos por simulacro del extractor v2.
 * Disponible solo cuando simulacrosCTO.json tiene formato v2.
 * Cada objeto: { numero, nombre, fecha, stats, percentiles_campo, por_asignatura, por_tema }
 * Devuelve null si el JSON es v1 (array plano).
 */
export function getSimulacrosRich() { return _simulacrosRich }

// ─── Mapa de códigos CTO → nombre de especialidad (igual que en especialidadesMIR.js) ─────────
export const ASIGNATURA_NOMBRE = {
  AL: 'Alergología',
  AN: 'Anestesiología',
  AP: 'Anatomía Patológica',
  AT: 'Anatomía',
  BL: 'Bioética y Medicina Legal',
  BQ: 'Bioquímica',
  CD: 'Cardiología',
  CG: 'Cirugía General',
  DG: 'Digestivo',
  DM: 'Dermatología',
  ED: 'Endocrinología y Metabolismo',
  EP: 'Estadística y Epidemiología',
  FC: 'Medicina Familiar y Comunitaria',
  FM: 'Farmacología',
  FS: 'Fisiología',
  GC: 'Ginecología y Obstetricia',
  GR: 'Geriatría',
  GT: 'Genética',
  HM: 'Hematología',
  IF: 'Infecciosas',
  IG: 'Inmunología',
  NF: 'Nefrología',
  NM: 'Neumología',
  NR: 'Neurología y Neurocirugía',
  OF: 'Oftalmología',
  ON: 'Oncología',
  OR: 'Otorrinolaringología',
  PD: 'Pediatría',
  PQ: 'Psiquiatría',
  RH: 'Reumatología',
  RM: 'Radiodiagnóstico',
  RX: 'Radiología',
  TM: 'Traumatología',
  UG: 'Urgencias',
  UR: 'Urología',
}

// ─── Acceso a datos crudos ───────────────────────────────────────────────────

/** Todas las preguntas (array completo) */
export function getPreguntas() { return preguntas }

/** Preguntas de un simulacro concreto (1-6) */
export function getPreguntasSimulacro(num) {
  return preguntas.filter(p => p.simulacro === num)
}

/** Preguntas de una asignatura (código CTO, e.g. 'CD') */
export function getPreguntasByAsignatura(codigo) {
  return preguntas.filter(p => p.asignatura === codigo)
}

// ─── Estadísticas globales ───────────────────────────────────────────────────

/**
 * Devuelve stats globales sobre todos los simulacros.
 * Excluye preguntas con ignorar=true.
 */
export function getStatsGlobales() {
  const validas = preguntas.filter(p => !p.ignorar)
  return calcStats(validas)
}

/**
 * Stats por simulacro. Devuelve array ordenado:
 * [{ simulacro, preguntas, acertadas, falladas, nulas, neta, pctAcierto }, ...]
 */
export function getStatsPorSimulacro() {
  const nums = [...new Set(preguntas.map(p => p.simulacro))].sort((a, b) => a - b)
  return nums.map(num => {
    const ps = preguntas.filter(p => p.simulacro === num)
    const validas = ps.filter(p => !p.ignorar)
    return { simulacro: num, ...calcStats(validas), total: ps.length }
  })
}

/**
 * Stats por asignatura (código CTO). Devuelve array ordenado por pctAcierto desc.
 * [{ codigo, nombre, preguntas, acertadas, falladas, nulas, neta, pctAcierto }, ...]
 */
export function getStatsPorAsignatura() {
  const codigos = [...new Set(preguntas.map(p => p.asignatura))].sort()
  return codigos
    .map(codigo => {
      const ps = preguntas.filter(p => p.asignatura === codigo && !p.ignorar)
      return {
        codigo,
        nombre: ASIGNATURA_NOMBRE[codigo] || codigo,
        ...calcStats(ps),
      }
    })
    .sort((a, b) => b.pctAcierto - a.pctAcierto)
}

/**
 * Stats por dificultad (1-5). Devuelve objeto indexado por nivel.
 */
export function getStatsPorDificultad() {
  const result = {}
  for (let d = 1; d <= 5; d++) {
    const ps = preguntas.filter(p => p.dificultad === d && !p.ignorar)
    result[d] = { nivel: d, ...calcStats(ps) }
  }
  return result
}

/**
 * Stats por simulacro y asignatura combinados.
 * Devuelve { [codigoAsignatura]: [{ simulacro, preguntas, acertadas, pctAcierto }, ...] }
 * ordenado por número de simulacro.
 */
export function getStatsPorSimulacroYAsignatura() {
  const nums = [...new Set(preguntas.map(p => p.simulacro))].sort((a, b) => a - b)
  const codigos = [...new Set(preguntas.map(p => p.asignatura))].sort()
  const result = {}
  for (const codigo of codigos) {
    result[codigo] = nums.map(num => {
      const ps = preguntas.filter(p => p.simulacro === num && p.asignatura === codigo && !p.ignorar)
      return { simulacro: num, ...calcStats(ps) }
    })
  }
  return result
}

/**
 * Preguntas marcadas como duda (dudas=1), ordenadas por simulacro y número.
 */
export function getPreguntasConDuda() {
  return preguntas.filter(p => p.dudas === 1).sort((a, b) =>
    a.simulacro !== b.simulacro ? a.simulacro - b.simulacro : a.numero - b.numero
  )
}

// ─── Helper interno ──────────────────────────────────────────────────────────

function calcStats(ps) {
  const n = ps.length
  if (n === 0) return { preguntas: 0, acertadas: 0, falladas: 0, nulas: 0, neta: 0, pctAcierto: 0 }
  const acertadas = ps.filter(p => p.acertada).length
  const falladas  = ps.filter(p => p.fallada).length
  const nulas     = ps.filter(p => p.nula).length
  const neta      = ps.reduce((s, p) => s + p.neta, 0)
  return {
    preguntas: n,
    acertadas,
    falladas,
    nulas,
    neta,
    pctAcierto: Math.round((acertadas / n) * 1000) / 10,
  }
}

// ─── Diagnóstico Evolutivo (Analytics Avanzado) ──────────────────────────────

/**
 * Devuelve el ranking de prioridades de estudio compensado por recencia y gravedad.
 */
export function getPrioridadesEstudio() {
  const recentSims = simulacrosOrdenCronologico.slice(-4)
  const statsPorAsig = {}

  preguntas.forEach(p => {
    if (p.ignorar) return
    if (!recentSims.includes(p.simulacro)) return

    const asig = p.asignatura
    if (!statsPorAsig[asig]) {
      statsPorAsig[asig] = { codigo: asig, nombre: ASIGNATURA_NOMBRE[asig] || asig, total: 0, falladas: 0, gravedad_total: 0, cuenta_preguntas_mir: 0 }
    }

    statsPorAsig[asig].total++
    statsPorAsig[asig].cuenta_preguntas_mir = statsPorAsig[asig].total / recentSims.length

    if (p.fallada) {
      statsPorAsig[asig].falladas++
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_field = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : 0.5
      const dif = p.dificultad || 3
      const gravedad = pct_field * (6 - dif)
      statsPorAsig[asig].gravedad_total += gravedad
    }
  })

  return Object.values(statsPorAsig).map(s => {
    const acierto = (s.total - s.falladas) / s.total
    const score = s.cuenta_preguntas_mir * (1 - acierto) * (1 + s.gravedad_total)
    return { ...s, acierto, score }
  }).sort((a, b) => b.score - a.score)
}

/**
 * Devuelve los fallos más graves recientes (mayor índice de gravedad).
 */
export function getFallosGraves(limit = 15) {
  const recentSims = simulacrosOrdenCronologico.slice(-4)
  
  return preguntas
    .filter(p => !p.ignorar && p.fallada && recentSims.includes(p.simulacro))
    .map(p => {
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_field = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : 0
      const dif = p.dificultad || 3
      const gravedad = pct_field * (6 - dif)
      return { 
        ...p,
        nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
        pct_field_correct: pct_field,
        gravedad 
      }
    })
    .sort((a, b) => b.gravedad - a.gravedad)
    .slice(0, limit)
}

/**
 * Devuelve la evolución del rendimiento cruzado con la dificultad media del examen.
 */
export function getAnalisisDificultad() {
  return simulacrosOrdenCronologico.map(num => {
    const ps = preguntas.filter(p => p.simulacro === num && !p.ignorar)
    const validasDif = ps.filter(p => p.dificultad > 0)
    const difMedia = validasDif.reduce((s, p) => s + p.dificultad, 0) / (validasDif.length || 1)
    const meta = simulacrosMeta.find(m => m.numero === num)
    const netaReal = meta?.neta || 0
    const difRounded = Math.round(difMedia * 100) / 100
    const netaAjustada = Math.round(netaReal * (difRounded / 3.0) * 10) / 10

    return {
      simulacro: num,
      fecha: meta?.fecha || `Simulacro ${num}`,
      fechaFull: meta?.fechaFull || meta?.fecha,
      fechaTimestamp: meta?.fechaTimestamp || (meta?.fechaFull ? new Date(meta.fechaFull).getTime() : 0),
      neta: netaReal,
      netaAjustada: netaAjustada,
      aciertos: ps.filter(p => p.acertada).length,
      dificultadMedia: difRounded,
      p50: meta?.campo?.p50 || null
    }
  })
}

/**
 * Devuelve la tipología de errores (Despiste, Duda Fatal, Bloqueo, Desconocimiento)
 */
export function getAnalisisTiposError() {
  const recentSims = simulacrosOrdenCronologico.slice(-4)
  const stats = { desconocimiento: 0, dudaFatal: 0, despiste: 0, bloqueo: 0 }
  
  preguntas.forEach(p => {
    if (p.ignorar || !p.fallada || !recentSims.includes(p.simulacro)) return
    
    // Ignorar si no hay datos fiables de tiempo/dudas (ej. examen en papel)
    if (p.tiempo === 0 && p.dudas === 0) return 
    
    if (p.dudas === 1) {
      stats.dudaFatal++
    } else if (p.tiempo > 0 && p.tiempo < 30 && p.dificultad <= 2) {
      stats.despiste++
    } else if (p.tiempo > 120) {
      stats.bloqueo++
    } else {
      stats.desconocimiento++
    }
  })
  
}

export const GRUPOS_ASIGNATURAS = {
  'AT': 'Bloque: Básicas',
  'FS': 'Bloque: Básicas',
  'BQ': 'Bloque: Básicas',
  'GT': 'Bloque: Básicas',
  'IG': 'Bloque: Básicas',
  'OF': 'Bloque: Órganos de los Sentidos',
  'OR': 'Bloque: Órganos de los Sentidos',
  'GR': 'Bloque: Miscelánea',
  'UG': 'Bloque: Miscelánea',
  'ON': 'Bloque: Miscelánea',
};

/**
 * Consolida TODAS las métricas por asignatura en una única "tabla maestra" (array de objetos).
 * Ideal para construir UIs complejas y gráficos sin reprocesar el raw data múltiples veces.
 */
export function getAnalisisGlobalPorAsignatura() {
  const recentSims = simulacrosOrdenCronologico.slice(-4)
  const map = {}

  preguntas.forEach(p => {
    if (p.ignorar) return

    let asig = p.asignatura
    let isGroup = false;
    if (GRUPOS_ASIGNATURAS[asig]) {
      asig = GRUPOS_ASIGNATURAS[asig];
      isGroup = true;
    }

    if (!map[asig]) {
      map[asig] = {
        codigo: isGroup ? 'GRUPO' : asig,
        nombre: isGroup ? asig : (ASIGNATURA_NOMBRE[asig] || asig),
        global: { total: 0, acertadas: 0, falladas: 0, nulas: 0, neta: 0 },
        reciente: { total: 0, acertadas: 0, falladas: 0, nulas: 0, neta: 0, gravedad_total: 0 },
        simulacros: {}, // { num_sim: { total, acertadas } }
        subtemas: {} // { nombre_subtema: { total, acertadas, falladas } }
      }
    }

    const s = map[asig]
    
    // Global stats
    s.global.total++
    if (p.acertada) s.global.acertadas++
    if (p.fallada) s.global.falladas++
    if (p.nula) s.global.nulas++
    s.global.neta += p.neta

    // Evolución por simulacro
    if (!s.simulacros[p.simulacro]) {
      s.simulacros[p.simulacro] = { total: 0, acertadas: 0, neta: 0, sumDificultad: 0, difCount: 0 }
    }
    s.simulacros[p.simulacro].total++
    if (p.acertada) s.simulacros[p.simulacro].acertadas++
    s.simulacros[p.simulacro].neta += p.neta
    if (p.dificultad && p.dificultad > 0) {
      s.simulacros[p.simulacro].sumDificultad += p.dificultad
      s.simulacros[p.simulacro].difCount++
    }

    // Desglose por subtema (Nivel 2 de la clasificación, o Nivel 1 si no hay)
    let subtema = 'General'
    if (p.clasificaciones && p.clasificaciones.length > 0) {
      subtema = p.clasificaciones.length > 1 ? p.clasificaciones[1] : p.clasificaciones[0]
    }
    if (!s.subtemas[subtema]) {
      s.subtemas[subtema] = { total: 0, acertadas: 0, falladas: 0 }
    }
    s.subtemas[subtema].total++
    if (p.acertada) s.subtemas[subtema].acertadas++
    if (p.fallada) s.subtemas[subtema].falladas++

    // Reciente stats
    if (recentSims.includes(p.simulacro)) {
      s.reciente.total++
      if (p.acertada) s.reciente.acertadas++
      if (p.fallada) {
        s.reciente.falladas++
        const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
        const cuenta_total = meta?.cuenta_total || 3000
        const pct_field = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : 0.5
        const dif = p.dificultad || 3
        const gravedad = pct_field * (6 - dif)
        s.reciente.gravedad_total += gravedad
      }
      if (p.nula) s.reciente.nulas++
      s.reciente.neta += p.neta
    }
  })

  // Finalizar cálculos derivados
  return Object.values(map).map(s => {
    // Rendimientos %
    s.global.pctAcierto = s.global.total > 0 ? (s.global.acertadas / s.global.total) : 0
    s.reciente.pctAcierto = s.reciente.total > 0 ? (s.reciente.acertadas / s.reciente.total) : 0
    
    // Score de prioridad (Semáforo)
    const cuenta_preguntas_mir = s.reciente.total / Math.max(1, recentSims.length)
    
    // Si es un bloque, dividir la prioridad total entre el número de asignaturas que lo componen para hacer la media aritmética
    let numAsignaturasEnBloque = 1;
    if (s.codigo === 'GRUPO') {
      numAsignaturasEnBloque = Object.keys(GRUPOS_ASIGNATURAS).filter(c => GRUPOS_ASIGNATURAS[c] === s.nombre).length;
    }
    
    s.scorePrioridad = (cuenta_preguntas_mir * (1 - s.reciente.pctAcierto) * (1 + s.reciente.gravedad_total)) / Math.max(1, numAsignaturasEnBloque);

    // Formatear subtemas para radar
    s.subtemasArray = Object.entries(s.subtemas).map(([nombre, stats]) => ({
      nombre,
      ...stats,
      pctAcierto: stats.total > 0 ? (stats.acertadas / stats.total) : 0
    })).sort((a, b) => b.total - a.total) // Ordenar por volumen

    // Tendencia evolutiva (últimos vs primeros simulacros presentes)
    const nums = Object.keys(s.simulacros).map(Number).sort((a, b) => a - b)
    s.simulacrosArray = nums.map(num => {
      const simData = s.simulacros[num]
      const difMedia = simData.difCount > 0 ? (simData.sumDificultad / simData.difCount) : 3.0
      const netaAjustada = Math.round(simData.neta * (difMedia / 3.0) * 10) / 10
      return { 
        simulacro: num, 
        ...simData, 
        difMedia: Math.round(difMedia * 100) / 100,
        netaAjustada 
      }
    })
    
    if (s.simulacrosArray.length > 2) {
      const half = Math.floor(s.simulacrosArray.length / 2)
      const avgPrimera = s.simulacrosArray.slice(0, half).reduce((acc, x) => acc + (x.acertadas / x.total), 0) / half
      const avgUltima = s.simulacrosArray.slice(half).reduce((acc, x) => acc + (x.acertadas / x.total), 0) / (s.simulacrosArray.length - half)
      s.tendencia = avgUltima - avgPrimera // positivo = mejoría
    } else {
      s.tendencia = 0
    }

    return s
  }).sort((a, b) => b.scorePrioridad - a.scorePrioridad)
}

/**
 * Genera una autopsia (Post-Mortem) detallada y accionable de un simulacro específico.
 * Extrae preguntas exactas para fugas, errores, desplomes de asignaturas y fatiga.
 */
export function getPostMortemSimulacro(num) {
  const mySim = preguntas.filter(p => p.simulacro === num && !p.ignorar)
  if (mySim.length === 0) return null

  const meta = simulacrosMeta.find(m => m.numero === num)
  const cuenta_total = meta?.cuenta_total || 3000
  
  // 1. Fugas de puntos (Fallos tontos) - Preguntas que más del 50% acierta
  const fugas = mySim
    .filter(p => p.fallada && p.pct_correcta && (p.pct_correcta / cuenta_total) >= 0.50)
    .map(p => ({
      ...p,
      nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
      pct_field_correct: p.pct_correcta / cuenta_total
    }))
    .sort((a, b) => b.pct_field_correct - a.pct_field_correct)

  // 2. Estilos de error (Listados exactos de preguntas)
  const errores = { dudasFatales: [], despistes: [], bloqueos: [], desconocimiento: [] }

  mySim.filter(p => p.fallada).forEach(p => {
    const ext = {
      ...p,
      nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
      pct_field_correct: (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null
    }

    if (p.tiempo === 0 && p.dudas === 0) {
      errores.desconocimiento.push(ext) // papel
      return
    }

    if (p.dudas === 1) {
      errores.dudasFatales.push(ext)
    } else if (p.tiempo > 0 && p.tiempo < 30 && p.dificultad <= 3) {
      errores.despistes.push(ext)
    } else if (p.tiempo > 120) {
      errores.bloqueos.push(ext)
    } else {
      errores.desconocimiento.push(ext)
    }
  })

  // 3. Desplomes y Subidones
  const idx = simulacrosOrdenCronologico.indexOf(num)
  const prevSims = idx > 0 ? simulacrosOrdenCronologico.slice(0, idx) : []
  
  const asigStats = {}
  preguntas.forEach(p => {
    if (p.ignorar) return
    const asig = p.asignatura
    if (!asigStats[asig]) {
      asigStats[asig] = {
        nombre: ASIGNATURA_NOMBRE[asig] || asig,
        codigo: asig,
        historico_total: 0, historico_acertadas: 0,
        actual_total: 0, actual_acertadas: 0,
        preguntas_falladas: []
      }
    }
    
    if (prevSims.includes(p.simulacro)) {
      asigStats[asig].historico_total++
      if (p.acertada) asigStats[asig].historico_acertadas++
    } else if (p.simulacro === num) {
      asigStats[asig].actual_total++
      if (p.acertada) asigStats[asig].actual_acertadas++
      if (p.fallada) {
        asigStats[asig].preguntas_falladas.push({
          ...p,
          nombre_asignatura: ASIGNATURA_NOMBRE[asig] || asig,
          pct_field_correct: (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null
        })
      }
    }
  })

  const desplomes = []
  const subidones = []

  Object.values(asigStats).forEach(s => {
    // Solo evaluar si hay suficiente volumen histórico y actual
    if (s.historico_total >= 5 && s.actual_total >= 3) {
      const histPct = s.historico_acertadas / s.historico_total
      const actPct = s.actual_acertadas / s.actual_total
      const diff = actPct - histPct

      if (diff <= -0.20) { // cayó un 20% o más
        desplomes.push({ ...s, historico_pct: histPct, actual_pct: actPct, diferencia: diff })
      } else if (diff >= 0.20) { // subió un 20% o más
        subidones.push({ ...s, historico_pct: histPct, actual_pct: actPct, diferencia: diff })
      }
    }
  })

  desplomes.sort((a, b) => a.diferencia - b.diferencia)
  subidones.sort((a, b) => b.diferencia - a.diferencia)
  
  // 4. Métrica de Fatiga (mitad 1 vs mitad 2)
  const qSorted = [...mySim].sort((a, b) => a.numero - b.numero)
  const half = Math.floor(qSorted.length / 2)
  const q1 = qSorted.slice(0, half)
  const q2 = qSorted.slice(half)
  
  const aciertos1 = q1.filter(p => p.acertada).length
  const aciertos2 = q2.filter(p => p.acertada).length
  const pct1 = q1.length > 0 ? aciertos1 / q1.length : 0
  const pct2 = q2.length > 0 ? aciertos2 / q2.length : 0
  const difMedia1 = q1.reduce((s, p) => s + (p.dificultad || 3), 0) / (q1.length || 1)
  const difMedia2 = q2.reduce((s, p) => s + (p.dificultad || 3), 0) / (q2.length || 1)
  
  const fatiga = {
    mitad1: { acertadas: aciertos1, total: q1.length, pct: pct1, difMedia: difMedia1 },
    mitad2: { acertadas: aciertos2, total: q2.length, pct: pct2, difMedia: difMedia2 },
    diferenciaPct: pct2 - pct1
  }
  
  // 5. Comparativa con Media de los últimos 5 simulacros anteriores al actual
  const richSims = getSimulacrosRich() || []
  // Filtrar los que tienen datos, excluir el simulacro actual y quedarnos con los 5 más recientes anteriores
  const simsAnteriores = richSims
    .filter(s => s.stats && s.stats.percentil_total != null && s.numero !== num)
    .sort((a, b) => b.numero - a.numero)
    .slice(0, 5)

  let totalPercentile = 0
  let totalAciertos = 0
  let count = simsAnteriores.length
  simsAnteriores.forEach(s => {
    totalPercentile += s.stats.percentil_total
    totalAciertos += s.stats.acertadas
  })
  const mediaUsuario = {
    percentil: count > 0 ? Math.round((totalPercentile / count) * 100) : 50,
    aciertos: count > 0 ? Math.round(totalAciertos / count) : 100,
    basadoEn: count  // para mostrar en UI cuántos simulacros se usaron
  }
  const metaAciertos = mySim.filter(p => p.acertada).length

  return { simulacro: num, meta, aciertos: metaAciertos, fugas, errores, desplomes, subidones, fatiga, mediaUsuario }
}

/**
 * Devuelve todas las preguntas de una asignatura que el usuario ha fallado o dudado,
 * ordenadas cronológicamente (las más recientes primero).
 */
export function getPreguntasARevisarAsignatura(codigoAsig) {
  return preguntas
    .filter(p => p.asignatura === codigoAsig)
    .map(p => {
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      return {
        ...p,
        pct_field_correct: (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null
      }
    })
    // Orden descendente por simulacro (los más recientes primero)
    .sort((a, b) => {
      const simDiff = b.simulacro - a.simulacro
      if (simDiff !== 0) return simDiff
      return a.numero - b.numero
    })
}

// ─── Análisis de Debilidades ─────────────────────────────────────────────────

/**
 * Agrupa todas las preguntas falladas por su clasificación de nivel 1 (tema).
 * Para cada tema calcula: acierto, fallos, tendencia entre simulacros y score de urgencia.
 * score = falladas × (1 - pctAcierto) × (1 + gravedadMedia)
 * Devuelve array ordenado por scoreUrgencia desc.
 */
export function getAnalisisPorTema(codigoAsigFiltro = null) {
  const map = {}

  preguntas.forEach(p => {
    if (p.ignorar) return
    if (codigoAsigFiltro && p.asignatura !== codigoAsigFiltro) return

    const tema = (p.clasificaciones && p.clasificaciones.length > 0)
      ? p.clasificaciones[0]
      : 'Sin clasificar'

    const key = `${p.asignatura}||${tema}`

    if (!map[key]) {
      map[key] = {
        tema,
        asignaturaCode: p.asignatura,
        asignaturaNombre: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
        total: 0,
        acertadas: 0,
        falladas: 0,
        gravedadTotal: 0,
        preguntasFalladas: [],
        porSimulacro: {}, // { numSim: { total, acertadas } }
      }
    }

    const s = map[key]
    s.total++
    if (p.acertada) s.acertadas++

    if (p.fallada) {
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_field = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : 0.4
      const dif = p.dificultad || 3
      const gravedad = pct_field * (6 - dif)
      s.falladas++
      s.gravedadTotal += gravedad
      s.preguntasFalladas.push({
        ...p,
        nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
        pct_field_correct: pct_field,
      })
    }

    // Evolución por simulacro
    if (!s.porSimulacro[p.simulacro]) s.porSimulacro[p.simulacro] = { total: 0, acertadas: 0 }
    s.porSimulacro[p.simulacro].total++
    if (p.acertada) s.porSimulacro[p.simulacro].acertadas++
  })

  return Object.values(map)
    .filter(s => s.total >= 3) // Al menos 3 preguntas para tener representatividad
    .map(s => {
      const pctAcierto = s.total > 0 ? s.acertadas / s.total : 0
      const gravedadMedia = s.falladas > 0 ? s.gravedadTotal / s.falladas : 0
      const scoreUrgencia = s.falladas * (1 - pctAcierto) * (1 + gravedadMedia)

      // Tendencia: comparar primera mitad de simulacros vs segunda mitad
      const nums = Object.keys(s.porSimulacro).map(Number).sort((a, b) => a - b)
      let tendencia = 0
      if (nums.length >= 2) {
        const mid = Math.floor(nums.length / 2)
        const primera = nums.slice(0, mid)
        const segunda = nums.slice(mid)
        const pctPrimera = primera.reduce((acc, n) => {
          const d = s.porSimulacro[n]
          return acc + (d.total > 0 ? d.acertadas / d.total : 0)
        }, 0) / primera.length
        const pctSegunda = segunda.reduce((acc, n) => {
          const d = s.porSimulacro[n]
          return acc + (d.total > 0 ? d.acertadas / d.total : 0)
        }, 0) / segunda.length
        tendencia = pctSegunda - pctPrimera // positivo = mejorando
      }

      // Array de evolución por simulacro para sparkline
      const evolucionPorSim = nums.map(n => {
        const d = s.porSimulacro[n]
        return { simulacro: n, pct: d.total > 0 ? d.acertadas / d.total : 0, total: d.total, acertadas: d.acertadas }
      })

      return {
        ...s,
        pctAcierto,
        gravedadMedia,
        scoreUrgencia,
        tendencia,
        evolucionPorSim,
      }
    })
    .sort((a, b) => b.scoreUrgencia - a.scoreUrgencia)
}

/**
 * Devuelve preguntas que el usuario ha fallado pero que eran objetivamente fáciles:
 * dificultad ≤ 2 O más del 55% del campo las acertó.
 * Ordenadas de más grave (mayor % de acierto del campo) a menos.
 * Estas son "puntos regalados" — conceptos básicos que no deberían fallar.
 */
export function getPuntosRegalados() {
  return preguntas
    .filter(p => {
      if (p.ignorar || !p.fallada) return false
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_campo = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null

      const esFacilPorDificultad = p.dificultad > 0 && p.dificultad <= 2
      const esFacilPorCampo = pct_campo !== null && pct_campo >= 0.55

      return esFacilPorDificultad || esFacilPorCampo
    })
    .map(p => {
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_campo = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null
      return {
        ...p,
        nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
        pct_field_correct: pct_campo,
      }
    })
    .sort((a, b) => {
      // Ordenar por pct_campo desc (las más graves primero), luego por dificultad asc
      const pctA = a.pct_field_correct ?? 0
      const pctB = b.pct_field_correct ?? 0
      if (Math.abs(pctB - pctA) > 0.05) return pctB - pctA
      return (a.dificultad || 3) - (b.dificultad || 3)
    })
}

/**
 * Devuelve preguntas falladas donde el usuario eligió el mismo distractor incorrecto
 * que mucha otra gente (pct_misma_respuesta alta), lo que indica una trampa conceptual
 * recurrente que los examinadores usan deliberadamente.
 * Solo incluye preguntas donde la respuesta dada NO era la correcta y fue elegida
 * por al menos el 20% del campo.
 * Agrupa por asignatura y tema para mostrar patrones.
 */
export function getTrampasConceptuales(umbralPct = 0.20) {
  const trampas = preguntas
    .filter(p => {
      if (p.ignorar || !p.fallada) return false
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_misma = (p.pct_misma_respuesta && cuenta_total)
        ? (p.pct_misma_respuesta / cuenta_total)
        : null
      // Solo si la respuesta elegida la comparte un porcentaje significativo del campo
      return pct_misma !== null && pct_misma >= umbralPct
    })
    .map(p => {
      const meta = simulacrosMeta.find(m => m.numero === p.simulacro)
      const cuenta_total = meta?.cuenta_total || 3000
      const pct_misma = (p.pct_misma_respuesta / cuenta_total)
      const pct_correcta = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : null
      return {
        ...p,
        nombre_asignatura: ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura,
        pct_misma_respuesta_ratio: pct_misma,
        pct_field_correct: pct_correcta,
        tema: (p.clasificaciones && p.clasificaciones.length > 0) ? p.clasificaciones[0] : 'General',
      }
    })
    .sort((a, b) => b.pct_misma_respuesta_ratio - a.pct_misma_respuesta_ratio)

  return trampas
}
