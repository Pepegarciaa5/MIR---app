/**
 * Archivo: buscadorCatalogo.js
 * Descripción: Motor de indexación y búsqueda ultrarrápida de preguntas MIR (Desgloses + Simulacros).
 * Optimizado para máxima fluidez sin bloqueos de hilo principal (Zero-Hang).
 */

import { ASIGNATURA_NOMBRE } from './simulacros'

const ACCENT_MAP = {
  'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ü': 'u', 'ñ': 'n',
  'Á': 'a', 'É': 'e', 'Í': 'i', 'Ó': 'o', 'Ú': 'u', 'Ü': 'u', 'Ñ': 'n'
}
const ACCENT_REGEX = /[áéíóúüñÁÉÍÓÚÜÑ]/g

export function stripAccents(str) {
  if (!str) return ''
  return str.toString().toLowerCase().replace(ACCENT_REGEX, c => ACCENT_MAP[c] || c)
}

export function stripHtml(html) {
  if (!html) return ''
  return html
    .toString()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const NUM_TO_LETTER = ['A', 'B', 'C', 'D', 'E']

let catalogoCache = null
let catalogoLoadingPromise = null

/**
 * Carga el catálogo de forma asíncrona mediante dynamic imports.
 * Evita sobrecargar el inicio de la app o el bundler de Vite.
 */
export async function getCatalogoCompletoAsync() {
  if (catalogoCache) return catalogoCache
  if (catalogoLoadingPromise) return catalogoLoadingPromise

  catalogoLoadingPromise = (async () => {
    // Carga paralela de los 3 archivos JSON solo cuando se necesita
    const [desglosesModule, textosModule, ctoModule] = await Promise.all([
      import('../data/desgloses_filtrables.json'),
      import('../data/simulacros_textos.json'),
      import('../data/simulacrosCTO.json')
    ])

    const desglosesData = desglosesModule.default || desglosesModule
    const textosSimulacros = textosModule.default || textosModule
    const rawSimulacrosCTO = ctoModule.default || ctoModule

    // 1. Indexar metadatos de preguntas de Simulacros CTO
    const ctoMap = new Map()
    const ctoList = Array.isArray(rawSimulacrosCTO) ? rawSimulacrosCTO : (rawSimulacrosCTO.preguntas || [])
    for (let i = 0; i < ctoList.length; i++) {
      const p = ctoList[i]
      if (p.pregunta_id) ctoMap.set(p.pregunta_id, p)
      if (p.simulacro && p.numero) ctoMap.set(`${p.simulacro}-${p.numero}`, p)
    }

    const lista = []

    // 2. Normalizar Desgloses Oficiales MIR (~3.535 preguntas)
    for (let i = 0; i < desglosesData.length; i++) {
      const d = desglosesData[i]
      const enunciadoLimpio = stripHtml(d.enunciado)
      const comentLimpio = stripHtml(d.comentario)
      const opcionesNorm = (d.respuestas || []).map((r, idx) => {
        const letra = NUM_TO_LETTER[idx] || String(r.numero || idx + 1)
        return {
          id: letra,
          numero: r.numero || idx + 1,
          text: stripHtml(r.enunciado),
          correcta: Boolean(r.correcta)
        }
      })
      const correctOpt = opcionesNorm.find(o => o.correcta)
      const opcionesTexto = opcionesNorm.map(o => o.text).join(' ')
      const asignatura = d.asignatura || 'General'
      const tema = d.tema || ''
      const origenLabel = d.convocatoria || (d.anualidad ? `MIR ${d.anualidad}` : 'Desglose MIR')

      // String de búsqueda pre-limpiado y unificado
      const searchTokens = stripAccents(
        `${enunciadoLimpio} ${opcionesTexto} ${asignatura} ${tema} ${origenLabel} desglose mir`
      )

      lista.push({
        id: d.id,
        tipo: 'desglose',
        origenLabel,
        asignatura,
        tema,
        subtema: '',
        dificultad: d.dificultad || 3,
        anualidad: d.anualidad || null,
        simulacro: null,
        numero: null,
        enunciado: d.enunciado,
        enunciadoLimpio,
        opciones: opcionesNorm,
        correctOptionLetter: correctOpt ? correctOpt.id : '',
        correctOptionNumber: correctOpt ? correctOpt.numero : null,
        comentario: d.comentario || '',
        comentarioLimpio: comentLimpio,
        imagen_nombre: d.imagen_nombre || null,
        cto_acertada: false,
        cto_fallada: false,
        cto_dudosa: false,
        cto_respuesta_dada: null,
        cto_pct_correcta: null,
        _searchStr: searchTokens,
        _comentClean: stripAccents(comentLimpio)
      })
    }

    // 3. Normalizar Simulacros CTO (~3.990 preguntas)
    for (let i = 0; i < textosSimulacros.length; i++) {
      const t = textosSimulacros[i]
      if (!t.enunciado || t.anulada) continue
      const num = t.numero_pregunta || t.numero
      const cto = ctoMap.get(t.id) || ctoMap.get(`${t.simulacro}-${num}`) || {}
      const clasif = cto.clasificaciones || []

      const asigNombre = ASIGNATURA_NOMBRE[cto.asignatura] || clasif[0] || cto.asignatura || 'Simulacros'
      const tema = clasif[1] || ''
      const subtema = clasif[2] || ''

      const enunciadoLimpio = stripHtml(t.enunciado)
      const comentLimpio = stripHtml(t.comentario)

      const rawOpts = [...(t.respuestas || [])].sort((a, b) => a.numero - b.numero)
      const opcionesNorm = rawOpts.map((r, idx) => {
        const letra = NUM_TO_LETTER[idx] || String(r.numero || idx + 1)
        const esCorrecta = Boolean(r.correcta || (cto.respuesta_correcta && r.numero === cto.respuesta_correcta))
        return {
          id: letra,
          numero: r.numero || idx + 1,
          text: stripHtml(r.enunciado),
          correcta: esCorrecta
        }
      })

      const correctOpt = opcionesNorm.find(o => o.correcta)
      const opcionesTexto = opcionesNorm.map(o => o.text).join(' ')
      const origenLabel = `Simulacro CTO ${t.simulacro} · P${num}`

      const searchTokens = stripAccents(
        `${enunciadoLimpio} ${opcionesTexto} ${asigNombre} ${tema} ${subtema} ${origenLabel} simulacro cto sim ${t.simulacro} p${num}`
      )

      lista.push({
        id: t.id || `sim-${t.simulacro}-${num}`,
        tipo: 'simulacro',
        origenLabel,
        asignatura: asigNombre,
        tema,
        subtema,
        dificultad: cto.dificultad || t.dificultad || 3,
        anualidad: 2026,
        simulacro: t.simulacro,
        numero: num,
        enunciado: t.enunciado,
        enunciadoLimpio,
        opciones: opcionesNorm,
        correctOptionLetter: correctOpt ? correctOpt.id : '',
        correctOptionNumber: correctOpt ? correctOpt.numero : cto.respuesta_correcta || null,
        comentario: t.comentario || '',
        comentarioLimpio: comentLimpio,
        imagen_nombre: t.imagen_nombre || null,
        cto_acertada: cto.acertada === 1,
        cto_fallada: cto.fallada === 1,
        cto_dudosa: cto.dudas === 1,
        cto_respuesta_dada: cto.respuesta_dada || null,
        cto_pct_correcta: cto.pct_correcta || null,
        _searchStr: searchTokens,
        _comentClean: stripAccents(comentLimpio)
      })
    }

    catalogoCache = lista
    return catalogoCache
  })()

  return catalogoLoadingPromise
}

export function getCatalogoSync() {
  return catalogoCache
}

/**
 * Filtra preguntas en memoria con rendimiento ultra-alto (<5ms).
 */
export function buscarPreguntasEnCatalogo(catalogo = [], query = '', filtros = {}, studentStatsMap = {}) {
  if (!Array.isArray(catalogo) || catalogo.length === 0) return []

  const qClean = stripAccents(query).trim()
  const tokens = qClean ? qClean.split(/\s+/).filter(t => t.length > 0) : []

  const hasTipo = filtros.tipo && filtros.tipo !== 'todos'
  const hasSimNum = Boolean(filtros.simulacroNum)
  const targetSimNum = Number(filtros.simulacroNum)
  const hasAsig = Boolean(filtros.asignatura)
  const targetAsig = filtros.asignatura
  const hasTema = Boolean(filtros.tema)
  const targetTema = filtros.tema
  const hasDificultad = Array.isArray(filtros.dificultad) && filtros.dificultad.length > 0
  const hasHistorial = filtros.estadoHistorial && filtros.estadoHistorial !== 'todos'

  const resultados = []

  for (let i = 0; i < catalogo.length; i++) {
    const p = catalogo[i]

    // 1. Filtro de texto (Todos los tokens deben coincidir en enunciado/opciones/asignatura o comentario)
    if (tokens.length > 0) {
      let matchedAll = true
      for (let j = 0; j < tokens.length; j++) {
        const tok = tokens[j]
        if (!p._searchStr.includes(tok) && !p._comentClean.includes(tok)) {
          matchedAll = false
          break
        }
      }
      if (!matchedAll) continue
    }

    // 2. Filtro por origen
    if (hasTipo) {
      if (filtros.tipo === 'desgloses' && p.tipo !== 'desglose') continue
      if (filtros.tipo === 'simulacros' && p.tipo !== 'simulacro') continue
    }

    // 3. Filtro por número de simulacro específico
    if (hasSimNum && p.tipo === 'simulacro') {
      if (Number(p.simulacro) !== targetSimNum) continue
    }

    // 4. Filtro por Asignatura
    if (hasAsig && p.asignatura !== targetAsig) {
      continue
    }

    // 5. Filtro por Tema
    if (hasTema && p.tema !== targetTema) {
      continue
    }

    // 6. Filtro por Dificultades
    if (hasDificultad) {
      if (!filtros.dificultad.includes(p.dificultad)) continue
    }

    // 7. Filtro por Historial del Alumno
    if (hasHistorial) {
      const userStat = studentStatsMap[p.id] ||
        (p.simulacro && p.numero ? studentStatsMap[`${p.simulacro}-${p.numero}`] : null)

      const fallosApp = userStat?.fallos || 0
      const aciertosApp = userStat?.aciertos || 0
      const fueFallada = p.cto_fallada || fallosApp > 0
      const fueDudosa = p.cto_dudosa || userStat?.dudosa
      const fueAcertada = (!fueFallada && p.cto_acertada) || (aciertosApp > 0 && fallosApp === 0)
      const noVista = !userStat && !p.cto_fallada && !p.cto_acertada && !p.cto_dudosa

      if (filtros.estadoHistorial === 'falladas' && !fueFallada) continue
      if (filtros.estadoHistorial === 'dudosas' && !fueDudosa) continue
      if (filtros.estadoHistorial === 'acertadas' && !fueAcertada) continue
      if (filtros.estadoHistorial === 'no_vistas' && !noVista) continue
    }

    resultados.push(p)
  }

  return resultados
}
