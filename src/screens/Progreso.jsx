/**
 * Archivo: Progreso.jsx
 * Descripción: Dashboard analítico del progreso temporal. Muestra gráficas de rendimiento, evolución de netas y cumplimiento del plan.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-17
 */

import { useMemo } from 'react'
import { useTracker } from '../context/TrackerContext'
import { repasosData, bloquesCompletados } from '../data/mockData'
import { getEspecialidadColor } from '../data/especialidadesMIR'
import EntradaEditable from '../components/EntradaEditable'
import ProgresoDiario from '../components/ProgresoDiario'
import { usePreguntasStats } from '../hooks/usePreguntasStats'
import QUESTIONS from '../data/bancoPreguntas.json'

const ACCENT = '#F26522'
const BLUE = '#3b82f6'
const GREEN = '#10b981'
const PURPLE = '#8b5cf6'
const TEAL = '#14b8a6'

function getWeekBounds() {
  const now = new Date()
  const dow = now.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function MetricCard({ label, value, sub, color, progress, delay = '0ms' }) {
  const pct = Math.min(progress * 100, 100)
  return (
    <div 
      className="glass-card p-4 animate-slide-up hover:-translate-y-1 hover:shadow-md transition-all duration-300"
      style={{ animationDelay: delay }}
    >
      <div className="text-3xl font-black mb-1 tracking-tight leading-none" style={{ color }}>{value}</div>
      <div className="text-xs font-bold text-slate-800 mb-0.5">{label}</div>
      <div className="text-[11px] text-slate-400 mb-3">{sub}</div>
      <div className="bg-slate-100/50 rounded-full h-1.5 overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-700 ease-out" 
          style={{ width: `${pct}%`, background: color }} 
        />
      </div>
    </div>
  )
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
const PLAN_HOURS = [7, 7, 7, 7, 7, 3.5, 0]

export default function Progreso() {
  const { entries } = useTracker()

  const { monday, sunday } = getWeekBounds()
  const weekEntries = entries.filter(e => e.inicio >= monday.getTime() && e.inicio <= sunday.getTime())

  const horasReal = Math.round((weekEntries.reduce((s, e) => s + e.duracionSegundos, 0) / 3600) * 10) / 10
  const horasPlan = 35

  const byDay = [0, 0, 0, 0, 0, 0, 0]
  weekEntries.forEach(e => {
    const dow = new Date(e.inicio).getDay()
    const idx = dow === 0 ? 6 : dow - 1
    byDay[idx] = Math.round((byDay[idx] + e.duracionSegundos / 3600) * 10) / 10
  })

  const byEsp = {}
  weekEntries.forEach(e => {
    if (e.especialidad && !e.especialidad.startsWith('_')) {
      byEsp[e.especialidad] = (byEsp[e.especialidad] || 0) + e.duracionSegundos / 3600
    }
  })
  const topEsp = Object.entries(byEsp).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const maxEspH = topEsp.length > 0 ? topEsp[0][1] : 1

  const totalBloquesCompletados = bloquesCompletados.length
  const asignaturasDistintas = Object.keys(byEsp).length
  const repasosPendientes = repasosData.filter(r => r.fechaProximoRepaso <= Date.now()).length

  const MAX_H = Math.max(...byDay, ...PLAN_HOURS, 1)

  // --- Estadísticas de preguntas ---
  const { stats: preguntasStats, sincronizarDesdeNube, subirProgresoLocalANube, exportarJSON, importarJSON } = usePreguntasStats()

  const qMap = useMemo(() => {
    const m = {}
    QUESTIONS.forEach(q => { m[q.id] = q.asignatura })
    return m
  }, [])

  const preguntasData = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const { monday: wMonday, sunday: wSunday } = getWeekBounds()

    let hoy = 0, hoyAciertos = 0, hoyFallos = 0
    let semana = 0, semanaAciertos = 0, semanaFallos = 0
    let total = 0, totalAciertos = 0, totalFallos = 0
    const porAsigSemana = {}
    const porDia = [0, 0, 0, 0, 0, 0, 0]

    Object.entries(preguntasStats).forEach(([qId, s]) => {
      if (!s.ultimaFecha) return
      const fecha = new Date(s.ultimaFecha)
      const fechaStr = s.ultimaFecha.slice(0, 10)
      const asig = qMap[qId] || 'Desconocida'

      total += s.vecesVistas
      totalAciertos += s.aciertos
      totalFallos += s.fallos

      if (fechaStr === todayStr) {
        hoy += s.vecesVistas
        hoyAciertos += s.aciertos
        hoyFallos += s.fallos
      }

      if (fecha >= wMonday && fecha <= wSunday) {
        semana += s.vecesVistas
        semanaAciertos += s.aciertos
        semanaFallos += s.fallos

        porAsigSemana[asig] = porAsigSemana[asig] || { total: 0, aciertos: 0, fallos: 0 }
        porAsigSemana[asig].total += s.vecesVistas
        porAsigSemana[asig].aciertos += s.aciertos
        porAsigSemana[asig].fallos += s.fallos

        const dow = fecha.getDay()
        const idx = dow === 0 ? 6 : dow - 1
        porDia[idx] += s.vecesVistas
      }
    })

    const topAsig = Object.entries(porAsigSemana).sort((a, b) => b[1].total - a[1].total)
    const pctGlobal = total > 0 ? ((totalAciertos / total) * 100).toFixed(1) : 0

    return { hoy, hoyAciertos, hoyFallos, semana, semanaAciertos, semanaFallos, total, totalAciertos, totalFallos, pctGlobal, topAsig, porDia }
  }, [preguntasStats, qMap])

  return (
    <div className="p-1 pb-10 space-y-6 animate-fade-in max-w-5xl mx-auto">
      
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Progreso</h2>
          <p className="text-sm font-medium text-slate-500 mt-1">Análisis de rendimiento y tiempo de estudio</p>
        </div>
      </div>

      <ProgresoDiario />

      <section>
        <h3 className="text-base font-bold text-slate-700 tracking-tight mb-3 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Esta semana
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <MetricCard label="Horas de estudio" value={`${horasReal}h`} sub={`/ ${horasPlan}h planificadas`} color={ACCENT} progress={horasReal / horasPlan} delay="0ms" />
          <MetricCard label="Asignaturas" value={asignaturasDistintas} sub="trabajadas esta semana" color={BLUE} progress={asignaturasDistintas / 10} delay="50ms" />
          <MetricCard label="Bloques completados" value={totalBloquesCompletados} sub="del calendario" color={GREEN} progress={totalBloquesCompletados / 20} delay="100ms" />
          <MetricCard label="Repasos pendientes" value={repasosPendientes} sub="para hoy" color={PURPLE} progress={repasosPendientes / 20} delay="150ms" />
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 mt-4">
          <h3 className="text-base font-bold text-slate-700 tracking-tight flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500"></span> Banco de Preguntas
          </h3>
          <div className="flex items-center gap-2 text-xs font-bold text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg border border-teal-200">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <span>Sincronizado con Supabase Cloud</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 lg:gap-4 mb-4">
          <div className="glass-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-teal-500/10 rounded-full blur-2xl group-hover:bg-teal-500/20 transition-all"></div>
            <div className="text-4xl font-black tracking-tight leading-none text-teal-500">{preguntasData.hoy}</div>
            <div className="text-sm font-bold text-slate-900 mt-2">Hoy</div>
            <div className="text-xs font-medium text-slate-500 mt-1 flex gap-3">
              <span className="text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{preguntasData.hoyAciertos} ✓</span>
              <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{preguntasData.hoyFallos} ✗</span>
            </div>
          </div>
          
          <div className="glass-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
            <div className="text-4xl font-black tracking-tight leading-none text-blue-500">{preguntasData.semana}</div>
            <div className="text-sm font-bold text-slate-900 mt-2">Esta semana</div>
            <div className="text-xs font-medium text-slate-500 mt-1 flex gap-3">
              <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{preguntasData.semanaAciertos} ✓</span>
              <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{preguntasData.semanaFallos} ✗</span>
            </div>
          </div>

          <div className="glass-card p-5 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-500/10 rounded-full blur-2xl group-hover:bg-orange-500/20 transition-all"></div>
            <div className="text-4xl font-black tracking-tight leading-none text-accent">{preguntasData.pctGlobal}%</div>
            <div className="text-sm font-bold text-slate-900 mt-2">Acierto global</div>
            <div className="text-xs font-medium text-slate-500 mt-1">
              {preguntasData.total} preguntas totales
            </div>
          </div>
        </div>

        {preguntasData.semana > 0 && (
          <div className="glass-card p-5 mb-4">
            <div className="text-sm font-bold text-slate-800 mb-5">Preguntas por día</div>
            <div className="flex items-end justify-around h-24 gap-2 mb-2">
              {DAY_LABELS.map((dia, i) => {
                const maxQ = Math.max(...preguntasData.porDia, 1)
                const h = Math.round((preguntasData.porDia[i] / maxQ) * 80)
                return (
                  <div key={dia} className="flex flex-col items-center flex-1 group">
                    <div className="text-[10px] font-bold text-teal-600 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {preguntasData.porDia[i] > 0 ? preguntasData.porDia[i] : ''}
                    </div>
                    <div className="w-full max-w-[24px] rounded-t-md transition-all duration-500 relative overflow-hidden" style={{ height: h || 2, backgroundColor: preguntasData.porDia[i] > 0 ? TEAL : '#f1f5f9' }}>
                      {preguntasData.porDia[i] > 0 && <div className="absolute inset-0 bg-gradient-to-t from-teal-600/20 to-transparent"></div>}
                    </div>
                    <div className="text-xs font-semibold text-slate-400 mt-2">{dia}</div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {preguntasData.topAsig.length > 0 && (
          <div className="glass-card p-5 mb-4">
            <div className="text-sm font-bold text-slate-800 mb-5">Preguntas por asignatura (semana)</div>
            <div className="flex flex-col gap-4">
              {preguntasData.topAsig.map(([asig, d]) => {
                const maxAsig = preguntasData.topAsig[0][1].total
                const pct = Math.round((d.total / maxAsig) * 100)
                const pctAcierto = d.total > 0 ? Math.round((d.aciertos / d.total) * 100) : 0
                const c = getEspecialidadColor(asig)
                return (
                  <div key={asig} className="group">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ color: c.text, background: c.bg, border: `1px solid ${c.border || c.bg}` }}>
                        {asig}
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {d.total} 
                        <span className="text-green-600 ml-2">{d.aciertos}✓</span> 
                        <span className="text-red-500 ml-1">{d.fallos}✗</span> 
                        <span className="text-slate-400 font-medium ml-1">({pctAcierto}%)</span>
                      </span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 opacity-90 group-hover:opacity-100" style={{ width: `${pct}%`, background: c.text || TEAL }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar chart horas real vs planificado */}
        <div className="glass-card p-5">
          <div className="text-sm font-bold text-slate-800 mb-5">Horas de estudio por día</div>
          <div className="flex items-end justify-around h-28 gap-2 mb-4">
            {DAY_LABELS.map((dia, i) => {
              const planH = Math.round((PLAN_HOURS[i] / MAX_H) * 80)
              const realH = Math.round((byDay[i] / MAX_H) * 80)
              const isOver = byDay[i] >= PLAN_HOURS[i] && byDay[i] > 0
              return (
                <div key={dia} className="flex flex-col items-center flex-1">
                  <div className="flex items-end gap-1 h-[80px] w-full justify-center">
                    <div className="w-[30%] max-w-[12px] bg-slate-200 rounded-t-sm" style={{ height: planH || 2 }} />
                    <div className="w-[30%] max-w-[12px] rounded-t-sm transition-all duration-500" style={{ height: realH || 0, backgroundColor: byDay[i] === 0 ? '#f8fafc' : isOver ? ACCENT : '#fb923c', minHeight: byDay[i] > 0 ? 2 : 0 }} />
                  </div>
                  <div className="text-xs font-semibold text-slate-400 mt-2">{dia}</div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 justify-center">
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-slate-200 rounded-[2px]" /><span className="text-[11px] font-medium text-slate-500">Planificado</span></div>
            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-[2px]" style={{background: ACCENT}} /><span className="text-[11px] font-medium text-slate-500">Realizado</span></div>
          </div>
        </div>

        {/* Tiempo por asignatura */}
        <div className="glass-card p-5">
          <div className="text-sm font-bold text-slate-800 mb-5">Tiempo por asignatura</div>
          {topEsp.length === 0 ? (
            <div className="flex items-center justify-center h-28 text-sm text-slate-400 font-medium">
              Empieza a trackear asignaturas para ver el progreso.
            </div>
          ) : (
            <div className="flex flex-col gap-3.5">
              {topEsp.map(([nombre, horas]) => {
                const pct = Math.round((horas / maxEspH) * 100)
                const h = Math.floor(horas)
                const m = Math.round((horas - h) * 60)
                const c = getEspecialidadColor(nombre)
                return (
                  <div key={nombre} className="group">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full" style={{ color: c.text, background: c.bg, border: `1px solid ${c.border}` }}>
                        {nombre}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : h === 0 ? '<1m' : ''}
                      </span>
                    </div>
                    <div className="bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700 opacity-90 group-hover:opacity-100" style={{ width: `${pct}%`, background: c.text }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Últimas entradas */}
      {entries.length > 0 && (
        <section className="glass-card p-5 mt-4">
          <div className="text-sm font-bold text-slate-800 mb-4">Últimas actividades</div>
          <div className="flex flex-col divide-y divide-slate-100/50">
            {entries.slice(0, 15).map(e => (
              <div key={e.id} className="py-2 hover:bg-slate-50/50 rounded-lg px-2 -mx-2 transition-colors">
                <EntradaEditable entry={e} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
