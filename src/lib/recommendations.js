import { getRentabilidad } from '../data/mirStats';
import { GRUPOS_ASIGNATURAS, ASIGNATURA_NOMBRE } from './simulacros';

// Objetivos de acierto según rentabilidad
const OBJETIVOS = {
  alta: 90,
  media_alta: 75,
  media: 75,
  baja: 60
};

/**
 * Calcula la distancia entre el % de aciertos actual y el objetivo
 * basado en la rentabilidad histórica de la asignatura.
 */
export function calcularDistanciaObjetivo(asignatura, aciertoActualPorcentaje) {
  const rentabilidad = getRentabilidad(asignatura);
  const objetivo = OBJETIVOS[rentabilidad.prioridad] || 60;
  
  const distancia = objetivo - aciertoActualPorcentaje;
  
  return {
    asignatura,
    prioridadStr: rentabilidad.prioridad,
    objetivo,
    aciertoActual: aciertoActualPorcentaje,
    distancia: Math.max(0, distancia) // Si supera el objetivo, distancia 0
  };
}

/**
 * Filtra y construye una cola de preguntas según el nuevo algoritmo inteligente:
 * - Filtra por asignatura / bloque.
 * - Excluye preguntas archivadas.
 * - Excluye preguntas en latencia (salvo si ignoreLatency es true, ej. Desgloses).
 * - Calcula la cuota adaptativa de preguntas nuevas (20% a 50%) según el número de repasos urgentes (prioridad >= 8).
 * - Ordena las preguntas de repaso estrictamente por su puntuación de prioridad (10 ➔ 1).
 */
export function generarColaPreguntas(
  bancoPreguntasTodas,
  statsMapInput = {},
  asignatura = null,
  archivedIds = [],
  targetCount = 10,
  options = {}
) {
  const { ignoreLatency = false } = options;

  // Compatibilidad: si statsMapInput es un Array de IDs o no está definido
  let statsMap = {};
  if (Array.isArray(statsMapInput)) {
    statsMap = Object.fromEntries(statsMapInput.map(id => [id, { fallos: 1, puntuacionPrioridad: 9 }]));
  } else if (statsMapInput && typeof statsMapInput === 'object') {
    statsMap = statsMapInput;
  }

  // 1. Filtrar preguntas pertenecientes a la asignatura (si se especifica) y no archivadas
  const candidatasBase = bancoPreguntasTodas.filter(q => {
    if (q.archivada || (Array.isArray(archivedIds) && archivedIds.includes(q.id))) return false;
    if (!asignatura) return true;

    if (!q.asignatura) return false;
    const codigo = Object.keys(ASIGNATURA_NOMBRE).find(c => ASIGNATURA_NOMBRE[c] === q.asignatura) || q.asignatura;
    
    const isGroupMatch = GRUPOS_ASIGNATURAS[codigo] === asignatura;
    const isNameMatch = ASIGNATURA_NOMBRE[codigo] === asignatura;
    const isCodeMatch = codigo === asignatura;
    const isDirectMatch = q.asignatura === asignatura;

    return isGroupMatch || isNameMatch || isCodeMatch || isDirectMatch;
  });

  // 2. Filtrar simulacros de dificultad 5
  const candidatasSinDif5 = candidatasBase.filter(q => {
    const esSimulacro = (q.simulacro !== null && q.simulacro !== undefined);
    return !(esSimulacro && q.dificultad === 5);
  });

  // 3. Si ignoreLatency es true (ej. Desgloses), devolver todas
  if (ignoreLatency) {
    return candidatasSinDif5;
  }

  // 4. Excluir las preguntas que están durmiendo en latencia
  const now = Date.now();
  const candidatasDisponibles = candidatasSinDif5.filter(q => {
    const s = statsMap[q.id];
    if (!s || !s.latenciaHasta) return true;
    return new Date(s.latenciaHasta).getTime() <= now;
  });

  // 5. Separar entre Preguntas Nuevas (vírgenes) y Preguntas de Repaso
  const nuevas = candidatasDisponibles.filter(q => {
    const s = statsMap[q.id];
    return !s || (!s.vecesVistas || s.vecesVistas === 0);
  });

  const repasos = candidatasDisponibles.filter(q => {
    const s = statsMap[q.id];
    return s && s.vecesVistas > 0;
  }).map(q => {
    const s = statsMap[q.id] || {};
    let prio = s.puntuacionPrioridad;
    if (!prio) {
      if (s.fallos > 0) prio = s.dudosa ? 9 : 10;
      else if (s.dudosa) prio = 5;
      else if (s.dominada) prio = 1;
      else prio = 5;
    }
    return { ...q, _prio: prio };
  });

  // 6. Contar repasos urgentes (prioridad >= 8) para determinar la cuota adaptativa de nuevas (20% - 50%)
  const repasosUrgentes = repasos.filter(r => r._prio >= 8);
  const proporcionUrgentes = targetCount > 0 ? (repasosUrgentes.length / targetCount) : 0;

  let pctNuevas = 0.50; // Por defecto 50%
  if (proporcionUrgentes >= 0.50) {
    pctNuevas = 0.20; // 20% si hay mucha carga de fallos urgentes
  } else if (proporcionUrgentes >= 0.20) {
    pctNuevas = 0.35; // 35% si hay carga media
  } else {
    pctNuevas = 0.50; // 50% si la cola de fallos está limpia
  }

  const numNuevasDeseadas = Math.min(nuevas.length, Math.round(targetCount * pctNuevas));
  const numRepasosDeseados = Math.max(0, targetCount - numNuevasDeseadas);

  // 7. Seleccionar preguntas nuevas (mezcladas aleatoriamente)
  const nuevasSeleccionadas = [...nuevas].sort(() => 0.5 - Math.random()).slice(0, numNuevasDeseadas);

  // 8. Seleccionar preguntas de repaso ordenadas por prioridad DESC (10 -> 1) con pequeña aleatoriedad en empates
  const repasosOrdenados = [...repasos].sort((a, b) => {
    if (b._prio !== a._prio) return b._prio - a._prio;
    return 0.5 - Math.random();
  });
  const repasosSeleccionados = repasosOrdenados.slice(0, numRepasosDeseados);

  // 9. Combinar y rellenar si alguna lista quedó corta
  let finalCola = [...nuevasSeleccionadas, ...repasosSeleccionados];

  if (finalCola.length < targetCount) {
    const idsUsados = new Set(finalCola.map(q => q.id));
    const restantesNuevas = nuevas.filter(q => !idsUsados.has(q.id));
    const restantesRepasos = repasosOrdenados.filter(q => !idsUsados.has(q.id));
    const restantes = [...restantesNuevas, ...restantesRepasos];
    
    let i = 0;
    while (finalCola.length < targetCount && i < restantes.length) {
      finalCola.push(restantes[i]);
      i++;
    }
  }

  return finalCola;
}
