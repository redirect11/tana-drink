// ── IL MAZZO DELLO STILE «CARTE»: SEMI E VALORI (REQ-MENU-029) ──────────
//
// L'idea di Flavio, 05/11/2026: le macro categorie del menù sono i quattro
// semi di un mazzo di carte francesi. Lo schizzo del 06/11/2026 li mette in
// quest'ordine — cuori ai cocktail, fiori ai distillati, quadri a birre,
// amari e vini, picche a bevande e cucina — e ogni SEZIONE è una carta del
// suo seme.
//
// Le macro categorie sono i gruppi della struttura del menù dei clienti
// (`carta_sezioni.gruppo`, REQ-MENU-030): il primo gruppo che si incontra
// prende cuori, il secondo fiori, e così via. Una sezione senza gruppo fa
// gruppo da sé, come nelle pagine del menù (strutturaMenu.js): un seme
// deciso a caso metterebbe insieme sezioni che il gestore non ha legato.
// Oltre i quattro gruppi i semi ricominciano; i valori invece continuano
// nel seme, così due carte non sono mai uguali finché il seme ne ha.

// Il colore del seme lo decide il CSS (`[data-seme]` in index.css).
export const SEMI = Object.freeze([
  Object.freeze({ id: 'cuori', simbolo: '♥' }),
  Object.freeze({ id: 'fiori', simbolo: '♣' }),
  Object.freeze({ id: 'quadri', simbolo: '♦' }),
  Object.freeze({ id: 'picche', simbolo: '♠' }),
])

const VALORI = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

// Il carattere di variazione U+FE0E chiede il segno di stampa: senza, su
// alcuni telefoni ♥ e ♠ diventano le emoji colorate, e il seme non è più
// quello della carta.
export const segnoDi = (seme) => `${seme.simbolo}︎`

// QUANTO È LARGA LA PAROLA PIÙ LUNGA DEL NOME, in em (misura stimata): la
// carta chiusa rimpicciolisce la scritta quanto basta perché ci stia
// intera. Sul test i nomi delle sezioni sono quelli della cassa, in
// maiuscolo («AMERICANI», «DISTILLATI»), e alla misura piena andavano a
// capo a metà parola («AMERICA NI»), come la prima volta («Suggeri ti»).
// Una maiuscola occupa molto più di una minuscola: le si stimano diverse.
const LARGHEZZA = (c) => (/[A-ZÀ-Ý]/.test(c) ? 0.74 : /[a-zß-ÿ]/.test(c) ? 0.5 : 0.4)
export function misuraNome(nome) {
  const parole = String(nome || '').split(/\s+/)
  return Math.max(0, ...parole.map((p) => [...p].reduce((s, c) => s + LARGHEZZA(c), 0)))
}

// Le sezioni del contratto (contrattoStile.js), ognuna col suo seme e il
// suo valore, nell'ordine del menù.
export function carteDelMazzo(sezioni) {
  const gruppi = new Map()
  const usati = new Map()
  return sezioni.map((s) => {
    const chiave = s.gruppo ? `g:${s.gruppo}` : `s:${s.id}`
    if (!gruppi.has(chiave)) gruppi.set(chiave, gruppi.size)
    const seme = SEMI[gruppi.get(chiave) % SEMI.length]
    const n = usati.get(seme.id) || 0
    usati.set(seme.id, n + 1)
    return { ...s, seme, valore: VALORI[n % VALORI.length] }
  })
}
