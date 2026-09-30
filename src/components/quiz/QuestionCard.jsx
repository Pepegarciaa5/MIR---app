import React, { useState, useEffect } from 'react';

const QuestionCard = ({ question, onAnswer }) => {
  const [selectedOption, setSelectedOption] = useState(null);
  const [discardedOptions, setDiscardedOptions] = useState([]);
  const [showConfidence, setShowConfidence] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isSubmitted, setIsSubmitted] = useState(false);

  // Reiniciar estado y tiempo al cambiar de pregunta
  useEffect(() => {
    setSeconds(0);
    setIsSubmitted(false);
    setSelectedOption(null);
    setDiscardedOptions([]);
    setShowConfidence(false);
  }, [question?.id]);

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
  };

  const toggleDiscard = (e, id) => {
    e.stopPropagation();
    if (selectedOption === id) setSelectedOption(null);
    setDiscardedOptions((prev) =>
      prev.includes(id) ? prev.filter((opt) => opt !== id) : [...prev, id]
    );
  };

  const handleConfidenceSubmit = (confidenceLevel) => {
    setIsSubmitted(true);
    onAnswer({
      questionId: question.id,
      selectedOption,
      discardedOptions,
      confidence: confidenceLevel, // 'green', 'orange', 'red'
      isCorrect: selectedOption === question.correctOption,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 max-w-3xl mx-auto w-full">
      {/* Header con Temporizador */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isSubmitted ? 'bg-slate-300' : 'bg-emerald-500 animate-pulse'}`} />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {isSubmitted ? 'Tiempo en pregunta' : 'Tiempo en esta pregunta'}
          </span>
        </div>
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

      <div className="mb-6">
        <h3 className="text-lg font-medium text-slate-900 leading-relaxed">
          {question?.text || "¿Cuál de las siguientes afirmaciones es correcta?"}
        </h3>
      </div>

      <div className="space-y-3">
        {options.map((opt) => {
          const isDiscarded = discardedOptions.includes(opt.id);
          const isSelected = selectedOption === opt.id;

          return (
            <div
              key={opt.id}
              onClick={() => handleSelect(opt.id)}
              className={`
                group relative flex items-center p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isDiscarded ? 'bg-slate-50 border-slate-100 opacity-60' : ''}
                ${isSelected && !isDiscarded ? 'border-cyan-500 bg-cyan-50' : 'border-transparent hover:bg-slate-50 bg-white shadow-sm ring-1 ring-slate-200'}
              `}
            >
              {/* Indicador de letra */}
              <div className={`
                flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm mr-4
                ${isSelected && !isDiscarded ? 'bg-cyan-500 text-white' : 'bg-slate-100 text-slate-600'}
                ${isDiscarded ? 'bg-slate-100 text-slate-400 line-through' : ''}
              `}>
                {opt.id}
              </div>

              {/* Texto de la opción */}
              <div className={`flex-grow text-sm ${isDiscarded ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                {opt.text}
              </div>

              {/* Botón Descartar (Aparece en hover) */}
              <button
                onClick={(e) => toggleDiscard(e, opt.id)}
                className={`
                  p-2 rounded-md transition-colors
                  ${isDiscarded ? 'text-red-500 hover:bg-red-50' : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-600 hover:bg-slate-100'}
                `}
                title={isDiscarded ? "Deshacer descarte" : "Descartar opción"}
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
          <p className="text-center text-sm font-medium text-slate-600 mb-4">
            ¿Con qué seguridad marcas esta respuesta?
          </p>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => handleConfidenceSubmit('red')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-red-100 bg-red-50 hover:bg-red-100 hover:border-red-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-red-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-red-700">Ninguna (Rojo)</span>
            </button>
            
            <button
              onClick={() => handleConfidenceSubmit('orange')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-orange-100 bg-orange-50 hover:bg-orange-100 hover:border-orange-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-orange-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-orange-700">Dudosa (Naranja)</span>
            </button>

            <button
              onClick={() => handleConfidenceSubmit('green')}
              className="flex flex-col items-center justify-center p-3 rounded-lg border-2 border-green-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-colors group"
            >
              <div className="w-6 h-6 rounded-full bg-green-500 mb-2 group-hover:scale-110 transition-transform"></div>
              <span className="text-xs font-semibold text-green-700">Segura (Verde)</span>
            </button>
          </div>
        </div>
      )}
      {/* Botón para archivar si faltan datos/imagen */}
      <div className="mt-8 pt-4 border-t border-slate-100 flex justify-end">
        <button
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

