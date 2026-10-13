// src/utils/quizSync.js

/**
 * Utilities for synchronizing quiz data with Supabase and managing
 * an offline sync queue for uninterrupted offline study.
 */
import { supabase } from '../lib/supabase';

const QUEUE_STATS_KEY = 'mir_offline_stats_queue';
const QUEUE_RESULTS_KEY = 'mir_offline_quiz_results_queue';
const LAST_SYNC_KEY = 'mir_last_sync_timestamp';

// Retrieve or generate a unified user ID stored in localStorage.
export function getOrCreateAnonUserId() {
  const KEY = 'mir_user_id';
  localStorage.setItem(KEY, 'mir_user_main');
  return 'mir_user_main';
}

function getStoredStatsQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_STATS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.error('Error leyendo cola de stats offline:', e);
    return {};
  }
}

function setStoredStatsQueue(queue) {
  try {
    localStorage.setItem(QUEUE_STATS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error guardando cola de stats offline:', e);
  }
}

function getStoredResultsQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_RESULTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error leyendo cola de resultados offline:', e);
    return [];
  }
}

function setStoredResultsQueue(queue) {
  try {
    localStorage.setItem(QUEUE_RESULTS_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('Error guardando cola de resultados offline:', e);
  }
}

export function getLastSyncTimestamp() {
  return localStorage.getItem(LAST_SYNC_KEY) || null;
}

export function getOfflineQueueStats() {
  const statsQueue = getStoredStatsQueue();
  const resultsQueue = getStoredResultsQueue();
  return {
    pendingStatsCount: Object.keys(statsQueue).length,
    pendingResultsCount: resultsQueue.length,
    lastSyncTime: getLastSyncTimestamp()
  };
}

/**
 * Encola una estadística de pregunta para subir a Supabase.
 */
export function enqueueQuestionStat(userId, questionId, statsObj) {
  const queue = getStoredStatsQueue();
  const payload = {
    user_id: userId,
    question_id: questionId,
    subject: statsObj.subject || 'General',
    status: statsObj.status || 'needs_review',
    note: statsObj.note ?? statsObj.nota ?? '',
    confidence_history: statsObj.confidence_history || [],
  };
  if (statsObj.racha_verde !== undefined) payload.racha_verde = statsObj.racha_verde;
  if (statsObj.latencia_hasta !== undefined) payload.latencia_hasta = statsObj.latencia_hasta;
  if (statsObj.puntuacion_prioridad !== undefined) payload.puntuacion_prioridad = statsObj.puntuacion_prioridad;
  payload.updated_at = new Date().toISOString();

  queue[questionId] = payload;
  setStoredStatsQueue(queue);
  return payload;
}

/**
 * Encola el resultado completo de un test finalizado para subir a Supabase.
 */
export function enqueueQuizResult(userId, resultPayload) {
  const queue = getStoredResultsQueue();
  const item = {
    _client_id: `res_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    user_id: userId,
    created_at: new Date().toISOString(),
    ...resultPayload
  };
  queue.push(item);
  setStoredResultsQueue(queue);
  return item;
}

/**
 * Sube un bloque de estadísticas de preguntas a Supabase en lotes de hasta 50.
 */
async function uploadStatsInChunks(payloads) {
  const CHUNK_SIZE = 50;
  for (let i = 0; i < payloads.length; i += CHUNK_SIZE) {
    const chunk = payloads.slice(i, i + CHUNK_SIZE).map(p => {
      // Eliminar campos internos antes de enviar a Supabase
      const { updated_at, ...supabasePayload } = p;
      return supabasePayload;
    });

    const { error } = await supabase
      .from('user_question_stats')
      .upsert(chunk, { onConflict: 'user_id,question_id' });

    if (error) {
      throw error;
    }
  }
}

/**
 * Vacía la cola de sincronización offline subiendo todo lo pendiente a Supabase.
 * Devuelve el estado de la sincronización.
 */
export async function flushOfflineSyncQueue() {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const statsQueue = getStoredStatsQueue();
  const resultsQueue = getStoredResultsQueue();
  const pendingStatsList = Object.values(statsQueue);

  if (!isOnline) {
    return {
      success: false,
      isOnline: false,
      reason: 'offline',
      pendingStats: pendingStatsList.length,
      pendingResults: resultsQueue.length,
      lastSyncTime: getLastSyncTimestamp()
    };
  }

  if (pendingStatsList.length === 0 && resultsQueue.length === 0) {
    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);
    return {
      success: true,
      isOnline: true,
      syncedStats: 0,
      syncedResults: 0,
      pendingStats: 0,
      pendingResults: 0,
      lastSyncTime: now
    };
  }

  try {
    let syncedStatsCount = 0;
    let syncedResultsCount = 0;

    // 1. Subir preguntas pendientes por lotes
    if (pendingStatsList.length > 0) {
      await uploadStatsInChunks(pendingStatsList);
      syncedStatsCount = pendingStatsList.length;
      // Limpiar cola de preguntas si tuvo éxito
      setStoredStatsQueue({});
    }

    // 2. Subir resultados de tests pendientes
    if (resultsQueue.length > 0) {
      const remainingResults = [];
      for (const item of resultsQueue) {
        const { _client_id, ...cleanResult } = item;
        const { error } = await supabase.from('user_quiz_results').insert(cleanResult);
        if (error) {
          console.error('Error insertando resultado de test:', error);
          remainingResults.push(item);
        } else {
          syncedResultsCount++;
        }
      }
      setStoredResultsQueue(remainingResults);
    }

    const now = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_KEY, now);

    return {
      success: true,
      isOnline: true,
      syncedStats: syncedStatsCount,
      syncedResults: syncedResultsCount,
      pendingStats: 0,
      pendingResults: getStoredResultsQueue().length,
      lastSyncTime: now
    };
  } catch (err) {
    console.error('Error al sincronizar cola offline con Supabase:', err);
    return {
      success: false,
      isOnline: true,
      error: err.message || 'Error de conexión con Supabase',
      pendingStats: Object.keys(getStoredStatsQueue()).length,
      pendingResults: getStoredResultsQueue().length,
      lastSyncTime: getLastSyncTimestamp()
    };
  }
}

/**
 * Upsert a question's statistics into Supabase with offline queue fallback.
 */
export async function upsertQuestionStat(userId, questionId, statsObj) {
  // Siempre encolar primero para que quede blindado en localStorage
  const payload = enqueueQuestionStat(userId, questionId, statsObj);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true; // Guardado offline con éxito
  }

  try {
    const { error } = await supabase
      .from('user_question_stats')
      .upsert(payload, { onConflict: 'user_id,question_id' });

    if (!error) {
      // Eliminar de la cola si se subió correctamente
      const queue = getStoredStatsQueue();
      delete queue[questionId];
      setStoredStatsQueue(queue);
      return true;
    } else {
      console.warn('Upsert individual falló, se mantiene en cola offline:', error.message);
      return false;
    }
  } catch (e) {
    console.warn('Excepción de red en upsert individual, encolado para reintento:', e.message);
    return false;
  }
}

/**
 * Insert a completed quiz result into Supabase with offline queue fallback.
 */
export async function createQuizResult(userId, resultPayload) {
  const item = enqueueQuizResult(userId, resultPayload);

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return true; // Encolado offline con éxito
  }

  try {
    const { _client_id, ...cleanResult } = item;
    const { error } = await supabase.from('user_quiz_results').insert(cleanResult);

    if (!error) {
      // Quitar de la cola de resultados
      const queue = getStoredResultsQueue().filter(r => r._client_id !== _client_id);
      setStoredResultsQueue(queue);
      return true;
    } else {
      console.warn('Insert de resultado falló, se mantiene en cola offline:', error.message);
      return false;
    }
  } catch (e) {
    console.warn('Excepción de red en insert de resultado, encolado:', e.message);
    return false;
  }
}

// Listener global para auto-sincronizar en cuanto se restablezca la conexión
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('📡 Conexión a Internet detectada. Sincronizando cola pendiente con Supabase...');
    flushOfflineSyncQueue().catch(err => console.warn('Error en auto-sync online:', err));
  });
}
