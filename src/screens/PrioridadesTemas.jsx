import React, { useState, useMemo, useEffect } from 'react';
import {
  getAnalisisPrioridadesTemas,
  getPreguntasDeTema,
  formatQuestionAsText,
  formatTopicAsDocument
} from '../lib/prioridadesTemas';
import { getEspecialidadColor } from '../data/especialidadesMIR';
import ClinicalImage from '../components/common/ClinicalImage';

export default function PrioridadesTemas() {
  // Datos calculados
  const { rankingGlobal, rankingAsignaturas } = useMemo(() => getAnalisisPrioridadesTemas(), []);

  // Estados de vista y filtros
  const [vistaModo, setVistaModo] = useState('asignaturas'); // 'asignaturas' | 'global'
  const [busqueda, setBusqueda] = useState('');
  const [soloConFallos, setSoloConFallos] = useState(false);
  const [asignaturaFiltro, setAsignaturaFiltro] = useState('todas');
  const [asignaturasAbiertas, setAsignaturasAbiertas] = useState(() => {
    // Abrir por defecto las 3 primeras asignaturas más vulnerables
    const initial = {};
    rankingAsignaturas.slice(0, 4).forEach(a => {
      initial[a.asignatura] = true;
    });
    return initial;
  });

  // Tema seleccionado para ver preguntas
  const [temaSeleccionado, setTemaSeleccionado] = useState(null); // { asignatura, tema, stats }
  const [filtroPreguntas, setFiltroPreguntas] = useState('todas'); // 'todas' | 'falladas' | 'simulacros' | 'mir'
  const [soloRecientes, setSoloRecientes] = useState(false); // false por defecto para mostrar todos los desgloses desde 2010
  const [modoTextoPlano, setModoTextoPlano] = useState(false);
  const [copiadoId, setCopiadoId] = useState(null);
  const [copiadoGlobal, setCopiadoGlobal] = useState(false);

  // Toggle de acordeón de asignaturas
  const toggleAsignatura = (asig) => {
    setAsignaturasAbiertas(prev => ({
      ...prev,
      [asig]: !prev[asig]
    }));
  };

  const expandirTodas = () => {
    const all = {};
    rankingAsignaturas.forEach(a => { all[a.asignatura] = true; });
    setAsignaturasAbiertas(all);
  };

  const colapsarTodas = () => {
    setAsignaturasAbiertas({});
  };

  // Carga de preguntas cuando se selecciona un tema
  const preguntasData = useMemo(() => {
    if (!temaSeleccionado) return { mirQuestions: [], simQuestions: [], todas: [] };
    return getPreguntasDeTema(temaSeleccionado.asignatura, temaSeleccionado.tema, soloRecientes);
  }, [temaSeleccionado, soloRecientes]);

  // Preguntas filtradas según la pestaña seleccionada
  const preguntasMostradas = useMemo(() => {
    if (!temaSeleccionado) return [];
    if (filtroPreguntas === 'falladas') {
      return preguntasData.simQuestions.filter(q => q.fallada);
    }
    if (filtroPreguntas === 'simulacros') {
      return preguntasData.simQuestions;
    }
    if (filtroPreguntas === 'mir') {
      return preguntasData.mirQuestions;
    }
    return preguntasData.todas;
  }, [preguntasData, filtroPreguntas, temaSeleccionado]);

  // Texto plano continuo del tema para copiar todo
  const textoPlanoDocumento = useMemo(() => {
    if (!temaSeleccionado) return '';
    return formatTopicAsDocument(
      temaSeleccionado.asignatura,
      temaSeleccionado.tema,
      temaSeleccionado.stats,
      preguntasMostradas
    );
  }, [temaSeleccionado, preguntasMostradas]);

  // Función para copiar texto al portapapeles
  const handleCopiarTexto = async (texto, id = 'global') => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = texto;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      if (id === 'global') {
        setCopiadoGlobal(true);
        setTimeout(() => setCopiadoGlobal(false), 2000);
      } else {
        setCopiadoId(id);
        setTimeout(() => setCopiadoId(null), 2000);
      }
    } catch (err) {
      console.error('Error al copiar:', err);
    }
  };

  // Filtrado de asignaturas y temas
  const asignaturasFiltradas = useMemo(() => {
    return rankingAsignaturas
      .filter(a => {
        if (asignaturaFiltro !== 'todas' && a.asignatura !== asignaturaFiltro) return false;
        return true;
      })
      .map(a => {
        const temas = a.temas.filter(t => {
          if (soloConFallos && t.userFalladas === 0) return false;
          if (busqueda.trim()) {
            const query = busqueda.toLowerCase().trim();
            const matchTema = t.tema.toLowerCase().includes(query);
            const matchAsig = t.asignatura.toLowerCase().includes(query);
            if (!matchTema && !matchAsig) return false;
          }
          return true;
        });
        return { ...a, temas };
      })
      .filter(a => a.temas.length > 0);
  }, [rankingAsignaturas, asignaturaFiltro, soloConFallos, busqueda]);

  const temasGlobalFiltrados = useMemo(() => {
    return rankingGlobal.filter(t => {
      if (asignaturaFiltro !== 'todas' && t.asignatura !== asignaturaFiltro) return false;
      if (soloConFallos && t.userFalladas === 0) return false;
      if (busqueda.trim()) {
        const query = busqueda.toLowerCase().trim();
        const matchTema = t.tema.toLowerCase().includes(query);
        const matchAsig = t.asignatura.toLowerCase().includes(query);
        if (!matchTema && !matchAsig) return false;
      }
      return true;
    });
  }, [rankingGlobal, asignaturaFiltro, soloConFallos, busqueda]);

  // Colores de acierto
  const getBadgeColor = (pct) => {
    if (pct === null) return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1' };
    if (pct >= 70) return { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' };
    if (pct >= 45) return { bg: '#fffbeb', text: '#b45309', border: '#fde68a' };
    return { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      {/* ─── Encabezado Principal ─── */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-2xl">🎯</span>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                Prioridades de Repaso por Temas
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                Últimos 4 MIR + Sims 9-18
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-1.5 max-w-3xl leading-relaxed">
              Temas ordenados por rentabilidad en el examen cruzada con tus fallos reales en los simulacros.
              Accede directamente a todas las preguntas oficiales del MIR y de simulacros para repasar y copiarlas en formato texto.
            </p>
          </div>

          {/* Selector de Modo de Vista */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl flex-none border border-slate-200">
            <button
              onClick={() => setVistaModo('asignaturas')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                vistaModo === 'asignaturas'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>📑</span>
              <span>Por Asignaturas</span>
            </button>
            <button
              onClick={() => setVistaModo('global')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                vistaModo === 'global'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>🏆</span>
              <span>Ranking Global</span>
            </button>
          </div>
        </div>

        {/* ─── Barra de Filtros y Búsqueda ─── */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Búsqueda de tema */}
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Buscar tema o asignatura..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>

          {/* Filtro por Asignatura */}
          <div>
            <select
              value={asignaturaFiltro}
              onChange={(e) => setAsignaturaFiltro(e.target.value)}
              className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            >
              <option value="todas">Todas las Asignaturas ({rankingAsignaturas.length})</option>
              {rankingAsignaturas.map(a => (
                <option key={a.asignatura} value={a.asignatura}>
                  {a.asignatura} ({a.falladas} fallos)
                </option>
              ))}
            </select>
          </div>

          {/* Toggle Solo Falladas */}
          <div className="flex items-center">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={soloConFallos}
                onChange={(e) => setSoloConFallos(e.target.checked)}
                className="rounded text-orange-600 focus:ring-orange-500 h-4 w-4"
              />
              <span>Solo temas con fallos en Sims</span>
            </label>
          </div>

          {/* Acciones de Acordeón */}
          {vistaModo === 'asignaturas' && (
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={expandirTodas}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100"
              >
                Expandir todas
              </button>
              <span className="text-slate-300">•</span>
              <button
                onClick={colapsarTodas}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded-lg hover:bg-slate-100"
              >
                Colapsar todas
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── VISTA 1: Desgranado por Asignaturas ─── */}
      {vistaModo === 'asignaturas' && (
        <div className="space-y-4">
          {asignaturasFiltradas.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 text-slate-500">
              No se encontraron temas con los filtros aplicados.
            </div>
          ) : (
            asignaturasFiltradas.map((asigObj, asigIdx) => {
              const col = getEspecialidadColor(asigObj.asignatura);
              const isOpen = !!asignaturasAbiertas[asigObj.asignatura];
              const pctGlobal = asigObj.pct.toFixed(1);

              return (
                <div
                  key={asigObj.asignatura}
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs transition-all"
                >
                  {/* Encabezado Asignatura */}
                  <div
                    onClick={() => toggleAsignatura(asigObj.asignatura)}
                    className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
                    style={{ borderLeft: `6px solid ${col.border || col.bg}` }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-black text-slate-400 w-6">
                        #{asigIdx + 1}
                      </span>
                      <span
                        className="text-xs font-black px-3 py-1 rounded-full truncate"
                        style={{ color: col.text, background: col.bg, border: `1px solid ${col.border || col.bg}` }}
                      >
                        {asigObj.asignatura}
                      </span>
                      <span className="text-xs font-bold text-slate-500 hidden sm:inline">
                        {asigObj.temas.length} {asigObj.temas.length === 1 ? 'tema' : 'temas'}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 flex-none">
                      {/* Métricas clave de la Asignatura */}
                      <div className="text-right hidden sm:block">
                        <div className="text-xs font-bold text-slate-700">
                          {asigObj.totalPreg} preg. <span className="text-slate-400 font-normal">(MIR: {asigObj.mirPreg}, Sims: {asigObj.simPreg})</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500">
                          {pctGlobal}% acierto en Sims • <span className="text-red-500 font-bold">{asigObj.falladas} fallos</span>
                        </div>
                      </div>

                      <div className="text-right sm:hidden">
                        <div className="text-xs font-black text-red-500">
                          {asigObj.falladas} fallos
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {pctGlobal}% acierto
                        </div>
                      </div>

                      <span className="text-slate-400 text-xs w-5 text-center">
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>
                  </div>

                  {/* Lista de Temas Desgranados */}
                  {isOpen && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100 bg-slate-50/40">
                      {asigObj.temas.map((t, tidx) => {
                        const badgeCol = getBadgeColor(t.pctAcierto);
                        const aciertoStr = t.pctAcierto !== null ? `${t.pctAcierto.toFixed(1)}%` : 'Sin datos';

                        return (
                          <div
                            key={t.key}
                            className="p-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors"
                          >
                            {/* Orden y Nombre del Tema */}
                            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                              <span className="text-xs font-black text-slate-500 bg-slate-200/60 rounded-md w-7 h-7 flex items-center justify-center flex-none">
                                {tidx + 1}º
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm font-bold text-slate-900 truncate">
                                  {t.tema}
                                </div>
                                <div className="text-[11px] text-slate-500 font-medium flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                                  <span>Total: <strong className="text-slate-700">{t.totalCount}</strong> preg</span>
                                  <span className="text-slate-300">•</span>
                                  <span>MIR recientes: <strong className="text-slate-700">{t.mirCount}</strong></span>
                                  <span className="text-slate-300">•</span>
                                  <span>Simulacros 9-18: <strong className="text-slate-700">{t.simCount}</strong></span>
                                </div>
                              </div>
                            </div>

                            {/* Estadísticas de Rendimiento y Botón de Acción */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 flex-none pl-10 sm:pl-0">
                              {/* Pill Acierto */}
                              <div
                                className="px-2.5 py-1 rounded-lg text-xs font-black border flex items-center gap-1.5"
                                style={{ backgroundColor: badgeCol.bg, color: badgeCol.text, borderColor: badgeCol.border }}
                              >
                                <span>{aciertoStr}</span>
                                <span className="text-[10px] font-semibold opacity-80">
                                  ({t.userAcertadas}A / {t.userFalladas}F)
                                </span>
                              </div>

                              {/* Netas perdidas */}
                              {t.userFalladas > 0 && (
                                <div className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-md hidden md:block">
                                  -{t.netasPerdidas.toFixed(1)} netas
                                </div>
                              )}

                              {/* Botón Ver Preguntas */}
                              <button
                                onClick={() => setTemaSeleccionado({ asignatura: t.asignatura, tema: t.tema, stats: t })}
                                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 shadow-xs"
                              >
                                <span>📖</span>
                                <span>Ver preguntas ({t.totalCount})</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── VISTA 2: Ranking Global de Temas ─── */}
      {vistaModo === 'global' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs divide-y divide-slate-100">
          <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
            <div className="col-span-1">#</div>
            <div className="col-span-5 sm:col-span-4">Tema y Asignatura</div>
            <div className="col-span-2 text-center hidden sm:block">Preguntas</div>
            <div className="col-span-3 sm:col-span-2 text-center">Tus Sims</div>
            <div className="col-span-3 text-right">Acción</div>
          </div>

          {temasGlobalFiltrados.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              No se encontraron temas con los filtros aplicados.
            </div>
          ) : (
            temasGlobalFiltrados.map((t, idx) => {
              const col = getEspecialidadColor(t.asignatura);
              const badgeCol = getBadgeColor(t.pctAcierto);
              const aciertoStr = t.pctAcierto !== null ? `${t.pctAcierto.toFixed(1)}%` : 'Sin datos';

              return (
                <div
                  key={t.key}
                  className="p-4 grid grid-cols-12 gap-2 items-center hover:bg-slate-50/70 transition-colors"
                >
                  <div className="col-span-1 font-black text-slate-400 text-xs">
                    #{idx + 1}
                  </div>
                  <div className="col-span-5 sm:col-span-4 min-w-0 pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full truncate"
                        style={{ color: col.text, background: col.bg, border: `1px solid ${col.border || col.bg}` }}
                      >
                        {t.asignatura}
                      </span>
                    </div>
                    <div className="text-sm font-bold text-slate-900 truncate">
                      {t.tema}
                    </div>
                  </div>
                  <div className="col-span-2 text-center text-xs hidden sm:block">
                    <div className="font-bold text-slate-800">{t.totalCount} total</div>
                    <div className="text-[10px] text-slate-400">MIR: {t.mirCount} • Sims: {t.simCount}</div>
                  </div>
                  <div className="col-span-3 sm:col-span-2 text-center">
                    <span
                      className="px-2 py-1 rounded-md text-xs font-black inline-block border"
                      style={{ backgroundColor: badgeCol.bg, color: badgeCol.text, borderColor: badgeCol.border }}
                    >
                      {aciertoStr}
                    </span>
                    <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
                      {t.userFalladas} fallos / {t.userTotal} preg
                    </div>
                  </div>
                  <div className="col-span-3 text-right">
                    <button
                      onClick={() => setTemaSeleccionado({ asignatura: t.asignatura, tema: t.tema, stats: t })}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all inline-flex items-center gap-1.5 hover:scale-105 shadow-xs"
                    >
                      <span>Ver</span>
                      <span className="hidden sm:inline">preguntas</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── MODAL / VISOR DE PREGUNTAS DEL TEMA (TIPO TEXTO PARA COPIARLO) ─── */}
      {temaSeleccionado && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fade-in">
          <div className="bg-white w-full max-w-5xl h-[92vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Cabecera del Visor */}
            <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex-none">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span
                      className="text-xs font-black px-2.5 py-0.5 rounded-full"
                      style={{
                        ...getEspecialidadColor(temaSeleccionado.asignatura)
                      }}
                    >
                      {temaSeleccionado.asignatura}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      Tema Prioritario
                    </span>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                    {temaSeleccionado.tema}
                  </h2>
                </div>

                <div className="flex items-center gap-2 flex-none">
                  {/* Botón Copiar Todo */}
                  <button
                    onClick={() => handleCopiarTexto(textoPlanoDocumento, 'global')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-xs ${
                      copiadoGlobal
                        ? 'bg-emerald-600 text-white'
                        : 'bg-orange-500 text-white hover:bg-orange-600'
                    }`}
                    title="Copia todas las preguntas del tema en formato texto limpio"
                  >
                    <span>{copiadoGlobal ? '✓' : '📋'}</span>
                    <span>{copiadoGlobal ? '¡Copiado!' : 'Copiar todas las preguntas'}</span>
                  </button>

                  {/* Cerrar */}
                  <button
                    onClick={() => setTemaSeleccionado(null)}
                    className="w-9 h-9 rounded-full bg-slate-200/70 hover:bg-slate-300 text-slate-700 flex items-center justify-center text-lg font-bold transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Barra de Filtros de Preguntas */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 bg-slate-200/60 p-1 rounded-xl text-xs font-bold overflow-x-auto">
                  <button
                    onClick={() => setFiltroPreguntas('todas')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filtroPreguntas === 'todas' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todas ({preguntasData.todas.length})
                  </button>
                  <button
                    onClick={() => setFiltroPreguntas('falladas')}
                    className={`px-3 py-1.5 rounded-lg transition-all text-red-600 flex items-center gap-1 ${
                      filtroPreguntas === 'falladas' ? 'bg-white shadow-xs font-black' : 'hover:text-red-700'
                    }`}
                  >
                    <span>❌</span>
                    <span>Falladas en Sims ({preguntasData.simQuestions.filter(q => q.fallada).length})</span>
                  </button>
                  <button
                    onClick={() => setFiltroPreguntas('simulacros')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filtroPreguntas === 'simulacros' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Simulacros ({preguntasData.simQuestions.length})
                  </button>
                  <button
                    onClick={() => setFiltroPreguntas('mir')}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      filtroPreguntas === 'mir' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Desgloses MIR ({preguntasData.mirQuestions.length})
                  </button>
                </div>

                {/* Alternador Modo Texto Plano vs Tarjetas */}
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200/80 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={!soloRecientes}
                      onChange={(e) => setSoloRecientes(!e.target.checked)}
                      className="rounded text-orange-600 focus:ring-orange-500 h-3.5 w-3.5"
                    />
                    <span>Histórico completo (MIR 2010-2026 y Sims 1-18)</span>
                  </label>

                  <div className="h-4 w-px bg-slate-300" />

                  <button
                    onClick={() => setModoTextoPlano(!modoTextoPlano)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      modoTextoPlano
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    <span>📝</span>
                    <span>{modoTextoPlano ? 'Vista Tarjetas' : 'Modo Texto Plano'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Contenido: Lista de Preguntas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-100/50">
              {preguntasMostradas.length === 0 ? (
                <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
                  No hay preguntas con los filtros seleccionados.
                </div>
              ) : modoTextoPlano ? (
                /* ─── MODO TEXTO PLANO (CONTINUO, SELECCIONABLE CON CURSOR) ─── */
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs">
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-500">
                      Texto plano listo para seleccionar (Ctrl+A / Cmd+A) o copiar:
                    </span>
                    <button
                      onClick={() => handleCopiarTexto(textoPlanoDocumento, 'doc')}
                      className="text-xs font-black text-orange-600 hover:text-orange-700 flex items-center gap-1"
                    >
                      <span>{copiadoId === 'doc' ? '✓ ¡Copiado!' : '📋 Copiar todo el texto'}</span>
                    </button>
                  </div>
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed select-text bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto">
                    {textoPlanoDocumento}
                  </pre>
                </div>
              ) : (
                /* ─── MODO TARJETAS VISUALES CON COPIADO INDIVIDUAL ─── */
                <div className="space-y-4 max-w-4xl mx-auto">
                  {preguntasMostradas.map((q, qidx) => {
                    const textContent = formatQuestionAsText(q);
                    const isCopied = copiadoId === q.id;

                    return (
                      <div
                        key={q.id || `${q.origen}-${qidx}`}
                        className={`bg-white rounded-2xl border p-5 shadow-xs transition-all select-text ${
                          q.fallada
                            ? 'border-red-200 ring-2 ring-red-100'
                            : q.acertada
                            ? 'border-emerald-200'
                            : 'border-slate-200'
                        }`}
                      >
                        {/* Cabecera de la Pregunta */}
                        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                              {q.tipo === 'simulacro' ? `Simulacro ${q.simulacro} • Pregunta ${q.numero}` : q.convocatoria}
                            </span>

                            {q.tipo === 'simulacro' && (
                              <span
                                className={`text-xs font-black px-2 py-0.5 rounded-md ${
                                  q.acertada
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : q.fallada
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {q.acertada
                                  ? `✓ Acertaste (Opción ${q.respuestaDada})`
                                  : q.fallada
                                  ? `✗ Fallaste (Marcaste ${q.respuestaDada}, correcta ${q.respuestaCorrecta})`
                                  : `⚪ Dejada en blanco (Correcta ${q.respuestaCorrecta})`}
                              </span>
                            )}

                            {q.dificultad && (
                              <span className="text-[11px] font-semibold text-slate-400">
                                Dificultad {q.dificultad}/5
                              </span>
                            )}
                          </div>

                          {/* Botón Copiar Pregunta */}
                          <button
                            onClick={() => handleCopiarTexto(textContent, q.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 select-none ${
                              isCopied
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                            }`}
                            title="Copiar esta pregunta al portapapeles"
                          >
                            <span>{isCopied ? '✓' : '📋'}</span>
                            <span>{isCopied ? '¡Copiada!' : 'Copiar'}</span>
                          </button>
                        </div>

                        {/* Enunciado */}
                        <div className="text-sm font-semibold text-slate-900 leading-relaxed mb-4 select-text">
                          {q.enunciado ? q.enunciado.replace(/<[^>]+>/g, '').trim() : 'Enunciado no disponible'}
                        </div>

                        {/* Imagen asociada si existe */}
                        {q.imagen && (
                          <div className="mb-4">
                            <ClinicalImage
                              src={q.imagen}
                              alt={`Imagen vinculada a ${q.origen}`}
                              className="!my-0 !items-start"
                            />
                          </div>
                        )}

                        {/* Opciones */}
                        <div className="space-y-1.5 mb-4 select-text">
                          {q.respuestas && q.respuestas.length > 0 ? (
                            q.respuestas.map((r) => {
                              const isCorrect = r.numero === q.respuestaCorrecta || r.correcta;
                              const isUserChoice = q.tipo === 'simulacro' && r.numero === q.respuestaDada;

                              let optClass = 'bg-slate-50/70 border-slate-200 text-slate-700';
                              if (isCorrect) {
                                optClass = 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold';
                              } else if (isUserChoice && q.fallada) {
                                optClass = 'bg-red-50 border-red-300 text-red-900 font-bold';
                              }

                              return (
                                <div
                                  key={r.numero}
                                  className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 ${optClass}`}
                                >
                                  <span className="font-mono font-bold flex-none w-5">
                                    {r.numero}.
                                  </span>
                                  <span className="flex-1">{r.enunciado}</span>
                                  {isCorrect && (
                                    <span className="text-emerald-600 font-black text-xs flex-none">
                                      ✓ Correcta
                                    </span>
                                  )}
                                  {isUserChoice && q.fallada && (
                                    <span className="text-red-600 font-black text-xs flex-none">
                                      ✗ Tu respuesta
                                    </span>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div className="text-xs text-slate-400 italic">
                              Respuesta correcta: Opción {q.respuestaCorrecta}
                            </div>
                          )}
                        </div>

                        {/* Comentario / Explicación */}
                        {q.comentario && (
                          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed select-text">
                            <div className="font-black text-slate-900 mb-1 flex items-center gap-1">
                              <span>💡</span>
                              <span>Explicación / Comentario:</span>
                            </div>
                            <div
                              dangerouslySetInnerHTML={{
                                __html: q.comentario
                              }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
