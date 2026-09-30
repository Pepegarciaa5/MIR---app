import { useState, useEffect, useCallback } from 'react';
import { getOrCreateAnonUserId, upsertQuestionStat } from '../utils/quizSync';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'mir_banco_preguntas_stats';

let globalStatsCache = null;
const listeners = new Set();
let isInitialFetched = false;

function getGlobalStatsData() {
  if (globalStatsCache) return globalStatsCache;
  try {
    const item = localStorage.getItem(STORAGE_KEY);
    globalStatsCache = item ? JSON.parse(item) : {};
  } catch (error) {
    console.error('Error cargando stats locales:', error);
    globalStatsCache = {};
  }
  return globalStatsCache;
}

function setGlobalStatsData(newStats) {
  globalStatsCache = newStats;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newStats));
  listeners.forEach(listener => listener(newStats));
}

/**
 * Helper para calcular la latencia (horas) y la prioridad (1 a 10) según el resultado y la seguridad.
 */
export function calcularPrioridadYLatencia(esCorrecta, seguridad = 'green', estadoPrevio = {}) {
  const normalizeConfidence = (conf) => {
    if (conf === 'yellow' || conf === 'orange') return 'orange';
    if (conf === 'green') return 'green';
    return 'red';
  };

  const c = normalizeConfidence(seguridad);
  const rachaActual = estadoPrevio.rachaVerde || 0;
  const teniaFalloPrevio = (estadoPrevio.fallos || 0) > 0;

  let rachaVerde = 0;
  let latenciaHoras = 24; // Por defecto 1 día
  let puntuacionPrioridad = 5;

  if (!esCorrecta) {
    // FALLADA
    rachaVerde = 0;
    latenciaHoras = 24; // 1 día a dormir
    if (c === 'green') {
      puntuacionPrioridad = 10; // Fallo de sobreconfianza (grave)
    } else {
      puntuacionPrioridad = 9;  // Fallo en duda/rojo
    }
  } else {
    // ACIERTADA
    if (c === 'red') {
      rachaVerde = 0;
      latenciaHoras = 24; // 1 día a dormir
      puntuacionPrioridad = 8; // Acertada en Rojo (acierto por suerte)
    } else if (c === 'orange') {
      rachaVerde = 0;
      latenciaHoras = 72; // 3 días a dormir (72h)
      if (teniaFalloPrevio) {
        puntuacionPrioridad = 6; // Acertada en naranja viniendo de un fallo previo (mejorada pero volátil)
      } else {
        puntuacionPrioridad = 5; // Acertada en naranja normal
      }
    } else if (c === 'green') {
      rachaVerde = rachaActual + 1;
      if (rachaVerde === 1) {
        latenciaHoras = 240; // 10 días (240h)
        puntuacionPrioridad = 3;
      } else if (rachaVerde === 2) {
        latenciaHoras = 720; // 30 días (720h)
        puntuacionPrioridad = 2;
      } else {
        latenciaHoras = 2160; // 90 días (2160h) -> Dominada
        puntuacionPrioridad = 1;
      }
    }
  }

  const latenciaHasta = new Date(Date.now() + latenciaHoras * 3600 * 1000).toISOString();

  return {
    rachaVerde,
    latenciaHoras,
    latenciaHasta,
    puntuacionPrioridad
  };
}

/**
 * Helper para comprobar si una pregunta está durmiendo (en latencia).
 */
export function isEnLatencia(preguntaId, statsMap) {
  if (!preguntaId || !statsMap) return false;
  const p = statsMap[preguntaId];
  if (!p || !p.latenciaHasta) return false;
  return new Date(p.latenciaHasta).getTime() > Date.now();
}

/**
 * Hook para gestionar las estadísticas locales y remotas (Supabase) del banco de preguntas.
 */
export function usePreguntasStats() {
  const [stats, setStats] = useState(getGlobalStatsData);

  useEffect(() => {
    listeners.add(setStats);
    
    // Fetch initial stats from Supabase on first mount to sync cloud data
    if (!isInitialFetched) {
      isInitialFetched = true;
      const userId = getOrCreateAnonUserId();
      supabase
        .from('user_question_stats')
        .select('*')
        .eq('user_id', userId)
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const currentStats = getGlobalStatsData();
            const merged = { ...currentStats };
            data.forEach(item => {
              if (item.question_id) {
                merged[item.question_id] = {
                  ...(merged[item.question_id] || {}),
                  status: item.status,
                  archivada: item.status === 'archived' || merged[item.question_id]?.archivada || false,
                  dudosa: item.status === 'needs_review' && item.confidence === 'yellow',
                  dominada: item.status === 'mastered',
                  nota: item.note || merged[item.question_id]?.nota || '',
                  confidence_history: item.confidence_history || [],
                  rachaVerde: item.racha_verde || merged[item.question_id]?.rachaVerde || 0,
                  latenciaHasta: item.latencia_hasta || merged[item.question_id]?.latenciaHasta || null,
                  puntuacionPrioridad: item.puntuacion_prioridad || merged[item.question_id]?.puntuacionPrioridad || null
                };
              }
            });
            setGlobalStatsData(merged);
          }
        })
        .catch(err => console.error('Error fetching Supabase stats:', err));
    }

    return () => listeners.delete(setStats);
  }, []);

  const syncToCloud = (preguntaId, updatedQuestionStats) => {
    const userId = getOrCreateAnonUserId();
    const status = updatedQuestionStats.archivada
      ? 'archived'
      : (updatedQuestionStats.dominada
        ? 'mastered'
        : (updatedQuestionStats.fallos > 0 || updatedQuestionStats.dudosa ? 'needs_review' : 'mastered'));

    upsertQuestionStat(userId, preguntaId, {
      subject: updatedQuestionStats.subject || 'General',
      status: status,
      confidence_history: updatedQuestionStats.confidence_history || [],
      note: updatedQuestionStats.nota || '',
      racha_verde: updatedQuestionStats.rachaVerde || 0,
      latencia_hasta: updatedQuestionStats.latenciaHasta || null,
      puntuacion_prioridad: updatedQuestionStats.puntuacionPrioridad || 7
    });
  };

  const registrarRespuesta = useCallback((preguntaId, esCorrecta, respuestaSeleccionada, extraData = {}) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const newConfidence = extraData.confidence || (esCorrecta ? 'green' : 'red');
    const newHistory = [...(p.confidence_history || []), newConfidence];

    const { rachaVerde, latenciaHasta, puntuacionPrioridad } = calcularPrioridadYLatencia(
      esCorrecta,
      newConfidence,
      p
    );

    const updated = {
      ...p,
      vecesVistas: p.vecesVistas + 1,
      aciertos: esCorrecta ? p.aciertos + 1 : p.aciertos,
      fallos: !esCorrecta ? p.fallos + 1 : p.fallos,
      ultimaRespuesta: respuestaSeleccionada,
      ultimaFecha: new Date().toISOString(),
      confidence_history: newHistory,
      subject: extraData.subject || p.subject || 'General',
      rachaVerde,
      latenciaHasta,
      puntuacionPrioridad,
      dominada: rachaVerde >= 3
    };

    const newStats = {
      ...currentStats,
      [preguntaId]: updated
    };

    setGlobalStatsData(newStats);
    syncToCloud(preguntaId, updated);
  }, []);

  const marcarEstado = useCallback((preguntaId, tipo) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const updated = {
      ...p,
      dudosa: tipo === 'dudosa',
      dominada: tipo === 'dominada'
    };

    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: updated
    });
    syncToCloud(preguntaId, updated);
  }, []);

  const marcarCorregida = useCallback((preguntaId, estado = true) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const updated = {
      ...p,
      corregida: estado
    };

    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: updated
    });
    syncToCloud(preguntaId, updated);
  }, []);

  const getStatsPregunta = useCallback((preguntaId) => {
    return stats[preguntaId] || null;
  }, [stats]);

  const guardarNota = useCallback((preguntaId, nota) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };
    const updated = { ...p, nota: nota.trim() };
    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: updated
    });
    syncToCloud(preguntaId, updated);
  }, []);

  const archivarPregunta = useCallback((preguntaId, motivo = 'missing_data') => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };
    const updated = {
      ...p,
      archivada: true,
      motivoArchivada: motivo,
      fechaArchivada: new Date().toISOString()
    };
    const newStats = {
      ...currentStats,
      [preguntaId]: updated
    };
    setGlobalStatsData(newStats);
    syncToCloud(preguntaId, updated);
  }, []);

  const isArchivada = useCallback((preguntaId) => {
    if (!preguntaId) return false;
    return !!stats[preguntaId]?.archivada || stats[preguntaId]?.status === 'archived';
  }, [stats]);

  // Obtener rendimiento global
  const getGlobalStats = useCallback(() => {
    let totalRespuestas = 0;
    let totalAciertos = 0;
    let totalFallos = 0;

    Object.values(stats).forEach(s => {
      totalRespuestas += s.vecesVistas || 0;
      totalAciertos += s.aciertos || 0;
      totalFallos += s.fallos || 0;
    });

    return {
      totalRespuestas,
      totalAciertos,
      totalFallos,
      porcentajeAcierto: totalRespuestas > 0 ? ((totalAciertos / totalRespuestas) * 100).toFixed(1) : 0
    };
  }, [stats]);

  return {
    stats,
    registrarRespuesta,
    marcarEstado,
    marcarCorregida,
    getStatsPregunta,
    getGlobalStats,
    guardarNota,
    archivarPregunta,
    isArchivada,
    isEnLatencia: (id) => isEnLatencia(id, stats)
  };
}

