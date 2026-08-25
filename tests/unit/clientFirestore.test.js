// IL CLIENT REST DEGLI SCRIPT, E L'EMULATORE.
//
// Gli script che scrivono sull'emulatore (carica-su-emulatore,
// copia-magazzino-da-test, diagnosi-travaso) si erano riscritti ognuno il
// proprio client REST: tre copie di «commit», «elenca» e paginazione, con
// dentro tre volte il limite dei 200 per commit. Una copia che dimentica quel
// limite non fallisce subito: fallisce quando il magazzino supera i 200
// articoli, cioe' esattamente quando serve.
//
// Adesso il client e' uno solo e cambia indirizzo: qui si prova che sappia
// parlare tanto con Firestore vero quanto con l'emulatore, e che il limite dei
// 200 e la paginazione restino dove stanno — in un posto solo.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { client, clientEmulatore, idDi } from '../../scripts/lib-firestore.js'

function rispondi(...risposte) {
  const chiamate = []
  const finto = vi.fn(async (url, opts = {}) => {
    chiamate.push({ url, opts })
    const corpo = risposte.length > 1 ? risposte.shift() : risposte[0]
    return { json: async () => corpo }
  })
  vi.stubGlobal('fetch', finto)
  return chiamate
}

afterEach(() => vi.unstubAllGlobals())

describe('il client REST degli script', () => {
  it('di suo parla con Firestore vero, in nome del progetto chiesto', async () => {
    const chiamate = rispondi({ documents: [] })
    await client('tana-drink-test', 'TOK').documenti('inventory_items')
    expect(chiamate[0].url).toContain('https://firestore.googleapis.com/v1/')
    expect(chiamate[0].url).toContain('projects/tana-drink-test/databases/(default)/documents')
    expect(chiamate[0].opts.headers.Authorization).toBe('Bearer TOK')
  })

  it("sull'emulatore cambiano indirizzo e parola d'ordine, non le chiamate", async () => {
    const chiamate = rispondi({ documents: [] })
    const emulatore = clientEmulatore('localhost:8081')
    expect(emulatore.radice).toBe('projects/demo-tana-drink/databases/(default)/documents')
    await emulatore.documenti('inventory_items')
    expect(chiamate[0].url.startsWith('http://localhost:8081/v1/')).toBe(true)
    // «owner» e' la parola che l'emulatore riconosce come «sono l'admin»:
    // senza, le regole di sicurezza fermano anche le scritture di servizio.
    expect(chiamate[0].opts.headers.Authorization).toBe('Bearer owner')
  })

  it('chiedendo i soli id non si scarica il magazzino intero', async () => {
    const chiamate = rispondi({ documents: [] })
    await clientEmulatore('localhost:8081').documenti('inventory_items', { campi: ['__name__'] })
    expect(chiamate[0].url).toContain('mask.fieldPaths=__name__')
  })

  it('la paginazione va avanti finche’ c’e’ un pageToken', async () => {
    const chiamate = rispondi(
      { documents: [{ name: 'a/b/uno' }], nextPageToken: 'ANCORA' },
      { documents: [{ name: 'a/b/due' }] }
    )
    const docs = await clientEmulatore('localhost:8081').documenti('inventory_items')
    expect(docs.map(idDi)).toEqual(['uno', 'due'])
    expect(chiamate[1].url).toContain('pageToken=ANCORA')
  })

  it('le scritture si spezzano a 200 per volta, ovunque punti il client', async () => {
    const chiamate = rispondi({})
    const emulatore = clientEmulatore('localhost:8081')
    const writes = Array.from({ length: 450 }, (_, i) =>
      emulatore.scriviDoc('inventory_items', `art-${i}`, { name: { stringValue: 'x' } })
    )
    await emulatore.commit(writes)
    expect(chiamate.length).toBe(3)
    expect(JSON.parse(chiamate[0].opts.body).writes.length).toBe(200)
    expect(JSON.parse(chiamate[2].opts.body).writes.length).toBe(50)
    expect(chiamate[0].url).toBe(
      'http://localhost:8081/v1/projects/demo-tana-drink/databases/(default)/documents:commit'
    )
  })

  it('un errore di Firestore si vede subito, non finisce in un elenco vuoto', async () => {
    rispondi({ error: { status: 'PERMISSION_DENIED', message: 'niente da fare' } })
    await expect(clientEmulatore('localhost:8081').documenti('inventory_items')).rejects.toThrow(
      /PERMISSION_DENIED/
    )
  })
})
