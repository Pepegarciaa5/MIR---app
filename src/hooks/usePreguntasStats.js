/**
 * Archivo: usePreguntasStats.js
 * Descripción: Hook de React para gestionar el progreso individual de cada pregunta (revisada, dudosa, dominada) usando localStorage.
 * Creado: 2026-08-29
 * Última actualización: 2026-08-29
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'mir_banco_preguntas_stats';

let globalStatsCache = null;
const listeners = new Set();

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
 * Hook para gestionar las estadísticas locales del banco de preguntas.
 * Implementa un patrón de estado global para que todos los componentes
 * compartan y sincronicen el mismo estado de localStorage sin sobrescribirse.
 */
export function usePreguntasStats() {
  const [stats, setStats] = useState(getGlobalStatsData);

  useEffect(() => {
    listeners.add(setStats);
    return () => listeners.delete(setStats);
  }, []);

  const registrarRespuesta = useCallback((preguntaId, esCorrecta, respuestaSeleccionada) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: {
        ...p,
        vecesVistas: p.vecesVistas + 1,
        aciertos: esCorrecta ? p.aciertos + 1 : p.aciertos,
        fallos: !esCorrecta ? p.fallos + 1 : p.fallos,
        ultimaRespuesta: respuestaSeleccionada,
        ultimaFecha: new Date().toISOString()
      }
    });
  }, []);

  const marcarEstado = useCallback((preguntaId, tipo) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: {
        ...p,
        dudosa: tipo === 'dudosa',
        dominada: tipo === 'dominada'
      }
    });
  }, []);

  const marcarCorregida = useCallback((preguntaId, estado = true) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: {
        ...p,
        corregida: estado
      }
    });
  }, []);

  const getStatsPregunta = useCallback((preguntaId) => {
    return stats[preguntaId] || null;
  }, [stats]);

  const guardarNota = useCallback((preguntaId, nota) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };
    setGlobalStatsData({
      ...currentStats,
      [preguntaId]: { ...p, nota: nota.trim() }
    });
  }, []);

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
    guardarNota
  };
}
