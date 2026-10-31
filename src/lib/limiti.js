/* global __DEMO__ */
// ── I LIMITI DEL PIANO FREE, E IL PROFILO LEGGERO (REQ-LIC-003, REQ-LIC-004)
//
// La regia (drink-regia) scrive in `settings/bar.licenza`, accanto a
// `piano` e `moduli`, la voce `limiti`:
//
//   { prodotti_max: 10, conti_aperti_max: 5, sconti: false,
//     storico_giorni: 7, utenti_max: 1, marchio: true }
//
// per il piano Free, e `null` per i piani a pagamento.
//
// LA REGOLA CHE CONTA: SENZA `limiti`, NESSUN LIMITE. Voce assente, `null`
// o di forma sbagliata vuol dire che l'app lavora come ha sempre lavorato.
// È il caso della Tana, che una licenza non ce l'ha, e non deve accorgersi
// di niente: ogni domanda qui sotto, senza limiti, risponde «sì, come
// prima». Un limite non è mai il comportamento di partenza. Lo stesso vale
// per ogni singola chiave: un `prodotti_max` mancante non limita i prodotti.
//
// IL PROFILO LEGGERO. Un locale Free è pubblicato con le sole regole di
// Firestore e il sito (`firebase deploy --only firestore,hosting`): niente
// Functions, niente Storage, perché sono quello che costa anche da fermo.
// L'app lo capisce da `licenza.piano === 'free'`, oppure da una variabile
// di build (`VITE_PROFILO=leggero`) che la regia può passare se un giorno
// pubblicasse leggero un piano diverso.
//
// ⚠️ COME PER I MODULI (lib/licenza.js), IL LIMITE NASCONDE, NON PROTEGGE:
// è l'app che non lascia fare, non il server. Perché per ora basta, e
// perché le regole di Firestore non ci sono, è scritto in REQ-LIC-003.
//
// Logica pura: le impostazioni si passano (sono quelle già in mano a chi
// chiama, dalla cache: niente letture nuove, vedi il local-first).

import { NOME_PRODOTTO } from './prodotto.js'
import { impostazioniRicordate } from './impostazioniLocali.js'

export const PIANO_FREE = 'free'

// I limiti scritti nella licenza, o null: null vuol dire «nessun limite».
export function limitiDi(stato) {
  const l = stato?.licenza?.limiti
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

export const pianoFree = (stato) => stato?.licenza?.piano === PIANO_FREE

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
export const urlRegia = (stato) => stato?.licenza?.regia_url || null

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
  allegati: 'Gli allegati delle fatture sono dei piani a pagamento.',
  sumup: 'I pagamenti con SumUp sono dei piani a pagamento. Nel piano Free il conto si chiude in contanti o con la carta su un POS esterno.',
  // Un piano a pagamento senza il modulo: non è «il piano Free».
  sumup_modulo: 'I pagamenti con SumUp sono un modulo che il tuo piano non include: si aggiunge dalla regia.',
}
