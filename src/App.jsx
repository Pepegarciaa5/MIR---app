/**
 * Archivo: App.jsx
 * Descripción: Componente raíz de la aplicación. Gestiona el enrutamiento principal, la migración de datos legacy y la inicialización del estado.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-17
 */

import { useState, useEffect } from 'react'
import { TrackerProvider } from './context/TrackerContext'
import Navbar from './components/Navbar'
import TrackerBar from './components/TrackerBar'
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
import CorreccionSimulacro from './screens/CorreccionSimulacro'
import { loadAppData, migrarDesdeLocalStorage } from './data/mockData'
import { isAdminMode } from './lib/supabase'

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
        // Load all app data from Supabase
        await loadAppData()
      } catch (err) {
        console.error('❌ Error initializing app data:', err)
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
          {isAdminMode && <TrackerBar />}
          <div style={{ flex: 1, overflow: 'auto', overflowX: 'hidden', padding: '20px' }}>
            {tab === 'inicio'     && <Inicio setTab={setTab} />}
            {tab === 'calendario' && <Calendario />}
            {tab === 'repasos'    && <Repasos />}
            {tab === 'progreso'   && <Progreso />}
            {tab === 'diario'     && <Diario />}
            {tab === 'adaptativo' && <EstudioAdaptativo setTab={setTab} />}
            {tab === 'correccion' && <CorreccionSimulacro />}
            {tab === 'desgloses'  && <Desgloses />}
            {tab === 'conceptos'  && <ColaEstudio />}
            <div style={{ display: tab === 'quiz' ? 'block' : 'none' }}>
              <BancoPreguntas initialFiltros={bancoFiltros} onFiltrosConsumed={() => setBancoFiltros(null)} />
            </div>
            {tab === 'simulacros' && <Simulacros setTab={setTab} setBancoFiltros={setBancoFiltros} />}
            {tab === 'publico'    && <PublicView />}
            {tab === 'ofrece'     && <OfreceEstudio />}
          </div>
        </main>
      </div>
    </TrackerProvider>
  )

}
