/**
 * Archivo: src/lib/geminiTutor.js
 * Descripción: Servicio de tutoría médica con IA para el examen MIR utilizando la API de Google Gemini.
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';
const PRIMARY_MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'];

const SYSTEM_INSTRUCTION = `Eres un tutor médico de élite especializado en la preparación del examen MIR en España (con dominio absoluto de manuales CTO, AMIR, guías clínicas vigentes y estilo de preguntas del Ministerio de Sanidad).

Tu misión es corregir y razonar la pregunta que te envía el opositor con la máxima pedagogía médica, rigor y mentalidad de examen MIR.

ESTRUCTURA OBLIGATORIA DE TU RESPUESTA:

### 🎯 Pivote diagnóstico
Identifica los 2 o 3 datos cruciales del caso clínico (edad, tiempo de evolución, antecedentes clave, hallazgo guía en exploración o analítica) que orientan todo el cuadro.

### ❌ Análisis de distractores y error
- Si el usuario falló la pregunta o dudó: analiza directamente por qué su opción elegida es incorrecta o una trampa, y para qué patología sí sería la respuesta correcta.
- Explica de forma concisa los matices del resto de opciones falsas.

### ✅ Por qué la opción correcta es la acertada
Fisiopatología directa, criterio diagnóstico o indicación terapéutica de primera línea según las guías clínicas actuales del MIR.

### ⚠️ Trampa MIR del tribunal
Explica la trampa habitual en la que suele caer el opositor con este tipo de casos y cómo detectarla rápidamente.

### 💡 Regla de oro / Mnemotecnia MIR
Una regla mnemotécnica clara, ingeniosa o una "perla MIR" en una sola frase contundente para recordar este concepto y no volver a fallarlo.

PAUTAS DE ESTILO:
- Tono: motivador, clínico, directo y empático (como un R1 o R2 brillante enseñando a un opositor).
- Usa negritas en términos médicos clave.
- Sé conciso: ve al grano sin rodeos innecesarios.`;

import EXPLICACIONES_PREGENERADAS from '../data/explicaciones_ia.json';

const CACHE_PREFIX = 'mir_tutor_cache_';

/**
 * Obtiene la explicación almacenada en caché para una pregunta concreta.
 * Busca primero en localStorage (conversaciones o customizaciones recientes)
 * y a continuación en el banco pregenerado por lotes.
 */
export function getCachedExplanation(questionId) {
  if (!questionId) return null;
  // 1. LocalStorage del navegador
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${questionId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  // 2. Base de datos de explicaciones pregeneradas
  if (EXPLICACIONES_PREGENERADAS && EXPLICACIONES_PREGENERADAS[questionId]) {
    const pre = EXPLICACIONES_PREGENERADAS[questionId];
    return {
      text: pre.text,
      modelUsed: pre.modelUsed || 'Gemini 3.5 Flash',
      timestamp: pre.timestamp,
      isPregenerated: true,
      history: [
        { role: 'model', content: pre.text }
      ]
    };
  }

  return null;
}

/**
 * Guarda la explicación en caché.
 */
export function setCachedExplanation(questionId, data) {
  if (!questionId) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${questionId}`, JSON.stringify(data));
  } catch (e) {
    console.warn('Error guardando en caché del tutor:', e);
  }
}

/**
 * Envía una solicitud a la API de Gemini con reintento y fallback a modelos alternativos.
 */
async function callGeminiAPI(modelName, contents, systemInstruction = SYSTEM_INSTRUCTION) {
  if (!API_KEY) {
    throw new Error('No se ha configurado VITE_GEMINI_API_KEY en el archivo .env');
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;

  const body = {
    contents,
    systemInstruction: {
      parts: [{ text: systemInstruction }]
    },
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    }
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await res.json();

  if (!res.ok) {
    const errorMsg = data?.error?.message || `HTTP ${res.status}`;
    throw new Error(errorMsg);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('La respuesta de Gemini no contiene texto válido.');
  }

  return text;
}

/**
 * Solicita una explicación clínica personalizada para una pregunta respondida.
 */
export async function solicitarExplicacionTutor({
  question,
  userAnswer = null,
  isCorrect = false,
  confidence = null,
  discardedOptions = [],
  commentary = '',
  forceRefresh = false
}) {
  if (!question || !question.id) throw new Error('Pregunta no válida');

  // Comprobar caché si no se fuerza la recarga
  if (!forceRefresh) {
    const cached = getCachedExplanation(question.id);
    if (cached && cached.text) return cached;
  }

  const optionsText = (question.options || []).map((opt, idx) => {
    const letra = ['A', 'B', 'C', 'D', 'E'][idx] || String(idx + 1);
    const text = typeof opt === 'string' ? opt : (opt.text || opt.enunciado || '');
    return `${letra}) ${text}`;
  }).join('\n');

  const userSelectedStr = userAnswer ? `Opción ${userAnswer}` : 'No indicada / en blanco';
  const correctStr = question.correctOption || question.answer || 'No indicada';
  const confidenceStr = confidence === 'green' ? 'Seguro (Verde)' : confidence === 'orange' ? 'Dudoso (Naranja)' : 'Inseguro (Rojo)';
  const discardedStr = discardedOptions.length > 0 ? discardedOptions.join(', ') : 'Ninguna';

  const userPrompt = `Analiza y razona la siguiente pregunta del examen MIR:

ASIGNATURA: ${question.asignatura || 'General'}
TEMA: ${question.tema || 'No especificado'}
ENUNCIADO:
${question.text || question.enunciado}

OPCIONES:
${optionsText}

RESPUESTA CORRECTA: ${correctStr}
RESPUESTA DEL OPOSITOR: ${userSelectedStr} (${isCorrect ? 'ACERTADA' : 'FALLADA'})
NIVEL DE SEGURIDAD AL RESPONDER: ${confidenceStr}
OPCIONES PREVIAMENTE DESCARTADAS POR EL OPOSITOR: ${discardedStr}

${commentary ? `COMENTARIO OFICIAL CTO DE APOYO:\n${commentary.replace(/<[^>]+>/g, ' ').slice(0, 1000)}` : ''}

Por favor, corrige y explica el caso siguiendo estrictamente las 5 secciones estructuradas.`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ];

  // Intento con el modelo principal y fallback automático si está saturado
  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS.filter(m => m !== PRIMARY_MODEL)];
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const replyText = await callGeminiAPI(model, contents);
      const resultObj = {
        text: replyText,
        modelUsed: model,
        timestamp: new Date().toISOString(),
        history: [
          { role: 'user', content: userPrompt },
          { role: 'model', content: replyText }
        ]
      };
      setCachedExplanation(question.id, resultObj);
      return resultObj;
    } catch (err) {
      console.warn(`Error con modelo ${model}:`, err.message);
      lastError = err;
      // Si el error es de sobrecarga temporal (503/429) o 404, prueba el siguiente modelo
      if (err.message.includes('demand') || err.message.includes('quota') || err.message.includes('404')) {
        continue;
      }
      break;
    }
  }

  throw lastError || new Error('No se pudo conectar con el tutor de Gemini.');
}

/**
 * Envía una repregunta en la misma conversación sobre la pregunta médica.
 */
export async function enviarRepreguntaTutor({
  questionId,
  history = [],
  userQuestion,
  model = PRIMARY_MODEL
}) {
  if (!userQuestion || !userQuestion.trim()) return null;

  const contents = history.map(h => ({
    role: h.role === 'model' || h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));

  contents.push({
    role: 'user',
    parts: [{ text: userQuestion.trim() }]
  });

  const replyText = await callGeminiAPI(model, contents);

  const newHistory = [
    ...history,
    { role: 'user', content: userQuestion.trim() },
    { role: 'model', content: replyText }
  ];

  const cached = getCachedExplanation(questionId) || {};
  cached.history = newHistory;
  setCachedExplanation(questionId, cached);

  return {
    reply: replyText,
    history: newHistory
  };
}

/**
 * Extrae la mnemotecnia o perla para guardarla como flashcard.
 */
export function extraerMnemotecnia(textoCompleto) {
  if (!textoCompleto) return '';
  const match = textoCompleto.match(/###\s*💡\s*Regla de oro[^\n]*\n+([\s\S]*?)(?=(###|$))/i);
  if (match && match[1]) {
    return match[1].replace(/[*_#>`]/g, '').trim();
  }
  return '';
}

/**
 * Extrae un resumen conciso para la nota personal.
 */
export function extraerResumenNota(textoCompleto) {
  if (!textoCompleto) return '';
  const perla = extraerMnemotecnia(textoCompleto);
  if (perla) return perla;
  // Tomar los primeros 250 caracteres
  return textoCompleto.slice(0, 250).replace(/[*_#>`]/g, '').trim();
}
