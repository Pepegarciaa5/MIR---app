import { ESPECIALIDADES } from './especialidadesMIR'
import { planificacionCTO } from './planificacionBridge'
import {
  getRepasos, upsertRepaso,
  getBloquesCompletados, addBloqueCompletado,
  getBloquesDescartados, addBloqueDescartado,
  getPlanesAdicionales, addPlanAdicional,
  migrarDesdeLocalStorage,
} from '../lib/db'

export const MIR_DATE = new Date('2027-01-25')

const d = new Date();
const day = String(d.getDate()).padStart(2, '0');
const month = String(d.getMonth() + 1).padStart(2, '0');
const year = d.getFullYear();
export const todayStr = `${year}-${month}-${day}`;

// El calendario ahora se alimenta directamente del JSON de CTO
export const planesCalendarioGlobal = planificacionCTO;

// temaDia: resumen del día actual extraído del calendario
const todayPlan = planesCalendarioGlobal[todayStr] || []
const duracionMinutos = todayPlan.reduce((sum, b) => {
  if (!b.inicio || !b.fin) return sum
  const [h1,m1] = b.inicio.split(':').map(Number)
  const [h2,m2] = b.fin.split(':').map(Number)
  return sum + (h2*60+m2) - (h1*60+m1)
}, 0)

export const temaDia = todayPlan.length > 0
  ? {
      titulo: todayPlan.map(b => b.titulo.replace(/^[^\s]+\s/, '')).join(' + '),
      especialidad: todayPlan[0].especialidad || ESPECIALIDADES.LIBRE,
      duracion: `${(duracionMinutos/60).toFixed(1).replace('.', ',')}h`,
      preguntas: 0,
    }
  : {
      titulo: 'Día libre o sin plan',
      especialidad: ESPECIALIDADES.LIBRE,
      duracion: '0h',
      preguntas: 0,
    };

export const estadisticasDia = {
  horasEstaSemana: 0,
  horasPlanificadasSemana: 35,
  repasosPendientes: 0,
}

export const planDia = todayPlan;

// ── Reactive in-memory arrays backed by Supabase ────────────────────────────
// These are loaded async by useAppData() hook — see below.
// Components should use useAppData() instead of importing these directly.
export let repasosData = []
export let bloquesCompletados = []
export let bloquesDescartados = []
export let planesAdicionales = {}
export let tareasPendientesGlobal = []

// ── Load all data from Supabase ─────────────────────────────────────────────
export async function loadAppData() {
  const [repasos, completados, descartados, adicionales] = await Promise.all([
    getRepasos(),
    getBloquesCompletados(),
    getBloquesDescartados(),
    getPlanesAdicionales(),
  ])
  repasosData.length = 0
  repasos.forEach(r => repasosData.push(r))
  bloquesCompletados.length = 0
  completados.forEach(id => bloquesCompletados.push(id))
  bloquesDescartados.length = 0
  descartados.forEach(id => bloquesDescartados.push(id))
  Object.keys(planesAdicionales).forEach(k => delete planesAdicionales[k])
  Object.assign(planesAdicionales, adicionales)
  return { repasos, completados, descartados, adicionales }
}

// ── Persist helpers (called from screens after mutations) ───────────────────
export const persistRepaso = (repaso) => upsertRepaso(repaso)
export const persistBloqueCompletado = (id) => addBloqueCompletado(id)
export const persistBloqueDescartado = (id) => addBloqueDescartado(id)
export const persistPlanAdicional = (fecha, bloque) => addPlanAdicional(fecha, bloque)

// Legacy: kept for compatibility, now a no-op (each operation persists individually)
export const persistData = () => {}

// ── One-time migration from localStorage ────────────────────────────────────
export { migrarDesdeLocalStorage }

export const datosDiarios = [
  { dia: 'L', real: 0, plan: 7   },
  { dia: 'M', real: 0, plan: 7   },
  { dia: 'X', real: 0, plan: 7   },
  { dia: 'J', real: 0, plan: 7   },
  { dia: 'V', real: 0, plan: 7   },
  { dia: 'S', real: 0, plan: 3.5 },
  { dia: 'D', real: 0, plan: 0   },
]

export const especialidades = [
  { nombre: ESPECIALIDADES.CARDIOLOGIA,    temas: 0, total: 80 },
  { nombre: ESPECIALIDADES.NEUMOLOGIA,     temas: 0, total: 60 },
  { nombre: ESPECIALIDADES.NEUROLOGIA,     temas: 0, total: 75 },
  { nombre: ESPECIALIDADES.FARMACOLOGIA,   temas: 0, total: 90 },
  { nombre: ESPECIALIDADES.ENDOCRINOLOGIA, temas: 0, total: 55 },
]

export const historialEmocional = []
