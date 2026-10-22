import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { getOrCreateAnonUserId, createQuizResult, enqueueQuestionStat, flushOfflineSyncQueue } from '../utils/quizSync';
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
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const { stats, isSyncing, registrarRespuesta, getStatsPregunta, guardarNota, archivarPregunta, isArchivada } = usePreguntasStats();

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
    const defaultFiltros = { asignatura: '', temas: [], dificultad: [], minYear: 2010, soloNoHechas: false, soloFalladas: false };
    const saved = getSessionData('filtros', defaultFiltros);
    if (saved.tema !== undefined) {
      delete saved.tema;
      saved.temas = [];
    }
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
  const [currentIndex, setCurrentIndex] = useState(() => getSessionData('currentIndex', 0));
  
  // Feedback State map: { questionId: { isCorrect, selectedLetter, correctLetter, discardedCorrect, skipped } }
  const [respuestasDesglose, setRespuestasDesglose] = useState(() => getSessionData('respuestas', {}));

  // Sync to sessionStorage on change
  useEffect(() => { sessionStorage.setItem('mir_desgloses_filtros', JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_cola', JSON.stringify(cola)); }, [cola]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_currentIndex', JSON.stringify(currentIndex)); }, [currentIndex]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_respuestas', JSON.stringify(respuestasDesglose)); }, [respuestasDesglose]);

  const currentQuestionData = cola[currentIndex];
  // Determine if current question was already answered in this session
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

  const aplicarFiltrosCon = useCallback((filtrosActuales) => {
    let filtradas = desglosesData;
    
    // Excluir preguntas archivadas
    filtradas = filtradas.filter(q => !isArchivada(q.id));
    
    if (filtrosActuales.asignatura) {
      filtradas = filtradas.filter(q => q.asignatura === filtrosActuales.asignatura);
    }
    if (filtrosActuales.temas && filtrosActuales.temas.length > 0) {
      filtradas = filtradas.filter(q => filtrosActuales.temas.includes(q.tema));
    }
    if (filtrosActuales.dificultad.length > 0) {
      filtradas = filtradas.filter(q => filtrosActuales.dificultad.includes(q.dificultad));
    }
    if (filtrosActuales.minYear) {
      filtradas = filtradas.filter(q => q.anualidad >= filtrosActuales.minYear);
    }
    if (filtrosActuales.soloNoHechas) {
      filtradas = filtradas.filter(q => !isPreguntaHecha(q.id));
    }
    if (filtrosActuales.soloFalladas) {
      filtradas = filtradas.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return pStats.fallos > 0;
      });
    }

    setCola(filtradas);
    setCurrentIndex(0);
    setRespuestasDesglose({});
  }, [isArchivada, isPreguntaHecha, getStatsPregunta]);

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

  const handleNext = () => {
    if (currentIndex < cola.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const terminarDesglose = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    
    if (contestadas.length === 0) {
      if (window.confirm("¿Seguro que quieres cerrar este desglose?")) {
        setCola([]);
        setCurrentIndex(0);
        setRespuestasDesglose({});
        sessionStorage.removeItem('mir_desgloses_cola');
        sessionStorage.removeItem('mir_desgloses_respuestas');
        sessionStorage.removeItem('mir_desgloses_currentIndex');
      }
      return;
    }

    // Blindar que todas las preguntas contestadas en esta sesión queden en la cola offline
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

    // Subir inmediatamente a Supabase si hay conexión
    await flushOfflineSyncQueue().catch(err => console.warn('Flush error en terminarDesglose:', err));

    const isOnlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;
    const msg = `Has contestado ${contestadas.length} preguntas (${isOnlineNow ? 'sincronizadas en la nube' : 'guardadas localmente en tu dispositivo offline'}).\n\n¿Quieres ver el resumen de tu sesión? Pulsa Aceptar para ver tus resultados o Cancelar para salir directamente.`;

    if (window.confirm(msg)) {
      setCola(contestadas);
      setQuizFinished(true);
    } else {
      setCola([]);
      setCurrentIndex(0);
      setRespuestasDesglose({});
      sessionStorage.removeItem('mir_desgloses_cola');
      sessionStorage.removeItem('mir_desgloses_respuestas');
      sessionStorage.removeItem('mir_desgloses_currentIndex');
    }
  };

  const handleFinalizarSesion = () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length === 0) {
      terminarDesglose();
      return;
    }
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

  // Transform data format for QuestionCard
  const questionForCard = currentQuestionData ? {
    id: currentQuestionData.id,
    text: currentQuestionData.enunciado,
    options: currentQuestionData.respuestas.map(r => ({
      id: r.numero.toString(), 
      text: r.enunciado
    })),
    correctOption: currentQuestionData.respuestas.find(r => r.correcta)?.numero.toString()
  } : null;

  const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || num;

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(currentQuestionData.id, 'missing_data');
      }
      setRespuestasDesglose(prev => ({
        ...prev,
        [questionForCard.id]: { skipped: true }
      }));
      handleNext();
      return;
    }

    const discardedCorrect = answerData.discardedOptions.includes(questionForCard.correctOption);
    
    // Registrar en estadísticas reales con nivel de confianza y asignatura
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption, {
      confidence: answerData.confidence,
      subject: currentQuestionData.asignatura
    });

    setRespuestasDesglose(prev => ({
      ...prev,
      [questionForCard.id]: {
        isCorrect: answerData.isCorrect,
        selectedLetter: answerData.selectedOption,
        correctLetter: questionForCard.correctOption,
        discardedCorrect: discardedCorrect
      }
    }));
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
  }, [cola, respuestasDesglose, filtros.asignatura, getStatsPregunta]);

  useEffect(() => {
    if (!quizFinished) return;
    runSync();
    const handleOnline = () => runSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [quizFinished, runSync]);

  // Si las estadísticas de la nube terminan de cargar y tenemos cola con 'soloNoHechas' pero aún no se ha respondido nada, re-filtrar
  useEffect(() => {
    if (!isSyncing && cola.length > 0 && Object.keys(respuestasDesglose).length === 0 && filtros.soloNoHechas) {
      aplicarFiltrosCon(filtros);
    }
  }, [isSyncing, stats, filtros, cola.length, respuestasDesglose, aplicarFiltrosCon]);

  if (questionForCard) {
    questionForCard.options = currentQuestionData.respuestas.map((r, idx) => ({
      id: numToLetter(r.numero),
      text: r.enunciado
    }));
    const correctRes = currentQuestionData.respuestas.find(r => r.correcta);
    questionForCard.correctOption = correctRes ? numToLetter(correctRes.numero) : null;
  }

  if (quizFinished) {
    const correctCount = Object.values(respuestasDesglose).filter(a => a.isCorrect).length;
    const falladasSesion = cola.filter(q => {
      const ans = respuestasDesglose[q.id];
      return ans && !ans.isCorrect && !ans.skipped;
    });

    const handleRepasarErrores = () => {
      // Relanzar sesión solo con las preguntas falladas en esta sesión
      setCola(falladasSesion);
      setCurrentIndex(0);
      setRespuestasDesglose({});
      setQuizFinished(false);
      setSyncState(null);
    };

    return (
      <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
        <div className="max-w-2xl w-full p-10 bg-white rounded-3xl shadow-lg border border-slate-100 text-center animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="text-6xl mb-6">🎯</div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Desgloses Finalizados</h2>
          <p className="text-slate-500 mb-6 font-medium">¡Buen trabajo! Este ha sido tu rendimiento en la sesión.</p>
          
          {/* BANNER DE SINCRONIZACIÓN CON SUPABASE / OFFLINE */}
          <SyncStatusBanner syncState={syncState} onRetry={runSync} className="mb-8" />

          <div className="bg-slate-50 rounded-2xl p-8 inline-block mb-10 border border-slate-100 shadow-inner">
            <div className="text-7xl font-black text-cyan-500 mb-2 tracking-tighter">
              {correctCount} <span className="text-4xl text-slate-300 font-bold mx-1">/</span> {cola.length}
            </div>
            <div className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Aciertos Totales
            </div>
          </div>

          {/* Desglose rápido */}
          <div className="flex justify-center gap-6 mb-8 text-sm">
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-green-600">{correctCount}</span>
              <span className="text-slate-400 font-medium">Correctas</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-red-500">{falladasSesion.length}</span>
              <span className="text-slate-400 font-medium">Falladas</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-black text-slate-400">{Object.values(respuestasDesglose).filter(a => a.skipped).length}</span>
              <span className="text-slate-400 font-medium">Saltadas</span>
            </div>
          </div>
          
          <p className="text-slate-600 mb-8">
            Tus respuestas individuales se han guardado en segundo plano en tu historial global para que el algoritmo optimice tus repasos futuros.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {falladasSesion.length > 0 && (
              <button
                onClick={handleRepasarErrores}
                className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 hover:shadow-lg active:scale-95 shadow-red-200 shadow-sm"
              >
                ❌ Repasar {falladasSesion.length} errores
              </button>
            )}
            <button 
              onClick={() => {
                setQuizFinished(false);
                setCola([]);
                setCurrentIndex(0);
                setRespuestasDesglose({});
                setSyncState(null);
                sessionStorage.removeItem('mir_desgloses_cola');
                sessionStorage.removeItem('mir_desgloses_respuestas');
                sessionStorage.removeItem('mir_desgloses_currentIndex');
              }}
              className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition-all hover:scale-105 hover:shadow-lg active:scale-95"
            >
              Nuevos Desgloses
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
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Desgloses Oficiales MIR</h2>
              {isSyncing ? (
                <span className="text-xs bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full border border-cyan-200 flex items-center gap-1.5 animate-pulse font-medium">
                  <span className="inline-block animate-spin">🔄</span> Sincronizando con la nube...
                </span>
              ) : isOffline ? (
                <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5 font-medium">
                  <span>📡</span> Modo offline (guardado local)
                </span>
              ) : null}
            </div>
            {cola.length > 0 && (
              <div className="flex items-center gap-2">
                {contestadasCount > 0 && (
                  <button 
                    onClick={handleFinalizarSesion}
                    className="text-xs sm:text-sm bg-slate-900 hover:bg-slate-800 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    Finalizar sesión ({contestadasCount})
                  </button>
                )}
                <button 
                  onClick={terminarDesglose}
                  className="text-sm text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                >
                  Cerrar Desglose ✕
                </button>
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            
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
              Aplicar Filtros
            </button>
          </div>

          {/* Selector de Temas Múltiples (Solo visible si hay asignatura elegida) */}
          {filtros.asignatura && temasDisponibles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase mb-3 block">Filtrar por Temas (Opcional)</span>
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
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-4">
              <span className="text-xs font-bold text-slate-500 uppercase">Dificultad:</span>
              {[1, 2, 3, 4, 5].map(d => (
                <label key={d} className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={filtros.dificultad.includes(d)}
                    onChange={() => toggleDificultad(d)}
                    className="rounded text-cyan-500 focus:ring-cyan-500"
                  /> 
                  Nivel {d}
                </label>
              ))}
            </div>
            
            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>
            
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filtros.soloNoHechas}
                onChange={e => handleToggleSoloNoHechas(e.target.checked)}
                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              Ocultar ya hechas
            </label>

            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

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

        {/* ZONA CENTRAL - COLA LARGA */}
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200">
          
          {cola.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-slate-900">Configura tus filtros</h3>
              <p className="text-slate-500">Selecciona arriba qué desgloses quieres hacer y pulsa Aplicar.</p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* NAVEGADOR DE PREGUNTAS (REJILLA) */}
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                {cola.map((q, idx) => {
                  const estado = respuestasDesglose[q.id];
                  let bgColor = "bg-white text-slate-500 border-slate-200 hover:border-cyan-400";
                  
                  if (estado) {
                    if (estado.skipped) bgColor = "bg-slate-200 text-slate-500 border-slate-300";
                    else if (estado.isCorrect) bgColor = "bg-emerald-100 text-emerald-700 border-emerald-200 font-bold shadow-sm";
                    else bgColor = "bg-red-100 text-red-700 border-red-200 font-bold shadow-sm";
                  }
                  
                  if (idx === currentIndex) {
                    bgColor += " ring-2 ring-cyan-500 ring-offset-2 scale-110 shadow-md";
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-9 h-9 rounded-full border text-xs flex items-center justify-center transition-all ${bgColor}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                <div>
                  <span className="bg-cyan-100 text-cyan-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                    {currentQuestionData.asignatura}
                  </span>
                  <span className="text-sm text-slate-500 font-medium ml-3">
                    Convocatoria: {currentQuestionData.convocatoria} (Dif: {currentQuestionData.dificultad})
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-500">
                  {currentIndex + 1} / {cola.length}
                </div>
              </div>

              {/* QUESTION CARD */}
              <div className={currentAnswer ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
                <QuestionCard 
                  key={currentQuestionData.id} 
                  question={questionForCard} 
                  onAnswer={handleAnswerSubmit} 
                />
              </div>

              {/* MODO TUTOR INMEDIATO */}
              {currentAnswer && !currentAnswer.skipped && (
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
                      onClick={handleNext}
                      className="bg-slate-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      {currentIndex >= cola.length - 1 ? 'Finalizar Desglose 🎉' : 'Siguiente Pregunta →'}
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
