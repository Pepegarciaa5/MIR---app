/**
 * Archivo: src/lib/smartcardsEngine.js
 * Descripción: Motor Estocástico de Pesos y Latencias para Smartcards MIR.
 *
 * Lee automáticamente tanto de `src/data/smartcardsData.json` como de cualquier tarjeta
 * inyectada en `src/data/flashcardsData.json` (p. ej. `S20-Rev-01`..`S20-Rev-33`),
 * convirtiendo al vuelo el formato `"Pregunta → Respuesta (perla)"` en Smartcards Atómicas.
 */

import baseSmartcards from '../data/smartcardsData.json'
import legacyFlashcards from '../data/flashcardsData.json'

const STATE_STORAGE_KEY = 'mir_smartcards_state_v1'
const CUSTOM_CARDS_KEY = 'mir_smartcards_custom_v1'
const SETTINGS_STORAGE_KEY = 'mir_smartcards_settings_v1'

const DAY_MS = 86400000

const SUBJECT_MAP = {
  'ginecologia y obstetricia': 'Ginecología y Obstetricia',
  fisiologia: 'Fisiología',
  reumatologia: 'Reumatología',
  traumatologia: 'Traumatología',
  cardiologia: 'Cardiología',
  endocrino: 'Endocrinología',
  endocrinologia: 'Endocrinología',
  infecciosas: 'Infecciosas',
  neumologia: 'Neumología',
  genetica: 'Genética',
  anestesia: 'Anestesiología',
  pediatria: 'Pediatría',
  psiquiatria: 'Psiquiatría',
  neurologia: 'Neurología',
  nefrologia: 'Nefrología',
  hematologia: 'Hematología',
  digestivo: 'Digestivo',
  urologia: 'Urología',
  oftalmologia: 'Oftalmología',
  orl: 'ORL',
  otorrinolaringologia: 'ORL',
  dermatologia: 'Dermatología',
  oncologia: 'Oncología',
}

function normalizeSubjectName(raw) {
  if (!raw) return 'General'
  const clean = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
  return SUBJECT_MAP[clean] || raw.trim()
}

function parseArrowCardText(texto = '') {
  let pregunta = texto.trim()
  let rhs = ''
  if (texto.includes('→')) {
    const idx = texto.indexOf('→')
    pregunta = texto.slice(0, idx).trim().replace(/:$/, '')
    rhs = texto.slice(idx + 1).trim()
  }

  let respuesta = rhs
  let perla = ''

  if (rhs.includes('→')) {
    const idx2 = rhs.indexOf('→')
    respuesta = rhs.slice(0, idx2).trim()
    perla = rhs.slice(idx2 + 1).trim()
  } else {
    const m = rhs.match(/^([^()]{3,65}?)\s*\(([^()]{12,})\)\.?$/)
    if (m) {
      respuesta = m[1].trim()
      perla = m[2].trim()
      if (perla && !perla.endsWith('.')) perla += '.'
    } else if (rhs.includes('. ') && rhs.length > 85) {
      const dotIdx = rhs.indexOf('. ')
      respuesta = rhs.slice(0, dotIdx).trim()
      perla = rhs.slice(dotIdx + 2).trim()
    }
  }

  return { pregunta, respuesta, perla }
}

function inferOriginFromId(cid = '') {
  const s = String(cid)
  const mSim = s.match(/^S(\d+)[-_](.+)$/i)
  if (mSim) {
    return {
      origen: 'simulacro',
      fuenteTag: `Simulacro ${mSim[1]}`,
      preguntaRef: mSim[2],
    }
  }
  if (/^tirada/i.test(s)) {
    return {
      origen: 'tirada',
      fuenteTag: 'Tirada Diaria',
      preguntaRef: s,
    }
  }
  return {
    origen: 'simulacro',
    fuenteTag: 'Corrección MIR',
    preguntaRef: s,
  }
}

export const DEFAULT_SETTINGS = {
  hideFirstTryMastered: true,
  requeueFailedInSession: true,
  requeueGapCards: 5,
}

export function loadSmartcardSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSmartcardSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  } catch {}
}

export function loadSmartcardsState() {
  try {
    const raw = localStorage.getItem(STATE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveSmartcardsState(stateMap) {
  try {
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(stateMap))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mir_smartcards_updated'))
    }
  } catch {}
}

export function loadCustomSmartcards() {
  try {
    const raw = localStorage.getItem(CUSTOM_CARDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveCustomSmartcards(cards) {
  try {
    localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(cards))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('mir_smartcards_updated'))
    }
  } catch {}
}

export function addCustomSmartcard({
  id,
  asignatura = 'General',
  tema = null,
  subtema = null,
  pregunta,
  subtitulo = '',
  respuestaAtomica,
  respuesta,
  perla = '',
  explicacion = '',
  trampaMir = '',
  origen = 'manual',
  fuenteTag = 'Creada en App',
  preguntaRef = null,
}) {
  const custom = loadCustomSmartcards()
  const finalRespuesta = (respuesta || respuestaAtomica || '').trim()
  const finalPerla = (perla || explicacion || trampaMir || '').trim()

  const newCard = {
    id: id || `sc_custom_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    asignatura: normalizeSubjectName(asignatura),
    tema,
    subtema,
    titulo: pregunta || 'Smartcard MIR',
    pregunta: pregunta || '',
    respuesta: finalRespuesta,
    perla: finalPerla,
    subtitulo,
    origen,
    fuenteTag,
    preguntaRef,
    createdAt: Date.now(),
    initialWeight: 1.0,
  }

  const filtered = custom.filter(c => c.id !== newCard.id)
  filtered.unshift(newCard)
  saveCustomSmartcards(filtered)
  return newCard
}

/**
 * Devuelve todas las tarjetas combinando:
 * 1) Tarjetas inyectadas en `flashcardsData.json` desde cualquier otro chat (ej. `S20-Rev-01`..`S20-Rev-33`)
 * 2) `smartcardsData.json`
 * 3) Tarjetas creadas en la app (`localStorage`)
 */
export function getAllSmartcardsWithState(nowMs = Date.now()) {
  const stateMap = loadSmartcardsState()
  const customCards = loadCustomSmartcards()
  const settings = loadSmartcardSettings()

  const mergedMap = new Map()

  // 1. Cargar smartcardsData.json
  for (const c of baseSmartcards) {
    mergedMap.set(c.id, {
      ...c,
      asignatura: normalizeSubjectName(c.asignatura),
    })
  }

  // 2. Detectar automáticamente cualquier tarjeta inyectada en flashcardsData.json (ej. S20-Rev-*)
  if (Array.isArray(legacyFlashcards)) {
    for (let i = 0; i < legacyFlashcards.length; i++) {
      const item = legacyFlashcards[i]
      if (!item || !item.id) continue
      const cid = String(item.id)
      const imp = item.importancia || 'normal'
      const isCorrectionCard =
        imp !== 'normal' || /^(S\d+|T\d+|Sim|Tirada|MNE)/i.test(cid) || i >= 4920
      if (!isCorrectionCard) continue

      const { pregunta, respuesta, perla } = parseArrowCardText(item.texto || '')
      const { origen, fuenteTag, preguntaRef } = inferOriginFromId(cid)
      mergedMap.set(cid, {
        id: cid,
        asignatura: normalizeSubjectName(item.asignatura),
        titulo: pregunta,
        pregunta,
        respuesta: respuesta || item.texto,
        perla,
        origen,
        fuenteTag,
        preguntaRef,
        createdAt: mergedMap.get(cid)?.createdAt || (1762770000000 + i),
        initialWeight: 1.0,
      })
    }
  }

  // 3. Cargar tarjetas custom creadas desde la interfaz
  for (const c of customCards) {
    mergedMap.set(c.id, {
      ...c,
      asignatura: normalizeSubjectName(c.asignatura),
    })
  }

  const allItems = Array.from(mergedMap.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

  const result = []
  for (const card of allItems) {
    const st = stateMap[card.id] || {}
    const weight = st.weight !== undefined ? Number(st.weight) : (card.initialWeight || 1.0)
    const appearances = st.appearances || 0
    const lapses = st.lapses || 0
    const streak = st.streak || 0
    const status = st.status || 'new'
    const nextEligibleAt = st.nextEligibleAt || 0
    const lastReviewedAt = st.lastReviewedAt || null

    const isCooldownActive = nextEligibleAt > nowMs
    const isHiddenByMastery =
      status === 'archived' ||
      status === 'mastered' ||
      (status === 'mastered_first_try' && settings.hideFirstTryMastered)

    const isEligibleNow = !isHiddenByMastery && !isCooldownActive

    result.push({
      ...card,
      weight,
      appearances,
      lapses,
      streak,
      status,
      nextEligibleAt,
      lastReviewedAt,
      isCooldownActive,
      isHiddenByMastery,
      isEligibleNow,
    })
  }

  return result
}

export function previewCardOutcome(card) {
  const appearances = card?.appearances || 0
  const currentWeight = card?.weight !== undefined ? Number(card.weight) : 1.0
  const currentStreak = card?.streak || 0

  const failWeight = appearances === 0
    ? 10.0
    : Math.min(80.0, Math.max(10.0, Number((currentWeight * 2).toFixed(2))))

  let passWeight
  let passLatencyLabel
  let passSubLabel

  if (appearances === 0) {
    passWeight = 0.1
    passLatencyLabel = 'Dominada a la 1ª'
    passSubLabel = 'Peso → 0.1 (No se repite)'
  } else {
    passWeight = Number(Math.max(0.05, currentWeight / 2).toFixed(2))
    const nextStreak = currentStreak + 1
    if (nextStreak === 1) {
      passLatencyLabel = '~5 días'
    } else if (nextStreak === 2) {
      passLatencyLabel = '~14 días'
    } else if (nextStreak === 3) {
      passLatencyLabel = '~30 días'
    } else {
      passLatencyLabel = 'Dominada'
    }
    passSubLabel = `Peso ÷2 → ${passWeight} · Latencia ${passLatencyLabel}`
  }

  const failSubLabel = appearances === 0
    ? 'Peso → 10 · Prioridad máxima'
    : `Peso ×2 → ${failWeight} · Repetir hoy`

  return {
    failWeight,
    failSubLabel,
    passWeight,
    passLatencyLabel,
    passSubLabel,
  }
}

function computeJitteredMs(baseDays, randomFn = Math.random) {
  const jitterFactor = 0.85 + randomFn() * 0.30
  return Math.round(baseDays * jitterFactor * DAY_MS)
}

export function recordSmartcardResponse(cardId, knewIt, nowMs = Date.now(), randomFn = Math.random) {
  const stateMap = loadSmartcardsState()
  const prev = stateMap[cardId] || {
    weight: 1.0,
    appearances: 0,
    lapses: 0,
    streak: 0,
    status: 'new',
    nextEligibleAt: 0,
  }

  const appearances = (prev.appearances || 0) + 1
  const currentWeight = prev.weight !== undefined ? Number(prev.weight) : 1.0
  let newWeight = currentWeight
  let newStreak = prev.streak || 0
  let newLapses = prev.lapses || 0
  let newStatus = prev.status || 'new'
  let nextEligibleAt = nowMs

  if (!knewIt) {
    newWeight = prev.appearances === 0
      ? 10.0
      : Math.min(80.0, Math.max(10.0, Number((currentWeight * 2).toFixed(3))))
    newStreak = 0
    newLapses += 1
    newStatus = 'learning'
    nextEligibleAt = nowMs + Math.round(0.75 * DAY_MS)
  } else {
    if (prev.appearances === 0) {
      newWeight = 0.1
      newStreak = 1
      newStatus = 'mastered_first_try'
      nextEligibleAt = nowMs + computeJitteredMs(30, randomFn)
    } else {
      newWeight = Number(Math.max(0.025, currentWeight / 2).toFixed(4))
      newStreak += 1

      if (newStreak >= 4 || newWeight <= 0.05) {
        newStatus = 'mastered'
        nextEligibleAt = nowMs + computeJitteredMs(45, randomFn)
      } else if (newStreak === 1) {
        newStatus = 'review'
        nextEligibleAt = nowMs + computeJitteredMs(5, randomFn)
      } else if (newStreak === 2) {
        newStatus = 'review'
        nextEligibleAt = nowMs + computeJitteredMs(14, randomFn)
      } else {
        newStatus = 'review'
        nextEligibleAt = nowMs + computeJitteredMs(30, randomFn)
      }
    }
  }

  const updatedEntry = {
    weight: newWeight,
    appearances,
    lapses: newLapses,
    streak: newStreak,
    status: newStatus,
    lastReviewedAt: nowMs,
    lastOutcome: knewIt ? 'knew' : 'forgot',
    nextEligibleAt,
  }

  stateMap[cardId] = updatedEntry
  saveSmartcardsState(stateMap)
  return updatedEntry
}

export function setSmartcardStatus(cardId, status) {
  const stateMap = loadSmartcardsState()
  const prev = stateMap[cardId] || { weight: 1.0, appearances: 0, lapses: 0, streak: 0 }
  stateMap[cardId] = {
    ...prev,
    status,
    weight: status === 'archived' ? 0.01 : (status === 'new' ? 1.0 : prev.weight),
    nextEligibleAt: status === 'new' ? 0 : prev.nextEligibleAt,
  }
  saveSmartcardsState(stateMap)
}

export function resetSmartcardsProgress(cardIds = null) {
  if (!cardIds) {
    saveSmartcardsState({})
    return
  }
  const stateMap = loadSmartcardsState()
  for (const id of cardIds) {
    delete stateMap[id]
  }
  saveSmartcardsState(stateMap)
}

export function weightedRandomPick(candidates, randomFn = Math.random) {
  if (!candidates || candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]

  const totalWeight = candidates.reduce((acc, c) => acc + Math.max(0.01, Number(c.weight) || 1.0), 0)
  let threshold = randomFn() * totalWeight

  for (const card of candidates) {
    const w = Math.max(0.01, Number(card.weight) || 1.0)
    threshold -= w
    if (threshold <= 0) {
      return card
    }
  }
  return candidates[candidates.length - 1]
}
