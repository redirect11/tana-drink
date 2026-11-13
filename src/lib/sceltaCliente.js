// ── IL CLIENTE SCEGLIE UN INGREDIENTE, E LA SCELTA ARRIVA AL BANCO ────
// (REQ-MENU-042 al telefono, REQ-CLI-008 sulla riga dell'ordine)
//
// Daniele, 13/11/2026: sulla voce il titolare accende la scelta di un
// ingrediente (il gin, per dire), indica cosa offrire e il supplemento di
// ciascuno. Il cliente sceglie al momento di aggiungere; chi non sceglie ha
// la ricetta com'è.
//
// LA RIGA CON UNA SCELTA è quella che il banco fa già quando ritocca un
// drink dal conto (OrderPosDetail, applyEdit): resta il drink, con
// `custom: true` e la ricetta SUA. Così la comanda, lo scarico del
// magazzino (computeConsumption legge `recipe_items` della riga) e le
// statistiche seguono la scelta senza un caso nuovo da nessuna parte; e due
// righe con scelte diverse non si accorpano (lineSignature confronta la
// ricetta). Al banco la scelta si legge nella NOTA della riga.
//
// Del magazzino al telefono arriva solo `alternative_cliente/{id}` (sì o
// no): un'alternativa che non c'è, o che non è disponibile, non si mostra.
// Al cliente non si dice mai cosa manca (REQ-MENU-017).
//
// Logica pura.

import { rigaDelCarrello } from './cart.js'
import { etichetteConScelta } from './etichetteIngredienti.js'

const centesimi = (n) => Math.round(Number(n || 0) * 100) / 100

// Le scelte che una voce offre ADESSO: per etichetta, le alternative
// disponibili, senza il prodotto della ricetta (quello è «come da ricetta»).
// Un'etichetta senza alternative disponibili sparisce: niente da scegliere.
export function scelteDellaVoce(etichette, disponibili) {
  return etichetteConScelta(etichette)
    .map((e) => {
      const ricetta = new Set(e.scelta.sostituisce || [])
      const opzioni = e.scelta.offerti.filter((o) => disponibili?.get(o.id) === true && !ricetta.has(o.id))
      return { etichetta: e, opzioni }
    })
    .filter((s) => s.opzioni.length > 0)
}

// La ricetta con le scelte al posto delle righe che sostituiscono. La dose e
// l'unità restano quelle della ricetta: cambia il prodotto, non il bicchiere.
export function ricettaConScelte(ricetta, scelte) {
  const al = new Map()
  for (const { etichetta, scelto } of scelte) {
    for (const id of etichetta.scelta?.sostituisce || []) al.set(id, scelto)
  }
  return (ricetta || []).map((r) => {
    const scelto = al.get(r.inventory_item_id)
    return scelto ? { ...r, inventory_item_id: scelto.id, name: scelto.nome } : { ...r }
  })
}

// La riga del carrello per una voce, con le scelte fatte: `scelte` è
// [{ etichetta, scelto }] e contiene solo quelle diverse dalla ricetta.
// `ricetta` è quella del prodotto della cassa: la voce del menù non la
// porta (voceInSezione la svuota).
export function rigaConScelte(drink, ricetta, scelte = []) {
  const riga = rigaDelCarrello(drink)
  if (!scelte.length) return riga
  const supplementi = scelte.reduce((s, x) => s + Number(x.scelto.supplemento || 0), 0)
  return {
    ...riga,
    price: centesimi(Number(riga.price || 0) + supplementi),
    custom: true,
    recipe_items: ricettaConScelte(ricetta, scelte),
    scelte: scelte.map(({ etichetta, scelto }) => ({
      etichetta: etichetta.nome,
      id: scelto.id,
      nome: scelto.nome,
      supplemento: centesimi(scelto.supplemento),
    })),
    note: [riga.note, ...scelte.map(({ etichetta, scelto }) => `${etichetta.nome}: ${scelto.nome}`)]
      .filter(Boolean)
      .join(' · '),
  }
}
