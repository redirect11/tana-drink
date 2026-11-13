// ── LA LICENZA INIZIALE DI UN'INSTALLAZIONE SENZA REGIA (REQ-LIC-009) ──
//
// Da REQ-LIC-009 senza `licenza/attuale` le regole non fanno scrivere
// niente, e la Tana, che una regia dietro non ce l'ha, quel documento lo
// deve avere PRIMA che arrivino le regole nuove. L'utente, 02/11/2026: «non
// possiamo fare in modo che quando deployiamo scriviamo anche la licenza sul
// db? […] quando deployiamo da github». Così l'ordine lo garantisce il
// deploy: questo passo gira prima delle regole, e se fallisce il deploy si
// ferma lì.
//
// SOLO SE MANCA. Il file `clienti/<slug>/licenza-iniziale.json` conta una
// volta: se il documento c'è, non si tocca. I moduli cambiati dopo (con
// scripts/licenza-moduli.js, o un domani dalla regia) un rilascio non li
// deve mai riscrivere, e un rilascio non deve poter togliere un modulo.
//
// Non è la licenza della build di BUG-125 (`licenza.json`): questo file
// l'app non lo legge mai, lo legge solo il deploy, e la licenza che conta
// è quella nel database. È il ponte per la Tana finché la regia di
// produzione non la prende in carico; allora il passo nel deploy si toglie.
//
// Logica pura: il database lo passa chi chiama (scripts/licenza-iniziale.mjs
// con firebase-admin, i test con uno finto).

const oggetto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

// LE VOCI DEL CONTRATTO (docs/licenza-valida.md), tutte scritte, anche
// quando valgono null: la regia, 02/11/2026, «il documento deve avere tutte
// le voci del contratto». Una voce che manca e una che vale null dicono la
// stessa cosa all'app, ma non a chi legge il documento: scritte tutte, si
// vede che sono state decise, e quando la regia prenderà la Tana troverà
// la forma che si aspetta.
export const VOCI_DEL_CONTRATTO = [
  'stato',
  'moduli',
  'temi',
  'limiti',
  'valida_fino',
  'valida_fino_ts',
  'alla_scadenza',
  'cancellazione',
  'slug',
  'regia_url',
]

// Il contenuto del file, controllato: un oggetto con `moduli` che nomina
// TUTTI i moduli che l'app conosce, ognuno vero o falso. Un modulo non
// nominato vale «non incluso», e in una licenza scritta una volta sola per
// un locale vero sarebbe una svista che spegne una funzione senza che
// nessuno l'abbia deciso. Torna l'errore da dire, o null se va bene.
export function erroreLicenzaIniziale(licenza, idModuli) {
  if (!oggetto(licenza)) return 'il file non contiene un oggetto'
  const assenti = VOCI_DEL_CONTRATTO.filter((v) => !(v in licenza))
  if (assenti.length) return `mancano voci del contratto: ${assenti.join(', ')}`
  // È la licenza di partenza di un locale che lavora: attiva, e con una
  // scadenza che, se un giorno c'è, sa cosa fare.
  if (licenza.stato !== 'attiva') return '`stato` deve essere «attiva»'
  if (!['ferma', 'free'].includes(licenza.alla_scadenza)) return '`alla_scadenza` deve essere «ferma» o «free»'
  if (typeof licenza.slug !== 'string' || !licenza.slug) return 'manca lo `slug` del locale'
  if (!Array.isArray(licenza.temi) || licenza.temi.some((t) => typeof t !== 'string')) {
    return '`temi` deve essere un elenco di nomi (anche vuoto)'
  }
  if (!oggetto(licenza.moduli)) return 'manca `moduli`'
  const mancanti = idModuli.filter((id) => typeof licenza.moduli[id] !== 'boolean')
  if (mancanti.length) return `\`moduli\` non dice vero o falso per: ${mancanti.join(', ')}`
  const ignoti = Object.keys(licenza.moduli).filter((id) => !idModuli.includes(id))
  if (ignoti.length) return `\`moduli\` nomina moduli che l'app non conosce: ${ignoti.join(', ')}`
  return null
}

// Crea il documento se manca. `doc` ha `get()` e `create(dati)`, come un
// DocumentReference di firebase-admin: `create` fallisce se il documento
// nel frattempo è nato, e quel caso vale come «c'era già».
// Torna 'creata' o 'cera'.
export async function scriviSeManca(doc, licenza, adesso = new Date()) {
  const snap = await doc.get()
  if (snap.exists) return 'cera'
  try {
    await doc.create({ ...licenza, scritta_il: adesso.toISOString(), scritta_da: 'deploy' })
    return 'creata'
  } catch (e) {
    // ALREADY_EXISTS (codice 6): l'ha scritta qualcun altro un istante prima.
    if (e?.code === 6 || /already exists/i.test(String(e?.message))) return 'cera'
    throw e
  }
}
