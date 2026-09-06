// @vitest-environment happy-dom
'use strict'

// ── SE LA STAMPANTE È VIVA LO DICE LEI (BUG-102) ─────────────────────
//
// La sera del 05/09/2026 la stampante ha smesso di stampare TUTTO: non solo
// la chiusura di cassa — anche le ristampe di chiusure vecchie, cioè fogli
// già pronti. E il pallino in alto è rimasto verde per tutto il tempo.
//
// PERCHÉ IL VERDE MENTIVA. La vita del collegamento si chiedeva a
// `isConnected()` dell'SDK Epson, che risponde di sì anche quando sta solo
// PROVANDO a riconnettersi. Quindi il battito non scattava, l'oggetto
// stampante restava in memoria, il controllo di stato lo trovava e diceva
// «ok», e ogni invio finiva in un collegamento che non c'era più: nessun
// errore, nessun blocco, nessuna carta.
//
// LA CURA: si smette di chiedere all'SDK e si ascolta la STAMPANTE, che
// quei fatti li dice da sé (`startMonitor` + `onpoweroff` / `onoffline` /
// `ononline` / coperchio / carta). L'app non ascoltava nessuno di questi.
//
// Questi test guardano la cosa dal lato del DANNO: che il collegamento
// morto venga mollato, che qualcuno lo venga a sapere, e — la parte che
// vale quanto le altre — che nessuna di queste aggiunte possa fermare una
// stampa o sballare il registro.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Le testine create finora: ogni stretta di mano ne fa una nuova, quindi
// contarle è il modo di sapere se il collegamento è stato rifatto.
let testine
let invii
let rispostaPer
// Come si comporta `startMonitor` della testina: normalmente si accende,
// ma un firmware vecchio lancia — e in quel caso si deve stampare uguale.
let monitorRotto

function accendiLaStampante() {
  testine = []
  invii = []
  monitorRotto = false
  window.epson = {
    ePOSDevice: class {
      constructor() {
        this.DEVICE_TYPE_PRINTER = 'printer'
      }
      connect(_ip, _porta, cb) {
        cb('OK')
      }
      createDevice(_nome, _tipo, _opzioni, cb) {
        const testina = {
          ALIGN_LEFT: 'l', ALIGN_CENTER: 'c', ALIGN_RIGHT: 'r',
          COLOR_1: 1, CUT_FEED: 1,
          addTextLang: () => {}, addTextSmooth: () => {}, addTextAlign: () => {},
          addTextSize: () => {}, addTextStyle: () => {}, addText: () => {},
          addFeedLine: () => {}, addCut: () => {}, addImage: () => {},
          addImageUrl: () => {}, clearCommandBuffer: () => {},
          send: () => {
            invii.push({ testina })
            const res = rispostaPer(invii.length, testina)
            if (res) testina.onreceive?.(res)
          },
          // Il monitor vero è una domanda lunga alla stampante. Qui basta
          // sapere se è stato acceso, con che intervallo, e se è stato
          // spento quando il collegamento è stato mollato: un poller
          // lasciato acceso su una testina buttata è traffico verso una
          // stampante per conto di nessuno.
          monitorAcceso: false,
          startMonitor() {
            if (monitorRotto) throw new Error('firmware senza monitor')
            this.monitorAcceso = true
            return true
          },
          stopMonitor() {
            this.monitorAcceso = false
            return true
          },
          onreceive: null,
          ondisconnect: null,
        }
        testine.push(testina)
        cb(testina, 'OK')
      }
      isConnected() {
        // IL PUNTO DI TUTTA LA FACCENDA: l'SDK dice sempre di sì. È quello
        // che faceva davvero mentre non usciva niente.
        return true
      }
    },
  }
}

const OK = { success: true, code: '', status: 0 }
const respira = async (giri = 40) => {
  for (let i = 0; i < giri; i++) await Promise.resolve()
}
const ultima = () => testine[testine.length - 1]

beforeEach(() => {
  // Il printer è un singleton di modulo: ogni prova riparte da capo.
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem(
    'tana_printer_v2',
    JSON.stringify({ ip: '10.0.0.9', port: 8043, https: true })
  )
  // Serve quella vera: la finta risponde sempre, e qui il punto è proprio
  // decidere se e quando risponde.
  localStorage.setItem('tana_stampante_finta', 'false')
  rispostaPer = () => OK
  accendiLaStampante()
  window.Image = class {
    set src(_v) {
      queueMicrotask(() => this.onerror?.(new Error('404')))
    }
  }
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete window.epson
})

async function avvisi() {
  const { subscribeNotifs } = await import('../../src/lib/notifyStore.js')
  let stato = null
  subscribeNotifs((s) => {
    stato = s
  })()
  return stato.tutte
}

describe('la stampante viene interrogata, e quello che dice si ascolta', () => {
  it('il monitor si accende alla stretta di mano, ogni dieci secondi', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    expect(ultima().monitorAcceso).toBe(true)
    expect(ultima().interval).toBe(10000)
  })

  it('un firmware che non lo sostiene non impedisce di stampare', async () => {
    monitorRotto = true
    const P = await import('../../src/lib/printer.js')

    // L'eccezione di `startMonitor` non deve arrivare alla carta: resta la
    // rete degli invii senza risposta, e il foglio esce.
    await P.printTest()
    await respira()
    expect(invii).toHaveLength(1)
  })
})

describe('quando smette di rispondere, il collegamento si molla', () => {
  it('«non rispondo più»: la stampa dopo rifà la stretta di mano', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()
    const prima = ultima()
    expect(testine).toHaveLength(1)

    // È la stampante a dirlo, non l'SDK — che qui continua a giurare che
    // il collegamento è su.
    prima.onpoweroff()
    await respira()

    await P.printTest()
    await respira()

    // Collegamento nuovo: prima si continuava a parlare a quello morto.
    expect(testine).toHaveLength(2)
    expect(invii[1].testina).toBe(ultima())
  })

  it('e il monitor di quello vecchio si spegne', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()
    const prima = ultima()

    prima.onpoweroff()
    await respira()

    // Un poller lasciato acceso su una testina buttata interrogherebbe la
    // stampante per conto di un collegamento che non esiste più, e ogni
    // riconnessione ne lascerebbe indietro un altro.
    expect(prima.monitorAcceso).toBe(false)
  })

  it('lo viene a sapere chi sta lavorando', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    ultima().onpoweroff()
    await respira()

    const tutti = await avvisi()
    expect(tutti[0].body).toContain('non risponde')
  })

  it('il pallino smette di dire che va tutto bene', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    ultima().onpoweroff()
    await respira()

    // Prima qui usciva `ok: true` per il solo fatto che in memoria c'era un
    // oggetto stampante: è il verde che non voleva dire niente.
    expect(P.guastoStampante()).toBe('la stampante non risponde')
  })

  it('e quando torna, il verde torna con lei', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    ultima().onpoweroff()
    await respira()
    // La testina buttata non serve più: si riparte, e la stampante nuova
    // dice che c'è.
    await P.printTest()
    await respira()
    ultima().ononline()

    expect(P.guastoStampante()).toBe(null)
  })
})

describe('un guaio della carta non è un collegamento morto', () => {
  // Carta finita, coperchio aperto, fuori linea: la stampante ci PARLA, il
  // collegamento è buono. Buttarlo vorrebbe dire una riconnessione inutile
  // nel mezzo del servizio.
  for (const [evento, atteso] of [
    ['onpaperend', 'la carta è finita'],
    ['oncoveropen', 'il coperchio della stampante è aperto'],
    ['onoffline', 'la stampante è fuori linea'],
  ]) {
    it(`${evento}: si avvisa, ma il collegamento resta`, async () => {
      const P = await import('../../src/lib/printer.js')
      await P.printTest()
      await respira()
      const prima = ultima()

      prima[evento]()
      await respira()
      expect(P.guastoStampante()).toBe(atteso)

      await P.printTest()
      await respira()
      expect(testine).toHaveLength(1)
      expect(invii[1].testina).toBe(prima)
    })
  }

  it('e la carta che torna a uscire chiude il guaio', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()
    ultima().onpaperend()
    await respira()
    expect(P.guastoStampante()).toBe('la carta è finita')

    // Una risposta buona è la prova che la carta c'è: l'ha appena stampata.
    await P.printTest()
    await respira()
    expect(P.guastoStampante()).toBe(null)
  })
})

describe('tre invii che nessuno raccoglie sono una strada chiusa', () => {
  // La rete per quando il monitor non c'è: firmware vecchio, o la domanda
  // lunga bloccata dal browser.
  it('uno solo no: «non lo sappiamo» resta la risposta onesta', async () => {
    rispostaPer = () => undefined
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    await vi.advanceTimersByTimeAsync(6000)
    await respira()

    expect(P.guastoStampante()).toBe(null)
    expect(await avvisi()).toHaveLength(0)
  })

  it('tre di fila sì: si molla e si dice', async () => {
    rispostaPer = () => undefined
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await P.printTest()
    await P.printTest()
    await respira()
    expect(invii).toHaveLength(3)

    await vi.advanceTimersByTimeAsync(6000)
    await respira()

    expect(P.guastoStampante()).toBe('la stampante non risponde')
    expect((await avvisi())[0].body).toContain('non risponde')

    // E il collegamento è stato mollato: la stampa dopo ne apre uno nuovo.
    rispostaPer = () => OK
    await P.printTest()
    await respira()
    expect(testine).toHaveLength(2)
  })

  it('il conto riparte con la strada nuova', async () => {
    // Senza azzerarlo, il primo silenzio del collegamento nuovo lo farebbe
    // mollare di nuovo dopo un solo foglio.
    rispostaPer = () => undefined
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await P.printTest()
    await P.printTest()
    await vi.advanceTimersByTimeAsync(6000)
    await respira()
    expect(testine).toHaveLength(1)

    await P.printTest()
    await respira()
    await vi.advanceTimersByTimeAsync(6000)
    await respira()

    // Un foglio muto sul collegamento nuovo: uno solo, quindi non si molla.
    expect(testine).toHaveLength(2)
  })
})

describe('e niente di tutto questo rompe quello che c’era', () => {
  it('gli eventi di stato non contano come risposte di stampa', async () => {
    // Il monitor passa da una strada sua e NON alza `onreceive`: se lo
    // facesse, il conto invii/risposte si sfaserebbe e ogni esito nel
    // registro finirebbe sul foglio sbagliato.
    let rispondi = null
    rispostaPer = (_n, testina) => {
      rispondi = () => testina.onreceive?.(OK)
      return undefined
    }
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    ultima().onpaperend()
    ultima().ononline()
    await respira()

    rispondi()
    await respira()

    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    const voci = statoRegistro().voci
    expect(voci).toHaveLength(1)
    expect(voci[0].esito).toBe('riuscita')
  })

  it('lo stesso guaio non fa una valanga di avvisi', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    // Col monitor acceso una stampante spenta lo direbbe ogni dieci
    // secondi: sei strisce identiche al minuto sono il modo migliore per
    // smettere di leggerle.
    ultima().onpaperend()
    ultima().onpaperend()
    ultima().onpaperend()
    await respira()

    expect(await avvisi()).toHaveLength(1)
  })

  it('nessuna stampa aspetta il monitor', async () => {
    const P = await import('../../src/lib/printer.js')
    let finita = false
    const stampa = P.printTest().then(() => {
      finita = true
    })
    await respira()

    // Nessun orologio fatto girare: il foglio è partito e il gesto è
    // chiuso, come prima di tutta questa storia.
    expect(invii).toHaveLength(1)
    expect(finita).toBe(true)
    await stampa
  })
})
