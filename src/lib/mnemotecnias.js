const STORAGE_KEY = 'mir_mnemotecnias'

export function getMnemotecnias() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch (e) {
    return []
  }
}

export function saveMnemotecnia(mne) {
  const current = getMnemotecnias()
  current.push(mne)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  return current
}

export function deleteMnemotecnia(id) {
  const current = getMnemotecnias().filter(m => m.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  return current
}
