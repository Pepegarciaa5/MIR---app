import React, { useState, useEffect } from 'react';
import { getAnalisisGlobalPorAsignatura } from '../lib/simulacros';
import { useTracker } from '../context/TrackerContext';

// Helper: Generar key de fecha
function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Inicio({ setTab }) {
  const [tasks, setTasks] = useState(Array(16).fill(null));
  const [editingIndex, setEditingIndex] = useState(null);
  const [editValue, setEditValue] = useState('');
  const { startTracking, stopTracking, activeEntry, elapsed, entries } = useTracker();

  // Cargar tareas al montar
  useEffect(() => {
    const initDailyTasks = () => {
      const tKey = todayKey();
      let savedTasks = JSON.parse(localStorage.getItem(`mir_tasks_${tKey}`) || 'null');

      // Si no hay tareas para HOY o están corruptas (subject "0", "1", "undefined" etc.), generar las iniciales
      const isCorrupt = savedTasks && savedTasks.some(t => t && t.type === 'test' && ['0', '1', '2', 'undefined'].includes(String(t.subject)));
      if (!savedTasks || isCorrupt) {
        // --- 1. Generar Tests Automáticos ---
        const analysis = getAnalisisGlobalPorAsignatura();
        const statsArray = analysis.map(stats => ({
          asignatura: stats.nombre,
          score: stats.scorePrioridad
        }));

        // Aplicar penalización de enfriamiento a los simulacros recientes
        let cooldownHistory = {};
        try {
          cooldownHistory = JSON.parse(localStorage.getItem('mir_tests_cooldown') || '{}');
        } catch (e) {}

        const now = new Date();
        const withCooldown = statsArray.map(stat => {
          let penalty = 0;
          const history = cooldownHistory[stat.asignatura] || [];
          history.forEach(isoDate => {
            const date = new Date(isoDate);
            const today = new Date();
            today.setHours(0,0,0,0);
            const testDay = new Date(date);
            testDay.setHours(0,0,0,0);
            
            const diffDays = Math.round((today - testDay) / (1000 * 60 * 60 * 24));
            
            if (diffDays === 1) {
              penalty += 9999; // Bloqueo absoluto al día siguiente
            } else if (diffDays > 1 && diffDays <= 7) {
              penalty += 15 * (1 - (diffDays / 7));
            }
          });
          return {
            ...stat,
            scoreOriginal: stat.score,
            penalizacion: penalty,
            scoreFinal: stat.score - penalty
          };
        });

        // Ordenar por scoreFinal descendente
        withCooldown.sort((a, b) => b.scoreFinal - a.scoreFinal);

        // --- 2. Crear las Tareas Base ---
        const newTasks = Array(16).fill(null);
        
        // Slot 0: Corrección de Simulacros
        newTasks[0] = {
          id: 'auto_correccion',
          type: 'correccion',
          title: 'Corrección de Simulacro',
          targetTime: 30 * 60,
          completed: false
        };

        // Slots 1, 2, 3: Tests Adaptativos
        for (let i = 0; i < 3; i++) {
          if (withCooldown[i]) {
            newTasks[i + 1] = {
              id: `auto_test_${i}`,
              type: 'test',
              title: `Test Adaptativo: ${withCooldown[i].asignatura}`,
              subject: withCooldown[i].asignatura,
              targetTime: 15 * 60,
              completed: false
            };
          }
        }

        // --- 3. Buscar tareas del DÍA ANTERIOR para arrastrar ---
        const allKeys = Object.keys(localStorage);
        const taskKeys = allKeys.filter(k => k.startsWith('mir_tasks_')).sort();
        const lastDayKey = taskKeys.find(k => k !== `mir_tasks_${tKey}`);
        
        if (lastDayKey) {
          const lastDayTasks = JSON.parse(localStorage.getItem(lastDayKey) || '[]');
          const unfinishedManuals = lastDayTasks.filter(t => t && t.type === 'manual' && !t.completed);
          
          if (unfinishedManuals.length > 0) {
            const wantsCarryOver = window.confirm(`Tienes ${unfinishedManuals.length} tareas manuales sin terminar del día anterior. ¿Quieres traerlas al plan de hoy?`);
            if (wantsCarryOver) {
              let nextEmptyIndex = 4;
              unfinishedManuals.forEach(ut => {
                while (nextEmptyIndex < 16 && newTasks[nextEmptyIndex] !== null) {
                  nextEmptyIndex++;
                }
                if (nextEmptyIndex < 16) {
                  newTasks[nextEmptyIndex] = { ...ut, completed: false };
                }
              });
            }
          }
          // Limpiar key anterior para no volver a preguntar mañana
          localStorage.removeItem(lastDayKey);
        }

        setTasks(newTasks);
        localStorage.setItem(`mir_tasks_${tKey}`, JSON.stringify(newTasks));
      } else {
        setTasks(savedTasks);
      }
    };

    initDailyTasks();
  }, []);

  // Guardar tareas al cambiar
  const saveTasks = (newTasks) => {
    setTasks(newTasks);
    localStorage.setItem(`mir_tasks_${todayKey()}`, JSON.stringify(newTasks));
  };

  const handleStartTask = (index, task) => {
    if (activeEntry) stopTracking();

    if (task.type === 'test') {
      localStorage.setItem('mir_active_test_subject', task.subject);
      setTab('adaptativo');
    } else if (task.type === 'correccion') {
      setTab('correccion');
    }

    startTracking({
      descripcion: task.title,
      bloqueId: `block_${index}`,
      targetTimeSeconds: task.targetTime
    });
  };

  const handleStopTask = (index) => {
    stopTracking();
    const newTasks = [...tasks];
    // Al parar manualmente consideramos que si pasaron de X tiempo o simplemente deciden pararlo, pueden marcarlo como completado
    // Por ahora lo dejamos tal cual, el usuario puede marcarlo como completado explicitamente
    saveTasks(newTasks);
  };

  const toggleCompleted = (index) => {
    const newTasks = [...tasks];
    if (newTasks[index]) {
      newTasks[index] = { ...newTasks[index], completed: !newTasks[index].completed };
      saveTasks(newTasks);
    }
  };

  const saveManualTask = (index) => {
    if (editValue.trim() === '') {
      // Eliminar tarea
      const newTasks = [...tasks];
      newTasks[index] = null;
      saveTasks(newTasks);
    } else {
      const newTasks = [...tasks];
      newTasks[index] = {
        id: `manual_${Date.now()}`,
        type: 'manual',
        title: editValue,
        targetTime: 30 * 60,
        completed: false
      };
      saveTasks(newTasks);
    }
    setEditingIndex(null);
    setEditValue('');
  };

  // Helper de tiempo format (HH:MM:SS)
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getTaskSeconds = (index) => {
    const bloqueId = `block_${index}`;
    const fromHistory = entries.filter(e => e.bloqueId === bloqueId).reduce((s, e) => s + e.duracionSegundos, 0);
    const fromActive = activeEntry?.bloqueId === bloqueId ? elapsed : 0;
    return fromHistory + fromActive;
  };

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">Tu Plan de Acción</h1>
        <p className="text-slate-500 mt-2">16 bloques. Enfoque total. Dale al play para empezar a trackear el tiempo.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {tasks.map((task, index) => {
          const isActive = activeEntry?.bloqueId === `block_${index}`;
          const currentSeconds = getTaskSeconds(index);
          const isOvertime = task && currentSeconds >= task.targetTime;

          if (!task) {
            return (
              <div 
                key={index}
                className="bg-slate-50/50 border border-dashed border-slate-300 rounded-xl p-4 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => {
                  setEditingIndex(index);
                  setEditValue('');
                }}
              >
                {editingIndex === index ? (
                  <input
                    autoFocus
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => saveManualTask(index)}
                    onKeyDown={(e) => e.key === 'Enter' && saveManualTask(index)}
                    className="w-full bg-white border border-cyan-500 rounded px-3 py-2 text-sm outline-none shadow-sm"
                    placeholder="Escribe tu tarea (30m)..."
                  />
                ) : (
                  <span className="text-slate-400 font-medium text-sm">+ Añadir tarea</span>
                )}
              </div>
            );
          }

          const isCorreccion = task.type === 'correccion';
          const isTest = task.type === 'test';
          
          return (
            <div 
              key={index}
              className={`relative rounded-xl p-5 border transition-all duration-300 ${
                task.completed ? 'bg-slate-100 border-slate-200 opacity-60' :
                isActive ? 'bg-white border-cyan-500 shadow-lg shadow-cyan-500/20 scale-[1.02]' :
                'bg-white border-slate-200 shadow-sm hover:shadow-md'
              }`}
            >
              {/* Type Badge */}
              <div className="absolute -top-3 -right-2 flex gap-1">
                {isCorreccion && <span className="bg-purple-100 text-purple-700 text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-sm border border-purple-200">Obligatorio</span>}
                {isTest && <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-1 rounded-md shadow-sm border border-orange-200">Adaptativo</span>}
              </div>

              <div className="flex items-start gap-3">
                <button 
                  onClick={() => toggleCompleted(index)}
                  className={`w-6 h-6 shrink-0 rounded flex items-center justify-center border mt-0.5 ${
                    task.completed ? 'bg-green-500 border-green-600 text-white' : 'bg-slate-50 border-slate-300 hover:border-cyan-500'
                  }`}
                >
                  {task.completed && '✓'}
                </button>
                
                <div className="flex-1 min-w-0">
                  {editingIndex === index && task.type === 'manual' ? (
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveManualTask(index)}
                      onKeyDown={(e) => e.key === 'Enter' && saveManualTask(index)}
                      className="w-full border-b border-cyan-500 bg-transparent text-sm font-bold outline-none"
                    />
                  ) : (
                    <h3 
                      className={`text-sm font-bold leading-tight ${task.completed ? 'text-slate-500 line-through' : 'text-slate-800'}`}
                      onClick={() => {
                        if (task.type === 'manual') {
                          setEditingIndex(index);
                          setEditValue(task.title);
                        }
                      }}
                    >
                      {task.title}
                    </h3>
                  )}
                  
                  {/* Timer Display */}
                  <div className={`mt-3 font-mono text-xs font-bold tracking-wider flex items-center gap-1.5 ${
                    isActive ? 'text-cyan-600' :
                    isOvertime ? 'text-red-600' : 'text-slate-500'
                  }`}>
                    ⏱ {formatTime(currentSeconds)} <span className="text-slate-300 font-normal">/</span> {formatTime(task.targetTime)}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                {task.type === 'manual' && !task.completed && (
                  <button 
                    onClick={() => {
                      const newTasks = [...tasks];
                      newTasks[index] = null;
                      saveTasks(newTasks);
                    }}
                    className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1"
                  >
                    Borrar
                  </button>
                )}
                <div className="flex-1" />
                {!task.completed && (
                  <button
                    onClick={() => isActive ? handleStopTask(index) : handleStartTask(index, task)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                      isActive 
                        ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' 
                        : 'bg-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    {isActive ? '⏸ Pausar' : '▶ Play'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
