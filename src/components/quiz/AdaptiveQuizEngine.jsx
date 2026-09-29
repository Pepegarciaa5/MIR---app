import React, { useState, useEffect } from 'react';
import QuestionCard from './QuestionCard';
import { generarColaPreguntas } from '../../lib/recommendations';
import bancoPreguntas from '../../data/bancoPreguntas.json';
import desglosesData from '../../data/desgloses_filtrables.json';
import { usePreguntasStats } from '../../hooks/usePreguntasStats';
import { useTracker } from '../../context/TrackerContext';
import NotaPersonal from './NotaPersonal';
import { getOrCreateAnonUserId, createQuizResult } from '../../utils/quizSync';

const AdaptiveQuizEngine = ({ subject = 'Oftalmología', modoExamen = false, setTab, questionCount = null }) => {
  const [preguntasCola, setPreguntasCola] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [quizFinished, setQuizFinished] = useState(false);
  const [currentFeedback, setCurrentFeedback] = useState(null);

  const { registrarRespuesta, stats, getStatsPregunta, guardarNota } = usePreguntasStats();

  // Al montar, generamos la cola
  useEffect(() => {
    const bancoSimulacros = bancoPreguntas.filter(q =>
      q.origen?.startsWith('Simulacro') && !q.image && !q.imagen && !q.imagen_nombre
    );
    const bancoDesgloses = desglosesData
      .filter(q => !q.imagen_nombre)
      .map(d => ({
        id: d.id,
        origen: `Desgloses ${d.anualidad}`,
        asignatura: d.asignatura,
        tema: d.tema,
        dificultad: d.dificultad,
        text: d.enunciado,
        options: d.respuestas?.map(r => r.enunciado) || [],
        answer: d.respuestas?.find(r => r.correcta)?.numero,
        comentario: d.comentario
      }));

    const bancoFiltrado = [...bancoSimulacros, ...bancoDesgloses];
    const repasosPendientes = Object.entries(stats || {})
      .filter(([id, data]) => data.fallos > 0 && !data.dominada)
      .map(([id]) => id);

    let finalCola = [];
    if (modoExamen && Array.isArray(subject)) {
      let colaTotal = [];
      subject.forEach(sub => {
        const cola = generarColaPreguntas(bancoFiltrado, repasosPendientes, sub);
        colaTotal = [...colaTotal, ...cola];
      });
      // Fisher-Yates shuffle - aleatorización verdadera
      for (let i = colaTotal.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colaTotal[i], colaTotal[j]] = [colaTotal[j], colaTotal[i]];
      }
      finalCola = colaTotal;
    } else {
      const subjectStr = Array.isArray(subject) ? subject[0] : subject;
      finalCola = generarColaPreguntas(bancoFiltrado, repasosPendientes, subjectStr);
    }

    if (questionCount && questionCount > 0) {
      finalCola = finalCola.slice(0, questionCount);
    }
    setPreguntasCola(finalCola);
  }, [subject, modoExamen, questionCount]);

  const currentQuestion = preguntasCola[currentIndex];
  const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || num;

  const questionForCard = currentQuestion ? {
    id: currentQuestion.id,
    text: currentQuestion.text,
    options: (currentQuestion.options || []).map((optText, idx) => ({
      id: numToLetter(idx + 1),
      text: optText
    })),
    correctOption: numToLetter(currentQuestion.answer)
  } : null;

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      handleNextQuestion();
      return;
    }

    // Verificar si descartó la correcta
    const discardedCorrect = answerData.discardedOptions?.includes(questionForCard.correctOption);
    const finalConfidence = discardedCorrect ? 'red' : answerData.confidence;

    // Registrar en estadísticas reales (LocalStorage / backend)
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption, {
      confidence: finalConfidence,
      subject: currentQuestion?.asignatura || (Array.isArray(subject) ? subject[0] : subject)
    });

    const processedAnswerData = {
      ...answerData,
      confidence: finalConfidence,
      discardedCorrect: discardedCorrect
    };

    setAnswers(prev => [...prev, processedAnswerData]);

    // Mostrar feedback Inmediato (Modo Tutor)
    setCurrentFeedback({
      ...processedAnswerData,
      explanation: currentQuestion.comentario, // Enlazado al comentario CTO real
      keyPoint: ''
    });
  };

  const handleNextQuestion = () => {
    setCurrentFeedback(null);
    if (currentIndex < preguntasCola.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Registrar cooldown
      try {
        const history = JSON.parse(localStorage.getItem('mir_tests_cooldown') || '{}');
        const subjects = modoExamen && Array.isArray(subject) ? subject : [Array.isArray(subject) ? subject[0] : subject];
        subjects.forEach(sub => {
          if (!history[sub]) history[sub] = [];
          history[sub].push(new Date().toISOString());
        });
        localStorage.setItem('mir_tests_cooldown', JSON.stringify(history));
      } catch (e) {
        console.error('Error guardando historial de tests', e);
      }

      // Sync test completion to Supabase
      const userId = getOrCreateAnonUserId();
      const correctCount = answers.filter(a => a.isCorrect).length;
      createQuizResult(userId, {
        subject: Array.isArray(subject) ? subject.join(', ') : subject,
        question_count: preguntasCola.length,
        answers: answers.map((a, i) => ({
          question_id: preguntasCola[i]?.id,
          selected: a.selectedOption,
          is_correct: a.isCorrect,
          confidence: a.confidence
        })),
        total_score: correctCount,
        duration_seconds: 0
      });

      setQuizFinished(true);
    }
  };


  if (quizFinished) {
    const correctCount = answers.filter(a => a.isCorrect).length;

    // Desglose por asignatura (solo en modo examen)
    const desglosePorAsig = modoExamen && Array.isArray(subject) ? subject.map(sub => {
      const pregsSub = preguntasCola.filter(q => q.asignatura === sub);
      const answersMap = {};
      answers.forEach((a, i) => { answersMap[preguntasCola[i]?.id] = a; });
      const aciertos = pregsSub.filter(q => answersMap[q.id]?.isCorrect).length;
      return { sub, total: pregsSub.length, aciertos };
    }) : null;

    return (
      <div className="max-w-2xl mx-auto p-8 bg-white rounded-2xl shadow-sm text-center">
        <div className="text-4xl mb-3">{modoExamen ? '🧠' : '🎉'}</div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          {modoExamen ? 'Simulacro Finalizado' : 'Cuestionario Finalizado'}
        </h2>
        <div className="text-6xl font-black text-cyan-500 mb-2">{correctCount} / {preguntasCola.length}</div>
        <p className="text-slate-500 text-sm mb-6">{Math.round(correctCount / preguntasCola.length * 100)}% de acierto</p>

        {desglosePorAsig && (
          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-3">Desglose por asignatura</p>
            {desglosePorAsig.map(({ sub, total, aciertos }) => (
              <div key={sub} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{sub}</span>
                <span className={`text-sm font-bold ${
                  total === 0 ? 'text-slate-400' :
                  aciertos / total >= 0.7 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {aciertos}/{total}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="text-slate-600 mb-8">El algoritmo ha guardado tu progreso y reprogramará tus repasos.</p>
        <button
          onClick={() => { stopTracking(); setTab('inicio'); }}
          className="bg-slate-900 text-white px-6 py-3 rounded-lg font-medium hover:bg-slate-800 transition-colors"
        >
          Volver al Inicio
        </button>
      </div>
    );
  }

  if (preguntasCola.length === 0) {
    return <div className="p-12 text-center text-slate-500">Cargando preguntas de {subject}...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header / Progreso */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {modoExamen ? '🧠 Modo Examen' : `Repaso Adaptativo: ${Array.isArray(subject) ? subject[0] : subject}`}
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              {modoExamen
                ? `Pregunta ${currentIndex + 1} / ${preguntasCola.length} · Asignatura oculta`
                : `Pregunta ${currentIndex + 1} de ${preguntasCola.length}`
              }
            </p>
          </div>
          <div className="flex gap-1">
            {preguntasCola.map((_, i) => (
              <div 
                key={i} 
                className={`w-8 h-2 rounded-full ${
                  i < currentIndex ? 'bg-cyan-500' : 
                  i === currentIndex ? 'bg-cyan-300 animate-pulse' : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Zona de Pregunta y Feedback */}
        <div className="space-y-6">
          <div className={currentFeedback ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
            <QuestionCard 
              key={currentQuestion.id} 
              question={questionForCard} 
              onAnswer={handleAnswerSubmit} 
            />
          </div>

          {currentFeedback && (
            <div className="bg-white rounded-xl shadow-sm border-2 border-cyan-500 p-8 max-w-3xl mx-auto animate-in slide-in-from-bottom-4 fade-in">
              <div className="flex items-center gap-3 mb-4">
                {currentFeedback.isCorrect ? (
                  <span className="text-2xl">✅</span>
                ) : (
                  <span className="text-2xl">❌</span>
                )}
                <h3 className="font-bold text-lg text-slate-900">
                  {currentFeedback.isCorrect ? '¡Correcto!' : 'Incorrecto'}
                </h3>
              </div>
              
              <div className="space-y-4 text-slate-700">
                <p className="bg-cyan-50 p-4 rounded-lg">
                  <span className="font-bold text-cyan-800 block mb-1">Respuesta correcta: {questionForCard.correctOption}</span>
                  {currentQuestion.options[currentQuestion.answer - 1]}
                </p>

                {/* En modo examen, revelar asignatura después de responder */}
                {modoExamen && currentQuestion.asignatura && (
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    📚 Asignatura: {currentQuestion.asignatura}
                    {currentQuestion.tema ? ` · ${currentQuestion.tema}` : ''}
                  </p>
                )}
                
                {currentFeedback.discardedCorrect && (
                  <p className="text-red-900 font-bold text-xs bg-red-100 p-3 rounded-lg border border-red-200">
                    ⚠️ Descartaste la respuesta correcta.
                  </p>
                )}

                <NotaPersonal
                  preguntaId={currentQuestion.id}
                  nota={getStatsPregunta(currentQuestion.id)?.nota || ''}
                  onGuardar={guardarNota}
                />

                {currentFeedback.explanation && (
                  <div className="prose prose-lg max-w-none prose-slate mt-4">
                    <div className="font-bold uppercase tracking-wider text-[11px] text-slate-500 mb-2 flex items-center gap-2">
                      <span>💡</span> Comentario Oficial CTO
                    </div>
                    <div dangerouslySetInnerHTML={{ __html: currentFeedback.explanation }} />
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={handleNextQuestion}
                  className="bg-slate-900 text-white py-3 px-8 rounded-xl font-bold text-lg hover:bg-slate-800 transition-colors shadow-sm"
                >
                  Siguiente Pregunta →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdaptiveQuizEngine;
