import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { getOrCreateAnonUserId, createQuizResult, enqueueQuestionStat, flushOfflineSyncQueue } from '../utils/quizSync';
import { construirPayloadTirada, guardarTiradaParaChat, descargarTiradaJSON, copiarTiradaAlPortapapeles } from '../utils/tiradaStorage';
import { getPreguntas, attachTextoToPregunta, ASIGNATURA_NOMBRE } from '../lib/simulacros';
import { normText, normalizeAsignaturaToDesgloses, getAnalisisPrioridadesTemas, getRankingTemasDeAsignatura } from '../lib/prioridadesTemas';
import desglosesData from '../data/desgloses_filtrables.json';
import evaluacionesData from '../data/evaluaciones_cto.json';
import bancoPreguntasData from '../data/bancoPreguntas.json';
import planDetalladoData from '../data/planDiarioDetallado.json';
import QuestionCard from '../components/quiz/QuestionCard';
import NotaPersonal from '../components/quiz/NotaPersonal';
import TutorGemini from '../components/quiz/TutorGemini';
import SyncStatusBanner from '../components/quiz/SyncStatusBanner';

const getSessionData = (key, defaultVal) => {
  try {
    const saved = sessionStorage.getItem(`mir_desgloses_${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

export default function Desgloses() {
  const [quizFinished, setQuizFinished] = useState(false);
  const [syncState, setSyncState] = useState(null);
  const [chatExportStatus, setChatExportStatus] = useState(null);
  const [ultimaTiradaPayload, setUltimaTiradaPayload] = useState(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const { stats, isSyncing, registrarRespuesta, getStatsPregunta, guardarNota, archivarPregunta, isArchivada, isEnLatencia } = usePreguntasStats();

  // Modo Examen (por defecto activo: sin feedback inmediato, avanza directo y se corrige al final en el chat)
  const [modoExamen, setModoExamen] = useState(() => {
    try {
      const saved = localStorage.getItem('mir_desgloses_modo_examen');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mir_desgloses_modo_examen', String(modoExamen));
    } catch {}
  }, [modoExamen]);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Extract distinct subjects and topics
  const asignaturas = useMemo(() => {
    return [...new Set(desglosesData.map(q => q.asignatura))].filter(Boolean).sort();
  }, []);

  // Construir pool normalizado de preguntas de Simulacros CTO (con % acierto poblacional)
  const simulacrosPool = useMemo(() => {
    const raw = getPreguntas() || [];
    const out = [];
    raw.forEach(p => {
      if (p.nula === 1 || p.ignorar) return;
      const full = attachTextoToPregunta(p);
      const t = full?.texto;
      if (!t || !t.enunciado || !Array.isArray(t.respuestas) || t.respuestas.length === 0 || t.anulada) return;
      const clasif = p.clasificaciones || [];
      const rawAsig = ASIGNATURA_NOMBRE[p.asignatura] || clasif[0] || p.asignatura || 'Simulacros';
      const asig = normalizeAsignaturaToDesgloses(rawAsig);
      const tema = clasif[1] || '';
      const subtema = clasif[2] || '';
      const pctPob = p.pct_correcta ? Math.min(99, Math.round((p.pct_correcta / 3000) * 100)) : 50;
      const esFalladaOBlanca = p.fallada === 1 || (!p.acertada && !p.fallada);
      out.push({
        id: t.id || p.pregunta_id || `sim-${p.simulacro}-${p.numero}`,
        enunciado: t.enunciado,
        comentario: t.comentario || '',
        asignatura: asig,
        tema,
        subtema,
        dificultad: p.dificultad || t.dificultad || 3,
        anualidad: 2026,
        convocatoria: `Simulacro CTO ${p.simulacro} (P${p.numero} · ${pctPob}% pob)`,
        simulacro: p.simulacro,
        numeroSimulacro: p.numero,
        pctPob,
        cto_fallada: esFalladaOBlanca,
        cto_dudosa: p.dudas === 1,
        respuestas: [...t.respuestas].sort((a, b) => a.numero - b.numero).map(r => ({
          numero: r.numero,
          enunciado: r.enunciado,
          correcta: Boolean(r.correcta || r.numero == p.respuesta_correcta)
        })),
        imagen_nombre: t.imagen_nombre || null,
        esSimulacro: true
      });
    });
    return out;
  }, []);

  // Construir pool normalizado de Evaluaciones CTO realizadas en el Campus (1.409 preguntas)
  const evaluacionesPool = useMemo(() => {
    if (!Array.isArray(evaluacionesData)) return [];
    return evaluacionesData
      .filter(eq => eq.enunciado && Array.isArray(eq.opciones) && eq.opciones.length > 0)
      .map(eq => {
        const asig = normalizeAsignaturaToDesgloses(eq.asignatura);
        const pctPob = eq.pct_acierto_pob ?? 50;
        return {
          id: eq.id,
          enunciado: eq.enunciado,
          comentario: eq.explicacion || '',
          asignatura: asig,
          tema: eq.tema || 'General',
          subtema: eq.subtema || '',
          dificultad: eq.dificultad || 3,
          anualidad: 2026,
          convocatoria: `Evaluación CTO (${pctPob}% pob)`,
          pctPob,
          cto_fallada: Boolean(eq.fallada_o_blanca),
          respuestas: eq.opciones.map((o, idx) => ({
            numero: o.id || (idx + 1),
            enunciado: o.texto,
            correcta: (o.id || (idx + 1)) === eq.correcta
          })),
          imagen_nombre: eq.imagen || null,
          esEvaluacionCTO: true
        };
      });
  }, []);

  // Construir pool normalizado de Test de Clase 2ª Vuelta CTO (PDFs 2V: 2.097 preguntas + 153 imágenes)
  const test2VPool = useMemo(() => {
    if (!Array.isArray(bancoPreguntasData)) return [];
    return bancoPreguntasData
      .filter(bq => bq.vuelta === 2 && bq.enunciado && Array.isArray(bq.opciones) && bq.opciones.length === 4)
      .map(bq => {
        const asig = normalizeAsignaturaToDesgloses(bq.asignatura);
        return {
          id: bq.id,
          enunciado: bq.enunciado,
          comentario: bq.explicacion || '',
          asignatura: asig,
          tema: bq.tema || 'General',
          subtema: '',
          dificultad: 3,
          anualidad: 2026,
          convocatoria: `Test 2ª Vuelta CTO (${bq.codigo_cto || asig} · P${bq.numero})`,
          respuestas: bq.opciones.map((o, idx) => ({
            numero: o.id || (idx + 1),
            enunciado: o.texto,
            correcta: (o.id || (idx + 1)) === bq.correcta
          })),
          imagen_nombre: bq.imagen || null,
          esTest2V: true
        };
      });
  }, []);

  // Filter States
  const [filtros, setFiltros] = useState(() => {
    const defaultFiltros = {
      asignatura: '',
      temas: [],
      dificultad: [],
      minYear: 2015,
      soloNoHechas: true,
      soloFalladas: false,
      tamanoTirada: 75,
      rellenarHastaCupo: true,
      incluirTest2V: false
    };
    const saved = getSessionData('filtros', defaultFiltros);
    if (saved.tema !== undefined) {
      delete saved.tema;
      saved.temas = [];
    }
    if (saved.tamanoTirada === undefined || saved.tamanoTirada === 60 || saved.tamanoTirada === 45) {
      saved.tamanoTirada = 75;
    }
    if (saved.rellenarHastaCupo === undefined) saved.rellenarHastaCupo = true;
    if (saved.incluirTest2V === undefined) saved.incluirTest2V = false;
    return { ...defaultFiltros, ...saved };
  });

  const toggleTema = (t) => {
    setFiltros(prev => {
      const current = prev.temas || [];
      if (current.includes(t)) {
        return { ...prev, temas: current.filter(x => x !== t) };
      }
      return { ...prev, temas: [...current, t] };
    });
  };

  // Ranking de temas de la asignatura activa por prioridad (Peso MIR x Tasa de Fallo)
  const rankingTemasActual = useMemo(() => {
    if (!filtros.asignatura) return [];
    return getRankingTemasDeAsignatura(filtros.asignatura);
  }, [filtros.asignatura]);

  const mapaPrioridadTema = useMemo(() => {
    const map = new Map();
    rankingTemasActual.forEach((t, idx) => {
      const tier = idx < 3 ? 'P1' : (idx < 7 ? 'P2' : 'P3');
      map.set(normText(t.tema), { ...t, rank: idx + 1, tier });
    });
    return map;
  }, [rankingTemasActual]);

  const temasDisponibles = useMemo(() => {
    if (!filtros.asignatura) return [];
    const temasDesgloses = desglosesData
      .filter(q => q.asignatura === filtros.asignatura)
      .map(q => q.tema);
    const temas2V = test2VPool
      .filter(q => q.asignatura === filtros.asignatura)
      .map(q => q.tema);
    const unique = [...new Set([...temasDesgloses, ...temas2V])].filter(Boolean);
    // Ordenar primero por score de prioridad (P1 > P2 > P3)
    return unique.sort((a, b) => {
      const pa = mapaPrioridadTema.get(normText(a))?.score || 0;
      const pb = mapaPrioridadTema.get(normText(b))?.score || 0;
      if (pb !== pa) return pb - pa;
      return a.localeCompare(b);
    });
  }, [filtros.asignatura, mapaPrioridadTema, test2VPool]);

  const seleccionarTop3TemasP1 = () => {
    const top3 = temasDisponibles.slice(0, 3);
    setFiltros(prev => ({ ...prev, temas: top3 }));
  };

  // Queue State
  const [cola, setCola] = useState(() => getSessionData('cola', []));
  const [resumenCola, setResumenCola] = useState(() => getSessionData('resumenCola', null));
  const [currentIndex, setCurrentIndex] = useState(() => getSessionData('currentIndex', 0));
  
  // Feedback State map: { questionId: { isCorrect, selectedLetter, correctLetter, discardedOptions, discardedCorrect, confidence, seconds, skipped } }
  const [respuestasDesglose, setRespuestasDesglose] = useState(() => getSessionData('respuestas', {}));

  // Sync to sessionStorage on change
  useEffect(() => { sessionStorage.setItem('mir_desgloses_filtros', JSON.stringify(filtros)); }, [filtros]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_cola', JSON.stringify(cola)); }, [cola]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_resumenCola', JSON.stringify(resumenCola)); }, [resumenCola]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_currentIndex', JSON.stringify(currentIndex)); }, [currentIndex]);
  useEffect(() => { sessionStorage.setItem('mir_desgloses_respuestas', JSON.stringify(respuestasDesglose)); }, [respuestasDesglose]);

  const currentQuestionData = cola[currentIndex];
  const currentAnswer = currentQuestionData ? respuestasDesglose[currentQuestionData.id] : null;

  // Comprobar de forma exhaustiva si una pregunta ya fue contestada o archivada
  const isPreguntaHecha = useCallback((qId) => {
    const pStats = getStatsPregunta(qId);
    if (!pStats) return false;
    return (
      (pStats.vecesVistas > 0) ||
      (pStats.aciertos > 0) ||
      (pStats.fallos > 0) ||
      pStats.status === 'mastered' ||
      pStats.status === 'needs_review' ||
      pStats.status === 'corrected' ||
      pStats.status === 'archived' ||
      !!pStats.archivada ||
      !!pStats.ultimaFecha
    );
  }, [getStatsPregunta]);

  // Ordenar candidatos priorizando: no en latencia > auténticos desgloses MIR > falladas/prioridad alta > no hechas > año más reciente
  const ordenarCandidatas = useCallback((lista) => {
    return [...lista].sort((a, b) => {
      const latA = isEnLatencia ? isEnLatencia(a.id) : false;
      const latB = isEnLatencia ? isEnLatencia(b.id) : false;
      if (latA !== latB) return latA ? 1 : -1;

      // Priorizar Desgloses MIR oficiales sobre tests de 2V / simulacros
      const esMirA = !a.esTest2V && !a.esSimulacro && !a.esEvaluacionCTO;
      const esMirB = !b.esTest2V && !b.esSimulacro && !b.esEvaluacionCTO;
      if (esMirA !== esMirB) return esMirA ? -1 : 1;

      const stA = getStatsPregunta(a.id);
      const stB = getStatsPregunta(b.id);
      const prioA = stA?.puntuacionPrioridad ?? (stA ? 4 : 7); // No vista = prioridad 7
      const prioB = stB?.puntuacionPrioridad ?? (stB ? 4 : 7);
      if (prioA !== prioB) return prioB - prioA;

      return (b.anualidad || 2015) - (a.anualidad || 2015);
    });
  }, [getStatsPregunta, isEnLatencia]);

  // Utilidad para barajar una cola final sin regalar la respuesta por año/fuente
  const barajarCola = (arr) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const iniciarNuevaCola = (seleccion, resumen) => {
    setCola(seleccion);
    setResumenCola(resumen);
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
    setChatExportStatus(null);
    setUltimaTiradaPayload(null);
  };

  const matchTemaFlexible = (qTema, qSubtema, temasNormSet) => {
    if (!temasNormSet || temasNormSet.size === 0) return true;
    const nt = normText(qTema);
    const ns = normText(qSubtema);
    for (const target of temasNormSet) {
      if (!target) continue;
      if (nt === target || ns === target || (nt && nt.includes(target)) || (target && target.includes(nt) && nt.length > 4)) {
        return true;
      }
    }
    return false;
  };

  const getTodayPlanBlock = (tipo) => {
    try {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const tKey = `${year}-${month}-${day}`;
      const plan = planDetalladoData[tKey] || planDetalladoData['2026-11-03'] || null;
      if (!plan || !plan.bloques) return null;
      if (tipo === 'manana') {
        return plan.bloques.find(b => b.categoria === 'test' && (b.id.includes('m') || b.id.includes('1') || b.hora.includes('11:00'))) || null;
      }
      return plan.bloques.find(b => b.categoria === 'test' && (b.id.includes('t') || b.id.includes('2') || b.hora.includes('17:10'))) || null;
    } catch (e) {
      return null;
    }
  };

  /**
   * 🌅 SESIÓN 1 (MAÑANA · 11:00–13:00 · 75 PREGUNTAS POST-ESTUDIO)
   * 1) Desgloses MIR oficiales (2015-2025 primero, luego 2010-2014) de los temas estudiados + satélites
   * 2) Fallos de Simulacros (>=35% pob) y Evaluaciones CTO (>=40% pob) de esos temas
   * 3) Simulacros P80 y Reserva Test 2ª Vuelta hasta completar 75
   * Modo ciego en la prueba / Agrupado automáticamente por temas en la corrección
   */
  const lanzarMotor1Manana = useCallback(() => {
    const planBlock = getTodayPlanBlock('manana');
    const asig = planBlock?.asignatura || filtros.asignatura || asignaturas[0] || 'Digestivo';
    const planTemas = [
      ...(planBlock?.temasNucleares || []),
      ...(planBlock?.temasSatelite || [])
    ];
    const temasElegidos = (filtros.temas && filtros.temas.length > 0)
      ? filtros.temas
      : (planTemas.length > 0 ? planTemas : temasDisponibles.slice(0, 5));
    const temasNormSet = new Set(temasElegidos.map(normText));
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countFallosCTO = 0;
    let countMirTema = 0;
    let countP80Tema = 0;
    let countReserva2V = 0;

    const esDisponible = (q) => !isArchivada(q.id) && !usados.has(q.id) && !(isEnLatencia && isEnLatencia(q.id));

    // 1. Desgloses MIR oficiales de los temas seleccionados (no hechas primero)
    const mirTema = desglosesData.filter(q =>
      q.asignatura === asig &&
      (q.anualidad || 0) >= 2010 &&
      matchTemaFlexible(q.tema, '', temasNormSet) &&
      esDisponible(q)
    );
    const mirNoHechas = ordenarCandidatas(mirTema.filter(q => !isPreguntaHecha(q.id)));
    const mirRepaso = ordenarCandidatas(mirTema.filter(q => isPreguntaHecha(q.id)));
    [...mirNoHechas, ...mirRepaso].slice(0, 48).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'tema_estudiado' });
      usados.add(q.id);
      countMirTema++;
    });

    // 2. Fallos y Blancas de Simulacros (>=35% pob) + Evaluaciones CTO (>=40% pob) de esos temas
    const fallosTema = [
      ...simulacrosPool.filter(q => q.asignatura === asig && q.cto_fallada && (q.pctPob ?? 50) >= 35 && matchTemaFlexible(q.tema, q.subtema, temasNormSet)),
      ...evaluacionesPool.filter(q => q.asignatura === asig && q.cto_fallada && (q.pctPob ?? 50) >= 40 && matchTemaFlexible(q.tema, q.subtema, temasNormSet))
    ].filter(esDisponible).sort((a, b) => (b.pctPob || 50) - (a.pctPob || 50));

    fallosTema.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'fallo_cto_tema' });
      usados.add(q.id);
      countFallosCTO++;
    });

    // 3. Simulacros P80 (40-78% pob), Evaluaciones CTO y Test 2ª Vuelta CTO de la asignatura hasta 75
    if (seleccion.length < cupo) {
      const p80Tema = [
        ...simulacrosPool.filter(q => q.asignatura === asig && (q.pctPob ?? 50) >= 40 && (q.pctPob ?? 50) <= 78 && matchTemaFlexible(q.tema, q.subtema, temasNormSet)),
        ...evaluacionesPool.filter(q => q.asignatura === asig && (q.pctPob ?? 50) >= 40 && matchTemaFlexible(q.tema, q.subtema, temasNormSet)),
        ...test2VPool.filter(q => q.asignatura === asig && !isPreguntaHecha(q.id) && matchTemaFlexible(q.tema, '', temasNormSet)),
        ...desglosesData.filter(q => q.asignatura === asig && (q.anualidad || 0) >= 2010 && !isPreguntaHecha(q.id)),
        ...test2VPool.filter(q => q.asignatura === asig && !isPreguntaHecha(q.id))
      ].filter(esDisponible).sort((a, b) => (b.simulacro || 20) - (a.simulacro || 20));

      p80Tema.slice(0, cupo - seleccion.length).forEach(q => {
        const origen = q.esEvaluacionCTO ? 'evaluacion_cto' : (q.esTest2V ? 'test_2v_reserva' : 'simulacro_asignatura');
        seleccion.push({ ...q, origenTirada: origen });
        usados.add(q.id);
        countP80Tema++;
      });
    }

    setFiltros(prev => ({ ...prev, asignatura: asig, temas: temasElegidos, tamanoTirada: 75 }));
    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌅 Sesión 1 · Mañana ${asig} (75p)`,
      total: seleccion.length,
      deTema: countMirTema,
      simulacrosAsig: countFallosCTO + countP80Tema,
      rellenoAsig: countReserva2V,
      rellenoGlobal: 0
    });
  }, [filtros.asignatura, filtros.temas, asignaturas, temasDisponibles, isArchivada, isEnLatencia, isPreguntaHecha, ordenarCandidatas, simulacrosPool, evaluacionesPool, test2VPool]);

  /**
   * 🌤️ SESIÓN 2 (TARDE · 17:10–19:15 · 75 PREGUNTAS CONSOLIDACIÓN ASIGNATURA)
   * Barre el bloque nuclear de la tarde + temas satélite absorbidos de la asignatura:
   * 1) Desgloses MIR oficiales (2015-2025 primero, luego 2010-2014) de los temas elegidos
   * 2) Fallos de Simulacros (>=35% pob) y Evaluaciones CTO (>=40% pob)
   * 3) Simulacros P80 y Reserva Test 2ª Vuelta hasta completar 75
   * Modo ciego en la prueba / Agrupado automáticamente por temas en la corrección
   */
  const lanzarMotor2TardeAsignatura = useCallback(() => {
    const planBlock = getTodayPlanBlock('tarde');
    const asig = planBlock?.asignatura || filtros.asignatura || asignaturas[0] || 'Digestivo';
    const planTemas = [
      ...(planBlock?.temasNucleares || []),
      ...(planBlock?.temasSatelite || [])
    ];
    const temasElegidos = (filtros.temas && filtros.temas.length > 0)
      ? filtros.temas
      : (planTemas.length > 0 ? planTemas : temasDisponibles);
    const temasNormSet = new Set(temasElegidos.map(normText));
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countFallosCTO = 0;
    let countMirTema = 0;
    let countReserva2V = 0;

    const esDisponible = (q) => !isArchivada(q.id) && !usados.has(q.id) && !(isEnLatencia && isEnLatencia(q.id));

    // 1. Desgloses MIR oficiales de los temas seleccionados (no hechas primero)
    const mirTema = desglosesData.filter(q =>
      q.asignatura === asig &&
      (q.anualidad || 0) >= 2010 &&
      matchTemaFlexible(q.tema, '', temasNormSet) &&
      esDisponible(q)
    );
    const mirNoHechas = ordenarCandidatas(mirTema.filter(q => !isPreguntaHecha(q.id)));
    const mirRepaso = ordenarCandidatas(mirTema.filter(q => isPreguntaHecha(q.id)));
    [...mirNoHechas, ...mirRepaso].slice(0, 48).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'tema_estudiado' });
      usados.add(q.id);
      countMirTema++;
    });

    // 2. Fallos y Blancas en Simulacros (>=35% pob) y Evaluaciones CTO (>=40% pob) de la asignatura
    const fallosAsig = [
      ...simulacrosPool.filter(q => q.asignatura === asig && q.cto_fallada && (q.pctPob ?? 50) >= 35),
      ...evaluacionesPool.filter(q => q.asignatura === asig && q.cto_fallada && (q.pctPob ?? 50) >= 40)
    ].filter(esDisponible).sort((a, b) => {
      const hechaA = isPreguntaHecha(a.id);
      const hechaB = isPreguntaHecha(b.id);
      if (hechaA !== hechaB) return hechaA ? 1 : -1;
      return (b.pctPob || 50) - (a.pctPob || 50);
    });

    fallosAsig.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: q.esEvaluacionCTO ? 'evaluacion_cto' : 'simulacro_asignatura' });
      usados.add(q.id);
      countFallosCTO++;
    });

    // 3. Completar hasta 75 con Simulacros P80 -> Evaluaciones CTO -> Test 2ª Vuelta CTO
    if (seleccion.length < cupo) {
      const complemento = [
        ...desglosesData.filter(q => q.asignatura === asig && (q.anualidad || 0) >= 2010 && !isPreguntaHecha(q.id)),
        ...simulacrosPool.filter(q => q.asignatura === asig && !isPreguntaHecha(q.id) && (q.pctPob ?? 50) >= 40 && (q.pctPob ?? 50) <= 78),
        ...evaluacionesPool.filter(q => q.asignatura === asig && !isPreguntaHecha(q.id) && (q.pctPob ?? 50) >= 40),
        ...test2VPool.filter(q => q.asignatura === asig && !isPreguntaHecha(q.id))
      ].filter(esDisponible);

      complemento.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: q.esTest2V ? 'test_2v_reserva' : 'relleno_asignatura' });
        usados.add(q.id);
        countReserva2V++;
      });
    }

    setFiltros(prev => ({ ...prev, asignatura: asig, temas: temasElegidos, tamanoTirada: 75 }));
    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌤️ Sesión 2 · Tarde ${asig} (75p)`,
      total: seleccion.length,
      deTema: countMirTema,
      simulacrosAsig: countFallosCTO,
      rellenoAsig: countReserva2V,
      rellenoGlobal: 0
    });
  }, [filtros.asignatura, filtros.temas, asignaturas, temasDisponibles, isArchivada, isEnLatencia, isPreguntaHecha, ordenarCandidatas, simulacrosPool, evaluacionesPool, test2VPool]);

  /**
   * 🌍 MOTOR 3 (TARDE 2 · MIXTO ADAPTATIVO P80 · 75 PREGUNTAS)
   * Excluye la asignatura del día para entrenar cambio de contexto real MIR:
   * 1) 15 Vencidas de Latencia / Repaso Espaciado (Prioridad 8-10: fallos en verde y aciertos dudosos)
   * 2) 35 Fallos de Simulacros y Evaluaciones CTO (>=50% pob: Bloques 1 y 2) de asignaturas con mayor déficit hacia P80
   * 3) 25 Desgloses MIR 2015-2025 no hechos de los temas top del ranking global (fuera de la asignatura de hoy)
   */
  const lanzarMotor3TardeMixtoP80 = useCallback(() => {
    const asigExcluida = filtros.asignatura || '';
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countLatencia = 0;
    let countFallosP80 = 0;
    let countHuerfanas = 0;
    let countMirGlobal = 0;

    const esDisponibleOtraAsig = (q) =>
      q.asignatura !== asigExcluida &&
      !isArchivada(q.id) &&
      !usados.has(q.id) &&
      !(isEnLatencia && isEnLatencia(q.id));

    // 1. Repaso Espaciado: Vencidas de Latencia + su "Pregunta Hermana" (no vista del mismo subtema/tema)
    // Descompresión dinámica: ampliar de 16 a hasta 24 slots cuando el backlog acumulado es alto (>= 20)
    const todasFuentes = [...desglosesData, ...simulacrosPool, ...evaluacionesPool, ...test2VPool];
    const vencidasPrioritarias = todasFuentes.filter(q => {
      if (!esDisponibleOtraAsig(q)) return false;
      const st = getStatsPregunta(q.id);
      if (!st) return false;
      return (st.puntuacionPrioridad >= 8 || st.status === 'needs_review' || st.fallos > 0);
    }).sort((a, b) => {
      const pa = getStatsPregunta(a.id)?.puntuacionPrioridad || 0;
      const pb = getStatsPregunta(b.id)?.puntuacionPrioridad || 0;
      return pb - pa;
    });

    const maxLatencia = vencidasPrioritarias.length >= 20 ? 24 : 16;
    const maxBaseLatencia = Math.ceil(maxLatencia / 2);

    const buscarPreguntaHermana = (qBase) => {
      const targetSub = normText(qBase.subtema);
      const targetTema = normText(qBase.tema);
      // 1º Intentar mismo subtema exacto no visto
      if (targetSub && targetSub.length > 3) {
        const porSubtema = todasFuentes.find(cand =>
          cand.id !== qBase.id &&
          cand.asignatura === qBase.asignatura &&
          !isPreguntaHecha(cand.id) &&
          esDisponibleOtraAsig(cand) &&
          normText(cand.subtema) === targetSub
        );
        if (porSubtema) return porSubtema;
      }
      // 2º Intentar mismo tema exacto no visto (preferiblemente MIR >= 2015 o Sim/Eval >=50% pob)
      if (targetTema && targetTema.length > 3 && targetTema !== 'general') {
        const porTema = todasFuentes.find(cand =>
          cand.id !== qBase.id &&
          cand.asignatura === qBase.asignatura &&
          !isPreguntaHecha(cand.id) &&
          esDisponibleOtraAsig(cand) &&
          matchTemaFlexible(cand.tema, cand.subtema, new Set([targetTema])) &&
          ((cand.anualidad || 0) >= 2015 || (cand.pctPob ?? 60) >= 45)
        );
        if (porTema) return porTema;
      }
      return null;
    };

    vencidasPrioritarias.slice(0, maxBaseLatencia).forEach(q => {
      if (countLatencia >= maxLatencia) return;
      seleccion.push({ ...q, origenTirada: 'repaso_latencia' });
      usados.add(q.id);
      countLatencia++;

      // Emparejar con 1 Pregunta Hermana virgen del mismo subtema/tema para evitar acertar solo por memoria fotográfica del enunciado
      if (countLatencia < maxLatencia) {
        const hermana = buscarPreguntaHermana(q);
        if (hermana) {
          seleccion.push({ ...hermana, origenTirada: 'pregunta_hermana', hermanaDeId: q.id });
          usados.add(hermana.id);
          countLatencia++;
        }
      }
    });

    // 2. Cuota protegida para las 9 Asignaturas Huérfanas (0 días lectivos en 3ª Vuelta CTO)
    // Extrae hasta 12 preguntas de OR, UG, GT, FS, FM, BQ, AL, RH, AT combinando Fallos CTO, Test 2V y MIR 2015-2025
    const ASIGNATURAS_HUERFANAS = new Set([
      'Otorrinolaringología',
      'Urgencias',
      'Genética',
      'Fisiología',
      'Farmacología',
      'Bioquímica',
      'Alergología',
      'Rehabilitación',
      'Anatomía'
    ]);

    const poolHuerfanas = [
      ...simulacrosPool.filter(q => q.cto_fallada && (q.pctPob ?? 50) >= 35 && ASIGNATURAS_HUERFANAS.has(q.asignatura)),
      ...evaluacionesPool.filter(q => q.cto_fallada && (q.pctPob ?? 50) >= 35 && ASIGNATURAS_HUERFANAS.has(q.asignatura)),
      ...desglosesData.filter(q => (q.anualidad || 0) >= 2015 && ASIGNATURAS_HUERFANAS.has(q.asignatura)),
      ...test2VPool.filter(q => ASIGNATURAS_HUERFANAS.has(q.asignatura))
    ].filter(q => !isPreguntaHecha(q.id) && esDisponibleOtraAsig(q));

    const huerfanasCandidatas = ordenarCandidatas(poolHuerfanas);
    const limiteHuerfanas = 12;
    huerfanasCandidatas.slice(0, Math.min(limiteHuerfanas, cupo - seleccion.length)).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'huerfana_absorcion' });
      usados.add(q.id);
      countHuerfanas++;
    });

    // 3. Hasta 25 Fallos/Blancas de Simulacros y Evaluaciones CTO (>=50% pob) ponderados por vulnerabilidad de asignatura
    const { rankingAsignaturas, rankingGlobal } = getAnalisisPrioridadesTemas();
    const scoreAsigMap = new Map(rankingAsignaturas.map(r => [r.asignatura, r.totalScore]));

    const fallosGlobalesP80 = [
      ...simulacrosPool.filter(q => q.cto_fallada && (q.pctPob ?? 50) >= 50 && !isPreguntaHecha(q.id)),
      ...evaluacionesPool.filter(q => q.cto_fallada && (q.pctPob ?? 50) >= 50 && !isPreguntaHecha(q.id))
    ].filter(esDisponibleOtraAsig).sort((a, b) => {
      const sa = (scoreAsigMap.get(a.asignatura) || 10) * ((a.pctPob || 50) / 100);
      const sb = (scoreAsigMap.get(b.asignatura) || 10) * ((b.pctPob || 50) / 100);
      return sb - sa;
    });

    fallosGlobalesP80.slice(0, Math.min(25, cupo - seleccion.length)).forEach(q => {
      seleccion.push({ ...q, origenTirada: q.esEvaluacionCTO ? 'evaluacion_cto' : 'simulacro_asignatura' });
      usados.add(q.id);
      countFallosP80++;
    });

    // 4. Absorción de déficit: Desgloses MIR 2015-2025 + Test 2ª Vuelta CTO (test2VPool) de los temas con mayor score global
    const topGlobalKeys = new Set(
      rankingGlobal
        .filter(t => t.asignatura !== asigExcluida)
        .slice(0, 45)
        .map(t => `${normText(t.asignatura)}:::${normText(t.tema)}`)
    );

    const poolDeficitGlobal = [
      ...desglosesData.filter(q =>
        (q.anualidad || 0) >= 2015 &&
        topGlobalKeys.has(`${normText(q.asignatura)}:::${normText(q.tema)}`)
      ),
      ...test2VPool.filter(q =>
        topGlobalKeys.has(`${normText(q.asignatura)}:::${normText(q.tema)}`)
      )
    ].filter(q => !isPreguntaHecha(q.id) && esDisponibleOtraAsig(q));

    const mirTopGlobal = ordenarCandidatas(poolDeficitGlobal);

    mirTopGlobal.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: q.esTest2V ? 'test_2v_reserva' : 'tema_estudiado' });
      usados.add(q.id);
      countMirGlobal++;
    });

    // 5. Fallback final si faltan huecos para 60: absorber cualquier MIR 2015-2025 o Test 2V pendiente
    if (seleccion.length < cupo) {
      const fallbackDeficit = ordenarCandidatas([
        ...desglosesData.filter(q => (q.anualidad || 0) >= 2015),
        ...test2VPool
      ].filter(q => !isPreguntaHecha(q.id) && esDisponibleOtraAsig(q)));

      fallbackDeficit.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: q.esTest2V ? 'test_2v_reserva' : 'relleno_global' });
        usados.add(q.id);
        countMirGlobal++;
      });
    }

    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌍 Motor 3 · Mixto Adaptativo P80 (60p${asigExcluida ? ` · sin ${asigExcluida}` : ''})`,
      total: seleccion.length,
      deTema: countMirGlobal,
      simulacrosAsig: countFallosP80,
      rellenoAsig: countHuerfanas,
      rellenoGlobal: countLatencia
    });
  }, [filtros.asignatura, isArchivada, isEnLatencia, isPreguntaHecha, getStatsPregunta, ordenarCandidatas, simulacrosPool, evaluacionesPool, test2VPool]);

  const aplicarFiltrosCon = useCallback((filtrosActuales) => {
    // La base de Desgloses Oficiales MIR proviene exclusivamente de desgloses_filtrables.json
    // Solo si el usuario activa 'incluirTest2V' se añaden preguntas de Test 2V CTO
    const poolDesgloses = desglosesData.filter(q => !isArchivada(q.id));
    const pool2V = filtrosActuales.incluirTest2V 
      ? test2VPool.filter(q => !isArchivada(q.id))
      : [];
    const basePool = [...poolDesgloses, ...pool2V];
    let nucleo = [...basePool];

    if (filtrosActuales.asignatura) {
      nucleo = nucleo.filter(q => q.asignatura === filtrosActuales.asignatura);
    }
    if (filtrosActuales.temas && filtrosActuales.temas.length > 0) {
      nucleo = nucleo.filter(q => filtrosActuales.temas.includes(q.tema));
    }
    if (filtrosActuales.dificultad.length > 0) {
      nucleo = nucleo.filter(q => filtrosActuales.dificultad.includes(q.dificultad));
    }
    if (filtrosActuales.minYear) {
      nucleo = nucleo.filter(q => (q.anualidad || 0) >= filtrosActuales.minYear);
    }
    if (filtrosActuales.soloNoHechas) {
      nucleo = nucleo.filter(q => !isPreguntaHecha(q.id));
    }
    if (filtrosActuales.soloFalladas) {
      nucleo = nucleo.filter(q => {
        const pStats = getStatsPregunta(q.id) || {};
        return pStats.fallos > 0;
      });
    }

    nucleo = ordenarCandidatas(nucleo).map(q => ({ ...q, origenTirada: 'tema_estudiado' }));

    const cupoObjetivo = Number(filtrosActuales.tamanoTirada) || 0;
    let seleccionFinal = [];
    let countTema = 0;
    let countSimulacrosAsig = 0;
    let countRellenoAsig = 0;
    let countRellenoGlobal = 0;

    if (cupoObjetivo <= 0) {
      seleccionFinal = nucleo;
      countTema = nucleo.length;
    } else if (nucleo.length >= cupoObjetivo) {
      seleccionFinal = nucleo.slice(0, cupoObjetivo);
      countTema = seleccionFinal.length;
    } else {
      seleccionFinal = [...nucleo];
      countTema = seleccionFinal.length;

      if (filtrosActuales.rellenarHastaCupo) {
        const usadosIds = new Set(seleccionFinal.map(q => q.id));
        let faltan = cupoObjetivo - seleccionFinal.length;

        // Escalón 1 PRINCIPAL de Relleno: Otros Desgloses MIR de la MISMA asignatura (no hechos)
        if (faltan > 0 && filtrosActuales.asignatura) {
          const otrosMirAsig = poolDesgloses.filter(q =>
            q.asignatura === filtrosActuales.asignatura &&
            !usadosIds.has(q.id) &&
            (!filtrosActuales.minYear || (q.anualidad || 0) >= filtrosActuales.minYear)
          );
          const candidatasMir = filtrosActuales.soloNoHechas
            ? ordenarCandidatas(otrosMirAsig.filter(q => !isPreguntaHecha(q.id)))
            : ordenarCandidatas(otrosMirAsig);

          const tomadasMir = candidatasMir.slice(0, faltan).map(q => ({ ...q, origenTirada: 'relleno_asignatura' }));
          seleccionFinal.push(...tomadasMir);
          tomadasMir.forEach(q => usadosIds.add(q.id));
          countRellenoAsig += tomadasMir.length;
          faltan = cupoObjetivo - seleccionFinal.length;
        }

        // Escalón 1b: Desgloses MIR históricos (2010-2014) de la misma asignatura si aún faltan
        if (faltan > 0 && filtrosActuales.asignatura) {
          const mirHistorico = poolDesgloses.filter(q =>
            q.asignatura === filtrosActuales.asignatura &&
            !usadosIds.has(q.id) &&
            (!filtrosActuales.soloNoHechas || !isPreguntaHecha(q.id))
          );
          const tomadasHist = ordenarCandidatas(mirHistorico).slice(0, faltan).map(q => ({ ...q, origenTirada: 'relleno_asignatura' }));
          seleccionFinal.push(...tomadasHist);
          tomadasHist.forEach(q => usadosIds.add(q.id));
          countRellenoAsig += tomadasHist.length;
          faltan = cupoObjetivo - seleccionFinal.length;
        }

        // Escalón 2: Simulacros (>=35% pob) + Evaluaciones CTO (>=40% pob) de la asignatura solo si se agotaron los Desgloses MIR
        if (faltan > 0) {
          const temasSet = new Set(filtrosActuales.temas || []);
          let poolSimEval = [...simulacrosPool, ...evaluacionesPool].filter(q =>
            !isArchivada(q.id) &&
            !usadosIds.has(q.id) &&
            (q.pctPob ?? 50) >= 35 &&
            (!filtrosActuales.asignatura || q.asignatura === filtrosActuales.asignatura) &&
            (filtrosActuales.dificultad.length === 0 || filtrosActuales.dificultad.includes(q.dificultad))
          );

          if (filtrosActuales.soloFalladas) {
            poolSimEval = poolSimEval.filter(q => {
              const pStats = getStatsPregunta(q.id) || {};
              return q.cto_fallada || pStats.fallos > 0;
            });
          }

          poolSimEval.sort((a, b) => {
            if (temasSet.size > 0) {
              const matchTemaA = temasSet.has(a.tema) || temasSet.has(a.subtema);
              const matchTemaB = temasSet.has(b.tema) || temasSet.has(b.subtema);
              if (matchTemaA !== matchTemaB) return matchTemaA ? -1 : 1;
            }

            if (filtrosActuales.soloNoHechas) {
              const hechaA = isPreguntaHecha(a.id);
              const hechaB = isPreguntaHecha(b.id);
              if (hechaA !== hechaB) return hechaA ? 1 : -1;
            }

            const latA = isEnLatencia ? isEnLatencia(a.id) : false;
            const latB = isEnLatencia ? isEnLatencia(b.id) : false;
            if (latA !== latB) return latA ? 1 : -1;

            const falloSimA = (a.cto_fallada ? 2 : 0) + (a.cto_dudosa ? 1 : 0);
            const falloSimB = (b.cto_fallada ? 2 : 0) + (b.cto_dudosa ? 1 : 0);
            if (falloSimA !== falloSimB) return falloSimB - falloSimA;

            return (b.pctPob || 50) - (a.pctPob || 50);
          });

          const tomadasSim = poolSimEval.slice(0, faltan).map(q => ({
            ...q,
            origenTirada: q.esEvaluacionCTO ? 'evaluacion_cto' : 'simulacro_asignatura'
          }));
          seleccionFinal.push(...tomadasSim);
          tomadasSim.forEach(q => usadosIds.add(q.id));
          countSimulacrosAsig = tomadasSim.length;
          faltan = cupoObjetivo - seleccionFinal.length;
        }

        // Escalón 3: Test 2V solo si el usuario activó expresamente incluirTest2V
        if (faltan > 0 && filtrosActuales.incluirTest2V && filtrosActuales.asignatura) {
          const pool2VAsig = test2VPool.filter(q =>
            q.asignatura === filtrosActuales.asignatura &&
            !isArchivada(q.id) &&
            !usadosIds.has(q.id) &&
            (!filtrosActuales.soloNoHechas || !isPreguntaHecha(q.id))
          );
          const tomadas2V = ordenarCandidatas(pool2VAsig).slice(0, faltan).map(q => ({ ...q, origenTirada: 'test_2v_reserva' }));
          seleccionFinal.push(...tomadas2V);
          tomadas2V.forEach(q => usadosIds.add(q.id));
          countRellenoAsig += tomadas2V.length;
          faltan = cupoObjetivo - seleccionFinal.length;
        }

        // Escalón 4 de Relleno: Repaso adaptativo de Desgloses MIR
        if (faltan > 0) {
          let poolGlobal = poolDesgloses.filter(q =>
            !usadosIds.has(q.id) &&
            !(isEnLatencia && isEnLatencia(q.id)) &&
            (!filtrosActuales.minYear || (q.anualidad || 0) >= filtrosActuales.minYear)
          );
          poolGlobal = ordenarCandidatas(poolGlobal);
          const tomadasGlobal = poolGlobal.slice(0, faltan).map(q => ({ ...q, origenTirada: 'relleno_global' }));
          seleccionFinal.push(...tomadasGlobal);
          countRellenoGlobal = tomadasGlobal.length;
        }
      }
    }

    setCola(seleccionFinal);
    setResumenCola({
      total: seleccionFinal.length,
      deTema: countTema,
      simulacrosAsig: countSimulacrosAsig,
      rellenoAsig: countRellenoAsig,
      rellenoGlobal: countRellenoGlobal
    });
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
    setChatExportStatus(null);
    setUltimaTiradaPayload(null);
  }, [isArchivada, isPreguntaHecha, getStatsPregunta, isEnLatencia, ordenarCandidatas, simulacrosPool, evaluacionesPool, test2VPool]);

  const handleFiltrar = () => {
    aplicarFiltrosCon(filtros);
  };

  const handleToggleSoloNoHechas = (checked) => {
    const nuevosFiltros = { ...filtros, soloNoHechas: checked, soloFalladas: false };
    setFiltros(nuevosFiltros);
    if (cola.length > 0 && Object.keys(respuestasDesglose).length === 0) {
      aplicarFiltrosCon(nuevosFiltros);
    }
  };

  const handleToggleSoloFalladas = (checked) => {
    const nuevosFiltros = { ...filtros, soloFalladas: checked, soloNoHechas: false };
    setFiltros(nuevosFiltros);
    if (cola.length > 0 && Object.keys(respuestasDesglose).length === 0) {
      aplicarFiltrosCon(nuevosFiltros);
    }
  };

  const finalizarYExportarTirada = useCallback(async (colaActual, respuestasActuales) => {
    const contestadas = colaActual.filter(q => respuestasActuales[q.id] && !respuestasActuales[q.id].skipped);
    const payload = construirPayloadTirada({
      origen: 'Desgloses',
      asignatura: filtros.asignatura || 'Mixto',
      temas: filtros.temas || [],
      resumenCola,
      cola: contestadas.length > 0 ? contestadas : colaActual,
      respuestasDesglose: respuestasActuales
    });
    setUltimaTiradaPayload(payload);

    const status = await guardarTiradaParaChat(payload, {
      autoDownloadOnFallback: true,
      autoCopy: true
    });
    setChatExportStatus(status);
  }, [filtros.asignatura, filtros.temas, resumenCola]);

  const handleNext = useCallback((updatedRespuestas = null) => {
    const mapResp = updatedRespuestas || respuestasDesglose;
    if (currentIndex < cola.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      const contestadas = cola.filter(q => mapResp[q.id] && !mapResp[q.id].skipped);
      if (contestadas.length > 0) {
        finalizarYExportarTirada(cola, mapResp);
      }
      setQuizFinished(true);
    }
  }, [currentIndex, cola, respuestasDesglose, finalizarYExportarTirada]);

  const terminarDesglose = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    
    if (contestadas.length === 0) {
      if (window.confirm("¿Seguro que quieres cerrar este desglose?")) {
        setCola([]);
        setResumenCola(null);
        setCurrentIndex(0);
        setRespuestasDesglose({});
        sessionStorage.removeItem('mir_desgloses_cola');
        sessionStorage.removeItem('mir_desgloses_resumenCola');
        sessionStorage.removeItem('mir_desgloses_respuestas');
        sessionStorage.removeItem('mir_desgloses_currentIndex');
      }
      return;
    }

    // Vaciar únicamente lo que haya quedado en la cola offline sin re-subir por duplicado
    await flushOfflineSyncQueue().catch(err => console.warn('Flush error en terminarDesglose:', err));

    await finalizarYExportarTirada(contestadas, respuestasDesglose);
    setCola(contestadas);
    setQuizFinished(true);
  };

  const handleFinalizarSesion = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length === 0) {
      terminarDesglose();
      return;
    }
    await finalizarYExportarTirada(contestadas, respuestasDesglose);
    setCola(contestadas);
    setQuizFinished(true);
  };

  const toggleDificultad = (dif) => {
    setFiltros(prev => {
      const current = prev.dificultad;
      if (current.includes(dif)) {
        return { ...prev, dificultad: current.filter(d => d !== dif) };
      }
      return { ...prev, dificultad: [...current, dif] };
    });
  };

  const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || num;

  // Transform data format for QuestionCard
  const questionForCard = currentQuestionData ? {
    id: currentQuestionData.id,
    text: currentQuestionData.enunciado,
    image: currentQuestionData.imagen_nombre || currentQuestionData.image,
    options: currentQuestionData.respuestas.map(r => ({
      id: numToLetter(r.numero),
      text: r.enunciado
    })),
    correctOption: (() => {
      const corr = currentQuestionData.respuestas.find(r => r.correcta);
      return corr ? numToLetter(corr.numero) : null;
    })()
  } : null;

  const handleAnswerSubmit = (answerData) => {
    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(currentQuestionData.id, 'missing_data');
      }
      const nextResp = {
        ...respuestasDesglose,
        [questionForCard.id]: { skipped: true }
      };
      setRespuestasDesglose(nextResp);
      handleNext(nextResp);
      return;
    }

    const discardedCorrect = (answerData.discardedOptions || []).includes(questionForCard.correctOption);
    
    // Registrar en estadísticas locales con nivel de confianza y asignatura
    registrarRespuesta(questionForCard.id, answerData.isCorrect, answerData.selectedOption, {
      confidence: answerData.confidence,
      subject: currentQuestionData.asignatura
    });

    const nuevaEntrada = {
      isCorrect: answerData.isCorrect,
      selectedLetter: answerData.selectedOption,
      correctLetter: questionForCard.correctOption,
      discardedOptions: answerData.discardedOptions || [],
      discardedCorrect: discardedCorrect,
      confidence: answerData.confidence || 'green',
      seconds: answerData.seconds || 0,
      justificacion: answerData.justificacion || ''
    };

    const nextResp = {
      ...respuestasDesglose,
      [questionForCard.id]: nuevaEntrada
    };
    setRespuestasDesglose(nextResp);

    // En Modo Examen no mostramos la respuesta: pasamos inmediatamente a la siguiente pregunta
    if (modoExamen) {
      handleNext(nextResp);
    }
  };

  const sessionEnqueuedRef = React.useRef(false);
  useEffect(() => {
    if (!quizFinished) {
      sessionEnqueuedRef.current = false;
    }
  }, [quizFinished]);

  const runSync = useCallback(async () => {
    setSyncState({ status: 'syncing' });

    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length > 0 && !sessionEnqueuedRef.current) {
      sessionEnqueuedRef.current = true;
      const userId = getOrCreateAnonUserId();
      const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;

      createQuizResult(userId, {
        subject: filtros.asignatura ? `Desglose: ${filtros.asignatura}` : 'Desgloses MIR',
        question_count: contestadas.length,
        answers: contestadas.map(q => ({
          question_id: q.id,
          selected: respuestasDesglose[q.id]?.selectedLetter,
          is_correct: !!respuestasDesglose[q.id]?.isCorrect,
          confidence: respuestasDesglose[q.id]?.confidence || 'green',
          discarded_correct: !!respuestasDesglose[q.id]?.discardedCorrect
        })),
        total_score: correctCount,
        duration_seconds: contestadas.reduce((acc, q) => acc + (respuestasDesglose[q.id]?.seconds || 0), 0)
      });
    }

    const res = await flushOfflineSyncQueue();
    if (res.success) {
      setSyncState({
        status: 'synced',
        syncedCount: res.syncedStats || contestadas.length,
        lastSyncTime: res.lastSyncTime
      });
    } else if (!res.isOnline) {
      setSyncState({
        status: 'offline',
        pendingCount: res.pendingStats || contestadas.length
      });
    } else {
      setSyncState({
        status: 'error',
        errorMsg: res.error,
        pendingCount: res.pendingStats || contestadas.length
      });
    }
  }, [cola, respuestasDesglose, filtros.asignatura]);

  useEffect(() => {
    if (!quizFinished) return;
    runSync();
    const handleOnline = () => runSync();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [quizFinished, runSync]);

  if (quizFinished) {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    const correctCount = contestadas.filter(q => respuestasDesglose[q.id]?.isCorrect).length;
    const falladasSesion = contestadas.filter(q => !respuestasDesglose[q.id]?.isCorrect);
    const netasSesion = (correctCount - falladasSesion.length / 3).toFixed(2);

    const fallosVerdes = falladasSesion.filter(q => respuestasDesglose[q.id]?.confidence === 'green').length;
    const aciertosDudosos = contestadas.filter(q => {
      const a = respuestasDesglose[q.id];
      return a?.isCorrect && (a.confidence === 'orange' || a.confidence === 'red');
    }).length;

    const handleRepasarErrores = () => {
      setCola(falladasSesion);
      setCurrentIndex(0);
      setRespuestasDesglose({});
      setQuizFinished(false);
      setSyncState(null);
    };

    const handleCopyTirada = async () => {
      const payload = ultimaTiradaPayload || construirPayloadTirada({
        origen: 'Desgloses',
        asignatura: filtros.asignatura || 'Mixto',
        temas: filtros.temas || [],
        resumenCola,
        cola,
        respuestasDesglose
      });
      const ok = await copiarTiradaAlPortapapeles(payload);
      if (ok) {
        setChatExportStatus(prev => ({ ...prev, copied: true }));
      }
    };

    const handleDownloadTirada = () => {
      const payload = ultimaTiradaPayload || construirPayloadTirada({
        origen: 'Desgloses',
        asignatura: filtros.asignatura || 'Mixto',
        temas: filtros.temas || [],
        resumenCola,
        cola,
        respuestasDesglose
      });
      const ok = descargarTiradaJSON(payload);
      if (ok) {
        setChatExportStatus(prev => ({ ...prev, downloaded: true }));
      }
    };

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 flex items-center justify-center">
        <div className="max-w-3xl w-full p-8 md:p-10 bg-white rounded-3xl shadow-lg border border-slate-100 text-center animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="text-5xl mb-4">🎯</div>
          <h2 className="text-3xl font-black text-slate-900 mb-1">Tirada de Desgloses Finalizada</h2>
          <p className="text-slate-500 mb-6 font-medium">
            {filtros.asignatura ? `${filtros.asignatura}` : 'Mixto'}
            {filtros.temas?.length > 0 ? ` · ${filtros.temas.length} tema(s)` : ''}
          </p>

          {/* CAJA DE AUDITORÍA EN EL CHAT (MODO SIMULACRO SIN SUPABASE) */}
          <div className="mb-8 p-5 rounded-2xl bg-gradient-to-br from-cyan-50 to-slate-50 border-2 border-cyan-200 text-left shadow-xs">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 text-cyan-900 font-black text-base mb-1">
                  <span>🤖</span>
                  <span>Lista para Corregir en el Chat (Protocolo Simulacro + Anki)</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {chatExportStatus?.savedDisk
                    ? '✅ Guardada automáticamente en disco (src/data/ultima_tirada.json) y en el portapapeles. Ve al chat y escribe: "Corrígeme la tirada".'
                    : chatExportStatus?.downloaded
                      ? '✅ Descargada automáticamente en ~/Downloads y copiada al portapapeles (funciona 100% sin Supabase). Ve al chat y escribe: "Corrígeme la tirada".'
                      : 'Guarda o copia esta tirada y pide en el chat: "Corrígeme la tirada".'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyTirada}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white hover:bg-cyan-100 text-cyan-900 border border-cyan-300 transition-colors shadow-2xs"
                >
                  {chatExportStatus?.copied ? '✓ Copiada al Portapapeles' : '📋 Copiar para el Chat'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadTirada}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white transition-colors shadow-2xs"
                >
                  📥 Descargar JSON
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <div className="text-3xl font-black text-cyan-600">{netasSesion}</div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-1">Netas</div>
            </div>
            <div className="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-100">
              <div className="text-3xl font-black text-emerald-600">{correctCount}</div>
              <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mt-1">Aciertos</div>
            </div>
            <div className="bg-red-50/60 rounded-2xl p-4 border border-red-100">
              <div className="text-3xl font-black text-red-500">{falladasSesion.length}</div>
              <div className="text-[11px] font-bold text-red-700 uppercase tracking-wider mt-1">Fallos ({fallosVerdes} en Verde)</div>
            </div>
            <div className="bg-amber-50/60 rounded-2xl p-4 border border-amber-100">
              <div className="text-3xl font-black text-amber-600">{aciertosDudosos}</div>
              <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mt-1">Aciertos Dudosos</div>
            </div>
          </div>

          {/* BANNER DE SINCRONIZACIÓN CON SUPABASE / OFFLINE */}
          <SyncStatusBanner syncState={syncState} onRetry={runSync} className="mb-8" />

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {falladasSesion.length > 0 && (
              <button
                onClick={handleRepasarErrores}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-3.5 rounded-xl font-bold text-base transition-all hover:scale-105 active:scale-95 shadow-sm"
              >
                ❌ Re-hacer {falladasSesion.length} fallos en la app
              </button>
            )}
            <button 
              onClick={() => {
                setQuizFinished(false);
                setCola([]);
                setResumenCola(null);
                setCurrentIndex(0);
                setRespuestasDesglose({});
                setSyncState(null);
                sessionStorage.removeItem('mir_desgloses_cola');
                sessionStorage.removeItem('mir_desgloses_resumenCola');
                sessionStorage.removeItem('mir_desgloses_respuestas');
                sessionStorage.removeItem('mir_desgloses_currentIndex');
              }}
              className="bg-slate-900 text-white px-6 py-3.5 rounded-xl font-bold text-base hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
            >
              Nueva Tirada de Desgloses
            </button>
          </div>
        </div>
      </div>
    );
  }

  const contestadasCount = Object.keys(respuestasDesglose).filter(qId => respuestasDesglose[qId] && !respuestasDesglose[qId].skipped).length;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* PANEL SUPERIOR DE FILTROS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-slate-900">Desgloses Oficiales MIR</h2>

              {/* Toggle Modo Examen vs Modo Tutor */}
              <div className="inline-flex rounded-xl p-1 bg-slate-100 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModoExamen(true)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    modoExamen
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="No muestra la respuesta al instante; pasa directamente a la siguiente como en un examen real para corregir toda la tirada al final en el chat"
                >
                  <span>🎯</span> Modo Examen (Tirada)
                </button>
                <button
                  type="button"
                  onClick={() => setModoExamen(false)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    !modoExamen
                      ? 'bg-cyan-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                  title="Muestra la respuesta correcta y el comentario de CTO inmediatamente después de cada pregunta"
                >
                  <span>💡</span> Modo Tutor
                </button>
              </div>

              {isOffline && (
                <span className="text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 flex items-center gap-1.5 font-medium">
                  <span>📡</span> Guardado Local Activo
                </span>
              )}
            </div>

            {cola.length > 0 && (
              <div className="flex items-center gap-2">
                {contestadasCount > 0 && (
                  <button 
                    onClick={handleFinalizarSesion}
                    className="text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3.5 py-1.5 rounded-lg shadow-sm transition-all hover:scale-105 active:scale-95"
                  >
                    🏁 Finalizar y Corregir ({contestadasCount}/{cola.length})
                  </button>
                )}
                <button 
                  onClick={terminarDesglose}
                  className="text-sm text-red-600 font-bold hover:bg-red-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                >
                  Cerrar ✕
                </button>
              </div>
            )}
          </div>
          
          {/* BARRA DE 2 GRANDES SESIONES DIARIAS (75p) + MOTOR MIXTO ADAPTATIVO */}
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-950 text-white shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <span className="text-xs font-black uppercase tracking-wider text-cyan-300">
                  Entrenamiento 3ª Vuelta (2 Sesiones de 75p con Estudio Previo · 150p/día)
                </span>
              </div>
              <span className="text-[11px] text-slate-300 font-medium">
                {filtros.asignatura ? `Asignatura activa: ${filtros.asignatura}` : 'Selecciona asignatura abajo para tirada personalizada'}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={lanzarMotor1Manana}
                className="text-left p-3 rounded-xl bg-white/10 hover:bg-amber-500/25 border border-white/15 hover:border-amber-400 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-amber-300 group-hover:text-amber-200">
                    🌅 SESIÓN 1 · MAÑANA (11:00)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-200">
                    75 preg · 65m
                  </span>
                </div>
                <div className="text-xs font-bold text-white">Post-Estudio Matinal (Temas hoy + Satélites)</div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  1º Desgloses MIR nucleares + satélites → 2º Sims CTO P80 → 3º Eval/Reserva 2V
                </div>
              </button>

              <button
                type="button"
                onClick={lanzarMotor2TardeAsignatura}
                className="text-left p-3 rounded-xl bg-white/10 hover:bg-cyan-500/25 border border-white/15 hover:border-cyan-400 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-cyan-300 group-hover:text-cyan-200">
                    🌤️ SESIÓN 2 · TARDE (17:10)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200">
                    75 preg · 65m
                  </span>
                </div>
                <div className="text-xs font-bold text-white">
                  Consolidación Tarde ({filtros.asignatura || 'Asignatura'})
                </div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  1º Desgloses MIR nucleares + satélites → 2º Sims CTO P80 → 3º Eval/Reserva 2V
                </div>
              </button>

              <button
                type="button"
                onClick={lanzarMotor3TardeMixtoP80}
                className="text-left p-3 rounded-xl bg-white/10 hover:bg-emerald-500/25 border border-white/15 hover:border-emerald-400 transition-all group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-black text-emerald-300 group-hover:text-emerald-200">
                    🌍 MOTOR MIXTO ADAPTATIVO
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200">
                    75 preg · 65m
                  </span>
                </div>
                <div className="text-xs font-bold text-white">Mixto Adaptativo P80 (Resto MIR)</div>
                <div className="text-[11px] text-slate-300 mt-0.5">
                  15 Latencia P8-10 + 35 Fallos P80 (≥50% pob) + 25 MIR Top global
                </div>
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            
            {/* Asignatura */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Asignatura</label>
              <select 
                value={filtros.asignatura}
                onChange={e => setFiltros({...filtros, asignatura: e.target.value, temas: []})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-cyan-500 focus:border-cyan-500"
              >
                <option value="">Todas</option>
                {asignaturas.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Tamaño de Tirada */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Tamaño de Tirada</label>
              <select 
                value={filtros.tamanoTirada ?? 75}
                onChange={e => setFiltros({...filtros, tamanoTirada: parseInt(e.target.value, 10)})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm font-bold text-slate-800 focus:ring-cyan-500"
              >
                <option value={75}>75 preguntas (Estándar 3ª Vuelta · 2 sesiones/día)</option>
                <option value={60}>60 preguntas</option>
                <option value={45}>45 preguntas</option>
                <option value={30}>30 preguntas</option>
                <option value={0}>Todas las disponibles</option>
              </select>
            </div>

            {/* Año */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase">Desde el año</label>
              <select 
                value={filtros.minYear}
                onChange={e => setFiltros({...filtros, minYear: parseInt(e.target.value)})}
                className="w-full p-2 border border-slate-300 rounded-lg bg-slate-50 text-sm focus:ring-cyan-500"
              >
                <option value={2010}>2010</option>
                <option value={2015}>2015 (Recomendado 3V)</option>
                <option value={2020}>2020</option>
                <option value={2023}>2023</option>
              </select>
            </div>

            {/* Botón Filtrar */}
            <button 
              onClick={handleFiltrar}
              className="bg-slate-900 text-white font-bold py-2 px-4 rounded-lg hover:bg-cyan-600 transition-colors"
            >
              Generar Tirada Manual
            </button>
          </div>

          {/* Selector de Temas Múltiples Ordenados por Prioridad (Solo visible si hay asignatura elegida) */}
          {filtros.asignatura && temasDisponibles.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <span className="text-xs font-bold text-slate-500 uppercase">
                  Temas de {filtros.asignatura} ordenados por Prioridad MIR × Fallos ({filtros.temas?.length || 0} seleccionados)
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={seleccionarTop3TemasP1}
                    className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                  >
                    🎯 Seleccionar Top 3 P1 Quirúrgicos
                  </button>
                  {filtros.temas?.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setFiltros(prev => ({ ...prev, temas: [] }))}
                      className="text-xs font-bold text-cyan-600 hover:underline"
                    >
                      Limpiar temas
                    </button>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-2 pb-2">
                {temasDisponibles.map(t => {
                  const isSelected = filtros.temas?.includes(t);
                  const pInfo = mapaPrioridadTema.get(normText(t));
                  const badge = pInfo?.tier === 'P1' ? '🔴 P1' : (pInfo?.tier === 'P2' ? '🟠 P2' : '🟢');
                  return (
                    <button
                      key={t}
                      onClick={() => toggleTema(t)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors text-left flex items-center gap-1.5 ${
                        isSelected 
                          ? 'bg-cyan-50 border-cyan-500 text-cyan-900 font-bold shadow-sm' 
                          : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-300'
                      }`}
                    >
                      <span className="text-[10px] font-black">{badge}</span>
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Dificultad y Filtros Extra */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-xs font-bold text-slate-500 uppercase">Dificultad:</span>
              {[1, 2, 3, 4, 5].map(d => (
                <label key={d} className="flex items-center gap-1.5 cursor-pointer text-sm font-medium text-slate-700">
                  <input 
                    type="checkbox" 
                    checked={filtros.dificultad.includes(d)}
                    onChange={() => toggleDificultad(d)}
                    className="rounded text-cyan-500 focus:ring-cyan-500"
                  /> 
                  N{d}
                </label>
              ))}
            </div>
            
            <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

            {filtros.tamanoTirada > 0 && (
              <label
                className="flex items-center gap-2 text-sm font-bold text-cyan-800 bg-cyan-50/70 px-3 py-1 rounded-lg border border-cyan-200 cursor-pointer"
                title="Completa hasta el cupo con otros desgloses MIR de la asignatura o simulacros si faltan"
              >
                <input 
                  type="checkbox" 
                  checked={filtros.rellenarHastaCupo}
                  onChange={e => setFiltros(prev => ({ ...prev, rellenarHastaCupo: e.target.checked }))}
                  className="rounded border-cyan-300 text-cyan-600 focus:ring-cyan-500"
                />
                ➕ Completar hasta {filtros.tamanoTirada} con resto de {filtros.asignatura || 'asignatura'}
              </label>
            )}
            
            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filtros.soloNoHechas}
                onChange={e => handleToggleSoloNoHechas(e.target.checked)}
                className="rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
              />
              Ocultar ya hechas
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-700 cursor-pointer">
              <input 
                type="checkbox" 
                checked={filtros.soloFalladas}
                onChange={e => handleToggleSoloFalladas(e.target.checked)}
                className="rounded border-slate-300 text-red-500 focus:ring-red-500"
              />
              Solo mis falladas
            </label>

            <label 
              className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
              title="Desactivado por defecto para hacer exclusivamente Desgloses Oficiales MIR. Marca esta casilla si deseas incluir tests de clase de 2ª Vuelta CTO"
            >
              <input 
                type="checkbox" 
                checked={Boolean(filtros.incluirTest2V)}
                onChange={e => {
                  const nuevos = { ...filtros, incluirTest2V: e.target.checked };
                  setFiltros(nuevos);
                  if (cola.length > 0 && Object.keys(respuestasDesglose).length === 0) {
                    aplicarFiltrosCon(nuevos);
                  }
                }}
                className="rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              Incluir Test 2ª Vuelta CTO
            </label>
          </div>
        </div>

        {/* ZONA CENTRAL - COLA DE TIRADA */}
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-sm border border-slate-200">
          
          {cola.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📋</div>
              <h3 className="text-lg font-bold text-slate-900">Configura tu tirada o lanza uno de los 3 Motores de 3ª Vuelta</h3>
              <p className="text-slate-500">
                Elige la asignatura de hoy arriba y pulsa <strong>🌅 Motor 1 (Mañana 45p)</strong>, <strong>📘 Motor 2 (Tarde 60p)</strong> o <strong>🌍 Motor 3 (Mixto P80 60p)</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* BANNER COMPOSICIÓN DE LA TIRADA */}
              {resumenCola && (
                <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 flex-wrap font-semibold text-slate-700">
                    <span>📊 {resumenCola.modo ? `${resumenCola.modo}:` : `Composición de la tirada (${resumenCola.total} preg):`}</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-800 font-bold">
                      {resumenCola.deTema} Desgloses MIR
                    </span>
                    {resumenCola.simulacrosAsig > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold">
                        +{resumenCola.simulacrosAsig} Sims / Evaluaciones CTO
                      </span>
                    )}
                    {resumenCola.rellenoAsig > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-bold">
                        +{resumenCola.rellenoAsig} Reserva Test 2V / Asignatura
                      </span>
                    )}
                    {resumenCola.rellenoGlobal > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                        +{resumenCola.rellenoGlobal} Latencia / Repaso P80
                      </span>
                    )}
                  </div>
                  {modoExamen && (
                    <span className="text-[11px] font-bold text-slate-500">
                      🎯 Modo Examen: sin spoilers hasta finalizar
                    </span>
                  )}
                </div>
              )}
              
              {/* NAVEGADOR DE PREGUNTAS (REJILLA) */}
              <div className="flex flex-wrap gap-2 mb-6 p-4 bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
                {cola.map((q, idx) => {
                  const estado = respuestasDesglose[q.id];
                  let bgColor = "bg-white text-slate-500 border-slate-200 hover:border-cyan-400";
                  
                  if (estado) {
                    if (estado.skipped) {
                      bgColor = "bg-slate-200 text-slate-500 border-slate-300";
                    } else if (modoExamen) {
                      // En Modo Examen NO revelamos si acertó o falló; pintamos según su confianza
                      if (estado.confidence === 'orange') {
                        bgColor = "bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-2xs";
                      } else if (estado.confidence === 'red') {
                        bgColor = "bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-2xs";
                      } else {
                        bgColor = "bg-cyan-100 text-cyan-800 border-cyan-300 font-bold shadow-2xs";
                      }
                    } else {
                      if (estado.isCorrect) bgColor = "bg-emerald-100 text-emerald-700 border-emerald-200 font-bold shadow-sm";
                      else bgColor = "bg-red-100 text-red-700 border-red-200 font-bold shadow-sm";
                    }
                  }
                  
                  if (idx === currentIndex) {
                    bgColor += " ring-2 ring-cyan-500 ring-offset-2 scale-110 shadow-md";
                  }
                  
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={`w-9 h-9 rounded-full border text-xs flex items-center justify-center transition-all ${bgColor}`}
                      title={
                        estado && !estado.skipped && modoExamen
                          ? `Pregunta ${idx + 1}: Marcada ${estado.selectedLetter} (Confianza: ${estado.confidence})`
                          : `Pregunta ${idx + 1}`
                      }
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>

              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="bg-cyan-100 text-cyan-800 text-xs font-bold px-2.5 py-1 rounded uppercase tracking-wide">
                    {currentQuestionData.asignatura}
                  </span>
                  {currentQuestionData.tema && (
                    <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded">
                      {currentQuestionData.tema}
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'evaluacion_cto' && (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      📝 Evaluación CTO
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'simulacro_asignatura' && (
                    <span className="bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      🧪 Simulacro CTO
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'relleno_asignatura' && (
                    <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      ➕ Relleno Asignatura
                    </span>
                  )}
                  {currentQuestionData.origenTirada === 'relleno_global' && (
                    <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold px-2 py-0.5 rounded">
                      🔄 Relleno Adaptativo
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-medium ml-1">
                    {currentQuestionData.convocatoria} (Dif: {currentQuestionData.dificultad})
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-500">
                  {currentIndex + 1} / {cola.length}
                </div>
              </div>

              {/* AVISO SI VUELVE A UNA PREGUNTA YA CONTESTADA EN MODO EXAMEN */}
              {modoExamen && currentAnswer && !currentAnswer.skipped && (
                <div className="px-4 py-2.5 rounded-xl bg-cyan-50 border border-cyan-200 text-cyan-900 text-xs font-bold flex items-center justify-between">
                  <span>
                    📌 Ya marcaste la opción <strong>{currentAnswer.selectedLetter}</strong> (Seguridad: {currentAnswer.confidence === 'green' ? 'Verde' : currentAnswer.confidence === 'orange' ? 'Dudosa' : 'Rojo'}). Puedes cambiarla si lo deseas.
                  </span>
                  <button
                    type="button"
                    onClick={() => handleNext()}
                    className="text-cyan-700 hover:underline ml-4"
                  >
                    Siguiente →
                  </button>
                </div>
              )}

              {/* QUESTION CARD */}
              <div className={!modoExamen && currentAnswer ? 'opacity-50 pointer-events-none transition-opacity' : ''}>
                <QuestionCard 
                  key={currentQuestionData.id} 
                  question={questionForCard} 
                  onAnswer={handleAnswerSubmit} 
                  onNext={() => handleNext()}
                  examMode={modoExamen}
                  initialAnswer={modoExamen ? currentAnswer : null}
                />
              </div>

              {/* MODO TUTOR INMEDIATO (Solo visible si modoExamen === false) */}
              {!modoExamen && currentAnswer && !currentAnswer.skipped && (
                <div className={`p-5 rounded-xl border mt-6 animate-in fade-in slide-in-from-top-2 ${
                  currentAnswer.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{currentAnswer.isCorrect ? '🎉' : '❌'}</span>
                    <h4 className={`text-lg font-bold ${currentAnswer.isCorrect ? 'text-emerald-800' : 'text-red-800'}`}>
                      {currentAnswer.isCorrect ? '¡Has acertado!' : 'Has fallado'}
                    </h4>
                  </div>
                  
                  {!currentAnswer.isCorrect && (
                    <div className="mb-3 space-y-1">
                      <p className="text-red-700 font-medium">
                        Marcaste la {currentAnswer.selectedLetter}, pero la correcta era la <strong className="font-black bg-white/50 px-1 rounded">{currentAnswer.correctLetter}</strong>.
                      </p>
                      {currentAnswer.discardedCorrect && (
                        <p className="text-red-900 font-bold text-sm bg-red-100 p-2 rounded-lg inline-block border border-red-200">
                          ⚠️ ¡Descartaste la respuesta correcta! Esta pregunta se ha registrado automáticamente como "Rojo" para tus futuros repasos.
                        </p>
                      )}
                    </div>
                  )}
                  
                  <NotaPersonal
                    preguntaId={currentQuestionData.id}
                    nota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                    onGuardar={guardarNota}
                  />

                  <TutorGemini
                    question={currentQuestionData}
                    userAnswer={currentAnswer.selectedLetter}
                    isCorrect={currentAnswer.isCorrect}
                    confidence={currentAnswer.confidence}
                    discardedOptions={currentAnswer.discardedOptions || []}
                    userReasoning={currentAnswer.justificacion || ''}
                    commentary={currentQuestionData.comentario}
                    onGuardarNota={guardarNota}
                    currentNota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
                  />

                  {currentQuestionData.comentario && (
                    <div className="mt-4 bg-white/80 p-5 rounded-xl border border-slate-200">
                      <div className="font-black uppercase tracking-wider text-xs text-slate-500 mb-2">Comentario Oficial CTO</div>
                      <div
                        className="comentario-html text-base sm:text-[17px] text-slate-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: currentQuestionData.comentario }}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex justify-end">
                    <button 
                      type="button"
                      onClick={() => handleNext()}
                      className="bg-slate-900 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                    >
                      <span>{currentIndex >= cola.length - 1 ? 'Finalizar Desglose 🎉' : 'Siguiente Pregunta →'}</span>
                      <kbd className="hidden sm:inline-block font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                        Enter ↵
                      </kbd>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
