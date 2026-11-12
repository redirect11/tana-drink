/* global __DEMO__ */
// ── I LIMITI DEL PIANO FREE, E IL PROFILO LEGGERO (REQ-LIC-003, REQ-LIC-004)
//
// La regia (drink-regia) scrive nella licenza (`licenza/attuale`, BUG-125),
// accanto a `piano` e `moduli`, la voce `limiti`:
//
//   { prodotti_max: 10, conti_aperti_max: 5, sconti: false,
//     storico_giorni: 7, utenti_max: 1, marchio: true, stampa: false }
//
// per il piano Free, e `null` per i piani a pagamento.
//
// LA REGOLA CHE CONTA: SENZA `limiti`, NESSUN LIMITE. Voce assente, `null`
// o di forma sbagliata vuol dire che l'app lavora come ha sempre lavorato.
// È il caso della Tana, la cui licenza (scritta nella sua build) non ha
// limiti, e non deve accorgersi di niente: ogni domanda qui sotto, senza
// limiti, risponde «sì, come prima». Un limite non è mai il comportamento
// di partenza. Lo stesso vale per ogni singola chiave: un `prodotti_max`
// mancante non limita i prodotti.
//
// IL PROFILO LEGGERO. Un locale Free è pubblicato con le sole regole di
// Firestore e il sito (`firebase deploy --only firestore,hosting`): niente
// Functions, niente Storage, perché sono quello che costa anche da fermo.
// L'app lo capisce da `licenza.piano === 'free'`, oppure da una variabile
// di build (`VITE_PROFILO=leggero`) che la regia può passare se un giorno
// pubblicasse leggero un piano diverso.
//
// ⚠️ COME PER I MODULI (lib/licenza.js), IL LIMITE NASCONDE, NON PROTEGGE:
// è l'app che non lascia fare. La licenza non si riscrive più dall'app
// (BUG-125), e le regole di Firestore fanno rispettare gli sconti
// (REQ-LIC-008); i numeri massimi (prodotti, conti aperti) no, perché
// andrebbero contati sul server.
//
// Logica pura: le impostazioni si passano (sono quelle già in mano a chi
// chiama, dalla cache: niente letture nuove, vedi il local-first).

import { NOME_PRODOTTO } from './prodotto.js'
import { impostazioniRicordate, licenzaRicordata } from './impostazioniLocali.js'
import { licenzaDi } from './licenzaInVigore.js'

export const PIANO_FREE = 'free'

// I limiti scritti nella licenza, o null: null vuol dire «nessun limite».
export function limitiDi(stato) {
  const l = licenzaDi(stato)?.limiti
  return l && typeof l === 'object' && !Array.isArray(l) ? l : null
}

// Un limite numerico, o null se non c'è (o non è un numero sensato): un
// valore illeggibile non diventa un limite a zero.
function tetto(stato, chiave) {
  const v = limitiDi(stato)?.[chiave]
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

export const pianoFree = (stato) => licenzaDi(stato)?.piano === PIANO_FREE

const BUILD_LEGGERA = import.meta.env?.VITE_PROFILO === 'leggero'

// Niente Functions e niente Storage su questa installazione. La demo è
// sempre leggera (REQ-FLOTTA-019): non chiama nessun servizio, e le
// schermate nascondono i tasti che li userebbero (lettore SumUp, foto,
// gestione delle utenze) come per un locale Free.
export const profiloLeggero = (stato) => BUILD_LEGGERA || Boolean(__DEMO__) || pianoFree(stato)

// La stessa domanda per chi non ha le impostazioni in mano (i wrapper delle
// Functions e di Storage): l'ultima verità nota, ricordata da
// subscribeSettings. Al primo avvio di un dispositivo nuovo, prima che le
// impostazioni arrivino, non si sa: si lavora come sempre, e la chiamata
// che non trova la Function fallisce come fallirebbe offline.
export const senzaFunctions = () => profiloLeggero(impostazioniRicordate({}))

// ── I SINGOLI LIMITI ──────────────────────────────────────────────────

export const maxProdotti = (stato) => tetto(stato, 'prodotti_max')
export const maxContiAperti = (stato) => tetto(stato, 'conti_aperti_max')
export const giorniDiStorico = (stato) => tetto(stato, 'storico_giorni')
export const maxUtenti = (stato) => tetto(stato, 'utenti_max')

// Un prodotto nuovo nel menù, con `quanti` già in carta? Quelli che ci sono
// restano tutti: il limite ferma solo la creazione.
export function puoCreareProdotto(stato, quanti) {
  const max = maxProdotti(stato)
  return max == null || (Number(quanti) || 0) < max
}

// Un conto nuovo, con `aperti` conti già aperti in questo momento?
export function puoAprireConto(stato, aperti) {
  const max = maxContiAperti(stato)
  return max == null || (Number(aperti) || 0) < max
}

// Sconti, omaggi e maggiorazioni sul conto. Solo un `false` scritto li
// spegne.
export const scontiConsentiti = (stato) => limitiDi(stato)?.sconti !== false

// La stampa, tutta: comande, scontrini, chiusure, fatture (REQ-LIC-016,
// Daniele 12/11/2026: «il Free è senza stampa»). Solo un `false` scritto la
// spegne: la Tana e i piani a pagamento non hanno la voce.
export const stampaConsentita = (stato) => limitiDi(stato)?.stampa !== false

// La stessa domanda per chi NON ha le impostazioni in mano: la stampa, che
// non aspetta la rete (printer.js), e i pochi pannelli che non ascoltano le
// impostazioni. Le schermate che le hanno chiedono a `stampaConsentita`.
// Si legge solo la licenza ricordata, non tutto il blocco delle
// impostazioni: lì dentro c'è anche il logo delle stampe, fino a 150 KB, e
// questa domanda si fa a ogni foglio e in più di una lista.
const licenzaInMemoria = () => ({ licenza: licenzaRicordata() })
export const stampaNelPiano = () => stampaConsentita(licenzaInMemoria())

// IL FREE È UNA CASSA SEMPLICE (REQ-LIC-005, l'utente 31/10/2026: «nella
// free non metterei le comande»). Con `comande: false` non c'è il ciclo
// del servizio: niente stati, coda di preparazione, tempi, stima ai
// clienti, né stampa della comanda. Solo un `false` scritto lo spegne.
export const comandeConsentite = (stato) => limitiDi(stato)?.comande !== false

// IL SERVIZIO È ACCESO? Una domanda sola, al posto di `workflow_enabled`
// letto in giro: l'interruttore del locale («Segui la preparazione»), a
// meno che il piano non comprenda le comande. Così il Free passa dalla
// strada che esisteva già e che è collaudata, quella del servizio spento:
// le comande restano modificabili fino all'incasso, lì risultano servite
// e lì si scala il magazzino. Non nascono già servite, come diceva la
// prima stesura: una comanda servita blocca le sue quantità
// (lockedQtyByItem), e in una cassa semplice una riga battuta per
// sbaglio non si potrebbe più togliere.
export const servizioAttivo = (stato) => stato?.workflow_enabled !== false && comandeConsentite(stato)

// La stampa della comanda: serve la stampa, e servono le comande. Lo
// scontrino segue solo la prima.
export const stampaComandeConsentita = (stato) => stampaConsentita(stato) && comandeConsentite(stato)
export const comandeNelPiano = () => comandeConsentite(licenzaInMemoria())
export const stampaComandeNelPiano = () => stampaComandeConsentita(licenzaInMemoria())

// Da quando si vede lo storico (vendite, conti chiusi), o null se si vede
// tutto. Si parte dalla MEZZANOTTE di N giorni fa, non da adesso meno N×24
// ore: un locale lavora oltre la mezzanotte, e tagliare una serata a metà
// vorrebbe dire mostrarne i conti dopo le dieci e non quelli prima. I
// dati più vecchi restano nel database: semplicemente non si mostrano.
export function inizioStorico(stato, adesso = new Date()) {
  const giorni = giorniDiStorico(stato)
  if (giorni == null) return null
  const da = new Date(adesso)
  da.setDate(da.getDate() - giorni)
  da.setHours(0, 0, 0, 0)
  return da
}

// Questa data sta nello storico che si vede? Una data che non si legge
// resta visibile: nascondere un conto per un campo rotto è peggio.
export function dentroStorico(stato, quando, adesso = new Date()) {
  const da = inizioStorico(stato, adesso)
  if (!da || !quando) return true
  const t = new Date(typeof quando?.toDate === 'function' ? quando.toDate() : quando)
  return Number.isNaN(t.getTime()) || t >= da
}

// Le voci di uno storico (conti, chiusure di cassa) che si vedono: quelle
// dentro `storico_giorni`, più quelle che `aperta` tiene fuori dal taglio —
// il lavoro ancora da finire non è storico. Sta qui e non nelle liste
// perché la regola è una sola: senza limite torna la lista com'è, la stessa.
export function visibiliNelloStorico(stato, lista, { data, aperta = () => false, adesso = new Date() }) {
  if (inizioStorico(stato, adesso) == null) return lista
  return lista.filter((voce) => aperta(voce) || dentroStorico(stato, data(voce), adesso))
}

// Le foto dei prodotti stanno su Storage, che il profilo leggero non ha.
export const fotoConsentite = (stato) => !profiloLeggero(stato)

// Si possono creare account dello staff? No se il piano tiene un utente
// solo (il titolare), e no sul profilo leggero, dove la Function che li
// crea (`staffAdmin`) non c'è.
export function staffConsentito(stato) {
  if (profiloLeggero(stato)) return false
  const max = maxUtenti(stato)
  return max == null || max > 1
}

// La firma del prodotto in fondo allo scontrino e al menù digitale.
export const rigaMarchio = (stato) => (limitiDi(stato)?.marchio === true ? `Creato con ${NOME_PRODOTTO}` : null)

// Dove il titolare sceglie un piano a pagamento.
export const urlRegia = (stato) => licenzaDi(stato)?.regia_url || null

// I LIMITI DEL PIANO IN CHIARO, per la sottosezione Licenza (REQ-LIC-007):
// una riga per limite scritto, nessuna se il piano non ne ha. Le parole
// sono quelle del gestionale: chi le legge è il titolare.
export function limitiInChiaro(stato) {
  const righe = []
  const prodotti = maxProdotti(stato)
  const conti = maxContiAperti(stato)
  const giorni = giorniDiStorico(stato)
  const utenti = maxUtenti(stato)
  if (prodotti !== null) righe.push(`Prodotti a listino: al massimo ${prodotti}`)
  if (conti !== null) righe.push(`Conti aperti contemporaneamente: al massimo ${conti}`)
  if (giorni !== null) righe.push(`Storico consultabile: ${giorni === 1 ? 'l’ultimo giorno' : `gli ultimi ${giorni} giorni`}`)
  if (utenti !== null) righe.push(`Utenti: al massimo ${utenti}`)
  if (!scontiConsentiti(stato)) righe.push('Sconti sul conto non consentiti')
  if (!stampaConsentita(stato)) righe.push('Stampa di comande e scontrini non compresa')
  if (!comandeConsentite(stato)) righe.push('Comande e stati del servizio non compresi: cassa semplice')
  if (rigaMarchio(stato)) righe.push('Firma del prodotto in calce allo scontrino')
  return righe
}

// ── COSA SI LEGGE ─────────────────────────────────────────────────────
// Frasi piane, senza toni da venditore: cosa non si può fare e perché. Il
// collegamento alla regia lo aggiunge chi le mostra (AvvisoPiano).
const plurale = (n, uno, tanti) => `${n} ${n === 1 ? uno : tanti}`

export const MESSAGGI_PIANO = {
  prodotti: (n) =>
    `Nel piano Free il menù ha al massimo ${plurale(n, 'prodotto', 'prodotti')}. Per aggiungerne passa a un piano a pagamento.`,
  conti: (n) => `Nel piano Free puoi avere al massimo ${plurale(n, 'conto aperto', 'conti aperti')} insieme.`,
  storico: (n) => `Nel piano Free lo storico mostra ${n === 1 ? 'l’ultimo giorno' : `gli ultimi ${n} giorni`}.`,
  staff: 'Nel piano Free l’app la usa solo il titolare. Per aggiungere lo staff passa a un piano a pagamento.',
  foto: 'Le foto dei prodotti sono dei piani a pagamento.',
  stampa: 'La stampa di comande e scontrini è dei piani a pagamento.',
  comande: 'Nel piano Free la cassa è semplice: si battono le righe e si incassa. Comande, stati del servizio e preparazione sono dei piani a pagamento.',
  allegati: 'Gli allegati delle fatture sono dei piani a pagamento.',
  sumup: 'I pagamenti con SumUp sono dei piani a pagamento. Nel piano Free il conto si chiude in contanti o con la carta su un POS esterno.',
  // Un piano a pagamento senza il modulo: non è «il piano Free».
  sumup_modulo: 'I pagamenti con SumUp sono un modulo che il tuo piano non include: si aggiunge dalla regia.',
}
