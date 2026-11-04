// LA CARTA DI SALA (REQ-MENU-025): il menù che si legge al tavolo, fatto
// di sezioni e voci SUE invece che delle categorie del gestionale. È la
// composizione «Di sala» del menù (composizioneMenu.js): non un menù a
// parte, ma un modo di comporre lo stesso menù, che si sceglie come uno
// stile.
//
// Flavio, 04/11/2026: «non metterò tutto quello che ho nel menù gestionale
// sul menù di sala»; «gin e vodka, che ho insieme nel gestionale solo
// perché li ho vicini a livello logistico, nel menù vanno separati»; «è
// come se dovessimo agganciare ogni item del menù gestionale a un item
// creato ad hoc per il menù vista cliente». Il gestionale è fatto per il
// banco: voci-prezzo («SOUR 7», «DRINK 8 PREMIUM»), gin tonic chiamati col
// solo nome del gin, shot e bottiglie che al tavolo non si ordinano.
//
// Quindi una VOCE della carta ha il suo nome, la sua descrizione e i suoi
// ingredienti — scritti a mano, mai presi dalla ricetta (ingredientiCarta.js)
// —, ed è agganciata a UNA voce del gestionale, che dà prezzo, disponibilità
// e ricetta per il magazzino. L'aggancio è MOLTI A UNO: «Gin Fizz» e «Tom
// Collins» in carta possono finire entrambi su «SOUR 7». Quello che non è
// agganciato al tavolo non si vede, e quindi non si ordina.
//
// Una SEZIONE ha un nome, un ordine e un modo di mostrarsi: «dettagliata»
// (immagine, descrizione, ingredienti) o «snella» (nome e prezzo: acqua e
// Coca-Cola non hanno bisogno di raccontarsi).
//
// Qui la logica pura; le letture e le scritture stanno in api.js, la
// pagina in MenuPage.jsx, la gestione in CartaManager.jsx.

export const VISTE_CARTA = [
  { id: 'dettagliata', label: 'Dettagliata' },
  { id: 'snella', label: 'Snella' },
]
export const vistaCarta = (v) => (v === 'snella' ? 'snella' : 'dettagliata')

// L'anteprima per chi la compila: la vista cliente, con la carta anche
// spenta (vedi cartaInUso).

const testo = (v) => (typeof v === 'string' ? v.trim() : '')

// Sezioni e voci si mettono in fila allo stesso modo: l'ordine scelto, poi
// il nome, così due voci con lo stesso numero non si scambiano di posto a
// ogni lettura.
export function ordinaCarta(lista, nome = (x) => x.nome) {
  return [...(lista || [])].sort(
    (a, b) => (Number(a.ordine) || 0) - (Number(b.ordine) || 0) || testo(nome(a)).localeCompare(testo(nome(b)))
  )
}

// Il nome che si legge al tavolo: quello della voce, o — se la voce non ne
// ha uno — quello del gestionale.
export const nomeVoce = (voce, drink) => testo(voce?.nome) || drink?.name || ''

// LA VOCE COME LA VEDE IL MENÙ: il drink del gestionale, con sopra quello
// che la carta dice di suo. Prende l'`id` della VOCE, perché due voci
// agganciate allo stesso drink sono due righe diverse (chiave, dettaglio,
// carrello); il drink resta in `drink_id`, ed è quello che finisce
// nell'ordine. In una sezione snella non si racconta niente: niente
// descrizione e niente ingredienti (ingredientiInCarta guarda `snella`).
export function voceInCarta(voce, drink, vista = 'dettagliata') {
  const snella = vistaCarta(vista) === 'snella'
  return {
    ...drink,
    id: voce.id,
    drink_id: drink.id,
    voce_carta: voce.id,
    name: nomeVoce(voce, drink),
    nome_gestionale: drink.name,
    // La descrizione del gestionale era già scritta per il cliente (le
    // Signature): vale finché la voce non ne ha una sua.
    description: snella ? null : testo(voce.descrizione) || drink.description || null,
    ingredienti: testo(voce.ingredienti),
    ...(snella ? { snella: true } : {}),
  }
}

// LE SEZIONI DELLA CARTA, nella forma che il menù sa già disegnare:
// [nome, voci, { id, vista }]. I `drinks` sono quelli del menù, cioè i soli
// disponibili: una voce agganciata a un drink spento o esaurito sparisce
// da sola, come nel menù di sempre (REQ-MENU-017), e una sezione rimasta
// senza voci non si mostra.
export function sezioniDellaCarta(carta, drinks) {
  const perId = new Map((drinks || []).map((d) => [d.id, d]))
  const perSezione = new Map()
  for (const v of carta?.voci || []) {
    if (!perId.has(v.drink_id)) continue
    if (!perSezione.has(v.sezione_id)) perSezione.set(v.sezione_id, [])
    perSezione.get(v.sezione_id).push(v)
  }
  const out = []
  for (const s of ordinaCarta(carta?.sezioni)) {
    const voci = ordinaCarta(perSezione.get(s.id), (v) => nomeVoce(v, perId.get(v.drink_id)))
    if (!voci.length) continue
    const vista = vistaCarta(s.vista)
    out.push([testo(s.nome) || 'Senza nome', voci.map((v) => voceInCarta(v, perId.get(v.drink_id), vista)), { id: s.id, vista }])
  }
  return out
}

// LA CARTA SI USA quando la composizione del menù è «Di sala» (scelta, o
// in prova) e c'è almeno una sezione. Scelta ma vuota, il cliente vede la
// classica: chi la installa e non l'ha ancora compilata non deve trovare
// il menù vuoto.
export function cartaInUso(composizione, sezioni) {
  return composizione === 'sala' && Boolean(sezioni?.length)
}
