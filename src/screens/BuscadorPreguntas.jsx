import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { getCatalogoCompletoAsync, getCatalogoSync, buscarPreguntasEnCatalogo, stripAccents } from '../lib/buscadorCatalogo'
import { usePreguntasStats } from '../hooks/usePreguntasStats'
import { getSimulacroImageUrl } from '../lib/simulacros'
import NotaPersonal from '../components/quiz/NotaPersonal'

const QUICK_SEARCH_CHIPS = [
  'Löfgren',
  'Condroblastoma',
  'Silicosis',
  'Deferasirox',
  'WPW',
  'Balthazar',
  'Whipple',
  'Barker',
  'Porfiria',
  'SCASEST',
  'Endocarditis Dukes',
  'Glomerulonefritis'
]

function highlightText(text, query) {
  if (!query || !text) return text
  const cleanQ = stripAccents(query).trim()
  if (cleanQ.length < 2) return text

  const tokens = cleanQ.split(/\s+/).filter(t => t.length >= 2)
  if (tokens.length === 0) return text

  try {
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    const regex = new RegExp(`(${escaped})`, 'gi')
    const parts = text.split(regex)
    if (parts.length <= 1) return text

    return parts.map((part, i) => {
      const partClean = stripAccents(part)
      const isMatch = tokens.includes(partClean)
      if (isMatch) {
        return (
          <mark key={i} className="bg-amber-200 text-amber-950 px-1 py-0.5 rounded font-bold">
            {part}
          </mark>
        )
      }
      return part
    })
  } catch (e) {
    return text
  }
}

export default function BuscadorPreguntas({ setTab, setBancoFiltros }) {
  const { stats, getStatsPregunta, guardarNota } = usePreguntasStats()

  // Carga asíncrona del catálogo para evitar bloquear la interfaz
  const [catalogo, setCatalogo] = useState(() => getCatalogoSync() || [])
  const [loadingCatalogo, setLoadingCatalogo] = useState(() => !getCatalogoSync())

  useEffect(() => {
    if (catalogo.length === 0) {
      let isMounted = true
      getCatalogoCompletoAsync().then((cat) => {
        if (isMounted) {
          setCatalogo(cat)
          setLoadingCatalogo(false)
        }
      }).catch((err) => {
        console.error('Error cargando catálogo de preguntas:', err)
        if (isMounted) setLoadingCatalogo(false)
      })
      return () => { isMounted = false }
    }
  }, [catalogo.length])

  // Estados de búsqueda y debounce para fluidez a 60fps al teclear
  const [inputValue, setInputValue] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue)
    }, 180)
    return () => clearTimeout(timer)
  }, [inputValue])

  // Filtros facetados
  const [tipoFiltro, setTipoFiltro] = useState('todos') // 'todos', 'desgloses', 'simulacros'
  const [simulacroNum, setSimulacroNum] = useState('')
  const [asignatura, setAsignatura] = useState('')
  const [tema, setTema] = useState('')
  const [estadoHistorial, setEstadoHistorial] = useState('todos') // 'todos', 'falladas', 'dudosas', 'acertadas', 'no_vistas'
  const [dificultades, setDificultades] = useState([])
  const [showFiltrosAvanzados, setShowFiltrosAvanzados] = useState(false)

  // Paginación y expansión
  const [limit, setLimit] = useState(30)
  const [expandedCardId, setExpandedCardId] = useState(null)
  const [copiadoId, setCopiadoId] = useState(null)
  const [practicaRespuesta, setPracticaRespuesta] = useState({})

  // Asignaturas disponibles calculadas de forma memorizada
  const asignaturasDisponibles = useMemo(() => {
    if (!catalogo || catalogo.length === 0) return []
    const asigMap = new Map()
    for (let i = 0; i < catalogo.length; i++) {
      const q = catalogo[i]
      if (q.asignatura) {
        asigMap.set(q.asignatura, (asigMap.get(q.asignatura) || 0) + 1)
      }
    }
    return [...asigMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ name, count }))
  }, [catalogo])

  // Temas disponibles para la asignatura seleccionada
  const temasDisponibles = useMemo(() => {
    if (!asignatura || !catalogo) return []
    const temaMap = new Map()
    for (let i = 0; i < catalogo.length; i++) {
      const q = catalogo[i]
      if (q.asignatura === asignatura && q.tema) {
        temaMap.set(q.tema, (temaMap.get(q.tema) || 0) + 1)
      }
    }
    return [...temaMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }))
  }, [catalogo, asignatura])

  // Búsqueda ultrarrápida reactiva a debouncedQuery y filtros
  const resultados = useMemo(() => {
    if (!catalogo || catalogo.length === 0) return []
    return buscarPreguntasEnCatalogo(
      catalogo,
      debouncedQuery,
      {
        tipo: tipoFiltro,
        simulacroNum: simulacroNum ? parseInt(simulacroNum, 10) : null,
        asignatura,
        tema,
        dificultad: dificultades,
        estadoHistorial
      },
      stats
    )
  }, [catalogo, debouncedQuery, tipoFiltro, simulacroNum, asignatura, tema, dificultades, estadoHistorial, stats])

  const handleInputChange = (val) => {
    setInputValue(val)
    setLimit(30)
  }

  const handleChipClick = (chip) => {
    setInputValue(chip)
    setDebouncedQuery(chip)
    setLimit(30)
  }

  const handleLimpiarFiltros = () => {
    setInputValue('')
    setDebouncedQuery('')
    setTipoFiltro('todos')
    setSimulacroNum('')
    setAsignatura('')
    setTema('')
    setEstadoHistorial('todos')
    setDificultades([])
    setLimit(30)
  }

  const toggleDificultad = (d) => {
    setDificultades(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    )
    setLimit(30)
  }

  const toggleExpand = (id) => {
    setExpandedCardId(prev => (prev === id ? null : id))
  }

  const handleCopiarTexto = async (q, e) => {
    e.stopPropagation()
    const optsStr = q.opciones.map(o => `${o.id}) ${o.text}`).join('\n')
    const fullText = `[${q.origenLabel} · ${q.asignatura}]\n${q.enunciadoLimpio}\n\n${optsStr}\n\nRespuesta correcta: ${q.correctOptionLetter}\n\nExplicación:\n${q.comentarioLimpio}`

    try {
      await navigator.clipboard.writeText(fullText)
      setCopiadoId(q.id)
      setTimeout(() => setCopiadoId(null), 2000)
    } catch (err) {
      console.warn('Error al copiar:', err)
    }
  }

  const handleElegirOpcionPractica = (qId, letra) => {
    setPracticaRespuesta(prev => ({
      ...prev,
      [qId]: letra
    }))
  }

  const resultadosVisibles = resultados.slice(0, limit)

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-16 px-2 sm:px-4">
      {/* CABECERA */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <span className="p-2 bg-amber-100 text-amber-800 rounded-2xl text-2xl">🔍</span>
              <span>Buscador Universal de Preguntas</span>
            </h1>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {loadingCatalogo ? (
                <span className="text-amber-600 font-semibold animate-pulse">
                  Indexando ~7.500 preguntas oficiales MIR y simulacros CTO...
                </span>
              ) : (
                <>
                  Explora y localiza al instante entre <strong>{catalogo.length.toLocaleString()} preguntas</strong> de Desgloses Oficiales MIR y Simulacros CTO.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!loadingCatalogo && (
              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-full font-bold border border-slate-200">
                {resultados.length.toLocaleString()} encontradas
              </span>
            )}
            {(inputValue || tipoFiltro !== 'todos' || asignatura || tema || estadoHistorial !== 'todos' || dificultades.length > 0) && (
              <button
                onClick={handleLimpiarFiltros}
                className="text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-full font-bold transition-colors border border-red-200"
              >
                Limpiar filtros ✕
              </button>
            )}
          </div>
        </div>

        {/* BARRA DE BÚSQUEDA PRINCIPAL */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 text-lg">
            🔍
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            disabled={loadingCatalogo}
            placeholder={loadingCatalogo ? 'Cargando preguntas...' : "Busca por síntoma, enfermedad, fármaco, regla, autor, año (ej. '2023') o simulacro (ej. 'sim 14')..."}
            className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border-2 border-slate-200 hover:border-slate-300 focus:border-amber-500 focus:bg-white rounded-2xl text-base text-slate-900 font-medium placeholder-slate-400 outline-none transition-all shadow-inner disabled:opacity-60"
          />
          {inputValue && (
            <button
              onClick={() => handleInputChange('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 font-bold text-lg"
            >
              ✕
            </button>
          )}
        </div>

        {/* CHIPS DE BÚSQUEDA RÁPIDA */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Frecuentes:
          </span>
          {QUICK_SEARCH_CHIPS.map(chip => (
            <button
              key={chip}
              disabled={loadingCatalogo}
              onClick={() => handleChipClick(chip)}
              className={`px-2.5 py-1 rounded-full font-semibold shrink-0 transition-colors border ${
                inputValue.toLowerCase() === chip.toLowerCase()
                  ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-900 disabled:opacity-50'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* FILTROS FACETADOS PRINCIPALES */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
          {/* Selector de Tipo (Pestañas) */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl text-xs font-bold border border-slate-200">
            <button
              onClick={() => { setTipoFiltro('todos'); setLimit(30); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tipoFiltro === 'todos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todas ({catalogo.length ? catalogo.length.toLocaleString() : '...'})
            </button>
            <button
              onClick={() => { setTipoFiltro('desgloses'); setLimit(30); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tipoFiltro === 'desgloses' ? 'bg-cyan-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 Desgloses MIR (3.535)
            </button>
            <button
              onClick={() => { setTipoFiltro('simulacros'); setLimit(30); }}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                tipoFiltro === 'simulacros' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🧪 Simulacros CTO (3.990)
            </button>
          </div>

          {/* Subfiltro de número de simulacro si está en simulacros */}
          {tipoFiltro === 'simulacros' && (
            <select
              value={simulacroNum}
              onChange={(e) => { setSimulacroNum(e.target.value); setLimit(30); }}
              className="text-xs font-bold bg-purple-50 text-purple-900 border border-purple-200 rounded-xl px-3 py-1.5 outline-none focus:ring-2 focus:ring-purple-400"
            >
              <option value="">Todos los simulacros (1..19)</option>
              {Array.from({ length: 19 }, (_, i) => i + 1).map(num => (
                <option key={num} value={num}>Simulacro {num}</option>
              ))}
            </select>
          )}

          {/* Filtro por Historial del Alumno */}
          <select
            value={estadoHistorial}
            onChange={(e) => { setEstadoHistorial(e.target.value); setLimit(30); }}
            className={`text-xs font-bold rounded-xl px-3 py-1.5 border outline-none transition-colors ${
              estadoHistorial !== 'todos'
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-slate-50 text-slate-700 border-slate-200'
            }`}
          >
            <option value="todos">📊 Historial: Todas</option>
            <option value="falladas">❌ Mis Falladas (en app o simulacros)</option>
            <option value="dudosas">⚠️ Mis Dudosas</option>
            <option value="acertadas">✅ Mis Acertadas</option>
            <option value="no_vistas">🆕 No vistas / Sin resolver</option>
          </select>

          {/* Botón para expandir filtros secundarios */}
          <button
            onClick={() => setShowFiltrosAvanzados(prev => !prev)}
            className={`text-xs font-bold px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors ml-auto ${
              showFiltrosAvanzados || asignatura || tema || dificultades.length > 0
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>⚙️ Asignatura / Nivel</span>
            <span>{showFiltrosAvanzados ? '▲' : '▼'}</span>
          </button>
        </div>

        {/* PANEL DE FILTROS AVANZADOS (Desplegable) */}
        {showFiltrosAvanzados && (
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-4 animate-in slide-in-from-top-2 fade-in duration-200">
            {/* Asignatura */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Asignatura
              </label>
              <select
                value={asignatura}
                onChange={(e) => {
                  setAsignatura(e.target.value)
                  setTema('')
                  setLimit(30)
                }}
                className="w-full text-xs font-semibold p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 focus:border-amber-500 outline-none"
              >
                <option value="">Todas las asignaturas</option>
                {asignaturasDisponibles.map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name} ({a.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Tema */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Tema {asignatura ? `(${temasDisponibles.length} disponibles)` : ''}
              </label>
              <select
                value={tema}
                onChange={(e) => { setTema(e.target.value); setLimit(30); }}
                disabled={!asignatura}
                className="w-full text-xs font-semibold p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 disabled:opacity-50 disabled:bg-slate-100 focus:border-amber-500 outline-none"
              >
                <option value="">{asignatura ? 'Todos los temas' : 'Elige primero una asignatura'}</option>
                {temasDisponibles.map(t => (
                  <option key={t.name} value={t.name}>
                    {t.name} ({t.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Dificultad */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Dificultad MIR
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5].map(d => (
                  <button
                    key={d}
                    onClick={() => toggleDificultad(d)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      dificultades.includes(d)
                        ? 'bg-amber-500 text-white border-amber-500 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Nivel {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SKELETON LOADER SI EL CATÁLOGO ESTÁ CARGANDO */}
      {loadingCatalogo ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6 animate-pulse space-y-4">
              <div className="flex gap-2">
                <div className="h-6 w-28 bg-slate-200 rounded-md" />
                <div className="h-6 w-24 bg-slate-100 rounded-md" />
                <div className="h-6 w-20 bg-slate-100 rounded-md" />
              </div>
              <div className="h-4 bg-slate-200 rounded w-11/12" />
              <div className="h-4 bg-slate-100 rounded w-4/5" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : resultados.length === 0 ? (
        /* SIN RESULTADOS */
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">No se encontraron preguntas</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
            Prueba a simplificar los términos de búsqueda o a desactivar alguno de los filtros aplicados.
          </p>
          <button
            onClick={handleLimpiarFiltros}
            className="text-xs bg-slate-900 text-white font-bold px-4 py-2 rounded-xl hover:bg-slate-800 transition-colors"
          >
            Restablecer todos los filtros
          </button>
        </div>
      ) : (
        /* LISTADO DE RESULTADOS */
        <div className="space-y-4">
          {resultadosVisibles.map((q) => {
            const isExpanded = expandedCardId === q.id
            const userStat = stats[q.id] || (q.simulacro && q.numero ? stats[`${q.simulacro}-${q.numero}`] : null)
            const fueFallada = q.cto_fallada || (userStat?.fallos > 0)
            const fueDudosa = q.cto_dudosa || userStat?.dudosa
            const fueAcertada = (!fueFallada && q.cto_acertada) || ((userStat?.aciertos || 0) > 0 && (userStat?.fallos || 0) === 0)
            const respuestaPracticada = practicaRespuesta[q.id]

            return (
              <div
                key={q.id}
                className={`bg-white rounded-2xl border transition-all duration-200 shadow-xs overflow-hidden ${
                  isExpanded ? 'border-amber-400 ring-2 ring-amber-100 shadow-md' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* CABECERA DE LA PREGUNTA */}
                <div
                  onClick={() => toggleExpand(q.id)}
                  className="p-5 cursor-pointer bg-white hover:bg-slate-50/60 transition-colors flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                    <div className="flex items-center gap-2 flex-wrap font-bold">
                      {/* Badge de Origen */}
                      <span
                        className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wide border ${
                          q.tipo === 'desglose'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : 'bg-purple-50 text-purple-800 border-purple-200'
                        }`}
                      >
                        {q.origenLabel}
                      </span>

                      {/* Asignatura y Tema */}
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                        {q.asignatura}
                      </span>
                      {q.tema && (
                        <span className="text-slate-400 font-medium">
                          › <span className="text-slate-600 font-semibold">{q.tema}</span>
                        </span>
                      )}

                      {/* Dificultad */}
                      <span className="text-amber-600 font-bold ml-1">
                        {'★'.repeat(Math.min(5, q.dificultad || 3))}
                        <span className="text-slate-200">{'★'.repeat(5 - Math.min(5, q.dificultad || 3))}</span>
                      </span>
                    </div>

                    {/* Insignias de Historial del Alumno */}
                    <div className="flex items-center gap-2">
                      {fueFallada && (
                        <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold border border-red-200 flex items-center gap-1">
                          <span>❌</span> Fallada previamente
                        </span>
                      )}
                      {fueDudosa && !fueFallada && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold border border-amber-200 flex items-center gap-1">
                          <span>⚠️</span> Dudosa
                        </span>
                      )}
                      {fueAcertada && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold border border-emerald-200 flex items-center gap-1">
                          <span>✓</span> Acertada
                        </span>
                      )}
                      {q.cto_pct_correcta && (
                        <span className="text-[11px] font-medium text-slate-400 hidden sm:inline-block">
                          👥 {q.cto_pct_correcta} alumnos acertaron
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Enunciado con palabras clave resaltadas */}
                  <div className="text-slate-900 font-medium text-sm leading-relaxed text-left">
                    {highlightText(q.enunciadoLimpio, debouncedQuery)}
                  </div>

                  {/* Botones de acción rápida al pie de la tarjeta */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 text-slate-500">
                    <span className="font-semibold text-slate-400">
                      {q.opciones?.length || 4} opciones · Respuesta correcta:{' '}
                      <strong className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-mono">
                        {q.correctOptionLetter}
                      </strong>
                    </span>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => handleCopiarTexto(q, e)}
                        className="px-2.5 py-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium transition-colors"
                        title="Copiar pregunta completa al portapapeles"
                      >
                        {copiadoId === q.id ? '✓ Copiado' : '📋 Copiar'}
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleExpand(q.id)}
                        className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold transition-all shadow-2xs"
                      >
                        {isExpanded ? 'Ocultar ▲' : 'Ver detalle y opciones ▼'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* VISTA EXPANDIDA: OPCIONES, EXPLICACIÓN, NOTAS Y PRÁCTICA */}
                {isExpanded && (
                  <div className="p-6 bg-slate-50/70 border-t border-slate-200 space-y-5 animate-in slide-in-from-top-1 fade-in duration-150">
                    {/* Imagen asociada si existe */}
                    {q.imagen_nombre && (
                      <div className="bg-white p-3 rounded-xl border border-slate-200 max-w-md">
                        <span className="text-[11px] font-bold uppercase text-slate-400 block mb-2">
                          📷 Imagen vinculada al caso
                        </span>
                        <img
                          src={getSimulacroImageUrl(q.imagen_nombre)}
                          alt="Caso clínico"
                          className="max-h-64 rounded-lg object-contain mx-auto"
                          onError={(e) => {
                            e.target.style.display = 'none'
                          }}
                        />
                      </div>
                    )}

                    {/* Lista de Opciones */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Opciones de Respuesta (puedes pulsar para practicar)
                        </span>
                        {q.cto_respuesta_dada && (
                          <span className="text-xs font-semibold text-slate-500">
                            En el simulacro marcaste la opción <strong>{['A', 'B', 'C', 'D', 'E'][q.cto_respuesta_dada - 1] || q.cto_respuesta_dada}</strong>
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        {q.opciones.map((opt) => {
                          const isCorrect = opt.correcta
                          const isSelectedInSim = q.cto_respuesta_dada && opt.numero === q.cto_respuesta_dada
                          const isSelectedInPractice = respuestaPracticada === opt.id

                          let bgClass = 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          if (isCorrect) {
                            bgClass = 'bg-emerald-50 border-emerald-400 text-emerald-900 font-semibold ring-1 ring-emerald-300'
                          } else if (isSelectedInPractice) {
                            bgClass = 'bg-red-50 border-red-300 text-red-900 ring-1 ring-red-300'
                          } else if (isSelectedInSim) {
                            bgClass = 'bg-red-50/70 border-red-200 text-red-900'
                          }

                          return (
                            <div
                              key={opt.id}
                              onClick={() => handleElegirOpcionPractica(q.id, opt.id)}
                              className={`p-3.5 rounded-xl border flex items-start gap-3 text-sm leading-relaxed cursor-pointer transition-all ${bgClass}`}
                            >
                              <span
                                className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                  isCorrect
                                    ? 'bg-emerald-500 text-white'
                                    : isSelectedInPractice || isSelectedInSim
                                    ? 'bg-red-500 text-white'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {opt.id}
                              </span>
                              <div className="flex-1">
                                {highlightText(opt.text, debouncedQuery)}
                              </div>
                              {isCorrect && (
                                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                                  ✓ Correcta
                                </span>
                              )}
                              {isSelectedInPractice && !isCorrect && (
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                                  Has marcado esta ✗
                                </span>
                              )}
                              {isSelectedInSim && !isCorrect && !isSelectedInPractice && (
                                <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                                  Marcaste en examen ✗
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Explicación Oficial de CTO */}
                    {q.comentario && (
                      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-2xs">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                          <span>💡</span> Explicación Oficial
                        </div>
                        <div
                          className="comentario-html text-base sm:text-[17px] text-slate-800 leading-relaxed text-left"
                          dangerouslySetInnerHTML={{ __html: q.comentario }}
                        />
                      </div>
                    )}

                    {/* Editor de Nota Personal */}
                    <NotaPersonal
                      preguntaId={q.id}
                      nota={getStatsPregunta(q.id)?.nota || ''}
                      onGuardar={guardarNota}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* BOTÓN CARGAR MÁS */}
          {limit < resultados.length && (
            <div className="text-center pt-4">
              <button
                onClick={() => setLimit(prev => prev + 30)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold px-8 py-3.5 rounded-2xl shadow-sm transition-all hover:scale-105 active:scale-95"
              >
                Cargar 30 preguntas más ({resultados.length - limit} restantes)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
