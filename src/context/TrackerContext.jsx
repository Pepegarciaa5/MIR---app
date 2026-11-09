/**
 * Archivo: TrackerContext.jsx
 * Descripción: Proveedor de estado global (Context API) para centralizar la información de seguimiento del estudio y la fecha activa.
 * Creado: 2026-05-07
 * Última actualización: 2026-05-07
 */

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

  const notifiedRef = useRef(false)

  // ─── AUTO-TRACKER MAC (Lee el estado emitido por scripts/mac_tracker.py) ─────
  useEffect(() => {
    let activeAutoSessionId = null
    const checkAutoTracker = async () => {
      try {
        const resp = await fetch('/src/data/live_tracker.json?t=' + Date.now())
        if (!resp.ok) return
        const live = await resp.json()
        if (live.is_studying && live.session_active && live.descripcion) {
          // Si el usuario no tiene una sesión manual iniciada o es una sesión automática
          const currentActive = JSON.parse(localStorage.getItem(KEY_ACTIVE) || 'null')
          if (!currentActive || currentActive.isAuto) {
            if (activeAutoSessionId !== live.session_id) {
              activeAutoSessionId = live.session_id
              const autoEntry = {
                id: live.session_id,
                descripcion: live.descripcion,
                especialidad: null,
                tema: null,
                inicio: live.session_start || (Date.now() - (live.session_duration_seconds * 1000)),
                fecha: todayKey(),
                isAuto: true,
                categoria: live.categoria
              }
              setActiveEntry(autoEntry)
              localStorage.setItem(KEY_ACTIVE, JSON.stringify(autoEntry))
            }
          }
        } else {
          // No está estudiando o inactivo
          const currentActive = JSON.parse(localStorage.getItem(KEY_ACTIVE) || 'null')
          if (currentActive && currentActive.isAuto) {
            stopTracking()
            activeAutoSessionId = null
          }
        }
      } catch (e) {
        // Ignorar si no está corriendo el daemon
      }
    }

    const interval = setInterval(checkAutoTracker, 3000)
    checkAutoTracker()
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    clearInterval(timerRef.current)
    if (activeEntry) {
      notifiedRef.current = false
      setElapsed(Math.floor((Date.now() - activeEntry.inicio) / 1000))
      timerRef.current = setInterval(() => {
        const currentElapsed = Math.floor((Date.now() - activeEntry.inicio) / 1000)
        setElapsed(currentElapsed)
        
        // Comprobar si hemos llegado al tiempo objetivo
        if (activeEntry.targetTimeSeconds && currentElapsed >= activeEntry.targetTimeSeconds && !notifiedRef.current) {
          notifiedRef.current = true
          // Usamos setTimeout para no bloquear el renderizado del timer
          setTimeout(() => {
            alert(`¡Tiempo cumplido! Has superado el objetivo de tiempo para: ${activeEntry.descripcion}`)
          }, 100)
        }
      }, 1000)
    } else {
      setElapsed(0)
    }
    return () => clearInterval(timerRef.current)
  }, [activeEntry?.id, activeEntry?.targetTimeSeconds, activeEntry?.inicio, activeEntry?.descripcion])

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

  const startTracking = ({ descripcion, especialidad = null, tema = null, bloqueId = null, repasoId = null, targetTimeSeconds = null }) => {
    if (activeEntry) _commit(activeEntry)
    const entry = {
      id: String(Date.now()),
      descripcion,
      especialidad,
      tema,
      bloqueId,
      repasoId,
      targetTimeSeconds,
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

  const editEntry = async (id, changes) => {
    const existing = entries.find(e => e.id === id)
    if (!existing) return
    const patched = { ...existing, ...changes }
    // Keep duracionSegundos consistent with inicio/fin
    if (changes.inicio !== undefined || changes.fin !== undefined) {
      patched.duracionSegundos = Math.max(0, Math.floor((patched.fin - patched.inicio) / 1000))
    } else if (changes.duracionSegundos !== undefined) {
      patched.fin = patched.inicio + patched.duracionSegundos * 1000
    }
    await upsertTrackerEntry(patched)
    setEntries(prev => prev.map(e => e.id === id ? patched : e))
  }

  return (
    <TrackerContext.Provider value={{ entries, activeEntry, elapsed, loaded, startTracking, stopTracking, getBlockSeconds, deleteEntry, editEntry }}>
      {children}
    </TrackerContext.Provider>
  )
}

export const useTracker = () => useContext(TrackerContext)
