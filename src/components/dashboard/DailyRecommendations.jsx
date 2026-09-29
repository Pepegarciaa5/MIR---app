import React, { useMemo, useState, useEffect } from 'react';
import { getAnalisisGlobalPorAsignatura } from '../../lib/simulacros';

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${year}-${month}-${day}`;
}

const DailyRecommendations = ({ onStartQuiz }) => {
  const [history, setHistory] = useState({});

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem('mir_tests_cooldown') || '{}'));
    } catch (e) {}
  }, []);

  const recommendations = useMemo(() => {
    // 1. Mirar si ya hay tareas de test asignadas hoy en el Inicio
    const tKey = todayKey();
    let savedTests = [];
    try {
      const savedTasks = JSON.parse(localStorage.getItem(`mir_tasks_${tKey}`) || 'null');
      if (savedTasks) {
        savedTests = savedTasks
          .filter(t => t && t.type === 'test' && !['0', '1', '2'].includes(String(t.subject)))
          .map(t => t.subject);
      }
    } catch (e) {}

    const analisis = getAnalisisGlobalPorAsignatura().filter(a => a.reciente.total > 0);
    const now = new Date();
    const todayString = now.toDateString();

    // 2. Si no hay tareas guardadas, las calculamos como en Inicio (sin penalizar hoy, ya que es el cálculo de inicio de día)
    let topSubjects = savedTests;
    if (topSubjects.length === 0) {
      const conCooldown = analisis.map(asig => {
        let penalizacion = 0;
        const testDates = history[asig.nombre] || [];
        testDates.forEach(dateStr => {
          const testDate = new Date(dateStr);
          const today = new Date();
          today.setHours(0,0,0,0);
          const tDay = new Date(testDate);
          tDay.setHours(0,0,0,0);
          
          const diffDays = Math.round((today - tDay) / (1000 * 60 * 60 * 24));
          
          if (diffDays === 1) {
            penalizacion += 9999;
          } else if (diffDays > 1 && diffDays <= 7) {
            penalizacion += 15 * (1 - (diffDays / 7));
          }
        });
        return {
          ...asig,
          adjustedScore: asig.scorePrioridad - penalizacion
        };
      });
      conCooldown.sort((a, b) => b.adjustedScore - a.adjustedScore);
      topSubjects = conCooldown.slice(0, 3).map(a => a.nombre);
    }

    // 3. Mapear a las cards, comprobando si el test ya se ha hecho hoy
    return topSubjects.map((subj, index) => {
      const asigData = analisis.find(a => a.nombre === subj) || { scorePrioridad: 0, reciente: { pctAcierto: 0 } };
      const acierto = Math.round(asigData.reciente.pctAcierto * 100);
      
      const testDates = history[subj] || [];
      const isCompletedToday = testDates.some(dateStr => new Date(dateStr).toDateString() === todayString);

      return {
        id: asigData.codigo || subj,
        type: 'Asignatura Prioritaria',
        subject: subj,
        description: `En tus 4 últimos simulacros tienes un ${acierto}% de acierto. Prioridad base: ${Math.round(asigData.scorePrioridad)} pts.`,
        priority: index === 0 ? 'high' : 'medium',
        icon: '🎯',
        distancia: Math.round(asigData.scorePrioridad),
        completed: isCompletedToday
      };
    });
  }, [history]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tu Plan para Hoy</h2>
          <p className="text-slate-500 mt-1">
            Basado en la distancia a tus objetivos por rentabilidad (90%, 75%, 60%).
          </p>
        </div>
        <div className="hidden sm:flex items-center text-sm font-medium text-cyan-600 bg-cyan-50 px-4 py-2 rounded-full">
          <span>🎯 Objetivo: 30 preguntas</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {recommendations.map((rec) => (
          <div 
            key={rec.id} 
            className="flex flex-col bg-slate-50 rounded-xl p-6 border border-slate-100 hover:border-cyan-200 hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="text-4xl">{rec.icon}</div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide
                ${rec.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}
              `}>
                {rec.type}
              </span>
            </div>
            
            <h3 className="text-lg font-bold text-slate-900 mb-2">{rec.subject}</h3>
            <p className="text-sm text-slate-600 mb-6 flex-grow">{rec.description}</p>
            
            {rec.completed ? (
              <button 
                disabled
                className="w-full bg-emerald-50 text-emerald-700 border-2 border-emerald-200 py-2.5 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <span>✅</span> Completado por hoy
              </button>
            ) : (
              <button 
                onClick={() => onStartQuiz(rec)}
                className="w-full bg-white text-slate-900 border-2 border-slate-200 py-2.5 rounded-lg font-bold group-hover:bg-cyan-500 group-hover:text-white group-hover:border-cyan-500 transition-colors"
              >
                Empezar Test (10 Preguntas)
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyRecommendations;
