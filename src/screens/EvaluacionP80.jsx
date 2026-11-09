/**
 * Archivo: EvaluacionP80.jsx
 * Descripción: Panel interactivo de Evaluación P80 y Auditoría de Resultados de 3ª Vuelta MIR 2027.
 * Presenta los 3 KPIs oficiales:
 *  1. Rumbo al P80 por Bloques de Dificultad en Simulacros CTO (Fugas B1 >=70% y B2 50-69%).
 *  2. Eficacia de Retención y Conversión de Preguntas Hermanas y Fallos Vencidos (Tasa de Rescate y Subtemas Crónicos).
 *  3. Termómetro de Cobertura Real de 3ª Vuelta por Asignatura (Pool Crítico de 5.952 preguntas vs dominadas).
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { usePreguntasStats } from '../hooks/usePreguntasStats';
import desglosesData from '../data/desgloses_filtrables.json';
import simulacrosData from '../data/simulacrosCTO.json';
import evaluacionesData from '../data/evaluaciones_cto.json';
import bancoPreguntasData from '../data/bancoPreguntas.json';
import { normalizeAsignaturaToDesgloses, normText } from '../lib/prioridadesTemas';
import { ASIGNATURA_NOMBRE } from '../lib/simulacros';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine
} from 'recharts';

// ============================================================================
// CONSTANTES Y MODELO MATEMÁTICO P80
// ============================================================================

const ACCENT = '#F26522';

const percentilesOficialesS1_S12 = {
  1: { p10: 30.67, p25: 42.67, p50: 57.33, p75: 74.67, p90: 94.33 },
  2: { p10: 29.6,  p25: 42.67, p50: 58.67, p75: 76,    p90: 95.67 },
  3: { p10: 29.33, p25: 42.67, p50: 57.33, p75: 76,    p90: 96.33 },
  4: { p10: 40,    p25: 57.67, p50: 75.67, p75: 94,    p90: 113.33 },
  5: { p10: 34.33, p25: 53,    p50: 72.33, p75: 92,    p90: 110.67 },
  6: { p10: 32,    p25: 49.33, p50: 65.33, p75: 84,    p90: 103.27 },
  7: { p10: 37.67, p25: 54,    p50: 70.67, p75: 88,    p90: 105.33 },
  8: { p10: 55.67, p25: 76.33, p50: 97.33, p75: 117.33, p90: 136 },
  9: { p10: 52.33, p25: 70.33, p50: 86.67, p75: 102.67, p90: 118 },
  10: { p10: 43.8,  p25: 64,    p50: 83.67, p75: 104,   p90: 121.33 },
  11: { p10: 55.33, p25: 73.33, p50: 92,    p75: 109.67, p90: 126.67 },
  12: { p10: 55,    p25: 74,    p50: 93.33, p75: 110.92, p90: 126.67 },
  13: { p05: 37,    p10: 48.5,  p25: 67.67, p50: 88,     p75: 108,    p90: 125.67, p95: 136.33 },
  14: { p05: 42.35, p10: 54.7,  p25: 75.33, p50: 93.67,  p75: 112,    p90: 128.67, p95: 138.67 },
  15: { p05: 42.45, p10: 55,    p25: 76,    p50: 95.33,  p75: 113.08, p90: 129.4,  p95: 139.22 },
  16: { p05: 44.95, p10: 59.6,  p25: 84,    p50: 102.67, p75: 120,    p90: 135.8,  p95: 145.33 },
  17: { p05: 42.67, p10: 55.4,  p25: 76.67, p50: 97,     p75: 116,    p90: 132,    p95: 141.67 },
  18: { p05: 41.67, p10: 55,    p25: 77.33, p50: 95,     p75: 111.33, p90: 128.4,  p95: 138.67 },
  19: { p05: 43.33, p10: 57.3,  p25: 80.67, p50: 102.33, p75: 120.67, p90: 136.1,  p95: 145.33 },
  20: { p05: 65.33, p10: 78.2,  p25: 99.67, p50: 118.67, p75: 134.25, p90: 146.2,  p95: 153.33 }
};

/**
 * Standard normal inverse CDF approximation (probit function)
 */
function probit(p) {
  if (p <= 0 || p >= 1) return 0;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];

  const q = p - 0.5;
  if (Math.abs(q) <= 0.42) {
    const r = q * q;
    return q * (((((a[0]*r + a[1])*r + a[2])*r + a[3])*r + a[4])*r + a[5]) /
               (((((b[0]*r + b[1])*r + b[2])*r + b[3])*r + b[4])*r + 1.0);
  } else {
    const r = p < 0.5 ? p : 1.0 - p;
    const s = Math.sqrt(-Math.log(r));
    let x = (((((c[0]*s + c[1])*s + c[2])*s + c[3])*s + c[4])*s + c[5]) /
            ((((d[0]*s + d[1])*s + d[2])*s + d[3])*s + 1.0);
    return p < 0.5 ? -x : x;
  }
}

// ============================================================================
// CALCULADORES DE KPIS (CUMPLEN CONTESTS TIER 1-4)
// ============================================================================

/**
 * KPI 1: Rumbo al P80 por Bloques de Dificultad en Simulacros
 */
export function calcularKPI1_RumboP80(simulacrosDataParam) {
  const data = simulacrosDataParam || {};
  const simsList = data.simulacros || [];
  const rawPreguntas = data.preguntas || [];

  const simulacrosResult = simsList.map(sim => {
    const num = sim.numero;
    const simQuestions = rawPreguntas.filter(q => q.simulacro === num && !q.ignorar && !q.anulada && q.nula !== 1);
    const totalAlumnos = sim.stats?.cuenta_total || 2500;

    let leaks_b1 = 0;
    let leaks_b2 = 0;
    let fallos_b1 = 0;
    let blancas_b1 = 0;
    let fallos_b2 = 0;
    let blancas_b2 = 0;

    const leaksBySubject = {};

    simQuestions.forEach(q => {
      let pctPob = 50;
      if (q.pct_field_correct != null) {
        pctPob = Math.round(q.pct_field_correct * 100);
      } else if (q.pct_correcta != null) {
        pctPob = Math.round((q.pct_correcta / totalAlumnos) * 100);
      }

      const isFallo = Boolean(q.fallada);
      const isBlanca = !q.acertada && !q.fallada;
      const isLeak = isFallo || isBlanca;

      if (!isLeak) return;

      const rawAsig = (q.clasificaciones && q.clasificaciones[0]) || q.asignatura || 'Sin Asignatura';
      const asig = normalizeAsignaturaToDesgloses(rawAsig);

      if (pctPob >= 70) {
        // Bloque 1: Fallos Prohibidos
        leaks_b1++;
        if (isFallo) fallos_b1++;
        else blancas_b1++;

        const leakWeight = isFallo ? 1.333333 : 1.0;
        leaksBySubject[asig] = (leaksBySubject[asig] || 0) + leakWeight;
      } else if (pctPob >= 50) {
        // Bloque 2: Asequibles
        leaks_b2++;
        if (isFallo) fallos_b2++;
        else blancas_b2++;

        const leakWeight = isFallo ? 1.333333 : 1.0;
        leaksBySubject[asig] = (leaksBySubject[asig] || 0) + leakWeight;
      }
    });

    const fuga_neta_b1 = Math.round((fallos_b1 * 1.333333 + blancas_b1 * 1.0) * 100) / 100;
    const fuga_neta_b2 = Math.round((fallos_b2 * 1.333333 + blancas_b2 * 1.0) * 100) / 100;

    // Netas reales
    let netas = sim.stats?.neta ?? 0;
    if (sim.stats && sim.stats.acertadas != null && sim.stats.falladas != null) {
      netas = Math.round((sim.stats.acertadas - (sim.stats.falladas / 3)) * 100) / 100;
    }

    // P80 Target
    let p80_target = 0;
    if (percentilesOficialesS1_S12[num]) {
      const { p75, p90 } = percentilesOficialesS1_S12[num];
      p80_target = Math.round((p75 + (1 / 3) * (p90 - p75)) * 100) / 100;
    } else {
      // Proyección Gaussiana para S13–S19
      const sigma = 21.0;
      const userPct = sim.stats?.percentil_total != null ? sim.stats.percentil_total : 0.50;
      const zUser = probit(userPct);
      const zP80 = 0.8416; // P80 en la normal estándar
      p80_target = Math.round((netas + (zP80 - zUser) * sigma) * 100) / 100;
    }

    const gap_p80 = Math.max(0, Math.round((p80_target - netas) * 100) / 100);

    const leaky_subjects = Object.entries(leaksBySubject)
      .map(([asignatura, fuga_netas]) => ({
        asignatura,
        fuga_netas: Math.round(fuga_netas * 100) / 100
      }))
      .sort((a, b) => b.fuga_netas - a.fuga_netas);

    return {
      numero: num,
      fecha: sim.fecha || `Simulacro ${num}`,
      netas,
      p80_target,
      gap_p80,
      leaks_b1,
      leaks_b2,
      fuga_neta_b1,
      fuga_neta_b2,
      leaky_subjects
    };
  });

  return { simulacros: simulacrosResult };
}

/**
 * KPI 2: Eficacia de Retención y Conversión de «Preguntas Hermanas» / Fallos Vencidos
 */
export function calcularKPI2_ConversionHermanas(stats = {}, historialTiradas = []) {
  let fallos_repasados = 0;
  let fallos_rescatados = 0;
  let hermanas_total = 0;
  let hermanas_acertadas = 0;

  const subtemasStats = {};

  // Analizar historial de tiradas para rescates y hermanas
  if (Array.isArray(historialTiradas)) {
    historialTiradas.forEach(tirada => {
      if (!tirada) return;
      const questions = Array.isArray(tirada.preguntas)
        ? tirada.preguntas
        : (Array.isArray(tirada.questions) ? tirada.questions : []);
      questions.forEach(q => {
        if (!q) return;
        const origen = q.origen_tirada || q.origenTirada;
        const isCorrect = Boolean(q.isCorrect || q.acertada);
        const confidence = q.confidence || (isCorrect ? 'green' : 'red');

        if (origen === 'repaso_latencia') {
          fallos_repasados++;
          if (isCorrect && confidence === 'green') {
            fallos_rescatados++;
          }
        } else if (origen === 'pregunta_hermana') {
          hermanas_total++;
          if (isCorrect && confidence === 'green') {
            hermanas_acertadas++;
          }
        }
      });
    });
  }

  // Detectar subtemas reincidentes crónicos desde el mapa de stats
  for (const [id, st] of Object.entries(stats || {})) {
    if (st && st.fallos >= 2) {
      const asig = normalizeAsignaturaToDesgloses(st.subject || st.asignatura || 'Sin Asignatura');
      const tema = String(st.tema || 'General').trim();
      const subtema = String(st.subtema || tema).trim();
      const key = `${asig}:::${tema}:::${subtema}`;

      if (!subtemasStats[key]) {
        subtemasStats[key] = {
          asignatura: asig,
          tema,
          subtema,
          fallos_cronicos: 0,
          netas_perdidas: 0
        };
      }
      subtemasStats[key].fallos_cronicos += st.fallos;
      subtemasStats[key].netas_perdidas += Math.round(st.fallos * 1.333333 * 100) / 100;
    }
  }

  const subtemas_reincidentes = Object.values(subtemasStats)
    .sort((a, b) => b.fallos_cronicos - a.fallos_cronicos);

  const tasa_rescate_pct = fallos_repasados > 0
    ? Math.round((fallos_rescatados / fallos_repasados) * 1000) / 10
    : 0;

  const tasa_hermanas_pct = hermanas_total > 0
    ? Math.round((hermanas_acertadas / hermanas_total) * 1000) / 10
    : 0;

  return {
    tasa_rescate_pct,
    fallos_rescatados,
    fallos_repasados,
    tasa_hermanas_pct,
    hermanas_acertadas,
    hermanas_total,
    subtemas_reincidentes
  };
}

/**
 * KPI 3: Termómetro de Cobertura Real de 3ª Vuelta por Asignatura
 */
export function calcularKPI3_TermometroCobertura(
  desglosesDataParam = [],
  simulacrosDataParam = {},
  evaluacionesDataParam = [],
  bancoPreguntasDataParam = [],
  stats = {}
) {
  // 1. Desgloses MIR 2015-2025
  const d15 = (Array.isArray(desglosesDataParam) ? desglosesDataParam : []).filter(q => q && (q.anualidad || 0) >= 2015);

  // 2. Fallos Sims/Eval >=35% pob
  const rawSims = Array.isArray(simulacrosDataParam)
    ? simulacrosDataParam
    : (simulacrosDataParam?.preguntas || []);
  const simMap = new Map((simulacrosDataParam?.simulacros || []).map(s => s && [s.numero, s]).filter(Boolean));

  const fallosSims = rawSims.filter(q => {
    if (!q || q.ignorar || q.anulada || q.nula === 1) return false;
    const isLeak = q.fallada || (!q.acertada && !q.fallada);
    if (!isLeak) return false;
    const sim = simMap.get(q.simulacro);
    const total = sim?.stats?.cuenta_total || 2500;
    const pct = q.pct_correcta != null
      ? (q.pct_correcta / total) * 100
      : (q.pct_field_correct != null ? q.pct_field_correct * 100 : 50);
    return pct >= 35;
  });

  const fallosEval = (Array.isArray(evaluacionesDataParam) ? evaluacionesDataParam : []).filter(q => {
    if (!q) return false;
    const isFallo = q.fallada_o_blanca === true || q.fallada === true;
    const pct = q.pct_acierto_pob != null ? q.pct_acierto_pob : (q.pctPob ?? 50);
    return isFallo && pct >= 35;
  });

  // 3. Test 2V
  const test2V = (Array.isArray(bancoPreguntasDataParam) ? bancoPreguntasDataParam : []).filter(q => q && q.vuelta === 2);

  // Mapear por asignatura
  const criticalBySubject = {};

  function addCritical(q, defaultAsig) {
    if (!q) return;
    const rawAsig = (q.clasificaciones && q.clasificaciones[0]) ||
                    (ASIGNATURA_NOMBRE && ASIGNATURA_NOMBRE[q.asignatura]) ||
                    q.asignatura ||
                    defaultAsig ||
                    'Sin Asignatura';
    const asig = normalizeAsignaturaToDesgloses(rawAsig);
    if (!criticalBySubject[asig]) {
      criticalBySubject[asig] = new Map();
    }
    const qId = (q.simulacro && q.numero)
      ? `${q.simulacro}-${q.numero}`
      : (q.id || q.pregunta_id || `${q.simulacro}-${q.numero}`);
    criticalBySubject[asig].set(qId, q);
  }

  d15.forEach(q => addCritical(q));
  fallosSims.forEach(q => addCritical(q));
  fallosEval.forEach(q => addCritical(q));
  test2V.forEach(q => addCritical(q));

  let total_criticas = 0;
  let total_contestadas = 0;
  let total_dominadas = 0;

  const por_asignatura = Object.entries(criticalBySubject).map(([asignatura, map]) => {
    const asigCriticas = map.size;
    let contestadas = 0;
    let dominadas = 0;

    const statsObj = stats || {};
    for (const [id, q] of map.entries()) {
      const simAlias = (q.simulacro && q.numero) ? `${q.simulacro}-${q.numero}` : null;
      const st = statsObj[id] || (simAlias ? statsObj[simAlias] : null);

      if (st && st.vecesVistas > 0) {
        contestadas++;
        if (st.rachaVerde >= 2 || st.dominada) {
          dominadas++;
        }
      }
    }

    total_criticas += asigCriticas;
    total_contestadas += contestadas;
    total_dominadas += dominadas;

    const pct_limpieza = asigCriticas > 0 ? Math.round((contestadas / asigCriticas) * 100) : 0;
    const pct_dominio = asigCriticas > 0 ? Math.round((dominadas / asigCriticas) * 100) : 0;
    const pendientes = asigCriticas - contestadas;

    return {
      asignatura,
      total_criticas: asigCriticas,
      contestadas,
      dominadas,
      pct_limpieza,
      pct_dominio,
      pendientes
    };
  }).sort((a, b) => b.total_criticas - a.total_criticas);

  const pct_global_limpieza = total_criticas > 0
    ? Math.round((total_contestadas / total_criticas) * 1000) / 10
    : 0;

  return {
    total_criticas,
    total_contestadas,
    total_dominadas,
    pct_global_limpieza,
    por_asignatura
  };
}

// ============================================================================
// ICONOS SVG PUROS
// ============================================================================

const IcoTrendingUp = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
);

const IcoTarget = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const IcoAlertTriangle = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IcoCheckCircle = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

const IcoRepeat = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

const IcoShieldCheck = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const IcoSearch = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const IcoFlame = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z" />
  </svg>
);

// ============================================================================
// COMPONENTE PRINCIPAL: EVALUACION P80
// ============================================================================

export default function EvaluacionP80({ setTab }) {
  // 1. Suscripción reactiva al hook usePreguntasStats y sincronización cross-tab
  const { stats: hookStats } = usePreguntasStats();

  const loadStatsFromStorage = useCallback(() => {
    try {
      if (typeof localStorage === 'undefined') return {};
      const raw = localStorage.getItem('mir_banco_preguntas_stats');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }, []);

  const [stats, setStats] = useState(() => {
    const fromStorage = loadStatsFromStorage();
    return Object.keys(fromStorage).length > 0 ? fromStorage : (hookStats || {});
  });

  useEffect(() => {
    if (hookStats && Object.keys(hookStats).length > 0) {
      setStats(hookStats);
    }
  }, [hookStats]);

  // 2. Estado local del historial de tiradas con carga tolerante a fallos
  const loadTiradasFromStorage = useCallback(() => {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem('mir_historial_tiradas') || localStorage.getItem('mir_historial_tiradas_v1');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('Error leyendo historial de tiradas:', e);
      return [];
    }
  }, []);

  const [historialTiradas, setHistorialTiradas] = useState(loadTiradasFromStorage);
  const [selectedSimNum, setSelectedSimNum] = useState(19);
  const [subtemaFilter, setSubtemaFilter] = useState('');
  const [asignaturaFilter, setAsignaturaFilter] = useState('');
  const [sortBy, setSortBy] = useState('criticas'); // 'criticas', 'limpieza', 'pendientes'

  // 3. Reactividad: escuchar CustomEvents y window storage para actualizar KPIs al instante
  useEffect(() => {
    const handleRefresh = () => {
      setHistorialTiradas(loadTiradasFromStorage());
      setStats(loadStatsFromStorage());
    };

    const handleStorageEvent = (e) => {
      if (
        !e ||
        e.key === 'mir_banco_preguntas_stats' ||
        e.key === 'mir_historial_tiradas' ||
        e.key === 'mir_historial_tiradas_v1'
      ) {
        setHistorialTiradas(loadTiradasFromStorage());
        if (!e || e.key === 'mir_banco_preguntas_stats') {
          setStats(loadStatsFromStorage());
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('mir_tirada_saved', handleRefresh);
      window.addEventListener('mir_stats_updated', handleRefresh);
      window.addEventListener('storage', handleStorageEvent);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('mir_tirada_saved', handleRefresh);
        window.removeEventListener('mir_stats_updated', handleRefresh);
        window.removeEventListener('storage', handleStorageEvent);
      }
    };
  }, [loadTiradasFromStorage, loadStatsFromStorage]);

  // 4. Cálculos reactivos memorizados
  const kpi1 = useMemo(() => calcularKPI1_RumboP80(simulacrosData), []);
  const kpi2 = useMemo(() => calcularKPI2_ConversionHermanas(stats, historialTiradas), [stats, historialTiradas]);
  const kpi3 = useMemo(() => calcularKPI3_TermometroCobertura(desglosesData, simulacrosData, evaluacionesData, bancoPreguntasData, stats), [stats]);

  // Simulacro seleccionado para el análisis detallado de fugas
  const selectedSim = useMemo(() => {
    const found = kpi1.simulacros.find(s => s.numero === selectedSimNum);
    return found || kpi1.simulacros[kpi1.simulacros.length - 1] || null;
  }, [kpi1, selectedSimNum]);

  // Subtemas crónicos filtrados
  const filteredSubtemas = useMemo(() => {
    if (!subtemaFilter.trim()) return kpi2.subtemas_reincidentes;
    const term = normText(subtemaFilter);
    return kpi2.subtemas_reincidentes.filter(st =>
      normText(st.asignatura).includes(term) ||
      normText(st.tema).includes(term) ||
      normText(st.subtema).includes(term)
    );
  }, [kpi2.subtemas_reincidentes, subtemaFilter]);

  // Asignaturas filtradas y ordenadas para el Termómetro
  const sortedAsignaturas = useMemo(() => {
    let list = [...kpi3.por_asignatura];
    if (asignaturaFilter.trim()) {
      const term = normText(asignaturaFilter);
      list = list.filter(a => normText(a.asignatura).includes(term));
    }
    if (sortBy === 'limpieza') {
      list.sort((a, b) => b.pct_limpieza - a.pct_limpieza || b.total_criticas - a.total_criticas);
    } else if (sortBy === 'pendientes') {
      list.sort((a, b) => b.pendientes - a.pendientes);
    } else {
      list.sort((a, b) => b.total_criticas - a.total_criticas);
    }
    return list;
  }, [kpi3.por_asignatura, asignaturaFilter, sortBy]);

  // Datos para la gráfica Recharts de evolución hacia el P80
  const chartData = useMemo(() => {
    return kpi1.simulacros.map(s => ({
      sim: `S${s.numero}`,
      numero: s.numero,
      netas: s.netas,
      p80_target: s.p80_target,
      gap_p80: s.gap_p80,
      fuga_b1: s.fuga_neta_b1,
      fuga_b2: s.fuga_neta_b2,
      fuga_total: Math.round((s.fuga_neta_b1 + s.fuga_neta_b2) * 10) / 10
    }));
  }, [kpi1]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-16 animate-fade-in text-slate-800">
      
      {/* =================================================================== */}
      {/* HEADER PRINCIPAL */}
      {/* =================================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white rounded-3xl p-8 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-72 h-72 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-orange-500/20 text-orange-400 border border-orange-500/30">
                <IcoTarget className="w-3.5 h-3.5 text-orange-400" />
                Auditoría Oficial MIR 2027
              </span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300">
                Meta: 31 de Diciembre
              </span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
              Evaluación P80 <span className="text-orange-500">·</span> Progreso de 3ª Vuelta
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Monitoreo cuantitativo del rendimiento en simulacros y la eficacia del método de estudio.
              Mide objetivamente la fuga neta de puntos en preguntas fáciles y el avance real sobre el pool crítico de 5.952 preguntas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-4 min-w-[160px] text-center">
              <div className="text-xs text-slate-400 font-medium">Meta Percentil 80</div>
              <div className="text-2xl font-black text-orange-400 mt-1">~124 netas</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Simulacro 19 (P80)</div>
            </div>
            <div className="bg-slate-800/80 backdrop-blur border border-slate-700 rounded-2xl p-4 min-w-[160px] text-center">
              <div className="text-xs text-slate-400 font-medium">Limpieza Global 3V</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">
                {kpi3.pct_global_limpieza}%
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {kpi3.total_contestadas.toLocaleString()} / {kpi3.total_criticas.toLocaleString()} p
              </div>
            </div>
          </div>
        </div>

        {/* Global Thermometer Bar Header */}
        <div className="mt-8 pt-6 border-t border-slate-700/60">
          <div className="flex justify-between items-center text-xs mb-2 text-slate-300 font-medium">
            <span className="flex items-center gap-1.5">
              <IcoFlame className="w-4 h-4 text-orange-400" />
              Termómetro Global de Cobertura (35 Asignaturas · Pool Crítico)
            </span>
            <span className="font-bold text-orange-400">
              {kpi3.total_contestadas.toLocaleString()} contestadas · {kpi3.total_dominadas.toLocaleString()} dominadas (racha ≥ 2)
            </span>
          </div>
          <div className="w-full bg-slate-700/70 rounded-full h-3.5 p-0.5 overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-orange-500 to-amber-400 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(1, kpi3.pct_global_limpieza))}%` }}
              title={`Cobertura: ${kpi3.pct_global_limpieza}%`}
            />
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* KPI 1: RUMBO AL P80 POR BLOQUES DE DIFICULTAD EN SIMULACROS CTO */}
      {/* =================================================================== */}
      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
                <IcoTrendingUp className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                KPI 1 · Rumbo al P80 por Bloques de Dificultad en Simulacros
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Evolución de netas frente al P80 oficial/Gaussiano y cuantificación de fugas en
              <strong className="text-rose-600"> Bloque 1 (≥70% pob · Fallos Prohibidos)</strong> y
              <strong className="text-amber-600"> Bloque 2 (50-69% pob · Asequibles)</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label htmlFor="sim-select" className="text-xs font-semibold text-slate-600 whitespace-nowrap">
              Examinar Simulacro:
            </label>
            <select
              id="sim-select"
              value={selectedSimNum}
              onChange={(e) => setSelectedSimNum(Number(e.target.value))}
              className="text-sm font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {kpi1.simulacros.map(s => (
                <option key={s.numero} value={s.numero}>
                  Simulacro {s.numero} ({s.netas} netas)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Insight Pedagógico Destacado */}
        {selectedSim && (
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-orange-500 text-white shrink-0 mt-0.5">
                <IcoAlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  Diagnóstico Simulacro {selectedSim.numero}
                  <span className="text-xs font-normal text-slate-500">({selectedSim.fecha})</span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed max-w-3xl">
                  En el Simulacro {selectedSim.numero}, tu brecha al P80 es de{' '}
                  <strong className="text-rose-600 font-bold">{selectedSim.gap_p80} netas</strong>.
                  Tus fallos/blancas en Bloque 1 (≥70% acierto poblacional) provocaron una fuga de{' '}
                  <strong className="text-rose-600 font-bold">-{selectedSim.fuga_neta_b1} netas</strong> ({selectedSim.leaks_b1} preguntas)
                  y en Bloque 2 una fuga de{' '}
                  <strong className="text-amber-600 font-bold">-{selectedSim.fuga_neta_b2} netas</strong> ({selectedSim.leaks_b2} preguntas).
                  {selectedSim.netas + selectedSim.fuga_neta_b1 >= selectedSim.p80_target ? (
                    <span className="block mt-1 font-semibold text-emerald-800">
                      🎯 Con solo eliminar los {selectedSim.leaks_b1} fallos prohibidos del Bloque 1, habrías alcanzado{' '}
                      {(selectedSim.netas + selectedSim.fuga_neta_b1).toFixed(1)} netas, superando directamente la meta P80 ({selectedSim.p80_target} netas).
                    </span>
                  ) : (
                    <span className="block mt-1 font-semibold text-slate-800">
                      🎯 Eliminando los fallos de Bloques 1 y 2 habrías alcanzado{' '}
                      {(selectedSim.netas + selectedSim.fuga_neta_b1 + selectedSim.fuga_neta_b2).toFixed(1)} netas.
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 bg-white/80 backdrop-blur rounded-xl px-4 py-2.5 border border-orange-200">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Netas Reales</div>
                <div className="text-lg font-black text-slate-900">{selectedSim.netas}</div>
              </div>
              <div className="text-slate-300">→</div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Sin Fallos B1</div>
                <div className="text-lg font-black text-emerald-600">
                  {(selectedSim.netas + selectedSim.fuga_neta_b1).toFixed(1)}
                </div>
              </div>
              <div className="text-slate-300">|</div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Objetivo P80</div>
                <div className="text-lg font-black text-orange-600">{selectedSim.p80_target}</div>
              </div>
            </div>
          </div>
        )}

        {/* Gráfica Recharts de Evolución y Fugas */}
        <div className="space-y-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Evolución en 19 Simulacros vs Meta P80 y Fugas Netas B1+B2</span>
            <span className="text-slate-400 font-normal">Fórmula oficial penalización MIR: fallo = -1.33p, blanca = -1.0p</span>
          </div>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="sim" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} domain={[0, 160]} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white rounded-xl p-3 shadow-xl text-xs space-y-1.5 border border-slate-700">
                        <div className="font-bold text-orange-400 text-sm">Simulacro {data.numero}</div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Netas Reales:</span>
                          <span className="font-bold">{data.netas}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Objetivo P80:</span>
                          <span className="font-bold text-orange-400">{data.p80_target}</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-300">Brecha P80:</span>
                          <span className="font-bold text-rose-400">+{data.gap_p80}</span>
                        </div>
                        <div className="border-t border-slate-700 pt-1 mt-1">
                          <div className="flex justify-between gap-4 text-rose-300">
                            <span>Fuga B1 (≥70% pob):</span>
                            <span className="font-semibold">-{data.fuga_b1} netas</span>
                          </div>
                          <div className="flex justify-between gap-4 text-amber-300">
                            <span>Fuga B2 (50-69% pob):</span>
                            <span className="font-semibold">-{data.fuga_b2} netas</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                <ReferenceLine y={124} stroke="#f97316" strokeDasharray="4 4" label={{ value: 'P80 Target (~124 netas)', fill: '#ea580c', fontSize: 11 }} />
                <Bar dataKey="fuga_b1" name="Fuga B1 (≥70% pob)" fill="#f43f5e" stackId="fuga" barSize={14} radius={[0, 0, 0, 0]} />
                <Bar dataKey="fuga_b2" name="Fuga B2 (50-69% pob)" fill="#f59e0b" stackId="fuga" barSize={14} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="netas" name="Netas Reales Alumno" stroke="#0f172a" strokeWidth={3} dot={{ r: 3, fill: '#0f172a' }} />
                <Line type="monotone" dataKey="p80_target" name="Objetivo P80" stroke="#f97316" strokeWidth={2} strokeDasharray="3 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking de Asignaturas que provocan Fugas en el Simulacro Seleccionado */}
        {selectedSim && selectedSim.leaky_subjects && (
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Top Asignaturas con Mayor Fuga en B1 y B2 (Simulacro {selectedSim.numero})</span>
              <span className="text-xs font-normal text-slate-500">
                — Especialidades prioritarias donde se pierden netas en preguntas fáciles
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
              {selectedSim.leaky_subjects.slice(0, 12).map((item, idx) => (
                <div key={item.asignatura} className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-bold">#{idx + 1}</span>
                    <span className="text-rose-600 font-black">-{item.fuga_netas}p</span>
                  </div>
                  <div className="font-semibold text-xs text-slate-900 truncate mt-1" title={item.asignatura}>
                    {item.asignatura}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* =================================================================== */}
      {/* KPI 2: EFICACIA DE RETENCIÓN Y CONVERSIÓN DE PREGUNTAS HERMANAS */}
      {/* =================================================================== */}
      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-100 text-emerald-600">
                <IcoRepeat className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                KPI 2 · Eficacia de Retención y Conversión de «Preguntas Hermanas»
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Medición de la tasa de rescate sobre fallos vencidos por latencia y verificación de
              transferencia conceptual real mediante preguntas hermanas vírgenes del mismo subtema.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700">
            <span>Fuente:</span>
            <code>mir_banco_preguntas_stats</code> + <code>mir_historial_tiradas</code>
          </div>
        </div>

        {/* 3 Tarjetas de Métricas Clave */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          
          {/* Tarjeta 1: Tasa de Rescate */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                Tasa de Rescate de Fallos
              </span>
              <span className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-700">
                <IcoShieldCheck className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-700">
                {kpi2.tasa_rescate_pct}%
              </span>
              <span className="text-xs text-emerald-800 font-semibold">
                ({kpi2.fallos_rescatados} / {kpi2.fallos_repasados} rescatadas en verde)
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Porcentaje de preguntas previamente falladas en test/simulacro que al reaparecer
              en repaso de latencia pasan a acertarse con seguridad alta (Verde).
            </p>
          </div>

          {/* Tarjeta 2: Tasa de Preguntas Hermanas */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                Conversión Preguntas Hermanas
              </span>
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-700">
                <IcoTarget className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-blue-700">
                {kpi2.tasa_hermanas_pct}%
              </span>
              <span className="text-xs text-blue-800 font-semibold">
                ({kpi2.hermanas_acertadas} / {kpi2.hermanas_total} acertadas)
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Verifica el entendimiento fisiopatológico real: preguntas nunca vistas del mismo
              subtema emparejadas en el Motor 3 para evitar memoria fotográfica.
            </p>
          </div>

          {/* Tarjeta 3: Subtemas Reincidentes Crónicos */}
          <div className="bg-gradient-to-br from-rose-50 to-orange-50 border border-rose-200/80 rounded-2xl p-5 space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wider">
                Subtemas Reincidentes Crónicos
              </span>
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-700">
                <IcoAlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-700">
                {kpi2.subtemas_reincidentes.length}
              </span>
              <span className="text-xs text-rose-800 font-semibold">
                subtemas con ≥ 2 fallos acumulados
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-snug">
              Puntos ciegos persistentes donde el alumno tropieza repetidamente.
              Requieren flashcard de concepto clave o estudio enfocado.
            </p>
          </div>

        </div>

        {/* Tabla de Subtemas Reincidentes Crónicos */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Listado de Subtemas Reincidentes Crónicos</span>
              <span className="text-xs font-normal text-slate-500">
                ({filteredSubtemas.length} registrados)
              </span>
            </h3>

            <div className="relative min-w-[240px]">
              <IcoSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={subtemaFilter}
                onChange={(e) => setSubtemaFilter(e.target.value)}
                placeholder="Buscar asignatura, tema o subtema..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>

          {filteredSubtemas.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2">
              <IcoCheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-semibold text-slate-700">
                ¡Sin subtemas reincidentes crónicos!
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                No hay preguntas con 2 o más fallos registrados en las respuestas locales actuales.
                A medida que realices tiradas en los motores diarios, cualquier fallo reiterado aparecerá aquí.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Asignatura</th>
                    <th className="py-3 px-4">Tema</th>
                    <th className="py-3 px-4">Subtema Crítico</th>
                    <th className="py-3 px-4 text-center">Fallos Acumulados</th>
                    <th className="py-3 px-4 text-right">Netas Perdidas Est.</th>
                    <th className="py-3 px-4 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredSubtemas.slice(0, 25).map((st, i) => (
                    <tr key={`${st.asignatura}-${st.tema}-${st.subtema}-${i}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{st.asignatura}</td>
                      <td className="py-3 px-4 text-slate-600">{st.tema}</td>
                      <td className="py-3 px-4 font-semibold text-rose-700">{st.subtema}</td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          {st.fallos_cronicos} fallos
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-600">
                        -{st.netas_perdidas} netas
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setTab && setTab('desgloses')}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors"
                        >
                          Repasar Desgloses
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* =================================================================== */}
      {/* KPI 3: TERMÓMETRO DE COBERTURA REAL DE 3ª VUELTA POR ASIGNATURA */}
      {/* =================================================================== */}
      <section className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 lg:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-100 text-orange-600">
                <IcoFlame className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-slate-900">
                KPI 3 · Termómetro de Cobertura Real de 3ª Vuelta por Asignatura
              </h2>
            </div>
            <p className="text-sm text-slate-500">
              Progreso detallado sobre el <strong className="text-slate-900">Pool Crítico de 5.952 preguntas</strong>:
              2.360 Desgloses MIR (2015-2025) + 1.495 Fallos Simulacros/Evaluaciones CTO (≥35% pob) + 2.097 Test 2V.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Buscador de asignatura */}
            <div className="relative min-w-[200px]">
              <IcoSearch className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={asignaturaFilter}
                onChange={(e) => setAsignaturaFilter(e.target.value)}
                placeholder="Filtrar asignatura..."
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Selector de ordenación */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="criticas">Mayor pool de preguntas</option>
              <option value="limpieza">% Limpieza completado</option>
              <option value="pendientes">Más preguntas pendientes</option>
            </select>
          </div>
        </div>

        {/* Resumen Superior del Termómetro */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xs text-slate-500 font-semibold">Total Pool Crítico</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {kpi3.total_criticas.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">35 Asignaturas</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xs text-slate-500 font-semibold">Preguntas Realizadas</div>
            <div className="text-2xl font-black text-orange-600 mt-1">
              {kpi3.total_contestadas.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              {kpi3.pct_global_limpieza}% del total
            </div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xs text-slate-500 font-semibold">Preguntas Dominadas</div>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {kpi3.total_dominadas.toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Racha Verde ≥ 2</div>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 text-center">
            <div className="text-xs text-slate-500 font-semibold">Pendientes de Barrido</div>
            <div className="text-2xl font-black text-slate-700 mt-1">
              {(kpi3.total_criticas - kpi3.total_contestadas).toLocaleString()}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">Por absorber</div>
          </div>
        </div>

        {/* Tabla de 35 Asignaturas */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[11px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Asignatura</th>
                <th className="py-3 px-4 text-center">Pool Crítico</th>
                <th className="py-3 px-4 text-center">Contestadas</th>
                <th className="py-3 px-4 text-center">Dominadas</th>
                <th className="py-3 px-4 text-center">% Limpieza</th>
                <th className="py-3 px-4 text-center">% Dominio</th>
                <th className="py-3 px-4 text-center">Pendientes</th>
                <th className="py-3 px-4 w-44">Barra de Progreso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {sortedAsignaturas.map((asig) => (
                <tr key={asig.asignatura} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900">
                    {asig.asignatura}
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-800">
                    {asig.total_criticas}
                  </td>
                  <td className="py-3 px-4 text-center text-slate-700 font-bold">
                    {asig.contestadas}
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-600 font-bold">
                    {asig.dominadas}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                      asig.pct_limpieza >= 75
                        ? 'bg-emerald-100 text-emerald-800'
                        : asig.pct_limpieza >= 35
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {asig.pct_limpieza}%
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center text-emerald-700 font-semibold">
                    {asig.pct_dominio}%
                  </td>
                  <td className="py-3 px-4 text-center font-semibold text-slate-500">
                    {asig.pendientes}
                  </td>
                  <td className="py-3 px-4">
                    <div className="w-full bg-slate-200/80 rounded-full h-2.5 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, asig.pct_limpieza)}%` }}
                        title={`${asig.asignatura}: ${asig.pct_limpieza}% completado`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
