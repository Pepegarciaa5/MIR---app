import React, { useState, useEffect, useRef } from 'react';
import {
  solicitarExplicacionTutor,
  enviarRepreguntaTutor,
  getCachedExplanation,
  extraerMnemotecnia
} from '../../lib/geminiTutor';
import { saveMnemotecnia } from '../../lib/mnemotecnias';

export default function TutorGemini({
  question,
  userAnswer,
  isCorrect,
  confidence,
  discardedOptions = [],
  commentary = '',
  onGuardarNota = null,
  currentNota = ''
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState(null);
  const [error, setError] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [notaGuardada, setNotaGuardada] = useState(false);
  const [mneGuardada, setMneGuardada] = useState(false);

  const chatBottomRef = useRef(null);

  // Comprobar si ya existe una explicación en caché al cambiar de pregunta
  useEffect(() => {
    if (!question?.id) return;
    const cached = getCachedExplanation(question.id);
    if (cached) {
      setExplanation(cached);
      setChatHistory(cached.history || []);
      setIsOpen(true);
    } else {
      setExplanation(null);
      setChatHistory([]);
      setIsOpen(false);
    }
    setError(null);
    setNotaGuardada(false);
    setMneGuardada(false);
  }, [question?.id]);

  const handleConsultar = async (forceRefresh = false) => {
    setIsOpen(true);
    setLoading(true);
    setError(null);

    try {
      const data = await solicitarExplicacionTutor({
        question,
        userAnswer,
        isCorrect,
        confidence,
        discardedOptions,
        commentary,
        forceRefresh
      });
      setExplanation(data);
      setChatHistory(data.history || []);
    } catch (err) {
      setError(err.message || 'Error al conectar con el Tutor Gemini.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarRepregunta = async () => {
    if (!followUpInput.trim() || followUpLoading) return;
    const query = followUpInput.trim();
    setFollowUpInput('');
    setFollowUpLoading(true);

    try {
      const res = await enviarRepreguntaTutor({
        questionId: question.id,
        history: chatHistory,
        userQuestion: query,
        model: explanation?.modelUsed
      });
      if (res) {
        setChatHistory(res.history);
        setTimeout(() => {
          chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } catch (err) {
      alert(`Error en la repregunta: ${err.message}`);
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleGuardarEnNota = () => {
    if (!onGuardarNota || !explanation?.text) return;
    const perla = extraerMnemotecnia(explanation.text) || explanation.text.slice(0, 200);
    const nuevaNota = currentNota ? `${currentNota}\n\n💡 [Tutor]: ${perla}` : `💡 [Tutor]: ${perla}`;
    onGuardarNota(question.id, nuevaNota);
    setNotaGuardada(true);
    setTimeout(() => setNotaGuardada(false), 2500);
  };

  const handleGuardarMnemotecnia = () => {
    if (!explanation?.text) return;
    const mnemTexto = extraerMnemotecnia(explanation.text) || explanation.text.slice(0, 250);
    saveMnemotecnia({
      id: `MNE-AI-${Date.now()}`,
      texto: mnemTexto,
      asignatura: question.asignatura || 'General',
      bloqueId: null,
      importancia: 'alta'
    });
    setMneGuardada(true);
    setTimeout(() => setMneGuardada(false), 2500);
  };

  // Renderizador simple de markdown para secciones
  const renderFormattedText = (raw) => {
    if (!raw) return null;
    const paragraphs = raw.split(/\n\n+/);
    return paragraphs.map((p, idx) => {
      const trimmed = p.trim();
      if (trimmed.startsWith('###')) {
        return (
          <h4 key={idx} className="text-base font-bold text-slate-900 mt-4 mb-2 flex items-center gap-2 border-b border-slate-100 pb-1">
            {trimmed.replace(/^###\s*/, '')}
          </h4>
        );
      }
      if (trimmed.startsWith('>')) {
        return (
          <blockquote key={idx} className="bg-amber-50 border-l-4 border-amber-400 p-3 my-2 text-amber-900 text-sm italic rounded-r-lg">
            {trimmed.replace(/^>\s*/, '')}
          </blockquote>
        );
      }
      return (
        <p key={idx} className="text-sm text-slate-700 leading-relaxed my-2 whitespace-pre-line">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      {!isOpen ? (
        <button
          onClick={() => handleConsultar(false)}
          className="w-full flex items-center justify-between p-3.5 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 hover:from-indigo-100 hover:to-purple-100 text-indigo-950 font-bold transition-all shadow-xs group"
        >
          <div className="flex items-center gap-2.5 text-left">
            <span className="text-xl group-hover:scale-110 transition-transform">🧠</span>
            <div>
              <div className="text-sm font-black flex items-center gap-2">
                <span>Explicar con Tutor Gemini</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white">
                  IA Médica
                </span>
              </div>
              <div className="text-xs text-indigo-700/80 font-medium">
                Pivote clínico, por qué fallaste, distractores y regla mnemotécnica
              </div>
            </div>
          </div>
          <span className="text-indigo-600 font-extrabold text-sm group-hover:translate-x-1 transition-transform">
            Ver razonamiento →
          </span>
        </button>
      ) : (
        <div className="bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border-2 border-indigo-300 p-5 shadow-sm space-y-4">
          {/* Header del Tutor */}
          <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                  <span>Tutor Gemini MIR</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                    {explanation?.isPregenerated ? '⚡ Instantáneo' : (explanation?.modelUsed || 'Gemini 3')}
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 font-medium">
                  Razonamiento clínico individualizado para este caso
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleConsultar(true)}
                disabled={loading}
                title="Regenerar respuesta con IA"
                className="text-xs text-slate-500 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-white transition-colors"
              >
                🔄
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold px-2 py-1 rounded-lg hover:bg-white transition-colors"
              >
                Cerrar ✕
              </button>
            </div>
          </div>

          {/* Estado de carga */}
          {loading && (
            <div className="py-8 text-center space-y-3">
              <div className="inline-block w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <div className="text-sm font-bold text-indigo-900">
                El Tutor Gemini está analizando el caso clínico...
              </div>
              <p className="text-xs text-slate-500">
                Extrayendo pivotes, trampas del tribunal y regla mnemotécnica
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 text-sm rounded-xl space-y-2">
              <div className="font-bold flex items-center gap-1.5">
                <span>⚠️</span> No se pudo completar la consulta
              </div>
              <p className="text-xs">{error}</p>
              <button
                onClick={() => handleConsultar(true)}
                className="text-xs font-bold bg-white text-red-700 px-3 py-1.5 rounded-lg border border-red-300 hover:bg-red-50"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Contenido de la explicación */}
          {!loading && explanation && (
            <div className="space-y-4">
              <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs prose prose-slate max-w-none">
                {renderFormattedText(explanation.text)}
              </div>

              {/* Botones de acción rápida integrados con la App */}
              <div className="flex flex-wrap gap-2 pt-1">
                {onGuardarNota && (
                  <button
                    onClick={handleGuardarEnNota}
                    className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs ${
                      notaGuardada
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-white hover:bg-slate-100 text-slate-800 border border-slate-200'
                    }`}
                  >
                    <span>{notaGuardada ? '✓' : '📝'}</span>
                    <span>{notaGuardada ? 'Perla guardada en tu Nota' : 'Guardar en mi Nota Personal'}</span>
                  </button>
                )}

                <button
                  onClick={handleGuardarMnemotecnia}
                  className={`text-xs font-bold px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-xs ${
                    mneGuardada
                      ? 'bg-purple-100 text-purple-800 border border-purple-300'
                      : 'bg-white hover:bg-purple-50 text-purple-800 border border-purple-200'
                  }`}
                >
                  <span>{mneGuardada ? '✓' : '🧠'}</span>
                  <span>{mneGuardada ? 'Mnemotecnia guardada en la Cola' : 'Guardar Mnemotecnia en Cola de Estudio'}</span>
                </button>
              </div>

              {/* Hilo de repreguntas */}
              {chatHistory.length > 2 && (
                <div className="space-y-3 pt-3 border-t border-indigo-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Conversación de dudas:
                  </div>
                  {chatHistory.slice(2).map((msg, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl text-xs leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-indigo-600 text-white ml-6 font-medium'
                          : 'bg-white border border-slate-200 text-slate-800 mr-6 shadow-xs'
                      }`}
                    >
                      <div className="font-bold text-[10px] uppercase opacity-75 mb-1">
                        {msg.role === 'user' ? 'Tú preguntaste:' : 'Tutor Gemini:'}
                      </div>
                      <div className="whitespace-pre-line">{msg.content}</div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              )}

              {/* Input para repreguntar */}
              <div className="pt-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpInput}
                    onChange={e => setFollowUpInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleEnviarRepregunta()}
                    placeholder="¿Tienes alguna duda sobre este caso? Escribe aquí..."
                    disabled={followUpLoading}
                    className="flex-1 text-xs bg-white border border-indigo-200 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent placeholder-slate-400 font-medium"
                  />
                  <button
                    onClick={handleEnviarRepregunta}
                    disabled={!followUpInput.trim() || followUpLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-xs"
                  >
                    {followUpLoading ? 'Pensando...' : 'Preguntar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
