import React, { useState, useMemo } from 'react';
import DailyRecommendations from '../components/dashboard/DailyRecommendations';
import AdaptiveQuizEngine from '../components/quiz/AdaptiveQuizEngine';

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function EstudioAdaptativo({ setTab }) {
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [modoExamen, setModoExamen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('mir_modo_examen') || 'false'); } catch { return false; }
  });

  // Leer las 3 asignaturas del día del plan de Inicio
  const asignaturasDia = useMemo(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`mir_tasks_${todayKey()}`) || 'null');
      if (saved) {
        return saved
          .filter(t => t && t.type === 'test' && !['0','1','2','undefined'].includes(String(t.subject)))
          .map(t => t.subject);
      }
    } catch {}
    return [];
  }, []);

  const handleStartModoExamen = () => {
    if (asignaturasDia.length === 0) return;
    setActiveQuiz({ subjects: asignaturasDia, modoExamen: true });
  };

  if (activeQuiz) {
    return (
      <div className="p-4">
        <button
          onClick={() => setActiveQuiz(null)}
          className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-900 flex items-center gap-2"
        >
          <span>&larr;</span> Volver a recomendaciones
        </button>
        <AdaptiveQuizEngine
          subject={activeQuiz.subjects || activeQuiz.subject}
          modoExamen={activeQuiz.modoExamen || false}
          setTab={setTab}
        />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      {/* Header con toggle */}
      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Estudio Adaptativo</h1>
          <p className="text-slate-600">
            Mejora tu retención a largo plazo con nuestro algoritmo de repaso espaciado.
          </p>
        </div>

        {/* Toggle Modo Examen */}
        <div className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm flex flex-col items-center gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Modo Examen</span>
          <button
            onClick={() => {
              const next = !modoExamen;
              setModoExamen(next);
              localStorage.setItem('mir_modo_examen', JSON.stringify(next));
            }}
            className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none ${
              modoExamen ? 'bg-orange-500' : 'bg-slate-200'
            }`}
          >
            <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-300 ${
              modoExamen ? 'translate-x-7' : 'translate-x-0'
            }`} />
          </button>
          <span className={`text-xs font-bold transition-colors ${
            modoExamen ? 'text-orange-600' : 'text-slate-400'
          }`}>
            {modoExamen ? '🧠 Activado' : 'Desactivado'}
          </span>
        </div>
      </div>

      {/* Banner + botón Modo Examen */}
      {modoExamen ? (
        <div className="mb-8 bg-orange-50 border-2 border-orange-300 rounded-2xl p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="text-5xl">🧠</div>
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-xl font-black text-orange-900 mb-1">Modo Examen Activado</h2>
            <p className="text-sm text-orange-800 mb-1">
              Los 3 tests del día se fusionan en un único simulacro con preguntas <strong>completamente desordenadas</strong>.
            </p>
            <p className="text-xs text-orange-700">
              No verás la asignatura de cada pregunta. Exactamente como en el MIR real.
            </p>

          </div>
          <button
            onClick={handleStartModoExamen}
            disabled={asignaturasDia.length === 0}
            className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-black py-4 px-8 rounded-xl transition-colors shadow-lg shadow-orange-200 text-lg"
          >
            Empezar Simulacro →
          </button>
        </div>
      ) : (
        <DailyRecommendations onStartQuiz={(rec) => setActiveQuiz({ subject: rec.subject, modoExamen: false })} />
      )}

      {/* Si modo examen OFF, mostrar también las tarjetas normales debajo */}
      {!modoExamen && (
        <p className="text-xs text-slate-400 mt-6 text-center">
          Activa el <strong>Modo Examen</strong> para entrenar sin ver la asignatura, igual que en el MIR real.
        </p>
      )}
    </div>
  );
}
