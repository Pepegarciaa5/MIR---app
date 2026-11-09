// src/utils/tiradaStorage.js
import { getCanonicalId } from '../lib/bancoUnificado.js';

const ULTIMA_TIRADA_KEY = 'mir_ultima_tirada';
const HISTORIAL_TIRADAS_KEY = 'mir_historial_tiradas';
const HISTORIAL_TIRADAS_V1_KEY = 'mir_historial_tiradas_v1';


export function construirPayloadTirada({
  origen = 'Desgloses',
  asignatura = 'General',
  temas = [],
  resumenCola = null,
  cola = [],
  respuestasDesglose = {}
}) {
  const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || String(num);

  const preguntas = cola.map((q, idx) => {
    const ans = respuestasDesglose[q.id];
    let correctLetter = ans?.correctLetter || null;
    if (!correctLetter) {
      if (Array.isArray(q.respuestas)) {
        const corr = q.respuestas.find(r => r.correcta);
        if (corr) correctLetter = numToLetter(corr.numero);
      } else if (q.answer) {
        correctLetter = numToLetter(q.answer);
      }
    }

    const contestada = Boolean(ans && !ans.skipped && ans.selectedLetter);
    const isCorrect = contestada ? Boolean(ans.isCorrect) : false;

    const canonId = q.canonical_id || (q.id ? getCanonicalId(q.id) : null) || q.id;

    return {
      orden: idx + 1,
      id: q.id,
      canonical_id: canonId,
      aliasIds: q.aliasIds || q.alias_ids || [q.id].filter(Boolean),
      asignatura: q.asignatura || asignatura || 'General',
      tema: q.tema || '',
      subtema: q.subtema || '',
      dificultad: q.dificultad ?? 3,
      anualidad: q.anualidad || q.año || null,
      convocatoria: q.convocatoria || q.origen || '',
      origen_tirada: q.origenTirada || 'tema_estudiado',
      contestada,
      skipped: !contestada,
      isCorrect,
      selectedLetter: contestada ? ans.selectedLetter : null,
      correctLetter,
      confidence: contestada ? (ans.confidence || 'green') : null,
      discardedOptions: contestada ? (ans.discardedOptions || []) : [],
      discardedCorrect: contestada ? Boolean(ans.discardedCorrect) : false,
      seconds: contestada ? (ans.seconds || 0) : 0,
      enunciado: q.enunciado || q.text || '',
      comentario: q.comentario || '',
      options: q.options || q.respuestas?.map(r => r.enunciado) || [],
      imagen_nombre: q.image || q.imagen || q.imagen_nombre || null,
      justificacion: ans?.justificacion || '',
      pct_pob: q.pct_pob ?? q.pctPob ?? null,
      horquilla_p80: q.horquilla_p80 || (q.bloque_p80 ? `B${q.bloque_p80}` : null),
      bloque_p80: q.bloque_p80 ?? (q.horquilla_p80 ? parseInt(String(q.horquilla_p80).replace('B', ''), 10) : null),
      fuentes: q.fuentes || [],
      fallada_cto: Boolean(q.fallada_cto || q.cto_fallada)
    };
  });

  const contestadas = preguntas.filter(p => p.contestada);
  const aciertos = contestadas.filter(p => p.isCorrect).length;
  const fallos = contestadas.filter(p => !p.isCorrect).length;
  const blancas = preguntas.length - contestadas.length;
  const netas = Number((aciertos - fallos / 3).toFixed(2));
  const pctAcierto = contestadas.length > 0 ? Number(((aciertos / contestadas.length) * 100).toFixed(1)) : 0;

  const now = new Date();
  return {
    tipo: 'mir_tirada',
    id: `tirada_${now.getTime()}`,
    timestamp: now.toISOString(),
    fecha_humana: now.toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }),
    origen,
    asignatura: asignatura || 'Mixto',
    temas: Array.isArray(temas) ? temas : [],
    resumen_cola: resumenCola,
    metricas: {
      total: preguntas.length,
      contestadas: contestadas.length,
      aciertos,
      fallos,
      blancas,
      netas,
      pct_acierto: pctAcierto
    },
    preguntas
  };
}

export function descargarTiradaJSON(payload, customFilename = null) {
  if (typeof window === 'undefined' || !payload) return false;
  try {
    const jsonStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateSlug = (payload.timestamp || new Date().toISOString()).slice(0, 16).replace(/[:T]/g, '-');
    a.href = url;
    a.download = customFilename || `mir_tirada_${dateSlug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch (e) {
    console.warn('No se pudo descargar el JSON de la tirada:', e);
    return false;
  }
}

export async function copiarTiradaAlPortapapeles(payload) {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !payload) return false;
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload));
    return true;
  } catch (e) {
    console.warn('No se pudo copiar la tirada al portapapeles:', e);
    return false;
  }
}

export async function guardarTiradaParaChat(payload, { autoDownloadOnFallback = true, autoCopy = true } = {}) {
  if (!payload) return { savedLocal: false, savedDisk: false, copied: false, downloaded: false };

  let savedLocal = false;
  let savedDisk = false;
  let copied = false;
  let downloaded = false;

  // 1. Guardar en localStorage (funciona siempre sin Supabase)
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ULTIMA_TIRADA_KEY, JSON.stringify(payload));
      const rawHist = localStorage.getItem(HISTORIAL_TIRADAS_KEY) || localStorage.getItem(HISTORIAL_TIRADAS_V1_KEY);
      const hist = rawHist ? JSON.parse(rawHist) : [];
      const filtered = Array.isArray(hist) ? hist.filter(x => x.id !== payload.id) : [];
      filtered.unshift(payload);
      const serialized = JSON.stringify(filtered.slice(0, 50));
      localStorage.setItem(HISTORIAL_TIRADAS_KEY, serialized);
      localStorage.setItem(HISTORIAL_TIRADAS_V1_KEY, serialized);
      savedLocal = true;
    }
  } catch (e) {
    console.warn('Error guardando tirada en localStorage:', e);
  }

  // Notificar reactivamente a la UI vía CustomEvents
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      const CustomEventCtor = typeof CustomEvent !== 'undefined' ? CustomEvent : (window.CustomEvent || null);
      if (CustomEventCtor) {
        window.dispatchEvent(new CustomEventCtor('mir_tirada_saved', { detail: payload }));
        window.dispatchEvent(new CustomEventCtor('mir_stats_updated'));
      }
    } catch (e) {
      // ignore
    }
  }


  // 2. Copiar al portapapeles de macOS (permite a auditar_tirada.py leer vía pbpaste al instante)
  if (autoCopy) {
    copied = await copiarTiradaAlPortapapeles(payload);
  }

  // 3. Intentar guardar directamente en disco vía Vite dev server (/api/local-tirada)
  try {
    const res = await fetch('/api/local-tirada', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.ok) {
        savedDisk = true;
      }
    }
  } catch {
    // Normal si está en producción (Vercel) o sin servidor local
  }

  // 4. Si no estamos en localhost (ej. Vercel), descargar automáticamente a ~/Downloads/
  // para que scripts/auditar_tirada.py lo encuentre en ~/Downloads sin depender de Supabase
  if (!savedDisk && autoDownloadOnFallback) {
    downloaded = descargarTiradaJSON(payload);
  }

  return { savedLocal, savedDisk, copied, downloaded };
}
