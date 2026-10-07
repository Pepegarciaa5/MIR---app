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

  const sincronizarDesdeNube = useCallback(async (silent = true) => {
    try {
      const userId = getOrCreateAnonUserId();
      const { data, error } = await supabase.from('user_question_stats').select('*').eq('user_id', userId);
      if (error) {
        console.warn('Sincronización Supabase omitida o con error:', error.message);
        if (!silent) alert(`Error de conexión con Supabase: ${error.message || 'No se pudo leer la nube'}`);
        return 0;
      }
      if (data && data.length > 0) {
        const currentStats = getGlobalStatsData();
        const merged = { ...currentStats };
        let updatedCount = 0;

        data.forEach(item => {
          if (item.question_id) {
            const prev = merged[item.question_id] || {};
            const confHist = Array.isArray(item.confidence_history) ? item.confidence_history : [];
            const aciertosCloud = confHist.filter(c => (typeof c === 'string' ? c === 'green' : c?.c === 'green')).length;
            const fallosCloud = confHist.filter(c => {
              const val = typeof c === 'string' ? c : c?.c;
              return val === 'red' || val === 'orange' || val === 'yellow';
            }).length;
            const vistasCloud = confHist.length;

            const finalAciertos = vistasCloud > 0 ? aciertosCloud : (prev.aciertos || 0);
            const finalFallos = vistasCloud > 0 ? fallosCloud : (prev.fallos || 0);
            const finalVistas = vistasCloud > 0 ? vistasCloud : Math.max(prev.vecesVistas || 0, finalAciertos + finalFallos);

            const isCorregida = item.status === 'corrected' || (item.note && item.note.includes('[CORREGIDA]')) || prev.corregida || false;
            const cleanNote = item.note ? item.note.replace(/\[CORREGIDA\]\s*/g, '') : (prev.nota || '');

            merged[item.question_id] = {
              ...prev,
              status: item.status,
              archivada: item.status === 'archived' || prev.archivada || false,
              dudosa: item.status === 'needs_review' && item.confidence === 'yellow',
              dominada: item.status === 'mastered',
              corregida: isCorregida,
              nota: cleanNote,
              confidence_history: confHist.length > 0 ? confHist : (prev.confidence_history || []),
              rachaVerde: item.racha_verde ?? prev.rachaVerde ?? 0,
              latenciaHasta: item.latencia_hasta || prev.latenciaHasta || null,
              puntuacionPrioridad: item.puntuacion_prioridad ?? prev.puntuacionPrioridad ?? null,
              ultimaFecha: item.updated_at || item.created_at || prev.ultimaFecha,
              vecesVistas: finalVistas,
              aciertos: finalAciertos,
              fallos: finalFallos
            };
            updatedCount++;
          }
        });
        setGlobalStatsData(merged);
        if (!silent) alert(`¡Sincronización completada! Se han descargado ${data.length} preguntas de la nube.`);
        return data.length;
      } else {
        if (!silent) alert('No se encontraron registros de preguntas en la nube de Supabase.');
        return 0;
      }
    } catch (err) {
      console.warn('Excepción al consultar Supabase:', err.message);
      if (!silent) alert(`Excepción al sincronizar: ${err.message}`);
      return 0;
    }
  }, []);

  const subirProgresoLocalANube = useCallback(async () => {
    const currentStats = getGlobalStatsData();
    const userId = getOrCreateAnonUserId();
    const entries = Object.entries(currentStats);
    let count = 0;

    for (const [preguntaId, s] of entries) {
      if (s.vecesVistas > 0 || s.nota || s.archivada || s.aciertos > 0 || s.fallos > 0 || s.corregida) {
        const status = s.archivada
          ? 'archived'
          : (s.dominada
            ? 'mastered'
            : (s.fallos > 0 || s.dudosa ? 'needs_review' : 'mastered'));

        let confHist = Array.isArray(s.confidence_history) ? [...s.confidence_history] : [];
        const aciertosCount = s.aciertos || 0;
        const fallosCount = s.fallos || 0;

        if (confHist.length < (aciertosCount + fallosCount)) {
          const synthesized = [];
          for (let i = 0; i < aciertosCount; i++) synthesized.push('green');
          for (let i = 0; i < fallosCount; i++) synthesized.push('red');
          confHist = synthesized;
        }

        let noteWithTag = s.nota || '';
        if (s.corregida && !noteWithTag.includes('[CORREGIDA]')) {
          noteWithTag = `[CORREGIDA] ${noteWithTag}`.trim();
        }

        const success = await upsertQuestionStat(userId, preguntaId, {
          subject: s.subject || 'General',
          status: status,
          confidence_history: confHist,
          note: noteWithTag,
          racha_verde: s.rachaVerde || 0,
          latencia_hasta: s.latenciaHasta || null,
          puntuacion_prioridad: s.puntuacionPrioridad || 7
        });
        if (success) count++;
      }
    }
    return count;
  }, []);

  const exportarJSON = useCallback(() => {
    const currentStats = getGlobalStatsData();
    return JSON.stringify(currentStats, null, 2);
  }, []);

  const importarJSON = useCallback((jsonStr) => {
    try {
      const parsed = JSON.parse(jsonStr);
      if (typeof parsed !== 'object' || parsed === null) throw new Error('Formato JSON no válido');
      const currentStats = getGlobalStatsData();
      const merged = { ...currentStats, ...parsed };
      setGlobalStatsData(merged);
      // Subir también lo importado a Supabase
      const entriesCount = Object.keys(parsed).length;
      alert(`¡Éxito! Se han importado ${entriesCount} preguntas al almacenamiento local.`);
      return true;
    } catch (e) {
      alert(`Error al importar JSON: ${e.message}`);
      return false;
    }
  }, []);

  useEffect(() => {
    listeners.add(setStats);
    
    // Auto two-way sync on mount: upload local localStorage history to cloud, then fetch combined cloud stats
    const autoSync = async () => {
      try {
        await subirProgresoLocalANube();
        await sincronizarDesdeNube(true);
      } catch (err) {
        console.warn('Auto cloud sync error:', err);
      }
    };
    autoSync();

    return () => listeners.delete(setStats);
  }, [sincronizarDesdeNube, subirProgresoLocalANube]);

  const syncToCloud = (preguntaId, updatedQuestionStats) => {
    const userId = getOrCreateAnonUserId();
    const status = updatedQuestionStats.archivada
      ? 'archived'
      : (updatedQuestionStats.dominada
        ? 'mastered'
        : (updatedQuestionStats.fallos > 0 || updatedQuestionStats.dudosa ? 'needs_review' : 'mastered'));

    let noteWithTag = updatedQuestionStats.nota || '';
    if (updatedQuestionStats.corregida && !noteWithTag.includes('[CORREGIDA]')) {
      noteWithTag = `[CORREGIDA] ${noteWithTag}`.trim();
    }

    upsertQuestionStat(userId, preguntaId, {
      subject: updatedQuestionStats.subject || 'General',
      status: status,
      confidence_history: updatedQuestionStats.confidence_history || [],
      note: noteWithTag,
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
    const nowIso = new Date().toISOString();
    const newHistory = [...(p.confidence_history || []), { c: newConfidence, t: nowIso }];

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
      ultimaFecha: nowIso,
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
    sincronizarDesdeNube,
    subirProgresoLocalANube,
    exportarJSON,
    importarJSON,
    isEnLatencia: (id) => isEnLatencia(id, stats)
  };
}

