// @vitest-environment node
'use strict'

// ── QUANDO IL SERVICE WORKER DEVE FAR VEDERE L'AVVISO ────────────────
//
// public/sw.js è l'ultimo anello: la push arriva lì, e se non chiama
// showNotification sullo schermo non compare niente. Finora non lo provava
// nessuno, e ci si è nascosto dentro un difetto: la notifica «drink pronti»
// veniva saltata se una finestra sulla coda risultava
// `focused || visibilityState === 'visible'`.
//
// L'OR era il controllo più largo possibile. Il fuoco resta alla finestra
// anche a schermo spento, e al banco il tablet sta aperto sulla coda tutta
// la sera: l'avviso spariva senza che nessuno lo vedesse mai. Si guarda la
// VISIBILITÀ, che è la domanda vera — «ce l'hai sotto gli occhi?».

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const sorgente = readFileSync('public/sw.js', 'utf8')

// Un finto service worker: raccoglie gli ascoltatori e le notifiche mostrate.
function avviaSw(finestre = []) {
  const mostrate = []
  const ascoltatori = {}
  const self = {
    addEventListener: (nome, fn) => {
      ascoltatori[nome] = fn
    },
    skipWaiting: () => {},
    location: { origin: 'https://esempio.it' },
    registration: {
      showNotification: (title, opts) => {
        mostrate.push({ title, ...opts })
        return Promise.resolve()
      },
    },
    clients: {
      claim: () => {},
      matchAll: async () => finestre,
    },
  }
  // `caches` e `Response` esistono solo dentro il gestore fetch, che qui non
  // si tocca: bastano dei segnaposto perché il file si carichi.
  new Function('self', 'caches', 'Response', sorgente)(self, undefined, undefined)

  return {
    mostrate,
    async push(data) {
      const attese = []
      await ascoltatori.push({
        data: { json: () => ({ data }) },
        waitUntil: (p) => attese.push(p),
      })
      await Promise.all(attese)
    },
  }
}

const finestra = (url, stato) => ({
  url: `https://esempio.it${url}`,
  focused: stato.focused ?? false,
  visibilityState: stato.visibilityState ?? 'hidden',
})

let sw
beforeEach(() => vi.clearAllMocks())

describe('il drink pronto sullo schermo di chi deve portarlo', () => {
  it('LO SCHERMO SPENTO NON È «CE L’HAI DAVANTI»: la notifica esce', async () => {
    // Il tablet è rimasto aperto sulla coda e il telefono è in tasca: la
    // finestra ha ancora il fuoco, ma nessuno la sta guardando.
    sw = avviaSw([finestra('/bar', { focused: true, visibilityState: 'hidden' })])
    await sw.push({ kind: 'staff_serve', title: '🫱 Pronti', body: 'Ordine #7' })
    expect(sw.mostrate).toHaveLength(1)
    expect(sw.mostrate[0].title).toBe('🫱 Pronti')
  })

  it('col gestionale davvero sotto gli occhi si tace: lì la lista si aggiorna da sola', async () => {
    sw = avviaSw([finestra('/bar', { focused: true, visibilityState: 'visible' })])
    await sw.push({ kind: 'staff_serve', title: '🫱 Pronti', body: 'Ordine #7' })
    expect(sw.mostrate).toHaveLength(0)
  })

  it('con l’app chiusa la notifica esce', async () => {
    sw = avviaSw([])
    await sw.push({ kind: 'staff_serve', title: '🚶 Da consegnare', body: 'Ordine #7' })
    expect(sw.mostrate).toHaveLength(1)
  })

  it('su un’altra schermata esce lo stesso: la coda non la sta guardando nessuno', async () => {
    sw = avviaSw([finestra('/pos', { visibilityState: 'visible' })])
    await sw.push({ kind: 'staff_serve', title: '🫱 Pronti', body: 'Ordine #7' })
    expect(sw.mostrate).toHaveLength(1)
  })

  it('ogni ordine ha la sua riga nel pannello, non si sovrascrivono', async () => {
    sw = avviaSw([])
    await sw.push({ kind: 'staff_serve', order_id: 'o1', title: 'a', body: '' })
    await sw.push({ kind: 'staff_serve', order_id: 'o2', title: 'b', body: '' })
    expect(sw.mostrate.map((n) => n.tag)).toEqual(['staff-serve-o1', 'staff-serve-o2'])
  })
})

describe('la chiamata dal bancone non si salta mai', () => {
  it('esce anche col gestionale davanti: la vibrazione è il punto', async () => {
    sw = avviaSw([finestra('/bar', { focused: true, visibilityState: 'visible' })])
    await sw.push({ kind: 'staff_call', title: '📟 Chiamata', body: 'Vieni' })
    expect(sw.mostrate).toHaveLength(1)
    expect(sw.mostrate[0].requireInteraction).toBe(true)
    expect(sw.mostrate[0].tag).toBe('staff-call')
  })
})

describe('il nuovo ordine al bancone', () => {
  it('esce sempre, anche con la coda in primo piano', async () => {
    // Un avviso in più si chiude; uno in meno è un drink che non parte.
    // Il doppione lo evita il tag, uguale a quello dell'avviso in pagina.
    sw = avviaSw([finestra('/bar', { focused: true, visibilityState: 'visible' })])
    await sw.push({ kind: 'new_order', order_id: 'o9', title: '🆕 Nuovo ordine', body: '' })
    expect(sw.mostrate).toHaveLength(1)
    expect(sw.mostrate[0].tag).toBe('new-order-o9')
  })
})
