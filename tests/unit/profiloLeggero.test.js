// @vitest-environment happy-dom
'use strict'

// IL PROFILO LEGGERO (REQ-LIC-004). Un locale Free è pubblicato con le sole
// regole di Firestore e il sito: le Functions dell'app e il bucket di
// Storage non ci sono. L'app non deve andarli a chiamare — una Function che
// non c'è risponde «not-found» dopo un giro di rete, e quell'errore finisce
// a schermo — né scaricare la colpa su chi la usa.
//
// I comandi sono nascosti nelle schermate; qui si prova la cintura sotto:
// i tre posti da cui passano tutte le chiamate (staffAdmin, i pagamenti
// SumUp, Storage). E la Tana, che le Functions le ha, chiama come sempre.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const chiamate = []
vi.mock('firebase/functions', () => ({
  httpsCallable: (_f, nome) => (data) => {
    chiamate.push({ nome, data })
    return Promise.resolve({ data: nome === 'staffAdmin' ? { users: [{ uid: 'u1', role: 'staff' }] } : { ok: true } })
  },
}))
const storage = { upload: vi.fn(), cancella: vi.fn() }
vi.mock('firebase/storage', () => ({
  ref: (_s, percorso) => ({ percorso }),
  uploadBytes: (...a) => {
    storage.upload(...a)
    return Promise.resolve()
  },
  getDownloadURL: () => Promise.resolve('https://bucket.example/foto.jpg'),
  deleteObject: (...a) => {
    storage.cancella(...a)
    return Promise.resolve()
  },
}))
vi.mock('../../src/lib/firebaseClient.js', () => ({ functions: {}, storage: {} }))

import { listStaff, listUtenti, createStaff } from '../../src/lib/staffApi.js'
import { readerCheckout, createPaymentCheckout, pairSumUpReader } from '../../src/lib/paymentsApi.js'
import { uploadDrinkImage, deleteDrinkImageByUrl, caricaAllegatoFattura, eliminaAllegato } from '../../src/lib/storage.js'

// Le impostazioni come le lascia subscribeSettings nella memoria del
// terminale: è da lì che i wrapper sanno su che installazione sono.
const ricorda = (dati) => localStorage.setItem('drink:impostazioni', JSON.stringify(dati))
const FREE = { licenza: { piano: 'free', moduli: {}, limiti: { utenti_max: 1, marchio: true } } }

// Senza tipo d'immagine: il ridimensionamento nel browser (canvas) qui non
// c'è, e la foto parte com'è.
const foto = () => new File(['x'], 'drink.bin', { type: 'application/octet-stream' })

beforeEach(() => {
  localStorage.clear()
  chiamate.length = 0
  storage.upload.mockClear()
  storage.cancella.mockClear()
})

describe('sul profilo leggero (piano Free)', () => {
  beforeEach(() => ricorda(FREE))

  it('staffAdmin non si chiama: lo staff è vuoto, c’è solo il titolare', async () => {
    expect(await listStaff()).toEqual([])
    expect(await listUtenti()).toEqual([])
    await expect(createStaff({ email: 'a@b.it', password: 'segreta', role: 'staff', name: 'A' })).rejects.toThrow(
      'Nel piano Free l’app la usa solo il titolare.'
    )
    expect(chiamate).toEqual([])
  })

  it('le Functions di SumUp non si chiamano: si risponde «non disponibile»', async () => {
    expect(await readerCheckout('o1', { amount: 5 })).toEqual({ unavailable: true })
    expect(await createPaymentCheckout('o1')).toEqual({ unavailable: true })
    expect(await pairSumUpReader('ABCD')).toEqual({ unavailable: true })
    expect(chiamate).toEqual([])
  })

  it('Storage non si tocca: niente caricamenti, niente cancellazioni', async () => {
    await expect(uploadDrinkImage(foto())).rejects.toThrow('Le foto dei prodotti sono dei piani a pagamento.')
    await expect(caricaAllegatoFattura('f1', foto())).rejects.toThrow('piani a pagamento')
    await deleteDrinkImageByUrl('https://bucket.example/vecchia.jpg')
    await eliminaAllegato('fatture/f1/doc.pdf')
    expect(storage.upload).not.toHaveBeenCalled()
    expect(storage.cancella).not.toHaveBeenCalled()
  })
})

describe('la Tana, senza licenza, chiama come sempre', () => {
  it('staffAdmin e i pagamenti passano dalle Functions', async () => {
    ricorda({ workflow_enabled: true })
    expect(await listStaff()).toEqual([{ uid: 'u1', role: 'staff' }])
    await readerCheckout('o1', { amount: 5 })
    expect(chiamate.map((c) => c.nome)).toEqual(['staffAdmin', 'readerCheckout'])
  })

  it('anche su un dispositivo che le impostazioni non le ha ancora viste', async () => {
    await listStaff()
    expect(chiamate.map((c) => c.nome)).toEqual(['staffAdmin'])
  })

  it('e le foto vanno su Storage', async () => {
    const url = await uploadDrinkImage(foto())
    expect(url).toBe('https://bucket.example/foto.jpg')
    expect(storage.upload).toHaveBeenCalledTimes(1)
    await deleteDrinkImageByUrl(url)
    expect(storage.cancella).toHaveBeenCalledTimes(1)
  })
})
