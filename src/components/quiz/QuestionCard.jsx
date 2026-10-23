import React, { useState, useEffect } from 'react';
import ClinicalImage from './ClinicalImage';

const QuestionCard = ({ question, onAnswer, onNext, examMode = false, initialAnswer = null }) => {
  const [selectedOption, setSelectedOption] = useState(initialAnswer?.selectedLetter || null);
  const [discardedOptions, setDiscardedOptions] = useState(initialAnswer?.discardedOptions || []);
  const [showConfidence, setShowConfidence] = useState(Boolean(initialAnswer?.selectedLetter));
  const [seconds, setSeconds] = useState(initialAnswer?.seconds || 0);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [hintMessage, setHintMessage] = useState(null);
  const [keyboardMode, setKeyboardMode] = useState(() => {
    try {
      const saved = localStorage.getItem('mir_keyboard_mode');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const handleToggleKeyboard = () => {
    setKeyboardMode(prev => {
      const next = !prev;
      try {
        localStorage.setItem('mir_keyboard_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Reiniciar estado y tiempo al cambiar de pregunta
  useEffect(() => {
    setSeconds(initialAnswer?.seconds || 0);
    setIsSubmitted(false);
    setSelectedOption(initialAnswer?.selectedLetter || null);
    setDiscardedOptions(initialAnswer?.discardedOptions || []);
    setShowConfidence(Boolean(initialAnswer?.selectedLetter));
    setHintMessage(null);
  }, [question?.id, initialAnswer?.selectedLetter]);

  // Contador de segundos
  useEffect(() => {
    if (isSubmitted) return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isSubmitted, question?.id]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Opciones mock si la pregunta no las trae estructuradas
  const options = question?.options || [
    { id: 'A', text: 'Opción A' },
    { id: 'B', text: 'Opción B' },
    { id: 'C', text: 'Opción C' },
    { id: 'D', text: 'Opción D' },
  ];

  const handleSelect = (id) => {
    if (discardedOptions.includes(id)) return;
    setSelectedOption(id);
    setShowConfidence(true); // Mostrar botones de seguridad al seleccionar
    setHintMessage(null);
  };

  const toggleDiscard = (e, id) => {
    if (e) e.stopPropagation();
    if (selectedOption === id) setSelectedOption(null);
    setDiscardedOptions((prev) =>
      prev.includes(id) ? prev.filter((opt) => opt !== id) : [...prev, id]
    );
  };

  const handleConfidenceSubmit = (confidenceLevel) => {
    if (!examMode) {
      setIsSubmitted(true);
    }
    setHintMessage(null);
    onAnswer({
      questionId: question.id,
      selectedOption,
      discardedOptions,
      confidence: confidenceLevel, // 'green', 'orange', 'red'
      isCorrect: selectedOption === question.correctOption,
      seconds,
    });
  };

  // Manejo de atajos de teclado para responder
  useEffect(() => {
    if (!keyboardMode) return;

    const handleKeyDown = (e) => {
      // Ignorar si el usuario está escribiendo en un input, textarea o contenteditable
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      // No interceptar si presiona modificadores del sistema
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Si ya está respondida y visualizando feedback: Enter o Flecha Derecha avanzan
      if (isSubmitted) {
        if (e.key === 'Enter' || e.key === 'ArrowRight') {
          e.preventDefault();
          onNext?.();
        }
        return;
      }

      // Detectar tecla de opción (1-5 o A-E)
      let targetIndex = -1;
      const code = e.code;
      const key = e.key ? e.key.toLowerCase() : '';

      if (code === 'Digit1' || code === 'Numpad1' || key === '1' || key === 'a') targetIndex = 0;
      else if (code === 'Digit2' || code === 'Numpad2' || key === '2' || key === 'b') targetIndex = 1;
      else if (code === 'Digit3' || code === 'Numpad3' || key === '3' || key === 'c') targetIndex = 2;
      else if (code === 'Digit4' || code === 'Numpad4' || key === '4' || key === 'd') targetIndex = 3;
      else if (code === 'Digit5' || code === 'Numpad5' || key === '5' || key === 'e') targetIndex = 4;

      if (targetIndex >= 0 && targetIndex < options.length) {
        e.preventDefault();
        const targetOpt = options[targetIndex];
        if (e.shiftKey) {
          // Descartar opción
          toggleDiscard(null, targetOpt.id);
        } else {
          // Seleccionar opción
          handleSelect(targetOpt.id);
        }
        return;
      }

      // Si ya hay opción seleccionada, teclas de confianza
      if (selectedOption && showConfidence) {
        if (e.key === 'Enter' || key === 'v' || key === 'g') {
          e.preventDefault();
          handleConfidenceSubmit('green');
          return;
        }
        if (key === 'n' || key === 'o' || key === 'd') {
          e.preventDefault();
          handleConfidenceSubmit('orange');
          return;
        }
        if (key === 'r') {
          e.preventDefault();
          handleConfidenceSubmit('red');
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setSelectedOption(null);
          setShowConfidence(false);
          return;
        }
      } else if (!selectedOption && (e.key === 'Enter' || key === 'v' || key === 'n' || key === 'r')) {
        // Recordatorio si pulsa Enter o confianza sin seleccionar opción
        e.preventDefault();
        setHintMessage('Pulsa primero un número (1-4) o letra para elegir respuesta');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [keyboardMode, isSubmitted, options, selectedOption, showConfidence, discardedOptions, onNext]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto w-full">
      {/* Header con Temporizador y Toggle de Teclado */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isSubmitted ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isSubmitted ? 'Tiempo en pregunta' : 'Tiempo en esta pregunta'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Toggle Modo Teclado */}
          <button
            type="button"
            onClick={handleToggleKeyboard}
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all border shadow-2xs
              ${keyboardMode 
                ? 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100 ring-2 ring-cyan-400/20' 
                : 'bg-slate-100 text-slate-400 border-slate-200 hover:text-slate-600 hover:bg-slate-200/60'}
            `}
            title={keyboardMode ? 'Modo teclado activo (1-4, Shift+1-4, Enter, V, N, R). Clic para desactivar.' : 'Activar modo responder con teclado'}
          >
            <span className="text-sm">⌨️</span>
            <span>{keyboardMode ? 'Teclado ON' : 'Teclado OFF'}</span>
          </button>

          <div 
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-bold border transition-colors shadow-xs
              ${seconds > 120 
                ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                : seconds > 60 
                  ? 'bg-amber-50 text-amber-700 border-amber-200' 
                  : 'bg-slate-100 text-slate-700 border-slate-200'}
            `}
            title={seconds > 120 ? '¡Atención! Llevas más de 2 minutos en esta pregunta' : 'Tiempo transcurrido en la pregunta actual'}
          >
            <span className="text-sm">⏱️</span>
            <span>{formatTimer(seconds)}</span>
          </div>
        </div>
      </div>

      {/* Mensaje de aviso de atajo (si pulsa Enter sin haber elegido) */}
      {hintMessage && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold text-center animate-in fade-in slide-in-from-top-1 flex items-center justify-center gap-2 shadow-2xs">
          <span>💡</span>
          <span>{hintMessage}</span>
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-medium text-slate-900 leading-relaxed whitespace-pre-wrap">
          {question?.text || "¿Cuál de las siguientes afirmaciones es correcta?"}
        </h3>

        {(question?.image || question?.imagen_nombre || question?.imagen) && (
          <ClinicalImage
            src={question.image || question.imagen_nombre || question.imagen}
            alt={question?.text ? `Imagen: ${question.text.slice(0, 60)}...` : 'Imagen clínica asociada'}
            className="mt-4"
          />
        )}
      </div>

      <div className="space-y-3">
        {options.map((opt, idx) => {
          const isDiscarded = discardedOptions.includes(opt.id);
          const isSelected = selectedOption === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`
                group relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isDiscarded ? 'bg-slate-50 border-slate-100 opacity-60' : ''}
                ${isSelected && !isDiscarded ? 'border-cyan-500 bg-cyan-50 shadow-xs' : 'border-transparent hover:bg-slate-50 bg-white shadow-sm ring-1 ring-slate-200'}
              `}
            >
              {/* Indicador de letra y atajo */}
              <div className="flex-shrink-0 flex items-center gap-2 mr-4">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all
                  ${isSelected && !isDiscarded ? 'bg-cyan-500 text-white shadow-sm ring-2 ring-cyan-300' : 'bg-slate-100 text-slate-600'}
                  ${isDiscarded ? 'bg-slate-100 text-slate-400 line-through' : ''}
                `}>
                  {opt.id}
                </div>

                {keyboardMode && (
                  <kbd className={`
                    hidden sm:inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[10px] font-mono font-black rounded border transition-colors
                    ${isSelected && !isDiscarded 
                      ? 'bg-cyan-100 border-cyan-300 text-cyan-800' 
                      : isDiscarded 
                        ? 'bg-slate-100 border-slate-200 text-slate-300 line-through' 
                        : 'bg-slate-50 border-slate-200 text-slate-400 group-hover:border-slate-300 group-hover:text-slate-600'}
                  `} title={`Pulsa [${idx + 1}] para elegir · [Shift + ${idx + 1}] para descartar`}>
                    {idx + 1}
                  </kbd>
                )}
              </div>

              {/* Texto de la opción */}
              <div className={`flex-grow text-sm ${isDiscarded ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {opt.text}
              </div>

              {/* Botón Descartar (Aparece en hover) */}
              <button
                type="button"
                onClick={(e) => toggleDiscard(e, opt.id)}
                className={`
                  p-2 rounded-md transition-colors ml-2
                  ${isDiscarded ? 'text-red-500 hover:bg-red-50' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100'}
                `}
                title={isDiscarded 
                  ? (keyboardMode ? `Recuperar opción (Shift + ${idx + 1})` : "Deshacer descarte")
                  : (keyboardMode ? `Descartar opción (Shift + ${idx + 1})` : "Descartar opción")
                }
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isDiscarded ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  )}
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* Controles de Seguridad (Aparecen al seleccionar una opción) */}
      {showConfidence && (
        <div className="mt-8 pt-6 border-t border-slate-100 animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <p className="text-sm font-medium text-slate-600">
              ¿Con qué seguridad marcas esta respuesta?
            </p>
            {keyboardMode && (
              <span className="text-[11px] text-slate-400 font-medium">
                Pulsa <kbd className="px-1.5 py-0.5 font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700">V</kbd> / <kbd className="px-1.5 py-0.5 font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700">N</kbd> / <kbd className="px-1.5 py-0.5 font-mono font-bold bg-slate-100 border border-slate-200 rounded text-slate-700">R</kbd> o <kbd className="px-1.5 py-0.5 font-mono font-bold bg-emerald-50 border border-emerald-200 rounded text-emerald-800">Enter ↵</kbd>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => handleConfidenceSubmit('red')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-red-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-red-700">Ninguna (Rojo)</span>
              {keyboardMode && (
                <span className="mt-1 text-[10px] font-mono font-bold text-red-700 bg-red-100/90 border border-red-200 px-1.5 py-0.5 rounded shadow-2xs">
                  Tecla [R]
                </span>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => handleConfidenceSubmit('orange')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-orange-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-orange-700">Dudosa (Naranja)</span>
              {keyboardMode && (
                <span className="mt-1 text-[10px] font-mono font-bold text-orange-700 bg-orange-100/90 border border-orange-200 px-1.5 py-0.5 rounded shadow-2xs">
                  Tecla [N]
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleConfidenceSubmit('green')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-green-200 bg-green-50 hover:bg-green-100 hover:border-green-300 transition-colors group ring-2 ring-emerald-400/20"
            >
              <div className="w-6 h-6 rounded-full bg-green-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-green-700">Segura (Verde)</span>
              {keyboardMode && (
                <span className="mt-1 text-[10px] font-mono font-bold text-green-800 bg-green-100 border border-green-300 px-2 py-0.5 rounded shadow-2xs flex items-center gap-1">
                  <span>[V]</span> o <span>[Enter ↵]</span>
                </span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Barra de atajos de teclado cuando el modo está activo */}
      {keyboardMode && !isSubmitted && (
        <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-600 flex items-center gap-1">
              <span>⌨️</span> Atajos:
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700">1-4</kbd> elegir
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded font-mono font-bold text-slate-700">Shift + 1-4</kbd> descartar
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-emerald-50 border border-emerald-200 rounded font-mono font-bold text-emerald-800">Enter / V</kbd> segura
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-amber-50 border border-amber-200 rounded font-mono font-bold text-amber-800">N</kbd> duda
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-red-50 border border-red-200 rounded font-mono font-bold text-red-800">R</kbd> rojo
            </span>
          </div>
        </div>
      )}

      {/* Botones inferiores: Dejar en blanco y Archivar si faltan datos/imagen */}
      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => {
            onAnswer({ skipped: true, archive: false });
          }}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 border border-slate-200"
          title="Dejar en blanco / Pasar a la siguiente sin archivar"
        >
          <span>⏭️</span> Dejar en blanco / Pasar
        </button>

        <button
          type="button"
          onClick={() => {
            setIsSubmitted(true);
            onAnswer({ skipped: true, archive: true, reason: 'missing_data' });
          }}
          className="text-xs font-bold text-slate-400 hover:text-red-600 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
          title="Archivar esta pregunta para siempre (no volverá a salir en ningún test o desglose)"
        >
          <span>📦</span> Imposible resolver (Faltan datos/imagen) · Archivar
        </button>
      </div>
    </div>
  );
};

export default QuestionCard;

