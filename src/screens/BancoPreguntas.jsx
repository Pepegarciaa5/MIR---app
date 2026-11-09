import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import BANCO_RAW from '../data/bancoPreguntas.json';
import TEXTOS_SIMULACROS from '../data/simulacros_textos.json';
import TEXTOS_DESGLOSES from '../data/desgloses.json';
import { getPreguntas, ASIGNATURA_NOMBRE } from '../lib/simulacros';
import { desgloseAnual } from '../data/mirStats';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { generarColaPreguntas } from '../lib/recommendations';
import QuestionCard from '../components/quiz/QuestionCard';
import ClinicalImage from '../components/common/ClinicalImage';
import NotaPersonal from '../components/quiz/NotaPersonal';
import TutorGemini from '../components/quiz/TutorGemini';
import SyncStatusBanner from '../components/quiz/SyncStatusBanner';
import { getOrCreateAnonUserId, createQuizResult, flushOfflineSyncQueue } from '../utils/quizSync';
import { 
  construirPayloadTirada, 
  guardarTiradaParaChat, 
  descargarTiradaJSON, 
  copiarTiradaAlPortapapeles 
} from '../utils/tiradaStorage';

const STATS_MAP = new Map(getPreguntas().map(p => [p.pregunta_id, p]));

// BANCO_RAW contiene preguntas de Simulacros 1 al 7 (duplicadas con simulacros_textos.json) y preguntas PDF por asignatura.
// Conservamos solo las preguntas exclusivas de banco (PDFs) para que los simulacros se carguen desde TEXTOS_SIMULACROS con sus UUIDs oficiales.
const BANCO_PDFS = BANCO_RAW.filter(q => !q.origen?.startsWith('Simulacro') && !q.cto_id);

const RAW_COMBINED_QUESTIONS = [
  ...BANCO_PDFS.map(q => ({
    ...q,
    image: q.image || q.imagen || q.imagen_nombre
  })),
  ...TEXTOS_SIMULACROS.map(t => {
    const stats_cto = STATS_MAP.get(t.id) || {};
    return {
      id: t.id,
      text: t.enunciado,
      options: [...(t.respuestas || [])].sort((a, b) => a.numero - b.numero).map(r => r.enunciado),
      answer: t.respuestas?.find(r => r.correcta)?.numero || 1,
      asignatura: ASIGNATURA_NOMBRE[stats_cto.asignatura] || stats_cto.asignatura || 'Simulacros',
      image: t.imagen_nombre || t.image || t.imagen,
      origen: `Simulacro ${t.simulacro}`,
      comentario: t.comentario,
      cto_fallada: stats_cto.fallada === 1,
      cto_dudosa: stats_cto.dudas === 1
    };
  }).filter(q => q.text && q.text.trim().length > 0),
  ...TEXTOS_DESGLOSES.map(d => ({
    id: d.id,
    text: d.enunciado,
    options: [...(d.respuestas || [])].sort((a, b) => a.numero - b.numero).map(r => r.enunciado),
    answer: d.respuestas?.find(r => r.correcta)?.numero || 1,
    asignatura: d.asignatura || 'Desgloses',
    image: d.imagen_nombre || d.image || d.imagen,
    origen: d.convocatoria || 'Desglose MIR',
    comentario: d.comentario,
    cto_fallada: false, 
    cto_dudosa: false
  }))
];

// Deduplicación estricta por ID y por texto normalizado del enunciado (evita solapamientos entre Desgloses y Simulacros)
const normalizeEnunciado = (txt) => (txt || '').toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}]/gu, '').slice(0, 120);

const QUESTIONS = (() => {
  const seenIds = new Set();
  const seenTexts = new Set();
  const unique = [];

  for (const q of RAW_COMBINED_QUESTIONS) {
    if (!q || !q.id) continue;
    if (seenIds.has(q.id)) continue;

    const norm = normalizeEnunciado(q.text);
    if (norm.length >= 25 && seenTexts.has(norm)) {
      continue;
    }

    seenIds.add(q.id);
    if (norm.length >= 25) seenTexts.add(norm);
    unique.push(q);
  }

  return unique;
})();

const getSessionData = (key, defaultVal) => {
  try {
    const saved = sessionStorage.getItem(`mir_banco_${key}`);
    const parsed = saved ? JSON.parse(saved) : defaultVal;
    return parsed === null ? defaultVal : parsed;
  } catch (e) {
    return defaultVal;
  }
};

const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || num;

export default function BancoPreguntas({ initialFiltros = null, onFiltrosConsumed = null }) {
  const [quizFinished, setQuizFinished] = useState(false);
  const [syncState, setSyncState] = useState(null);
  const { stats, registrarRespuesta, getStatsPregunta, guardarNota, archivarPregunta, isArchivada } = usePreguntasStats();

  const asignaturasDisponibles = useMemo(() => {
    return [...new Set(QUESTIONS.map(q => q.asignatura))].filter(Boolean).sort();
  }, []);

  const [filtros, setFiltros] = useState(() => {
    const defaultFiltros = {
      asignaturas: [],
      soloFalladas: false,
      soloDudosas: false,
      soloNuevas: false,
      modoSimulacros: 'incluir'
    };
    const saved = getSessionData('filtros', defaultFiltros);
    return { ...defaultFiltros, ...saved };
  });

  const [cola, setCola] = useState(() => getSessionData('cola', []));
  const [currentIndex, setCurrentIndex] = useState(() => getSessionData('currentIndex', 0));
  const [respuestasDesglose, setRespuestasDesglose] = useState(() => getSessionData('respuestas', {}));

  // Modo Examen: por defecto activado (como en Desgloses) para evitar spoilers y permitir corrección al final
  const [modoExamen, setModoExamen] = useState(() => {
    try {
      const saved = localStorage.getItem('mir_banco_modo_examen');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [chatExportStatus, setChatExportStatus] = useState(null);
  const [ultimaTiradaPayload, setUltimaTiradaPayload] = useState(null);

  useEffect(() => {
    try {
      localStorage.setItem('mir_banco_modo_examen', JSON.stringify(modoExamen));
    } catch (e) {
      // ignore
    }
  }, [modoExamen]);

  useEffect(() => { sessionStorage.setItem('mir_banco_filtros', JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => { sessionStorage.setItem('mir_banco_cola', JSON.stringify(cola)); }, [cola]);
  useEffect(() => { sessionStorage.setItem('mir_banco_currentIndex', currentIndex.toString()); }, [currentIndex]);
  useEffect(() => { sessionStorage.setItem('mir_banco_respuestas', JSON.stringify(respuestasDesglose)); }, [respuestasDesglose]);

  // Aplicar filtros externos (desde "Practicar ahora" en Simulacros)
  useEffect(() => {
    if (!initialFiltros) return;
    const { asignatura, soloFalladas, autoStart } = initialFiltros;
    setFiltros(prev => ({
      ...prev,
      asignaturas: asignatura ? [asignatura] : [],
      soloFalladas: !!soloFalladas,
      modoSimulacros: 'exclusivo', // solo preguntas de simulacros (las que tienen stats de fallo)
    }));
    if (onFiltrosConsumed) onFiltrosConsumed();
    if (autoStart) {
      // Diferir handleFiltrar hasta que el estado esté actualizado
      setTimeout(() => {
        document.getElementById('banco-btn-generar')?.click();
      }, 100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFiltros]);

  const toggleAsignatura = (asig) => {
    setFiltros(prev => {
      const current = prev.asignaturas;
      if (current.includes(asig)) return { ...prev, asignaturas: current.filter(a => a !== asig) };
      return { ...prev, asignaturas: [...current, asig] };
    });
  };

  const handleFiltrar = () => {
    let filtradas = QUESTIONS;

    // Excluir preguntas archivadas
    filtradas = filtradas.filter(q => !isArchivada(q.id));

    if (filtros.asignaturas.length > 0) {
      filtradas = filtradas.filter(q => filtros.asignaturas.includes(q.asignatura));
    }

    if (filtros.modoSimulacros === 'excluir') {
      filtradas = filtradas.filter(q => !q.origen?.startsWith('Simulacro'));
    } else if (filtros.modoSimulacros === 'exclusivo') {
      filtradas = filtradas.filter(q => q.origen?.startsWith('Simulacro'));
    } else if (filtros.modoSimulacros === 'oficiales') {
      filtradas = filtradas.filter(q => {
        const o = (q.origen || '').toLowerCase();
        return o.includes('simulacro') || o.includes('desglose') || o.includes('mir');
      });
    }

    if (filtros.soloFalladas) {
      filtradas = filtradas.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return q.cto_fallada || pStats.fallos > 0;
      });
    }

    if (filtros.soloDudosas) {
      filtradas = filtradas.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return q.cto_dudosa || pStats.dudosa;
      });
    }

    if (filtros.soloNuevas) {
      filtradas = filtradas.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return !pStats.vecesVistas || pStats.vecesVistas === 0;
      });
    }

    // Calculate Proportional Sampling
    const MAX_PREGUNTAS = 50;
    let selectedQuestions = [];
    
    // Check if we have multiple subjects to balance
    const availableSubjects = [...new Set(filtradas.map(q => q.asignatura))];
    
    if (availableSubjects.length > 1) {
      const mirWeights = desgloseAnual[2025] || {};
      let totalWeight = 0;
      
      availableSubjects.forEach(sub => {
        totalWeight += (mirWeights[sub] || 1); // fallback to 1 if unknown
      });

      let remainingQuota = MAX_PREGUNTAS;
      let pool = [...filtradas];
      
      // First pass: proportional allocation
      const quotas = {};
      availableSubjects.forEach(sub => {
        const weight = mirWeights[sub] || 1;
        // round down to avoid exceeding limit prematurely, we fill the rest later
        const quota = Math.floor(MAX_PREGUNTAS * (weight / totalWeight));
        quotas[sub] = quota;
      });

      // Select questions using priority algorithm & adaptive quotas
      for (const sub of availableSubjects) {
        const quota = quotas[sub] || 1;
        if (quota > 0) {
          const subQuestions = generarColaPreguntas(pool, stats, sub, [], quota);
          selectedQuestions.push(...subQuestions);
          const takenIds = new Set(subQuestions.map(q => q.id));
          pool = pool.filter(q => !takenIds.has(q.id));
          remainingQuota -= subQuestions.length;
        }
      }

      // Fill remaining quota if needed
      if (remainingQuota > 0 && pool.length > 0) {
        const extraQuestions = generarColaPreguntas(pool, stats, null, [], remainingQuota);
        selectedQuestions.push(...extraQuestions);
      }
      
      // Shuffle final array to mix subjects
      selectedQuestions.sort(() => 0.5 - Math.random());
    } else {
      // Single subject or all subjects, apply priority algorithm & adaptive quotas
      selectedQuestions = generarColaPreguntas(filtradas, stats, null, [], MAX_PREGUNTAS);
    }

    setCola(selectedQuestions);
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
  };

  const currentQuestionData = cola[currentIndex];
  
  const questionForCard = currentQuestionData ? {
    id: currentQuestionData.id,
    text: currentQuestionData.text,
    image: currentQuestionData.image || currentQuestionData.imagen || currentQuestionData.imagen_nombre,
    options: currentQuestionData.options.map((opt, idx) => ({
      id: numToLetter(idx + 1),
      text: opt
    })),
    correctOption: numToLetter(currentQuestionData.answer)
  } : null;

  const currentAnswer = questionForCard ? respuestasDesglose[questionForCard.id] : null;

  const finalizarYExportarTirada = useCallback(async (colaActual, respuestasActuales) => {
    const payload = construirPayloadTirada({
      origen: 'Banco de Preguntas',
      asignatura: filtros.asignaturas?.length > 0 ? filtros.asignaturas.join(', ') : 'Banco Mixto',
      temas: [],
      resumenCola: null,
      cola: colaActual,
      respuestasDesglose: respuestasActuales
    });
    setUltimaTiradaPayload(payload);
    const status = await guardarTiradaParaChat(payload, {
      autoDownloadOnFallback: true,
      autoCopy: true
    });
    setChatExportStatus(status);
  }, [filtros.asignaturas]);

  const handleNext = useCallback((updatedRespuestas = null) => {
    const mapResp = updatedRespuestas || respuestasDesglose;
    if (currentIndex < cola.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      const contestadas = cola.filter(q => mapResp[q.id] && !mapResp[q.id].skipped);
      if (contestadas.length > 0) {
        finalizarYExportarTirada(cola, mapResp);
      }
      setQuizFinished(true);
    }
  }, [currentIndex, cola, respuestasDesglose, finalizarYExportarTirada]);

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(questionForCard.id, 'missing_data');
      }
      const nextResp = {
        ...respuestasDesglose,
        [questionForCard.id]: { skipped: true }
      };
      setRespuestasDesglose(nextResp);
      handleNext(nextResp);
      return;
    }

    const discardedCorrect = (answerData.discardedOptions || []).includes(questionForCard.correctOption);
    
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption, {
      confidence: answerData.confidence,
      subject: currentQuestionData?.asignatura
    });

    const nuevaEntrada = {
      isCorrect: answerData.isCorrect,
      selectedLetter: answerData.selectedOption,
      correctLetter: questionForCard.correctOption,
      discardedOptions: answerData.discardedOptions || [],
      discardedCorrect: discardedCorrect,
      confidence: answerData.confidence || 'green',
      seconds: answerData.seconds || 0,
      justificacion: answerData.justificacion || ''
    };

    const nextResp = {
      ...respuestasDesglose,
      [questionForCard.id]: nuevaEntrada
    };
    setRespuestasDesglose(nextResp);

    if (modoExamen) {
      handleNext(nextResp);
    }
  };

  const numToLetterIdx = (letter) => ['A', 'B', 'C', 'D', 'E'].indexOf(letter);

  const handleFinalizarSesion = async () => {
    const contestadasIds = new Set(
      Object.keys(respuestasDesglose).filter(qId => respuestasDesglose[qId] && !respuestasDesglose[qId].skipped)
    );

    if (contestadasIds.size === 0) {
      if (window.confirm('No has respondido ninguna pregunta. ¿Descartar la sesión?')) {
        setCola([]);
        setRespuestasDesglose({});
        setCurrentIndex(0);
        setQuizFinished(false);
        sessionStorage.removeItem('mir_banco_cola');
        sessionStorage.removeItem('mir_banco_respuestas');
        sessionStorage.removeItem('mir_banco_currentIndex');
      }
      return;
    }

    const finalCola = cola.filter(q => contestadasIds.has(q.id));
    await finalizarYExportarTirada(finalCola, respuestasDesglose);
    setCola(finalCola);
    setQuizFinished(true);
  };

  const sessionEnqueuedRef = React.useRef(false);
  useEffect(() => {
    if (!quizFinished) {
      sessionEnqueuedRef.current = false;
    }
  }, [quizFinished]);

  const runSync = React.useCallback(async () => {
    setSyncState({ status: 'syncing' });

    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length > 0 && !sessionEnqueuedRef.current) {
      sessionEnqueuedRef.current = true;
      const userId = getOrCreateAnonUserId();
      const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;
      createQuizResult(userId, {
        subject: filtros.asignaturas?.length > 0 ? filtros.asignaturas.join(', ') : 'Banco de Preguntas',
        question_count: contestadas.length,
        answers: contestadas.map(q => ({
          question_id: q.id,
          selected: respuestasDesglose[q.id]?.selectedLetter,
          is_correct: !!respuestasDesglose[q.id]?.isCorrect
        })),
        total_score: correctCount,
        duration_seconds: 0
      });
    }

    const res = await flushOfflineSyncQueue();
    if (res.success) {
      setSyncState({
        status: 'synced',
        syncedCount: res.syncedStats || contestadas.length,
        lastSyncTime: res.lastSyncTime
      });
    } else if (!res.isOnline) {
      setSyncState({
        status: 'offline',
        pendingCount: res.pendingStats || contestadas.length
      });
    } else {
      setSyncState({
        status: 'error',
        errorMsg: res.error,
        pendingCount: res.pendingStats || contestadas.length
      });
    }
  }, [cola, respuestasDesglose, filtros.asignaturas]);

  useEffect(() => {
    if (!quizFinished) return;
    runSync();
    const handleOnline = () => runSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [quizFinished, runSync]);

  if (quizFinished) {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;
    const falladasSesion = contestadas.filter(q => !respuestasDesglose[q.id]?.isCorrect);
    const netasSesion = (correctCount - falladasSesion.length / 3).toFixed(2);

    const fallosVerdes = falladasSesion.filter(q => respuestasDesglose[q.id]?.confidence === 'green').length;
    const aciertosDudosos = contestadas.filter(q => {
      const a = respuestasDesglose[q.id];
      return a?.isCorrect && (a.confidence === 'orange' || a.confidence === 'red');
    }).length;

    const handleCopyTirada = async () => {
      const payload = ultimaTiradaPayload || construirPayloadTirada({
        origen: 'Banco de Preguntas',
        asignatura: filtros.asignaturas?.length > 0 ? filtros.asignaturas.join(', ') : 'Banco Mixto',
        temas: [],
        resumenCola: null,
        cola,
        respuestasDesglose
      });
      const ok = await copiarTiradaAlPortapapeles(payload);
      if (ok) {
        setChatExportStatus(prev => ({ ...prev, copied: true }));
      }
    };

    const handleDownloadTirada = () => {
      const payload = ultimaTiradaPayload || construirPayloadTirada({
        origen: 'Banco de Preguntas',
        asignatura: filtros.asignaturas?.length > 0 ? filtros.asignaturas.join(', ') : 'Banco Mixto',
        temas: [],
        resumenCola: null,
        cola,
        respuestasDesglose
      });
      const ok = descargarTiradaJSON(payload);
      if (ok) {
        setChatExportStatus(prev => ({ ...prev, downloaded: true }));
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center">
        <div className="max-w-3xl w-full p-8 bg-white rounded-3xl shadow-lg border border-slate-100 text-center animate-in slide-in-from-bottom-8 fade-in duration-500 mb-8">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Sesión Finalizada</h2>
          <p className="text-slate-500 mb-6 font-medium">
            {filtros.asignaturas?.length > 0 ? filtros.asignaturas.join(', ') : 'Banco Mixto Global'} · {contestadas.length} preguntas
          </p>
          
          {/* CAJA DE AUDITORÍA EN EL CHAT (MODO SIMULACRO + ANKI) */}
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-cyan-50 to-slate-50 border-2 border-cyan-200 text-left shadow-xs">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-cyan-900 font-black text-base mb-1">
                  <span>🤖</span>
                  <span>Lista para Corregir en el Chat (Protocolo Simulacro + Anki)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {chatExportStatus?.savedDisk
                    ? '✅ Guardada automáticamente en disco (src/data/ultima_tirada.json) y en el portapapeles. Ve al chat y escribe: "Corrígeme la tirada".'
                    : chatExportStatus?.downloaded
                      ? '✅ Descargada automáticamente en ~/Downloads y copiada al portapapeles (funciona 100% sin Supabase). Ve al chat y escribe: "Corrígeme la tirada".'
                      : 'Guarda o copia esta tirada y pide en el chat: "Corrígeme la tirada".'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyTirada}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300 transition-colors shadow-2xs"
                >
                  {chatExportStatus?.copied ? '✓ Copiada al Portapapeles' : '📋 Copiar para el Chat'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTirada}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors shadow-2xs"
                >
                  📥 Descargar JSON
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-3xl font-black text-cyan-600">{netasSesion}</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Netas</div>
            </div>
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100">
              <div className="text-3xl font-black text-emerald-600">{correctCount}</div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mt-1">Aciertos</div>
            </div>
            <div className="bg-red-50/60 rounded-2xl p-4 border border-red-100">
              <div className="text-3xl font-black text-red-500">{falladasSesion.length}</div>
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mt-1">Fallos ({fallosVerdes} en Verde)</div>
            </div>
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100">
              <div className="text-3xl font-black text-amber-600">{aciertosDudosos}</div>
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-1">Aciertos Dudosos</div>
            </div>
          </div>

          {/* Banner de Sincronización con Supabase (Offline / Online) */}
          <SyncStatusBanner syncState={syncState} onRetry={runSync} className="mb-6 max-w-xl mx-auto" />

          <button 
            onClick={() => {
              setQuizFinished(false);
              setCola([]);
              setCurrentIndex(0);
              setRespuestasDesglose({});
              sessionStorage.removeItem('mir_banco_cola');
              sessionStorage.removeItem('mir_banco_respuestas');
              sessionStorage.removeItem('mir_banco_currentIndex');
            }}
            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold text-base hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
          >
            Configurar Nuevo Test
          </button>
        </div>

        {/* REVISIÓN DETALLADA DE RESPUESTAS Y EXPLICACIONES */}
        <div className="max-w-3xl w-full space-y-6">
          <h3 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>📋</span> Revisión de Preguntas Contestadas ({contestadas.length})
          </h3>

          {contestadas.map((q, idx) => {
            const ans = respuestasDesglose[q.id];
            if (!ans) return null;
            const isCorrect = ans.isCorrect;
            const idxSelected = ans.selectedLetter ? numToLetterIdx(ans.selectedLetter) : -1;
            const selectedOptText = idxSelected >= 0 && q.options ? q.options[idxSelected] : ans.selectedLetter;
            const correctOptText = q.options ? q.options[q.answer - 1] : numToLetter(q.answer);

            return (
              <div key={q.id} className={`p-6 bg-white rounded-2xl border-2 ${isCorrect ? 'border-emerald-200' : 'border-red-200'} shadow-sm space-y-4 text-left`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    {isCorrect ? '✓ Correcta' : '✗ Fallada'}
                  </span>
                  <span className="text-xs font-semibold text-slate-400">
                    Pregunta {idx + 1} de {contestadas.length} • {q.asignatura}
                  </span>
                </div>

                <div className="text-base font-bold text-slate-900 leading-snug">
                  {q.text}
                </div>

                {(q.image || q.imagen || q.imagen_nombre) && (
                  <ClinicalImage
                    src={q.image || q.imagen || q.imagen_nombre}
                    alt={q.text ? `Imagen: ${q.text.slice(0, 60)}...` : 'Imagen clínica asociada'}
                    className="mt-3"
                  />
                )}

                <div className="space-y-2 text-sm font-medium">
                  {!isCorrect && ans.selectedLetter && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                      <span className="font-bold">Tu respuesta:</span> {ans.selectedLetter}) {selectedOptText}
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="font-bold">Respuesta correcta:</span> {numToLetter(q.answer)}) {correctOptText}
                  </div>
                  {ans.justificacion && (
                    <div className="p-3 rounded-lg bg-indigo-50/80 text-indigo-900 border border-indigo-200 text-xs">
                      <span className="font-bold flex items-center gap-1.5 text-indigo-950 mb-0.5">
                        <span>💬</span> Tu justificación al responder:
                      </span>
                      <p className="italic font-normal leading-relaxed text-indigo-900">
                        "{ans.justificacion}"
                      </p>
                    </div>
                  )}
                </div>

                {q.comentario && (
                  <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                    <div className="font-bold text-slate-900 mb-2 text-sm">Explicación CTO:</div>
                    <div
                      className="comentario-html text-base sm:text-[17px] text-slate-800 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: q.comentario }}
                    />
                  </div>
                )}

                <NotaPersonal
                  preguntaId={q.id}
                  nota={getStatsPregunta(q.id)?.nota || ''}
                  onGuardar={guardarNota}
                />

                <TutorGemini
                  question={q}
                  userAnswer={ans?.selectedLetter}
                  isCorrect={isCorrect}
                  confidence={ans?.confidence || null}
                  discardedOptions={ans?.discardedOptions || []}
                  userReasoning={ans?.justificacion || ''}
                  commentary={q.comentario}
                  onGuardarNota={guardarNota}
                  currentNota={getStatsPregunta(q.id)?.nota || ''}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Banco de Preguntas Global</h2>

              {/* TOGGLE MODO EXAMEN / TUTOR */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModoExamen(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modoExamen
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="No muestra la respuesta al instante; pasa directamente a la siguiente como en un examen real para corregir toda la tirada al final en el chat"
                >
                  <span>🎯</span> Modo Examen (Tirada)
                </button>
                <button
                  type="button"
                  onClick={() => setModoExamen(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    !modoExamen
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Muestra la respuesta correcta y la explicación de CTO inmediatamente después de responder"
                >
                  <span>💡</span> Modo Tutor
                </button>
              </div>
            </div>

            {cola.length > 0 && (
              <button 
                onClick={handleFinalizarSesion}
                className="text-red-500 hover:text-red-600 font-bold text-sm bg-red-50 px-3 py-1.5 rounded-lg border border-red-200 transition-colors"
              >
                🏁 Finalizar y Revisar Test
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[250px]">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Asignaturas (Vacío = Todas)
                </label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {asignaturasDisponibles.map(asig => (
                    <button
                      key={asig}
                      onClick={() => toggleAsignatura(asig)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors border ${
                        filtros.asignaturas.includes(asig) 
                          ? 'bg-cyan-500 text-white border-cyan-500' 
                          : 'bg-white text-slate-600 border-slate-300 hover:border-cyan-400'
                      }`}
                    >
                      {asig}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full sm:w-48 shrink-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Origen
                </label>
                <select 
                  value={filtros.modoSimulacros}
                  onChange={e => setFiltros(prev => ({ ...prev, modoSimulacros: e.target.value }))}
                  className="w-full border-2 border-slate-200 rounded-lg px-4 py-2 font-medium text-slate-700 outline-none focus:border-cyan-500 transition-colors bg-white"
                >
                  <option value="incluir">Todas (Banco + Simulacros + Desgloses)</option>
                  <option value="oficiales">🎯 Solo Simulacros y Desgloses</option>
                  <option value="exclusivo">Solo Simulacros</option>
                  <option value="excluir">Solo Banco y Desgloses</option>
                </select>
              </div>

              <div className="w-full sm:w-64 shrink-0">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Rendimiento Histórico
                </label>
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={filtros.soloFalladas}
                      onChange={e => setFiltros(prev => ({ ...prev, soloFalladas: e.target.checked, soloNuevas: false }))}
                      className="rounded border-slate-300 text-cyan-500 focus:ring-cyan-500"
                    />
                    Solo falladas
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={filtros.soloDudosas}
                      onChange={e => setFiltros(prev => ({ ...prev, soloDudosas: e.target.checked, soloNuevas: false }))}
                      className="rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    Solo marcadas dudosas
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={filtros.soloNuevas}
                      onChange={e => setFiltros(prev => ({ ...prev, soloNuevas: e.target.checked, soloFalladas: false, soloDudosas: false }))}
                      className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
                    />
                    Solo preguntas nuevas (no vistas)
                  </label>
                </div>
              </div>
            </div>

            <button 
              id="banco-btn-generar"
              onClick={handleFiltrar}
              className="w-full bg-slate-900 text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors mt-2"
            >
              Generar Test Aleatorio (Máx 50)
            </button>
          </div>
        </div>

        {cola.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center">
            <div className="text-4xl mb-4">📭</div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No hay preguntas activas</h3>
            <p className="text-slate-500">
              Selecciona tus filtros arriba y haz clic en "Generar Test Aleatorio" para comenzar.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                  Progreso {modoExamen ? '• Modo Examen (Tirada)' : '• Modo Tutor'}
                </div>
                <div className="text-sm font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                  {currentIndex + 1} / {cola.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {cola.map((_, idx) => {
                  const qId = cola[idx].id;
                  const ans = respuestasDesglose[qId];
                  let bgColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  
                  if (ans) {
                    if (ans.skipped) {
                      bgColor = 'bg-slate-200 text-slate-500 border-slate-300';
                    } else if (modoExamen) {
                      if (ans.confidence === 'orange') {
                        bgColor = 'bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-2xs';
                      } else if (ans.confidence === 'red') {
                        bgColor = 'bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs';
                      } else {
                        bgColor = 'bg-cyan-100 text-cyan-800 border-cyan-300 font-bold shadow-2xs';
                      }
                    } else {
                      if (ans.isCorrect) bgColor = 'bg-emerald-100 text-emerald-700 border-emerald-300 font-bold';
                      else bgColor = 'bg-red-100 text-red-700 border-red-300 font-bold';
                    }
                  }
                  
                  if (idx === currentIndex) {
                    bgColor += ' ring-2 ring-cyan-500 ring-offset-1 font-bold';
                  }

                  return (
                    <button 
                      key={idx}
                      type="button"
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-7 h-7 rounded-lg border text-xs flex items-center justify-center transition-all ${bgColor}`}
                      title={
                        ans && !ans.skipped && modoExamen
                          ? `Pregunta ${idx + 1}: Marcada ${ans.selectedLetter} (Confianza: ${ans.confidence || 'verde'})`
                          : `Pregunta ${idx + 1}`
                      }
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold px-3 py-1.5 rounded-lg">
                {currentQuestionData.asignatura}
              </span>
              <span className="bg-orange-50 text-orange-700 border border-orange-200 text-xs font-bold px-3 py-1.5 rounded-lg">
                {currentQuestionData.origen}
              </span>
            </div>

            {/* AVISO SI VUELVE A UNA PREGUNTA YA CONTESTADA EN MODO EXAMEN */}
            {modoExamen && currentAnswer && !currentAnswer.skipped && (
              <div className="px-4 py-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-bold flex items-center justify-between">
                <span>
                  📌 Ya marcaste la opción <strong>{currentAnswer.selectedLetter}</strong> (Seguridad: {currentAnswer.confidence === 'green' ? 'Verde' : currentAnswer.confidence === 'orange' ? 'Dudosa' : 'Rojo'}). Puedes cambiarla si lo deseas.
                </span>
                <button
                  type="button"
                  onClick={() => handleNext()}
                  className="text-cyan-700 hover:underline ml-4"
                >
                  Siguiente →
                </button>
              </div>
            )}

            <div className={!modoExamen && currentAnswer ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
              <QuestionCard 
                key={currentQuestionData.id} 
                question={questionForCard} 
                onAnswer={handleAnswerSubmit} 
                onNext={() => handleNext()}
                examMode={modoExamen}
                initialAnswer={modoExamen ? currentAnswer : null}
              />
            </div>

            {/* MODO TUTOR INMEDIATO (Solo visible si modoExamen === false) */}
            {!modoExamen && currentAnswer && !currentAnswer.skipped && (
              <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-cyan-500 animate-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3 mb-4">
                  {currentAnswer.isCorrect ? (
                    <span className="text-2xl">✅</span>
                  ) : (
                    <span className="text-2xl">❌</span>
                  )}
                  <h3 className="font-bold text-lg text-slate-900">
                    {currentAnswer.isCorrect ? '¡Correcto!' : 'Incorrecto'}
                  </h3>
                </div>
                
                <div className="space-y-4 text-slate-700">
                  <p className="bg-cyan-50 p-4 rounded-lg">
                    <span className="font-bold text-cyan-800 block mb-1">Respuesta correcta: {currentAnswer.correctLetter}</span>
                    {currentQuestionData.options[currentQuestionData.answer - 1]}
                  </p>

                  {(currentQuestionData.image || currentQuestionData.imagen || currentQuestionData.imagen_nombre) && (
                    <ClinicalImage
                      src={currentQuestionData.image || currentQuestionData.imagen || currentQuestionData.imagen_nombre}
                      alt={currentQuestionData.text ? `Imagen: ${currentQuestionData.text.slice(0, 60)}...` : 'Imagen clínica asociada'}
                      className="mt-3"
                    />
                  )}
                  
                  <NotaPersonal
                    preguntaId={currentQuestionData.id}
                    nota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                    onGuardar={guardarNota}
                  />

                  <TutorGemini
                    question={currentQuestionData}
                    userAnswer={currentAnswer.selectedLetter}
                    isCorrect={currentAnswer.isCorrect}
                    confidence={currentAnswer.confidence}
                    discardedOptions={currentAnswer.discardedOptions || []}
                    userReasoning={currentAnswer.justificacion || ''}
                    commentary={currentQuestionData.comentario}
                    onGuardarNota={guardarNota}
                    currentNota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                  />

                  {currentQuestionData.comentario && (
                    <div className="mt-4 bg-white/80 p-5 rounded-xl border border-slate-200">
                      <div className="font-bold text-slate-900 mb-2 text-sm">Explicación CTO:</div>
                      <div
                        className="comentario-html text-base sm:text-[17px] text-slate-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: currentQuestionData.comentario }}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button 
                    type="button"
                    onClick={() => handleNext()}
                    className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                  >
                    <span>{currentIndex >= cola.length - 1 ? 'Finalizar Sesión 🎉' : 'Siguiente Pregunta →'}</span>
                    <kbd className="hidden sm:inline-block font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Enter ↵
                    </kbd>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
