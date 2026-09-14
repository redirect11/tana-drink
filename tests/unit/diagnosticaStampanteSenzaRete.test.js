// @vitest-environment happy-dom
'use strict'

// ── IL DIARIO DELLA STAMPANTE ARRIVA SUL SERVER, SENZA RETE (REQ-STAMPA-019) ──
//
// Qui si prova la strada intera: la stampante che non si collega, una
// stampa che non parte, il pallino che diventa rosso, la cassa che si
// apre — e dall'altra parte la scrittura su Firestore com'è composta
// davvero da api.js. Si mocka SOLO Firestore, con ogni scrittura appesa
// per sempre: è così che va con la rete del locale che «risulta collegata
// ma non passa», ed è proprio la sera in cui il diario serve. Niente
// deve aspettare niente.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mai = () => new Promise(() => {})
const stato = { scritture: [] }

vi.mock('../../src/lib/firebaseClient.js', () => ({
  db: {},
  auth: { currentUser: { uid: 'u1' } },
  functions: {},
  storage: {},
}))

vi.mock('firebase/firestore', () => ({
  collection: (_db, nome) => ({ __col: nome }),
  doc: (...args) => {
    if (args.length >= 3) return { col: args[1], id: args[2] }
    if (args.length === 2) return { col: args[0]?.__col || 'x', id: args[1] }
    return { col: args[0]?.__col || 'x', id: 'id-nuovo' }
  },
  getDoc: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocFromCache: vi.fn(async () => ({ exists: () => false, data: () => ({}) })),
  getDocs: vi.fn(async () => ({ docs: [] })),
  getDocsFromCache: vi.fn(async () => ({ docs: [] })),
  addDoc: vi.fn(() => mai()),
  setDoc: vi.fn((ref, data, opts) => {
    stato.scritture.push({ col: ref?.col, id: ref?.id, data, opts })
    return mai()
  }),
  updateDoc: vi.fn(() => mai()),
  deleteDoc: vi.fn(() => mai()),
  query: () => ({}),
  where: () => ({}),
  documentId: () => 'id',
  orderBy: () => ({}),
  limit: () => ({}),
  onSnapshot: () => () => {},
  serverTimestamp: () => null,
  increment: (n) => ({ __increment: n }),
  arrayUnion: (...v) => ({ __arrayUnion: v }),
  writeBatch: () => ({ update: vi.fn(), set: vi.fn(), commit: () => mai() }),
  Timestamp: class Timestamp {
    static fromDate(d) {
      return d
    }
    static fromMillis(m) {
      return m
    }
  },
}))

const api = await import('../../src/lib/api.js')
const { azzeraDiagnostica, COLLEZIONE } = await import('../../src/lib/diagnosticaStampante.js')
const printer = await import('../../src/lib/printer.js')
const registro = await import('../../src/lib/registroStampe.js')
const { controllaStampante } = await import('../../src/lib/statoStampante.js')
const { idDispositivo } = await import('../../src/lib/dispositivo.js')

const diario = () => stato.scritture.filter((s) => s.col === COLLEZIONE)
const eventi = () => diario().map((s) => s.data.eventi.__arrayUnion[0])

beforeEach(() => {
  stato.scritture = []
  localStorage.clear()
  azzeraDiagnostica()
  registro.dimenticaTuttoIlRegistro()
  // Serve la stampante vera: la finta risponde sempre.
  localStorage.setItem('tana_stampante_finta', 'false')
  printer.savePrinterSettings({ ip: '192.168.1.4', port: 8043, https: true })
  printer.disconnectPrinter()
})

// Una stampante che rifiuta la stretta di mano: è la sera dell'IP cambiato.
function stampanteChePerdeLaStrettaDiMano(esito = 'SSL_CONNECT_FAILED') {
  window.epson = {
    ePOSDevice: class {
      constructor() {
        this.DEVICE_TYPE_PRINTER = 'printer'
      }
      connect(_ip, _porta, cb) {
        cb(esito)
      }
      isConnected() {
        return false
      }
      disconnect() {}
    },
  }
}

describe('la scrittura, com’è composta da api.js', () => {
  it('un documento per serata e terminale, eventi accodati e contati, senza rileggere', async () => {
    stampanteChePerdeLaStrettaDiMano()
    const r = await printer.preparaStampante()
    expect(r.ok).toBe(false)
    const [prima] = diario()
    expect(prima.id).toMatch(new RegExp(`^giorno-\\d{4}-\\d{2}-\\d{2}--${idDispositivo()}$`))
    expect(prima.opts).toEqual({ merge: true })
    expect(prima.data.n_eventi).toEqual({ __increment: 1 })
    expect(prima.data.dispositivo).toBe(idDispositivo())
    expect(prima.data.stampante).toEqual({ ip: '192.168.1.4', port: 8043, https: true })
    expect(prima.data.eventi.__arrayUnion[0]).toMatchObject({
      tipo: 'collegamento_fallito',
      motivo: 'Connessione fallita (SSL_CONNECT_FAILED)',
      ip: '192.168.1.4',
      dettagli: { porta: 8043 },
    })
  })
})

describe('chi scrive nel diario', () => {
  it('una stampa che non parte: cosa era, e perché', () => {
    const id = registro.lavoroInCoda('Scontrino conto #42')
    registro.lavoroNonPartito(id, 'la stampante non ha risposto entro 15 secondi')
    expect(eventi()).toContainEqual(
      expect.objectContaining({
        tipo: 'stampa_fallita',
        motivo: 'la stampante non ha risposto entro 15 secondi',
        dettagli: { che: 'Scontrino conto #42' },
      })
    )
  })

  it('una risposta negativa arrivata dopo: la stessa riga, dall’esito', () => {
    const id = registro.lavoroInCoda('Chiusura di cassa')
    registro.lavoroInviato(id)
    registro.aggiornaEsito(id, 'fallita', 'la carta è finita')
    expect(eventi().at(-1)).toMatchObject({ tipo: 'stampa_fallita', motivo: 'la carta è finita', dettagli: { che: 'Chiusura di cassa' } })
  })

  it('il pallino: il passaggio a rosso, non ogni controllo', async () => {
    stampanteChePerdeLaStrettaDiMano('ERROR_TIMEOUT')
    await controllaStampante()
    await controllaStampante()
    const rossi = eventi().filter((e) => e.tipo === 'pallino_ko')
    expect(rossi).toHaveLength(1)
    expect(rossi[0].motivo).toMatch(/Connessione fallita \(ERROR_TIMEOUT\)/)
  })

  it('l’apertura di cassa apre la serata del diario, con l’indirizzo in uso', () => {
    const id = api.openCashSession({ by: 'u1' })
    const [riga] = diario()
    expect(riga.id).toBe(`cassa-${id}--${idDispositivo()}`)
    expect(riga.data.sessione_id).toBe(id)
    expect(riga.data.eventi.__arrayUnion[0]).toMatchObject({ tipo: 'apertura_cassa', ip: '192.168.1.4' })
  })
})
