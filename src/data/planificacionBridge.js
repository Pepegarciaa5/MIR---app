// Mapa de códigos CTO → nombres completos del diccionario ESPECIALIDADES
import { ESPECIALIDADES } from './especialidadesMIR'
import planificacionRaw from './planificacionCTO.json'

export const CODIGO_A_ESPECIALIDAD = {
  AL: ESPECIALIDADES.ALERGOLOGIA,
  AT: ESPECIALIDADES.ANATOMIA,
  AP: ESPECIALIDADES.ANATOMIA_PATOLOGICA,
  AN: ESPECIALIDADES.ANESTESIOLOGIA,
  BL: ESPECIALIDADES.BIOETICA,
  BQ: ESPECIALIDADES.BIOQUIMICA,
  CD: ESPECIALIDADES.CARDIOLOGIA,
  CG: ESPECIALIDADES.CIRUGIA_GENERAL,
  DM: ESPECIALIDADES.DERMATOLOGIA,
  DG: ESPECIALIDADES.DIGESTIVO,
  ED: ESPECIALIDADES.ENDOCRINOLOGIA,
  EP: ESPECIALIDADES.EPIDEMIOLOGIA,
  FM: ESPECIALIDADES.FARMACOLOGIA,
  FS: ESPECIALIDADES.FISIOLOGIA,
  GT: ESPECIALIDADES.GENETICA,
  GR: ESPECIALIDADES.GERIATRIA,
  GC: ESPECIALIDADES.GINECOLOGIA,
  HM: ESPECIALIDADES.HEMATOLOGIA,
  IF: ESPECIALIDADES.INFECCIOSAS,
  IG: ESPECIALIDADES.INMUNOLOGIA,
  FC: ESPECIALIDADES.MEDICINA_FAMILIAR,
  NF: ESPECIALIDADES.NEFROLOGIA,
  NM: ESPECIALIDADES.NEUMOLOGIA,
  NR: ESPECIALIDADES.NEUROLOGIA,
  OF: ESPECIALIDADES.OFTALMOLOGIA,
  ON: ESPECIALIDADES.ONCOLOGIA,
  OR: ESPECIALIDADES.OTORRINOLARINGOLOGIA,
  PD: ESPECIALIDADES.PEDIATRIA,
  PQ: ESPECIALIDADES.PSIQUIATRIA,
  RX: ESPECIALIDADES.RADIOLOGIA,
  RH: ESPECIALIDADES.REHABILITACION,
  RM: ESPECIALIDADES.REUMATOLOGIA,
  TM: ESPECIALIDADES.TRAUMATOLOGIA,
  UG: ESPECIALIDADES.URGENCIAS,
  UR: ESPECIALIDADES.UROLOGIA,
}

// Emoji por categoría CTO
const EMOJI_CATEGORIA = {
  'Estudio': '📖',
  'Presentación': '🎬',
  'Videoclase': '🎬',
  'Clase': '📡',
  'Desgloses': '📝',
  'Evaluación': '📝',
  'Corrección Evaluación': '✏️',
  'Simulacro': '📝',
  'Corrección Simulacro': '✏️',
  'Intocables': '🔒',
  'Descanso': '🌴',
  'Vacaciones': '🌴',
}

// Construir el calendario global desde el JSON
// Formato: { 'YYYY-MM-DD': [ { id, inicio, fin, titulo, especialidad, categoria, temas, ... } ] }
const calendarioGenerado = {}

planificacionRaw.forEach((entry, idx) => {
  const fecha = entry.fecha
  if (!fecha) return

  const especialidad = CODIGO_A_ESPECIALIDAD[entry.asignatura] || ESPECIALIDADES.LIBRE
  const categoria = entry.categoria || 'Otro'
  const emoji = EMOJI_CATEGORIA[categoria] || '📖'

  const temas = (entry.temas || []).map(t => ({
    orden: t.orden,
    titulo: t.titulo,
    tieneVideo: t.tiene_video,
    resumen: t.resumen || null,
  }))

  const bloque = {
    id: `cto-${fecha}-${idx}`,
    inicio: entry.hora_inicio || '08:30',
    fin: entry.hora_fin || '14:00',
    titulo: `${emoji} ${entry.nombre}`,
    especialidad,
    codigoCTO: entry.asignatura || '',
    categoria,
    tema: temas.length > 0 ? temas[0].titulo : null,
    temas,
    vuelta: entry.vuelta || null,
    bloqueNum: entry.bloque_num || null,
    completado: false,
    activo: false,
  }

  if (!calendarioGenerado[fecha]) calendarioGenerado[fecha] = []
  calendarioGenerado[fecha].push(bloque)
})

export const planificacionCTO = calendarioGenerado

// Export flat list for search/stats
export const allBloquesCTO = planificacionRaw
  .filter(e => e.asignatura)
  .map((e, i) => ({
    fecha: e.fecha,
    nombre: e.nombre,
    asignatura: e.asignatura,
    especialidad: CODIGO_A_ESPECIALIDAD[e.asignatura] || ESPECIALIDADES.LIBRE,
    categoria: e.categoria || 'Otro',
    vuelta: e.vuelta,
    temas: (e.temas || []).map(t => t.titulo),
  }))

// Export unique categorías for filtering
export const CATEGORIAS_CTO = [...new Set(planificacionRaw.map(e => e.categoria).filter(Boolean))].sort()
