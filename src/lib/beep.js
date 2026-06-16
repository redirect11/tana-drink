// Bip per i nuovi ordini al bancone.
//
// Perché serve: su iPad/iOS, quando l'app è in primo piano il sistema
// SOPPRIME il banner delle notifiche e non esiste la vibrazione. Un suono è
// l'unico avviso affidabile mentre il gestionale è aperto e in uso.
//
// Vincolo iOS: l'audio può partire solo dopo uno "sblocco" dentro a un gesto
// utente. Agganciamo lo sblocco al primo tocco/clic sulla pagina (una volta
// sola); dopodiché beep() può suonare anche da un evento non-gesto (es. il
// listener Firestore che riceve un ordine nuovo).

let ctx = null

function getCtx() {
  if (ctx) return ctx
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)
  if (!AC) return null
  try {
    ctx = new AC()
  } catch {
    ctx = null
  }
  return ctx
}

// Riattiva l'AudioContext. Va chiamata DENTRO a un gesto utente (iOS).
export function armAudio() {
  const c = getCtx()
  if (c && c.state === 'suspended') c.resume().catch(() => {})
}

// Aggancia lo sblocco audio al primo gesto utente (una sola volta).
export function installAudioUnlock() {
  if (typeof window === 'undefined') return
  const unlock = () => {
    armAudio()
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('touchend', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('touchend', unlock)
  window.addEventListener('keydown', unlock)
}

// Un singolo bip breve e netto (~880 Hz).
export function beep() {
  const c = getCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = 'sine'
    o.frequency.value = 880
    const t = c.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    o.connect(g).connect(c.destination)
    o.start(t)
    o.stop(t + 0.42)
  } catch {
    /* non bloccante */
  }
}
