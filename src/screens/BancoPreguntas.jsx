import React, { useState, useEffect, useMemo } from 'react';
import BANCO_RAW from '../data/bancoPreguntas.json';
import TEXTOS_SIMULACROS from '../data/simulacros_textos.json';
import TEXTOS_DESGLOSES from '../data/desgloses.json';
import { getPreguntas, ASIGNATURA_NOMBRE } from '../lib/simulacros';
import { desgloseAnual } from '../data/mirStats';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { generarColaPreguntas } from '../lib/recommendations';
import QuestionCard from '../components/quiz/QuestionCard';
import NotaPersonal from '../components/quiz/NotaPersonal';

const STATS_MAP = new Map(getPreguntas().map(p => [p.pregunta_id, p]));

const QUESTIONS = [
  ...BANCO_RAW,
  ...TEXTOS_SIMULACROS.map(t => {
    const stats_cto = STATS_MAP.get(t.id) || {};
    return {
      id: t.id,
      text: t.enunciado,
      options: [...(t.respuestas || [])].sort((a, b) => a.numero - b.numero).map(r => r.enunciado),
      answer: t.respuestas?.find(r => r.correcta)?.numero || 1,
      asignatura: ASIGNATURA_NOMBRE[stats_cto.asignatura] || stats_cto.asignatura || 'Simulacros',
      image: t.imagen_nombre,
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
    origen: d.convocatoria || 'Desglose MIR',
    comentario: d.comentario,
    cto_fallada: false, 
    cto_dudosa: false
  }))
];

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
    options: currentQuestionData.options.map((opt, idx) => ({
      id: numToLetter(idx + 1),
      text: opt
    })),
    correctOption: numToLetter(currentQuestionData.answer)
  } : null;

  const currentAnswer = questionForCard ? respuestasDesglose[questionForCard.id] : null;

  const handleNext = () => {
    if (currentIndex < cola.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setQuizFinished(true);
    }
  };

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(questionForCard.id, 'missing_data');
      }
      setRespuestasDesglose(prev => ({ ...prev, [questionForCard.id]: { skipped: true } }));
      handleNext();
      return;
    }

    const discardedCorrect = answerData.discardedOptions.includes(questionForCard.correctOption);
    
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption);

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

  const numToLetterIdx = (letter) => ['A', 'B', 'C', 'D', 'E'].indexOf(letter);

  const handleFinalizarSesion = () => {
    const contestadasIds = new Set(
      Object.keys(respuestasDesglose).filter(qId => respuestasDesglose[qId] && !respuestasDesglose[qId].skipped)
    );

    if (contestadasIds.size === 0) {
      if (window.confirm('No has respondido ninguna pregunta. ¿Descartar la sesión?')) {
        setCola([]);
        setRespuestasDesglose({});
        setCurrentIndex(0);
        setQuizFinished(false);
      }
      return;
    }

    const finalCola = cola.filter(q => contestadasIds.has(q.id));
    setCola(finalCola);
    setQuizFinished(true);
  };

  if (quizFinished) {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;
    const incorrectCount = contestadas.length - correctCount;

    return (
      <div className="min-h-screen bg-slate-50 py-8 px-4 flex flex-col items-center">
        <div className="max-w-3xl w-full p-8 bg-white rounded-3xl shadow-lg border border-slate-100 text-center animate-in slide-in-from-bottom-8 fade-in duration-500 mb-8">
          <div className="text-6xl mb-4">🎯</div>
          <h2 className="text-3xl font-black text-slate-900 mb-2">Sesión Finalizada</h2>
          <p className="text-slate-500 mb-6 font-medium">Resumen de las preguntas contestadas en esta sesión.</p>
          
          <div className="flex justify-center gap-4 mb-8 flex-wrap">
            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner flex-1 min-w-[140px] max-w-[200px]">
              <div className="text-5xl font-black text-emerald-500 mb-1 tracking-tighter">
                {correctCount}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Aciertos
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner flex-1 min-w-[140px] max-w-[200px]">
              <div className="text-5xl font-black text-red-500 mb-1 tracking-tighter">
                {incorrectCount}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Fallos
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 shadow-inner flex-1 min-w-[140px] max-w-[200px]">
              <div className="text-5xl font-black text-cyan-500 mb-1 tracking-tighter">
                {contestadas.length}
              </div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Contestadas
              </div>
            </div>
          </div>

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

                <div className="space-y-2 text-sm font-medium">
                  {!isCorrect && ans.selectedLetter && (
                    <div className="p-3 rounded-lg bg-red-50 text-red-700 border border-red-200">
                      <span className="font-bold">Tu respuesta:</span> {ans.selectedLetter}) {selectedOptText}
                    </div>
                  )}
                  <div className="p-3 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <span className="font-bold">Respuesta correcta:</span> {numToLetter(q.answer)}) {correctOptText}
                  </div>
                </div>

                {q.comentario && (
                  <div className="bg-slate-50 p-4 rounded-xl text-slate-700 text-sm border border-slate-200">
                    <div className="font-bold text-slate-900 mb-1">Explicación:</div>
                    <div dangerouslySetInnerHTML={{ __html: q.comentario }} />
                  </div>
                )}

                <NotaPersonal
                  preguntaId={q.id}
                  nota={getStatsPregunta(q.id)?.nota || ''}
                  onGuardar={guardarNota}
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
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-slate-900">Banco de Preguntas Global</h2>
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
                <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Progreso de la Sesión</div>
                <div className="text-sm font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-full">
                  {currentIndex + 1} / {cola.length}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {cola.map((_, idx) => {
                  const qId = cola[idx].id;
                  const ans = respuestasDesglose[qId];
                  let bgColor = 'bg-slate-100';
                  
                  if (ans) {
                    if (ans.skipped) bgColor = 'bg-slate-300';
                    else if (ans.isCorrect) bgColor = 'bg-emerald-500';
                    else bgColor = 'bg-red-500';
                  } else if (idx === currentIndex) {
                    bgColor = 'bg-cyan-500 ring-2 ring-cyan-200 ring-offset-1';
                  }

                  return (
                    <div 
                      key={idx}
                      className={`w-3 h-3 rounded-sm ${bgColor} transition-colors`}
                      title={`Pregunta ${idx + 1}`}
                    />
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

            <div className={currentAnswer ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
              <QuestionCard 
                key={currentQuestionData.id} 
                question={questionForCard} 
                onAnswer={handleAnswerSubmit} 
              />
            </div>

            {currentAnswer && !currentAnswer.skipped && (
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
                  
                  <NotaPersonal
                    preguntaId={currentQuestionData.id}
                    nota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                    onGuardar={guardarNota}
                  />

                  {currentQuestionData.comentario && (
                    <div className="prose prose-lg max-w-none prose-slate mt-4">
                      <div dangerouslySetInnerHTML={{ __html: currentQuestionData.comentario }} />
                    </div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button 
                    onClick={handleNext}
                    className="bg-slate-900 text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    {currentIndex >= cola.length - 1 ? 'Finalizar Sesión 🎉' : 'Siguiente Pregunta →'}
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
