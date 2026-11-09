import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import { getOrCreateAnonUserId, createQuizResult, enqueueQuestionStat, flushOfflineSyncQueue } from '../utils/quizSync';
import { construirPayloadTirada, guardarTiradaParaChat, descargarTiradaJSON, copiarTiradaAlPortapapeles } from '../utils/tiradaStorage';
import {
  getBancoUnificado,
  filtrarPreguntas,
  getCanonicalId,
  getPreguntaPorId,
  getTemasPorAsignatura,
  getSubtemasPorTema,
  getStatsResumen,
  getPrioridadPedagogica,
  seleccionarPorCupoPrioritario,
  normalizeAsignaturaToDesgloses,
  normText,
  CODIGO_TO_APP_ASIG
} from '../lib/bancoUnificado';
import { getAnalisisPrioridadesTemas, getRankingTemasDeAsignatura } from '../lib/prioridadesTemas';
import planDetalladoData from '../data/planDiarioDetallado.json';
import QuestionCard from '../components/quiz/QuestionCard';
import NotaPersonal from '../components/quiz/NotaPersonal';
import TutorGemini from '../components/quiz/TutorGemini';
import SyncStatusBanner from '../components/quiz/SyncStatusBanner';
import DailyRecommendations from '../components/dashboard/DailyRecommendations';

// Helper for session storage
const getSession = (key, defaultVal) => {
  try {
    const saved = sessionStorage.getItem(`mir_tirador_${key}`);
    return saved ? JSON.parse(saved) : defaultVal;
  } catch (e) {
    return defaultVal;
  }
};

const setSession = (key, val) => {
  try {
    sessionStorage.setItem(`mir_tirador_${key}`, JSON.stringify(val));
  } catch (e) {}
};

// Fisher-Yates true shuffle
function barajarCola(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Convert 1-based index to option letter
const numToLetter = (num) => ['A', 'B', 'C', 'D', 'E'][num - 1] || String(num);

export default function TiradorMaestro({
  initialFiltros = null,
  initialFilters = null,
  onFiltrosConsumed = null,
  onFiltersConsumed = null,
  mode = 'master',
  fuenteDefault = 'todas',
  setTab = null
}) {
  const {
    stats,
    isSyncing,
    registrarRespuesta,
    marcarEstado,
    getStatsPregunta,
    guardarNota,
    archivarPregunta,
    isArchivada,
    isEnLatencia
  } = usePreguntasStats();

  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [syncState, setSyncState] = useState(null);
  const [chatExportStatus, setChatExportStatus] = useState(null);
  const [ultimaTiradaPayload, setUltimaTiradaPayload] = useState(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Active Mode: 'motor1' | 'motor2' | 'motor3' | 'adaptativo' | 'custom'
  const [currentMode, setCurrentMode] = useState(() => {
    const saved = getSession('currentMode', null);
    if (saved) return saved;
    if (mode === 'adaptativo') return 'adaptativo';
    if (mode === 'desgloses') return 'motor1';
    if (mode === 'custom' || mode === 'quiz') return 'custom';
    return 'motor1';
  });

  useEffect(() => {
    setSession('currentMode', currentMode);
  }, [currentMode]);

  // Exam mode: blind by default (true MIR simulation), togglable to Tutor mode
  const [modoExamen, setModoExamen] = useState(() => {
    try {
      const saved = localStorage.getItem('mir_tirador_modo_examen');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('mir_tirador_modo_examen', String(modoExamen));
    } catch {}
  }, [modoExamen]);

  // Multi-select definitions
  const ALL_FUENTES = useMemo(() => [
    { id: 'mir', label: 'MIR Oficial (Desgloses)' },
    { id: 'simulacros', label: 'Simulacros CTO' },
    { id: 'evaluaciones', label: 'Evaluaciones Campus' },
    { id: 'test2v', label: 'Test 2ª Vuelta CTO' },
  ], []);

  const ALL_HORQUILLAS = useMemo(() => [
    { id: 'B1', label: 'Bloque 1 (≥70% Fallos Prohibidos)' },
    { id: 'B2', label: 'Bloque 2 (50–69% Asequibles)' },
    { id: 'B3', label: 'Bloque 3 (35–49% Discriminatorias)' },
    { id: 'B4', label: 'Bloque 4 (<35% Rarezas)' },
  ], []);

  // Faceted Filters State
  const [filtros, setFiltros] = useState(() => {
    const defaultFiltros = {
      fuentes: (fuenteDefault && fuenteDefault !== 'todas') ? [fuenteDefault] : ['todas'],
      fuente: fuenteDefault || 'todas',
      horquillasP80: ['todas'],
      horquillaP80: 'todas',
      estadoPersonal: 'todas',
      asignaturas: ['Digestivo'],
      asignatura: 'Digestivo',
      temas: [],
      subtema: '',
      dificultad: [1, 2, 3, 4, 5],
      tamanoTirada: 75,
      ordenPreguntas: 'prioridad',
      soloFalladas: false
    };
    const saved = getSession('filtros', defaultFiltros);
    if (saved) {
      if (!saved.ordenPreguntas) {
        saved.ordenPreguntas = 'prioridad';
      }
      if (!saved.fuentes) {
        saved.fuentes = (saved.fuente && saved.fuente !== 'todas') ? (Array.isArray(saved.fuente) ? saved.fuente : [saved.fuente]) : ['todas'];
      }
      if (!saved.horquillasP80) {
        saved.horquillasP80 = (saved.horquillaP80 && saved.horquillaP80 !== 'todas')
          ? (Array.isArray(saved.horquillaP80) ? saved.horquillaP80 : [saved.horquillaP80])
          : ['todas'];
      }
      if (!saved.asignaturas) {
        saved.asignaturas = (saved.asignatura && saved.asignatura !== 'Todas')
          ? (Array.isArray(saved.asignatura) ? saved.asignatura : [saved.asignatura])
          : [];
      }
      if (!Array.isArray(saved.temas)) {
        saved.temas = saved.tema ? [saved.tema] : [];
      }
    }
    return saved || defaultFiltros;
  });

  const [asigSearch, setAsigSearch] = useState('');

  useEffect(() => {
    setSession('filtros', filtros);
  }, [filtros]);

  // Multi-selection helpers
  const isFuenteActiva = useCallback((id) => {
    const current = Array.isArray(filtros.fuentes) && filtros.fuentes.length > 0
      ? filtros.fuentes
      : (filtros.fuente && filtros.fuente !== 'todas' ? [filtros.fuente] : ['todas']);
    if (id === 'todas') {
      return current.includes('todas') || current.length >= ALL_FUENTES.length;
    }
    if (current.includes('todas')) return true;
    return current.includes(id);
  }, [filtros.fuentes, filtros.fuente, ALL_FUENTES]);

  const toggleFuente = useCallback((id) => {
    setFiltros(prev => {
      const current = Array.isArray(prev.fuentes) && prev.fuentes.length > 0
        ? prev.fuentes
        : (prev.fuente && prev.fuente !== 'todas' ? [prev.fuente] : ['todas']);

      if (id === 'todas') {
        return { ...prev, fuentes: ['todas'], fuente: 'todas' };
      }

      let next;
      if (current.includes('todas')) {
        next = [id];
      } else if (current.includes(id)) {
        next = current.filter(x => x !== id);
        if (next.length === 0) next = ['todas'];
      } else {
        next = [...current, id];
        if (next.length >= ALL_FUENTES.length) next = ['todas'];
      }

      return {
        ...prev,
        fuentes: next,
        fuente: next.includes('todas') ? 'todas' : (next[0] || 'todas')
      };
    });
  }, [ALL_FUENTES]);

  const isHorquillaActiva = useCallback((id) => {
    const current = Array.isArray(filtros.horquillasP80) && filtros.horquillasP80.length > 0
      ? filtros.horquillasP80
      : (Array.isArray(filtros.horquillaP80) && filtros.horquillaP80.length > 0
        ? filtros.horquillaP80
        : (filtros.horquillaP80 && filtros.horquillaP80 !== 'todas' ? [filtros.horquillaP80] : ['todas']));
    if (id === 'todas') {
      return current.includes('todas') || current.length >= ALL_HORQUILLAS.length;
    }
    if (current.includes('todas')) return true;
    return current.includes(id);
  }, [filtros.horquillasP80, filtros.horquillaP80, ALL_HORQUILLAS]);

  const toggleHorquillaP80 = useCallback((id) => {
    setFiltros(prev => {
      const current = Array.isArray(prev.horquillasP80) && prev.horquillasP80.length > 0
        ? prev.horquillasP80
        : (Array.isArray(prev.horquillaP80) && prev.horquillaP80.length > 0
          ? prev.horquillaP80
          : (prev.horquillaP80 && prev.horquillaP80 !== 'todas' ? [prev.horquillaP80] : ['todas']));

      if (id === 'todas') {
        return { ...prev, horquillasP80: ['todas'], horquillaP80: 'todas' };
      }

      let next;
      if (current.includes('todas')) {
        next = [id];
      } else if (current.includes(id)) {
        next = current.filter(x => x !== id);
        if (next.length === 0) next = ['todas'];
      } else {
        next = [...current, id];
        if (next.length >= ALL_HORQUILLAS.length) next = ['todas'];
      }

      return {
        ...prev,
        horquillasP80: next,
        horquillaP80: next.includes('todas') ? 'todas' : next
      };
    });
  }, [ALL_HORQUILLAS]);

  const toggleTema = useCallback((tema) => {
    setFiltros(prev => {
      const currentTemas = Array.isArray(prev.temas) ? prev.temas : [];
      const exists = currentTemas.includes(tema);
      const nextTemas = exists ? currentTemas.filter(x => x !== tema) : [...currentTemas, tema];
      return {
        ...prev,
        temas: nextTemas,
        subtema: nextTemas.length === 1 ? prev.subtema : ''
      };
    });
  }, []);

  // Quiz Execution State
  const [cola, setCola] = useState(() => getSession('cola', []));
  const [currentIndex, setCurrentIndex] = useState(() => getSession('currentIndex', 0));
  const [respuestasDesglose, setRespuestasDesglose] = useState(() => getSession('respuestas', {}));
  const [resumenCola, setResumenCola] = useState(() => getSession('resumenCola', null));
  const [quizFinished, setQuizFinished] = useState(() => getSession('quizFinished', false));

  useEffect(() => { setSession('cola', cola); }, [cola]);
  useEffect(() => { setSession('currentIndex', currentIndex); }, [currentIndex]);
  useEffect(() => { setSession('respuestas', respuestasDesglose); }, [respuestasDesglose]);
  useEffect(() => { setSession('resumenCola', resumenCola); }, [resumenCola]);
  useEffect(() => { setSession('quizFinished', quizFinished); }, [quizFinished]);

  // Online / Offline listener
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

  // List of unique canonical subjects
  const catalogoAsignaturas = useMemo(() => {
    const all = Object.values(CODIGO_TO_APP_ASIG);
    return [...new Set(all)].sort();
  }, []);

  const isAsignaturaActiva = useCallback((asig) => {
    const list = Array.isArray(filtros.asignaturas)
      ? filtros.asignaturas
      : (filtros.asignatura && filtros.asignatura !== 'Todas' && filtros.asignatura !== 'Varias' ? [filtros.asignatura] : []);

    if (asig === 'Todas') {
      return list.length === 0;
    }
    return list.includes(asig);
  }, [filtros.asignaturas, filtros.asignatura]);

  const toggleAsignatura = useCallback((asig) => {
    setFiltros(prev => {
      const current = Array.isArray(prev.asignaturas)
        ? prev.asignaturas
        : (prev.asignatura && prev.asignatura !== 'Todas' && prev.asignatura !== 'Varias' ? [prev.asignatura] : []);

      if (asig === 'Todas') {
        return {
          ...prev,
          asignaturas: [],
          asignatura: 'Todas',
          temas: [],
          subtema: ''
        };
      }

      const exists = current.includes(asig);
      const next = exists ? current.filter(x => x !== asig) : [...current, asig];
      return {
        ...prev,
        asignaturas: next,
        asignatura: next.length === 1 ? next[0] : (next.length === 0 ? 'Todas' : 'Varias'),
        temas: next.length === 1 ? prev.temas : [],
        subtema: next.length === 1 ? prev.subtema : ''
      };
    });
  }, []);

  // Subject active for theme inspection (when exactly 1 is chosen)
  const singleAsignaturaActiva = useMemo(() => {
    if (Array.isArray(filtros.asignaturas) && filtros.asignaturas.length === 1) {
      return filtros.asignaturas[0];
    }
    if (filtros.asignatura && filtros.asignatura !== 'Todas' && filtros.asignatura !== 'Varias') {
      return filtros.asignatura;
    }
    return null;
  }, [filtros.asignaturas, filtros.asignatura]);

  // Available topics for currently selected subject
  const temasDisponibles = useMemo(() => {
    if (!singleAsignaturaActiva) return [];
    return getTemasPorAsignatura(singleAsignaturaActiva);
  }, [singleAsignaturaActiva]);

  // Priority ranking for topics of selected subject
  const rankingTemas = useMemo(() => {
    if (!singleAsignaturaActiva) return [];
    try {
      return getRankingTemasDeAsignatura(singleAsignaturaActiva) || [];
    } catch {
      return [];
    }
  }, [singleAsignaturaActiva]);

  // Available subtopics for selected topic
  const subtemasDisponibles = useMemo(() => {
    if (!singleAsignaturaActiva || !filtros.temas || filtros.temas.length !== 1) return [];
    return getSubtemasPorTema(singleAsignaturaActiva, filtros.temas[0]);
  }, [singleAsignaturaActiva, filtros.temas]);

  // Global pool of canonical questions
  const bancoCompleto = useMemo(() => getBancoUnificado(), []);

  // Status helper
  const isPreguntaHecha = useCallback((id) => {
    const canonId = getCanonicalId(id);
    const s = stats[canonId] || stats[id];
    return Boolean(s && s.vecesVistas > 0);
  }, [stats]);

  // Match topic flexible
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

  // Extract today's plan block from planDiarioDetallado.json
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
        return plan.bloques.find(b => b.categoria === 'test' && (b.id?.includes('m') || b.id?.includes('1') || b.hora?.includes('11:00'))) || null;
      }
      return plan.bloques.find(b => b.categoria === 'test' && (b.id?.includes('t') || b.id?.includes('2') || b.hora?.includes('17:10'))) || null;
    } catch {
      return null;
    }
  };

  // Helper to start a new test session
  const iniciarNuevaCola = useCallback((nuevaCola, resumen) => {
    if (!nuevaCola || nuevaCola.length === 0) {
      alert('No se encontraron preguntas que coincidan con los filtros seleccionados.');
      return;
    }
    setCola(nuevaCola);
    setResumenCola(resumen);
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
    setUltimaTiradaPayload(null);
  }, []);

  // --------------------------------------------------------------------------
  // MOTOR 1: Mañana 75p (Consolidación Post-Estudio)
  // --------------------------------------------------------------------------
  const lanzarMotor1 = useCallback(() => {
    const planBlock = getTodayPlanBlock('manana');
    // Prioritize user's explicit selection in filtros.asignatura
    const asig = (filtros.asignatura && filtros.asignatura !== 'Todas')
      ? filtros.asignatura
      : (planBlock?.asignatura || catalogoAsignaturas[0] || 'Digestivo');
    const asigNorm = normText(asig);
    const matchesAsig = (q) => q.asignatura === asig || (q._normAsig || normText(q.asignatura)) === asigNorm;

    const isTodaySubject = Boolean(planBlock && normText(planBlock.asignatura) === asigNorm);
    const planTemas = isTodaySubject
      ? [
          ...(planBlock?.temasNucleares || []),
          ...(planBlock?.temasSatelite || [])
        ]
      : [];

    const temasElegidos = (filtros.temas && filtros.temas.length > 0)
      ? filtros.temas
      : planTemas;
    const temasNormSet = new Set(temasElegidos.map(normText));
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countMir = 0;
    let countFallosCTO = 0;
    let countP80 = 0;

    const esDisponible = (q) => !isArchivada(q.id) && !usados.has(q.id) && !(isEnLatencia && isEnLatencia(q.id));

    // 1. Desgloses MIR oficiales de los temas seleccionados (vírgenes primero)
    const mirTema = bancoCompleto.filter(q =>
      matchesAsig(q) &&
      (q.es_oficial_mir || q.fuentes.includes('mir')) &&
      (q.anualidad || q.año || 0) >= 2010 &&
      matchTemaFlexible(q.tema, q.subtema, temasNormSet) &&
      esDisponible(q)
    );
    const mirNoHechas = mirTema.filter(q => !isPreguntaHecha(q.id));
    const mirRepaso = mirTema.filter(q => isPreguntaHecha(q.id));

    [...mirNoHechas, ...mirRepaso].slice(0, 48).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'tema_estudiado' });
      usados.add(q.id);
      countMir++;
    });

    // 2. Fallos y Blancas en Simulacros (>=35% pob) y Evaluaciones (>=40% pob) de esos temas
    const fallosTema = bancoCompleto.filter(q =>
      matchesAsig(q) &&
      q.fallada_cto &&
      (
        (q.fuentes.includes('simulacro') && (q.pct_pob ?? 50) >= 35) ||
        (q.fuentes.includes('evaluacion') && (q.pct_pob ?? 50) >= 40)
      ) &&
      matchTemaFlexible(q.tema, q.subtema, temasNormSet) &&
      esDisponible(q)
    ).sort((a, b) => (b.pct_pob || 50) - (a.pct_pob || 50));

    fallosTema.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'fallo_cto_tema' });
      usados.add(q.id);
      countFallosCTO++;
    });

    // 3. Complementar hasta 75 con Simulacros P80 (40-78% pob), Evaluaciones y Test 2V
    if (seleccion.length < cupo) {
      const p80Tema = bancoCompleto.filter(q =>
        matchesAsig(q) &&
        (
          (q.fuentes.includes('simulacro') && (q.pct_pob ?? 50) >= 40 && (q.pct_pob ?? 50) <= 78) ||
          (q.fuentes.includes('evaluacion') && (q.pct_pob ?? 50) >= 40) ||
          q.fuentes.includes('test2v') ||
          (q.es_oficial_mir && (q.anualidad || q.año || 0) >= 2010 && !isPreguntaHecha(q.id))
        ) &&
        esDisponible(q)
      );

      p80Tema.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: 'relleno_p80' });
        usados.add(q.id);
        countP80++;
      });
    }

    // 4. Si aún no llega al cupo (ej. asignaturas pequeñas o filtros de tema agotados), completar con preguntas disponibles de la asignatura
    if (seleccion.length < cupo) {
      const restoAsig = bancoCompleto.filter(q => matchesAsig(q) && esDisponible(q));
      restoAsig.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: 'resto_asignatura' });
        usados.add(q.id);
      });
    }

    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌅 Motor 1 · Mañana ${asig} (75p)`,
      total: seleccion.length,
      deTema: countMir,
      simulacrosAsig: countFallosCTO,
      rellenoAsig: countP80,
      rellenoGlobal: 0
    });
  }, [filtros.asignatura, filtros.temas, catalogoAsignaturas, temasDisponibles, bancoCompleto, isArchivada, isEnLatencia, isPreguntaHecha, iniciarNuevaCola]);

  // --------------------------------------------------------------------------
  // MOTOR 2: Tarde 75p (Barrido de Asignatura)
  // --------------------------------------------------------------------------
  const lanzarMotor2 = useCallback(() => {
    const planBlock = getTodayPlanBlock('tarde');
    // Prioritize user's explicit selection in filtros.asignatura
    const asig = (filtros.asignatura && filtros.asignatura !== 'Todas')
      ? filtros.asignatura
      : (planBlock?.asignatura || catalogoAsignaturas[0] || 'Digestivo');
    const asigNorm = normText(asig);
    const matchesAsig = (q) => q.asignatura === asig || (q._normAsig || normText(q.asignatura)) === asigNorm;

    const isTodaySubject = Boolean(planBlock && normText(planBlock.asignatura) === asigNorm);
    const planTemas = isTodaySubject
      ? [
          ...(planBlock?.temasNucleares || []),
          ...(planBlock?.temasSatelite || [])
        ]
      : [];

    const temasElegidos = (filtros.temas && filtros.temas.length > 0)
      ? filtros.temas
      : planTemas;
    const temasNormSet = new Set(temasElegidos.map(normText));
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countMir = 0;
    let countFallos = 0;
    let countP80 = 0;

    const esDisponible = (q) => !isArchivada(q.id) && !usados.has(q.id) && !(isEnLatencia && isEnLatencia(q.id));

    // 1. Desgloses MIR oficiales de temas elegidos (o de toda la asignatura)
    const mirTema = bancoCompleto.filter(q =>
      matchesAsig(q) &&
      (q.es_oficial_mir || q.fuentes.includes('mir')) &&
      (q.anualidad || q.año || 0) >= 2010 &&
      matchTemaFlexible(q.tema, q.subtema, temasNormSet) &&
      esDisponible(q)
    );
    const mirNoHechas = mirTema.filter(q => !isPreguntaHecha(q.id));
    const mirRepaso = mirTema.filter(q => isPreguntaHecha(q.id));

    [...mirNoHechas, ...mirRepaso].slice(0, 48).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'tema_estudiado' });
      usados.add(q.id);
      countMir++;
    });

    // 2. Fallos en Simulacros y Evaluaciones de toda la asignatura
    const fallosAsig = bancoCompleto.filter(q =>
      matchesAsig(q) &&
      q.fallada_cto &&
      (
        (q.fuentes.includes('simulacro') && (q.pct_pob ?? 50) >= 35) ||
        (q.fuentes.includes('evaluacion') && (q.pct_pob ?? 50) >= 40)
      ) &&
      esDisponible(q)
    ).sort((a, b) => (b.pct_pob || 50) - (a.pct_pob || 50));

    fallosAsig.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'fallo_cto_asignatura' });
      usados.add(q.id);
      countFallos++;
    });

    // 3. Completar hasta 75 con Simulacros P80, Evaluaciones y Test 2V
    if (seleccion.length < cupo) {
      const complemento = bancoCompleto.filter(q =>
        matchesAsig(q) &&
        (
          (q.es_oficial_mir && (q.anualidad || q.año || 0) >= 2010 && !isPreguntaHecha(q.id)) ||
          (q.fuentes.includes('simulacro') && (q.pct_pob ?? 50) >= 40 && (q.pct_pob ?? 50) <= 78 && !isPreguntaHecha(q.id)) ||
          (q.fuentes.includes('evaluacion') && (q.pct_pob ?? 50) >= 40 && !isPreguntaHecha(q.id)) ||
          (q.fuentes.includes('test2v') && !isPreguntaHecha(q.id))
        ) &&
        esDisponible(q)
      );

      complemento.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: 'relleno_asignatura' });
        usados.add(q.id);
        countP80++;
      });
    }

    // 4. Si aún no llega al cupo (ej. asignaturas pequeñas), completar con preguntas disponibles de la asignatura
    if (seleccion.length < cupo) {
      const restoAsig = bancoCompleto.filter(q => matchesAsig(q) && esDisponible(q));
      restoAsig.slice(0, cupo - seleccion.length).forEach(q => {
        seleccion.push({ ...q, origenTirada: 'resto_asignatura' });
        usados.add(q.id);
      });
    }

    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌤️ Motor 2 · Tarde ${asig} (75p)`,
      total: seleccion.length,
      deTema: countMir,
      simulacrosAsig: countFallos,
      rellenoAsig: countP80,
      rellenoGlobal: 0
    });
  }, [filtros.asignatura, filtros.temas, catalogoAsignaturas, temasDisponibles, bancoCompleto, isArchivada, isEnLatencia, isPreguntaHecha, iniciarNuevaCola]);

  // --------------------------------------------------------------------------
  // MOTOR 3: Mixto P80 con Pregunta Hermana y Cuota Huérfanas
  // --------------------------------------------------------------------------
  const lanzarMotor3 = useCallback(() => {
    const asigExcluida = filtros.asignatura || '';
    const cupo = 75;
    const usados = new Set();
    const seleccion = [];

    let countLatencia = 0;
    let countHuerfanas = 0;
    let countFallosP80 = 0;
    let countMirGlobal = 0;

    const esDisponibleOtraAsig = (q) =>
      q.asignatura !== asigExcluida &&
      !isArchivada(q.id) &&
      !usados.has(q.id) &&
      !(isEnLatencia && isEnLatencia(q.id));

    // 1. Repaso Espaciado: Vencidas de Latencia + Pregunta Hermana
    const vencidasPrioritarias = bancoCompleto.filter(q => {
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
      // 1º Mismo subtema exacto virgen
      if (targetSub && targetSub.length > 3) {
        const porSubtema = bancoCompleto.find(cand =>
          cand.id !== qBase.id &&
          cand.asignatura === qBase.asignatura &&
          !isPreguntaHecha(cand.id) &&
          esDisponibleOtraAsig(cand) &&
          normText(cand.subtema) === targetSub
        );
        if (porSubtema) return porSubtema;
      }
      // 2º Mismo tema virgen (MIR >=2015 o Sim >=45% pob)
      if (targetTema && targetTema.length > 3 && targetTema !== 'general') {
        const porTema = bancoCompleto.find(cand =>
          cand.id !== qBase.id &&
          cand.asignatura === qBase.asignatura &&
          !isPreguntaHecha(cand.id) &&
          esDisponibleOtraAsig(cand) &&
          matchTemaFlexible(cand.tema, cand.subtema, new Set([targetTema])) &&
          ((cand.anualidad || cand.año || 0) >= 2015 || (cand.pct_pob ?? 60) >= 45)
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

      if (countLatencia < maxLatencia) {
        const hermana = buscarPreguntaHermana(q);
        if (hermana) {
          seleccion.push({ ...hermana, origenTirada: 'pregunta_hermana', hermanaDeId: q.id });
          usados.add(hermana.id);
          countLatencia++;
        }
      }
    });

    // 2. Cuota protegida para 9 Asignaturas Huérfanas (0 días lectivos en 3ª Vuelta)
    const ASIGNATURAS_HUERFANAS = new Set([
      'Otorrinolaringología', 'Urgencias', 'Genética', 'Fisiología',
      'Farmacología', 'Bioquímica', 'Alergología', 'Rehabilitación', 'Anatomía'
    ]);

    const poolHuerfanas = bancoCompleto.filter(q =>
      ASIGNATURAS_HUERFANAS.has(q.asignatura) &&
      !isPreguntaHecha(q.id) &&
      esDisponibleOtraAsig(q)
    );

    poolHuerfanas.slice(0, Math.min(12, cupo - seleccion.length)).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'huerfana_absorcion' });
      usados.add(q.id);
      countHuerfanas++;
    });

    // 3. Hasta 25 Fallos P80 (>=50% pob) ponderados por vulnerabilidad global
    const { rankingAsignaturas } = getAnalisisPrioridadesTemas();
    const scoreAsigMap = new Map(rankingAsignaturas.map(r => [r.asignatura, r.totalScore]));

    const fallosGlobalesP80 = bancoCompleto.filter(q =>
      q.fallada_cto &&
      (q.pct_pob ?? 50) >= 50 &&
      !isPreguntaHecha(q.id) &&
      esDisponibleOtraAsig(q)
    ).sort((a, b) => {
      const sa = (scoreAsigMap.get(a.asignatura) || 10) * ((a.pct_pob || 50) / 100);
      const sb = (scoreAsigMap.get(b.asignatura) || 10) * ((b.pct_pob || 50) / 100);
      return sb - sa;
    });

    fallosGlobalesP80.slice(0, Math.min(25, cupo - seleccion.length)).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'fallo_p80_global' });
      usados.add(q.id);
      countFallosP80++;
    });

    // 4. Absorción de déficit: Desgloses MIR 2015-2025 y Test 2V
    const poolDeficit = bancoCompleto.filter(q =>
      (q.es_oficial_mir || q.fuentes.includes('test2v')) &&
      (q.anualidad || q.año || 0) >= 2015 &&
      !isPreguntaHecha(q.id) &&
      esDisponibleOtraAsig(q)
    );

    poolDeficit.slice(0, cupo - seleccion.length).forEach(q => {
      seleccion.push({ ...q, origenTirada: 'tema_estudiado' });
      usados.add(q.id);
      countMirGlobal++;
    });

    iniciarNuevaCola(barajarCola(seleccion), {
      modo: `🌍 Motor 3 · Mixto P80 (75p${asigExcluida ? ` · sin ${asigExcluida}` : ''})`,
      total: seleccion.length,
      deTema: countMirGlobal,
      simulacrosAsig: countFallosP80,
      rellenoAsig: countHuerfanas,
      rellenoGlobal: countLatencia
    });
  }, [filtros.asignatura, bancoCompleto, isArchivada, isEnLatencia, isPreguntaHecha, getStatsPregunta, iniciarNuevaCola]);

  // --------------------------------------------------------------------------
  // TIRADA PERSONALIZADA / LIBRE CON FILTROS FACETADOS
  // --------------------------------------------------------------------------
  const generarColaPersonalizada = useCallback((filtrosOverrides = null) => {
    const f = { ...filtros, ...(filtrosOverrides || {}) };

    const fuentesArray = Array.isArray(f.fuentes) && !f.fuentes.includes('todas')
      ? f.fuentes
      : (f.fuente && f.fuente !== 'todas' ? (Array.isArray(f.fuente) ? f.fuente : [f.fuente]) : null);

    const horquillas = Array.isArray(f.horquillasP80) && f.horquillasP80.length > 0
      ? f.horquillasP80
      : (Array.isArray(f.horquillaP80) && f.horquillaP80.length > 0
        ? f.horquillaP80
        : (f.horquillaP80 && f.horquillaP80 !== 'todas' ? [f.horquillaP80] : ['todas']));
    const horquillasArray = !horquillas.includes('todas') ? horquillas : null;

    const asigArray = Array.isArray(f.asignaturas) && f.asignaturas.length > 0
      ? f.asignaturas
      : (f.asignatura && f.asignatura !== 'Todas' && f.asignatura !== 'Varias' ? (Array.isArray(f.asignatura) ? f.asignatura : [f.asignatura]) : null);

    const queryFilters = {
      fuentes: fuentesArray,
      horquillaP80: horquillasArray,
      asignaturas: asigArray,
      estadoPersonal: f.estadoPersonal && f.estadoPersonal !== 'todas' ? f.estadoPersonal : null,
      subtema: (f.temas && f.temas.length === 1 && f.subtema) ? f.subtema : null,
      soloFalladas: Boolean(f.soloFalladas)
    };

    let candidatas = filtrarPreguntas(queryFilters);

    // Multi-topic filtering
    if (f.temas && f.temas.length > 0) {
      const temasSet = new Set(f.temas.map(normText));
      candidatas = candidatas.filter(q => matchTemaFlexible(q.tema, q.subtema, temasSet));
    }

    // Difficulty filtering
    if (f.dificultad && f.dificultad.length > 0 && f.dificultad.length < 5) {
      candidatas = candidatas.filter(q => f.dificultad.includes(q.dificultad || 3));
    }

    // Limit length and prioritize questions pedagogically:
    // 1. Desgloses 2025-2015
    // 2. Simulacros CTO
    // 3. Desgloses 2015-2010
    // 4. Evaluaciones CTO
    // 5. Preguntas Segunda Vuelta
    const limit = f.tamanoTirada ? Number(f.tamanoTirada) : null;
    const esAleatorio = f.ordenPreguntas === 'aleatorio';

    const { seleccion: resultado, conteoTiers } = seleccionarPorCupoPrioritario(candidatas, limit, {
      barajarResultado: esAleatorio,
      barajarDentroDeTier: false
    });

    const ordenLabel = esAleatorio ? 'Barajadas' : 'Prioridad Pedagógica';

    iniciarNuevaCola(resultado, {
      modo: `🛠️ Tirada Personalizada (${resultado.length}p · ${ordenLabel})`,
      total: resultado.length,
      deTema: resultado.length,
      simulacrosAsig: 0,
      rellenoAsig: 0,
      rellenoGlobal: 0,
      conteoTiers,
      ordenPreguntas: f.ordenPreguntas || 'prioridad'
    });
  }, [filtros, iniciarNuevaCola]);

  // --------------------------------------------------------------------------
  // INGEST EXTERNAL FILTERS PROPS (from Simulacros handlePracticar, Inicio, EvaluacionP80)
  // --------------------------------------------------------------------------
  const initialFiltrosConsumedRef = useRef(false);

  useEffect(() => {
    const ext = initialFiltros || initialFilters;
    if (!ext || initialFiltrosConsumedRef.current) return;
    initialFiltrosConsumedRef.current = true;

    // Avoid overriding estadoPersonal to 'falladas' if student has no recorded personal answers,
    // allowing CTO failed questions (fallada_cto) to be loaded directly on clean profiles.
    const hasPersonalAnswers = Boolean(stats && Object.keys(stats).length > 0);

    if (ext.asignatura) {
      setFiltros(prev => ({
        ...prev,
        asignatura: ext.asignatura,
        temas: ext.temas || (ext.tema ? [ext.tema] : []),
        subtema: ext.subtema || '',
        soloFalladas: Boolean(ext.soloFalladas),
        estadoPersonal: ext.soloFalladas
          ? (hasPersonalAnswers ? 'falladas' : prev.estadoPersonal)
          : (ext.estadoPersonal || prev.estadoPersonal)
      }));
    } else if (ext.soloFalladas) {
      setFiltros(prev => ({
        ...prev,
        soloFalladas: true,
        estadoPersonal: hasPersonalAnswers ? 'falladas' : (ext.estadoPersonal || prev.estadoPersonal)
      }));
    }

    if (ext.fuente || ext.fuenteDefault) {
      setFiltros(prev => ({ ...prev, fuente: ext.fuente || ext.fuenteDefault }));
    }

    if (ext.mode === 'adaptativo' || ext.preset === 'adaptativo') {
      setCurrentMode('adaptativo');
    } else if (ext.mode === 'custom' || ext.modo === 'banco') {
      setCurrentMode('custom');
    } else if (ext.mode === 'desgloses') {
      setCurrentMode('motor1');
    }

    if (onFiltrosConsumed) onFiltrosConsumed();
    if (onFiltersConsumed) onFiltersConsumed();

    if (ext.autoStart) {
      setTimeout(() => {
        generarColaPersonalizada({
          asignatura: ext.asignatura,
          soloFalladas: Boolean(ext.soloFalladas),
          temas: ext.temas || (ext.tema ? [ext.tema] : []),
          subtema: ext.subtema || '',
          fuente: ext.fuente || 'todas'
        });
      }, 80);
    }
  }, [initialFiltros, initialFilters, onFiltrosConsumed, onFiltersConsumed, generarColaPersonalizada, stats]);

  // --------------------------------------------------------------------------
  // CURRENT QUESTION FORMATTING & QUESTION CARD
  // --------------------------------------------------------------------------
  const currentQuestionData = cola[currentIndex] || null;
  const currentAnswer = currentQuestionData ? respuestasDesglose[currentQuestionData.id] : null;

  const questionForCard = useMemo(() => {
    if (!currentQuestionData) return null;

    let options = [];
    let correctOption = null;

    if (Array.isArray(currentQuestionData.respuestas) && currentQuestionData.respuestas.length > 0) {
      options = currentQuestionData.respuestas.map(r => ({
        id: numToLetter(r.numero),
        text: r.enunciado
      }));
      const corr = currentQuestionData.respuestas.find(r => r.correcta);
      if (corr) correctOption = numToLetter(corr.numero);
      else if (currentQuestionData.respuesta_correcta) correctOption = numToLetter(currentQuestionData.respuesta_correcta);
      else if (currentQuestionData.answer) correctOption = numToLetter(currentQuestionData.answer);
    } else if (Array.isArray(currentQuestionData.options) && currentQuestionData.options.length > 0) {
      options = currentQuestionData.options.map((opt, idx) => ({
        id: numToLetter(idx + 1),
        text: typeof opt === 'string' ? opt : (opt.text || opt.enunciado || '')
      }));
      if (currentQuestionData.respuesta_correcta) correctOption = numToLetter(currentQuestionData.respuesta_correcta);
      else if (currentQuestionData.answer) correctOption = numToLetter(currentQuestionData.answer);
    }

    return {
      id: currentQuestionData.id,
      text: currentQuestionData.enunciado,
      image: currentQuestionData.imagen_nombre || currentQuestionData.imagen || currentQuestionData.image || null,
      options,
      correctOption: correctOption || 'A'
    };
  }, [currentQuestionData]);

  // --------------------------------------------------------------------------
  // ANSWER SUBMISSION & FLOW
  // --------------------------------------------------------------------------
  const finalizarYExportarTirada = useCallback(async (colaActual, respuestasActuales) => {
    const contestadas = colaActual.filter(q => respuestasActuales[q.id] && !respuestasActuales[q.id].skipped);
    const payload = construirPayloadTirada({
      origen: 'TiradorMaestro',
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

  const handleAnswerSubmit = (answerData) => {
    if (!currentQuestionData || !questionForCard) return;
    const qId = currentQuestionData.id;

    if (answerData.skipped) {
      if (answerData.archive || answerData.reason === 'missing_data') {
        archivarPregunta(qId, 'missing_data');
      }
      const nextResp = {
        ...respuestasDesglose,
        [qId]: { skipped: true }
      };
      setRespuestasDesglose(nextResp);
      handleNext(nextResp);
      return;
    }

    const discardedCorrect = (answerData.discardedOptions || []).includes(questionForCard.correctOption);

    registrarRespuesta(qId, answerData.isCorrect, answerData.selectedOption, {
      confidence: answerData.confidence,
      subject: currentQuestionData.asignatura
    });

    const nuevaEntrada = {
      isCorrect: answerData.isCorrect,
      selectedLetter: answerData.selectedOption,
      correctLetter: questionForCard.correctOption,
      discardedOptions: answerData.discardedOptions || [],
      discardedCorrect,
      confidence: answerData.confidence || 'green',
      seconds: answerData.seconds || 0,
      justificacion: answerData.justificacion || ''
    };

    const nextResp = {
      ...respuestasDesglose,
      [qId]: nuevaEntrada
    };
    setRespuestasDesglose(nextResp);

    if (modoExamen) {
      handleNext(nextResp);
    }
  };

  const handleFinalizarSesion = async () => {
    const contestadas = cola.filter(q => respuestasDesglose[q.id] && !respuestasDesglose[q.id].skipped);
    if (contestadas.length === 0) {
      if (typeof window !== 'undefined' && window.confirm && window.confirm('¿Deseas cerrar esta tirada sin guardar?')) {
        handleResetTirada();
      }
      return;
    }

    // Vaciar únicamente lo que haya quedado pendiente en la cola offline (evita duplicar los 75 upserts)
    await flushOfflineSyncQueue().catch(err => console.warn('Sync flush warning:', err));
    await finalizarYExportarTirada(contestadas, respuestasDesglose);
    setCola(contestadas);
    setQuizFinished(true);
  };

  const handleResetTirada = () => {
    setCola([]);
    setResumenCola(null);
    setCurrentIndex(0);
    setRespuestasDesglose({});
    setQuizFinished(false);
    setUltimaTiradaPayload(null);
    sessionStorage.removeItem('mir_tirador_cola');
    sessionStorage.removeItem('mir_tirador_resumenCola');
    sessionStorage.removeItem('mir_tirador_respuestas');
    sessionStorage.removeItem('mir_tirador_currentIndex');
    sessionStorage.removeItem('mir_tirador_quizFinished');
  };

  const handleRehacerFallos = () => {
    const fallos = cola.filter(q => {
      const ans = respuestasDesglose[q.id];
      return ans && !ans.isCorrect && !ans.skipped;
    });
    if (fallos.length === 0) return;
    iniciarNuevaCola(barajarCola(fallos), {
      modo: `❌ Re-hacer Fallos (${fallos.length}p)`,
      total: fallos.length,
      deTema: 0,
      simulacrosAsig: fallos.length,
      rellenoAsig: 0,
      rellenoGlobal: 0
    });
  };

  const handleCopiarChat = async () => {
    if (!ultimaTiradaPayload) return;
    const ok = await copiarTiradaAlPortapapeles(ultimaTiradaPayload);
    if (ok) {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2500);
    }
  };

  // Top 3 P1 Topics Selector shortcut
  const handleSelectTop3P1 = () => {
    if (!rankingTemas || rankingTemas.length === 0) return;
    const top3 = rankingTemas
      .filter(t => t.prioridad === 'P1')
      .slice(0, 3)
      .map(t => t.tema);
    const fallbackTop3 = top3.length > 0 ? top3 : rankingTemas.slice(0, 3).map(t => t.tema);
    setFiltros(prev => ({ ...prev, temas: fallbackTop3 }));
  };

  // Active session exists?
  const hasActiveSession = cola.length > 0;

  // --------------------------------------------------------------------------
  // RENDER RESULTS SCREEN
  // --------------------------------------------------------------------------
  if (quizFinished && (ultimaTiradaPayload || cola.length > 0)) {
    const payload = ultimaTiradaPayload || construirPayloadTirada({
      origen: 'TiradorMaestro',
      asignatura: filtros.asignatura,
      temas: filtros.temas,
      resumenCola,
      cola,
      respuestasDesglose
    });

    const m = payload.metricas;
    const b1List = payload.preguntas.filter(p => p.horquilla_p80 === 'B1' || p.bloque_p80 === 1);
    const b2List = payload.preguntas.filter(p => p.horquilla_p80 === 'B2' || p.bloque_p80 === 2);
    const b3List = payload.preguntas.filter(p => p.horquilla_p80 === 'B3' || p.bloque_p80 === 3);
    const b4List = payload.preguntas.filter(p => p.horquilla_p80 === 'B4' || p.bloque_p80 === 4);

    return (
      <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Header Results Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-8 shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/60 pb-6">
            <div>
              <span className="text-xs font-black tracking-widest uppercase text-cyan-400 bg-cyan-950/60 px-3 py-1 rounded-full border border-cyan-800">
                Sesión Finalizada
              </span>
              <h1 className="text-3xl font-black mt-2 tracking-tight">Auditoría de Tirada MIR</h1>
              <p className="text-slate-400 text-sm mt-1">
                {resumenCola?.modo || 'Tirador Maestro de Preguntas'} · {payload.fecha_humana}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={handleCopiarChat}
                className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black px-5 py-3 rounded-xl transition-all shadow-lg flex items-center gap-2 text-sm"
              >
                <span>{copyFeedback ? '✔ Copiado!' : '📋 Copiar para el Chat'}</span>
              </button>
              <button
                onClick={() => descargarTiradaJSON(payload)}
                className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-3 rounded-xl border border-slate-700 transition-colors text-sm"
              >
                📥 Descargar JSON
              </button>
              <button
                onClick={handleResetTirada}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black px-5 py-3 rounded-xl transition-all text-sm"
              >
                🔄 Nueva Tirada
              </button>
            </div>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Netas</span>
              <div className="text-3xl font-black text-cyan-400 mt-1">{m.netas}</div>
              <span className="text-[11px] text-slate-400">Puntuación examen</span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">% Acierto</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">{m.pct_acierto}%</div>
              <span className="text-[11px] text-slate-400">Sobre contestadas</span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aciertos</span>
              <div className="text-3xl font-black text-emerald-400 mt-1">{m.aciertos}</div>
              <span className="text-[11px] text-slate-400">Preguntas ganadas</span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Fallos</span>
              <div className="text-3xl font-black text-rose-400 mt-1">{m.fallos}</div>
              <span className="text-[11px] text-slate-400">Resta: -{(m.fallos / 3).toFixed(2)}</span>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 p-4 rounded-2xl">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Blancas</span>
              <div className="text-3xl font-black text-slate-300 mt-1">{m.blancas}</div>
              <span className="text-[11px] text-slate-400">Sin contestar</span>
            </div>
          </div>
        </div>

        {/* P80 Difficulty Brackets Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
            <span>🎯</span> Desglose por Horquillas P80 de Acierto Poblacional
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {[
              { id: 'B1', label: 'B1 (≥70% Pob)', desc: 'Fallos Prohibidos', list: b1List, color: 'text-rose-700 bg-rose-50 border-rose-200' },
              { id: 'B2', label: 'B2 (50-69% Pob)', desc: 'Asequibles P80', list: b2List, color: 'text-amber-700 bg-amber-50 border-amber-200' },
              { id: 'B3', label: 'B3 (35-49% Pob)', desc: 'Discriminatorias', list: b3List, color: 'text-blue-700 bg-blue-50 border-blue-200' },
              { id: 'B4', label: 'B4 (<35% Pob)', desc: 'Complejas / Rarezas', list: b4List, color: 'text-slate-700 bg-slate-50 border-slate-200' },
            ].map(b => {
              const totalB = b.list.length;
              const aciertosB = b.list.filter(p => p.isCorrect).length;
              const fallosB = b.list.filter(p => p.contestada && !p.isCorrect).length;
              const pct = totalB > 0 ? Math.round((aciertosB / totalB) * 100) : 0;
              return (
                <div key={b.id} className={`p-4 rounded-xl border ${b.color}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-black text-sm">{b.label}</span>
                    <span className="text-xs font-bold">{pct}%</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{b.desc}</div>
                  <div className="mt-3 flex items-baseline gap-2 text-xs font-bold">
                    <span>{aciertosB} aciertos</span>
                    <span className="text-slate-400">·</span>
                    <span>{fallosB} fallos</span>
                    <span className="text-slate-400">·</span>
                    <span>{totalB} total</span>
                  </div>
                </div>
              );
            })}
          </div>

          {m.fallos > 0 && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleRehacerFallos}
                className="bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-black px-4 py-2.5 rounded-xl text-sm transition-colors flex items-center gap-2"
              >
                <span>❌</span> Re-hacer los {m.fallos} fallos de esta tirada
              </button>
            </div>
          )}
        </div>

        {/* Detailed Question Review List */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-black text-slate-900 mb-4">Revisión Pregunta a Pregunta</h2>
          <div className="space-y-4">
            {payload.preguntas.map((p, idx) => {
              return (
                <div
                  key={p.id || idx}
                  className={`p-4 rounded-xl border transition-all ${
                    !p.contestada
                      ? 'bg-slate-50 border-slate-200'
                      : p.isCorrect
                      ? 'bg-emerald-50/50 border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-7 h-7 rounded-full text-xs font-black flex items-center justify-center ${
                        !p.contestada ? 'bg-slate-200 text-slate-600' : p.isCorrect ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {p.asignatura}
                      </span>
                      {p.tema && (
                        <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          {p.tema}
                        </span>
                      )}
                      {p.horquilla_p80 && (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {p.horquilla_p80} {p.pct_pob ? `(${p.pct_pob}%)` : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold">
                      {p.contestada ? (
                        <span>
                          Marcaste: <strong className={p.isCorrect ? 'text-emerald-700' : 'text-rose-700'}>{p.selectedLetter}</strong> | Correcta: <strong className="text-slate-900">{p.correctLetter}</strong>
                        </span>
                      ) : (
                        <span className="text-slate-400">En blanco</span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-800 mt-2 font-medium">{p.enunciado}</p>
                  {p.comentario && (
                    <div className="mt-3 bg-white/90 p-4 rounded-xl border border-slate-200">
                      <span className="font-black uppercase tracking-wider text-[11px] text-slate-500 block mb-1.5">
                        Comentario Oficial CTO
                      </span>
                      <div
                        className="comentario-html text-base text-slate-800 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: p.comentario }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER ACTIVE QUIZ SESSION (QUESTION RUNNER)
  // --------------------------------------------------------------------------
  if (hasActiveSession && currentQuestionData) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        {/* Sync Status Banner */}
        <SyncStatusBanner syncState={syncState} onRetry={handleFinalizarSesion} isOffline={isOffline} />

        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-4 flex-wrap bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
              {resumenCola?.modo || 'Sesión Activa'}
            </span>
            <span className="text-sm font-bold text-slate-500">
              Pregunta <strong className="text-slate-900 font-black">{currentIndex + 1}</strong> de {cola.length}
            </span>
            {resumenCola?.conteoTiers && (
              <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-bold">
                {resumenCola.conteoTiers.tier1_desgloses_25_15 > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md" title="Tier 1: Desgloses MIR 2025-2015">
                    🎯 {resumenCola.conteoTiers.tier1_desgloses_25_15} MIR 25-15
                  </span>
                )}
                {resumenCola.conteoTiers.tier2_simulacros > 0 && (
                  <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md" title="Tier 2: Simulacros CTO">
                    📝 {resumenCola.conteoTiers.tier2_simulacros} Sims
                  </span>
                )}
                {resumenCola.conteoTiers.tier3_desgloses_15_10 > 0 && (
                  <span className="bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-md" title="Tier 3: Desgloses MIR 2015-2010">
                    🏛️ {resumenCola.conteoTiers.tier3_desgloses_15_10} MIR 15-10
                  </span>
                )}
                {resumenCola.conteoTiers.tier4_evaluaciones > 0 && (
                  <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-md" title="Tier 4: Evaluaciones CTO">
                    📋 {resumenCola.conteoTiers.tier4_evaluaciones} Eval
                  </span>
                )}
                {resumenCola.conteoTiers.tier5_segunda_vuelta > 0 && (
                  <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md" title="Tier 5: Preguntas Segunda Vuelta">
                    📚 {resumenCola.conteoTiers.tier5_segunda_vuelta} 2ª Vta
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Exam Mode Toggle */}
            <button
              onClick={() => setModoExamen(!modoExamen)}
              className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition-all ${
                modoExamen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}
            >
              {modoExamen ? '🎯 Modo Examen (Ciego)' : '🧑‍🏫 Modo Tutor (Inmediato)'}
            </button>

            {/* Finalize Button */}
            <button
              onClick={handleFinalizarSesion}
              className="bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl transition-colors shadow-sm"
            >
              🏁 Finalizar Sesión
            </button>
          </div>
        </div>

        {/* Question Navigator Grid */}
        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-36 overflow-y-auto">
          <div className="flex flex-wrap gap-1.5">
            {cola.map((q, idx) => {
              const ans = respuestasDesglose[q.id];
              let btnStyle = 'bg-white text-slate-600 border-slate-200 hover:border-cyan-400';

              if (ans) {
                if (ans.skipped) {
                  btnStyle = 'bg-slate-200 text-slate-500 border-slate-300';
                } else if (modoExamen) {
                  if (ans.confidence === 'orange') btnStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                  else if (ans.confidence === 'red') btnStyle = 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
                  else btnStyle = 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
                } else {
                  if (ans.isCorrect) btnStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                  else btnStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                }
              }

              if (idx === currentIndex) {
                btnStyle += ' ring-2 ring-cyan-500 ring-offset-2 scale-110 z-10 shadow-md';
              }

              return (
                <button
                  key={q.id || idx}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-8 h-8 rounded-full border text-xs flex items-center justify-center transition-all ${btnStyle}`}
                  title={`Pregunta ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Question Metadata Tags */}
        <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-cyan-100 text-cyan-900 text-xs font-black px-2.5 py-1 rounded-md uppercase tracking-wide">
              {currentQuestionData.asignatura}
            </span>
            {(() => {
              const pInfo = getPrioridadPedagogica(currentQuestionData);
              const tierStyles = {
                1: 'bg-emerald-100 text-emerald-900 border-emerald-300',
                2: 'bg-blue-100 text-blue-900 border-blue-300',
                3: 'bg-cyan-100 text-cyan-900 border-cyan-300',
                4: 'bg-purple-100 text-purple-900 border-purple-300',
                5: 'bg-amber-100 text-amber-900 border-amber-300'
              };
              return (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${tierStyles[pInfo.tier] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                  {pInfo.tier === 1 && '🎯 '}
                  {pInfo.tier === 2 && '📝 '}
                  {pInfo.tier === 3 && '🏛️ '}
                  {pInfo.tier === 4 && '📋 '}
                  {pInfo.tier === 5 && '📚 '}
                  {pInfo.label}
                </span>
              );
            })()}
            {currentQuestionData.tema && (
              <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-md">
                {currentQuestionData.tema}
              </span>
            )}
            {currentQuestionData.subtema && (
              <span className="bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-medium px-2 py-0.5 rounded-md">
                {currentQuestionData.subtema}
              </span>
            )}
            {currentQuestionData.horquilla_p80 && (
              <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold px-2 py-0.5 rounded-md">
                {currentQuestionData.horquilla_p80} {currentQuestionData.pct_pob ? `(${currentQuestionData.pct_pob}% pob)` : ''}
              </span>
            )}
            {currentQuestionData.origenTirada === 'pregunta_hermana' && (
              <span className="bg-purple-100 text-purple-800 font-bold text-[11px] px-2 py-0.5 rounded-md">
                👯 Pregunta Hermana
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">
            {currentQuestionData.origen_display || currentQuestionData.convocatoria || 'MIR App'}
          </span>
        </div>

        {/* Question Card */}
        <div className={!modoExamen && currentAnswer ? 'opacity-60 pointer-events-none' : ''}>
          <QuestionCard
            key={currentQuestionData.id}
            question={questionForCard}
            onAnswer={handleAnswerSubmit}
            onNext={() => handleNext()}
            examMode={modoExamen}
            initialAnswer={modoExamen ? currentAnswer : null}
          />
        </div>

        {/* Immediate Tutor Mode Feedback */}
        {!modoExamen && currentAnswer && !currentAnswer.skipped && (
          <div className={`p-6 rounded-2xl border animate-in fade-in duration-200 ${
            currentAnswer.isCorrect ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{currentAnswer.isCorrect ? '🎉' : '❌'}</span>
              <h4 className={`text-lg font-black ${currentAnswer.isCorrect ? 'text-emerald-900' : 'text-rose-900'}`}>
                {currentAnswer.isCorrect ? '¡Has acertado!' : 'Has fallado'}
              </h4>
            </div>

            {!currentAnswer.isCorrect && (
              <p className="text-rose-800 text-sm mb-3">
                Marcaste la opción <strong>{currentAnswer.selectedLetter}</strong>, pero la correcta era la <strong className="font-black bg-white px-2 py-0.5 rounded border border-rose-200">{currentAnswer.correctLetter}</strong>.
              </p>
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
              commentary={currentQuestionData.comentario || currentQuestionData.explicacion}
              onGuardarNota={guardarNota}
              currentNota={getStatsPregunta(currentQuestionData.id)?.nota || ''}
            />

            {(currentQuestionData.comentario || currentQuestionData.explicacion) && (
              <div className="mt-4 bg-white/90 p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex items-center gap-2 mb-2.5">
                  <span className="text-base">💡</span>
                  <span className="font-black uppercase tracking-wider text-xs text-slate-500">
                    Comentario Oficial CTO
                  </span>
                </div>
                <div
                  className="comentario-html text-base sm:text-[17px] text-slate-800 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: currentQuestionData.comentario || currentQuestionData.explicacion }}
                />
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => handleNext()}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-6 rounded-xl transition-colors text-sm flex items-center gap-2"
              >
                <span>{currentIndex >= cola.length - 1 ? 'Finalizar Tirada 🎉' : 'Siguiente Pregunta →'}</span>
                <kbd className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                  Enter ↵
                </kbd>
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // RENDER CONFIGURATION VIEW (MODE SELECTOR + FACETED FILTERS)
  // --------------------------------------------------------------------------
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <span>🎯</span> Tirador de Preguntas
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            Motor Unificado de 3ª Vuelta: 12.440 preguntas canónicas deduplicadas con horquillas P80 y analítica de latencia.
          </p>
        </div>

        {/* Resume Session Button if already paused */}
        {hasActiveSession && (
          <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 p-2 rounded-2xl">
            <span className="text-xs font-bold text-cyan-900 px-2">
              Sesión activa: {currentIndex + 1} / {cola.length}
            </span>
            <button
              onClick={() => setQuizFinished(false)}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-black text-xs px-3.5 py-1.5 rounded-xl transition-colors"
            >
              Reanudar →
            </button>
            <button
              onClick={handleResetTirada}
              className="text-slate-400 hover:text-rose-600 text-xs px-2 py-1 font-bold"
              title="Descartar sesión en curso"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Mode Selector Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { id: 'motor1', icon: '🌅', label: 'Motor 1 · Mañana', sub: '75p Post-Estudio Tema' },
          { id: 'motor2', icon: '🌤️', label: 'Motor 2 · Tarde', sub: '75p Barrido Asignatura' },
          { id: 'motor3', icon: '🌍', label: 'Motor 3 · Mixto P80', sub: '75p Latencia + Hermana' },
          { id: 'adaptativo', icon: '🧠', label: 'Adaptativo', sub: 'Rentabilidad + Cooldown' },
          { id: 'custom', icon: '🛠️', label: 'Tirada Libre', sub: 'Filtros Facetados a Medida' },
        ].map(m => {
          const isActive = currentMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setCurrentMode(m.id)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-[1.02]'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="text-2xl mb-1">{m.icon}</div>
              <div className="font-black text-sm">{m.label}</div>
              <div className={`text-[11px] mt-0.5 ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>
                {m.sub}
              </div>
            </button>
          );
        })}
      </div>

      {/* Global Resolution Mode Switcher (Applies to all Motors & Custom) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl shrink-0">
            {modoExamen ? '🎯' : '🧑‍🏫'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                Modo de Resolución:
              </span>
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-md ${
                modoExamen ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-900 border border-amber-300'
              }`}>
                {modoExamen ? '🎯 Modo Examen (Ciego)' : '🧑‍🏫 Modo Tutor (Inmediato)'}
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                (Aplica a Motor 1, 2, 3, Adaptativo y Tirada Libre)
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-1">
              {modoExamen
                ? 'Simulación MIR real sin pistas ni corrección intermedia. Resultados, notas y análisis al finalizar la sesión.'
                : 'Retroalimentación instantánea al contestar cada pregunta: acierto/fallo, justificación, Tutor Gemini y comentarios oficiales CTO.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setModoExamen(true)}
            className={`text-xs px-4 py-2 rounded-lg font-black transition-all flex items-center gap-1.5 ${
              modoExamen
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🎯 Examen Ciego</span>
          </button>
          <button
            type="button"
            onClick={() => setModoExamen(false)}
            className={`text-xs px-4 py-2 rounded-lg font-black transition-all flex items-center gap-1.5 ${
              !modoExamen
                ? 'bg-amber-500 text-slate-950 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>🧑‍🏫 Tutor Inmediato</span>
          </button>
        </div>
      </div>

      {/* Mode 1 Description & Launch */}
      {currentMode === 'motor1' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full border border-orange-200">
                🌅 Sesión 1 · Franja 11:00–13:00
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                Consolidación Post-Estudio del Tema ({filtros.asignatura})
              </h2>
              <p className="text-slate-600 text-sm mt-1 max-w-2xl">
                Extrae hasta 48 Desgloses MIR oficiales no hechos del tema de hoy, fallos de simulacros CTO (≥35% pob) y completa hasta 75 con preguntas P80 y reserva Test 2ª Vuelta.
              </p>
            </div>
            <button
              onClick={lanzarMotor1}
              className="bg-orange-500 hover:bg-orange-600 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-orange-200 transition-all text-base flex items-center gap-2"
            >
              <span>Empezar Motor 1 (75p)</span>
              <span>→</span>
            </button>
          </div>

          {/* Subject & Topics Quick Preselection for Motor 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Asignatura en estudio:
              </label>
              <select
                value={filtros.asignatura}
                onChange={(e) => setFiltros(prev => ({ ...prev, asignatura: e.target.value, temas: [] }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                {catalogoAsignaturas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Temas Prioritarios P1:
                </label>
                <button
                  type="button"
                  onClick={handleSelectTop3P1}
                  className="text-xs font-bold text-orange-600 hover:underline"
                >
                  🎯 Seleccionar Top 3 P1
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-xl border border-slate-200">
                {rankingTemas.slice(0, 10).map(t => {
                  const isSelected = filtros.temas.includes(t.tema);
                  return (
                    <button
                      key={t.tema}
                      type="button"
                      onClick={() => {
                        setFiltros(prev => ({
                          ...prev,
                          temas: isSelected ? prev.temas.filter(x => x !== t.tema) : [...prev.temas, t.tema]
                        }));
                      }}
                      className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-all ${
                        isSelected
                          ? 'bg-orange-500 text-white border-orange-500'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-orange-300'
                      }`}
                    >
                      {t.prioridad === 'P1' && '🔴 '}
                      {t.tema}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mode 2 Description & Launch */}
      {currentMode === 'motor2' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                🌤️ Sesión 2 · Franja 17:10–19:15
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                Barrido y Consolidación de Asignatura ({filtros.asignatura})
              </h2>
              <p className="text-slate-600 text-sm mt-1 max-w-2xl">
                Barre el bloque de la tarde con desgloses MIR oficiales, fallos acumulados en simulacros CTO y evaluaciones de toda la asignatura hasta 75 preguntas.
              </p>
            </div>
            <button
              onClick={lanzarMotor2}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-8 py-4 rounded-2xl shadow-lg shadow-amber-200 transition-all text-base flex items-center gap-2"
            >
              <span>Empezar Motor 2 (75p)</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                Asignatura a barrer:
              </label>
              <select
                value={filtros.asignatura}
                onChange={(e) => setFiltros(prev => ({ ...prev, asignatura: e.target.value, temas: [] }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {catalogoAsignaturas.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Mode 3 Description & Launch */}
      {currentMode === 'motor3' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-purple-600 bg-purple-50 px-3 py-1 rounded-full border border-purple-200">
                🌍 Sesión 3 · Adaptativo Mixto P80
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-2">
                Mixto P80: Repaso Espaciado + Pregunta Hermana
              </h2>
              <p className="text-slate-600 text-sm mt-1 max-w-2xl">
                Excluye la asignatura en estudio ({filtros.asignatura || 'del día'}) para entrenar el cambio de contexto del MIR real. Empareja fallos en latencia con su <em>Pregunta Hermana</em> virgen del mismo subtema y protege cuota de asignaturas huérfanas.
              </p>
            </div>
            <button
              onClick={lanzarMotor3}
              className="bg-purple-600 hover:bg-purple-700 text-white font-black px-8 py-4 rounded-2xl shadow-lg shadow-purple-200 transition-all text-base flex items-center gap-2"
            >
              <span>Empezar Motor 3 (75p)</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs">
            <div className="p-3 bg-purple-50 rounded-xl border border-purple-100">
              <span className="font-black text-purple-900 block mb-1">1. Preguntas Hermanas</span>
              <span className="text-purple-700">16–24 slots emparejando preguntas falladas con clones vírgenes del mismo subtema.</span>
            </div>
            <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
              <span className="font-black text-indigo-900 block mb-1">2. Asignaturas Huérfanas</span>
              <span className="text-indigo-700">12 slots blindados para ORL, Urgencias, Genética, Fisiología, Farmacología, etc.</span>
            </div>
            <div className="p-3 bg-cyan-50 rounded-xl border border-cyan-100">
              <span className="font-black text-cyan-900 block mb-1">3. Fallos P80 Globales</span>
              <span className="text-cyan-700">Hasta 25 preguntas de Simulacros con ≥50% de acierto poblacional.</span>
            </div>
          </div>
        </div>
      )}

      {/* Adaptive Mode Screen */}
      {currentMode === 'adaptativo' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <h2 className="text-xl font-black text-slate-900 mb-2">Recomendaciones Inteligentes por Cooldown</h2>
            <p className="text-slate-600 text-sm mb-6">
              El algoritmo calcula la distancia hacia tus objetivos de rentabilidad (90/75/60%) y penaliza asignaturas evaluadas recientemente.
            </p>
            <DailyRecommendations
              onStartQuiz={(rec) => {
                generarColaPersonalizada({
                  asignatura: rec.subject,
                  tamanoTirada: 30,
                  fuente: 'todas'
                });
              }}
            />
          </div>
        </div>
      )}

      {/* Custom Tirada Mode: Full Faceted Filters */}
      {currentMode === 'custom' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4 flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-900">Filtros Facetados a Medida</h2>
              <p className="text-slate-500 text-xs mt-0.5">Combina múltiples dimensiones para aislar exactamente las preguntas que necesitas.</p>
            </div>
            <button
              id="banco-btn-generar"
              onClick={() => generarColaPersonalizada()}
              className="bg-slate-900 hover:bg-slate-800 text-white font-black px-6 py-3 rounded-xl transition-all shadow-md text-sm flex items-center gap-2"
            >
              <span>Generar Tirada</span>
              <span>→</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* 1. FUENTE (Multi-selección) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  1. Fuente de Preguntas
                </label>
                <span className="text-[10px] font-bold text-slate-400">
                  Multiselección
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleFuente('todas')}
                  className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center justify-between ${
                    isFuenteActiva('todas') && (!filtros.fuentes || filtros.fuentes.includes('todas'))
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>Todas las fuentes</span>
                  <span className="text-[11px]">{isFuenteActiva('todas') && (!filtros.fuentes || filtros.fuentes.includes('todas')) ? '✓' : ''}</span>
                </button>
                {ALL_FUENTES.map(src => {
                  const active = isFuenteActiva(src.id) && !(Array.isArray(filtros.fuentes) && filtros.fuentes.includes('todas'));
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => toggleFuente(src.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center justify-between ${
                        active
                          ? 'bg-cyan-50 text-cyan-900 border-cyan-300 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span>{src.label}</span>
                      <span className="text-[11px] font-black">{active ? '☑' : '☐'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. HORQUILLA P80 DIFICULTAD (Multi-selección) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  2. Horquilla P80 Dificultad
                </label>
                <span className="text-[10px] font-bold text-slate-400">
                  Multiselección
                </span>
              </div>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => toggleHorquillaP80('todas')}
                  className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center justify-between ${
                    isHorquillaActiva('todas') && (!filtros.horquillasP80 || filtros.horquillasP80.includes('todas'))
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>Todas las dificultades</span>
                  <span className="text-[11px]">{isHorquillaActiva('todas') && (!filtros.horquillasP80 || filtros.horquillasP80.includes('todas')) ? '✓' : ''}</span>
                </button>
                {ALL_HORQUILLAS.map(b => {
                  const active = isHorquillaActiva(b.id) && !(Array.isArray(filtros.horquillasP80) && filtros.horquillasP80.includes('todas'));
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleHorquillaP80(b.id)}
                      className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center justify-between ${
                        active
                          ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span>{b.label}</span>
                      <span className="text-[11px] font-black">{active ? '☑' : '☐'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. ESTADO PERSONAL */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider block">
                  3. Estado Personal Histórico
                </label>
              </div>
              <div className="space-y-1.5">
                {[
                  { id: 'todas', label: 'Todas las preguntas' },
                  { id: 'no_hechas', label: 'Vírgenes (No hechas)' },
                  { id: 'falladas', label: 'Falladas en App o CTO' },
                  { id: 'acertadas', label: 'Acertadas / Dominadas' },
                  { id: 'latencia', label: 'En Latencia Urgente (P8–10)' },
                ].map(ep => (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => setFiltros(prev => ({
                      ...prev,
                      estadoPersonal: ep.id,
                      soloFalladas: ep.id === 'falladas'
                    }))}
                    className={`w-full text-left text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center justify-between ${
                      filtros.estadoPersonal === ep.id
                        ? 'bg-rose-50 text-rose-900 border-rose-300 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span>{ep.label}</span>
                    <span className="text-[11px]">{filtros.estadoPersonal === ep.id ? '✓' : ''}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4. LONGITUD, ORDEN PEDAGÓGICO, ASIGNATURA (MULTI-SELECCIÓN) Y TAXONOMÍA */}
          <div className="pt-6 border-t border-slate-100 space-y-6">
            {/* Longitud de Tirada y Orden de Resolución */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Longitud de Tirada */}
              <div className="flex flex-col justify-between bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                    4. Longitud de la Tirada
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">Elige el número de preguntas para la sesión personalizada.</p>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  {[10, 25, 50, 75, 100, null].map(n => (
                    <button
                      key={String(n)}
                      type="button"
                      onClick={() => setFiltros(prev => ({ ...prev, tamanoTirada: n }))}
                      className={`text-xs px-3 py-2 rounded-xl border font-bold transition-all ${
                        filtros.tamanoTirada === n
                          ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {n ? `${n}p` : 'Todas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orden y Prioridad de Preguntas */}
              <div className="flex flex-col justify-between bg-slate-50/70 p-4 rounded-2xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                      5. Prioridad y Orden de Preguntas
                    </label>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md">
                      Pedagógico MIR
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    1º MIR 25-15 → 2º Sims → 3º MIR 15-10 → 4º Eval → 5º 2ª Vuelta.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <button
                    type="button"
                    onClick={() => setFiltros(prev => ({ ...prev, ordenPreguntas: 'prioridad' }))}
                    className={`text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                      filtros.ordenPreguntas !== 'aleatorio'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span>🎯</span>
                    <span>Prioridad Pedagógica (Recomendado)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFiltros(prev => ({ ...prev, ordenPreguntas: 'aleatorio' }))}
                    className={`text-xs px-3 py-2 rounded-xl border font-bold transition-all flex items-center gap-1.5 ${
                      filtros.ordenPreguntas === 'aleatorio'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <span>🔀</span>
                    <span>Barajadas</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Multiselección de Asignaturas */}
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      6. Asignaturas
                    </label>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                      {isAsignaturaActiva('Todas') ? 'Todas las asignaturas' : `${filtros.asignaturas?.length || 0} seleccionada(s)`}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Elección múltiple: haz clic en una o varias asignaturas para combinarlas libremente en la tirada.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    placeholder="🔍 Filtrar asignatura..."
                    value={asigSearch}
                    onChange={(e) => setAsigSearch(e.target.value)}
                    className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 w-44"
                  />
                  <button
                    type="button"
                    onClick={() => toggleAsignatura('Todas')}
                    className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                      isAsignaturaActiva('Todas')
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    Todas las Asignaturas
                  </button>
                  {filtros.asignaturas && filtros.asignaturas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleAsignatura('Todas')}
                      className="text-xs text-rose-600 font-bold hover:underline"
                    >
                      Limpiar ({filtros.asignaturas.length})
                    </button>
                  )}
                </div>
              </div>

              {/* Chips de Asignaturas */}
              <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                {catalogoAsignaturas
                  .filter(a => !asigSearch || normText(a).includes(normText(asigSearch)))
                  .map(a => {
                    const active = isAsignaturaActiva(a) && !isAsignaturaActiva('Todas');
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAsignatura(a)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all flex items-center gap-1.5 ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        <span>{a}</span>
                        <span className={`text-[10px] ${active ? 'text-white font-black' : 'text-slate-400'}`}>
                          {active ? '✓' : '+'}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* SELECCIÓN MÚLTIPLE DE TEMAS (SI HAY EXACTAMENTE 1 ASIGNATURA SELECCIONADA) */}
            {singleAsignaturaActiva ? (
              <div className="bg-slate-50/80 rounded-2xl border border-slate-200 p-5 space-y-4 animate-in fade-in duration-150">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Temas de {singleAsignaturaActiva}
                      </span>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-800">
                        {filtros.temas.length === 0 ? 'Todos seleccionados' : `${filtros.temas.length} tema(s) activo(s)`}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Elección múltiple: haz clic en cualquier tema para añadirlo o quitarlo de la tirada.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFiltros(prev => ({ ...prev, temas: [], subtema: '' }))}
                      className={`text-xs px-3 py-1 rounded-lg border font-bold transition-all ${
                        filtros.temas.length === 0
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      Todos los Temas
                    </button>
                    {filtros.temas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setFiltros(prev => ({ ...prev, temas: [], subtema: '' }))}
                        className="text-xs text-rose-600 font-bold hover:underline"
                      >
                        Limpiar ({filtros.temas.length})
                      </button>
                    )}
                  </div>
                </div>

                {/* Topics Pills */}
                {temasDisponibles.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2 bg-white rounded-xl border border-slate-200">
                    {temasDisponibles.map(t => {
                      const isSelected = filtros.temas.includes(t);
                      const rankInfo = rankingTemas.find(r => r.tema === t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTema(t)}
                          className={`text-xs px-2.5 py-1.5 rounded-lg border font-semibold transition-all flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-orange-500 text-white border-orange-500 shadow-xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-orange-300 hover:bg-orange-50/50'
                          }`}
                        >
                          {rankInfo?.prioridad === 'P1' && <span>🔴</span>}
                          <span>{t}</span>
                          <span className={`text-[10px] ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                            {isSelected ? '✓' : '+'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No hay desglose temático específico para esta asignatura.</p>
                )}

                {/* SUBTEMA CONDICIONAL: SOLO SI SELECCIONA EXACTAMENTE 1 TEMA */}
                {filtros.temas.length === 1 && (
                  <div className="pt-3 border-t border-slate-200 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-black text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                        <span>🎯</span> Subtemas de "{filtros.temas[0]}" (Opcional):
                      </label>
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                        {subtemasDisponibles.length} disponible(s)
                      </span>
                    </div>
                    {subtemasDisponibles.length > 0 ? (
                      <select
                        value={filtros.subtema || ''}
                        onChange={(e) => setFiltros(prev => ({ ...prev, subtema: e.target.value }))}
                        className="w-full bg-white border border-emerald-300 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Todos los subtemas de {filtros.temas[0]}</option>
                        {subtemasDisponibles.map(st => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-slate-500 italic">Este tema no tiene subtemas diferenciados en el catálogo.</p>
                    )}
                  </div>
                )}

                {filtros.temas.length > 1 && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 bg-slate-100/70 p-2.5 rounded-xl border border-slate-200">
                      <span>ℹ️</span>
                      <span>
                        Selección múltiple activa (<strong>{filtros.temas.length} temas</strong>). Para afinar a un subtema concreto, selecciona un único tema.
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ) : filtros.asignaturas && filtros.asignaturas.length > 1 ? (
              <div className="p-3.5 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs text-blue-900 flex items-center gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  Selección combinada de <strong>{filtros.asignaturas.length} asignaturas</strong> ({filtros.asignaturas.join(', ')}). Los filtros de temas por asignatura se activan al seleccionar una sola.
                </span>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                Se incluirán preguntas de todas las asignaturas médicas. Puedes hacer clic en una o varias asignaturas arriba para filtrar.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
