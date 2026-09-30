import React, { useState, useEffect } from 'react';

/**
 * NotaPersonal — textarea para añadir una nota personal a una pregunta.
 * Se autoguarda al perder el foco o al pulsar Guardar.
 */
export default function NotaPersonal({ preguntaId, nota: notaInicial = '', onGuardar }) {
  const [nota, setNota] = useState(notaInicial || '');
  const [guardado, setGuardado] = useState(false);
  const prevPreguntaIdRef = React.useRef(preguntaId);

  // Sync cuando cambia la pregunta o si la nota inicial se carga asíncronamente
  useEffect(() => {
    if (prevPreguntaIdRef.current !== preguntaId) {
      prevPreguntaIdRef.current = preguntaId;
      setNota(notaInicial || '');
      setGuardado(false);
    } else if (notaInicial && !nota) {
      setNota(notaInicial);
    }
  }, [preguntaId, notaInicial]);

  const handleGuardar = () => {
    onGuardar(preguntaId, nota);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-2">
        <span>📝</span> Mi nota personal
      </label>
      <div className="flex gap-2 items-start">
        <textarea
          value={nota}
          onChange={e => { setNota(e.target.value); setGuardado(false); }}
          onBlur={handleGuardar}
          placeholder="Escribe aquí tu truco, regla mnemotécnica o apunte personal..."
          rows={3}
          className="flex-1 text-sm text-slate-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-300 placeholder-slate-300 leading-relaxed"
        />
        <button
          onClick={handleGuardar}
          className={`flex-shrink-0 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
            guardado
              ? 'bg-green-100 text-green-700 border border-green-200'
              : 'bg-yellow-100 text-yellow-800 border border-yellow-300 hover:bg-yellow-200'
          }`}
        >
          {guardado ? '✓ Guardado' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}
