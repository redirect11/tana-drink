// ── UNA SCHERMATA IN INGLESE NON HA ITALIANO A SCHERMO (REQ-UI-039) ──────
//
// Per le prove delle schermate tradotte: si apre la schermata con la lingua
// inglese (impostaLingua('en')) e si chiede cosa è rimasto in italiano. Due
// controlli, perché i modi di sbagliare sono due:
//
//   1. un testo del DIZIONARIO ancora a schermo nella sua forma italiana: un
//      `tr` rotto, o un `daTradurre` mostrato senza `trSegnato`;
//   2. una PAROLA ITALIANA COMUNE a schermo: un testo che non è mai passato
//      da `tr`, e che il dizionario quindi non conosce. Le parole sono di
//      quelle che in un testo dell'interfaccia ci sono sempre, e in inglese
//      mai. Perché funzioni, i dati finti della prova (nomi, prodotti, note)
//      non devono contenerne: «Negroni», «Spritz», «Mario» vanno bene.
//
// Un elemento con lang="it" è italiano apposta (il nome di una lingua, un
// testo del locale): si salta, coi suoi figli.

import en from '../../src/lib/testi/en/index.js'

const PAROLE = [
  'il', 'lo', 'gli', 'della', 'delle', 'dello', 'degli', 'del', 'dei', 'nel', 'nella', 'alla', 'allo',
  'che', 'non', 'per', 'con', 'una', 'uno', 'sono', 'questo', 'questa', 'ancora', 'tutti', 'tutte',
  'conto', 'conti', 'ordine', 'ordini', 'coda', 'annulla', 'salva', 'chiudi', 'incassa', 'paga',
  'cerca', 'nuovo', 'nuova', 'aggiungi', 'togli', 'modifica', 'indietro', 'totale', 'resto',
  'riscuoti', 'stampa', 'comanda', 'comande', 'tavolo', 'banco', 'servizio', 'ritiro', 'cassa',
]
const RE_PAROLE = new RegExp(`(^|[^\\p{L}])(${PAROLE.join('|')})(?=[^\\p{L}]|$)`, 'iu')

function testiVisibili(radice) {
  const fuori = []
  const giro = radice.ownerDocument.createTreeWalker(radice, NodeFilter.SHOW_TEXT)
  while (giro.nextNode()) {
    const n = giro.currentNode
    if (!n.nodeValue.trim()) continue
    if (n.parentElement?.closest('[lang="it"], script, style')) continue
    fuori.push(n.nodeValue.trim())
  }
  // Anche quello che si legge senza vederlo: aria-label, title, placeholder.
  for (const el of radice.querySelectorAll('[aria-label], [title], [placeholder]')) {
    if (el.closest('[lang="it"]')) continue
    for (const a of ['aria-label', 'title', 'placeholder']) if (el.getAttribute(a)) fuori.push(el.getAttribute(a))
  }
  return fuori
}

// Quello che è rimasto in italiano, per l'expect: `toEqual([])`.
export function italianoRimasto(radice) {
  const testi = testiVisibili(radice)
  const tutto = testi.join('\n')
  const dalDizionario = Object.entries(en)
    .map(([chiave, inglese]) => [chiave.slice(chiave.indexOf('|') + 1), inglese])
    .filter(([it, inglese]) => it.length >= 4 && it !== inglese && !inglese.includes(it) && tutto.includes(it))
    .map(([it]) => `dal dizionario: «${it}»`)
  const parole = testi.filter((t) => RE_PAROLE.test(t)).map((t) => `parola italiana: «${t}»`)
  return [...dalDizionario, ...parole]
}
