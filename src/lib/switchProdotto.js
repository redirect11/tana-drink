// ── IN QUANTE RICETTE, E LO SWITCH PRODOTTO (REQ-MAG-056, REQ-MENU-043) ──
//
// Flavio, 14/11/2026: «si può inserire in questa sezione del Prodotto in
// quante Ricette di Menù è presente?», e «lo SWITCH PRODOTTO, ovvero il
// gestionale ricerca un prodotto d'uscita presente in tutte le ricette e lo
// sostituisce col prodotto d'ingresso, lasciando invariata la quantità». Il
// perché, nel suo vocale: «spesso i fornitori non hanno sempre il prodotto»
// — gli avevano appena cambiato il Carpano Dry con un Noilly Prat, e il
// Carpano Dry stava in tutte le ricette dei Martini.
//
// LE REGOLE, sue e di Daniele (14/11/2026):
//   · UN VERSO SOLO: «solo Tanqueray con Bombay, Bombay resta Bombay». Le
//     ricette che hanno già il prodotto d'ingresso non si toccano, se non
//     hanno anche quello d'uscita.
//   · LA QUANTITÀ E L'UNITÀ RESTANO. Cambiano solo il prodotto e il nome
//     sulla riga. Quindi i due prodotti si devono misurare allo stesso modo:
//     «4 cl» non deve diventare 4 bottiglie (CLAUDE.md, unità base). Una
//     riga che il prodotto d'ingresso non sa dosare ferma lo switch.
//   · UNA RICETTA CHE LI HA TUTTI E DUE resta con due righe del prodotto
//     d'ingresso (Daniele: «lasciale così»): l'anteprima la segnala.
//   · LE ETICHETTE DEL MENÙ DEI CLIENTI che nominano il prodotto d'uscita
//     passano a quello d'ingresso (Daniele: «si devono ovviamente aggiornare
//     anche le etichette nel menù clienti»): il menù deve dire quello che c'è
//     nel bicchiere. Anche le scelte del cliente (REQ-MENU-042) che lo
//     offrono o lo sostituiscono.
//   · I DRINK GIÀ FATTI NON CAMBIANO: il magazzino li ha scalati con la
//     ricetta di allora (lo snapshot sulla comanda).
//
// Logica pura: drink, voci e prodotti li passa chi chiama, e chi scrive è
// api.js (switchProdotto).
import { entryUnits, baseUnit } from './inventory.js'
import { nomeInCarta } from './ingredientiCarta.js'

const usa = (drink, itemId) => (drink?.recipe_items || []).some((r) => r?.inventory_item_id === itemId)

// I drink della cassa che hanno il prodotto in ricetta, per nome.
export function ricetteDelProdotto(drinks, itemId) {
  if (!itemId) return []
  return (drinks || [])
    .filter((d) => usa(d, itemId))
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'it'))
}

// Le unità (base) in cui il prodotto si può dosare in una ricetta.
const unitaDosabili = (item) => new Set(entryUnits(item).map(baseUnit))

// Le etichette di una voce dopo lo switch, o null se non cambia niente.
export function etichetteDopoSwitch(etichette, uscita, ingresso) {
  if (!Array.isArray(etichette) || !uscita?.id || !ingresso?.id) return null
  const nomeIngresso = nomeInCarta(ingresso.name)
  const haIngresso = etichette.some((e) => e?.tipo === 'prodotto' && e.id === ingresso.id)
  let cambiato = false
  const out = []
  for (const e of etichette) {
    let n = e
    if (e?.tipo === 'prodotto' && e.id === uscita.id) {
      cambiato = true
      // C'è già l'etichetta del prodotto d'ingresso: due uguali non servono.
      if (haIngresso) continue
      n = { ...e, id: ingresso.id, nome: nomeIngresso }
    }
    if (n?.scelta) {
      const s = sceltaDopoSwitch(n.scelta, uscita, ingresso, nomeIngresso)
      if (s !== n.scelta) {
        cambiato = true
        n = { ...n, scelta: s }
      }
    }
    out.push(n)
  }
  return cambiato ? out : null
}

// La scelta del cliente dopo lo switch: fra gli offerti il prodotto d'uscita
// diventa quello d'ingresso, col suo supplemento (o sparisce, se quello
// d'ingresso è già offerto); fra le righe sostituite, lo stesso.
function sceltaDopoSwitch(scelta, uscita, ingresso, nomeIngresso) {
  const offerti = Array.isArray(scelta.offerti) ? scelta.offerti : []
  const sostituisce = Array.isArray(scelta.sostituisce) ? scelta.sostituisce : []
  const toccaOfferti = offerti.some((o) => o?.id === uscita.id)
  const toccaSostituisce = sostituisce.includes(uscita.id)
  if (!toccaOfferti && !toccaSostituisce) return scelta
  const giaOfferto = offerti.some((o) => o?.id === ingresso.id)
  return {
    ...scelta,
    offerti: offerti.flatMap((o) =>
      o?.id !== uscita.id ? [o] : giaOfferto ? [] : [{ ...o, id: ingresso.id, nome: nomeIngresso }]
    ),
    sostituisce: [...new Set(sostituisce.map((id) => (id === uscita.id ? ingresso.id : id)))],
  }
}

/**
 * IL PIANO DELLO SWITCH, da mostrare prima di scrivere: le ricette che
 * cambiano (con quelle che hanno già il prodotto d'ingresso), le voci del
 * menù dei clienti le cui etichette cambiano, e le righe che il prodotto
 * d'ingresso non sa dosare. Null se i due prodotti non sono due.
 */
export function pianoSwitch({ drinks = [], voci = [], uscita, ingresso }) {
  if (!uscita?.id || !ingresso?.id || uscita.id === ingresso.id) return null
  const dosabili = unitaDosabili(ingresso)
  const ricette = []
  const incompatibili = []
  for (const d of ricetteDelProdotto(drinks, uscita.id)) {
    const righe = d.recipe_items || []
    // L'unità della riga riportata alla base, come la legge lo scarico: le
    // ricette vecchie hanno righe in «cl» (o senza unità, che vale «pz»), e
    // «4 cl» del Carpano si dosa benissimo in ml col Noilly.
    const unitaDi = (r) => baseUnit(r.unit || 'pz')
    const fuori = [...new Set(righe.filter((r) => r.inventory_item_id === uscita.id && !dosabili.has(unitaDi(r))).map(unitaDi))]
    if (fuori.length) incompatibili.push({ id: d.id, nome: d.name, unita: fuori })
    ricette.push({
      id: d.id,
      nome: d.name,
      conIngresso: usa(d, ingresso.id),
      recipe_items: righe.map((r) =>
        r.inventory_item_id === uscita.id ? { ...r, inventory_item_id: ingresso.id, name: ingresso.name } : r
      ),
    })
  }
  const nomeDrink = new Map((drinks || []).map((d) => [d.id, d.name]))
  const vociCambiate = []
  for (const v of voci || []) {
    const etichette = etichetteDopoSwitch(v.etichette, uscita, ingresso)
    if (etichette) vociCambiate.push({ id: v.id, nome: v.nome || nomeDrink.get(v.drink_id) || '', etichette })
  }
  return { ricette, voci: vociCambiate, incompatibili }
}
