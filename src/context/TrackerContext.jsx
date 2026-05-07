import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  getTrackerEntries,
  upsertTrackerEntry,
  deleteTrackerEntry as dbDeleteEntry,
} from '../lib/db'

const TrackerContext = createContext(null)

const KEY_ACTIVE = 'activeTrackerEntry'

function todayKey() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth()+1).padStart(2,'0')
  const day = String(d.getDate()).padStart(2,'0')
  return `${year}-${month}-${day}`
}

export function TrackerProvider({ children }) {
  const [entries, setEntries] = useState([])
  const [activeEntry, setActiveEntry] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY_ACTIVE)) || null } catch { return null }
  })
  const [elapsed, setElapsed] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const timerRef = useRef(null)

  // Load entries from Supabase on mount
  useEffect(() => {
    getTrackerEntries().then(data => {
      setEntries(data)
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeEntry) {
      setElapsed(Math.floor((Date.now() - activeEntry.inicio) / 1000))
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - activeEntry.inicio) / 1000))
      }, 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(timerRef.current)
  }, [activeEntry?.id])

  const _commit = async (entry) => {
    const fin = Date.now()
    const duracionSegundos = Math.floor((fin - entry.inicio) / 1000)
    if (duracionSegundos < 2) return null
    const completed = { ...entry, fin, duracionSegundos }
    // Save to Supabase
    await upsertTrackerEntry(completed)
    setEntries(prev => [completed, ...prev])
    return completed
  }

  const startTracking = ({ descripcion, especialidad = null, tema = null, bloqueId = null, repasoId = null }) => {
    if (activeEntry) _commit(activeEntry)
    const entry = {
      id: String(Date.now()),
      descripcion,
      especialidad,
      tema,
      bloqueId,
      repasoId,
      inicio: Date.now(),
      fecha: todayKey(),
    }
    setActiveEntry(entry)
    localStorage.setItem(KEY_ACTIVE, JSON.stringify(entry))
  }

  const stopTracking = () => {
    if (!activeEntry) return null
    const result = _commit(activeEntry)
    setActiveEntry(null)
    localStorage.removeItem(KEY_ACTIVE)
    return result
  }

  const getBlockSeconds = (bloqueId) => {
    const fromHistory = entries
      .filter(e => e.bloqueId === bloqueId)
      .reduce((sum, e) => sum + e.duracionSegundos, 0)
    const fromActive = activeEntry?.bloqueId === bloqueId ? elapsed : 0
    return fromHistory + fromActive
  }

  const deleteEntry = async (id) => {
    await dbDeleteEntry(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  const editEntryDuration = async (id, newDuracionSegundos) => {
    const updated = entries.find(e => e.id === id)
    if (!updated) return
    const patched = { ...updated, duracionSegundos: newDuracionSegundos, fin: updated.inicio + newDuracionSegundos * 1000 }
    await upsertTrackerEntry(patched)
    setEntries(prev => prev.map(e => e.id === id ? patched : e))
  }

  return (
    <TrackerContext.Provider value={{ entries, activeEntry, elapsed, loaded, startTracking, stopTracking, getBlockSeconds, deleteEntry, editEntryDuration }}>
      {children}
    </TrackerContext.Provider>
  )
}

export const useTracker = () => useContext(TrackerContext)
