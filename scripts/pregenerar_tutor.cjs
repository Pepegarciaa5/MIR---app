/**
 * Archivo: scripts/pregenerar_tutor.cjs
 * Descripción: Script de generación por lotes en segundo plano de explicaciones de Gemini 3
 * para todas las preguntas de Desgloses y Simulacros.
 * Guarda incrementalmente en src/data/explicaciones_ia.json.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Cargar .env manualmente si existe
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value.trim();
    }
  });
}

const OUTPUT_FILE = path.join(__dirname, '..', 'src', 'data', 'explicaciones_ia.json');
const DESGLOSES_FILE = path.join(__dirname, '..', 'src', 'data', 'desgloses_filtrables.json');
const BANCO_FILE = path.join(__dirname, '..', 'src', 'data', 'bancoPreguntas.json');

const SUPABASE_URL = 'https://clpjzokhiuavsaboetgn.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGp6b2toaXVhdnNhYm9ldGduIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODA4NTUyMiwiZXhwIjoyMDkzNjYxNTIyfQ.uUrd8iE16WZO1XehRyWZey62eZTrujqEHyqk3DkMPWI';
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || '';
const MODEL = process.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash';

const DELAY_MS = 4000; // 4s entre peticiones = 15 RPM (dentro de los límites de Google AI Studio)

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function loadOutput() {
  try {
    if (fs.existsSync(OUTPUT_FILE)) {
      const raw = fs.readFileSync(OUTPUT_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Error leyendo explicaciones_ia.json, iniciando nuevo mapa:', e.message);
  }
  return {};
}

function saveOutput(data) {
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3-flash-preview'];

async function callGemini(prompt) {
  let lastErr = null;
  for (const m of MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 3072,
          }
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || `HTTP ${res.status}`);
      }

      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Respuesta vacía de Gemini');
      return { text, model: m };
    } catch (err) {
      lastErr = err;
      if (err.message.includes('demand') || err.message.includes('quota') || err.message.includes('429')) {
        continue; // probar siguiente modelo
      }
      throw err;
    }
  }
  throw lastErr || new Error('Todos los modelos fallaron.');
}

async function run() {
  console.log('🚀 Iniciando generador de explicaciones en segundo plano...');
  console.log(`Modelo: ${MODEL} · Delay entre peticiones: ${DELAY_MS / 1000}s`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const cache = loadOutput();
  const existingCount = Object.keys(cache).length;
  console.log(`Explicaciones ya existentes en caché local: ${existingCount}`);

  // 1. Cargar preguntas de Desgloses (>= 2010)
  const desgloses = JSON.parse(fs.readFileSync(DESGLOSES_FILE, 'utf-8'));
  console.log(`Cargados ${desgloses.length} desgloses (2010–2025).`);

  // 2. Cargar preguntas de Simulacros
  const banco = JSON.parse(fs.readFileSync(BANCO_FILE, 'utf-8'));
  const simulacros = banco.filter(q => q.origen?.startsWith('Simulacro') && !q.image && !q.imagen && !q.imagen_nombre);
  console.log(`Cargados ${simulacros.length} preguntas de simulacros válidas.`);

  // 3. Obtener preguntas prioritarias del usuario (las que ya están en juego / respondidas)
  let userActiveIds = new Set();
  try {
    const { data } = await supabase.from('user_question_stats').select('question_id');
    if (data) {
      userActiveIds = new Set(data.map(d => d.question_id));
      console.log(`Preguntas activas en la cuenta del usuario: ${userActiveIds.size}`);
    }
  } catch (e) {
    console.warn('No se pudieron leer user_question_stats, continuando sin orden prioritario:', e.message);
  }

  // 4. Normalizar todas las preguntas a una estructura unificada
  const allCandidates = [];

  desgloses.forEach(d => {
    const correctIdx = d.respuestas ? d.respuestas.findIndex(r => r.correcta) : 0;
    const correctLetter = ['A', 'B', 'C', 'D', 'E'][correctIdx] || '1';
    const correctText = d.respuestas?.[correctIdx]?.enunciado || '';
    const optionsText = (d.respuestas || []).map((r, i) => `${['A', 'B', 'C', 'D', 'E'][i]}) ${r.enunciado}`).join('\n');

    allCandidates.push({
      id: d.id,
      asignatura: d.asignatura || 'General',
      tema: d.tema || 'General',
      origen: d.convocatoria || `MIR ${d.anualidad}`,
      anualidad: d.anualidad || 2010,
      enunciado: d.enunciado,
      optionsText,
      correctLetter,
      correctText,
      comentario: d.comentario || '',
      esPrioritaria: userActiveIds.has(d.id)
    });
  });

  simulacros.forEach(s => {
    const correctIdx = (s.answer || 1) - 1;
    const correctLetter = ['A', 'B', 'C', 'D', 'E'][correctIdx] || String(s.answer);
    const correctText = s.options?.[correctIdx] || '';
    const optionsText = (s.options || []).map((opt, i) => `${['A', 'B', 'C', 'D', 'E'][i]}) ${opt}`).join('\n');

    allCandidates.push({
      id: s.id,
      asignatura: s.asignatura || 'General',
      tema: s.tema || 'General',
      origen: s.origen || 'Simulacro CTO',
      anualidad: 2024,
      enunciado: s.text,
      optionsText,
      correctLetter,
      correctText,
      comentario: s.comentario || '',
      esPrioritaria: userActiveIds.has(s.id)
    });
  });

  // 5. Ordenar por prioridad:
  // - Primero: las que el usuario ya tiene en juego (userActiveIds)
  // - Segundo: las convocatorias más recientes (2025, 2024, 2023...)
  allCandidates.sort((a, b) => {
    if (a.esPrioritaria && !b.esPrioritaria) return -1;
    if (!a.esPrioritaria && b.esPrioritaria) return 1;
    return b.anualidad - a.anualidad;
  });

  // Filtro opcional por asignatura desde la línea de comandos
  const targetAsignatura = process.argv.slice(2).join(' ').trim();
  let pool = allCandidates;
  if (targetAsignatura) {
    const norm = targetAsignatura.toLowerCase();
    pool = allCandidates.filter(q => (q.asignatura || '').toLowerCase().includes(norm));
    console.log(`🎯 Filtrando específicamente por asignatura: "${targetAsignatura}" (${pool.length} preguntas encontradas)`);
  }

  const pendientes = pool.filter(q => !cache[q.id]);
  console.log(`Total candidatos: ${pool.length} | Ya procesadas: ${pool.length - pendientes.length} | Pendientes: ${pendientes.length}`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < pendientes.length; i++) {
    const q = pendientes[i];

    const prompt = `Analiza y razona la siguiente pregunta del examen MIR como tutor médico experto:

ASIGNATURA: ${q.asignatura}
TEMA: ${q.tema}
ORIGEN: ${q.origen}
ENUNCIADO:
${q.enunciado}

OPCIONES:
${q.optionsText}

RESPUESTA CORRECTA: Opción ${q.correctLetter}) ${q.correctText}

${q.comentario ? `COMENTARIO OFICIAL CTO:\n${q.comentario.replace(/<[^>]+>/g, ' ').slice(0, 800)}` : ''}

Estructura obligatoria:
### 🎯 Pivote diagnóstico
(2-3 datos clave del caso que dan el diagnóstico directo).

### ✅ Por qué la opción correcta (${q.correctLetter}) es la acertada
(Fisiopatología, guía clínica y justificación médica sólida).

### ❌ Desglose de distractores
(Explica por qué cada una de las opciones falsas es incorrecta y para qué cuadro clínico sí sería la opción correcta).

### ⚠️ Trampa MIR del tribunal
(La trampa o confusión habitual que busca el examen).

### 💡 Regla de oro / Mnemotecnia MIR
(Frase o regla mnemotécnica contundente para recordar el concepto).`;

    try {
      const { text, model } = await callGemini(prompt);
      cache[q.id] = {
        text,
        modelUsed: model,
        timestamp: new Date().toISOString()
      };
      saveOutput(cache);
      successCount++;
      const currentTotal = Object.keys(cache).length;
      console.log(`[${currentTotal}/${allCandidates.length}] ✅ (${q.asignatura} - ${q.origen}) ${q.id.slice(0, 12)}... guardada (${model})`);
    } catch (err) {
      errorCount++;
      console.warn(`[!] Error en ${q.id}: ${err.message}`);
      if (err.message.includes('quota') || err.message.includes('demand') || err.message.includes('429')) {
        console.log('⏳ Esperando 20 segundos por saturación de cuota...');
        await sleep(20000);
      }
    }

    await sleep(DELAY_MS);
  }

  console.log(`🏁 Proceso completado. Éxitos: ${successCount}, Errores: ${errorCount}`);
}

run();
