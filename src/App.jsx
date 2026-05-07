import { useState, useEffect } from 'react'
import { TrackerProvider } from './context/TrackerContext'
import Navbar from './components/Navbar'
import TrackerBar from './components/TrackerBar'
import Inicio from './screens/Inicio'
import Calendario from './screens/Calendario'
import Repasos from './screens/Repasos'
import Progreso from './screens/Progreso'
import Diario from './screens/Diario'
import { loadAppData, migrarDesdeLocalStorage } from './data/mockData'
import { isAdminMode } from './lib/supabase'

export default function App() {
  const [tab, setTab] = useState(isAdminMode ? 'inicio' : 'diario')
  const [dataReady, setDataReady] = useState(false)

  useEffect(() => {
    async function init() {
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
      setDataReady(true)
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
            {tab === 'inicio'     && <Inicio />}
            {tab === 'calendario' && <Calendario />}
            {tab === 'repasos'    && <Repasos />}
            {tab === 'progreso'   && <Progreso />}
            {tab === 'diario'     && <Diario />}
          </div>
        </main>
      </div>
    </TrackerProvider>
  )
}
