// ── QUALI AVVISI VOGLIO, SU QUESTO TELEFONO ──────────────────────────
// Le notifiche non servono a tutti allo stesso modo: al banco «nuovo
// ordine» è la cosa più importante della serata, in sala serve solo
// «pronto», e chi tiene il portatile nel retro non vuole niente. Un
// interruttore unico per tutto il locale non funzionerebbe: si spegnerebbe
// dove dà fastidio, e chi ne aveva bisogno resterebbe senza.
//
// Perciò la scelta è PER DISPOSITIVO E PER PERSONA, e sta in memoria locale:
// lo stesso account sul tablet della cassa e sul telefono in sala vuole due
// cose diverse; e due persone che si passano lo stesso tablet nei cambi
// turno non si sovrascrivono le impostazioni a vicenda.
//
// Non finisce su Firestore apposta: è una preferenza di chi guarda quello
// schermo, non una regola del bar.

import { ORDER_STATUSES } from './orderStatus.js'

// L'elenco è anche quello che si vede nelle impostazioni: un posto solo.
export const AVVISI = [
  {
    id: 'nuovo_ordine',
    label: 'Nuovo ordine',
    desc: 'Un ordine è entrato in coda, da un altro terminale o da un cliente.',
  },
  {
    id: `stato_${ORDER_STATUSES.IN_PREPARAZIONE}`,
    label: 'Passa in preparazione',
    desc: 'Qualcuno ha iniziato a farlo.',
  },
  {
    id: `stato_${ORDER_STATUSES.PRONTO}`,
    label: 'Diventa pronto',
    desc: 'Da portare al tavolo o da consegnare al banco.',
  },
  {
    id: `stato_${ORDER_STATUSES.RITIRATO}`,
    label: 'Servito o ritirato',
    desc: 'La comanda è arrivata al cliente.',
  },
  {
    id: 'scorta_low',
    label: 'Scorta in esaurimento',
    desc: 'Un ingrediente è sceso sotto la soglia. Solo per chi tiene il magazzino.',
    soloGestore: true,
  },
  {
    id: 'scorta_empty',
    label: 'Scorta esaurita',
    desc: 'Un ingrediente è finito: quel drink non si può più fare.',
    soloGestore: true,
  },
  {
    id: 'nuova_versione',
    label: 'Nuova versione dell’app',
    desc: 'Il riquadro con le novità e il suo avviso in campanella.',
  },
]

// Gli avvisi che ha senso mostrare a chi guarda: il magazzino è roba di chi
// lo tiene, in sala non si sa nemmeno cosa farsene.
export const avvisiPerRuolo = (gestore) =>
  AVVISI.filter((a) => !a.soloGestore || gestore)

// L'id dell'avviso per uno stato di scorta ('empty' | 'low' | 'ok').
export const idAvvisoScorta = (stato) => `scorta_${stato}`

export const idAvvisoStato = (stato) => `stato_${stato}`

const chiave = (uid) => `tana:avvisi:${uid || 'anonimo'}`

// Di partenza sono tutti accesi: chi non li vuole li spegne, ma nessuno
// deve scoprire di essersi perso un ordine perché "era spento di default".
const TUTTI_ACCESI = Object.fromEntries(AVVISI.map((a) => [a.id, true]))

const subs = new Set()

export function leggiAvvisi(uid) {
  try {
    const raw = JSON.parse(localStorage.getItem(chiave(uid)) || '{}')
    const salvate = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
    return { ...TUTTI_ACCESI, ...salvate }
  } catch {
    return { ...TUTTI_ACCESI }
  }
}

export function scriviAvviso(uid, id, attivo) {
  const prossime = { ...leggiAvvisi(uid), [id]: !!attivo }
  try {
    localStorage.setItem(chiave(uid), JSON.stringify(prossime))
  } catch {
    /* niente memoria locale: vale per questa sessione */
  }
  subs.forEach((f) => f(prossime))
  return prossime
}

// Chi ascolta riceve subito le preferenze correnti e poi i cambiamenti.
export function subscribeAvvisi(uid, cb) {
  const fn = () => cb(leggiAvvisi(uid))
  subs.add(fn)
  fn()
  return () => subs.delete(fn)
}

// Un avviso non elencato (o preferenze non ancora lette) è ACCESO: nel
// dubbio si avvisa — un avviso in più si chiude, uno in meno è un drink che
// non parte.
export function avvisoAttivo(preferenze, id) {
  if (!preferenze) return true
  return preferenze[id] !== false
}
