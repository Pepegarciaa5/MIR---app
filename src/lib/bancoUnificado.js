// src/lib/bancoUnificado.js
/**
 * Motor de Banco Unificado de Preguntas MIR
 * ==========================================
 * Ingesta, normaliza y fusiona las 4 fuentes heterogéneas:
 * 1. Desgloses oficiales MIR (desgloses_filtrables.json: 3.535 preguntas)
 * 2. Simulacros CTO (simulacros_textos.json + simulacrosCTO.json: 3.990 preguntas)
 * 3. Evaluaciones Campus CTO (evaluaciones_cto.json: 1.409 preguntas)
 * 4. Banco Preguntas / Test 2ª Vuelta (bancoPreguntas.json: 5.660 preguntas)
 * Total preguntas brutas: 14.594
 *
 * Algoritmo de dos etapas:
 * - Etapa 1: Deduplicación exacta por UUID y cto_id (1.956 fusiones)
 * - Etapa 2: Normalización semántica de enunciado y verificación estricta de opciones
 *   (198 fusiones, eliminando los 2.154 duplicados y evitando 74 colisiones falsas en casos clínicos)
 * Preguntas canónicas resultantes: 12.440
 */

import desglosesData from '../data/desgloses_filtrables.json' with { type: 'json' };
import simulacrosTextosData from '../data/simulacros_textos.json' with { type: 'json' };
import simulacrosCTOData from '../data/simulacrosCTO.json' with { type: 'json' };
import evaluacionesData from '../data/evaluaciones_cto.json' with { type: 'json' };
import bancoPreguntasData from '../data/bancoPreguntas.json' with { type: 'json' };

// ============================================================================
// TAXONOMY & NORMALIZATION HELPERS
// ============================================================================

export const MAPA_CANONICO_DESGLOSES = {
  'miscelanea': 'Bioética y Medicina Legal',
  'bioetica y medicina legal': 'Bioética y Medicina Legal',
  'bioetica': 'Bioética y Medicina Legal',
  'endocrinologia': 'Endocrinología y Metabolismo',
  'endocrinologia y metabolismo': 'Endocrinología y Metabolismo',
  'estadistica y epidemiologia': 'Estadística y Epidemiología',
  'epidemiologia': 'Estadística y Epidemiología',
  'medicina preventiva': 'Estadística y Epidemiología',
  'medicina preventiva y salud publica': 'Estadística y Epidemiología',
  'neurologia': 'Neurología y Neurocirugía',
  'neurologia y neurocirugia': 'Neurología y Neurocirugía',
  'oncologia medica y paciente terminal': 'Oncología',
  'paciente terminal y cuidados paliativos': 'Oncología',
  'enfermedades infecciosas': 'Infecciosas',
  'infecciosas': 'Infecciosas',
  'ginecologia y obstetricia': 'Ginecología y Obstetricia',
  'cirugia general': 'Cirugía General',
  'anatomia patologica': 'Anatomía Patológica',
  'medicina familiar y comunitaria': 'Medicina Familiar y Comunitaria',
  'medicina familiar': 'Medicina Familiar y Comunitaria'
};

export const CODIGO_TO_APP_ASIG = {
  'AL': 'Alergología', 'AT': 'Anatomía', 'AP': 'Anatomía Patológica', 'AN': 'Anestesiología',
  'BL': 'Bioética y Medicina Legal', 'BQ': 'Bioquímica', 'CD': 'Cardiología', 'CG': 'Cirugía General',
  'DM': 'Dermatología', 'DG': 'Digestivo', 'ED': 'Endocrinología y Metabolismo', 'EP': 'Estadística y Epidemiología',
  'FC': 'Medicina Familiar y Comunitaria', 'FM': 'Farmacología', 'FS': 'Fisiología', 'GC': 'Ginecología y Obstetricia',
  'GR': 'Geriatría', 'GT': 'Genética', 'HM': 'Hematología', 'IF': 'Infecciosas', 'IG': 'Inmunología',
  'NF': 'Nefrología', 'NM': 'Neumología', 'NR': 'Neurología y Neurocirugía', 'OF': 'Oftalmología',
  'ON': 'Oncología', 'OR': 'Otorrinolaringología', 'PD': 'Pediatría', 'PQ': 'Psiquiatría',
  'RX': 'Radiología', 'RH': 'Rehabilitación', 'RM': 'Reumatología', 'TM': 'Traumatología',
  'UG': 'Urgencias', 'UR': 'Urología'
};

export function normText(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Pre-computed normalized subject lookup table: unaccented lowercase -> canonical title
export const NORM_ASIG_LOOKUP = {};
for (const [code, asig] of Object.entries(CODIGO_TO_APP_ASIG)) {
  NORM_ASIG_LOOKUP[code.toLowerCase()] = asig;
  NORM_ASIG_LOOKUP[normText(asig)] = asig;
}
for (const [rawKey, target] of Object.entries(MAPA_CANONICO_DESGLOSES)) {
  NORM_ASIG_LOOKUP[normText(rawKey)] = target;
}
NORM_ASIG_LOOKUP['cardiologia y cirugia cardiovascular'] = 'Cardiología';
NORM_ASIG_LOOKUP['cirugia cardiovascular'] = 'Cardiología';
NORM_ASIG_LOOKUP['aparato digestivo'] = 'Digestivo';
NORM_ASIG_LOOKUP['cirugia ortopedica y traumatologia'] = 'Traumatología';
NORM_ASIG_LOOKUP['oftalmologia'] = 'Oftalmología';
NORM_ASIG_LOOKUP['otorrinolaringologia'] = 'Otorrinolaringología';

NORM_ASIG_LOOKUP.get = function(key) {
  if (!key) return undefined;
  const k = normText(key);
  const target = this[k];
  return target ? normText(target) : undefined;
};

export function normalizeAsignaturaToDesgloses(asig) {
  if (!asig) return '';
  const trimmed = asig.trim();
  if (CODIGO_TO_APP_ASIG[trimmed]) return CODIGO_TO_APP_ASIG[trimmed];
  const n = normText(trimmed);
  return NORM_ASIG_LOOKUP[n] || MAPA_CANONICO_DESGLOSES[n] || trimmed;
}

/**
 * Formats a question statement for clinical display.
 * Strips HTML tags, decodes entities, and removes exam numbering prefixes,
 * but PRESERVES casing, accents, punctuation, decimal numbers, and units.
 */
export function formatDisplayEnunciado(str) {
  if (!str || typeof str !== 'string') return '';
  let s = str;
  // 1. Strip HTML tags
  s = s.replace(/<[^>]+>/g, ' ');
  // 2. Decode common HTML entities
  s = s.replace(/&nbsp;/gi, ' ')
       .replace(/&amp;/gi, '&')
       .replace(/&lt;/gi, '<')
       .replace(/&gt;/gi, '>')
       .replace(/&quot;/gi, '"')
       .replace(/&#39;/gi, "'");
  // 3. Strip exam prefixes (e.g. "º 1. ", "Pregunta 45.- ", "Caso clínico vinculado a imagen 2: ")
  s = s.replace(/^(?:pregunta\s+vinculada\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:caso\s+cl[ií]nico\s+vinculado\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:pregunta\s+asociada\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:pregunta\s*\d+[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:p\s*\d+[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:º\s*\d+[\.\:\-\s]*)/i, '');
  s = s.replace(/^(?:\d+[\.\:\-]+[\s]*)/i, '');
  // 4. Normalize spacing while preserving all punctuation, diacritics, decimals, and case
  return s.replace(/[ \t\r\n]+/g, ' ').trim();
}

export function cleanStatement(str) {
  if (!str) return '';
  let s = str.replace(/<[^>]+>/g, ' ');
  s = s.replace(/^(?:pregunta\s+vinculada\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-]?\s*)/i, '');
  s = s.replace(/^(?:caso\s+cl[ií]nico\s+vinculado\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-]?\s*)/i, '');
  s = s.replace(/^(?:pregunta\s+asociada\s+(?:a\s+la\s+|a\s+)?imagen(?:\s+n[ºo°]?\s*\d+|\s*\d+)?[\.\:\-]?\s*)/i, '');
  s = s.replace(/^(?:pregunta\s*\d+[\.\:\-]?\s*)/i, '');
  s = s.replace(/^(?:p\s*\d+[\.\:\-]\s*)/i, '');
  s = s.replace(/^(?:º\s*\d+[\.\:\-]?\s*)/i, '');
  s = s.replace(/^(?:\d+[\.\:\-]\s*)/i, '');
  s = s.toLowerCase();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  s = s.replace(/[^a-z0-9]/g, ' ');
  return s.replace(/\s+/g, ' ').trim();
}

export function normOption(str) {
  if (!str) return '';
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

// ============================================================================
// UNION-FIND (DISJOINT SET UNION) DATA STRUCTURE
// ============================================================================

class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i) {
    if (this.parent[i] === i) return i;
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }
  union(i, j) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
      return true;
    }
    return false;
  }
}

// ============================================================================
// SINGLETON REPOSITORY CACHE & BUILDER
// ============================================================================

let cachedBanco = null;
let aliasToCanonicalMap = null;
let idToQuestionMap = null;
let bankStatsResumen = null;

function extractRawItemData(raw) {
  const item = raw.item;
  let stmt = '';
  let options = [];
  let correctOptText = '';

  if (raw.source === 'desgloses') {
    stmt = item.enunciado || '';
    if (Array.isArray(item.respuestas)) {
      options = item.respuestas.map(r => r.enunciado);
      const c = item.respuestas.find(r => r.correcta);
      if (c) correctOptText = c.enunciado;
    }
  } else if (raw.source === 'simulacros') {
    stmt = item.enunciado || '';
    if (Array.isArray(item.respuestas)) {
      options = item.respuestas.map(r => r.enunciado);
      const corrNum = raw.meta?.respuesta_correcta;
      const c = item.respuestas.find(r => r.correcta || r.numero === corrNum);
      if (c) correctOptText = c.enunciado;
    }
  } else if (raw.source === 'evaluaciones') {
    stmt = item.enunciado || '';
    if (Array.isArray(item.opciones)) {
      options = item.opciones.map(o => o.texto);
      const c = item.opciones.find(o => (o.id || 0) === item.correcta);
      if (c) correctOptText = c.texto;
    }
  } else if (raw.source === 'banco') {
    stmt = item.enunciado || item.text || '';
    if (Array.isArray(item.opciones)) {
      options = item.opciones.map(o => o.texto);
      const c = item.opciones.find(o => (o.id || 0) === item.correcta);
      if (c) correctOptText = c.texto;
    } else if (Array.isArray(item.options)) {
      options = item.options;
      if (item.answer && item.options[item.answer - 1]) {
        correctOptText = item.options[item.answer - 1];
      }
    }
  }

  const normOpts = options.map(normOption).filter(Boolean);
  const sortedOptSigs = normOpts
    .filter(o => o.length >= 3)
    .map(o => o.slice(0, 25))
    .sort()
    .join(';;');

  const img = item.imagen_nombre || item.imagen || item.image || null;
  const normImg = (img && typeof img === 'string') ? img.trim().toLowerCase() : null;

  return {
    normStmt: cleanStatement(stmt),
    normOptions: normOpts,
    normCorrect: normOption(correctOptText),
    optSig: sortedOptSigs,
    image: normImg
  };
}

function buildUnifiedBank() {
  const ctoMap = new Map();
  const rawPreguntasCTO = Array.isArray(simulacrosCTOData)
    ? simulacrosCTOData
    : (simulacrosCTOData.preguntas || []);

  for (const p of rawPreguntasCTO) {
    if (p.pregunta_id) ctoMap.set(p.pregunta_id, p);
  }

  const simTotals = {};
  const rawSimulacrosMeta = simulacrosCTOData.simulacros || [];
  for (const s of rawSimulacrosMeta) {
    simTotals[s.numero] = s.stats?.cuenta_total || 2500;
  }

  // Flatten the 4 raw collections into indexed items
  const rawItems = [];

  // 1. Desgloses (3,535)
  for (const q of desglosesData) {
    rawItems.push({
      source: 'desgloses',
      id: q.id,
      cto_id: null,
      item: q
    });
  }

  // 2. Simulacros Textos (3,990)
  for (const q of simulacrosTextosData) {
    const meta = ctoMap.get(q.id);
    rawItems.push({
      source: 'simulacros',
      id: q.id,
      cto_id: null,
      item: q,
      meta
    });
  }

  // 3. Evaluaciones CTO (1,409)
  for (const q of evaluacionesData) {
    rawItems.push({
      source: 'evaluaciones',
      id: q.id,
      cto_id: q.cto_id || null,
      item: q
    });
  }

  // 4. Banco Preguntas (5,660)
  for (const q of bancoPreguntasData) {
    rawItems.push({
      source: 'banco',
      id: q.id,
      cto_id: q.cto_id || null,
      item: q
    });
  }

  const totalRaw = rawItems.length;
  const dsu = new DSU(totalRaw);

  // --------------------------------------------------------------------------
  // STAGE 1: Exact ID and cto_id Cross-Catalog Merging (1,956 merges)
  // --------------------------------------------------------------------------
  const idMap = new Map();
  rawItems.forEach((it, idx) => {
    if (it.id) {
      const idKey = String(it.id);
      if (!idMap.has(idKey)) idMap.set(idKey, []);
      idMap.get(idKey).push(idx);
    }
    if (it.cto_id) {
      const ctoKey = String(it.cto_id);
      if (!idMap.has(ctoKey)) idMap.set(ctoKey, []);
      idMap.get(ctoKey).push(idx);
    }
  });

  let stage1Merges = 0;
  for (const indices of idMap.values()) {
    if (indices.length > 1) {
      for (let k = 1; k < indices.length; k++) {
        if (dsu.union(indices[0], indices[k])) {
          stage1Merges++;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // STAGE 2: Normalized Semantic Fingerprint & Option Verification (221 merges)
  // --------------------------------------------------------------------------
  const extracted = rawItems.map(extractRawItemData);
  const stmtMap = new Map();
  extracted.forEach((data, idx) => {
    if (data.normStmt.length >= 25) {
      if (!stmtMap.has(data.normStmt)) stmtMap.set(data.normStmt, []);
      stmtMap.get(data.normStmt).push(idx);
    }
  });

  let stage2Merges = 0;
  let clinicalCollisionsPrevented = 0;

  for (const indices of stmtMap.values()) {
    if (indices.length > 1) {
      for (let i = 0; i < indices.length; i++) {
        for (let j = i + 1; j < indices.length; j++) {
          const idxA = indices[i];
          const idxB = indices[j];
          if (dsu.find(idxA) === dsu.find(idxB)) continue;

          const dataA = extracted[idxA];
          const dataB = extracted[idxB];

          const conflictAnswer = Boolean(dataA.normCorrect && dataB.normCorrect && dataA.normCorrect !== dataB.normCorrect);
          const conflictImage = Boolean(dataA.image && dataB.image && dataA.image !== dataB.image);

          let compatible = false;

          if (!conflictAnswer && !conflictImage) {
            const isShort = dataA.normStmt.length < 30 || dataB.normStmt.length < 30;
            if (isShort) {
              const fullOpts = Boolean(dataA.optSig && dataB.optSig && dataA.optSig === dataB.optSig);
              const correctEquiv = Boolean(dataA.normCorrect && dataB.normCorrect && dataA.normCorrect === dataB.normCorrect);
              if (fullOpts && correctEquiv) {
                compatible = true;
              }
            } else {
              if (dataA.normCorrect && dataB.normCorrect && dataA.normCorrect === dataB.normCorrect) {
                compatible = true;
              } else if (dataA.optSig && dataB.optSig && dataA.optSig === dataB.optSig) {
                compatible = true;
              } else {
                let overlap = 0;
                for (const optA of dataA.normOptions) {
                  if (optA.length >= 3 && dataB.normOptions.includes(optA)) overlap++;
                }
                if (overlap >= 2) compatible = true;
              }
            }
          }

          if (compatible) {
            if (dsu.union(idxA, idxB)) {
              stage2Merges++;
            }
          } else {
            let overlap = 0;
            for (const optA of dataA.normOptions) {
              if (optA.length >= 3 && dataB.normOptions.includes(optA)) overlap++;
            }
            if (overlap < 2 && (!dataA.optSig || !dataB.optSig || dataA.optSig !== dataB.optSig)) {
              clinicalCollisionsPrevented++;
            }
          }
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // CLUSTERING & METADATA SUPER-ENRICHMENT
  // --------------------------------------------------------------------------
  const clusters = new Map();
  for (let i = 0; i < totalRaw; i++) {
    const root = dsu.find(i);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(rawItems[i]);
  }

  const aliasMap = new Map();
  const idQuestionMap = new Map();
  const banco = [];

  let countMirCanonicas = 0;
  let countSimsCanonicas = 0;
  let countEvalsCanonicas = 0;
  let countTest2vCanonicas = 0;
  let countB1 = 0, countB2 = 0, countB3 = 0, countB4 = 0, countSinStats = 0;
  let countFalladasCTO = 0;

  for (const members of clusters.values()) {
    const desgMember = members.find(m => m.source === 'desgloses');
    const simMember = members.find(m => m.source === 'simulacros');
    const evalMember = members.find(m => m.source === 'evaluaciones');
    const bancoMember = members.find(m => m.source === 'banco');

    // Canonical Identifier Selection: Desglose UUID > Simulacro UUID > Evaluacion ID > Banco ID
    const canonId = (desgMember && desgMember.item.id) ||
                    (simMember && simMember.item.id) ||
                    (evalMember && (evalMember.item.cto_id || evalMember.item.id)) ||
                    (bancoMember && bancoMember.item.id) ||
                    String(members[0].item.id);

    // Accumulate all original alias identifiers
    const aliasSet = new Set();
    aliasSet.add(canonId);

    members.forEach(m => {
      if (m.item.id) aliasSet.add(String(m.item.id));
      if (m.item.cto_id) aliasSet.add(String(m.item.cto_id));
      if (m.source === 'simulacros') {
        const num = m.item.numero_pregunta || m.item.numero;
        aliasSet.add(`${m.item.simulacro}-${num}`);
        aliasSet.add(`cto_sim_${m.item.simulacro}_${num}`);
        if (m.meta?.pregunta_id) aliasSet.add(String(m.meta.pregunta_id));
      }
      // Defect 1 Remediation: Do NOT ingest m.item.codigo_cto into aliasSet.
      // In bancoPreguntas.json, codigo_cto is a 2-letter subject acronym ('CD', 'NM', etc.),
      // not a question ID. Ingesting it polluted 2,066 questions and corrupted alias lookups.
    });

    const aliasIds = Array.from(aliasSet).filter(Boolean);

    // Map all aliases to the canonical ID
    for (const alias of aliasIds) {
      aliasMap.set(alias, canonId);
    }

    // Source tags
    const fuentesSet = new Set();
    members.forEach(m => {
      if (m.source === 'desgloses') {
        fuentesSet.add('mir');
        fuentesSet.add('desgloses');
      } else if (m.source === 'simulacros') {
        fuentesSet.add('simulacro');
        fuentesSet.add('simulacros');
      } else if (m.source === 'evaluaciones') {
        fuentesSet.add('evaluacion');
        fuentesSet.add('evaluaciones');
      } else if (m.source === 'banco') {
        if (m.item.vuelta === 2) {
          fuentesSet.add('test2v');
        } else {
          fuentesSet.add('test1v');
        }
      }
    });
    const fuentes = Array.from(fuentesSet);

    if (fuentesSet.has('mir')) countMirCanonicas++;
    if (fuentesSet.has('simulacro')) countSimsCanonicas++;
    if (fuentesSet.has('evaluacion')) countEvalsCanonicas++;
    if (fuentesSet.has('test2v')) countTest2vCanonicas++;

    // Statement: Cleanest and most complete text formatted for display
    const primaryMember = desgMember || simMember || evalMember || bancoMember || members[0];
    const rawEnunciado = primaryMember.item.enunciado || primaryMember.item.text || '';
    const enunciado = formatDisplayEnunciado(rawEnunciado) || rawEnunciado.trim();

    // Options formatting: standardize to { numero, enunciado, correcta } and string options
    let respuestas = [];
    if (desgMember && Array.isArray(desgMember.item.respuestas) && desgMember.item.respuestas.length > 0) {
      respuestas = desgMember.item.respuestas.map(r => ({
        numero: r.numero,
        enunciado: r.enunciado,
        correcta: Boolean(r.correcta)
      }));
    } else if (simMember && Array.isArray(simMember.item.respuestas) && simMember.item.respuestas.length > 0) {
      const corrNum = simMember.meta?.respuesta_correcta;
      respuestas = simMember.item.respuestas.map(r => ({
        numero: r.numero,
        enunciado: r.enunciado,
        correcta: Boolean(r.correcta || (corrNum != null && r.numero === corrNum))
      }));
    } else if (evalMember && Array.isArray(evalMember.item.opciones) && evalMember.item.opciones.length > 0) {
      respuestas = evalMember.item.opciones.map((o, idx) => ({
        numero: o.id || (idx + 1),
        enunciado: o.texto,
        correcta: (o.id || (idx + 1)) === evalMember.item.correcta
      }));
    } else if (bancoMember && Array.isArray(bancoMember.item.opciones) && bancoMember.item.opciones.length > 0) {
      respuestas = bancoMember.item.opciones.map((o, idx) => ({
        numero: o.id || (idx + 1),
        enunciado: o.texto,
        correcta: (o.id || (idx + 1)) === bancoMember.item.correcta
      }));
    } else if (bancoMember && Array.isArray(bancoMember.item.options) && bancoMember.item.options.length > 0) {
      respuestas = bancoMember.item.options.map((optText, idx) => ({
        numero: idx + 1,
        enunciado: optText,
        correcta: (idx + 1) === bancoMember.item.answer
      }));
    } else {
      // Fallback
      respuestas = [
        { numero: 1, enunciado: 'Opción 1', correcta: true },
        { numero: 2, enunciado: 'Opción 2', correcta: false },
        { numero: 3, enunciado: 'Opción 3', correcta: false },
        { numero: 4, enunciado: 'Opción 4', correcta: false }
      ];
    }

    respuestas.sort((a, b) => a.numero - b.numero);
    const opciones = respuestas.map(r => r.enunciado);
    const options = opciones;
    const correctOpt = respuestas.find(r => r.correcta);
    const hasCorrect = Boolean(correctOpt);
    const isExplicitlyAnnulled = members.some(m => {
      return Boolean(m.item?.anulada || m.item?.es_anulada || m.meta?.nula === 1 || m.meta?.ignorar);
    });
    const anulada = !hasCorrect || isExplicitlyAnnulled;
    const es_anulada = anulada;

    const respuesta_correcta = correctOpt ? correctOpt.numero : 1;
    const answer = respuesta_correcta;

    // Official MIR Year preservation: official exam year (2010-2025) retained over course year
    let anualidad = null;
    let año = null;
    let convocatoria = '';
    let es_oficial_mir = false;

    if (desgMember) {
      anualidad = desgMember.item.anualidad || null;
      año = anualidad;
      convocatoria = desgMember.item.convocatoria || (anualidad ? `MIR ${anualidad}` : '');
      es_oficial_mir = true;
    } else {
      // Find any non-empty convocatoria
      for (const m of members) {
        if (m.item.convocatoria) {
          convocatoria = m.item.convocatoria;
          break;
        }
      }
    }

    // CTO Student Failure Flags Inheritance
    const cto_fallada = members.some(m => {
      if (m.source === 'simulacros') {
        return m.meta?.fallada === 1 || (m.meta && !m.meta.acertada && !m.meta.fallada);
      }
      if (m.source === 'evaluaciones') {
        return Boolean(m.item.fallada_o_blanca);
      }
      if (m.source === 'banco') {
        return Boolean(m.item.cto_fallada);
      }
      return false;
    });
    const fallada_cto = cto_fallada;

    const cto_blanca = members.some(m => {
      if (m.source === 'simulacros') {
        return m.meta?.nula === 1 || (m.meta && !m.meta.acertada && !m.meta.fallada);
      }
      if (m.source === 'evaluaciones') {
        return Boolean(m.item.fallada_o_blanca && m.item.respuesta_usuario == null);
      }
      return false;
    });

    const cto_acertada = members.some(m => {
      if (m.source === 'simulacros') return m.meta?.acertada === 1;
      if (m.source === 'evaluaciones') return m.item.fallada_o_blanca === false;
      if (m.source === 'banco') return Boolean(m.item.cto_acertada);
      return false;
    });

    const cto_dudas = members.some(m => {
      if (m.source === 'simulacros') return m.meta?.dudas === 1;
      if (m.source === 'banco') return Boolean(m.item.cto_dudosa);
      return false;
    });

    if (cto_fallada) countFalladasCTO++;

    // Population Difficulty (0-100%) and P80 Bracket Calibration
    let pct_pob = null;
    if (evalMember && evalMember.item.pct_acierto_pob != null) {
      pct_pob = evalMember.item.pct_acierto_pob;
    } else if (simMember && simMember.meta?.pct_correcta != null) {
      const totalAlumnos = simTotals[simMember.item.simulacro] || 2500;
      pct_pob = Math.round((simMember.meta.pct_correcta / totalAlumnos) * 100);
    }

    if (pct_pob != null) {
      pct_pob = Math.max(0, Math.min(100, pct_pob));
    }
    const pct_poblacional = pct_pob;

    let horquilla_p80 = null;
    let bloque_p80 = null;
    if (pct_pob != null) {
      if (pct_pob >= 70) {
        horquilla_p80 = 'B1';
        bloque_p80 = 1;
        countB1++;
      } else if (pct_pob >= 50) {
        horquilla_p80 = 'B2';
        bloque_p80 = 2;
        countB2++;
      } else if (pct_pob >= 35) {
        horquilla_p80 = 'B3';
        bloque_p80 = 3;
        countB3++;
      } else {
        horquilla_p80 = 'B4';
        bloque_p80 = 4;
        countB4++;
      }
    } else {
      countSinStats++;
    }

    // Taxonomy: Subject, Theme, Subtheme
    let rawAsig = '';
    if (desgMember && desgMember.item.asignatura) {
      rawAsig = desgMember.item.asignatura;
    } else if (simMember) {
      rawAsig = (simMember.meta?.clasificaciones && simMember.meta.clasificaciones[0]) ||
                simMember.meta?.asignatura ||
                'Simulacros';
    } else if (evalMember && evalMember.item.asignatura) {
      rawAsig = evalMember.item.asignatura;
    } else if (bancoMember && bancoMember.item.asignatura) {
      rawAsig = bancoMember.item.asignatura;
    }
    const asignatura = normalizeAsignaturaToDesgloses(rawAsig) || 'Miscelánea';

    // Granular Theme Selection: pick the non-"General" and most specific theme
    const candidateTemas = [];
    members.forEach(m => {
      let t = '';
      if (m.source === 'simulacros' && m.meta?.clasificaciones?.[1]) {
        t = m.meta.clasificaciones[1];
      } else if (m.item.tema) {
        t = m.item.tema;
      }
      if (t && typeof t === 'string' && t.trim()) {
        candidateTemas.push(t.trim());
      }
    });

    const specificTemas = candidateTemas.filter(t => !/^general$/i.test(t) && !/^sin tema$/i.test(t));
    let tema = 'General';
    if (specificTemas.length > 0) {
      specificTemas.sort((a, b) => b.length - a.length);
      tema = specificTemas[0];
    } else if (candidateTemas.length > 0) {
      tema = candidateTemas[0];
    }

    // Granular Subtheme Selection
    let subtema = '';
    for (const m of members) {
      let s = '';
      if (m.source === 'simulacros' && m.meta?.clasificaciones?.[2]) {
        s = m.meta.clasificaciones[2];
      } else if (m.item.subtema) {
        s = m.item.subtema;
      }
      if (s && typeof s === 'string' && s.trim()) {
        subtema = s.trim();
        break;
      }
    }

    // Comprehensive Explanation / Commentary
    const candidateComentarios = [];
    members.forEach(m => {
      const c = m.item.comentario || m.item.explicacion || '';
      if (c && typeof c === 'string' && c.trim()) {
        candidateComentarios.push(c.trim());
      }
    });
    candidateComentarios.sort((a, b) => b.length - a.length);
    const comentario = candidateComentarios[0] || '';
    const explicacion = comentario;

    // Clinical Image Asset
    let imagen_nombre = null;
    for (const m of members) {
      const img = m.item.imagen_nombre || m.item.imagen || m.item.image || null;
      if (img && typeof img === 'string' && img.trim()) {
        imagen_nombre = img.trim();
        break;
      }
    }
    const imagen = imagen_nombre;

    // Difficulty
    let dificultad = 3;
    for (const m of members) {
      if (m.item.dificultad && typeof m.item.dificultad === 'number') {
        dificultad = m.item.dificultad;
        break;
      }
    }

    // User-facing badge label
    let origen_display = 'Banco CTO';
    if (es_oficial_mir) {
      origen_display = anualidad ? `MIR ${anualidad}` : 'MIR Oficial';
    } else if (fuentesSet.has('simulacro')) {
      const simNum = simMember?.item.simulacro || '';
      const pNum = simMember?.item.numero_pregunta || simMember?.item.numero || '';
      origen_display = simNum ? `Simulacro ${simNum} (P${pNum})` : 'Simulacro CTO';
    } else if (fuentesSet.has('evaluacion')) {
      origen_display = 'Evaluación CTO';
    } else if (fuentesSet.has('test2v')) {
      origen_display = 'Test 2ª Vuelta';
    }

    const canonicalQuestion = {
      id: canonId,
      canonical_id: canonId,
      aliasIds,
      alias_ids: aliasIds,
      enunciado,
      opciones,
      options,
      respuestas,
      respuesta_correcta,
      answer,
      anulada,
      es_anulada,
      asignatura,
      _normAsig: normText(asignatura),
      tema,
      subtema,
      año,
      anualidad,
      convocatoria,
      es_oficial_mir,
      fuentes,
      fallada_cto,
      cto_fallada,
      cto_blanca,
      cto_acertada,
      cto_dudas,
      pct_pob,
      pct_poblacional,
      horquilla_p80,
      bloque_p80,
      dificultad,
      comentario,
      explicacion,
      imagen,
      imagen_nombre,
      origen_display
    };

    canonicalQuestion._normAsig = normText(canonicalQuestion.asignatura);

    banco.push(canonicalQuestion);
    idQuestionMap.set(canonId, canonicalQuestion);
  }

  const totalCanonicas = banco.length;
  const totalDuplicadosEliminados = totalRaw - totalCanonicas;

  const statsResumen = {
    totalRaw,
    totalCanonicas,
    totalDuplicadosEliminados,
    etapa1FusionesId: stage1Merges,
    etapa2FusionesTexto: stage2Merges,
    colisionesClinicasEvitadas: clinicalCollisionsPrevented,
    porFuente: {
      desglosesRaw: desglosesData.length,
      simulacrosRaw: simulacrosTextosData.length,
      evaluacionesRaw: evaluacionesData.length,
      bancoRaw: bancoPreguntasData.length,
      mirCanonicas: countMirCanonicas,
      simulacrosCanonicas: countSimsCanonicas,
      evaluacionesCanonicas: countEvalsCanonicas,
      test2vCanonicas: countTest2vCanonicas
    },
    porHorquillaP80: {
      B1: countB1,
      B2: countB2,
      B3: countB3,
      B4: countB4,
      sinStats: countSinStats
    },
    falladasCTO: countFalladasCTO
  };

  return {
    banco,
    aliasMap,
    idQuestionMap,
    statsResumen
  };
}

function ensureLoaded() {
  if (!cachedBanco) {
    const { banco, aliasMap, idQuestionMap, statsResumen } = buildUnifiedBank();
    cachedBanco = banco;
    aliasToCanonicalMap = aliasMap;
    idToQuestionMap = idQuestionMap;
    bankStatsResumen = statsResumen;
  }
}

// ============================================================================
// PUBLIC API METHODS
// ============================================================================

/**
 * Returns all canonical questions or filters them if options are supplied.
 */
export function getPreguntas(filtros) {
  ensureLoaded();
  if (!filtros || Object.keys(filtros).length === 0) {
    return cachedBanco;
  }
  return filtrarPreguntas(filtros);
}

/**
 * Alias for getPreguntas() without filters.
 */
export function getBancoUnificado() {
  ensureLoaded();
  return cachedBanco;
}

/**
 * Resolves any alias ID (UUID, cto_id, "14-12", "cto_sim_14_12") to its canonical UUID in O(1).
 */
export function getCanonicalId(aliasId) {
  if (!aliasId) return aliasId;
  ensureLoaded();
  const strId = String(aliasId);
  return aliasToCanonicalMap.get(strId) || strId;
}

/**
 * Returns full question object by ID or any merged alias.
 */
export function getPreguntaPorId(id) {
  if (!id) return null;
  ensureLoaded();
  const canonId = getCanonicalId(id);
  return idToQuestionMap.get(canonId) || null;
}

/**
 * Returns the entire alias-to-canonical dictionary.
 */
export function getAliasToCanonicalMap() {
  ensureLoaded();
  const out = {};
  for (const [k, v] of aliasToCanonicalMap.entries()) {
    out[k] = v;
  }
  return out;
}

/**
 * Multi-dimensional faceted filter engine.
 */
export function filtrarPreguntas(filtros = {}) {
  ensureLoaded();

  const f = filtros || {};
  let result = cachedBanco;

  // 1. Filter by Fuente(s)
  const fuentesFiltro = f.fuentes || (f.fuente ? [f.fuente] : null);
  if (fuentesFiltro && Array.isArray(fuentesFiltro) && fuentesFiltro.length > 0) {
    const normalizedFuentes = fuentesFiltro
      .map(item => String(item).trim().toLowerCase())
      .filter(item => item && item !== 'todas');

    if (normalizedFuentes.length > 0) {
      result = result.filter(q => {
        return normalizedFuentes.some(src => {
          if (src === 'mir' || src === 'desgloses') return q.es_oficial_mir || q.fuentes.includes('mir');
          if (src === 'simulacro' || src === 'simulacros') return q.fuentes.includes('simulacro');
          if (src === 'evaluacion' || src === 'evaluaciones') return q.fuentes.includes('evaluacion');
          if (src === 'test2v' || src === 'test2V' || src === '2v') return q.fuentes.includes('test2v');
          if (src === 'test1v' || src === 'test1V' || src === '1v') return q.fuentes.includes('test1v');
          return q.fuentes.includes(src);
        });
      });
    }
  }

  // 2. Filter by Asignatura(s) (accent-insensitive & alias-aware, supports single or array)
  const asigFiltro = f.asignaturas || (f.asignatura ? (Array.isArray(f.asignatura) ? f.asignatura : [f.asignatura]) : null);
  if (asigFiltro && Array.isArray(asigFiltro) && asigFiltro.length > 0) {
    const validTargets = asigFiltro
      .filter(a => a && a !== 'Todas' && a !== 'todas')
      .map(a => NORM_ASIG_LOOKUP.get(normText(a)) || normText(normalizeAsignaturaToDesgloses(a)))
      .filter(Boolean);

    if (validTargets.length > 0) {
      const targetSet = new Set(validTargets);
      result = result.filter(q => targetSet.has(q._normAsig || normText(q.asignatura)));
    }
  }

  // 3. Filter by Tema
  if (f.tema && f.tema !== 'Todos' && f.tema !== 'todos' && f.tema !== 'Todas') {
    const nTema = normText(f.tema);
    result = result.filter(q => normText(q.tema) === nTema);
  }

  // 4. Filter by Subtema
  if (f.subtema && f.subtema !== 'Todos' && f.subtema !== 'todos') {
    const nSub = normText(f.subtema);
    result = result.filter(q => normText(q.subtema) === nSub);
  }

  // 5. Filter by P80 Difficulty Bracket (B1, B2, B3, B4)
  const p80Filtro = f.horquillaP80 || f.horquilla_p80 || f.bloques_p80 || f.p80Bracket;
  if (p80Filtro) {
    const brackets = (Array.isArray(p80Filtro) ? p80Filtro : [p80Filtro])
      .map(b => {
        if (typeof b === 'number') return `B${b}`;
        const str = String(b).trim().toUpperCase();
        return str.startsWith('B') ? str : `B${str}`;
      })
      .filter(b => ['B1', 'B2', 'B3', 'B4'].includes(b));

    if (brackets.length > 0) {
      result = result.filter(q => q.horquilla_p80 && brackets.includes(q.horquilla_p80));
    }
  }

  // 6. Filter by CTO Failure / State
  if (f.soloFalladas || f.soloFalladasCTO) {
    result = result.filter(q => q.fallada_cto === true);
  }

  if (f.estadoCTO) {
    const ec = String(f.estadoCTO).toLowerCase();
    if (ec === 'fallada') result = result.filter(q => q.fallada_cto === true);
    else if (ec === 'blanca') result = result.filter(q => q.cto_blanca === true);
    else if (ec === 'acertada') result = result.filter(q => q.cto_acertada === true);
  }

  // 7. Filter by Personal Local Stats (No respondidas, Falladas, Acertadas, Dominadas, En latencia)
  if (f.estadoPersonal && f.estadoPersonal !== 'todas') {
    const ep = String(f.estadoPersonal).toLowerCase();
    let stats = f.stats;

    if (!stats && typeof localStorage !== 'undefined') {
      try {
        const item = localStorage.getItem('mir_banco_preguntas_stats');
        stats = item ? JSON.parse(item) : {};
      } catch {
        stats = {};
      }
    }
    stats = stats || {};

    const now = Date.now();
    result = result.filter(q => {
      const canonId = q.id;
      const s = stats[canonId] || (q.aliasIds ? q.aliasIds.map(a => stats[a]).find(Boolean) : null);

      if (ep === 'virgenes' || ep === 'no_respondidas' || ep === 'no_hechas') {
        return !s || !s.vecesVistas;
      }
      if (ep === 'falladas') {
        return Boolean(s && s.fallos > 0);
      }
      if (ep === 'acertadas') {
        return Boolean(s && s.aciertos > 0);
      }
      if (ep === 'dudosas') {
        return Boolean(s && s.dudosa);
      }
      if (ep === 'dominadas') {
        return Boolean(s && (s.dominada || s.rachaVerde >= 3));
      }
      if (ep === 'latencia' || ep === 'en_latencia') {
        return Boolean(s && s.latenciaHasta && new Date(s.latenciaHasta).getTime() > now);
      }
      return true;
    });
  }

  // 8. Filter by Official MIR Year range
  if (f.añoMin || f.anualidadMin) {
    const min = f.añoMin || f.anualidadMin;
    result = result.filter(q => q.año != null && q.año >= min);
  }
  if (f.añoMax || f.anualidadMax) {
    const max = f.añoMax || f.anualidadMax;
    result = result.filter(q => q.año != null && q.año <= max);
  }

  // Optional Limit
  const limit = f.limit || f.limite;
  if (typeof limit === 'number' && limit > 0) {
    return result.slice(0, limit);
  }

  return result;
}

/**
 * Returns summary metrics of the unified question bank.
 */
export function getStatsResumen() {
  ensureLoaded();
  return bankStatsResumen;
}

export function getMetricasBanco() {
  return getStatsResumen();
}

/**
 * Returns sorted list of unique themes for a subject.
 */
export function getTemasPorAsignatura(asignatura) {
  ensureLoaded();
  if (!asignatura) return [];
  const normAsig = normalizeAsignaturaToDesgloses(asignatura);
  const temasSet = new Set();

  for (const q of cachedBanco) {
    if (normalizeAsignaturaToDesgloses(q.asignatura) === normAsig && q.tema) {
      temasSet.add(q.tema);
    }
  }

  return Array.from(temasSet).sort();
}

/**
 * Returns sorted list of unique subthemes for a subject and theme.
 */
export function getSubtemasPorTema(asignatura, tema) {
  ensureLoaded();
  if (!asignatura || !tema) return [];
  const normAsig = normalizeAsignaturaToDesgloses(asignatura);
  const nTema = normText(tema);
  const subtemasSet = new Set();

  for (const q of cachedBanco) {
    if (normalizeAsignaturaToDesgloses(q.asignatura) === normAsig && normText(q.tema) === nTema && q.subtema) {
      subtemasSet.add(q.subtema);
    }
  }

  return Array.from(subtemasSet).sort();
}

/**
 * Clasificación y jerarquía pedagógica MIR de una pregunta:
 * Tier 1: Desgloses MIR 2025-2015 (máxima representatividad del examen actual)
 * Tier 2: Simulacros CTO (entrenamiento con dificultad real P80)
 * Tier 3: Desgloses MIR 2015-2010 (consolidación histórica)
 * Tier 4: Evaluaciones CTO (Campus 1ª y 2ª vuelta)
 * Tier 5: Preguntas Segunda Vuelta (banco complementario PDFs)
 */
export function getPrioridadPedagogica(q) {
  if (!q) return { tier: 6, label: 'Sin clasificar', sortWeight: 9999 };

  const isMir = Boolean(q.es_oficial_mir || (Array.isArray(q.fuentes) && q.fuentes.includes('mir')));
  const year = Number(q.anualidad || q.año || q.convocatoria || 0);

  // 1. Desgloses MIR 2025-2015 (máxima prioridad)
  if (isMir && year >= 2015 && year <= 2025) {
    return {
      tier: 1,
      label: 'Desgloses MIR 2025-2015',
      year,
      sortWeight: 1000 - year // más recientes primero (2025 antes que 2024)
    };
  }

  // 2. Simulacros CTO (entrenamiento con dificultad real P80)
  if (Array.isArray(q.fuentes) && q.fuentes.includes('simulacro')) {
    const simNum = Number(q.simulacro_numero || 0);
    return {
      tier: 2,
      label: 'Simulacros CTO',
      simNum,
      sortWeight: 2000 - simNum // simulacros más recientes primero
    };
  }

  // 3. Desgloses MIR 2015-2010 (y anteriores)
  if (isMir && year >= 2010) {
    return {
      tier: 3,
      label: 'Desgloses MIR 2015-2010',
      year,
      sortWeight: 3000 - year
    };
  }
  if (isMir) {
    return {
      tier: 3,
      label: 'Desgloses MIR Históricos',
      year,
      sortWeight: 3500 - (year || 2000)
    };
  }

  // 4. Evaluaciones CTO (Campus 1ª y 2ª vuelta)
  if (Array.isArray(q.fuentes) && q.fuentes.includes('evaluacion')) {
    return {
      tier: 4,
      label: 'Evaluaciones Campus CTO',
      sortWeight: 4000
    };
  }

  // 5. Preguntas de Segunda Vuelta (banco de PDFs)
  if (Array.isArray(q.fuentes) && (q.fuentes.includes('test2v') || q.fuentes.includes('test1v') || q.fuentes.includes('2v'))) {
    return {
      tier: 5,
      label: 'Preguntas Segunda Vuelta',
      sortWeight: 5000
    };
  }

  return {
    tier: 5,
    label: 'Otras fuentes',
    sortWeight: 6000
  };
}

/**
 * Ordena un conjunto de preguntas según las prioridades pedagógicas MIR:
 * 1. Desgloses 2025-2015
 * 2. Simulacros CTO
 * 3. Desgloses 2015-2010
 * 4. Evaluaciones CTO
 * 5. Segunda Vuelta
 */
export function ordenarPorPrioridadPedagogica(preguntas, { barajarDentroDeTier = false } = {}) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) return [];

  const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of preguntas) {
    const info = getPrioridadPedagogica(q);
    const t = info.tier <= 5 ? info.tier : 5;
    tiers[t].push({ q, info });
  }

  const resultado = [];
  for (let t = 1; t <= 5; t++) {
    const items = tiers[t];
    if (items.length === 0) continue;

    if (barajarDentroDeTier) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    } else {
      items.sort((a, b) => a.info.sortWeight - b.info.sortWeight);
    }

    for (const item of items) {
      resultado.push(item.q);
    }
  }

  return resultado;
}

/**
 * Selecciona un cupo de preguntas respetando estrictamente las prioridades pedagógicas:
 * llena primero con Tier 1 (Desgloses 25-15); si no alcanza, completa con Tier 2 (Simulacros),
 * luego Tier 3 (Desgloses 15-10), luego Tier 4 (Evaluaciones) y finalmente Tier 5 (Segunda Vuelta).
 * 
 * Incorpora además la ponderación de Repetición Espaciada y Latencia Metacognitiva:
 * 1º Falladas y Latencias vencidas urgentes (prioridad 8-10).
 * 2º Preguntas Vírgenes (no vistas).
 * 3º Repasos espaciados de consolidación con latencia cumplida.
 * 4º Preguntas en latencia activa (durmiendo en cooldown, solo entran si el cupo agota las despiertas).
 */
export function seleccionarPorCupoPrioritario(
  preguntas,
  cupo = null,
  {
    barajarResultado = false,
    barajarDentroDeTier = false,
    stats = null,
    excluirArchivadas = true
  } = {}
) {
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    return {
      seleccion: [],
      conteoTiers: {
        tier1_desgloses_25_15: 0,
        tier2_simulacros: 0,
        tier3_desgloses_15_10: 0,
        tier4_evaluaciones: 0,
        tier5_segunda_vuelta: 0
      }
    };
  }

  const now = Date.now();

  const getMetacognitiveInfo = (q) => {
    if (!stats || Object.keys(stats).length === 0) {
      return { group: 1, isArchived: false, isSleeping: false };
    }
    const canonId = getCanonicalId(q.id);
    const s = stats[canonId] || stats[q.id] || (q.aliasIds ? q.aliasIds.map(a => stats[a]).find(Boolean) : null);
    if (!s) return { group: 1, isArchived: false, isSleeping: false }; // Virgen

    const isArchived = Boolean(s.archivada || s.status === 'archived');
    if (isArchived) return { group: 5, isArchived: true, isSleeping: false };

    const isSleeping = Boolean(s.latenciaHasta && new Date(s.latenciaHasta).getTime() > now);
    if (isSleeping) {
      return { group: 4, isArchived: false, isSleeping: true }; // Durmiendo en cooldown
    }

    // Despierta:
    // Grupo 0: Fallo prioritario o latencia vencida urgente
    if (s.puntuacionPrioridad >= 8 || s.fallos > 0 || s.status === 'needs_review' || q.fallada_cto) {
      return { group: 0, isArchived: false, isSleeping: false };
    }

    // Grupo 1: Virgen (nunca vista)
    if (!s.vecesVistas) {
      return { group: 1, isArchived: false, isSleeping: false };
    }

    // Grupo 2: Repaso espaciado de consolidación (acertada con latencia ya cumplida)
    return { group: 2, isArchived: false, isSleeping: false };
  };

  const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const q of preguntas) {
    const meta = getMetacognitiveInfo(q);
    if (excluirArchivadas && meta.isArchived) continue;

    const info = getPrioridadPedagogica(q);
    const t = info.tier <= 5 ? info.tier : 5;
    tiers[t].push({ q, info, meta });
  }

  // Ordenar dentro de cada tier: primero por grupo metacognitivo (fallos vencidos -> vírgenes -> repasos -> durmiendo),
  // y dentro del mismo grupo, por sortWeight del tier (años más recientes primero)
  for (let t = 1; t <= 5; t++) {
    const items = tiers[t];
    if (items.length === 0) continue;
    if (barajarDentroDeTier) {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
    } else {
      items.sort((a, b) => {
        if (a.meta.group !== b.meta.group) {
          return a.meta.group - b.meta.group;
        }
        return a.info.sortWeight - b.info.sortWeight;
      });
    }
  }

  const limit = cupo ? Number(cupo) : preguntas.length;
  const seleccion = [];

  // FASE 1: Llenar el cupo prioritario con preguntas DESPIERTAS (grupos 0, 1, 2) de cada tier
  for (let t = 1; t <= 5; t++) {
    const needed = limit - seleccion.length;
    if (needed <= 0) break;
    const batch = tiers[t].filter(item => item.meta.group < 4).slice(0, needed);
    for (const item of batch) {
      seleccion.push(item.q);
    }
  }

  // FASE 2: Si el cupo solicitado aún no se ha llenado, completar con las preguntas en latencia activa (durmiendo)
  if (seleccion.length < limit) {
    const yaSeleccionadas = new Set(seleccion.map(q => q.id));
    for (let t = 1; t <= 5; t++) {
      const needed = limit - seleccion.length;
      if (needed <= 0) break;
      const batchSleeping = tiers[t]
        .filter(item => !yaSeleccionadas.has(item.q.id))
        .slice(0, needed);
      for (const item of batchSleeping) {
        seleccion.push(item.q);
        yaSeleccionadas.add(item.q.id);
      }
    }
  }

  const conteoTiers = {
    tier1_desgloses_25_15: seleccion.filter(q => getPrioridadPedagogica(q).tier === 1).length,
    tier2_simulacros: seleccion.filter(q => getPrioridadPedagogica(q).tier === 2).length,
    tier3_desgloses_15_10: seleccion.filter(q => getPrioridadPedagogica(q).tier === 3).length,
    tier4_evaluaciones: seleccion.filter(q => getPrioridadPedagogica(q).tier === 4).length,
    tier5_segunda_vuelta: seleccion.filter(q => getPrioridadPedagogica(q).tier === 5).length,
  };

  let finalArray = seleccion;
  if (barajarResultado) {
    finalArray = [...seleccion];
    for (let i = finalArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalArray[i], finalArray[j]] = [finalArray[j], finalArray[i]];
    }
  }

  return {
    seleccion: finalArray,
    conteoTiers
  };
}

export default {
  getBancoUnificado,
  getPreguntas,
  getPreguntaPorId,
  getCanonicalId,
  getAliasToCanonicalMap,
  filtrarPreguntas,
  getStatsResumen,
  getMetricasBanco,
  getTemasPorAsignatura,
  getSubtemasPorTema,
  getPrioridadPedagogica,
  ordenarPorPrioridadPedagogica,
  seleccionarPorCupoPrioritario,
  normalizeAsignaturaToDesgloses,
  normText,
  cleanStatement
};
