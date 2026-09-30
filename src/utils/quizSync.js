// src/utils/quizSync.js

/**
 * Utilities for synchronizing quiz data with Supabase.
 * This module relies on the existing Supabase client defined in src/lib/supabase.js.
 */
import { supabase } from '../lib/supabase';

// Retrieve or generate an anonymous user ID stored in localStorage.
export function getOrCreateAnonUserId() {
  const KEY = 'mir_user_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    try {
      // Use crypto API if available (modern browsers)
      id = crypto.randomUUID();
    } catch (e) {
      // Fallback to a simple random string
      id = 'uid_' + Math.random().toString(36).substr(2, 9);
    }
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Upsert a question's statistics into Supabase.
 * @param {string} userId   - Anonymous user identifier.
 * @param {string} questionId - Question identifier.
 * @param {object} statsObj - Stats payload (status, confidence, next_review_date, note, etc.).
 */
export async function upsertQuestionStat(userId, questionId, statsObj) {
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

  const { error } = await supabase.from('user_question_stats').upsert(payload, { onConflict: 'user_id,question_id' });
  if (error) console.error('Supabase upsert error (question stat):', error);
  return !error;
}


/**
 * Insert a completed quiz result into Supabase.
 * @param {string} userId - Anonymous user identifier.
 * @param {object} resultPayload - Object containing subject, question_count, answers, total_score, duration_seconds.
 */
export async function createQuizResult(userId, resultPayload) {
  const payload = {
    user_id: userId,
    ...resultPayload,
  };
  const { error } = await supabase.from('user_quiz_results').insert(payload);
  if (error) console.error('Supabase insert error (quiz result):', error);
  return !error;
}
