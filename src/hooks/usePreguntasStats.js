import { useState, useEffect, useCallback } from 'react';
import { getOrCreateAnonUserId, upsertQuestionStat, flushOfflineSyncQueue, getOfflineQueueStats, enqueueQuestionStat } from '../utils/quizSync';
import { supabase } from '../lib/supabase';
import { getCanonicalId } from '../lib/bancoUnificado.js';

import rawSimulacrosData from '../data/simulacrosCTO.json';

const STORAGE_KEY = 'mir_banco_preguntas_stats';
const LAST_CLOUD_PULL_KEY = 'mir_last_cloud_pull_ts';
const RECONCILED_FLAG_KEY = 'mir_reconciled_nov2026_v1';

// Bidirectional alias maps between pregunta_id (UUID) and simulacro-numero (e.g. "14-12")
const uuidToSimNumMap = {};
const simNumToUuidMap = {};

try {
  const preguntasList = Array.isArray(rawSimulacrosData) ? rawSimulacrosData : (rawSimulacrosData.preguntas || []);
  preguntasList.forEach(p => {
    if (p.pregunta_id && p.simulacro && p.numero) {
      const simNumKey = `${p.simulacro}-${p.numero}`;
      uuidToSimNumMap[p.pregunta_id] = simNumKey;
      simNumToUuidMap[simNumKey] = p.pregunta_id;
    }
  });
} catch (e) {
  console.warn('Error constructing simulacro alias map:', e);
}

let globalStatsCache = null;
const listeners = new Set();
let isInitialFetched = false;
let initialFetchPromise = null;
let globalIsSyncing = false;
const syncListeners = new Set();

function setGlobalSyncing(val) {
  globalIsSyncing = val;
  syncListeners.forEach(fn => fn(val));
}

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
  const canonId = getCanonicalId(preguntaId);
  const p = statsMap[canonId] || statsMap[preguntaId];
  if (!p || !p.latenciaHasta) return false;
  return new Date(p.latenciaHasta).getTime() > Date.now();
}

/**
 * Hook para gestionar las estadísticas locales y remotas (Supabase) del banco de preguntas.
 */
export function usePreguntasStats() {
  const [stats, setStats] = useState(getGlobalStatsData);
  const [isSyncing, setIsSyncing] = useState(globalIsSyncing);

  const sincronizarDesdeNube = useCallback(async (silent = true, force = false) => {
    if (!force && isInitialFetched && silent) {
      return Object.keys(getGlobalStatsData()).length;
    }
    if (initialFetchPromise && !force) {
      return initialFetchPromise;
    }

    const doFetch = async () => {
      try {
        const userId = getOrCreateAnonUserId();
        const currentStats = getGlobalStatsData();
        const hasLocalData = Object.keys(currentStats).length > 0;
        const lastPullTs = (!force && hasLocalData && typeof localStorage !== 'undefined')
          ? localStorage.getItem(LAST_CLOUD_PULL_KEY)
          : null;

        let allData = [];
        let from = 0;
        const PAGE_SIZE = 1000;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('user_question_stats')
            .select('question_id,status,confidence_history,note,racha_verde,latencia_hasta,puntuacion_prioridad,updated_at,created_at')
            .eq('user_id', userId);

          if (lastPullTs) {
            query = query.gt('updated_at', lastPullTs);
          }

          const { data, error } = await query.range(from, from + PAGE_SIZE - 1);

          if (error) {
            console.warn('Sincronización Supabase omitida o con error:', error.message);
            if (!silent) alert(`Error de conexión con Supabase: ${error.message || 'No se pudo leer la nube'}`);
            return 0;
          }

          if (data && data.length > 0) {
            allData = allData.concat(data);
            if (data.length < PAGE_SIZE) {
              hasMore = false;
            } else {
              from += PAGE_SIZE;
            }
          } else {
            hasMore = false;
          }
        }

        isInitialFetched = true;

        const merged = { ...currentStats };
        let maxCloudTs = lastPullTs || null;

        if (allData.length > 0) {
          allData.forEach(item => {
            if (item.question_id) {
              const itemTs = item.updated_at || item.created_at || null;
              if (itemTs && (!maxCloudTs || itemTs > maxCloudTs)) {
                maxCloudTs = itemTs;
              }

              const prev = merged[item.question_id] || {};
              const confHist = Array.isArray(item.confidence_history) ? item.confidence_history : [];
              const prevHist = Array.isArray(prev.confidence_history) ? prev.confidence_history : [];

              const prevMs = prev.ultimaFecha ? new Date(prev.ultimaFecha).getTime() : 0;
              const cloudMs = itemTs ? new Date(itemTs).getTime() : 0;
              const localIsNewer = (prevMs > cloudMs + 2000) || (prevHist.length > confHist.length);

              const activeHist = localIsNewer && prevHist.length > 0 ? prevHist : (confHist.length > 0 ? confHist : prevHist);
              const aciertosCloud = activeHist.filter(c => (typeof c === 'string' ? c === 'green' : c?.c === 'green')).length;
              const fallosCloud = activeHist.filter(c => {
                const val = typeof c === 'string' ? c : c?.c;
                return val === 'red' || val === 'orange' || val === 'yellow';
              }).length;
              const vistasCloud = activeHist.length;

              const finalAciertos = vistasCloud > 0 ? aciertosCloud : (prev.aciertos || 0);
              const finalFallos = vistasCloud > 0 ? fallosCloud : (prev.fallos || 0);
              const finalVistas = vistasCloud > 0 ? vistasCloud : Math.max(prev.vecesVistas || 0, finalAciertos + finalFallos);

              const isCorregida = item.status === 'corrected' || (item.note && item.note.includes('[CORREGIDA]')) || prev.corregida || false;
              const cloudCleanNote = item.note ? item.note.replace(/\[CORREGIDA\]\s*/g, '') : '';
              const cleanNote = (localIsNewer && prev.nota) ? prev.nota : (cloudCleanNote || prev.nota || '');

              const qStatObj = {
                ...prev,
                status: localIsNewer && prev.status ? prev.status : item.status,
                archivada: item.status === 'archived' || prev.archivada || false,
                dudosa: localIsNewer ? (prev.dudosa || false) : (item.status === 'needs_review' && item.confidence === 'yellow'),
                dominada: localIsNewer ? (prev.dominada ?? (item.status === 'mastered')) : (item.status === 'mastered'),
                corregida: isCorregida,
                nota: cleanNote,
                confidence_history: activeHist,
                rachaVerde: localIsNewer ? (prev.rachaVerde ?? item.racha_verde ?? 0) : (item.racha_verde ?? prev.rachaVerde ?? 0),
                latenciaHasta: localIsNewer ? (prev.latenciaHasta || item.latencia_hasta || null) : (item.latencia_hasta || prev.latenciaHasta || null),
                puntuacionPrioridad: localIsNewer ? (prev.puntuacionPrioridad ?? item.puntuacion_prioridad ?? null) : (item.puntuacion_prioridad ?? prev.puntuacionPrioridad ?? null),
                ultimaFecha: localIsNewer ? (prev.ultimaFecha || itemTs) : (itemTs || prev.ultimaFecha),
                vecesVistas: finalVistas,
                aciertos: finalAciertos,
                fallos: finalFallos
              };

              merged[item.question_id] = qStatObj;
              if (uuidToSimNumMap[item.question_id]) {
                merged[uuidToSimNumMap[item.question_id]] = qStatObj;
              }
              if (simNumToUuidMap[item.question_id]) {
                merged[simNumToUuidMap[item.question_id]] = qStatObj;
              }
            }
          });
          setGlobalStatsData(merged);
        }

        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LAST_CLOUD_PULL_KEY, maxCloudTs || new Date().toISOString());

          // Reconciliación única post-corte offline: sube cualquier nota, [CORREGIDA] o respuesta local reciente
          if (localStorage.getItem(RECONCILED_FLAG_KEY) !== '1') {
            localStorage.setItem(RECONCILED_FLAG_KEY, '1');
            const seenCanon = new Set();
            let enqueuedDelta = 0;
            for (const [k, s] of Object.entries(merged)) {
              if (!s) continue;
              const canonId = getCanonicalId(k) || simNumToUuidMap[k] || k;
              if (seenCanon.has(canonId)) continue;
              seenCanon.add(canonId);

              const hasRecentOffline = s.ultimaFecha && s.ultimaFecha > '2026-10-23T16:50:00.000Z';
              if (s.corregida || s.nota || s.archivada || hasRecentOffline) {
                const status = s.archivada
                  ? 'archived'
                  : (s.dominada
                    ? 'mastered'
                    : (s.fallos > 0 || s.dudosa ? 'needs_review' : 'mastered'));
                let noteWithTag = s.nota || '';
                if (s.corregida && !noteWithTag.includes('[CORREGIDA]')) {
                  noteWithTag = `[CORREGIDA] ${noteWithTag}`.trim();
                }
                enqueueQuestionStat(userId, canonId, {
                  subject: s.subject || 'General',
                  status,
                  confidence_history: Array.isArray(s.confidence_history) ? s.confidence_history : [],
                  note: noteWithTag,
                  racha_verde: s.rachaVerde || 0,
                  latencia_hasta: s.latenciaHasta || null,
                  puntuacion_prioridad: s.puntuacionPrioridad || 7
                });
                enqueuedDelta++;
              }
            }
            if (enqueuedDelta > 0) {
              await flushOfflineSyncQueue();
            }
          }
        }

        if (!silent) {
          alert(`¡Sincronización completada! (${allData.length} registros nuevos/actualizados desde la nube).`);
        }
        return allData.length;
      } catch (err) {
        console.warn('Excepción al consultar Supabase:', err.message);
        if (!silent) alert(`Excepción al sincronizar: ${err.message}`);
        return 0;
      } finally {
        initialFetchPromise = null;
      }
    };

    initialFetchPromise = doFetch();
    return initialFetchPromise;
  }, []);

  const subirProgresoLocalANube = useCallback(async () => {
    const currentStats = getGlobalStatsData();
    const userId = getOrCreateAnonUserId();
    const entries = Object.entries(currentStats);
    const seenCanon = new Set();
    let count = 0;

    for (const [preguntaId, s] of entries) {
      if (!s) continue;
      const canonId = getCanonicalId(preguntaId) || simNumToUuidMap[preguntaId] || preguntaId;
      if (seenCanon.has(canonId)) continue;
      seenCanon.add(canonId);

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

        enqueueQuestionStat(userId, canonId, {
          subject: s.subject || 'General',
          status: status,
          confidence_history: confHist,
          note: noteWithTag,
          racha_verde: s.rachaVerde || 0,
          latencia_hasta: s.latenciaHasta || null,
          puntuacion_prioridad: s.puntuacionPrioridad || 7
        });
        count++;
      }
    }

    const syncRes = await flushOfflineSyncQueue();
    return syncRes.success ? count : 0;
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
    syncListeners.add(setIsSyncing);

    // Auto two-way sync ONLY ONCE per app session (even if 200 QuestionRows mount)
    if (!isInitialFetched && !initialFetchPromise) {
      const autoSync = async () => {
        try {
          setGlobalSyncing(true);
          await flushOfflineSyncQueue();
          await sincronizarDesdeNube(true, false);
        } catch (err) {
          console.warn('Auto cloud sync error:', err);
        } finally {
          setGlobalSyncing(false);
        }
      };
      autoSync();
    }

    return () => {
      listeners.delete(setStats);
      syncListeners.delete(setIsSyncing);
    };
  }, [sincronizarDesdeNube]);

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

    const payload = {
      subject: updatedQuestionStats.subject || 'General',
      status: status,
      confidence_history: updatedQuestionStats.confidence_history || [],
      note: noteWithTag,
      racha_verde: updatedQuestionStats.rachaVerde || 0,
      latencia_hasta: updatedQuestionStats.latenciaHasta || null,
      puntuacion_prioridad: updatedQuestionStats.puntuacionPrioridad || 7
    };

    // Guardar una sola fila canónica en la nube (los alias locales ya se resuelven en memoria)
    const canonicalId = getCanonicalId(preguntaId) || simNumToUuidMap[preguntaId] || preguntaId;
    upsertQuestionStat(userId, canonicalId, payload);
  };

  const registrarRespuesta = useCallback((preguntaId, esCorrecta, respuestaSeleccionada, extraData = {}) => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const canonId = getCanonicalId(preguntaId);
    const alias1 = uuidToSimNumMap[preguntaId];
    const alias2 = simNumToUuidMap[preguntaId];

    const p = currentStats[canonId] || currentStats[preguntaId] || (alias1 ? currentStats[alias1] : null) || (alias2 ? currentStats[alias2] : null) || {
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
      [canonId]: updated
    };
    if (preguntaId !== canonId) newStats[preguntaId] = updated;
    if (alias1 && alias1 !== canonId) newStats[alias1] = updated;
    if (alias2 && alias2 !== canonId) newStats[alias2] = updated;

    setGlobalStatsData(newStats);
    syncToCloud(canonId, updated);
  }, []);

  const marcarEstado = useCallback((preguntaId, tipo) => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const canonId = getCanonicalId(preguntaId);
    const alias1 = uuidToSimNumMap[preguntaId];
    const alias2 = simNumToUuidMap[preguntaId];

    const p = currentStats[canonId] || currentStats[preguntaId] || (alias1 ? currentStats[alias1] : null) || (alias2 ? currentStats[alias2] : null) || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const updated = {
      ...p,
      dudosa: tipo === 'dudosa',
      dominada: tipo === 'dominada'
    };

    const newStats = {
      ...currentStats,
      [canonId]: updated
    };
    if (preguntaId !== canonId) newStats[preguntaId] = updated;
    if (alias1 && alias1 !== canonId) newStats[alias1] = updated;
    if (alias2 && alias2 !== canonId) newStats[alias2] = updated;

    setGlobalStatsData(newStats);
    syncToCloud(canonId, updated);
  }, []);

  const marcarCorregida = useCallback((preguntaId, estado = true) => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const canonId = getCanonicalId(preguntaId);
    const alias1 = uuidToSimNumMap[preguntaId];
    const alias2 = simNumToUuidMap[preguntaId];

    const p = currentStats[canonId] || currentStats[preguntaId] || (alias1 ? currentStats[alias1] : null) || (alias2 ? currentStats[alias2] : null) || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };

    const updated = {
      ...p,
      corregida: estado
    };

    const newStats = {
      ...currentStats,
      [canonId]: updated
    };
    if (preguntaId !== canonId) newStats[preguntaId] = updated;
    if (alias1 && alias1 !== canonId) newStats[alias1] = updated;
    if (alias2 && alias2 !== canonId) newStats[alias2] = updated;

    setGlobalStatsData(newStats);
    syncToCloud(canonId, updated);
  }, []);

  const getStatsPregunta = useCallback((preguntaId) => {
    if (!preguntaId) return null;
    const canonId = getCanonicalId(preguntaId);
    if (stats[canonId]) return stats[canonId];
    if (stats[preguntaId]) return stats[preguntaId];
    const alias1 = uuidToSimNumMap[preguntaId];
    if (alias1 && stats[alias1]) return stats[alias1];
    const alias2 = simNumToUuidMap[preguntaId];
    if (alias2 && stats[alias2]) return stats[alias2];
    return null;
  }, [stats]);

  const guardarNota = useCallback((preguntaId, nota) => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const canonId = getCanonicalId(preguntaId);
    const p = currentStats[canonId] || currentStats[preguntaId] || {
      vecesVistas: 0, aciertos: 0, fallos: 0, ultimaRespuesta: null, ultimaFecha: null, dudosa: false, dominada: false, corregida: false
    };
    const updated = { ...p, nota: (nota || '').trim() };
    const newStats = {
      ...currentStats,
      [canonId]: updated
    };
    if (preguntaId !== canonId) newStats[preguntaId] = updated;
    setGlobalStatsData(newStats);
    syncToCloud(canonId, updated);
  }, []);

  const archivarPregunta = useCallback((preguntaId, motivo = 'missing_data') => {
    if (!preguntaId) return;
    const currentStats = getGlobalStatsData();
    const canonId = getCanonicalId(preguntaId);
    const p = currentStats[canonId] || currentStats[preguntaId] || {
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
      [canonId]: updated
    };
    if (preguntaId !== canonId) newStats[preguntaId] = updated;
    setGlobalStatsData(newStats);
    syncToCloud(canonId, updated);
  }, []);

  const isArchivada = useCallback((preguntaId) => {
    if (!preguntaId) return false;
    const canonId = getCanonicalId(preguntaId);
    const s = stats[canonId] || stats[preguntaId];
    return !!s?.archivada || s?.status === 'archived';
  }, [stats]);

  // Obtener rendimiento global sin duplicación por alias
  const getGlobalStats = useCallback(() => {
    let totalRespuestas = 0;
    let totalAciertos = 0;
    let totalFallos = 0;

    const seenCanonicalKeys = new Set();

    Object.entries(stats).forEach(([key, s]) => {
      if (!s) return;
      const canonId = getCanonicalId(key);
      if (seenCanonicalKeys.has(canonId)) return;
      seenCanonicalKeys.add(canonId);

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
    isSyncing,
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
    flushOfflineSyncQueue,
    getOfflineQueueStats,
    isEnLatencia: (id) => isEnLatencia(id, stats)
  };
}

