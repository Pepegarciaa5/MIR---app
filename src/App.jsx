/**
 * Archivo: App.jsx
 * Descripción: Componente raíz de la aplicación. Gestiona el enrutamiento principal, la migración de datos legacy y la inicialización del estado.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-17
 */

import { useState, useEffect, lazy, Suspense } from 'react'
import { TrackerProvider } from './context/TrackerContext'
import Navbar from './components/Navbar'
import Inicio from './screens/Inicio'
import Calendario from './screens/Calendario'
import Repasos from './screens/Repasos'
import Progreso from './screens/Progreso'
import Diario from './screens/Diario'
import ColaEstudio from './screens/ColaEstudio'
import Simulacros from './screens/Simulacros'
import PublicView from './screens/PublicView'
import OfreceEstudio from './screens/OfreceEstudio'
import BancoPreguntas from './screens/BancoPreguntas'
import EstudioAdaptativo from './screens/EstudioAdaptativo'
import Desgloses from './screens/Desgloses'
import TiradorMaestro from './screens/TiradorMaestro'
import Smartcards from './screens/Smartcards'
import CorreccionSimulacro from './screens/CorreccionSimulacro'
import PrioridadesTemas from './screens/PrioridadesTemas'
import EvaluacionP80 from './screens/EvaluacionP80'
import ErrorBoundary from './components/common/ErrorBoundary'
import { loadAppData, migrarDesdeLocalStorage } from './data/mockData'
import { isAdminMode } from './lib/supabase'

// Carga perezosa del buscador para no ralentizar el arranque ni saturar la memoria
const BuscadorPreguntas = lazy(() => import('./screens/BuscadorPreguntas'))

export default function App() {
  const [tab, setTab] = useState(isAdminMode ? 'inicio' : 'diario')
  const [dataReady, setDataReady] = useState(false)
  const [bancoFiltros, setBancoFiltros] = useState(null) // { asignatura, soloFalladas, autoStart }

  useEffect(() => {
    async function init() {
      try {
        // One-time migration: if localStorage has data and Supabase is empty, migrate it
        const hasMigracion = localStorage.getItem('supabase_migrated')
        if (!hasMigracion && isAdminMode) {
          const hasLocalData =
            localStorage.getItem('trackerEntries') ||
            localStorage.getItem('repasosData') ||
            localStorage.getItem('bloquesCompletados')
          if (hasLocalData) {
            console.log('🔄 Migrando datos de localStorage a Supabase...')
            await migrarDesdeLocalStorage()
            localStorage.setItem('supabase_migrated', '1')
            console.log('✅ Migración completada')
          } else {
            localStorage.setItem('supabase_migrated', '1')
          }
        }
        // Load all app data from Supabase (with fallback timeout for 100% offline support)
        await Promise.race([
          loadAppData(),
          new Promise(resolve => setTimeout(resolve, 800))
        ])
      } catch (err) {
        console.warn('Notice initializing app data (offline mode):', err)
      } finally {
        setDataReady(true)
      }
    }
    init()
  }, [])

  if (!dataReady) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fafafa' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#64748b' }}>Cargando tu plan de estudio...</div>
        </div>
      </div>
    )
  }

  return (
    <TrackerProvider>
      <div style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'row',
        background: '#fff',
      }}>
        <Navbar active={tab} setActive={setTab} isAdmin={isAdminMode} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', padding: '20px' }}>
            {tab === 'inicio'      && <Inicio setTab={setTab} />}
            {tab === 'buscador'    && (
              <Suspense fallback={
                <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a' }}>Cargando Buscador de Preguntas...</div>
                  <div style={{ fontSize: 13, marginTop: 4, color: '#94a3b8' }}>Accediendo a la base de datos de desgloses y simulacros</div>
                </div>
              }>
                <BuscadorPreguntas setTab={setTab} setBancoFiltros={setBancoFiltros} />
              </Suspense>
            )}
            {tab === 'prioridades' && <PrioridadesTemas />}
            {tab === 'evaluacion_p80' && <EvaluacionP80 setTab={setTab} />}
            {tab === 'calendario'  && <Calendario />}
            {tab === 'repasos'    && <Repasos />}
            {tab === 'progreso'   && <Progreso />}
            {tab === 'diario'     && <Diario />}
            {(tab === 'preguntas' || tab === 'desgloses' || tab === 'quiz' || tab === 'adaptativo') && (
              <TiradorMaestro
                key={tab}
                initialFiltros={
                  bancoFiltros
                    ? {
                        ...bancoFiltros,
                        mode: tab === 'quiz' ? 'custom' : (tab === 'adaptativo' ? 'adaptativo' : (tab === 'desgloses' ? 'desgloses' : 'master')),
                        initialFilters: bancoFiltros
                      }
                    : (
                        tab === 'desgloses'
                          ? { mode: 'desgloses', fuenteDefault: 'mir', fuente: 'mir' }
                          : tab === 'quiz'
                          ? { mode: 'custom' }
                          : tab === 'adaptativo'
                          ? { mode: 'adaptativo', preset: 'adaptativo' }
                          : null
                      )
                }
                mode={
                  tab === 'desgloses' ? 'desgloses' : (tab === 'adaptativo' ? 'adaptativo' : (tab === 'quiz' ? 'custom' : 'master'))
                }
                fuenteDefault={tab === 'desgloses' ? 'mir' : 'todas'}
                onFiltrosConsumed={() => setBancoFiltros(null)}
                setTab={setTab}
              />
            )}
            {tab === 'correccion' && <CorreccionSimulacro />}
            {tab === 'smartcards' && <Smartcards />}
            {tab === 'conceptos'  && <Smartcards />}
            {tab === 'simulacros' && (
              <ErrorBoundary>
                <Simulacros setTab={setTab} setBancoFiltros={setBancoFiltros} />
              </ErrorBoundary>
            )}
            {tab === 'publico'    && <PublicView />}
            {tab === 'ofrece'     && <OfreceEstudio />}
          </div>
        </main>
      </div>
    </TrackerProvider>
  )

}
