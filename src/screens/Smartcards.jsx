/**
 * Archivo: src/screens/Smartcards.jsx
 * Descripción: Visualizador de Smartcards Atómicas MIR a pantalla completa.
 * Diseño minimalista de 2 segundos:
 *   - Anverso: 1 única pregunta cerrada gigante y centrada.
 *   - Reverso: 1 dato atómico gigante (1-6 palabras) + 1 línea de perla clínica.
 *   - Decisión binaria: «No lo sabía» (❌) vs «Lo sabía» (✅) con motor estocástico de pesos.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  getAllSmartcardsWithState,
  recordSmartcardResponse,
  previewCardOutcome,
  weightedRandomPick,
  addCustomSmartcard,
  setSmartcardStatus,
  resetSmartcardsProgress,
  loadSmartcardSettings,
  saveSmartcardSettings,
  pullSmartcardsFromCloud,
  pushSmartcardsToCloud,
} from '../lib/smartcardsEngine'
import { especialidadNombres, getEspecialidadColor } from '../data/especialidadesMIR'

const ACCENT = '#F26522'

function getWeightBadgeStyle(weight, status) {
  if (status === 'mastered_first_try' || status === 'mastered' || weight <= 0.15) {
    return {
      label: `❄️ Peso ${weight} · Dominada`,
      bg: '#ecfdf5',
      border: '#6ee7b7',
      text: '#047857',
    }
  }
  if (weight >= 20) {
    return {
      label: `🚨 Peso ${weight} · Alerta Máxima`,
      bg: '#fff1f2',
      border: '#fda4af',
      text: '#be123c',
    }
  }
  if (weight >= 10) {
    return {
      label: `🔥 Peso ${weight} · Prioridad Alta`,
      bg: '#fef2f2',
      border: '#fca5a5',
      text: '#dc2626',
    }
  }
  if (weight > 1.0) {
    return {
      label: `📈 Peso ${weight} · Consolidando`,
      bg: '#fffbeb',
      border: '#fcd34d',
      text: '#b45309',
    }
  }
  return {
    label: `✨ Peso ${weight} · Nueva`,
    bg: '#eff6ff',
    border: '#93c5fd',
    text: '#1d4ed8',
  }
}

function formatDaysRemaining(nextEligibleAt, nowMs = Date.now()) {
  if (!nextEligibleAt || nextEligibleAt <= nowMs) return 'Elegible hoy'
  const diffHours = (nextEligibleAt - nowMs) / 3600000
  if (diffHours < 24) return `en ${Math.ceil(diffHours)}h`
  const days = Math.round(diffHours / 24)
  return `en ${days}d`
}

export default function Smartcards() {
  const [allCards, setAllCards] = useState([])
  const [settings, setSettings] = useState(() => loadSmartcardSettings())

  // Filtros
  const [selectedAsignatura, setSelectedAsignatura] = useState('')
  const [selectedOrigen, setSelectedOrigen] = useState('todos')
  const [poolMode, setPoolMode] = useState('smart') // 'smart' | 'critical' | 'all'

  // Estado interactivo de la tarjeta actual
  const [currentCardId, setCurrentCardId] = useState(null)
  const [isFlipped, setIsFlipped] = useState(false)
  const [reboundQueue, setReboundQueue] = useState([])
  const [sessionStep, setSessionStep] = useState(0)
  const [sessionStats, setSessionStats] = useState({ knew: 0, forgot: 0 })

  // Modales y vistas secundarias
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showInspector, setShowInspector] = useState(false)

  // Campos del formulario Nueva Smartcard Atómica
  const [newAsig, setNewAsig] = useState('')
  const [newOrigen, setNewOrigen] = useState('tirada')
  const [newFuenteTag, setNewFuenteTag] = useState('')
  const [newPregunta, setNewPregunta] = useState('')
  const [newRespuesta, setNewRespuesta] = useState('')
  const [newPerla, setNewPerla] = useState('')

  const [syncStatus, setSyncStatus] = useState('idle') // 'idle' | 'syncing' | 'synced' | 'error'

  const refreshCards = useCallback(() => {
    const loaded = getAllSmartcardsWithState(Date.now())
    setAllCards(loaded)
  }, [])

  const handleManualSync = useCallback(async () => {
    setSyncStatus('syncing')
    try {
      const ok = await pullSmartcardsFromCloud()
      refreshCards()
      if (ok) {
        await pushSmartcardsToCloud()
        setSyncStatus('synced')
      } else {
        setSyncStatus('error')
      }
    } catch {
      setSyncStatus('error')
    }
  }, [refreshCards])

  useEffect(() => {
    refreshCards()
    const handler = () => refreshCards()
    window.addEventListener('mir_smartcards_updated', handler)

    // Sincronización inicial bidireccional con Supabase
    let mounted = true
    setSyncStatus('syncing')
    pullSmartcardsFromCloud()
      .then(ok => {
        if (!mounted) return
        refreshCards()
        if (ok) {
          pushSmartcardsToCloud().then(() => {
            if (mounted) setSyncStatus('synced')
          })
        } else {
          setSyncStatus('idle')
        }
      })
      .catch(() => {
        if (mounted) setSyncStatus('error')
      })

    // Sincronización al enfocar la ventana (ej. cambio entre localhost y vercel o dispositivos)
    const focusHandler = () => {
      pullSmartcardsFromCloud().then(ok => {
        if (ok) refreshCards()
      })
    }
    window.addEventListener('focus', focusHandler)

    return () => {
      mounted = false
      window.removeEventListener('mir_smartcards_updated', handler)
      window.removeEventListener('focus', focusHandler)
    }
  }, [refreshCards])

  const asignaturasList = useMemo(() => {
    const s = new Set(allCards.map(c => c.asignatura).filter(Boolean))
    return Array.from(s).sort()
  }, [allCards])

  const fuentesList = useMemo(() => {
    const counts = {}
    for (const c of allCards) {
      const tag = c.fuenteTag || 'General'
      counts[tag] = (counts[tag] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]))
  }, [allCards])

  const filteredByTaxonomy = useMemo(() => {
    return allCards.filter(c => {
      if (selectedAsignatura && c.asignatura !== selectedAsignatura) return false
      if (selectedOrigen !== 'todos') {
        if (['simulacro', 'tirada', 'manual'].includes(selectedOrigen)) {
          if (c.origen !== selectedOrigen) return false
        } else if (c.fuenteTag !== selectedOrigen) {
          return false
        }
      }
      return true
    })
  }, [allCards, selectedAsignatura, selectedOrigen])

  const candidatePool = useMemo(() => {
    if (poolMode === 'critical') {
      return filteredByTaxonomy.filter(c => c.status !== 'archived' && c.weight >= 10)
    }
    if (poolMode === 'all') {
      return filteredByTaxonomy.filter(c => c.status !== 'archived')
    }
    return filteredByTaxonomy.filter(c => c.isEligibleNow)
  }, [filteredByTaxonomy, poolMode])

  const summaryStats = useMemo(() => {
    const total = filteredByTaxonomy.length
    const criticas = filteredByTaxonomy.filter(c => c.weight >= 10 && c.status !== 'archived').length
    const dominadas = filteredByTaxonomy.filter(
      c => c.status === 'mastered_first_try' || c.status === 'mastered' || c.weight <= 0.15
    ).length
    const elegiblesHoy = filteredByTaxonomy.filter(c => c.isEligibleNow).length
    const totalPoolWeight = candidatePool.reduce((acc, c) => acc + Math.max(0.01, Number(c.weight) || 1), 0)

    return { total, criticas, dominadas, elegiblesHoy, totalPoolWeight }
  }, [filteredByTaxonomy, candidatePool])

  const pickNextCard = useCallback(
    (poolOverride = null, stepOverride = null, reboundOverride = null, lastIdToAvoid = null) => {
      const pool = poolOverride || candidatePool
      const step = stepOverride !== null ? stepOverride : sessionStep
      const rQueue = reboundOverride || reboundQueue

      const dueRebound = rQueue.find(item => item.dueAtStep <= step)
      if (dueRebound) {
        const foundInAll = allCards.find(c => c.id === dueRebound.cardId)
        if (foundInAll && foundInAll.id !== lastIdToAvoid) {
          setReboundQueue(prev => prev.filter(x => x.cardId !== dueRebound.cardId))
          setCurrentCardId(foundInAll.id)
          setIsFlipped(false)
          return
        }
      }

      if (!pool || pool.length === 0) {
        setCurrentCardId(null)
        setIsFlipped(false)
        return
      }

      const withoutImmediateRepeat =
        pool.length > 1 && lastIdToAvoid ? pool.filter(c => c.id !== lastIdToAvoid) : pool

      const chosen = weightedRandomPick(withoutImmediateRepeat)
      setCurrentCardId(chosen ? chosen.id : null)
      setIsFlipped(false)
    },
    [candidatePool, sessionStep, reboundQueue, allCards]
  )

  useEffect(() => {
    if (!currentCardId || !candidatePool.some(c => c.id === currentCardId)) {
      pickNextCard(candidatePool, sessionStep, reboundQueue, null)
    }
  }, [selectedAsignatura, selectedOrigen, poolMode, candidatePool.length])

  const currentCard = useMemo(() => {
    if (!currentCardId) return null
    return allCards.find(c => c.id === currentCardId) || null
  }, [allCards, currentCardId])

  const outcomePreview = useMemo(() => {
    if (!currentCard) return null
    return previewCardOutcome(currentCard)
  }, [currentCard])

  const currentCardProbabilityPct = useMemo(() => {
    if (!currentCard || summaryStats.totalPoolWeight <= 0) return 0
    const pct = (Math.max(0.01, currentCard.weight) / summaryStats.totalPoolWeight) * 100
    return pct < 0.1 ? '<0.1' : pct.toFixed(1)
  }, [currentCard, summaryStats.totalPoolWeight])

  const handleAnswer = useCallback(
    (knewIt) => {
      if (!currentCard) return
      const answeredId = currentCard.id
      const nextStep = sessionStep + 1

      recordSmartcardResponse(answeredId, knewIt)
      const updatedAll = getAllSmartcardsWithState(Date.now())
      setAllCards(updatedAll)

      setSessionStep(nextStep)
      setSessionStats(prev => ({
        knew: prev.knew + (knewIt ? 1 : 0),
        forgot: prev.forgot + (knewIt ? 0 : 1),
      }))

      let nextRebound = [...reboundQueue]
      if (!knewIt && settings.requeueFailedInSession) {
        nextRebound = [
          ...nextRebound.filter(x => x.cardId !== answeredId),
          { cardId: answeredId, dueAtStep: nextStep + (settings.requeueGapCards || 5) },
        ]
        setReboundQueue(nextRebound)
      }

      const nextTaxonomy = updatedAll.filter(c => {
        if (selectedAsignatura && c.asignatura !== selectedAsignatura) return false
        if (selectedOrigen !== 'todos') {
          if (['simulacro', 'tirada', 'manual'].includes(selectedOrigen)) {
            if (c.origen !== selectedOrigen) return false
          } else if (c.fuenteTag !== selectedOrigen) {
            return false
          }
        }
        return true
      })
      const nextPool =
        poolMode === 'critical'
          ? nextTaxonomy.filter(c => c.status !== 'archived' && c.weight >= 10)
          : poolMode === 'all'
          ? nextTaxonomy.filter(c => c.status !== 'archived')
          : nextTaxonomy.filter(c => c.isEligibleNow)

      pickNextCard(nextPool, nextStep, nextRebound, answeredId)
    },
    [
      currentCard,
      sessionStep,
      reboundQueue,
      settings,
      selectedAsignatura,
      selectedOrigen,
      poolMode,
      pickNextCard,
    ]
  )

  useEffect(() => {
    const onKeyDown = (e) => {
      if (showCreateModal) return
      const active = document.activeElement
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (!isFlipped) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault()
          if (currentCard) setIsFlipped(true)
        }
      } else {
        if (e.key === '1' || e.key === 'ArrowLeft') {
          e.preventDefault()
          handleAnswer(false)
        } else if (e.key === '2' || e.key === 'ArrowRight' || e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault()
          handleAnswer(true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isFlipped, currentCard, handleAnswer, showCreateModal])

  const handleToggleHideFirstTry = () => {
    const next = { ...settings, hideFirstTryMastered: !settings.hideFirstTryMastered }
    setSettings(next)
    saveSmartcardSettings(next)
    refreshCards()
  }

  const handleCreateSmartcard = (e) => {
    e.preventDefault()
    if (!newPregunta.trim() || !newRespuesta.trim()) return
    const created = addCustomSmartcard({
      asignatura: newAsig || selectedAsignatura || 'General',
      pregunta: newPregunta.trim(),
      respuesta: newRespuesta.trim(),
      perla: newPerla.trim(),
      origen: newOrigen,
      fuenteTag: newFuenteTag.trim() || (newOrigen === 'simulacro' ? 'Simulacro CTO' : 'Tirada Diaria'),
    })
    setNewPregunta('')
    setNewRespuesta('')
    setNewPerla('')
    setShowCreateModal(false)
    refreshCards()
    setCurrentCardId(created.id)
    setIsFlipped(false)
  }

  const handleArchiveCurrent = () => {
    if (!currentCard) return
    setSmartcardStatus(currentCard.id, 'archived')
    refreshCards()
    setCurrentCardId(null)
  }

  const weightBadge = currentCard ? getWeightBadgeStyle(currentCard.weight, currentCard.status) : null
  const subjectColors = currentCard ? getEspecialidadColor(currentCard.asignatura) : null

  return (
    <div
      style={{
        maxWidth: 1140,
        margin: '0 auto',
        minHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* ── BARRA SUPERIOR ULTRACOMPACTA (1 LÍNEA) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
          flexWrap: 'wrap',
          padding: '8px 14px',
          background: '#f8fafc',
          borderRadius: 14,
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 17, fontWeight: 900, color: '#0f172a', letterSpacing: '-0.3px' }}>
            🃏 Smartcards
          </span>

          <select
            value={selectedAsignatura}
            onChange={e => setSelectedAsignatura(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
              fontWeight: 700,
              background: '#fff',
              color: '#1e293b',
              cursor: 'pointer',
            }}
          >
            <option value="">📚 Todas ({allCards.length})</option>
            {asignaturasList.map(a => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>

          <select
            value={selectedOrigen}
            onChange={e => setSelectedOrigen(e.target.value)}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #cbd5e1',
              fontSize: 12.5,
              fontWeight: 700,
              background: '#fff',
              color: '#1e293b',
              cursor: 'pointer',
            }}
          >
            <option value="todos">🗂️ Todos los orígenes ({allCards.length})</option>
            {fuentesList.map(([tag, cnt]) => (
              <option key={tag} value={tag}>
                🎯 {tag} ({cnt})
              </option>
            ))}
            <option value="tirada">📝 Todas las Tiradas</option>
            <option value="manual">✍️ Manuales</option>
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            {[
              { id: 'smart', label: `🎲 Activas (${summaryStats.elegiblesHoy})` },
              { id: 'critical', label: `🔥 Críticas (${summaryStats.criticas})` },
              { id: 'all', label: `🌐 Todas (${summaryStats.total})` },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setPoolMode(m.id)}
                style={{
                  padding: '5px 10px',
                  borderRadius: 8,
                  border: poolMode === m.id ? `1.5px solid ${ACCENT}` : '1px solid #cbd5e1',
                  background: poolMode === m.id ? '#fff0e6' : '#fff',
                  color: poolMode === m.id ? ACCENT : '#475569',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 800,
              background: '#fff',
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid #e2e8f0',
            }}
          >
            Hoy: <span style={{ color: '#16a34a' }}>✅ {sessionStats.knew}</span> ·{' '}
            <span style={{ color: '#dc2626' }}>❌ {sessionStats.forgot}</span> ·{' '}
            <span style={{ color: '#047857' }}>❄️ {summaryStats.dominadas} dom.</span>
          </span>

          <button
            onClick={handleManualSync}
            title="Sincronizar Smartcards con Supabase (Nube)"
            disabled={syncStatus === 'syncing'}
            style={{
              background: syncStatus === 'synced' ? '#f0fdf4' : syncStatus === 'error' ? '#fef2f2' : '#f8fafc',
              color: syncStatus === 'synced' ? '#166534' : syncStatus === 'error' ? '#b91c1c' : '#475569',
              border: `1px solid ${syncStatus === 'synced' ? '#bbf7d0' : syncStatus === 'error' ? '#fecaca' : '#cbd5e1'}`,
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: syncStatus === 'syncing' ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {syncStatus === 'syncing' ? '🔄 Sincronizando...' : syncStatus === 'error' ? '⚠️ Reintentar Sync' : '☁️ Nube sincronizada'}
          </button>

          <button
            onClick={() => setShowInspector(v => !v)}
            style={{
              background: showInspector ? '#e2e8f0' : '#fff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            📊 Pesos
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              background: ACCENT,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            + Nueva
          </button>
        </div>
      </div>

      {/* ── LIENZO PROTAGONISTA DE LA SMARTCARD ATÓMICA (2 SEGUNDOS) ── */}
      {currentCard ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: '#ffffff',
            borderRadius: 28,
            border: isFlipped ? '2.5px solid #cbd5e1' : '2px solid #e2e8f0',
            boxShadow: '0 24px 60px -15px rgba(15, 23, 42, 0.10)',
            padding: '28px 40px',
            minHeight: 'calc(100vh - 155px)',
          }}
        >
          {/* Barra superior interna de la tarjeta */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 800,
                  padding: '6px 14px',
                  borderRadius: 999,
                  background: subjectColors?.bg || '#eff6ff',
                  color: subjectColors?.text || '#1d4ed8',
                  border: `1.5px solid ${subjectColors?.border || '#bfdbfe'}`,
                  textTransform: 'uppercase',
                  letterSpacing: 0.4,
                }}
              >
                {currentCard.asignatura}
              </span>

              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  padding: '5px 12px',
                  borderRadius: 999,
                  background: '#f8fafc',
                  color: '#475569',
                  border: '1px solid #cbd5e1',
                }}
              >
                {currentCard.fuenteTag || 'Smartcard'}
                {currentCard.preguntaRef ? ` · ${currentCard.preguntaRef}` : ''}
              </span>

              {weightBadge && (
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    padding: '5px 13px',
                    borderRadius: 999,
                    background: weightBadge.bg,
                    color: weightBadge.text,
                    border: `1.5px solid ${weightBadge.border}`,
                  }}
                >
                  {weightBadge.label}
                </span>
              )}

              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#64748b',
                }}
              >
                🎲 {currentCardProbabilityPct}% prob.
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => pickNextCard(candidatePool, sessionStep, reboundQueue, currentCard.id)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: 10,
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                🎲 Otra
              </button>
              <button
                onClick={handleArchiveCurrent}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 10,
                  padding: '6px 12px',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: '#dc2626',
                  cursor: 'pointer',
                }}
              >
                Archivar
              </button>
            </div>
          </div>

          {/* ── ESCENARIO CENTRAL: PREGUNTA Y RESPUESTA ATÓMICA CENTRADAS ── */}
          <div
            onClick={() => !isFlipped && setIsFlipped(true)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              maxWidth: 880,
              margin: '0 auto',
              width: '100%',
              padding: '24px 12px',
              cursor: !isFlipped ? 'pointer' : 'default',
              gap: 28,
            }}
          >
            {/* ANVERSO: La única pregunta cerrada */}
            <div
              style={{
                fontSize: isFlipped ? 22 : 31,
                fontWeight: isFlipped ? 700 : 850,
                color: isFlipped ? '#475569' : '#0f172a',
                lineHeight: 1.38,
                letterSpacing: '-0.4px',
                transition: 'all 0.2s ease',
              }}
            >
              {currentCard.pregunta || currentCard.titulo}
            </div>

            {/* REVERSO: Respuesta Atómica Gigante (1-6 palabras) + 1 línea de perla */}
            {isFlipped && (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 18,
                  animation: 'fadeIn 0.15s ease-out',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    padding: '28px 32px',
                    borderRadius: 24,
                    background: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
                    border: '2.5px solid #4ade80',
                    boxShadow: '0 12px 30px -8px rgba(34, 197, 94, 0.18)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 900,
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                      color: '#15803d',
                      marginBottom: 8,
                    }}
                  >
                    ⚡ Respuesta Atómica
                  </div>
                  <div
                    style={{
                      fontSize: 34,
                      fontWeight: 900,
                      color: '#064e3b',
                      lineHeight: 1.25,
                      letterSpacing: '-0.5px',
                    }}
                  >
                    {currentCard.respuesta}
                  </div>
                </div>

                {currentCard.perla && (
                  <div
                    style={{
                      fontSize: 17.5,
                      fontWeight: 600,
                      color: '#334155',
                      background: '#f8fafc',
                      border: '1.5px solid #e2e8f0',
                      padding: '14px 22px',
                      borderRadius: 16,
                      maxWidth: 780,
                      lineHeight: 1.45,
                    }}
                  >
                    💡 {currentCard.perla}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── DOCK INFERIOR DE ACCIÓN GIGANTE ── */}
          {!isFlipped ? (
            <button
              onClick={() => setIsFlipped(true)}
              style={{
                width: '100%',
                padding: '22px 24px',
                borderRadius: 18,
                border: '2px solid #cbd5e1',
                background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
                color: '#0f172a',
                fontSize: 19,
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <span>👁️ Ver Respuesta</span>
              <span
                style={{
                  fontSize: 13,
                  color: '#475569',
                  background: '#e2e8f0',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontWeight: 700,
                }}
              >
                Espacio / Enter
              </span>
            </button>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 18,
              }}
            >
              <button
                onClick={() => handleAnswer(false)}
                style={{
                  padding: '20px 24px',
                  borderRadius: 18,
                  border: '2.5px solid #f87171',
                  background: 'linear-gradient(180deg, #fef2f2 0%, #fee2e2 100%)',
                  color: '#991b1b',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>❌ No lo sabía</span>
                  <span
                    style={{
                      fontSize: 12.5,
                      background: 'rgba(255,255,255,0.75)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontWeight: 800,
                    }}
                  >
                    1 / ←
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#dc2626' }}>
                  {outcomePreview?.failSubLabel}
                </div>
              </button>

              <button
                onClick={() => handleAnswer(true)}
                style={{
                  padding: '20px 24px',
                  borderRadius: 18,
                  border: '2.5px solid #4ade80',
                  background: 'linear-gradient(180deg, #f0fdf4 0%, #dcfce7 100%)',
                  color: '#14532d',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 20, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>✅ Lo sabía</span>
                  <span
                    style={{
                      fontSize: 12.5,
                      background: 'rgba(255,255,255,0.75)',
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontWeight: 800,
                    }}
                  >
                    2 / →
                  </span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: '#15803d' }}>
                  {outcomePreview?.passSubLabel}
                </div>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            background: '#fff',
            borderRadius: 28,
            border: '2px solid #e2e8f0',
            padding: '64px 24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 56, marginBottom: 14 }}>🎉</div>
          <h3 style={{ fontSize: 24, fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>
            ¡Bombo al día! No tienes tarjetas pendientes ahora mismo
          </h3>
          <p style={{ fontSize: 15, color: '#64748b', maxWidth: 540, margin: '0 auto 24px' }}>
            Las tarjetas que acertaste a la primera están congeladas (peso 0.1) y las demás están cumpliendo su
            latencia.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setPoolMode('all')}
              style={{
                padding: '12px 20px',
                borderRadius: 12,
                border: '1.5px solid #cbd5e1',
                background: '#f8fafc',
                color: '#1e293b',
                fontSize: 14,
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              🌐 Entrenar con todas (ignorar latencia)
            </button>
            {summaryStats.criticas > 0 && (
              <button
                onClick={() => setPoolMode('critical')}
                style={{
                  padding: '12px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#dc2626',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                🔥 Repasar solo mis {summaryStats.criticas} críticas (Peso ≥10)
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── INSPECTOR DESPLEGABLE DE TABLA DE PESOS ── */}
      {showInspector && (
        <div
          style={{
            background: '#fff',
            border: '1.5px solid #cbd5e1',
            borderRadius: 20,
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              marginBottom: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>
              📊 Ranking de Pesos y Latencias ({filteredByTaxonomy.length} tarjetas atómicas)
            </h3>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={settings.hideFirstTryMastered}
                  onChange={handleToggleHideFirstTry}
                />
                Congelar sabidas a la 1ª (Peso 0.1)
              </label>

              <button
                onClick={() => {
                  if (window.confirm('¿Reiniciar todos los pesos a 1.0 y poner todas las tarjetas como nuevas?')) {
                    resetSmartcardsProgress()
                    refreshCards()
                  }
                }}
                style={{
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#dc2626',
                  padding: '4px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Reiniciar todos los pesos a 1.0
              </button>
            </div>
          </div>

          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left', color: '#475569' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Asignatura</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Pregunta (Anverso)</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Respuesta (Reverso)</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Peso</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Estado</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e2e8f0' }}>Ir</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredByTaxonomy]
                  .sort((a, b) => b.weight - a.weight)
                  .map(card => {
                    const b = getWeightBadgeStyle(card.weight, card.status)
                    return (
                      <tr key={card.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 700, color: '#334155' }}>
                          {card.asignatura}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#0f172a', fontWeight: 600 }}>
                          {card.pregunta || card.titulo}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#15803d', fontWeight: 800 }}>
                          {card.respuesta}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: 999,
                              background: b.bg,
                              color: b.text,
                              border: `1px solid ${b.border}`,
                              fontWeight: 800,
                              fontSize: 11.5,
                            }}
                          >
                            {card.weight}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: '#475569' }}>
                          {card.status === 'mastered_first_try' && settings.hideFirstTryMastered
                            ? 'Congelada (1ª)'
                            : formatDaysRemaining(card.nextEligibleAt)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <button
                            onClick={() => {
                              setCurrentCardId(card.id)
                              setIsFlipped(false)
                              setShowInspector(false)
                            }}
                            style={{
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              borderRadius: 6,
                              padding: '4px 10px',
                              fontSize: 11.5,
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            Abrir
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── MODAL CREAR NUEVA SMARTCARD ATÓMICA ── */}
      {showCreateModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <form
            onSubmit={handleCreateSmartcard}
            style={{
              background: '#fff',
              borderRadius: 20,
              width: '100%',
              maxWidth: 520,
              padding: 24,
              boxShadow: '0 20px 30px -10px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              🃏 Nueva Smartcard Atómica (Regla de 2 segundos)
            </h3>

            <div style={{ display: 'flex', gap: 10 }}>
              <select
                value={newAsig}
                onChange={e => setNewAsig(e.target.value)}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="">— Asignatura —</option>
                {especialidadNombres.map(n => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>

              <select
                value={newOrigen}
                onChange={e => setNewOrigen(e.target.value)}
                style={{
                  padding: '9px 12px',
                  borderRadius: 9,
                  border: '1px solid #cbd5e1',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                <option value="tirada">📝 De Tirada</option>
                <option value="simulacro">🎯 De Simulacro</option>
                <option value="manual">✍️ Manual</option>
              </select>
            </div>

            <input
              value={newFuenteTag}
              onChange={e => setNewFuenteTag(e.target.value)}
              placeholder="Origen opcional (ej. Simulacro 20 · Q45)"
              style={{
                padding: '9px 12px',
                borderRadius: 9,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />

            <input
              required
              value={newPregunta}
              onChange={e => setNewPregunta(e.target.value)}
              placeholder="Pregunta directa (1 línea) *"
              style={{
                padding: '11px 12px',
                borderRadius: 9,
                border: '1px solid #cbd5e1',
                fontSize: 14,
                fontWeight: 600,
              }}
            />

            <input
              required
              value={newRespuesta}
              onChange={e => setNewRespuesta(e.target.value)}
              placeholder="Respuesta corta (1 a 6 palabras) *"
              style={{
                padding: '11px 12px',
                borderRadius: 9,
                border: '1.5px solid #86efac',
                background: '#f0fdf4',
                fontSize: 14.5,
                fontWeight: 800,
              }}
            />

            <input
              value={newPerla}
              onChange={e => setNewPerla(e.target.value)}
              placeholder="💡 Matiz o trampa en 1 sola frase corta (opcional)"
              style={{
                padding: '10px 12px',
                borderRadius: 9,
                border: '1px solid #cbd5e1',
                fontSize: 13,
              }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: '9px 16px',
                  borderRadius: 9,
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#475569',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{
                  padding: '9px 18px',
                  borderRadius: 9,
                  border: 'none',
                  background: ACCENT,
                  color: '#fff',
                  fontWeight: 800,
                  cursor: 'pointer',
                }}
              >
                Guardar Smartcard
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
