// IL COLORE DI CHI LAVORA (REQ-ORD-023).
//
// Richiesta dell'08/11/2026: accanto a ogni riga del conto l'iniziale di
// chi l'ha battuta, «se caricato da FLAVIO appare la F nel quadrato rosa e
// se caricato da ALEX appare A nel quadrato azzurro». Prima il quadratino
// era dello stesso colore per tutto il personale: con due persone al conto
// la lettera da sola non bastava a staccarle a colpo d'occhio.
//
// IL COLORE VIENE DAL NOME, non da un'impostazione: deve essere lo stesso
// sulla card, nella legenda e su ogni riga, su ogni terminale, senza che
// nessuno lo configuri — la stessa scelta dei colori delle categorie
// (categoryColors.js). Il nome è quello che si legge (placedByName), perché
// la legenda della coda ha in mano solo quello.
//
// Tinte scure abbastanza da reggere la lettera bianca su tutti e due i temi,
// e lontane fra loro: due persone devono distinguersi, non sfumare. Il
// rosso e il verde puri restano agli stati (esaurito, disponibile).
import { placedByName } from './orderStatus.js'

export const TINTE_PERSONE = [
  '#d6457a', // rosa
  '#2f7fc8', // azzurro
  '#7a52c7', // viola
  '#c86a1c', // arancio
  '#13867f', // petrolio
  '#8a6d1c', // ocra
  '#4b5fc4', // indaco
  '#a8407d', // prugna
]

export const chiavePersona = (persona) =>
  String(typeof persona === 'string' ? persona : placedByName(persona))
    .trim()
    .toLowerCase()

// FNV-1a con un rimescolamento finale: stabile fra un giro e l'altro e fra
// i terminali. Non il djb2 delle categorie: su otto tinte il djb2 guarda in
// pratica la somma delle lettere, e «alex», «daniele» e «marco» finivano
// tutti nello stesso colore — proprio quello che il colore doveva evitare.
//
// IL SEME (268) È SCELTO: con quello Flavio esce rosa e Alex azzurro, come
// nella richiesta, e i primi dieci nomi comuni si spargono su sette tinte.
// Cambiarlo cambia il colore a tutti: si fa una volta, non per gusto.
// `null` senza nome: niente colore inventato.
const SEME = 268
export function colorePersona(persona) {
  const s = chiavePersona(persona)
  if (!s) return null
  let h = (0x811c9dc5 ^ SEME) >>> 0
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  h ^= h >>> 16
  h = Math.imul(h, 0x45d9f3b)
  h ^= h >>> 16
  return TINTE_PERSONE[(h >>> 0) % TINTE_PERSONE.length]
}
