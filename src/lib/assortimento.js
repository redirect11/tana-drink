// ── L'ASSORTIMENTO, IN PAROLE ────────────────────────────────────────
// I quattro stati stanno in `inventory.js` (ASSORTIMENTI, assortimentoDi);
// qui i nomi corti e le spiegazioni che servono ai FILTRI — nel magazzino e
// nel nuovo ordine al fornitore, che sono lo stesso filtro in due posti
// (vedi `components/FiltroAssortimento.jsx`). Le etichette lunghe per la
// riga del prodotto restano `ETICHETTA_ASSORTIMENTO`.
//
// Testi segnati con `daTradurre`, tradotti dove si mostrano (REQ-UI-039):
// le tabelle si leggono con `trSegnato`, il riassunto traduce da sé.

import { daTradurre, tr, trSegnato } from './lingua.js'

// I nomi in parole: servono al tasto della tendina, che deve dire cosa è
// scelto senza doversi aprire. «In linea» porta il suo contesto: qui è la
// linea fissa del magazzino, non il margine «in linea» del menù.
export const ASSORTIMENTO_NOME = {
  assortimento: daTradurre('In assortimento'),
  linea: daTradurre('assortimento|In linea'),
  premium: daTradurre('Premium'),
  out: daTradurre('Fuori assortimento'),
}

export const ASSORTIMENTO_TITOLO = {
  assortimento: daTradurre('Si tiene, senza niente di speciale'),
  linea: daTradurre('I primi da controllare prima di una serata'),
  // «Bottiglie premium» dava per scontato che qui dentro ci fossero solo
  // bottiglie: un gestionale deve restare generico (REQ-MAG-019).
  premium: daTradurre('I prodotti buoni'),
  out: daTradurre('Fuori assortimento: non si ricompra'),
}

// Cosa dice il tasto di una tendina che contiene solo questo filtro.
export function riassuntoAssortimento(scelti) {
  if (scelti.length === 0) return tr('Assortimento')
  if (scelti.length === 1) return trSegnato(ASSORTIMENTO_NOME[scelti[0]])
  return tr('{n} assortimenti', { n: scelti.length })
}

// Accende o spegne una voce: si possono tenere accesi PIÙ valori insieme
// (linea + premium, linea + out…), e vuoto vuol dire «si vede tutto».
export const toggleVoce = (lista, k) =>
  lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]
