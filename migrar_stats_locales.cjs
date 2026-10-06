const { createClient } = require('@supabase/supabase-js');

const url = 'https://clpjzokhiuavsaboetgn.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGp6b2toaXVhdnNhYm9ldGduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4NTUyMiwiZXhwIjoyMDkzNjYxNTIyfQ.uUrd8iE16WZO1XehRyWZey62eZTrujqEHyqk3DkMPWI';

const supabase = createClient(url, key);

async function migrar() {
  console.log('🔄 Iniciando unificación no destructiva en Supabase Cloud...');

  // 1. Obtener todas las filas de user_question_stats en la nube
  const { data: allStats, error: fetchErr } = await supabase
    .from('user_question_stats')
    .select('*');

  if (fetchErr) {
    console.error('❌ Error leyendo Supabase:', fetchErr.message);
    return;
  }

  console.log(`📊 Encontrados ${allStats.length} registros en Supabase Cloud.`);

  // 2. Agrupar por question_id conservando el registro con mayor historial o fecha más reciente
  const mapByQuestion = new Map();

  for (const row of allStats) {
    const qId = row.question_id;
    if (!qId) continue;

    const existing = mapByQuestion.get(qId);
    if (!existing) {
      mapByQuestion.set(qId, row);
    } else {
      // Comparar cuál tiene mejor/más reciente información
      const dateExisting = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const dateRow = new Date(row.updated_at || row.created_at || 0).getTime();

      const confHistExisting = Array.isArray(existing.confidence_history) ? existing.confidence_history.length : 0;
      const confHistRow = Array.isArray(row.confidence_history) ? row.confidence_history.length : 0;

      if (dateRow > dateExisting || confHistRow > confHistExisting) {
        mapByQuestion.set(qId, row);
      }
    }
  }

  console.log(`✨ Fusionando ${mapByQuestion.size} preguntas únicas hacia el usuario unificado 'mir_user_main'...`);

  // 3. Re-escribir con user_id = 'mir_user_main'
  let exito = 0;
  let errores = 0;

  for (const [qId, row] of mapByQuestion.entries()) {
    const payload = {
      user_id: 'mir_user_main',
      question_id: qId,
      subject: row.subject || 'General',
      status: row.status || 'needs_review',
      note: row.note || '',
      confidence_history: row.confidence_history || [],
      racha_verde: row.racha_verde || 0,
      latencia_hasta: row.latencia_hasta || null,
      puntuacion_prioridad: row.puntuacion_prioridad || 7
    };

    const { error: upsertErr } = await supabase
      .from('user_question_stats')
      .upsert(payload, { onConflict: 'user_id,question_id' });

    if (upsertErr) {
      console.error(`Error al upsert de pregunta ${qId}:`, upsertErr.message);
      errores++;
    } else {
      exito++;
    }
  }

  console.log(`✅ Fusión completada: ${exito} preguntas unificadas en Supabase (Errores: ${errores}).`);
}

migrar();
