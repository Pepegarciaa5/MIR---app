import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { getOrCreateAnonUserId, createQuizResult, enqueueQuestionStat, flushOfflineSyncQueue } from '../utils/quizSync';
import { construirPayloadTirada, guardarTiradaParaChat, descargarTiradaJSON, copiarTiradaAlPortapapeles } from '../utils/tiradaStorage';
import desglosesData from '../data/desgloses_filtrables.json';
import QuestionCard from '../components/quiz/QuestionCard';
import NotaPersonal from '../components/quiz/NotaPersonal';
import TutorGemini from '../components/quiz/TutorGemini';
import SyncStatusBanner from '../components/quiz/SyncStatusBanner';

const getSessionData = (key, defaultVal) => {
  try {
    const saved = sessionStorage.getItem(`mir_desgloses_${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

export default function Desgloses() {
  const [quizFinished, setQuizFinished] = useState(false);
  const [syncState, setSyncState] = useState(null);
  const [chatExportStatus, setChatExportStatus] = useState(null);
  const [ultimaTiradaPayload, setUltimaTiradaPayload] = useState(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const { stats, isSyncing, registrarRespuesta, getStatsPregunta, guardarNota, archivarPregunta, isArchivada, isEnLatencia } = usePreguntasStats();

  // Modo Examen (por defecto activo: sin feedback inmediato, avanza directo y se corrige al final en el chat)
  const [modoExamen, setModoExamen] = useState(() => {
    try {
      const saved = localStorage.getItem('mir_desgloses_modo_examen');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mir_desgloses_modo_examen', String(modoExamen));
    } catch {}
  }, [modoExamen]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Extract distinct subjects and topics
  const asignaturas = useMemo(() => {
    return [...new Set(desglosesData.map(q => q.asignatura))].filter(Boolean).sort();
  }, []);

  // Filter States
  const [filtros, setFiltros] = useState(() => {
    const defaultFiltros = {
      asignatura: '',
      temas: [],
      dificultad: [],
      minYear: 2010,
      soloNoHechas: true,
      soloFalladas: false,
      tamanoTirada: 60,
      rellenarHastaCupo: true
    };
    const saved = getSessionData('filtros', defaultFiltros);
    if (saved.tema !== undefined) {
      delete saved.tema;
      saved.temas = [];
    }
    if (saved.tamanoTirada === undefined) saved.tamanoTirada = 60;
    if (saved.rellenarHastaCupo === undefined) saved.rellenarHastaCupo = true;
    return { ...defaultFiltros, ...saved };
  });

  const toggleTema = (t) => {
    setFiltros(prev => {
      const current = prev.temas || [];
      if (current.includes(t)) {
        return { ...prev, temas: current.filter(x => x !== t) };
      }
      return { ...prev, temas: [...current, t] };
    });
  };

  const temasDisponibles = useMemo(() => {
    if (!filtros.asignatura) return [];
    const temas = desglosesData
      .filter(q => q.asignatura === filtros.asignatura)
      .map(q => q.tema)
      .filter(Boolean);
    return [...new Set(temas)].sort();
  }, [filtros.asignatura]);

  // Queue State
  const [cola, setCola] = useState(() => getSessionData('cola', []));
  const [resumenCola, setResumenCola] = useState(() => getSessionData('resumenCola', null));
  const [currentIndex, setCurrentIndex] = useState(() => getSessionData('currentIndex', 0));
  
  // Feedback State map: { questionId: { isCorrect, selectedLetter, correctLetter, discardedOptions, discardedCorrect, confidence, seconds, skipped } }
  const [respuestasDesglose, setRespuestasDesglose] = useState(() => getSessionData('respuestas', {}));

  // Sync to sessionStorage on change
  useEffect(() => { sessionStorage.setItem('mir_desgloses_filtros', JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_cola', JSON.stringify(cola)); }, [cola]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_resumenCola', JSON.stringify(resumenCola)); }, [resumenCola]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_currentIndex', JSON.stringify(currentIndex)); }, [currentIndex]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_respuestas', JSON.stringify(respuestasDesglose)); }, [respuestasDesglose]);

  const currentQuestionData = cola[currentIndex];
  const currentAnswer = currentQuestionData ? respuestasDesglose[currentQuestionData.id] : null;

  // Comprobar de forma exhaustiva si una pregunta ya fue contestada o archivada
  const isPreguntaHecha = useCallback((qId) => {
    const pStats = getStatsPregunta(qId);
    if (!pStats) return false;
    return (
      (pStats.vecesVistas > 0) ||
      (pStats.aciertos > 0) ||
      (pStats.fallos > 0) ||
      pStats.status === 'mastered' ||
      pStats.status === 'needs_review' ||
      pStats.status === 'corrected' ||
      pStats.status === 'archived' ||
      !!pStats.archivada ||
      !!pStats.ultimaFecha
    );
  }, [getStatsPregunta]);

  // Ordenar candidatos priorizando: no en latencia > falladas/prioridad alta > no hechas > año más reciente
  const ordenarCandidatas = useCallback((lista) => {
    return [...lista].sort((a, b) => {
      const latA = isEnLatencia ? isEnLatencia(a.id) : false;
      const latB = isEnLatencia ? isEnLatencia(b.id) : false;
      if (latA !== latB) return latA ? 1 : -1;

      const stA = getStatsPregunta(a.id);
      const stB = getStatsPregunta(b.id);
      const prioA = stA?.puntuacionPrioridad ?? (stA ? 4 : 7); // No vista = prioridad 7
      const prioB = stB?.puntuacionPrioridad ?? (stB ? 4 : 7);
      if (prioA !== prioB) return prioB - prioA;

      return (b.anualidad || 2015) - (a.anualidad || 2015);
    });
  }, [getStatsPregunta, isEnLatencia]);

  const aplicarFiltrosCon = useCallback((filtrosActuales) => {
    const basePool = desglosesData.filter(q => !isArchivada(q.id));
    let nucleo = [...basePool];

    if (filtrosActuales.asignatura) {
      nucleo = nucleo.filter(q => q.asignatura === filtrosActuales.asignatura);
    }
    if (filtrosActuales.temas && filtrosActuales.temas.length > 0) {
      nucleo = nucleo.filter(q => filtrosActuales.temas.includes(q.tema));
    }
    if (filtrosActuales.dificultad.length > 0) {
      nucleo = nucleo.filter(q => filtrosActuales.dificultad.includes(q.dificultad));
    }
    if (filtrosActuales.minYear) {
      nucleo = nucleo.filter(q => q.anualidad >= filtrosActuales.minYear);
    }
    if (filtrosActuales.soloNoHechas) {
      nucleo = nucleo.filter(q => !isPreguntaHecha(q.id));
    }
    if (filtrosActuales.soloFalladas) {
      nucleo = nucleo.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return pStats.fallos > 0;
      });
    }

    nucleo = ordenarCandidatas(nucleo).map(q => ({ ...q, origenTirada: 'tema_estudiado' }));

    const cupoObjetivo = Number(filtrosActuales.tamanoTirada) || 0;
    let seleccionFinal = [];
    let countTema = 0;
    let countRellenoAsig = 0;
    let countRellenoGlobal = 0;

    if (cupoObjetivo <= 0) {
      // Sin límite (Todas)
      seleccionFinal = nucleo;
      countTema = nucleo.length;
    } else if (nucleo.length >= cupoObjetivo) {
      seleccionFinal = nucleo.slice(0, cupoObjetivo);
      countTema = seleccionFinal.length;
    } else {
      seleccionFinal = [...nucleo];
      countTema = seleccionFinal.length;

      if (filtrosActuales.rellenarHastaCupo) {
        const usadosIds = new Set(seleccionFinal.map(q => q.id));
        let faltan = cupoObjetivo - seleccionFinal.length;

        // Escalón 1 de Relleno: Otras preguntas de la MISMA asignatura (otros temas o hechas con latencia vencida)
        if (faltan > 0 && filtrosActuales.asignatura) {
          let poolAsig = basePool.filter(q =>
            q.asignatura === filtrosActuales.asignatura &&
            !usadosIds.has(q.id) &&
            (!filtrosActuales.minYear || q.anualidad >= filtrosActuales.minYear)
          );
          if (filtrosActuales.soloNoHechas) {
            const noHechasAsig = poolAsig.filter(q => !isPreguntaHecha(q.id));
            const repasoAsig = poolAsig.filter(q => isPreguntaHecha(q.id) && !(isEnLatencia && isEnLatencia(q.id)));
            poolAsig = [...ordenarCandidatas(noHechasAsig), ...ordenarCandidatas(repasoAsig)];
          } else {
            poolAsig = ordenarCandidatas(poolAsig);
          }

          const tomadasAsig = poolAsig.slice(0, faltan).map(q => ({ ...q, origenTirada: 'relleno_asignatura' }));
          seleccionFinal.push(...tomadasAsig);
          tomadasAsig.forEach(q => usadosIds.add(q.id));
          countRellenoAsig = tomadasAsig.length;
          faltan = cupoObjetivo - seleccionFinal.length;
        }

        // Escalón 2 de Relleno: Repaso adaptativo global (falladas/dudosas fuera de latencia o no hechas)
        if (faltan > 0) {
          let poolGlobal = basePool.filter(q =>
            !usadosIds.has(q.id) &&
            !(isEnLatencia && isEnLatencia(q.id)) &&
            (!filtrosActuales.minYear || q.anualidad >= filtrosActuales.minYear)
          );
          poolGlobal = ordenarCandidatas(poolGlobal);
          const tomadasGlobal = poolGlobal.slice(0, faltan).map(q => ({ ...q, origenTirada: 'relleno_global' }));
          seleccionFinal.push(...tomadasGlobal);
          countRellenoGlobal = tomadasGlobal.length;
        }
      }
    }

    setCola(seleccionFinal);
    setResumenCola({
      total: seleccionFinal.length,
      deTema: countTema,
      rellenoAsig: countRellenoAsig,
      rellenoGlobal: countRellenoGlobal
    });
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
    setChatExportStatus(null);
    setUltimaTiradaPayload(null);
  }, [isArchivada, isPreguntaHecha, getStatsPregunta, isEnLatencia, ordenarCandidatas]);

  const handleFiltrar = () => {
    aplicarFiltrosCon(filtros);
  };

  const handleToggleSoloNoHechas = (checked) => {
    const nuevosFiltros = { ...filtros, soloNoHechas: checked, soloFalladas: false };
    setFiltros(nuevosFiltros);
    if (cola.length > 0 && Object.keys(respuestasDesglose).length === 0) {
      aplicarFiltrosCon(nuevosFiltros);
    }
  };

  const handleToggleSoloFalladas = (checked) => {
    const nuevosFiltros = { ...filtros, soloFalladas: checked, soloNoHechas: false };
    setFiltros(nuevosFiltros);
    if (cola.length > 0 && Object.keys(respuestasDesglose).length === 0) {
      aplicarFiltrosCon(nuevosFiltros);
    }
  };

  const finalizarYExportarTirada = useCallback(async (colaActual, respuestasActuales) => {
    const contestadas = colaActual.filter(q => respuestasActuales[q.id] && !respuestasActuales[q.id].skipped);
    const payload = construirPayloadTirada({
      origen: 'Desgloses',
      asignatura: filtros.asignatura || 'Mixto',
      temas: filtros.temas || [],
      resumenCola,
      cola: contestadas.length > 0 ? contestadas : colaActual,
      respuestasDesglose: respuestasActuales
    });
    setUltimaTiradaPayload(payload);

    const status = await guardarTiradaParaChat(payload, {
      autoDownloadOnFallback: true,
      autoCopy: true
    });
    setChatExportStatus(status);
  }, [filtros.asignatura, filtros.temas, resumenCola]);

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

  const terminarDesglose = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    
    if (contestadas.length === 0) {
      if (window.confirm("¿Seguro que quieres cerrar este desglose?")) {
        setCola([]);
        setResumenCola(null);
        setCurrentIndex(0);
        setRespuestasDesglose({});
        sessionStorage.removeItem('mir_desgloses_cola');
        sessionStorage.removeItem('mir_desgloses_resumenCola');
        sessionStorage.removeItem('mir_desgloses_respuestas');
        sessionStorage.removeItem('mir_desgloses_currentIndex');
      }
      return;
    }

    const userId = getOrCreateAnonUserId();
    contestadas.forEach(q => {
      const pStats = getStatsPregunta(q.id);
      if (pStats) {
        enqueueQuestionStat(userId, q.id, {
          subject: q.asignatura || filtros.asignatura || 'Desgloses MIR',
          status: pStats.status || (pStats.fallos > 0 ? 'needs_review' : 'mastered'),
          note: pStats.nota || '',
          confidence_history: pStats.confidence_history || [],
          racha_verde: pStats.rachaVerde || 0,
          latencia_hasta: pStats.latenciaHasta || null,
          puntuacion_prioridad: pStats.puntuacionPrioridad || 7
        });
      }
    });

    await flushOfflineSyncQueue().catch(err => console.warn('Flush error en terminarDesglose:', err));

    await finalizarYExportarTirada(contestadas, respuestasDesglose);
    setCola(contestadas);
    setQuizFinished(true);
  };

  const handleFinalizarSesion = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length === 0) {
      terminarDesglose();
      return;
    }
    await finalizarYExportarTirada(contestadas, respuestasDesglose);
    setCola(contestadas);
    setQuizFinished(true);
  };

  const toggleDificultad = (dif) => {
    setFiltros(prev => {
      const current = prev.dificultad;
      if (current.includes(dif)) {
        return { ...prev, dificultad: current.filter(d => d !== dif) };
      }
      return { ...prev, dificultad: [...current, dif] };
    });
  };

  const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || num;

  // Transform data format for QuestionCard
  const questionForCard = currentQuestionData ? {
    id: currentQuestionData.id,
    text: currentQuestionData.enunciado,
    image: currentQuestionData.imagen_nombre || currentQuestionData.image,
    options: currentQuestionData.respuestas.map(r => ({
      id: numToLetter(r.numero),
      text: r.enunciado
    })),
    correctOption: (() => {
      const corr = currentQuestionData.respuestas.find(r => r.correcta);
      return corr ? numToLetter(corr.numero) : null;
    })()
  } : null;

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(currentQuestionData.id, 'missing_data');
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
    
    // Registrar en estadísticas locales con nivel de confianza y asignatura
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption, {
      confidence: answerData.confidence,
      subject: currentQuestionData.asignatura
    });

    const nuevaEntrada = {
      isCorrect: answerData.isCorrect,
      selectedLetter: answerData.selectedOption,
      correctLetter: questionForCard.correctOption,
      discardedOptions: answerData.discardedOptions || [],
      discardedCorrect: discardedCorrect,
      confidence: answerData.confidence || 'green',
      seconds: answerData.seconds || 0
    };

    const nextResp = {
      ...respuestasDesglose,
      [questionForCard.id]: nuevaEntrada
    };
    setRespuestasDesglose(nextResp);

    // En Modo Examen no mostramos la respuesta: pasamos inmediatamente a la siguiente pregunta
    if (modoExamen) {
      handleNext(nextResp);
    }
  };

  const sessionEnqueuedRef = React.useRef(false);
  useEffect(() => {
    if (!quizFinished) {
      sessionEnqueuedRef.current = false;
    }
  }, [quizFinished]);

  const runSync = useCallback(async () => {
    setSyncState({ status: 'syncing' });

    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length > 0 && !sessionEnqueuedRef.current) {
      sessionEnqueuedRef.current = true;
      const userId = getOrCreateAnonUserId();
      const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;

      contestadas.forEach(q => {
        const pStats = getStatsPregunta(q.id);
        if (pStats) {
          enqueueQuestionStat(userId, q.id, {
            subject: q.asignatura || filtros.asignatura || 'Desgloses MIR',
            status: pStats.status || (pStats.fallos > 0 ? 'needs_review' : 'mastered'),
            note: pStats.nota || '',
            confidence_history: pStats.confidence_history || [],
            racha_verde: pStats.rachaVerde || 0,
            latencia_hasta: pStats.latenciaHasta || null,
            puntuacion_prioridad: pStats.puntuacionPrioridad || 7
          });
        }
      });

      createQuizResult(userId, {
        subject: filtros.asignatura ? `Desglose: ${filtros.asignatura}` : 'Desgloses MIR',
        question_count: contestadas.length,
        answers: contestadas.map(q => ({
          question_id: q.id,
          selected: respuestasDesglose[q.id]?.selectedLetter,
          is_correct: !!respuestasDesglose[q.id]?.isCorrect,
          confidence: respuestasDesglose[q.id]?.confidence || 'green',
          discarded_correct: !!respuestasDesglose[q.id]?.discardedCorrect
        })),
        total_score: correctCount,
        duration_seconds: contestadas.reduce((acc, q) => acc + (respuestasDesglose[q.id]?.seconds || 0), 0)
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
  }, [cola, respuestasDesglose, filtros.asignatura, getStatsPregunta]);

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

    const handleRepasarErrores = () => {
      setCola(falladasSesion);
      setCurrentIndex(0);
      setRespuestasDesglose({});
      setQuizFinished(false);
      setSyncState(null);
    };

    const handleCopyTirada = async () => {
      const payload = ultimaTiradaPayload || construirPayloadTirada({
        origen: 'Desgloses',
        asignatura: filtros.asignatura || 'Mixto',
        temas: filtros.temas || [],
        resumenCola,
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
        origen: 'Desgloses',
        asignatura: filtros.asignatura || 'Mixto',
        temas: filtros.temas || [],
        resumenCola,
        cola,
        respuestasDesglose
      });
      const ok = descargarTiradaJSON(payload);
      if (ok) {
        setChatExportStatus(prev => ({ ...prev, downloaded: true }));
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
        <div className="max-w-3xl w-full p-8 md:p-10 bg-white rounded-3xl shadow-lg border border-slate-100 text-center animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-3xl font-black text-slate-900 mb-1">Tirada de Desgloses Finalizada</h2>
          <p className="text-slate-500 mb-6 font-medium">
            {filtros.asignatura ? `${filtros.asignatura}` : 'Mixto'}
            {filtros.temas?.length > 0 ? ` · ${filtros.temas.length} tema(s)` : ''}
          </p>

          {/* CAJA DE AUDITORÍA EN EL CHAT (MODO SIMULACRO SIN SUPABASE) */}
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

          {/* BANNER DE SINCRONIZACIÓN CON SUPABASE / OFFLINE */}
          <SyncStatusBanner syncState={syncState} onRetry={runSync} className="mb-8" />

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {falladasSesion.length > 0 && (
              <button
                onClick={handleRepasarErrores}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                ❌ Re-hacer {falladasSesion.length} fallos en la app
              </button>
            )}
            <button 
              onClick={() => {
                setQuizFinished(false);
                setCola([]);
                setResumenCola(null);
                setCurrentIndex(0);
                setRespuestasDesglose({});
                setSyncState(null);
                sessionStorage.removeItem('mir_desgloses_cola');
                sessionStorage.removeItem('mir_desgloses_resumenCola');
                sessionStorage.removeItem('mir_desgloses_respuestas');
                sessionStorage.removeItem('mir_desgloses_currentIndex');
              }}
              className="bg-slate-900 text-white px-6 py-3.5 rounded-xl font-bold text-base hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
            >
              Nueva Tirada de Desgloses
            </button>
          </div>
        </div>
      </div>
    );
  }

  const contestadasCount = Object.keys(respuestasDesglose).filter(qId => respuestasDesglose[qId] && !respuestasDesglose[qId].skipped).length;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* PANEL SUPERIOR DE FILTROS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Desgloses Oficiales MIR</h2>

              {/* Toggle Modo Examen vs Modo Tutor */}
              <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
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
                  title="Muestra la respuesta correcta y el comentario de CTO inmediatamente después de cada pregunta"
                >
                  <span>💡</span> Modo Tutor
                </button>
              </div>

              {isOffline && (
                <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5 font-medium">
                  <span>📡</span> Guardado Local Activo
                </span>
              )}
            </div>

            {cola.length > 0 && (
              <div className="flex items-center gap-2">
                {contestadasCount > 0 && (
                  <button 
                    onClick={handleFinalizarSesion}
                    className="text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    🏁 Finalizar y Corregir ({contestadasCount}/{cola.length})
                  </button>
                )}
                <button 
                  onClick={terminarDesglose}
                  className="text-sm text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                >
                  Cerrar ✕
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            {/* Asignatura */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Asignatura</label>
              <select 
                value={filtros.asignatura}
                onChange={e => setFiltros({...filtros, asignatura: e.target.value, temas: []})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Todas</option>
                {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Tamaño de Tirada */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Tamaño de Tirada</label>
              <select 
                value={filtros.tamanoTirada ?? 60}
                onChange={e => setFiltros({...filtros, tamanoTirada: parseInt(e.target.value, 10)})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-bold text-slate-800 focus:ring-cyan-500"
              >
                <option value={60}>60 preguntas (Bloque 2h)</option>
                <option value={45}>45 preguntas</option>
                <option value={30}>30 preguntas (Tarde corta)</option>
                <option value={0}>Todas las disponibles</option>
              </select>
            </div>

            {/* Año */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Desde el año</label>
              <select 
                value={filtros.minYear}
                onChange={e => setFiltros({...filtros, minYear: parseInt(e.target.value)})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-cyan-500"
              >
                <option value={2010}>2010</option>
                <option value={2015}>2015</option>
                <option value={2020}>2020</option>
                <option value={2023}>2023</option>
              </select>
            </div>

            {/* Botón Filtrar */}
            <button 
              onClick={handleFiltrar}
              className="bg-slate-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Generar Tirada
            </button>
          </div>

          {/* Selector de Temas Múltiples (Solo visible si hay asignatura elegida) */}
          {filtros.asignatura && temasDisponibles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Temas estudiados en tu bloque de 2h ({filtros.temas?.length || 0} seleccionados)
                </span>
                {filtros.temas?.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiltros(prev => ({ ...prev, temas: [] }))}
                    className="text-xs font-bold text-cyan-600 hover:underline"
                  >
                    Limpiar temas
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 pb-2">
                {temasDisponibles.map(t => {
                  const isSelected = filtros.temas?.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTema(t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors text-left ${
                        isSelected 
                          ? 'bg-cyan-50 border-cyan-500 text-cyan-800 font-bold shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dificultad y Filtros Extra */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase">Dificultad:</span>
              {[1, 2, 3, 4, 5].map(d => (
                <label key={d} className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={filtros.dificultad.includes(d)}
                    onChange={() => toggleDificultad(d)}
                    className="rounded text-cyan-500 focus:ring-cyan-500"
                  /> 
                  N{d}
                </label>
              ))}
            </div>
            
            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

            {filtros.tamanoTirada > 0 && (
              <label
                className="flex items-center gap-2 text-sm font-bold text-cyan-800 bg-cyan-50/70 px-3 py-1 rounded-lg border border-cyan-200 cursor-pointer"
                title="Si los temas seleccionados tienen menos de 60 preguntas, completa automáticamente hasta 60 con otras preguntas de la asignatura y de repaso adaptativo"
              >
                <input 
                  type="checkbox" 
                  checked={filtros.rellenarHastaCupo}
                  onChange={e => setFiltros(prev => ({ ...prev, rellenarHastaCupo: e.target.checked }))}
                  className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500"
                />
                ➕ Rellenar hasta {filtros.tamanoTirada} si faltan
              </label>
            )}
            
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filtros.soloNoHechas}
                onChange={e => handleToggleSoloNoHechas(e.target.checked)}
                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              Ocultar ya hechas
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filtros.soloFalladas}
                onChange={e => handleToggleSoloFalladas(e.target.checked)}
                className="rounded border-slate-300 text-red-500 focus:ring-red-500"
              />
              Solo mis falladas
            </label>
          </div>
        </div>

        {/* ZONA CENTRAL - COLA DE TIRADA */}
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200">
          
          {cola.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-slate-900">Configura tu tirada de bloque</h3>
              <p className="text-slate-500">
                Elige la asignatura y los temas que acabas de estudiar y pulsa <strong>Generar Tirada</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* BANNER COMPOSICIÓN DE LA TIRADA */}
              {resumenCola && (
                <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 flex-wrap font-semibold text-slate-700">
                    <span>📊 Composición de la tirada ({resumenCola.total} preg):</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 font-bold">
                      {resumenCola.deTema} de tu filtro exacto
                    </span>
                    {resumenCola.rellenoAsig > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold">
                        +{resumenCola.rellenoAsig} resto de {filtros.asignatura}
                      </span>
                    )}
                    {resumenCola.rellenoGlobal > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                        +{resumenCola.rellenoGlobal} repaso adaptativo global
                      </span>
                    )}
                  </div>
                  {modoExamen && (
                    <span className="text-[11px] font-bold text-slate-500">
                      🎯 Modo Examen: sin spoilers hasta finalizar
                    </span>
                  )}
                </div>
              )}
              
              {/* NAVEGADOR DE PREGUNTAS (REJILLA) */}
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                {cola.map((q, idx) => {
                  const estado = respuestasDesglose[q.id];
                  let bgColor = "bg-white text-slate-500 border-slate-200 hover:border-cyan-400";
                  
                  if (estado) {
                    if (estado.skipped) {
                      bgColor = "bg-slate-200 text-slate-500 border-slate-300";
                    } else if (modoExamen) {
                      // En Modo Examen NO revelamos si acertó o falló; pintamos según su confianza
                      if (estado.confidence === 'orange') {
                        bgColor = "bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-2xs";
                      } else if (estado.confidence === 'red') {
                        bgColor = "bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs";
                      } else {
                        bgColor = "bg-cyan-100 text-cyan-800 border-cyan-300 font-bold shadow-2xs";
                      }
                    } else {
                      if (estado.isCorrect) bgColor = "bg-emerald-100 text-emerald-700 border-emerald-200 font-bold shadow-sm";
                      else bgColor = "bg-red-100 text-red-700 border-red-200 font-bold shadow-sm";
                    }
                  }
                  
                  if (idx === currentIndex) {
                    bgColor += " ring-2 ring-cyan-500 ring-offset-2 scale-110 shadow-md";
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-9 h-9 rounded-full border text-xs flex items-center justify-center transition-all ${bgColor}`}
                      title={
                        estado && !estado.skipped && modoExamen
                          ? `Pregunta ${idx + 1}: Marcada ${estado.selectedLetter} (Confianza: ${estado.confidence})`
                          : `Pregunta ${idx + 1}`
                      }
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-cyan-100 text-cyan-800 text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wide">
                    {currentQuestionData.asignatura}
                  </span>
                  {currentQuestionData.tema && (
                    <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded">
                      {currentQuestionData.tema}
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'relleno_asignatura' && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      ➕ Relleno Asignatura
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'relleno_global' && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      🔄 Relleno Adaptativo
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    {currentQuestionData.convocatoria} (Dif: {currentQuestionData.dificultad})
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-500">
                  {currentIndex + 1} / {cola.length}
                </div>
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

              {/* QUESTION CARD */}
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
                <div className={`p-5 rounded-xl border mt-6 animate-in fade-in slide-in-from-top-2 ${
                  currentAnswer.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{currentAnswer.isCorrect ? '🎉' : '❌'}</span>
                    <h4 className={`text-lg font-bold ${currentAnswer.isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                      {currentAnswer.isCorrect ? '¡Has acertado!' : 'Has fallado'}
                    </h4>
                  </div>
                  
                  {!currentAnswer.isCorrect && (
                    <div className="mb-3 space-y-1">
                      <p className="text-red-700 font-medium">
                        Marcaste la {currentAnswer.selectedLetter}, pero la correcta era la <strong className="font-black bg-white/50 px-1 rounded">{currentAnswer.correctLetter}</strong>.
                      </p>
                      {currentAnswer.discardedCorrect && (
                        <p className="text-red-900 font-bold text-sm bg-red-100 p-2 rounded-lg inline-block border border-red-200">
                          ⚠️ ¡Descartaste la respuesta correcta! Esta pregunta se ha registrado automáticamente como "Rojo" para tus futuros repasos.
                        </p>
                      )}
                    </div>
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
                    commentary={currentQuestionData.comentario}
                    onGuardarNota={guardarNota}
                    currentNota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                  />

                  {currentQuestionData.comentario && (
                    <div className="prose prose-lg max-w-none prose-slate mt-4 bg-white/60 p-4 rounded-lg">
                      <div className="font-bold uppercase tracking-wider text-[10px] text-slate-500 mb-1">Comentario Oficial CTO</div>
                      <div dangerouslySetInnerHTML={{ __html: currentQuestionData.comentario }} />
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button"
                      onClick={() => handleNext()}
                      className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                      <span>{currentIndex >= cola.length - 1 ? 'Finalizar Desglose 🎉' : 'Siguiente Pregunta →'}</span>
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
    </div>
  );
}
