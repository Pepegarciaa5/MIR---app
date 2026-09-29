/**
 * Archivo: Simulacros.jsx
 * Descripción: Centro de análisis de simulacros. Presenta gráficas, post-mortem, evolución de netas y rendimiento comparado por asignaturas.
 * Creado: 2026-08-29
 * Última actualización: 2026-08-29
 */

import { useMemo, useState, useEffect } from 'react'
import {
  getStatsPorSimulacro,
  getStatsGlobales,
  getSimulacrosRich,
  getAnalisisGlobalPorAsignatura,
  getAnalisisDificultad,
  getFallosGraves,
  getPostMortemSimulacro,
  getPreguntas,
  getPreguntasARevisarAsignatura,
  getAnalisisPorTema,
  getPuntosRegalados,
  getTrampasConceptuales,
  ASIGNATURA_NOMBRE,
  attachTextoToPregunta
} from '../lib/simulacros'
import { getEspecialidadColor } from '../data/especialidadesMIR'
import { simulacrosMeta, simulacrosOrdenCronologico } from '../data/simulacrosMeta'
import { usePreguntasStats } from '../hooks/usePreguntasStats'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

const ACCENT = '#F26522'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pctColor(pct) {
  if (pct >= 65) return '#10b981' // emerald-500
  if (pct >= 50) return '#f59e0b' // amber-500
  return '#ef4444' // red-500
}

function percentilColor(p) {
  if (p >= 70) return '#10b981'
  if (p >= 45) return '#f59e0b'
  return '#ef4444'
}

// ─── Gráficos SVG ────────────────────────────────────────────────────────────

function ScatterPlotSVG({ questions, width="100%", height=300 }) {
  const [hoveredQ, setHoveredQ] = useState(null)
  
  const validQuestions = questions.filter(q => q.tiempo > 0 && q.dificultad > 0)
  if (validQuestions.length === 0) return <div className="p-5 text-center text-slate-400 font-medium">No hay datos de tiempo/dificultad para graficar.</div>

  const W = 600
  const H = 300
  const padding = { top: 20, right: 30, bottom: 40, left: 40 }
  const innerW = W - padding.left - padding.right
  const innerH = H - padding.top - padding.bottom

  const maxTime = Math.min(150, Math.max(...validQuestions.map(q => q.tiempo)))

  const points = validQuestions.map(q => {
    const jitterY = (Math.random() - 0.5) * 20
    let x = padding.left + (Math.min(q.tiempo, maxTime) / maxTime) * innerW
    let y = padding.top + innerH - ((q.dificultad - 1) / 4) * innerH + jitterY
    y = Math.max(padding.top, Math.min(padding.top + innerH, y))

    let color = '#94a3b8' 
    if (q.acertada) color = 'rgba(16, 185, 129, 0.7)'
    if (q.fallada) color = 'rgba(239, 68, 68, 0.8)'

    return { x, y, color, q }
  })

  return (
    <div className="relative" style={{ width, maxWidth: W }}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-white border border-slate-100 rounded-xl shadow-sm">
        <line x1={padding.left} y1={H - padding.bottom} x2={W - padding.right} y2={H - padding.bottom} stroke="#e2e8f0" strokeWidth="2" />
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={H - padding.bottom} stroke="#e2e8f0" strokeWidth="2" />
        
        {[1,2,3,4,5].map(d => {
          const y = padding.top + innerH - ((d - 1) / 4) * innerH
          return (
            <g key={d}>
              <line x1={padding.left} y1={y} x2={W - padding.right} y2={y} stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <text x={padding.left - 10} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end" fontWeight="bold">Dif {d}</text>
            </g>
          )
        })}

        {[0, 30, 60, 90, 120].map(t => {
          const x = padding.left + (t / maxTime) * innerW
          if (x > W - padding.right) return null
          return (
            <g key={t}>
              <line x1={x} y1={H - padding.bottom} x2={x} y2={H - padding.bottom + 5} stroke="#cbd5e1" strokeWidth="2" />
              <text x={x} y={H - padding.bottom + 18} fontSize="10" fill="#94a3b8" textAnchor="middle">{t}s</text>
            </g>
          )
        })}
        <text x={W - padding.right} y={H - padding.bottom + 18} fontSize="10" fill="#94a3b8" textAnchor="end">+{maxTime}s</text>
        
        <rect x={padding.left + (90/maxTime)*innerW} y={padding.top} width={innerW - (90/maxTime)*innerW} height={innerH/2} fill="rgba(239, 68, 68, 0.05)" />
        <text x={W - padding.right - 10} y={padding.top + 16} fontSize="10" fill="#ef4444" fontWeight="bold" textAnchor="end">Zona de Bloqueo</text>

        {points.map((p, i) => (
          <circle 
            key={i} cx={p.x} cy={p.y} r={hoveredQ?.numero === p.q.numero ? 6 : 4} 
            fill={p.color} 
            stroke={hoveredQ?.numero === p.q.numero ? '#0f172a' : 'none'}
            strokeWidth={2}
            className="cursor-pointer transition-all duration-150"
            onMouseEnter={() => setHoveredQ(p.q)}
            onMouseLeave={() => setHoveredQ(null)}
          />
        ))}
      </svg>

      {hoveredQ && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-3 py-2 rounded-lg text-[11px] pointer-events-none shadow-xl z-10 backdrop-blur-md border border-slate-700">
          <div className="font-bold mb-0.5">P{hoveredQ.numero} - {ASIGNATURA_NOMBRE[hoveredQ.asignatura] || hoveredQ.asignatura}</div>
          <div className="text-slate-300">
            {hoveredQ.acertada ? '✅ Acertada' : hoveredQ.fallada ? '❌ Fallada' : '➖ Nula'} | Tiempo: {hoveredQ.tiempo}s | Dif: {hoveredQ.dificultad}
          </div>
          {hoveredQ.dudas === 1 && <div className="text-amber-400 mt-0.5 font-medium">⚠️ Marcaste duda</div>}
        </div>
      )}
    </div>
  )
}

function SparklineSVG({ data, width = 80, height = 30 }) {
  if (!data || data.length === 0) return <div style={{ width, height }} />
  const max = Math.max(...data) || 1
  const min = 0
  const points = data.map((val, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width
    const y = height - ((val - min) / (max - min)) * height
    return `${x},${y}`
  })
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline points={points.join(' ')} fill="none" stroke="#F26522" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((val, i) => (
        <circle key={i} cx={(i / Math.max(1, data.length - 1)) * width} cy={height - ((val - min) / (max - min)) * height} r="3" fill="#fff" stroke="#F26522" strokeWidth="1.5" />
      ))}
    </svg>
  )
}

function DualSVGLineChart({ data, width="100%", height=250 }) {
  if(!data || data.length === 0) return null;
  const padding = 30;
  const W = 600;
  const H = 200;
  const innerW = W - padding * 2;
  const innerH = H - padding * 2;
  
  const allNetas = [...data.map(d => d.neta), ...data.map(d => d.netaAjustada)].filter(n => n != null);
  const minNeta = Math.max(0, Math.min(...allNetas) - 20);
  const maxNeta = Math.max(...allNetas) + 20;
  
  const minDif = 1.5;
  const maxDif = 4.5;
  
  const pointsNeta = data.map((d, i) => {
    const x = padding + (i / Math.max(1, (data.length - 1))) * innerW;
    const y = padding + innerH - ((d.neta - minNeta) / (maxNeta - minNeta)) * innerH;
    return { x, y, d };
  });
  const pathNeta = `M ${pointsNeta.map(p => `${p.x},${p.y}`).join(' L ')}`;

  const pointsAjustada = data.map((d, i) => {
    if (d.netaAjustada == null) return null;
    const x = padding + (i / Math.max(1, (data.length - 1))) * innerW;
    const y = padding + innerH - ((d.netaAjustada - minNeta) / (maxNeta - minNeta)) * innerH;
    return { x, y, d };
  }).filter(Boolean);
  const pathAjustada = pointsAjustada.length > 0 ? `M ${pointsAjustada.map(p => `${p.x},${p.y}`).join(' L ')}` : '';

  const pointsDif = data.map((d, i) => {
    const x = padding + (i / Math.max(1, (data.length - 1))) * innerW;
    const y = padding + innerH - ((d.dificultadMedia - minDif) / (maxDif - minDif)) * innerH;
    return { x, y, d };
  });
  const pathDif = `M ${pointsDif.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-transparent overflow-visible">
      <path d={pathNeta} fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinejoin="round" />
      {pathAjustada && <path d={pathAjustada} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeDasharray="6 6" strokeLinejoin="round" />}
      <path d={pathDif} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 4" opacity="0.6" strokeLinejoin="round" />
      
      {pointsAjustada.map((p, i) => (
        <g key={`ajustada-${i}`}>
          <circle cx={p.x} cy={p.y} r="3" fill="#f59e0b" />
          <text x={p.x} y={p.y - 12} fontSize="9" fill="#f59e0b" fontWeight="bold" textAnchor="middle">{p.d.netaAjustada}</text>
        </g>
      ))}

      {pointsNeta.map((p, i) => (
        <g key={`neta-${i}`} className="group">
          <circle cx={p.x} cy={p.y} r="4.5" fill="#10b981" stroke="#fff" strokeWidth="2" className="drop-shadow-sm transition-all group-hover:r-[6]" />
          <text x={p.x} y={p.y + 18} fontSize="10" fill="#059669" fontWeight="bold" textAnchor="middle">{p.d.neta}</text>
        </g>
      ))}
      
      {pointsDif.map((p, i) => (
        <g key={`dif-${i}`}>
          <circle cx={p.x} cy={p.y} r="2" fill="#94a3b8" />
          <text x={p.x} y={p.y + 12} fontSize="8.5" fill="#94a3b8" textAnchor="middle" fontWeight="600">{p.d.dificultadMedia}</text>
        </g>
      ))}
      {pointsNeta.map((p, i) => (
        <text key={`label-${i}`} x={p.x} y={H - padding + 24} fontSize="9.5" fill="#64748b" textAnchor="middle" fontWeight="600">{p.d.fecha}</text>
      ))}
    </svg>
  );
}

// NUEVO GRÁFICO: Aciertos en lugar de Netas para Asignaturas
function SubjectAciertosLineChart({ data, width="100%", height=200 }) {
  if(!data || data.length === 0) return null;
  const padding = 20;
  const W = 500;
  const H = 160;
  const innerW = W - padding * 2;
  const innerH = H - padding * 2;
  
  // Ahora usamos "acertadas" en vez de "neta"
  // Calculamos aciertos ajustados por dificultad (regla de 3 simple o similar: si difMedia > 3, suma aciertos esperados)
  // Pero como los aciertos no pueden pasar del total, es mejor mostrar la curva de dificultad abajo.
  
  const allAciertos = data.map(d => d.acertadas).filter(n => n != null);
  const minAcierto = Math.max(0, Math.min(...allAciertos) - 2);
  const maxAcierto = Math.max(...allAciertos) + 2;
  
  const minDif = 1.5;
  const maxDif = 4.5;
  
  const pointsAcierto = data.map((d, i) => {
    const x = padding + (i / Math.max(1, (data.length - 1))) * innerW;
    const y = padding + innerH - ((d.acertadas - minAcierto) / (maxAcierto - minAcierto)) * innerH;
    return { x, y, d };
  });
  const pathAcierto = `M ${pointsAcierto.map(p => `${p.x},${p.y}`).join(' L ')}`;

  const pointsDif = data.map((d, i) => {
    const x = padding + (i / Math.max(1, (data.length - 1))) * innerW;
    const y = padding + innerH - ((d.difMedia - minDif) / (maxDif - minDif)) * innerH;
    return { x, y, d };
  });
  const pathDif = `M ${pointsDif.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto bg-transparent overflow-visible">
      <path d={pathAcierto} fill="none" stroke="#10b981" strokeWidth="3" strokeLinejoin="round" />
      <path d={pathDif} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" strokeLinejoin="round" />
      
      {pointsDif.map((p, i) => (
        <g key={`dif-${i}`}>
          <circle cx={p.x} cy={p.y} r="2.5" fill="#94a3b8" />
          <text x={p.x} y={p.y - 8} fontSize="9" fill="#94a3b8" fontWeight="bold" textAnchor="middle">{p.d.difMedia}</text>
        </g>
      ))}

      {pointsAcierto.map((p, i) => (
        <g key={`acierto-${i}`}>
          <circle cx={p.x} cy={p.y} r="4" fill="#10b981" stroke="#fff" strokeWidth="2" className="drop-shadow-sm" />
          <text x={p.x} y={p.y + 16} fontSize="11" fill="#059669" fontWeight="900" textAnchor="middle">{p.d.acertadas}</text>
        </g>
      ))}
      
      {pointsAcierto.map((p, i) => (
        <text key={`label-${i}`} x={p.x} y={H - 2} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="700">S{p.d.simulacro}</text>
      ))}
    </svg>
  );
}

// ─── Componentes de UI ────────────────────────────────────────────────────────

function HeaderBar({ title, onBack }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex items-center gap-4 mb-6">
      <button 
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center hover:bg-slate-50 transition-colors group"
      >
        <span className="text-slate-400 group-hover:text-slate-700 font-bold text-xl leading-none -mt-1">←</span>
      </button>
      <h2 className="text-3xl font-black text-slate-900 tracking-tight m-0">{title}</h2>
    </div>
  )
}

function QuestionRow({ q, highlightColor }) {
  const [open, setOpen] = useState(false)
  const fullQ = useMemo(() => open ? attachTextoToPregunta(q) : q, [open, q])
  const { getStatsPregunta, marcarCorregida } = usePreguntasStats()
  
  const stats = getStatsPregunta(q.pregunta_id || q.id) || {}
  const isCorregida = !!stats.corregida

  // Calcular % de acierto: primero intentar pct_field_correct (ya es ratio 0-1),
  // si no está disponible usar pct_correcta / cuenta_total del meta del simulacro
  const pctNum = (() => {
    if (q.pct_field_correct != null) return Math.round(q.pct_field_correct * 100)
    if (q.pct_correcta != null) {
      const meta = simulacrosMeta.find(m => m.numero === q.simulacro)
      const total = meta?.cuenta_total || 3000
      return Math.round((q.pct_correcta / total) * 100)
    }
    return null
  })()
  const difLabel = q.dificultad ? `Dif. ${q.dificultad}` : ''
  
  return (
    <div className={`border-b border-slate-100 transition-colors ${isCorregida ? 'bg-emerald-50' : 'bg-white'}`}>
      <div 
        className={`flex items-center p-3 gap-3 cursor-pointer ${isCorregida ? 'hover:bg-emerald-100' : 'hover:bg-slate-50'}`}
        onClick={() => setOpen(!open)}
      >
        <div className="flex-none w-16 text-center">
          <div className="text-[10px] text-slate-400 font-bold mb-0.5">S{q.simulacro}</div>
          <div className="text-sm font-black text-slate-800 flex items-center justify-center gap-1">
            P{q.numero}
            {isCorregida && <span className="text-[10px]" title="Corregida / Aprendida">✅</span>}
          </div>
        </div>
        <div className="flex-none w-8 text-center text-lg">{q.acertada ? '✅' : q.fallada ? '❌' : '➖'}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-black uppercase tracking-wider truncate" style={{ color: highlightColor }}>{ASIGNATURA_NOMBRE[q.asignatura] || q.asignatura}</div>
          <div className="text-[11px] font-semibold text-slate-500 mt-0.5 truncate">{q.clasificaciones?.join(' › ') || 'Sin clasificar'}</div>
        </div>
        <div className="text-right flex-none flex flex-col items-end gap-1">
          {pctNum !== null && (
            <div className="text-base font-black leading-none" style={{ color: pctColor(pctNum) }}>{pctNum}%</div>
          )}
          <div className="text-[10px] font-bold text-slate-400">{difLabel}</div>
        </div>
        <div className="text-slate-300 ml-2 text-xs">
          {open ? '▲' : '▼'}
        </div>
      </div>
      
      {open && fullQ.texto && (
        <div className="p-5 bg-slate-50/50 border-t border-slate-100 text-sm animate-fade-in shadow-inner">
          <p className="font-medium text-slate-800 mb-4 whitespace-pre-wrap leading-relaxed">{fullQ.texto.enunciado}</p>

          {/* Porcentaje de acierto de la comunidad */}
          {pctNum !== null && (() => {
            const bgColor = pctNum >= 70
              ? 'bg-red-50 border-red-200 text-red-800'
              : pctNum >= 40
                ? 'bg-orange-50 border-orange-200 text-orange-800'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800';
            const label = pctNum >= 70
              ? '😬 La acertaba casi todo el mundo — revisa bien este concepto'
              : pctNum >= 40
                ? '😐 Dificultad media en el examen'
                : '🧠 Pregunta difícil — no te flagelesmucho si la fallaste';
            return (
              <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border mb-5 ${bgColor}`}>
                <span className="text-2xl font-black">{pctNum}%</span>
                <div>
                  <div className="font-black text-[11px] uppercase tracking-widest opacity-60 mb-0.5">Acierto en el examen real</div>
                  <div className="text-xs font-semibold">{label}</div>
                </div>
              </div>
            );
          })()}

          <div className="flex flex-col gap-2 mb-5">
            {fullQ.texto.respuestas?.map((res) => {
              const isSelected = res.numero === q.respuesta_dada
              const isRight = res.numero === q.respuesta_correcta
              
              let styleCls = "p-3 rounded-lg border bg-white flex gap-3 shadow-sm transition-all"
              if (isRight) styleCls = "p-3 rounded-lg border-emerald-500 bg-emerald-50 text-emerald-900 font-medium flex gap-3 shadow-sm ring-1 ring-emerald-500/20"
              else if (isSelected) styleCls = "p-3 rounded-lg border-red-400 bg-red-50 text-red-900 font-medium flex gap-3 shadow-sm"
              
              return (
                <div key={res.numero} className={styleCls}>
                  <div className="font-black w-4 opacity-50">{res.numero}.</div>
                  <div className="flex-1 leading-relaxed">{res.enunciado}</div>
                  {isRight && <div className="text-emerald-600 font-bold">✅</div>}
                  {isSelected && !isRight && <div className="text-red-500 font-bold">❌</div>}
                </div>
              )
            })}
          </div>
          {fullQ.texto.comentario && (
            <div className="bg-blue-50/30 border border-blue-100 rounded-lg p-5 text-slate-700 text-sm">
              <div className="font-black mb-2 uppercase tracking-widest text-[10px] text-blue-600 flex items-center gap-2">
                <span>💡</span> Comentario Oficial
              </div>
              <div className="whitespace-pre-wrap leading-relaxed">{fullQ.texto.comentario}</div>
            </div>
          )}

          <div className="mt-5 border-t border-slate-200/60 pt-5 flex justify-end">
            <button
              onClick={() => marcarCorregida(q.pregunta_id || q.id, !isCorregida)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
                isCorregida 
                  ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300 hover:bg-emerald-200'
                  : 'bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              {isCorregida ? '✅ Marcar como NO aprendida' : '🎓 Marcar como Corregida / Aprendida'}
            </button>
          </div>
        </div>
      )}
      
      {open && !fullQ.texto && (
        <div className="p-6 text-center text-slate-500 text-sm font-medium bg-slate-50 border-t shadow-inner">
          El texto de esta pregunta no está disponible en la base de datos local.
        </div>
      )}
    </div>
  )
}

function QuestionListDropdown({ title, subtitle, count, icon, color, questions, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (!questions || questions.length === 0) return null

  return (
    <div className="bg-white border rounded-xl mb-3 overflow-hidden shadow-sm transition-shadow hover:shadow-md" style={{ borderColor: `${color}30` }}>
      <div 
        onClick={() => setOpen(!open)}
        className="flex items-center p-4 cursor-pointer transition-colors"
        style={{ backgroundColor: open ? `${color}10` : '#fff' }}
      >
        <div className="text-2xl mr-4">{icon}</div>
        <div className="flex-1">
          <div className="text-base font-black text-slate-800">
            {title} <span className="ml-1" style={{ color }}>({count})</span>
          </div>
          <div className="text-xs font-medium text-slate-500 mt-1">{subtitle}</div>
        </div>
        <div className="text-sm text-slate-400 font-bold transition-transform duration-300" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}>
          ▼
        </div>
      </div>
      
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="bg-slate-50/50 border-t" style={{ borderColor: `${color}20` }}>
            {questions.map(q => <QuestionRow key={`${q.simulacro}-${q.numero}`} q={q} highlightColor={color} />)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Vistas a Pantalla Completa ────────────────────────────────────────────────

function VistaPostMortemFullScreen({ num, onBack }) {
  const pm = useMemo(() => getPostMortemSimulacro(num), [num])
  
  if (!pm) return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <HeaderBar title={`Autopsia Simulacro ${num}`} onBack={onBack} />
      <div className="p-10 text-center text-slate-500 font-bold glass-card">No hay datos suficientes para este simulacro.</div>
    </div>
  )

  const { meta, aciertos, fugas, errores, desplomes, subidones, fatiga, mediaUsuario } = pm
  const pmQuestions = useMemo(() => getPreguntas().filter(p => p.simulacro === num && !p.ignorar), [num])
  const allQuestions = useMemo(() => getPreguntas().filter(p => p.simulacro === num), [num])

  // Lógica del Resumen Ejecutivo
  const diffPercentil = meta.percentil_global - mediaUsuario.percentil
  const diffAciertos = aciertos - mediaUsuario.aciertos

  let diagnostico = ''
  if (diffPercentil < -10) {
    diagnostico = `Tu percentil ha caído drásticamente al ${meta.percentil_global}%. `
    if (diffAciertos > -5) {
      diagnostico += `Sin embargo, has conseguido ${aciertos} aciertos (cerca de tu media de ${mediaUsuario.aciertos}). Esto indica que el examen fue mucho más fácil para el resto de la población.`
    } else {
      diagnostico += `Tus aciertos (${aciertos}) también están muy por debajo de tu media (${mediaUsuario.aciertos}). `
      if (desplomes.length > 0) diagnostico += `Las principales culpables han sido caídas fuertes en ${desplomes.slice(0, 2).map(d => d.nombre).join(' y ')}. `
      if (errores.bloqueos.length > 5) diagnostico += `Además, una mala gestión del tiempo te costó ${errores.bloqueos.length} preguntas bloqueadas.`
    }
  } else if (diffPercentil > 10) {
    diagnostico = `¡Gran simulacro! Tu percentil subió al ${meta.percentil_global}%. `
    if (diffAciertos < 5) diagnostico += `Aunque los aciertos (${aciertos}) son similares a tu media, el examen fue duro y tú supiste mantener el tipo. `
    if (subidones.length > 0) diagnostico += `Has mejorado muchísimo en ${subidones.slice(0, 2).map(d => d.nombre).join(' y ')}. `
  } else {
    diagnostico = `Un simulacro estable. Estás en el percentil ${meta.percentil_global}%, muy cerca de tu media histórica. Aún así, tienes margen de mejora.`
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20">
      <HeaderBar title={`Autopsia Simulacro ${num}`} onBack={onBack} />
      
      <DistribucionCampo meta={pm.meta} richMeta={getSimulacrosRich().find(s => s.numero === num)} />

      {/* Resumen Ejecutivo */}
      <div className="glass-card p-6 mb-8 border-l-4 border-l-accent relative overflow-hidden group">
        <div className="absolute right-0 top-0 bottom-0 w-64 bg-gradient-to-l from-accent/5 to-transparent pointer-events-none"></div>
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-3">Resumen Ejecutivo (Causa Raíz)</h3>
        <p className="text-lg font-medium text-slate-700 leading-relaxed mb-4">{diagnostico}</p>
        
        <div className="flex flex-wrap gap-6 mt-4 pt-4 border-t border-slate-100">
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">Percentil</div>
            <div className="text-2xl font-black" style={{ color: percentilColor(meta.percentil_global) }}>{meta.percentil_global}%</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Últ. {mediaUsuario.basadoEn || 5} sims: {mediaUsuario.percentil}%
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">Aciertos</div>
            <div className="text-2xl font-black text-slate-800">{aciertos}</div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Últ. {mediaUsuario.basadoEn || 5} sims: {mediaUsuario.aciertos}
            </div>
          </div>
          <div>
            <div className="text-xs font-bold text-slate-500 mb-1">Fatiga (1ª vs 2ª mitad)</div>
            <div className={`text-2xl font-black ${fatiga.diferenciaPct < -0.1 ? 'text-red-500' : 'text-emerald-500'}`}>
              {fatiga.diferenciaPct > 0 ? '+' : ''}{Math.round(fatiga.diferenciaPct * 100)}%
            </div>
            <div className="text-[11px] font-semibold text-slate-400 mt-1">
              Acierto: {Math.round(fatiga.mitad1.pct * 100)}% → {Math.round(fatiga.mitad2.pct * 100)}%
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8">
        
        {/* Columna Izquierda: Tipología de Errores y Fugas */}
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-black text-red-600 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="text-lg">🚨</span> Fugas de Puntos Evitables
            </h4>
            <QuestionListDropdown 
              title="Fallos Tontos / Imperdonables" 
              subtitle="Regalaste estos puntos al resto de opositores (preguntas muy fáciles)." 
              count={fugas.length} icon="🤦" color="#dc2626" questions={fugas} defaultOpen={true}
            />
          </div>

          {(errores.dudasFatales.length > 0 || errores.despistes.length > 0 || errores.bloqueos.length > 0) && (
            <div>
              <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2 mt-6">
                <span className="text-lg">🕵️</span> Estilo de Error Específico
              </h4>
              <QuestionListDropdown title="Dudas Fatales" subtitle="Dudaste y marcaste mal." count={errores.dudasFatales.length} icon="⚖️" color="#d97706" questions={errores.dudasFatales} />
              <QuestionListDropdown title="Despistes Rápidos" subtitle="Fáciles (<30seg)." count={errores.despistes.length} icon="💨" color="#eab308" questions={errores.despistes} />
              <QuestionListDropdown title="Bloqueos de Tiempo" subtitle="Fallas tras >2 min." count={errores.bloqueos.length} icon="⏱️" color="#991b1b" questions={errores.bloqueos} />
            </div>
          )}
        </div>

        {/* Columna Derecha: Gráficos y Desplomes */}
        <div className="space-y-6">
          <div className="glass-card p-5">
            <h3 className="text-sm font-black text-slate-900 mb-2">Cazador de Patrones (Tiempo vs Dificultad)</h3>
            <p className="text-xs font-medium text-slate-500 mb-4">
              Pasa el ratón para ver bloqueos de tiempo (arriba derecha).
            </p>
            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100">
              <ScatterPlotSVG questions={pmQuestions} />
            </div>
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
              <span className="text-lg">📉</span> Desplomes
            </h4>
            {desplomes.length === 0 && <div className="text-sm text-slate-400 italic glass-card p-4 text-center">Ningún desplome en este examen. ¡Buen trabajo!</div>}
            {desplomes.map(d => (
              <QuestionListDropdown 
                key={d.codigo} title={`Caída en ${d.nombre}`} 
                subtitle={`Media histórica: ${Math.round(d.historico_pct * 100)}% → En este examen: ${Math.round(d.actual_pct * 100)}%`} 
                count={d.preguntas_falladas.length} icon="⚠️" color="#f97316" questions={d.preguntas_falladas}
              />
            ))}
          </div>
        </div>
      </div>

      {/* TODAS LAS PREGUNTAS DEL SIMULACRO */}
      <div className="mt-8">
        <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4 flex items-center gap-2">
          <span className="text-lg">📚</span> Todas las preguntas del simulacro
        </h4>
        <QuestionListDropdown 
          title="Ver todas las preguntas" 
          subtitle="Repaso ordenado del simulacro completo." 
          count={allQuestions.length} 
          icon="📋" 
          color="#3b82f6" 
          questions={[...allQuestions].sort((a, b) => a.numero - b.numero)} 
        />
      </div>
    </div>
  )
}


function VistaDetalleAsignaturaFullScreen({ data, onBack }) {
  const preguntasRevisar = useMemo(() => getPreguntasARevisarAsignatura(data.codigo), [data.codigo])
  
  // Ordenar subtemas de menor a mayor acierto para encontrar los más flojos
  const temasFlojos = [...data.subtemasArray]
    .filter(t => t.total >= 5) // Que tengan volumen representativo
    .sort((a, b) => a.pctAcierto - b.pctAcierto)
    .slice(0, 5)

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20">
      <HeaderBar title={`Análisis: ${data.nombre}`} onBack={onBack} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Evolución de Aciertos */}
        {data.simulacrosArray && data.simulacrosArray.length > 1 && (
          <div className="glass-card p-6 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="text-base font-black text-slate-900">Evolución de Aciertos</div>
              <div className="flex gap-4">
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full shadow-sm" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Aciertos</span></div>
                <div className="flex items-center gap-2"><div className="w-2 h-2 bg-slate-400 rounded-full shadow-sm" /><span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Dificultad</span></div>
              </div>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <SubjectAciertosLineChart data={data.simulacrosArray} />
            </div>
          </div>
        )}

        {/* Alertas: Temas más flojos (Reemplaza al Radar) */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xl">🚨</span>
            <div className="text-base font-black text-slate-900">Alertas: Temas más flojos</div>
          </div>
          
          {temasFlojos.length === 0 ? (
            <div className="text-center text-slate-400 font-bold py-10">No hay suficientes datos por tema o no hay puntos débiles graves.</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-[1fr_60px_60px] gap-3 text-[10px] font-black text-slate-400 border-b border-slate-100 pb-2 tracking-wider">
                <div>SUBTEMA</div>
                <div className="text-right">ACIERTO</div>
                <div className="text-right">FALLOS</div>
              </div>
              {temasFlojos.map(sub => {
                const acierto = Math.round(sub.pctAcierto * 100)
                return (
                  <div key={sub.nombre} className="grid grid-cols-[1fr_60px_60px] gap-3 items-center py-2 border-b border-slate-50 last:border-0 hover:bg-slate-50 rounded-lg transition-colors px-2 -mx-2">
                    <div className="text-sm text-slate-700 font-bold truncate">{sub.nombre}</div>
                    <div className="text-right font-black" style={{ color: pctColor(acierto) }}>{acierto}%</div>
                    <div className={`text-right font-bold ${sub.falladas > 3 ? 'text-red-500' : 'text-slate-500'}`}>{sub.falladas}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Preguntas a Revisar */}
      <div>
        <h3 className="text-lg font-black text-slate-900 mb-4 px-2">Listado de preguntas a revisar</h3>
        <div className="glass-card overflow-hidden">
          {preguntasRevisar.length === 0 ? (
            <div className="p-10 text-center text-slate-400 font-bold">No hay preguntas de esta asignatura en los simulacros registrados.</div>
          ) : (
            <div className="flex flex-col">
              <div className="bg-slate-50/80 border-b border-slate-100 p-4">
                <div className="text-xs font-bold text-slate-500">Ordenadas de simulacros más recientes a más antiguos.</div>
              </div>
              <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
                {preguntasRevisar.map(q => (
                  <QuestionRow key={`${q.simulacro}-${q.numero}`} q={q} highlightColor="#334155" />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}

// ─── Componentes del Dashboard ───────────────────────────────────────────────

function EvolucionStrip({ statsSim, richSims, numActual, onSelect, selectedNum }) {
  const items = simulacrosOrdenCronologico.map(num => {
    const stats = statsSim.find(s => s.simulacro === num) || {}
    const meta  = simulacrosMeta.find(m => m.numero === num) || {}
    const rich  = richSims?.find(r => r.numero === num) || null
    return { num, stats, meta, rich }
  })

  function getPercentil(meta, rich) {
    if (rich?.stats?.percentil_total != null) return Math.round(rich.stats.percentil_total * 100)
    return meta.percentil_global ?? null
  }

  return (
    <div className="glass-card p-4 mb-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent/20 to-transparent"></div>
      <div className="text-[10px] text-slate-400 mb-3 font-bold tracking-wider uppercase">Analizar Simulacro a fondo</div>
      <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
        {items.map(({ num, stats, meta, rich }) => {
          const isMostRecent = num === numActual
          const percentil = getPercentil(meta, rich)
          
          return (
            <div 
              key={num} 
              onClick={() => onSelect(num)}
              className={`flex-none min-w-[80px] flex flex-col items-center py-3 px-2 cursor-pointer rounded-2xl transition-all duration-300 relative bg-white/40 border border-slate-200 hover:bg-white hover:shadow-lg hover:-translate-y-1 hover:border-accent/40`}
            >
              {isMostRecent && <div className="absolute -top-2 text-[8px] font-black text-accent bg-accent-bg px-2 py-0.5 rounded-full border border-accent/20 shadow-sm">ACTUAL</div>}
              <div className="text-xs font-black mb-1.5 text-slate-600">S{num}</div>
              <div className="text-xl font-black leading-none tracking-tight" style={{ color: stats.pctAcierto ? pctColor(stats.pctAcierto) : '#cbd5e1' }}>
                {stats.pctAcierto ?? '—'}%
              </div>
              <div className="text-xs font-bold leading-none mt-2" style={{ color: percentil ? percentilColor(percentil) : '#cbd5e1' }}>
                p{percentil ?? '—'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function normalPdf(x, mean, stdDev) {
  return Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
}

const CustomRechartsTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700">
        <p className="font-bold mb-1">Netas: {label}</p>
        <p className="text-slate-400">Densidad (relativa)</p>
      </div>
    );
  }
  return null;
};

function GaussianRecharts({ p10, p25, p50, p75, p90, neta, percentil_global }) {
  const numPoints = 100;
  const data = [];
  
  for (let i = 0; i <= numPoints; i++) {
    const x = i;
    // Campana genérica centrada en p50, distribuida sobre los percentiles (0 a 100)
    const y = Math.exp(-0.5 * Math.pow((x - 50) / 20, 2));
    data.push({ x, y });
  }

  const CustomRechartsTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      let estNeta = 0;
      if (label <= 10) estNeta = p10 - ((10 - label) * (p25 - p10) / 15);
      else if (label <= 25) estNeta = p10 + ((label - 10) * (p25 - p10) / 15);
      else if (label <= 50) estNeta = p25 + ((label - 25) * (p50 - p25) / 25);
      else if (label <= 75) estNeta = p50 + ((label - 50) * (p75 - p50) / 25);
      else if (label <= 90) estNeta = p75 + ((label - 75) * (p90 - p75) / 15);
      else estNeta = p90 + ((label - 90) * (p90 - p75) / 15);
      
      estNeta = Math.round(estNeta * 100) / 100;
      const isUser = Math.abs(label - percentil_global) <= 1;

      return (
        <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-700">
          <p className="font-bold mb-1">Percentil: {label} {isUser && <span className="text-accent ml-1">(TÚ)</span>}</p>
          <p className="text-slate-400">Netas de corte: {estNeta}</p>
          {isUser && <p className="text-accent font-bold mt-1">Tus netas reales: {neta}</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ width: '100%', height: 280 }} className="mt-4">
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 30, right: 30, left: 20, bottom: 30 }}
        >
          <defs>
            <linearGradient id="colorBellRecharts" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#fee2e2" stopOpacity={0.8}/>
              <stop offset="25%" stopColor="#fee2e2" stopOpacity={0.8}/>
              
              <stop offset="25%" stopColor="#ffedd5" stopOpacity={0.8}/>
              <stop offset="50%" stopColor="#ffedd5" stopOpacity={0.8}/>
              
              <stop offset="50%" stopColor="#fef3c7" stopOpacity={0.8}/>
              <stop offset="75%" stopColor="#fef3c7" stopOpacity={0.8}/>
              
              <stop offset="75%" stopColor="#d1fae5" stopOpacity={0.8}/>
              <stop offset="100%" stopColor="#d1fae5" stopOpacity={0.8}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="x" 
            type="number" 
            domain={[0, 100]} 
            ticks={[10, 25, 50, 75, 90]}
            tickFormatter={(val) => {
              if (val === 10) return `p10`;
              if (val === 25) return `p25`;
              if (val === 50) return `Mediana`;
              if (val === 75) return `p75`;
              if (val === 90) return `p90`;
              return val;
            }}
            tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis hide domain={[0, 'dataMax']} />
          <RechartsTooltip content={<CustomRechartsTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '4 4' }} />
          
          <ReferenceLine x={10} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'bottom', value: p10, fill: '#64748b', fontSize: 10, dy: 5 }} />
          <ReferenceLine x={25} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'bottom', value: p25, fill: '#64748b', fontSize: 10, dy: 5 }} />
          <ReferenceLine x={50} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'bottom', value: p50, fill: '#64748b', fontSize: 10, dy: 5 }} />
          <ReferenceLine x={75} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'bottom', value: p75, fill: '#64748b', fontSize: 10, dy: 5 }} />
          <ReferenceLine x={90} stroke="#cbd5e1" strokeDasharray="3 3" label={{ position: 'bottom', value: p90, fill: '#64748b', fontSize: 10, dy: 5 }} />

          <Area 
            type="monotone" 
            dataKey="y" 
            stroke="#94a3b8" 
            strokeWidth={2}
            fill="url(#colorBellRecharts)"
            activeDot={{ r: 6, fill: '#0f172a', stroke: '#fff', strokeWidth: 2 }}
          />
          <ReferenceLine 
            x={percentil_global} 
            stroke="#0f172a" 
            strokeWidth={2}
            label={{ position: 'top', value: `TÚ (${neta})`, fill: '#0f172a', fontSize: 14, fontWeight: 900, dy: -5 }} 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DistribucionCampo({ meta, richMeta }) {
  if (!meta || !meta.campo) return null
  const campoBase = meta.campo
  const percV2    = richMeta?.percentiles_campo || null
  const { p25, p50, p75 } = campoBase
  
  const p10 = campoBase.p10 ?? (percV2?.p5 ?? null)
  const p90 = campoBase.p90 ?? (percV2?.p95 ?? null)

  const { neta, percentil_global } = meta

  return (
    <div className="glass-card p-6 mb-6 group hover:shadow-md transition-shadow relative z-0">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-base font-black text-slate-900">Distribución del Examen</div>
          <div className="text-xs font-medium text-slate-500 mt-1">Campana de Gauss proporcional a la población.</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tracking-tight leading-none" style={{ color: percentilColor(percentil_global) }}>
            p{percentil_global}
          </div>
          <div className="text-[11px] font-bold text-slate-400 mt-2">{neta} netas reales</div>
        </div>
      </div>
      <GaussianRecharts p10={p10} p25={p25} p50={p50} p75={p75} p90={p90} neta={neta} percentil_global={percentil_global} />
    </div>
  )
}

function VistaHistorica() {
  const diffData = useMemo(() => getAnalisisDificultad(), [])

  return (
    <div className="glass-card p-6 mb-4 group hover:shadow-md transition-shadow">
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <h3 className="text-base font-black text-slate-900 m-0">Evolución Global</h3>
        <div className="flex gap-4 ml-auto">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Real</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Ajustada</span></div>
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-400" /> <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Dif</span></div>
        </div>
      </div>
      <div className="text-xs font-medium text-slate-500 mb-6">
        Si un examen es más difícil de lo normal (D &gt; 3.0), tu nota ajustada subirá. Si es más fácil, bajará.
      </div>
      
      <div className="w-full pt-2">
        <DualSVGLineChart data={diffData} />
      </div>
    </div>
  )
}

function AsignaturaRow({ data, onClick }) {
  const col = getEspecialidadColor(data.nombre)
  const aciertoReciente = Math.round(data.reciente.pctAcierto * 100)
  const evolSparkData = data.simulacrosArray.map(s => s.total > 0 ? (s.acertadas / s.total) * 100 : 0)
  
  let semColor = '#10b981' // green
  if (data.scorePrioridad > 150) semColor = '#ef4444' // red
  else if (data.scorePrioridad > 80) semColor = '#f97316' // orange
  else if (data.scorePrioridad > 30) semColor = '#f59e0b' // amber

  return (
    <div 
      onClick={onClick}
      className="flex items-center py-4 px-5 border-b border-slate-100 bg-white cursor-pointer transition-all hover:bg-slate-50 hover:pl-6 group"
      style={{ borderLeft: `4px solid ${semColor}` }}
    >
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: semColor }} />
          <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full truncate" style={{ color: col.text, background: col.bg, border: `1px solid ${col.border || col.bg}` }}>
            {data.nombre}
          </span>
        </div>
      </div>
      
      <div className="w-14 text-right">
        <div className="text-base font-black" style={{ color: pctColor(aciertoReciente) }}>{aciertoReciente}%</div>
      </div>

      <div className="w-[80px] flex justify-end pl-4 opacity-70 group-hover:opacity-100 transition-opacity">
        <SparklineSVG data={evolSparkData} width={60} height={24} />
      </div>
      
      <div className="w-12 text-right">
        <div className="text-sm font-black" style={{ color: semColor }}>{Math.round(data.scorePrioridad)}</div>
      </div>
    </div>
  )
}

function TablaAnalisisIntegral({ onSelectAsignatura }) {
  const analisis = useMemo(() => getAnalisisGlobalPorAsignatura(), [])
  const datosFiltrados = analisis.filter(a => a.global.total > 10)

  return (
    <div className="glass-card overflow-hidden h-full flex flex-col shadow-md">
      <div className="p-5 bg-slate-50/80 border-b border-slate-200">
        <h3 className="m-0 text-base font-black text-slate-900 tracking-tight">Matriz de Prioridades</h3>
        <div className="text-xs font-bold text-slate-500 mt-1">
          Clic en una asignatura para profundizar
        </div>
      </div>
      
      <div className="flex flex-col flex-1 overflow-y-auto custom-scrollbar">
        {datosFiltrados.map((item) => (
          <AsignaturaRow 
            key={item.codigo} 
            data={item} 
            onClick={() => onSelectAsignatura(item)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Vista: Mis Temas Débiles ────────────────────────────────────────────────

function TendenciaIcon({ tendencia }) {
  if (tendencia > 0.08) return <span className="text-emerald-500 font-black text-sm">↑</span>
  if (tendencia < -0.08) return <span className="text-red-500 font-black text-sm">↘</span>
  return <span className="text-slate-400 font-black text-sm">→</span>
}

function BarraAcierto({ pct, height = 6 }) {
  const color = pct >= 0.65 ? '#10b981' : pct >= 0.45 ? '#f59e0b' : '#ef4444'
  return (
    <div className="w-full bg-slate-100 rounded-full overflow-hidden" style={{ height }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.round(pct * 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function MiniSparklineTema({ data }) {
  if (!data || data.length < 2) return null
  const W = 60, H = 20
  const vals = data.map(d => d.pct)
  const min = Math.min(...vals)
  const max = Math.max(...vals) || 1
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * W
    const y = H - ((v - min) / (max - min || 1)) * H
    return `${x},${y}`
  }).join(' ')
  const color = vals[vals.length - 1] > vals[0] ? '#10b981' : '#ef4444'
  return (
    <svg width={W} height={H} className="overflow-visible flex-none">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {vals.map((v, i) => (
        <circle key={i}
          cx={(i / (vals.length - 1)) * W}
          cy={H - ((v - min) / (max - min || 1)) * H}
          r="2" fill={color}
        />
      ))}
    </svg>
  )
}

function TemaRow({ tema, onVerPreguntas, onPracticar }) {
  const [open, setOpen] = useState(false)
  const col = getEspecialidadColor(tema.asignaturaNombre)
  const pctNum = Math.round(tema.pctAcierto * 100)

  return (
    <div className="border-b border-slate-100 last:border-0 bg-white transition-colors">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer" onClick={() => setOpen(!open)}>
        {/* Asignatura badge */}
        <div className="flex-none">
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ color: col.text, background: col.bg }}>{
            tema.asignaturaNombre.length > 10 ? tema.asignaturaNombre.split(' ')[0] : tema.asignaturaNombre
          }</span>
        </div>

        {/* Nombre del tema */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-slate-800 truncate">{tema.tema}</div>
          <div className="mt-1"><BarraAcierto pct={tema.pctAcierto} /></div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 flex-none">
          <MiniSparklineTema data={tema.evolucionPorSim} />
          <TendenciaIcon tendencia={tema.tendencia} />
          <div className="text-right w-12">
            <div className="text-base font-black" style={{ color: pctColor(pctNum) }}>{pctNum}%</div>
            <div className="text-[10px] text-slate-400 font-semibold">❌ ×{tema.falladas}</div>
          </div>
        </div>

        <div className="text-slate-300 text-xs ml-1">{open ? '▲' : '▼'}</div>
      </div>

      {/* Expansión con botones de acción */}
      {open && (
        <div className="px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 animate-fade-in">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => onPracticar(tema.asignaturaCode, tema.asignaturaNombre)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white hover:bg-slate-800 transition-all hover:scale-105 shadow-sm"
            >
              ▶ Practicar ahora
            </button>
            <button
              onClick={() => onVerPreguntas(tema)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white text-slate-600 border-2 border-slate-200 hover:border-slate-400 transition-all"
            >
              📋 Ver {tema.falladas} preguntas
            </button>
          </div>
          {/* Lista expandida de preguntas falladas */}
          <div className="flex flex-col divide-y divide-slate-100 rounded-xl overflow-hidden border border-slate-100">
            {tema.preguntasFalladas.slice(0, 5).map(q => (
              <QuestionRow key={`${q.simulacro}-${q.numero}`} q={q} highlightColor="#ef4444" />
            ))}
            {tema.preguntasFalladas.length > 5 && (
              <div className="p-3 text-center text-xs text-slate-400 font-semibold">
                +{tema.preguntasFalladas.length - 5} preguntas más — usa "Ver preguntas" para verlas todas
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SeccionTemas({ titulo, emoji, color, temas, onVerPreguntas, onPracticar, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  if (temas.length === 0) return null
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-black text-sm transition-all"
        style={{ background: `${color}15`, color }}
      >
        <span className="text-base">{emoji}</span>
        <span>{titulo}</span>
        <span className="ml-auto font-bold text-xs opacity-70">{temas.length} temas</span>
        <span className="text-xs opacity-50">{open ? '▲' : '▼'}</span>
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="mt-2 bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: `${color}30` }}>
            {temas.map((t, i) => (
              <TemaRow key={`${t.asignaturaCode}-${t.tema}`} tema={t} onVerPreguntas={onVerPreguntas} onPracticar={onPracticar} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function VistaMisTemasDebiles({ onBack, onPracticar }) {
  const [filtroAsig, setFiltroAsig] = useState('')
  const [vistaDetalle, setVistaDetalle] = useState(null) // tema seleccionado para ver preguntas

  const todosLosTemas = useMemo(() => getAnalisisPorTema(filtroAsig || null), [filtroAsig])
  const puntosRegalados = useMemo(() => getPuntosRegalados(), [])
  const trampas = useMemo(() => getTrampasConceptuales(0.40), [])

  const asignaturas = useMemo(() => {
    const codes = [...new Set(getPreguntas().filter(p => !p.ignorar).map(p => p.asignatura))].sort()
    return codes.map(c => ({ code: c, nombre: ASIGNATURA_NOMBRE[c] || c }))
  }, [])

  const criticos = todosLosTemas.filter(t => t.scoreUrgencia > 5)
  const vigilar  = todosLosTemas.filter(t => t.scoreUrgencia > 1.5 && t.scoreUrgencia <= 5)
  const ok       = todosLosTemas.filter(t => t.scoreUrgencia <= 1.5)

  if (vistaDetalle) {
    return (
      <div className="animate-fade-in max-w-5xl mx-auto pb-20">
        <HeaderBar title={`Preguntas: ${vistaDetalle.tema}`} onBack={() => setVistaDetalle(null)} />
        <div className="glass-card overflow-hidden">
          {vistaDetalle.preguntasFalladas.map(q => (
            <QuestionRow key={`${q.simulacro}-${q.numero}`} q={q} highlightColor="#ef4444" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-5xl mx-auto pb-20">
      <HeaderBar title="Mis Puntos Débiles" onBack={onBack} />

      {/* Filtro por asignatura */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={filtroAsig}
          onChange={e => setFiltroAsig(e.target.value)}
          className="px-4 py-2 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:border-accent transition-colors"
        >
          <option value="">Todas las asignaturas</option>
          {asignaturas.map(a => <option key={a.code} value={a.code}>{a.nombre}</option>)}
        </select>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          {todosLosTemas.length} temas analizados
        </div>
      </div>

      {/* ── Sección 1: Análisis por Tema ── */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">📚</span>
          <div>
            <h3 className="text-base font-black text-slate-900 m-0">Análisis por Tema</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Temas ordenados por urgencia. El score combina fallos, dificultad y peso en el examen.</p>
          </div>
        </div>
        <SeccionTemas
          titulo="Críticos — actuar esta semana"
          emoji="🔴"
          color="#ef4444"
          temas={criticos}
          onVerPreguntas={setVistaDetalle}
          onPracticar={onPracticar}
          defaultOpen={true}
        />
        <SeccionTemas
          titulo="A vigilar — repasar próximamente"
          emoji="🟡"
          color="#f59e0b"
          temas={vigilar}
          onVerPreguntas={setVistaDetalle}
          onPracticar={onPracticar}
        />
        <SeccionTemas
          titulo="Controlados"
          emoji="🟢"
          color="#10b981"
          temas={ok}
          onVerPreguntas={setVistaDetalle}
          onPracticar={onPracticar}
        />
        {todosLosTemas.length === 0 && (
          <div className="py-10 text-center text-slate-400 font-bold">No hay datos suficientes para esta asignatura.</div>
        )}
      </div>

      {/* ── Sección 2: Puntos Regalados ── */}
      <div className="glass-card p-5 mb-6">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🎁</span>
          <div>
            <h3 className="text-base font-black text-slate-900 m-0">Puntos Regalados ({puntosRegalados.length})</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Preguntas fáciles que fallaste — más del 55% del campo las acertó o eran de dificultad baja. Son los más urgentes de repasar.
            </p>
          </div>
        </div>
        {puntosRegalados.length === 0 ? (
          <div className="py-8 text-center text-slate-400 font-bold">¡Sin puntos regalados! Muy bien.</div>
        ) : (
          <QuestionListDropdown
            title="Ver preguntas regaladas"
            subtitle={`${puntosRegalados.length} preguntas fáciles que fallaste en los simulacros`}
            count={puntosRegalados.length}
            icon="🎁"
            color="#dc2626"
            questions={puntosRegalados}
            defaultOpen={true}
          />
        )}
      </div>

      {/* ── Sección 3: Trampas Conceptuales ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🪤</span>
          <div>
            <h3 className="text-base font-black text-slate-900 m-0">Trampas Conceptuales ({trampas.length})</h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Fallaste estas preguntas eligiendo la misma respuesta incorrecta que el 40% o más del campo también eligió. Son distractores especialmente peligrosos que los examinadores usan deliberadamente.
            </p>
          </div>
        </div>
        {trampas.length === 0 ? (
          <div className="py-8 text-center text-slate-400 font-bold">No hay trampas detectadas con los datos actuales.</div>
        ) : (
          <div className="space-y-2">
            {trampas.slice(0, 20).map(q => (
              <div key={`${q.simulacro}-${q.numero}`} className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
                <QuestionRow q={q} highlightColor="#d97706" />
                <div className="px-4 pb-3 pt-0">
                  <div className="flex items-center gap-2 mt-1">
                    <div className="text-[11px] font-black text-amber-700 uppercase tracking-wider">🪤 Trampa:</div>
                    <div className="text-xs text-amber-600 font-semibold">
                      El {Math.round(q.pct_misma_respuesta_ratio * 100)}% del campo eligió la misma respuesta incorrecta que tú
                      {q.pct_field_correct != null && ` · Solo el ${Math.round(q.pct_field_correct * 100)}% acertó`}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {trampas.length > 20 && (
              <div className="text-center text-xs text-slate-400 font-bold py-2">+{trampas.length - 20} trampas más</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function Simulacros({ setTab, setBancoFiltros }) {
  const [selectedAsignatura, setSelectedAsignatura] = useState(null)
  const [selectedSimulacroNum, setSelectedSimulacroNum] = useState(null)
  const [verTemasDebiles, setVerTemasDebiles] = useState(false)

  const statsSim    = useMemo(() => getStatsPorSimulacro(), [])
  const statsGlobal = useMemo(() => getStatsGlobales(), [])
  const richSims    = useMemo(() => getSimulacrosRich(), [])

  const numActual   = simulacrosOrdenCronologico[simulacrosOrdenCronologico.length - 1]
  const metaActual  = simulacrosMeta.find(m => m.numero === numActual)
  const richActual  = richSims?.find(r => r.numero === numActual) || null

  const resetView = () => {
    setSelectedAsignatura(null)
    setSelectedSimulacroNum(null)
    setVerTemasDebiles(false)
  }

  // Navega al Banco de Preguntas pre-filtrado por asignatura + solo falladas
  const handlePracticar = (asignaturaCode, asignaturaNombre) => {
    if (setBancoFiltros) {
      setBancoFiltros({ asignatura: asignaturaNombre, soloFalladas: true, autoStart: true })
    }
    if (setTab) setTab('quiz')
  }

  // --- Enrutador Interno ---
  if (selectedSimulacroNum) {
    return (
      <div className="p-4 md:p-8 pt-6">
        <VistaPostMortemFullScreen num={selectedSimulacroNum} onBack={resetView} />
      </div>
    )
  }

  if (selectedAsignatura) {
    return (
      <div className="p-4 md:p-8 pt-6">
        <VistaDetalleAsignaturaFullScreen data={selectedAsignatura} onBack={resetView} />
      </div>
    )
  }

  if (verTemasDebiles) {
    return (
      <div className="p-4 md:p-8 pt-6">
        <VistaMisTemasDebiles onBack={resetView} onPracticar={handlePracticar} />
      </div>
    )
  }

  // --- Command Center ---
  return (
    <div className="p-4 md:p-8 pt-6 pb-20 animate-fade-in max-w-[1600px] mx-auto h-[calc(100vh-60px)]">
      <h2 className="mb-8 text-4xl font-black text-slate-900 tracking-tight">Command Center</h2>

      <div className="grid grid-cols-1 xl:grid-cols-[400px_1fr] gap-8 items-start h-full pb-10">
        
        {/* Columna Izquierda: Matriz de Prioridades (Full Height) */}
        <div className="h-full overflow-hidden flex flex-col xl:sticky xl:top-6" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <TablaAnalisisIntegral onSelectAsignatura={setSelectedAsignatura} />
        </div>

        {/* Columna Derecha: KPI y Explorador Libre */}
        <div className="min-w-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar h-full pr-4 pb-10" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-none lg:w-56 glass-card p-6 flex flex-col justify-center relative overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="absolute -right-4 -bottom-4 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
              <div className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 z-10">Acierto Global</div>
              <div className="text-[48px] font-black tracking-tight leading-none z-10" style={{ color: pctColor(statsGlobal.pctAcierto) }}>
                {statsGlobal.pctAcierto}%
              </div>
              <div className="text-[11px] font-bold text-slate-400 mt-4 z-10">
                {statsGlobal.acertadas} / {statsGlobal.preguntas} preguntas
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <EvolucionStrip 
                statsSim={statsSim} richSims={richSims} numActual={numActual} 
                onSelect={setSelectedSimulacroNum}
              />
            </div>
          </div>

          {/* Card: Mis Puntos Débiles */}
          <div
            onClick={() => setVerTemasDebiles(true)}
            className="glass-card p-5 cursor-pointer hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 via-amber-500/5 to-transparent pointer-events-none" />
            <div className="flex items-center gap-4">
              <div className="text-3xl">🎯</div>
              <div className="flex-1">
                <div className="text-base font-black text-slate-900 group-hover:text-red-600 transition-colors">
                  Mis Puntos Débiles
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">
                  Análisis por tema · Puntos regalados · Trampas conceptuales
                </div>
              </div>
              <div className="text-slate-300 group-hover:text-slate-500 font-bold text-lg transition-colors">→</div>
            </div>
          </div>

          <DistribucionCampo meta={metaActual} richMeta={richActual} />
          
          <VistaHistorica />

        </div>
      </div>
    </div>
  )
}
