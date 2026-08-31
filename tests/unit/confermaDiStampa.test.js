// @vitest-environment happy-dom
'use strict'

// ── SAPERE SE LA CARTA È USCITA (REQ-STAMPA-016, BUG-098) ────────────
//
// Flavio, 28/08/2026: «quando fanno la chiusura cassa, la stampante non
// stampa lo scontrino di chiusura molto spesso». E i fatti: durante la
// serata la stampante stampa SEMPRE, la RISTAMPA della stessa chiusura
// esce subito, e quando non stampa NON compare nessun avviso.
//
// La causa strutturale è una sola: NON SAPEVAMO SE AVESSE STAMPATO. Il
// lavoro si chiudeva quando `prn.send()` era stato CHIAMATO, non quando la
// carta era uscita — e la risposta della stampante (`onreceive`: carta
// finita, coperchio aperto, fuori linea) finiva in una riga di console
// scollegata dal lavoro che l'aveva causata.
//
// Qui si prova LA MACCHINA DELLA CONFERMA, sulla stampante vera simulata,
// perché è l'unico modo di decidere QUANDO risponde e SE risponde:
//   · risposta positiva → riuscita;
//   · risposta di errore → fallita, col motivo in italiano;
//   · nessuna risposta → si ritenta UNA volta e poi ci si arrende;
//   · e — la difesa che conta di più — una stampante che non risponde MAI
//     non deve diventare un impianto che sembra rotto.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Le testine create finora: ogni stretta di mano ne fa una nuova, e
// tenerle in mano è il modo di far arrivare una risposta IN RITARDO da una
// connessione che nel frattempo è stata buttata.
let testine
// Gli invii arrivati alla stampante, in ordine. È la CARTA: se qui non c'è
// niente, al banco non è uscito niente.
let invii
// Chi risponde, e come. `null` = questa stampante tace.
let rispostaPer

function accendiLaStampante() {
  testine = []
  invii = []
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
            // `undefined` vuol dire «questa volta non risponde»: la
            // risposta se la manderà la prova a mano, o mai più.
            if (res) testina.onreceive?.(res)
          },
          onreceive: null,
          ondisconnect: null,
        }
        testine.push(testina)
        cb(testina, 'OK')
      }
      isConnected() {
        return true
      }
    },
  }
}

const OK = { success: true, code: '', status: 0 }
const CARTA_FINITA = { success: false, code: 'EPTR_REC_EMPTY', status: 0 }

const respira = async (giri = 40) => {
  for (let i = 0; i < giri; i++) await Promise.resolve()
}

beforeEach(() => {
  // Il printer è un singleton di modulo (connessione, coda, contatori
  // delle risposte): ogni prova riparte da capo.
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem(
    'tana_printer_v2',
    JSON.stringify({ ip: '10.0.0.9', port: 8043, https: true })
  )
  // La stampante finta risponde sempre e non si può far tacere: qui serve
  // quella vera, che è il solo modo di provare la conferma.
  localStorage.setItem('tana_stampante_finta', 'false')
  rispostaPer = () => OK
  accendiLaStampante()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  delete window.epson
})

// L'ultima voce del registro delle stampe: è lì che al banco si va a
// leggere com'è andata.
async function ultimaVoce() {
  const { statoRegistro } = await import('../../src/lib/registroStampe.js')
  return statoRegistro().voci[0] || null
}

describe('la risposta della stampante chiude il lavoro', () => {
  it('risposta positiva: la stampa è riuscita, e il registro lo dice', async () => {
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    expect(invii).toHaveLength(1)
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('riuscita')
    expect(voce.che).toBe('Prova di stampa')
    expect(voce.tentativi).toBe(1)
  })

  it('risposta di errore: la stampa fallisce, e il motivo è in italiano', async () => {
    rispostaPer = () => CARTA_FINITA
    const P = await import('../../src/lib/printer.js')
    const stampa = P.printTest()
    // Il primo giro fallisce e si ritenta una volta sola: la seconda
    // risposta è ancora «carta finita», e lì ci si ferma.
    await expect(stampa).rejects.toThrow(/la carta è finita/)

    expect(invii).toHaveLength(2) // due giri, non una raffica
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('fallita')
    expect(voce.motivo).toMatch(/la carta è finita/)
    expect(voce.tentativi).toBe(2)
  })

  it('un codice che non conosciamo si scrive per intero, invece di sparire', async () => {
    // Un «errore generico» non si va a cercare sul manuale; un codice sì.
    rispostaPer = () => ({ success: false, code: 'EPTR_QUALCOSA_DI_NUOVO' })
    const P = await import('../../src/lib/printer.js')
    await expect(P.printTest()).rejects.toThrow(/EPTR_QUALCOSA_DI_NUOVO/)
  })

  it('errore al primo giro, carta al secondo: il ritentativo serve a questo', async () => {
    // È il gesto che l'utente fa a mano ristampando dalla lista — si
    // dimentica la connessione, si rifà la stretta di mano, si rimanda —
    // e che si sa già funzionare.
    rispostaPer = (n) => (n === 1 ? CARTA_FINITA : OK)
    const P = await import('../../src/lib/printer.js')
    await P.printTest()
    await respira()

    expect(invii).toHaveLength(2)
    // Stretta di mano rifatta: il secondo foglio è partito da una testina
    // NUOVA, non da quella che aveva appena detto di no.
    expect(testine).toHaveLength(2)
    expect(invii[1].testina).not.toBe(invii[0].testina)
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('riuscita')
    expect(voce.tentativi).toBe(2)
  })
})

describe('la stampante che tace', () => {
  // Perché una prova possa parlare di «silenzio anomalo», questa
  // stampante deve prima aver detto qualcosa: è così che il codice
  // distingue un apparecchio muto di natura da uno che ha smesso di
  // rispondere.
  async function unaStampanteCheParla(P) {
    await P.printTest()
    await respira()
  }

  it('silenzio da una stampante che di solito parla: un ritentativo, e poi basta', async () => {
    const P = await import('../../src/lib/printer.js')
    await unaStampanteCheParla(P)
    expect(P.rispondeDiSolito()).toBe(true)

    rispostaPer = () => undefined // da qui in poi non risponde più
    const stampa = P.printTest()
    // Cinque secondi per la conferma, poi il ritentativo, poi altri cinque.
    await vi.advanceTimersByTimeAsync(5100)
    await respira()
    await vi.advanceTimersByTimeAsync(5100)
    await respira()

    // Due giri e ci si ferma: MAI una raffica.
    expect(invii.slice(1)).toHaveLength(2)
    // E il lavoro NON fallisce: non sappiamo se la carta è uscita, e dirlo
    // per certo sarebbe una bugia in tutte e due le direzioni.
    await expect(stampa).resolves.toBeTruthy()
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('sconosciuta')
    expect(voce.tentativi).toBe(2)
  })

  it('una lenta la prima volta non resta «non confermata» per tutta la serata', async () => {
    // Il conto degli invii funziona finché a ogni invio segue una
    // risposta. Una risposta che non arriva mai lascerebbe quel conto
    // indietro di uno PER SEMPRE, e da lì in poi ogni risposta buona
    // verrebbe scartata come se fosse di un lavoro morto: cinque secondi
    // di attesa a vuoto a ogni stampa, tutta la sera, su una stampante che
    // funziona.
    const P = await import('../../src/lib/printer.js')
    rispostaPer = () => undefined
    const prima = P.printTest()
    await vi.advanceTimersByTimeAsync(5100)
    await respira()
    await prima
    expect((await ultimaVoce()).esito).toBe('sconosciuta')

    // Da qui in poi risponde: la stampa dopo si deve confermare subito,
    // senza aspettare niente.
    rispostaPer = () => OK
    const seconda = P.printTest()
    await respira()
    await expect(seconda).resolves.toMatchObject({ stato: 'riuscita' })
  })

  it('la risposta di un lavoro abbandonato non finisce addosso a quello dopo', async () => {
    const P = await import('../../src/lib/printer.js')
    await unaStampanteCheParla(P)

    // Un lavoro che non riceve risposta: aspetta, ritenta, si arrende.
    rispostaPer = () => undefined
    const abbandonato = P.printTest()
    await vi.advanceTimersByTimeAsync(5100)
    await respira()
    await vi.advanceTimersByTimeAsync(5100)
    await respira()
    await abbandonato
    const vecchia = invii.at(-1).testina

    // Adesso parte un lavoro nuovo, e la stampante di prima si sveglia:
    // manda la risposta di un foglio che nessuno aspetta più. Senza
    // difesa, quel «carta finita» diventerebbe il verdetto di QUESTO
    // lavoro — un avviso a schermo per un guasto che non c'è.
    let rispondiOra = null
    rispostaPer = (_n, testina) => {
      rispondiOra = () => testina.onreceive?.(OK)
      return undefined
    }
    const nuovo = P.printTest()
    await respira()
    vecchia.onreceive?.(CARTA_FINITA)
    await respira()
    rispondiOra()
    await respira()

    await expect(nuovo).resolves.toBeTruthy()
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('riuscita')
  })
})

// ── LA DIFESA CHE CONTA DI PIÙ ───────────────────────────────────────
//
// Passare da «riuscito = inviato» a «riuscito = confermato» su una
// stampante che non conferma MAI — un altro modello, un'altra
// configurazione, un firmware diverso — trasformerebbe un impianto che
// funziona in uno che sembra rotto: un'attesa a vuoto e un avviso a ogni
// stampa, per tutta la sera. Questo è il caso che NON deve succedere.
describe('la stampante che non risponde mai', () => {
  beforeEach(() => {
    rispostaPer = () => undefined
  })

  it('il silenzio non è un fallimento: nessun avviso, e la carta è partita', async () => {
    const P = await import('../../src/lib/printer.js')
    const stampa = P.printTest()
    await vi.advanceTimersByTimeAsync(5100)
    await respira()

    // Un giro solo: senza una risposta MAI vista, non c'è nessuna anomalia
    // da inseguire e ritentare vorrebbe dire un secondo foglio per niente.
    expect(invii).toHaveLength(1)
    await expect(stampa).resolves.toBeTruthy()
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('sconosciuta')
    expect(voce.tentativi).toBe(1)
  })

  it('e dopo tre stampe mute smette pure di aspettarla, come prima di BUG-098', async () => {
    const P = await import('../../src/lib/printer.js')
    for (let giro = 0; giro < 3; giro++) {
      const s = P.printTest()
      await vi.advanceTimersByTimeAsync(5100)
      await respira()
      await s
    }
    expect(P.rispondeDiSolito()).toBe(false)

    // La quarta si chiude sull'invio, senza aspettare niente: nessun
    // orologio da far girare, nessun ritardo aggiunto a una serata di
    // comande. È il comportamento di sempre, tornato da solo.
    const quarta = P.printTest()
    await respira()
    await expect(quarta).resolves.toBeTruthy()
    expect(invii).toHaveLength(4)
    const voce = await ultimaVoce()
    expect(voce.esito).toBe('sconosciuta')
    expect(voce.motivo).toMatch(/non conferma/)
  })

  it('ma se un giorno risponde, quella memoria si corregge da sola', async () => {
    const P = await import('../../src/lib/printer.js')
    for (let giro = 0; giro < 3; giro++) {
      const s = P.printTest()
      await vi.advanceTimersByTimeAsync(5100)
      await respira()
      await s
    }
    expect(P.rispondeDiSolito()).toBe(false)

    // Cambiata la stampante (o riacceso qualcosa), la risposta arriva. Da
    // lì in poi questo terminale torna ad aspettarla.
    rispostaPer = () => OK
    // La conferma non la si aspetta più, ma la risposta arriva lo stesso
    // dentro `send()` ed è quella a rimettere le cose a posto.
    await P.printTest()
    await respira()
    expect(P.rispondeDiSolito()).toBe(true)

    // E DA LÌ SI TORNA AD ASPETTARLA DAVVERO. Qui c'era un difetto vero,
    // trovato rileggendo: gli invii fatti SENZA mettersi in ascolto non
    // venivano contati, e da quel momento i due contatori — invii mandati e
    // risposte tornate — restavano sfasati per sempre. La conseguenza:
    // ogni risposta successiva veniva scartata come «di un lavoro morto», e
    // questa stampante sarebbe rimasta «non confermata» per tutta la
    // serata, aspettando cinque secondi a vuoto a ogni stampa.
    const dopo = P.printTest()
    await respira()
    await expect(dopo).resolves.toMatchObject({ stato: 'riuscita' })
    expect((await ultimaVoce()).esito).toBe('riuscita')
  })
})

describe('la coda con la conferma di mezzo', () => {
  it('un lavoro fallito non blocca il successivo', async () => {
    // Carta finita adesso non vuol dire stampante morta: si cambia il
    // rotolo e la comanda dopo deve uscire.
    let giri = 0
    rispostaPer = () => (++giri <= 2 ? CARTA_FINITA : OK)
    const P = await import('../../src/lib/printer.js')
    const primo = P.printTest()
    const secondo = P.printTest()

    await expect(primo).rejects.toThrow(/carta/)
    await expect(secondo).resolves.toBeTruthy()
    await respira()

    const { statoRegistro } = await import('../../src/lib/registroStampe.js')
    const voci = statoRegistro().voci
    expect(voci[0].esito).toBe('riuscita')
    expect(voci[1].esito).toBe('fallita')
    // E la coda è tornata vuota: nessun lavoro resta appeso.
    expect(statoRegistro().inCorso).toBe(null)
    expect(statoRegistro().inAttesa).toHaveLength(0)
  })

  it('le stampe restano una per volta: la seconda aspetta la conferma della prima', async () => {
    // È il perno di tutto: se due lavori fossero in volo insieme, la
    // risposta che arriva non si potrebbe più attribuire a nessuno dei
    // due senza un identificativo che l'SDK non ci dà.
    let rispondi = null
    rispostaPer = (_n, testina) => {
      rispondi = () => testina.onreceive?.(OK)
      return undefined
    }
    const P = await import('../../src/lib/printer.js')
    const primo = P.printTest()
    const secondo = P.printTest()
    await respira()

    expect(invii).toHaveLength(1) // la seconda è ferma in coda
    rispondi()
    await respira()
    await primo
    rispondi()
    await respira()
    await secondo
    expect(invii).toHaveLength(2)
  })
})
