import React, { useState, useEffect, useCallback } from 'react';
import { useTracker } from '../context/TrackerContext';
import { getBloquesCompletados, addBloqueCompletado, deleteBloqueCompletado } from '../lib/db';
import planData from '../data/planDiarioDetallado.json';

function todayKey() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function Inicio({ setTab }) {
  const tKey = todayKey();
  const planHoy = planData[tKey] || planData['2026-11-03'];
  const { activeEntry, elapsed, entries, startTracking, stopTracking } = useTracker();

  // Estado de checks completados (localStorage + sincronización bidireccional con Supabase bloques_completados)
  const [completedMap, setCompletedMap] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`mir_plan_completed_${tKey}`) || '{}');
    } catch {
      return {};
    }
  });

  const syncBloquesHoyConSupabase = useCallback(async () => {
    try {
      const cloudIds = await getBloquesCompletados();
      const prefix = `${tKey}:`;
      const cloudForToday = {};
      for (const id of cloudIds) {
        if (typeof id === 'string' && id.startsWith(prefix)) {
          cloudForToday[id.slice(prefix.length)] = true;
        }
      }

      let localMap = {};
      try {
        localMap = JSON.parse(localStorage.getItem(`mir_plan_completed_${tKey}`) || '{}');
      } catch {}

      // Subir a Supabase cualquier check que estuviera marcado en localStorage pero aún no en la nube
      for (const [bId, isChecked] of Object.entries(localMap)) {
        if (isChecked && !cloudForToday[bId]) {
          addBloqueCompletado(`${prefix}${bId}`);
          cloudForToday[bId] = true;
        }
      }

      const merged = { ...localMap, ...cloudForToday };
      try {
        localStorage.setItem(`mir_plan_completed_${tKey}`, JSON.stringify(merged));
      } catch {}
      setCompletedMap(merged);
    } catch {}
  }, [tKey]);

  useEffect(() => {
    syncBloquesHoyConSupabase();
    const onFocus = () => syncBloquesHoyConSupabase();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [syncBloquesHoyConSupabase]);

  // Estado del auto tracker nativo en vivo
  const [liveTracker, setLiveTracker] = useState(null);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const resp = await fetch('/src/data/live_tracker.json?t=' + Date.now());
        if (resp.ok) {
          const data = await resp.json();
          setLiveTracker(data);
        }
      } catch {}
    };
    fetchLive();
    const interval = setInterval(fetchLive, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleCheck = (blockId) => {
    setCompletedMap(prev => {
      const nextVal = !prev[blockId];
      const next = { ...prev, [blockId]: nextVal };
      try {
        localStorage.setItem(`mir_plan_completed_${tKey}`, JSON.stringify(next));
      } catch {}
      const cloudKey = `${tKey}:${blockId}`;
      if (nextVal) {
        addBloqueCompletado(cloudKey);
      } else {
        deleteBloqueCompletado(cloudKey);
      }
      return next;
    });
  };

  // Calcular segundos reales dedicados a cada bloque según historial + activo
  const getSecondsForBlock = (block) => {
    const blockEntries = entries.filter(e => {
      const sameDay = e.fecha === tKey;
      if (!sameDay) return false;
      const descMatch = e.descripcion && block.titulo && e.descripcion.toLowerCase().includes(block.categoria);
      const asigMatch = block.asignatura && e.especialidad && e.especialidad.toLowerCase() === block.asignatura.toLowerCase();
      const directMatch = e.bloqueId === block.id;
      return directMatch || descMatch || asigMatch;
    });

    let total = blockEntries.reduce((sum, e) => sum + (e.duracionSegundos || 0), 0);

    // Sumar si está activo en este momento
    if (activeEntry) {
      const isCurrent = activeEntry.bloqueId === block.id ||
        (activeEntry.descripcion && activeEntry.descripcion.toLowerCase().includes(block.categoria)) ||
        (liveTracker?.categoria && liveTracker?.descripcion?.toLowerCase().includes(block.categoria));
      if (isCurrent) {
        total += elapsed;
      }
    }
    return total;
  };

  const totalMinutosPlan = planHoy.bloques.reduce((acc, b) => acc + (b.duracionMin || 0), 0);
  const totalBloques = planHoy.bloques.length;
  const bloquesCompletados = planHoy.bloques.filter(b => completedMap[b.id]).length;
  const pctCumplimiento = Math.round((bloquesCompletados / totalBloques) * 100);

  const formatMinSec = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  return (
    <div className="max-w-6xl mx-auto pb-16 px-4">
      {/* ─── CABECERA DEL DÍA ────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-xl border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-xs font-black uppercase px-2.5 py-1 rounded-full tracking-wider">
                HOJA DE RUTA OFICIAL · {tKey}
              </span>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold px-2.5 py-1 rounded-full">
                {planHoy.fase}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              {planHoy.titulo}
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Rastreo automático en segundo plano con tu Mac. Cumple los bloques a tu ritmo.
            </p>
          </div>

          {/* Barra de progreso global */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 min-w-[240px]">
            <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-1.5">
              <span>CUMPLIMIENTO DEL DÍA</span>
              <span className="text-cyan-400 font-mono text-sm">{pctCumplimiento}%</span>
            </div>
            <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${pctCumplimiento}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-slate-400 mt-2">
              <span>{bloquesCompletados} de {totalBloques} bloques listos</span>
              <span>Total: {Math.round(totalMinutosPlan / 60)}h {totalMinutosPlan % 60}m</span>
            </div>
          </div>
        </div>

        {/* Banner de Estado del Tracker Nativo de Mac */}
        <div className="mt-6 pt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${liveTracker?.is_studying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-slate-300">
              Rastreo Mac:&nbsp;
              <b className={liveTracker?.is_studying ? 'text-emerald-300' : 'text-slate-400'}>
                {liveTracker?.is_studying ? `Detectando: ${liveTracker?.descripcion}` : (liveTracker?.is_idle ? 'Pausado por inactividad' : 'Fuera de estudio / Pausado')}
              </b>
            </span>
          </div>
          {liveTracker?.frontmost_app && (
            <span className="text-slate-400">
              Ventana frontal: <code className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-200">{liveTracker.frontmost_app}</code>
            </span>
          )}
        </div>
      </div>

      {/* ─── LISTA DE BLOQUES MINUTO A MINUTO ───────────────────────── */}
      <div className="space-y-4">
        {planHoy.bloques.map((b, idx) => {
          const isDone = Boolean(completedMap[b.id]);
          const realSecs = getSecondsForBlock(b);
          const targetSecs = (b.duracionMin || 0) * 60;
          const isCurrentActive = activeEntry?.bloqueId === b.id ||
            (activeEntry && activeEntry.descripcion && activeEntry.descripcion.toLowerCase().includes(b.categoria));
          const pctBlock = targetSecs > 0 ? Math.min(100, Math.round((realSecs / targetSecs) * 100)) : 0;

          // Badges de categoría
          let catBadge = { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200', label: b.categoria.toUpperCase() };
          if (b.categoria === 'anki') catBadge = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', label: '🃏 ANKI' };
          if (b.categoria === 'estudio') catBadge = { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', label: '🧠 ESTUDIO' };
          if (b.categoria === 'test') catBadge = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: '📝 TEST' };
          if (b.categoria === 'evaluacion') catBadge = { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', label: '💻 CTO CAMPUS' };
          if (b.categoria === 'descanso') catBadge = { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', label: '☕ DESCANSO' };

          return (
            <div
              key={b.id}
              className={`rounded-xl p-4 sm:p-5 border transition-all duration-200 ${
                isDone
                  ? 'bg-slate-50/70 border-slate-200 opacity-60'
                  : isCurrentActive
                  ? 'bg-white border-cyan-500 shadow-md ring-2 ring-cyan-500/20'
                  : 'bg-white border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Botón Checkbox */}
                <button
                  onClick={() => toggleCheck(b.id)}
                  className={`w-7 h-7 mt-0.5 rounded-lg shrink-0 flex items-center justify-center font-bold text-sm transition-all border ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-slate-50 border-slate-300 text-transparent hover:border-cyan-500 hover:bg-slate-100'
                  }`}
                  title={isDone ? 'Marcar como pendiente' : 'Marcar como completado'}
                >
                  ✓
                </button>

                {/* Contenido Central */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {b.hora}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${catBadge.bg} ${catBadge.text} ${catBadge.border}`}>
                      {catBadge.label}
                    </span>
                    {b.asignatura && (
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {b.asignatura}
                      </span>
                    )}
                    {isCurrentActive && (
                      <span className="bg-cyan-100 text-cyan-800 text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse border border-cyan-300">
                        ⚡ EN CURSO
                      </span>
                    )}
                  </div>

                  <h3 className={`text-base font-bold leading-snug ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                    {b.titulo}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {b.subtitulo}
                  </p>

                  {/* Barra de progreso de tiempo del bloque */}
                  {b.categoria !== 'descanso' && (
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isDone ? 'bg-emerald-500' : isCurrentActive ? 'bg-cyan-500' : 'bg-slate-400'
                          }`}
                          style={{ width: `${pctBlock}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs font-bold text-slate-600 shrink-0">
                        {formatMinSec(realSecs)} <span className="text-slate-300 font-normal">/</span> {b.duracionMin}m
                      </span>
                    </div>
                  )}
                </div>

                {/* Acciones directas */}
                <div className="shrink-0 flex items-center gap-2">
                  {b.linkTab === 'desgloses' && (
                    <button
                      onClick={() => setTab && setTab('desgloses')}
                      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
                    >
                      Ir al Test →
                    </button>
                  )}
                  {b.categoria !== 'descanso' && (
                    <button
                      onClick={() => {
                        if (isCurrentActive) {
                          stopTracking();
                        } else {
                          startTracking({
                            descripcion: b.titulo,
                            especialidad: b.asignatura || null,
                            tema: null,
                            bloqueId: b.id,
                            targetTimeSeconds: b.duracionMin * 60
                          });
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm border ${
                        isCurrentActive
                          ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                          : 'bg-slate-900 text-white border-slate-900 hover:bg-slate-800'
                      }`}
                    >
                      {isCurrentActive ? '⏸ Pausa' : '▶ Play'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
