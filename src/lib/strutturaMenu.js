// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025): come si divide e cosa
// mostra il menù che si legge al tavolo.
//
// Flavio, 04/11/2026: «non metterò tutto quello che ho nel menù gestionale
// sul menù di sala»; «gin e vodka, che ho insieme nel gestionale solo
// perché li ho vicini a livello logistico, nel menù vanno separati». Il
// gestionale è fatto per il banco: voci-prezzo («SOUR 7», «DRINK 8
// PREMIUM»), gin tonic chiamati col solo nome del gin, shot e bottiglie che
// al tavolo non si ordinano.
//
// Prima era una «carta» a parte, poi una «composizione» da scegliere come
// uno stile. L'utente, ancora il 04/11/2026: è «solo una disposizione degli
// elementi del menù e come strutturare le varie sezioni», quindi i due
// menù sono UNO, con la struttura personalizzabile. Le sue scelte:
//
// · SEZIONI MISTE. Una sezione o SEGUE una categoria del gestionale (ne
//   mostra i prodotti disponibili, anche quelli aggiunti dopo), o ha le voci
//   SCELTE A MANO (Signature, Suggeriti dallo staff). Di suo il menù ha una
//   sezione per categoria: chi non tocca niente vede il menù di sempre. Le
//   categorie che nessuna sezione segue compaiono in fondo, così una
//   categoria nuova non sparisce dal menù senza che nessuno l'abbia deciso.
// · I TESTI SUL PRODOTTO, col RITOCCO nelle sezioni a mano. Il nome per il
//   cliente (`nome_cliente`), la descrizione e gli ingredienti in carta
//   stanno sulla scheda prodotto e valgono ovunque; una voce scelta a mano
//   può dire i suoi («Gin Fizz» e «Tom Collins» in carta, tutti e due su
//   «SOUR 7»). Gli ingredienti di una voce a mano non vengono mai dalla
//   ricetta (ingredientiCarta.js).
//
// Una sezione ha anche un modo di mostrarsi: «dettagliata» (immagine,
// descrizione, ingredienti) o «snella» (nome e prezzo: acqua e Coca-Cola
// non hanno niente da raccontare), e può essere nascosta.
//
// Qui la logica pura; le letture e le scritture stanno in api.js (le
// collezioni si chiamano ancora `carta_sezioni` e `carta_voci`), la pagina
// in MenuPage.jsx, la gestione in StrutturaMenu.jsx.

export const VISTE_SEZIONE = [
  { id: 'dettagliata', label: 'Dettagliata' },
  { id: 'snella', label: 'Snella' },
]
export const vistaSezione = (v) => (v === 'snella' ? 'snella' : 'dettagliata')

export const PERCORSO_ANTEPRIMA = '/menu?vista=cliente'

const testo = (v) => (typeof v === 'string' ? v.trim() : '')

// Sezioni e voci si mettono in fila allo stesso modo: l'ordine scelto, poi
// il nome, così due voci con lo stesso numero non si scambiano di posto a
// ogni lettura.
export function ordina(lista, nome = (x) => x.nome) {
  return [...(lista || [])].sort(
    (a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0) || testo(nome(a)).localeCompare(testo(nome(b)))
  )
}

// IL PRODOTTO COME LO LEGGE IL CLIENTE: col suo nome per il cliente, se ne
// ha uno. Il nome del gestionale resta in `nome_gestionale`, ed è quello
// che va nell'ordine (cart.js): il banco conosce quello.
export function perIlCliente(drink) {
  const nome = testo(drink?.nome_cliente)
  if (!nome || nome === drink.name) return drink
  return { ...drink, name: nome, nome_gestionale: drink.name }
}

// Il nome che si legge al tavolo per una voce scelta a mano: il suo, o
// quello del prodotto (già quello per il cliente).
export const nomeVoce = (voce, drink) => testo(voce?.nome) || drink?.name || ''

// UNA VOCE SCELTA A MANO, come la vede il menù: il prodotto, con sopra
// quello che la voce dice di suo. Prende l'`id` della VOCE, perché due voci
// sullo stesso prodotto sono due righe diverse (chiave, dettaglio,
// carrello); il prodotto resta in `drink_id`, ed è quello che finisce
// nell'ordine.
export function voceInSezione(voce, drink, vista = 'dettagliata') {
  const snella = vistaSezione(vista) === 'snella'
  return {
    ...drink,
    id: voce.id,
    drink_id: drink.id,
    voce_carta: voce.id,
    name: nomeVoce(voce, drink),
    nome_gestionale: drink.nome_gestionale ?? drink.name,
    description: snella ? null : testo(voce.descrizione) || drink.description || null,
    // Il ritocco, o quelli scritti sulla scheda: dalla ricetta mai.
    ingredienti: testo(voce.ingredienti) || testo(drink.ingredienti),
    ...(snella ? { snella: true } : {}),
  }
}

// Un prodotto di una sezione che segue una categoria: in una snella non si
// racconta niente.
const inSezione = (drink, vista) => (vista === 'snella' ? { ...drink, description: null, snella: true } : drink)

// LE RIGHE DELLA STRUTTURA, nell'ordine in cui compaiono: le sezioni
// scritte, poi le categorie che nessuna sezione segue, nell'ordine del
// gestionale. Queste ultime non sono scritte da nessuna parte (`id` null):
// diventano sezioni vere la prima volta che si tocca la struttura
// (StrutturaMenu.jsx). Una sezione che segue una categoria eliminata
// resta, senza prodotti, finché qualcuno non la toglie.
export function righeStruttura(sezioni, cats) {
  const scritte = ordina(sezioni).map((s) => ({ ...s, chiave: s.id }))
  const seguite = new Set(scritte.map((s) => s.categoria_id).filter(Boolean))
  const libere = [...(cats || [])]
    .filter((c) => !seguite.has(c.id))
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || (a.name || '').localeCompare(b.name || ''))
    .map((c) => ({
      id: null,
      chiave: `categoria:${c.id}`,
      categoria_id: c.id,
      nome: '',
      vista: 'dettagliata',
      nascosta: false,
    }))
  return [...scritte, ...libere]
}

// Il nome di una sezione: il suo, o quello della categoria che segue.
export function nomeSezione(riga, cats) {
  if (testo(riga?.nome)) return testo(riga.nome)
  const cat = (cats || []).find((c) => c.id === riga?.categoria_id)
  return cat?.name || 'Senza nome'
}

// La struttura è PERSONALIZZATA quando c'è almeno una sezione scritta.
// Senza, il menù si divide per categorie come è sempre stato.
export const strutturaPersonalizzata = (carta) => Boolean(carta?.sezioni?.length)

// LE SEZIONI DEL MENÙ, nella forma che la pagina sa già disegnare:
// [nome, voci, { id, vista }]. I `drinks` sono quelli del menù, cioè i soli
// disponibili e già col nome per il cliente: una voce su un prodotto spento
// o esaurito sparisce da sola, come nel menù di sempre (REQ-MENU-017), e una
// sezione rimasta senza voci non si mostra. In fondo, i prodotti senza una
// categoria che esiste ancora, divisi per il nome che si portano dietro.
// Niente ricerca: nel menù c'è solo per il personale, che ordina dal
// gestionale e la struttura non la vede.
export function sezioniDelMenu(carta, drinks, cats) {
  const perId = new Map((drinks || []).map((d) => [d.id, d]))
  const vociPer = new Map()
  for (const v of carta?.voci || []) {
    if (!perId.has(v.drink_id)) continue
    if (!vociPer.has(v.sezione_id)) vociPer.set(v.sezione_id, [])
    vociPer.get(v.sezione_id).push(v)
  }
  const out = []
  for (const r of righeStruttura(carta?.sezioni, cats)) {
    if (r.nascosta) continue
    const vista = vistaSezione(r.vista)
    const lista = r.categoria_id
      ? (drinks || []).filter((d) => d.category_id === r.categoria_id).map((d) => inSezione(d, vista))
      : ordina(vociPer.get(r.id), (v) => nomeVoce(v, perId.get(v.drink_id))).map((v) =>
          voceInSezione(v, perId.get(v.drink_id), vista)
        )
    if (lista.length) out.push([nomeSezione(r, cats), lista, { id: r.chiave, vista }])
  }
  const esistenti = new Set((cats || []).map((c) => c.id))
  const orfani = new Map()
  for (const d of drinks || []) {
    if (esistenti.has(d.category_id)) continue
    const nome = d.category || 'Altro'
    if (!orfani.has(nome)) orfani.set(nome, [])
    orfani.get(nome).push(d)
  }
  for (const [nome, lista] of orfani) out.push([nome, lista, { id: `orfani:${nome}`, vista: 'dettagliata' }])
  return out
}
