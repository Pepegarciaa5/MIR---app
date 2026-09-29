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
                  dudosa: item.status === 'needs_review' && item.confidence === 'yellow',
                  dominada: item.status === 'mastered',
                  nota: item.note || merged[item.question_id]?.nota || '',
                  confidence_history: item.confidence_history || []
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
    const status = updatedQuestionStats.dominada
      ? 'mastered'
      : (updatedQuestionStats.fallos > 0 || updatedQuestionStats.dudosa ? 'needs_review' : 'mastered');

    upsertQuestionStat(userId, preguntaId, {
      subject: updatedQuestionStats.subject || 'General',
      status: status,
      confidence_history: updatedQuestionStats.confidence_history || [],
      note: updatedQuestionStats.nota || ''
    });
  };

  const registrarRespuesta = useCallback((preguntaId, esCorrecta, respuestaSeleccionada, extraData = {}) => {
    const currentStats = getGlobalStatsData();
    const p = currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const newConfidence = extraData.confidence || (esCorrecta ? 'green' : 'red');
    const newHistory = [...(p.confidence_history || []), newConfidence];

    const updated = {
      ...p,
      vecesVistas: p.vecesVistas + 1,
      aciertos: esCorrecta ? p.aciertos + 1 : p.aciertos,
      fallos: !esCorrecta ? p.fallos + 1 : p.fallos,
      ultimaRespuesta: respuestaSeleccionada,
      ultimaFecha: new Date().toISOString(),
      confidence_history: newHistory,
      subject: extraData.subject || p.subject || 'General'
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

