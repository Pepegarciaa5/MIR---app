/**
 * Archivo: prioridadesTemas.js
 * Descripción: Sistema de cálculo y extracción de prioridades de repaso por temas.
 * Cruza los últimos 4 MIR oficiales y Simulacros 9-18 con las respuestas originales del alumno.
 */

import desglosesData from '../data/desgloses_filtrables.json';
import simulacrosData from '../data/simulacrosCTO.json';
import textosSimulacros from '../data/simulacros_textos.json';
import { ASIGNATURA_NOMBRE } from './simulacros';

// Normalizador de texto para comparar temas y asignaturas sin fallar por tildes o mayúsculas
export const normText = (str) =>
  (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

// Mapa rápido de textos de simulacros
const mapaTextosSims = new Map();
if (Array.isArray(textosSimulacros)) {
  textosSimulacros.forEach(t => {
    const num = t.numero_pregunta || t.numero;
    mapaTextosSims.set(`${t.simulacro}-${num}`, t);
  });
}

// Convocatorias MIR recientes (últimos 4 exámenes oficiales)
export const CONVOCATORIAS_MIR_RECIENTES = [
  'MIR 2022 - 2023',
  'MIR 2023 - 2024',
  'MIR 2024 - 2025',
  'MIR 2025 - 2026'
];

export const SIMULACRO_MIN_PRIORIDAD = 9;

/**
 * Procesa y calcula las estadísticas de temas y asignaturas
 */
export function getAnalisisPrioridadesTemas() {
  const preguntasSims = Array.isArray(simulacrosData)
    ? simulacrosData
    : (simulacrosData.preguntas || []);

  const topicMap = {};

  function getOrCreateTopic(asignatura, tema) {
    const normAsig = (asignatura || 'Sin Asignatura').trim();
    const normT = (tema || 'General').trim();
    const key = `${normText(normAsig)}:::${normText(normT)}`;

    if (!topicMap[key]) {
      topicMap[key] = {
        key,
        asignatura: normAsig,
        tema: normT,
        mirCount: 0,
        simCount: 0,
        totalCount: 0,
        // Rendimiento en Sims 9-18
        userTotal: 0,
        userAcertadas: 0,
        userFalladas: 0,
        userBlancas: 0,
        userNetas: 0
      };
    }
    return topicMap[key];
  }

  // 1. Contabilizar preguntas MIR (Últimos 4 exámenes)
  desglosesData.forEach(d => {
    if (!CONVOCATORIAS_MIR_RECIENTES.includes(d.convocatoria)) return;
    const t = getOrCreateTopic(d.asignatura, d.tema);
    t.mirCount++;
    t.totalCount++;
  });

  // 2. Contabilizar preguntas de Simulacros (Simulacros >= 9) y respuestas originales
  preguntasSims.forEach(p => {
    if (p.ignorar || p.simulacro < SIMULACRO_MIN_PRIORIDAD) return;

    let asig = (p.clasificaciones && p.clasificaciones[0])
      ? p.clasificaciones[0]
      : (ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura || 'General');

    let tema = (p.clasificaciones && p.clasificaciones.length > 1)
      ? p.clasificaciones[1]
      : 'General';

    const t = getOrCreateTopic(asig, tema);
    t.simCount++;
    t.totalCount++;

    t.userTotal++;
    if (p.acertada) t.userAcertadas++;
    else if (p.fallada) t.userFalladas++;
    else t.userBlancas++;

    t.userNetas += (p.acertada ? 1 : (p.fallada ? -0.3333333333333333 : 0));
  });

  // 3. Calcular scores de prioridad
  const allTopics = Object.values(topicMap).map(t => {
    const pctAcierto = t.userTotal > 0 ? (t.userAcertadas / t.userTotal) * 100 : null;
    const pctFallo = t.userTotal > 0 ? (t.userFalladas / t.userTotal) * 100 : null;
    const tasaNoAcierto = t.userTotal > 0 ? (t.userTotal - t.userAcertadas) / t.userTotal : 0.5;
    const netasPerdidas = (t.userFalladas * 1.333333) + (t.userBlancas * 1.0);

    // Score de prioridad
    const score = t.totalCount * tasaNoAcierto * (1 + (t.userFalladas * 0.15));

    return {
      ...t,
      pctAcierto,
      pctFallo,
      netasPerdidas,
      score
    };
  });

  // Ranking global de temas
  const rankingGlobal = [...allTopics].sort((a, b) => b.score - a.score);

  // Agrupado por Asignatura
  const byAsig = {};
  allTopics.forEach(t => {
    if (!byAsig[t.asignatura]) byAsig[t.asignatura] = [];
    byAsig[t.asignatura].push(t);
  });

  Object.keys(byAsig).forEach(asig => {
    byAsig[asig].sort((a, b) => b.score - a.score);
  });

  // Resumen de asignaturas ordenadas por vulnerabilidad/score acumulado
  const rankingAsignaturas = Object.keys(byAsig).map(asig => {
    const temas = byAsig[asig];
    const totalScore = temas.reduce((acc, t) => acc + t.score, 0);
    const totalPreg = temas.reduce((acc, t) => acc + t.totalCount, 0);
    const mirPreg = temas.reduce((acc, t) => acc + t.mirCount, 0);
    const simPreg = temas.reduce((acc, t) => acc + t.simCount, 0);
    const falladas = temas.reduce((acc, t) => acc + t.userFalladas, 0);
    const acertadas = temas.reduce((acc, t) => acc + t.userAcertadas, 0);
    const pct = simPreg > 0 ? (acertadas / simPreg) * 100 : 0;
    const netasPerdidas = temas.reduce((acc, t) => acc + t.netasPerdidas, 0);

    return {
      asignatura: asig,
      totalScore,
      totalPreg,
      mirPreg,
      simPreg,
      falladas,
      acertadas,
      pct,
      netasPerdidas,
      temas
    };
  }).sort((a, b) => b.totalScore - a.totalScore);

  return {
    rankingGlobal,
    rankingAsignaturas
  };
}

/**
 * Obtiene todas las preguntas (MIR y Simulacros) asociadas a un tema específico.
 */
export function getPreguntasDeTema(asignatura, tema, soloRecientes = true) {
  const normA = normText(asignatura);
  const normT = normText(tema);

  // 1. Preguntas MIR (Desgloses)
  const mirQuestionsRaw = desglosesData.filter(d => {
    const matchAsig = normText(d.asignatura) === normA;
    const matchTema = normText(d.tema) === normT;
    if (!matchAsig || !matchTema) return false;
    if (soloRecientes) {
      return CONVOCATORIAS_MIR_RECIENTES.includes(d.convocatoria);
    }
    return true;
  });

  const mirQuestions = mirQuestionsRaw
    .map(d => ({
      id: d.id,
      origen: 'MIR',
      tipo: 'desglose',
      convocatoria: d.convocatoria || `MIR ${d.anualidad}`,
      anualidad: d.anualidad,
      numero: d.numero || null,
      asignatura: d.asignatura,
      tema: d.tema,
      dificultad: d.dificultad || 3,
      enunciado: d.enunciado || '',
      respuestas: d.respuestas || [],
      respuestaCorrecta: d.respuestas?.find(r => r.correcta)?.numero || 1,
      comentario: d.comentario || '',
      imagen: d.imagen_nombre || null
    }))
    .sort((a, b) => (b.anualidad || 0) - (a.anualidad || 0));

  // 2. Preguntas de Simulacros
  const preguntasSims = Array.isArray(simulacrosData)
    ? simulacrosData
    : (simulacrosData.preguntas || []);

  const simQuestionsRaw = preguntasSims.filter(p => {
    if (p.ignorar) return false;
    if (soloRecientes && p.simulacro < SIMULACRO_MIN_PRIORIDAD) return false;

    const asigP = (p.clasificaciones && p.clasificaciones[0])
      ? p.clasificaciones[0]
      : (ASIGNATURA_NOMBRE[p.asignatura] || p.asignatura || 'General');

    const temaP = (p.clasificaciones && p.clasificaciones.length > 1)
      ? p.clasificaciones[1]
      : 'General';

    return normText(asigP) === normA && normText(temaP) === normT;
  });

  const simQuestions = simQuestionsRaw.map(p => {
    const texto = mapaTextosSims.get(`${p.simulacro}-${p.numero}`) || {};
    return {
      id: p.pregunta_id || `${p.simulacro}-${p.numero}`,
      origen: `Simulacro ${p.simulacro}`,
      tipo: 'simulacro',
      simulacro: p.simulacro,
      numero: p.numero,
      asignatura: asignatura,
      tema: tema,
      dificultad: p.dificultad || 3,
      // Rendimiento del alumno
      acertada: p.acertada === 1,
      fallada: p.fallada === 1,
      nula: p.nula === 1,
      respuestaDada: p.respuesta_dada,
      respuestaCorrecta: p.respuesta_correcta || texto.respuestas?.find(r => r.correcta)?.numero || 1,
      pctPoblacion: p.pct_correcta ? Math.round((p.pct_correcta / 3000) * 100) : null,
      // Texto
      enunciado: texto.enunciado || '',
      respuestas: texto.respuestas || [],
      comentario: texto.comentario || '',
      imagen: texto.imagen_nombre || null
    };
  });

  return {
    mirQuestions,
    simQuestions,
    todas: [...simQuestions, ...mirQuestions]
  };
}

/**
 * Convierte una pregunta a texto plano / Markdown limpio para copiar al portapapeles.
 */
export function formatQuestionAsText(q) {
  let lines = [];
  const header = q.tipo === 'simulacro'
    ? `[Simulacro ${q.simulacro} - Pregunta ${q.numero} | ${q.asignatura} › ${q.tema}]`
    : `[${q.convocatoria} - ${q.asignatura} › ${q.tema}]`;

  lines.push(header);
  
  if (q.tipo === 'simulacro') {
    let estado = q.acertada ? 'ACERTADA' : (q.fallada ? 'FALLADA' : 'EN BLANCO');
    lines.push(`Resultado en examen: ${estado} (Tu respuesta: ${q.respuestaDada || 'Ninguna'} | Correcta: ${q.respuestaCorrecta})`);
  } else {
    lines.push(`Respuesta correcta oficial: Opción ${q.respuestaCorrecta}`);
  }

  lines.push('');
  lines.push(q.enunciado ? q.enunciado.replace(/<[^>]+>/g, '').trim() : '');
  lines.push('');
  lines.push('Opciones:');

  if (q.respuestas && q.respuestas.length > 0) {
    q.respuestas.forEach(r => {
      const isCorrect = r.numero === q.respuestaCorrecta || r.correcta;
      const isUserChoice = q.tipo === 'simulacro' && r.numero === q.respuestaDada;
      let marker = '  ';
      if (isCorrect && isUserChoice) marker = '✓ (Tu respuesta)';
      else if (isCorrect) marker = '✓';
      else if (isUserChoice) marker = '✗ (Tu respuesta)';

      lines.push(`${r.numero}. ${r.enunciado} ${marker ? `[${marker}]` : ''}`);
    });
  }

  if (q.comentario) {
    lines.push('');
    lines.push('Explicación / Comentario:');
    lines.push(q.comentario.replace(/<[^>]+>/g, '').trim());
  }

  lines.push('--------------------------------------------------');
  return lines.join('\n');
}

/**
 * Convierte un conjunto de preguntas de un tema a un documento de texto continuo.
 */
export function formatTopicAsDocument(asignatura, tema, stats, questions) {
  let doc = [];
  doc.push(`==================================================================`);
  doc.push(`📚 ${asignatura.toUpperCase()} — ${tema.toUpperCase()}`);
  doc.push(`==================================================================`);
  if (stats) {
    doc.push(`Preguntas analizadas: ${stats.totalCount} (MIR recientes: ${stats.mirCount}, Simulacros 9-18: ${stats.simCount})`);
    if (stats.pctAcierto !== null) {
      doc.push(`Rendimiento en Simulacros: ${stats.pctAcierto.toFixed(1)}% acierto (${stats.userAcertadas}A / ${stats.userFalladas}F / ${stats.userBlancas}B)`);
      doc.push(`Netas perdidas acumuladas: -${stats.netasPerdidas.toFixed(1)} netas`);
    }
  }
  doc.push(`Total preguntas en este documento: ${questions.length}`);
  doc.push(`==================================================================\n`);

  questions.forEach((q, idx) => {
    doc.push(`### PREGUNTA ${idx + 1} de ${questions.length}`);
    doc.push(formatQuestionAsText(q));
    doc.push('\n');
  });

  return doc.join('\n');
}
