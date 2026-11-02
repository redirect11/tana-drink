// ── IL MARKETPLACE DEI MODULI (REQ-LIC-012) ────────────────────────────
//
// L'utente, 02/11/2026: «anche per i moduli aggiuntivi andrebbe fatto il
// marketplace», e prima «gli acquisti sono in app». Decisioni dello stesso
// giorno: i moduli si pagano AL MESE, come nel listino della regia; si
// possono PROVARE gratis prima di pagarli; li compra SOLO IL TITOLARE.
//
// CHI DECIDE COSA: il listino (prezzi, giorni di prova) è della regia, e si
// legge all'apertura del marketplace (`catalogoModuli`, mai a tempo); lo
// stato di un modulo («incluso», «in prova fino al…») lo dice la licenza,
// che la regia riscrive dopo un acquisto o una prova — l'app lo vede
// arrivare in tempo reale, come ogni cambio di licenza. Il pagamento si fa
// sulla pagina di Stripe, aperta dall'app: i dati della carta non passano
// da qui. Il contratto per la regia è in docs/marketplace-moduli.md.
//
// Logica pura più la memoria del dispositivo; le chiamate sono in api.js.

import { MODULI_PREMIUM, moduloIncluso, scadenzaProva } from './licenza.js'
import { urlRegia } from './limiti.js'
import { leggi, scrivi } from './impostazioniLocali.js'
import { urlFunzioneRegia, scaricaERicorda, erroreDellaRegia } from './funzioniRegia.js'
import { formatPrice } from './orderStatus.js'

export const urlListino = (progetto) => urlFunzioneRegia('catalogoModuli', progetto)
export const urlAzioni = (progetto) => urlFunzioneRegia('moduloDallApp', progetto)

// Una voce del listino com'è scritta dalla regia → { id, prezzo, prova_giorni },
// o null. Solo i moduli che l'app conosce: uno nuovo arriva con l'app.
export function leggiVoce(v) {
  if (!v || typeof v !== 'object' || !Object.hasOwn(MODULI_PREMIUM, v.id)) return null
  const prezzo = Number(v.prezzo)
  const prova = Number(v.prova_giorni)
  return {
    id: v.id,
    prezzo: Number.isFinite(prezzo) && prezzo >= 0 ? prezzo : null,
    prova_giorni: Number.isInteger(prova) && prova > 0 ? prova : 0,
  }
}

export function leggiListino(corpo) {
  const voci = Array.isArray(corpo?.moduli) ? corpo.moduli : Array.isArray(corpo) ? corpo : []
  return voci.map(leggiVoce).filter(Boolean)
}

const CHIAVE = 'drink:listino-moduli'
export const listinoRicordato = () => leggi(CHIAVE, (s) => leggiListino(JSON.parse(s)), [])
const ricordaListino = (voci) => scrivi(CHIAVE, voci)

// Il listino letto adesso, o null (senza regia nella build, senza rete):
// allora si mostra l'ultimo letto su questo dispositivo.
export const scaricaListino = (url = urlListino(), prendi) => scaricaERicorda(url, leggiListino, ricordaListino, prendi)

// SI COMPRA DALL'APP SOLO SE LA LICENZA È DELLA REGIA: c'è una regia nella
// build E la licenza dice dov'è (`regia_url`). La licenza della Tana è
// scritta a mano, dal deploy (REQ-LIC-009), e non lo dice: lì la regia non
// saprebbe a chi intestare un acquisto, e i tasti non compaiono.
export const acquistiDallApp = (settings, url = urlAzioni()) => Boolean(url && urlRegia(settings))

// I moduli da mostrare, nell'ordine dell'app, ognuno col suo stato e, se la
// regia lo vende, prezzo e giorni di prova. Un modulo che la regia non ha
// nel listino resta in elenco ma non si compra («in vendita: false»).
export function schedeModuli(settings, listino = []) {
  const perId = new Map(listino.map((v) => [v.id, v]))
  return Object.entries(MODULI_PREMIUM).map(([id, m]) => {
    const voce = perId.get(id) || null
    const incluso = moduloIncluso(settings, id)
    const prova = incluso ? scadenzaProva(settings, id) : null
    return {
      id,
      nome: m.label,
      descrizione: m.descrizione,
      icona: m.icona,
      stato: prova ? 'prova' : incluso ? 'incluso' : 'non_incluso',
      prova_fino: prova,
      prezzo: voce?.prezzo ?? null,
      prova_giorni: voce?.prova_giorni ?? 0,
      in_vendita: Boolean(voce && voce.prezzo !== null),
    }
  })
}

// Il prezzo come lo scrive il listino della regia (piani.json): mensile, IVA
// esclusa. «15,00 € al mese + IVA», coi decimali come ogni prezzo dell'app.
export const prezzoAlMese = (euro) => (euro === null || euro === undefined ? '' : `${formatPrice(euro)} al mese + IVA`)

// La risposta della regia a un'azione. Con `checkout_url` si va a pagare
// sulla pagina di Stripe; con `in_attesa` la regia ha solo preso la
// richiesta, e il modulo cambia quando l'assistenza la evade; senza nessuno
// dei due, la licenza è già aggiornata (o lo sarà fra un istante). Il testo
// dell'errore lo scrive la regia, in italiano.
// `in_attesa` è dei piani gestiti a mano (pagati fuori da Stripe): l'utente,
// 02/11/2026, «arriva una richiesta d'acquisto a me che attivo o disattivo
// il modulo richiesto se ho ricevuto il pagamento». Dire «aggiunto» lì
// sarebbe una promessa che l'app non può mantenere.
export function esitoAzione(status, corpo) {
  if (status === 200 && corpo?.ok) {
    const url = typeof corpo.checkout_url === 'string' && /^https:\/\/checkout\.stripe\.com\//.test(corpo.checkout_url)
    return { ok: true, checkout_url: url ? corpo.checkout_url : null, dal: corpo.dal || null, in_attesa: corpo.in_attesa === true }
  }
  return { ok: false, status, errore: erroreDellaRegia(corpo) }
}

// Dove tornare dopo la pagina di Stripe: il marketplace di questo locale,
// sui moduli. La regia ci aggiunge `esito=pagato` o `esito=annullato`, e
// controlla che sia un indirizzo del locale prima di usarlo.
export const urlRitorno = (origine = globalThis.location?.origin || '', base = import.meta.env?.BASE_URL || '/') =>
  `${origine}${base.replace(/\/$/, '')}/bar?tab=marketplace&sezione=moduli`

// L'esito del ritorno da Stripe, letto dall'indirizzo: 'pagato',
// 'annullato', o null.
export function esitoRitorno(search) {
  const esito = new URLSearchParams(search || '').get('esito')
  return esito === 'pagato' || esito === 'annullato' ? esito : null
}
