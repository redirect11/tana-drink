// @vitest-environment happy-dom
'use strict'

// LE NOTIFICHE: DA LEGGERE E LETTE. La campanella mostra solo quello che c'è
// ancora da leggere — in mezz'ora di servizio un elenco che non si svuota mai
// diventa un muro di righe vecchie, e non ci si guarda più: che è il modo
// migliore per non accorgersi di quella che conta. Le lette non si buttano:
// restano nello storico, perché «cos'era quell'avviso di prima?» è una
// domanda che si fa davvero.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Il modulo tiene lo stato in memoria e lo rilegge da localStorage
// all'import: per ogni prova serve ricaricato da zero.
async function store() {
  localStorage.clear()
  vi.resetModules()
  return import('../../src/lib/notifyStore.js')
}

describe('notifiche da leggere e storico', () => {
  let s
  beforeEach(async () => {
    s = await store()
  })

  it('una notifica nuova sta fra quelle da leggere', () => {
    s.recordNotif('Nuovo ordine', '#12')
    const snap = leggiSnapshot(s)
    expect(snap.items).toHaveLength(1)
    expect(snap.unseen).toBe(1)
    expect(snap.archivio).toHaveLength(0)
  })

  it('letta: sparisce dall’elenco e resta nello storico', () => {
    s.recordNotif('Nuovo ordine', '#12')
    const { items } = leggiSnapshot(s)
    s.segnaLetta(items[0].id)
    const snap = leggiSnapshot(s)
    expect(snap.items).toHaveLength(0)
    expect(snap.unseen).toBe(0)
    expect(snap.archivio).toHaveLength(1)
    expect(snap.archivio[0].title).toBe('Nuovo ordine')
  })

  // Il box delle novità l'hai appena visto: la traccia serve, l'avviso no.
  it('può nascere già letta: va dritta nello storico', () => {
    s.recordNotif('App aggiornata', 'ecco cosa cambia', { letta: true })
    const snap = leggiSnapshot(s)
    expect(snap.items).toHaveLength(0)
    expect(snap.archivio).toHaveLength(1)
  })

  it('segna tutte lette svuota l’elenco in un colpo', () => {
    s.recordNotif('Uno')
    s.recordNotif('Due')
    s.segnaTutteLette()
    const snap = leggiSnapshot(s)
    expect(snap.items).toHaveLength(0)
    expect(snap.archivio).toHaveLength(2)
  })

  // Buttare via un avviso che nessuno ha ancora guardato non è fare pulizia.
  it('svuotando lo storico, quelle da leggere restano', () => {
    s.recordNotif('Letta', '', { letta: true })
    s.recordNotif('Da leggere')
    s.svuotaArchivio()
    const snap = leggiSnapshot(s)
    expect(snap.archivio).toHaveLength(0)
    expect(snap.items.map((n) => n.title)).toEqual(['Da leggere'])
  })

  it('la destinazione si conserva: una notifica può essere una porta', () => {
    s.recordNotif('App aggiornata', 'tocca', { href: '/bar?tab=impostazioni' })
    expect(leggiSnapshot(s).items[0].href).toBe('/bar?tab=impostazioni')
  })
})

// Le notifiche salvate dalla versione precedente non hanno il campo `letta`.
describe('notifiche salvate prima', () => {
  it('quelle vecchie non tornano a galla come da leggere', async () => {
    localStorage.setItem(
      'tana:notifs',
      JSON.stringify([{ id: 'vecchia', title: 'Di ieri', body: '', at: 1 }])
    )
    vi.resetModules()
    const mod = await import('../../src/lib/notifyStore.js')
    const snap = leggiSnapshot(mod)
    expect(snap.items).toHaveLength(0)
    expect(snap.archivio).toHaveLength(1)
  })
})

function leggiSnapshot(mod) {
  let snap = null
  const stop = mod.subscribeNotifs((s) => {
    snap = s
  })
  stop()
  return snap
}
