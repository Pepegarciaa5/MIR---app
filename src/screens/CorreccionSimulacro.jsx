import React, { useState, useEffect, useMemo } from 'react';
import { getPreguntas, getAnalisisGlobalPorAsignatura, attachTextoToPregunta } from '../lib/simulacros';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { useTracker } from '../context/TrackerContext';
import { simulacrosMeta } from '../data/simulacrosMeta';
import NotaPersonal from '../components/quiz/NotaPersonal';

export default function CorreccionSimulacro() {
  const { stats, marcarCorregida, getStatsPregunta, guardarNota, archivarPregunta } = usePreguntasStats();
  const { elapsed, activeEntry } = useTracker();
  const [preguntasQueue, setPreguntasQueue] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // 1. Obtener la Matriz de Prioridades para usar como desempate
    const analysis = getAnalisisGlobalPorAsignatura();
    const scores = {};
    analysis.forEach(a => {
      scores[a.codigo] = a.scorePrioridad;
    });

    // 2. Extraer TODAS las preguntas
    const todas = getPreguntas();

    // 3. Filtrar y clasificar en grupos
    let pendientes = todas.filter(p => {
      if (p.ignorar) return false;
      const stat = getStatsPregunta(p.pregunta_id) || getStatsPregunta(`${p.simulacro}-${p.numero}`) || getStatsPregunta(p.id);
      if (stat && (stat.corregida || stat.archivada || stat.status === 'archived')) return false;

      const meta = simulacrosMeta.find(m => m.numero === p.simulacro);
      const cuenta_total = meta?.cuenta_total || 3000;
      const pctReal = (p.pct_correcta && cuenta_total) ? (p.pct_correcta / cuenta_total) : 0;
      const dif = p.dificultad || 3;

      let grupo = 99;

      if (p.fallada || p.dudas === 1) {
        if (pctReal >= 0.50) {
          grupo = 1; // Fallos tontos / imperdonables
        } else if (dif >= 1 && dif <= 4) {
          grupo = 2; // Resto de falladas dif 1 a 4
        }
      } else if (p.acertada) {
        if (dif >= 2 && dif <= 4) {
          grupo = 3; // Acertadas dif 2 a 4
        }
      }

      if (grupo === 99) return false;

      p.pctReal = pctReal;
      p.grupoCorreccion = grupo;
      return true;
    });

    // 4. Ordenar: Simulacro más reciente -> Grupo -> Número de pregunta
    pendientes.sort((a, b) => {
      if (a.simulacro !== b.simulacro) {
        return b.simulacro - a.simulacro; // DESC
      }
      if (a.grupoCorreccion !== b.grupoCorreccion) {
        return a.grupoCorreccion - b.grupoCorreccion; // ASC (1, 2, 3)
      }
      return a.numero - b.numero; // ASC
    });

    setPreguntasQueue(pendientes);
  }, []);

  const currentQ = preguntasQueue[currentIndex];
  
  // Attach text if there is a currentQ
  const fullQ = useMemo(() => {
    if (!currentQ) return null;
    return attachTextoToPregunta(currentQ);
  }, [currentQ]);

  const handleNext = () => {
    if (!fullQ) return;
    // Marcar como corregida
    marcarCorregida(`${fullQ.simulacro}-${fullQ.numero}`, true);
    if (fullQ.id) marcarCorregida(fullQ.id, true);
    if (fullQ.pregunta_id) marcarCorregida(fullQ.pregunta_id, true);
    
    setCurrentIndex(prev => prev + 1);
  };

  // Helper de tiempo format (HH:MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isTrackerRunning = activeEntry?.type === 'correccion' || activeEntry?.descripcion?.includes('Corrección');

  if (preguntasQueue.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center mt-20">
        <div className="text-5xl mb-4">🎉</div>
        <h2 className="text-2xl font-bold text-slate-800">¡Al día!</h2>
        <p className="text-slate-500 mt-2">No tienes preguntas pendientes de corregir en tus simulacros.</p>
      </div>
    );
  }

  if (currentIndex >= preguntasQueue.length) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center mt-20">
        <h2 className="text-2xl font-bold text-slate-800">¡Sesión terminada!</h2>
        <p className="text-slate-500 mt-2">Has corregido todas las preguntas en cola.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Cabecera / Tracker Info */}
      <div className="flex items-center justify-between mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <span className="text-2xl">📝</span> Corrección Inteligente
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Priorizando simulacros recientes y fallos imperdonables.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase font-bold text-slate-400 tracking-wider">Tiempo Invertido</div>
          <div className="font-mono text-xl font-black text-cyan-600">
            {isTrackerRunning ? formatTime(elapsed) : '--:--'}
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-6 flex gap-2 overflow-hidden">
        {Array.from({ length: Math.min(20, preguntasQueue.length - currentIndex) }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-cyan-400' : 'bg-slate-200'}`} />
        ))}
      </div>

      {/* Main Card */}
      {fullQ && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Metadata Bar */}
          <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap text-xs font-bold text-slate-500 uppercase tracking-wider">
            <div className="flex items-center gap-3">
              <span className="bg-white px-2 py-1 rounded shadow-sm border border-slate-200">
                Simulacro {fullQ.simulacro}
              </span>
              <span>Pregunta {fullQ.numero}</span>
              <span className="text-cyan-600">{fullQ.asignatura}</span>
            </div>

            <div className="flex items-center gap-3">
              {/* Porcentaje de acierto — siempre visible */}
              {fullQ.pctReal > 0 && (() => {
                const pct = Math.round(fullQ.pctReal * 100);
                const color = pct >= 70
                  ? 'bg-red-100 text-red-700 border-red-200'     // lo acierta mucha gente → fallo grave
                  : pct >= 40
                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'; // pregunta difícil
                const label = pct >= 70 ? '😬 Fácil para todos' : pct >= 40 ? '😐 Nivel medio' : '🧠 Pregunta difícil';
                return (
                  <span className={`px-3 py-1 rounded-full border flex items-center gap-1.5 normal-case text-[11px] font-black ${color}`}>
                    <span className="text-base">👥</span>
                    {pct}% lo acertó · {label}
                  </span>
                );
              })()}

              {fullQ.grupoCorreccion === 1 && (
                <span className="text-red-600 bg-red-50 px-2 py-1 rounded border border-red-100 flex items-center gap-1">
                  ⚠️ Fallo imperdonable
                </span>
              )}
              {fullQ.grupoCorreccion === 2 && (
                <span className="text-orange-600 bg-orange-50 px-2 py-1 rounded border border-orange-100 flex items-center gap-1">
                  ❌ Fallo a corregir
                </span>
              )}
              {fullQ.grupoCorreccion === 3 && (
                <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100 flex items-center gap-1">
                  🔄 Repaso
                </span>
              )}
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="text-lg text-slate-800 font-medium leading-relaxed mb-8">
              {fullQ.texto ? (
                <div dangerouslySetInnerHTML={{ __html: fullQ.texto.enunciado }} />
              ) : (
                <span className="italic text-slate-400">Enunciado no disponible en JSON...</span>
              )}
            </div>

            {/* Opciones renderizadas con los resultados reales del simulacro */}
            {fullQ.texto?.respuestas?.length > 0 && (
              <div className="flex flex-col gap-3 mb-8">
                {fullQ.texto.respuestas.map((resp, i) => {
                  const isCorrectOption = resp.numero == fullQ.respuesta_correcta || resp.correcta;
                  const isUserSelected = resp.numero == fullQ.respuesta_dada;

                  let styleClass = 'bg-slate-50 border-slate-200 text-slate-500 opacity-60';
                  let icon = null;

                  if (isCorrectOption) {
                    styleClass = 'bg-green-50 border-green-500 text-green-900 shadow-sm ring-1 ring-green-500 ring-opacity-50';
                    icon = <span className="text-green-600 font-bold ml-auto text-lg">✓</span>;
                  } else if (isUserSelected) {
                    styleClass = 'bg-red-50 border-red-400 text-red-900 ring-1 ring-red-400 ring-opacity-50';
                    icon = <span className="text-red-500 font-bold ml-auto text-lg">✗</span>;
                  }

                  return (
                    <div
                      key={i}
                      className={`flex items-start text-left w-full p-4 rounded-xl border font-medium leading-relaxed ${styleClass}`}
                    >
                      <span className={`font-bold mr-3 ${isCorrectOption ? 'text-green-600' : isUserSelected ? 'text-red-600' : 'text-slate-400'}`}>
                        {resp.numero}.
                      </span>
                      <div className="flex-1">
                        {resp.enunciado}
                      </div>
                      {icon}
                    </div>
                  );
                })}
              </div>
            )}

            <NotaPersonal
              preguntaId={fullQ.pregunta_id || fullQ.id || `${fullQ.simulacro}-${fullQ.numero}`}
              nota={getStatsPregunta(fullQ.pregunta_id || fullQ.id || `${fullQ.simulacro}-${fullQ.numero}`)?.nota || ''}
              onGuardar={guardarNota}
            />

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6 shadow-sm mt-4">
              <div className="flex items-start gap-4">
                <div className="text-2xl mt-1">💡</div>
                <div className="flex-1">
                  <h4 className="font-bold text-amber-900 mb-2">Comentario CTO</h4>
                  {fullQ.texto?.comentario ? (
                    <div 
                      className="text-sm text-amber-800 leading-relaxed max-h-96 overflow-y-auto custom-scrollbar pr-2"
                      dangerouslySetInnerHTML={{ __html: fullQ.texto.comentario }} 
                    />
                  ) : (
                    <p className="text-amber-700 italic">No hay comentario disponible.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleNext}
                className="flex-1 bg-green-500 text-white font-bold text-base py-4 rounded-xl hover:bg-green-600 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <span>✓</span> Lo he entendido, Marcar como Aprendida
              </button>

              <button
                onClick={() => {
                  const targetId = fullQ.pregunta_id || fullQ.id || `${fullQ.simulacro}-${fullQ.numero}`;
                  archivarPregunta(targetId, 'missing_data');
                  handleNext();
                }}
                className="px-4 py-4 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 font-bold text-sm rounded-xl transition-colors flex items-center justify-center gap-2"
                title="Archivar para siempre (no volverá a salir)"
              >
                <span>📦</span> Faltan datos / imagen (Archivar)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
