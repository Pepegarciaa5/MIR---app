import { useTracker } from '../context/TrackerContext'
import { getEspecialidadColor } from '../data/especialidadesMIR'
import EntradaEditable from './EntradaEditable'

const ACCENT = '#F26522'
const OBJETIVO_DIARIO_H = 7

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmtHoras(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  if (m > 0) return `${m}m`
  return `${secs}s`
}

export default function ProgresoDiario({ compact = false }) {
  const { entries, activeEntry, elapsed } = useTracker()
  const hoy = todayStr()

  const todayEntries = entries.filter(e => e.fecha === hoy)

  // Include active entry if it's from today
  const allToday = activeEntry && activeEntry.fecha === hoy
    ? [{ ...activeEntry, duracionSegundos: elapsed, isActivo: true }, ...todayEntries]
    : todayEntries

  const totalSecs = allToday.reduce((s, e) => s + (e.duracionSegundos || 0), 0)
  const totalHoras = totalSecs / 3600
  const pctObjetivo = Math.min((totalHoras / OBJETIVO_DIARIO_H) * 100, 100)

  // Breakdown por especialidad
  const byEsp = {}
  allToday.forEach(e => {
    const key = e.especialidad || '_sin'
    byEsp[key] = (byEsp[key] || 0) + (e.duracionSegundos || 0)
  })
  const espEntries = Object.entries(byEsp)
    .filter(([k]) => k !== '_pausa')
    .sort((a, b) => b[1] - a[1])
  const maxEspSecs = espEntries.length > 0 ? espEntries[0][1] : 1

  const fechaLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const fechaCap = fechaLabel.charAt(0).toUpperCase() + fechaLabel.slice(1)

  if (compact) {
    // Versión compacta para Inicio: solo resumen + barras de especialidad
    return (
      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 16, padding: '14px 16px', boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
        {/* Cabecera */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Progreso de hoy</div>
          <div style={{ fontSize: 20, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px' }}>
            {fmtHoras(totalSecs)}
            <span style={{ fontSize: 11, fontWeight: 500, color: '#bbb', marginLeft: 4 }}>/ {OBJETIVO_DIARIO_H}h</span>
          </div>
        </div>

        {/* Barra total */}
        <div style={{ background: '#f0f0f0', borderRadius: 6, height: 8, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{
            width: `${pctObjetivo}%`,
            background: pctObjetivo >= 100 ? '#22c55e' : ACCENT,
            height: '100%', borderRadius: 6,
            transition: 'width 0.5s',
          }} />
        </div>

        {/* Barras por asignatura */}
        {espEntries.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12, color: '#bbb', textAlign: 'center', padding: '8px 0' }}>
            Aún no has trackeado nada hoy.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {espEntries.slice(0, 5).map(([esp, secs]) => {
              const c = getEspecialidadColor(esp === '_sin' ? null : esp)
              const pct = Math.round((secs / maxEspSecs) * 100)
              const label = esp === '_sin' ? 'Sin asignatura' : esp === '_libre' ? 'Libre' : esp
              return (
                <div key={esp}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: c.text,
                      background: c.bg, border: `1px solid ${c.border}`,
                      padding: '1px 7px', borderRadius: 10 }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{fmtHoras(secs)}</span>
                  </div>
                  <div style={{ background: '#f0f0f0', borderRadius: 4, height: 5, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, background: c.text, height: '100%', borderRadius: 4, transition: 'width 0.4s', opacity: 0.8 }} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Versión completa para Progreso
  return (
    <div style={{ background: '#fafafa', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>Progreso de hoy</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 1 }}>{fechaCap}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: ACCENT, letterSpacing: '-0.5px', lineHeight: 1 }}>
            {fmtHoras(totalSecs)}
          </div>
          <div style={{ fontSize: 11, color: '#bbb' }}>de {OBJETIVO_DIARIO_H}h objetivo · {Math.round(pctObjetivo)}%</div>
        </div>
      </div>

      {/* Barra total */}
      <div style={{ background: '#e8e8e8', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 14 }}>
        <div style={{
          width: `${pctObjetivo}%`,
          background: pctObjetivo >= 100 ? '#22c55e' : ACCENT,
          height: '100%', borderRadius: 6,
          transition: 'width 0.5s',
          boxShadow: `0 0 8px ${ACCENT}55`,
        }} />
      </div>

      {/* Barras por especialidad */}
      {espEntries.length === 0 ? (
        <p style={{ margin: '0 0 12px', fontSize: 13, color: '#bbb', textAlign: 'center', padding: '12px 0' }}>
          Aún no has trackeado nada hoy.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 16 }}>
          {espEntries.map(([esp, secs]) => {
            const c = getEspecialidadColor(esp === '_sin' ? null : esp)
            const pct = Math.round((secs / maxEspSecs) * 100)
            const label = esp === '_sin' ? 'Sin asignatura' : esp === '_libre' ? 'Libre' : esp
            return (
              <div key={esp}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.text,
                    background: c.bg, border: `1px solid ${c.border}`,
                    padding: '2px 9px', borderRadius: 12 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>{fmtHoras(secs)}</span>
                </div>
                <div style={{ background: '#e8e8e8', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, background: c.text, height: '100%', borderRadius: 4, transition: 'width 0.4s', opacity: 0.85 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Lista de entradas del día */}
      {todayEntries.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', marginBottom: 6, paddingTop: 8, borderTop: '1px solid #e8e8e8' }}>
            Actividades de hoy
          </div>
          <div>
            {todayEntries.map(e => (
              <EntradaEditable key={e.id} entry={e} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
