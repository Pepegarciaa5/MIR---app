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
 * Filtra y construye una cola de 10 preguntas.
 * Prioriza repasos pendientes, luego rellena con nuevas.
 * Descarta preguntas de simulacro con dificultad 5.
 */
export function generarColaPreguntas(bancoPreguntasTodas, repasosPendientesIds, asignatura, archivedIds = []) {
  // 1. Filtrar preguntas de esta asignatura o bloque
  const preguntasAsignatura = bancoPreguntasTodas.filter(q => {
    // Si la pregunta no tiene asignatura o está archivada, ignorar
    if (!q.asignatura) return false;
    if (q.archivada || (Array.isArray(archivedIds) && archivedIds.includes(q.id))) return false;

    // A veces q.asignatura es el nombre ("Digestivo") y a veces el código ("DG").
    // Buscamos su código original para poder cruzar con los grupos.
    const codigo = Object.keys(ASIGNATURA_NOMBRE).find(c => ASIGNATURA_NOMBRE[c] === q.asignatura) || q.asignatura;
    
    const isGroupMatch = GRUPOS_ASIGNATURAS[codigo] === asignatura;
    const isNameMatch = ASIGNATURA_NOMBRE[codigo] === asignatura;
    const isCodeMatch = codigo === asignatura;
    const isDirectMatch = q.asignatura === asignatura;

    return isGroupMatch || isNameMatch || isCodeMatch || isDirectMatch;
  });

  // 2. Extraer repasos pendientes (si existen en el banco)
  const repasos = preguntasAsignatura.filter(q => repasosPendientesIds.includes(q.id));

  // 3. Obtener preguntas candidatas nuevas (no están en repasos)
  const candidatasNuevas = preguntasAsignatura.filter(q => !repasosPendientesIds.includes(q.id));

  // 4. Aplicar FILTRO: Descartar simulacros de dificultad 5
  const nuevasFiltradas = candidatasNuevas.filter(q => {
    const esSimulacro = (q.simulacro !== null && q.simulacro !== undefined);
    if (esSimulacro && q.dificultad === 5) {
      return false; // DESCARTAR
    }
    return true; // MANTENER
  });

  // 5. Rellenar hasta 10
  const cola = [...repasos];
  let i = 0;
  
  // Mezclar un poco las nuevas para no dar siempre las primeras
  const nuevasMezcladas = [...nuevasFiltradas].sort(() => 0.5 - Math.random());

  while (cola.length < 10 && i < nuevasMezcladas.length) {
    cola.push(nuevasMezcladas[i]);
    i++;
  }

  // Devolver las seleccionadas
  return cola;
}
