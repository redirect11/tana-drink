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
// uno stile, poi un menù con sezioni che seguivano una categoria della cassa
// accanto a sezioni con le voci scelte a mano. L'utente, 05/11/2026: «vorrei
// che sia libero … partiamo dal prepopolare il menu con le voci di cassa,
// poi posso aggiungere le categorie che mi pare, spostare i drink tra le
// categorie e creare altri drink, ma tutti devono obbligatoriamente essere
// connessi a un item del menu cassa. Voglio completa flessibilità». Quindi:
//
// · FINCHÉ NESSUNO LA TOCCA, il menù dei clienti si divide per le categorie
//   della cassa, come è sempre stato (nessuna sezione scritta).
// · PER PERSONALIZZARLO si parte da una copia (`prepopolazione`): una
//   sezione per categoria, con dentro tutti i suoi prodotti come voci. Da lì
//   tutto è libero: sezioni nuove, rinominate, nascoste, spostate; voci
//   spostate da una sezione all'altra, aggiunte, tolte, rinominate; lo
//   stesso prodotto in più sezioni.
// · OGNI VOCE È COLLEGATA A UN PRODOTTO DELLA CASSA: da lì prende prezzo e
//   disponibilità, ed è quello che arriva al banco (cart.js).
// · I TESTI stanno sulla scheda prodotto (`nome_cliente`, descrizione,
//   ingredienti in carta) e valgono ovunque; una voce può ritoccarli per la
//   sua sezione. Gli ingredienti di una voce non vengono mai dalla ricetta
//   (ingredientiCarta.js).
//
// Il prezzo della libertà: un prodotto nuovo in cassa non entra da solo nel
// menù dei clienti. Per non perderlo, l'editor elenca quelli rimasti fuori
// (`fuoriDalMenu`).
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

// Il nome che si legge al tavolo per una voce: il suo, o quello del
// prodotto (già quello per il cliente).
export const nomeVoce = (voce, drink) => testo(voce?.nome) || drink?.name || ''

// Il nome di una sezione. Vuoto non dovrebbe esserlo mai (l'editor non lo
// lascia svuotare), ma una sezione scritta da uno script può esserlo.
export const nomeSezione = (sezione) => testo(sezione?.nome) || 'Senza nome'

// UNA VOCE, come la vede il menù: il prodotto, con sopra quello che la voce
// dice di suo. Prende l'`id` della VOCE, perché due voci sullo stesso
// prodotto sono due righe diverse (chiave, dettaglio, carrello); il
// prodotto resta in `drink_id`, ed è quello che finisce nell'ordine.
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

// La struttura è PERSONALIZZATA quando c'è almeno una sezione scritta.
// Senza, il menù si divide per categorie come è sempre stato.
export const strutturaPersonalizzata = (carta) => Boolean(carta?.sezioni?.length)

// LA COPIA DI PARTENZA: una sezione per categoria della cassa, nel loro
// ordine e col loro nome, e dentro tutti i prodotti, spenti compresi (al
// tavolo non si vedono, e tornano da soli quando si riaccendono). I
// prodotti senza una categoria che esiste ancora vanno in fondo, divisi per
// il nome di categoria che si portano dietro. Le voci non hanno testi
// propri: valgono quelli della scheda. `chiave` lega le voci alla loro
// sezione finché non hanno un id; `categoria_id` dice da quale categoria
// viene la sezione, e serve solo a chi costruisce (la demo).
export function prepopolazione(drinks, cats) {
  const perNome = (a, b) => (a.name || '').localeCompare(b.name || '')
  const gruppi = [...(cats || [])]
    .sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || perNome(a, b))
    .map((c) => ({ chiave: `categoria:${c.id}`, categoria_id: c.id, nome: c.name, prodotti: [] }))
  const perCategoria = new Map(gruppi.map((g) => [g.categoria_id, g]))
  const orfani = new Map()
  for (const d of drinks || []) {
    let g = perCategoria.get(d.category_id)
    if (!g) {
      const nome = d.category || 'Altro'
      if (!orfani.has(nome)) orfani.set(nome, { chiave: `altro:${nome}`, categoria_id: null, nome, prodotti: [] })
      g = orfani.get(nome)
    }
    g.prodotti.push(d)
  }
  const pieni = [...gruppi, ...orfani.values()].filter((g) => g.prodotti.length)
  return {
    sezioni: pieni.map((g, i) => ({
      chiave: g.chiave,
      categoria_id: g.categoria_id,
      nome: g.nome,
      ordine: i,
      vista: 'dettagliata',
      nascosta: false,
    })),
    voci: pieni.flatMap((g) =>
      g.prodotti.sort(perNome).map((d, j) => ({ sezione: g.chiave, drink_id: d.id, ordine: j }))
    ),
  }
}

// I PRODOTTI DELLA CASSA CHE NON SONO IN NESSUNA VOCE: quelli aggiunti dopo
// la copia, o tolti da tutte le sezioni. Al tavolo non si vedono, e senza
// questo elenco nessuno se ne accorgerebbe.
export function fuoriDalMenu(carta, drinks) {
  const dentro = new Set((carta?.voci || []).map((v) => v.drink_id))
  return (drinks || []).filter((d) => !dentro.has(d.id))
}

// LE SEZIONI DEL MENÙ, nella forma che la pagina sa già disegnare:
// [nome, voci, { id, vista }]. I `drinks` sono quelli del menù, cioè i soli
// disponibili e già col nome per il cliente: una voce su un prodotto spento
// o esaurito sparisce da sola, come nel menù di sempre (REQ-MENU-017), e una
// sezione rimasta senza voci non si mostra. Niente ricerca: nel menù c'è
// solo per il personale, che ordina dal gestionale e la struttura non la
// vede.
export function sezioniDelMenu(carta, drinks) {
  const perId = new Map((drinks || []).map((d) => [d.id, d]))
  const vociPer = new Map()
  for (const v of carta?.voci || []) {
    if (!perId.has(v.drink_id)) continue
    if (!vociPer.has(v.sezione_id)) vociPer.set(v.sezione_id, [])
    vociPer.get(v.sezione_id).push(v)
  }
  const out = []
  for (const s of ordina(carta?.sezioni)) {
    if (s.nascosta) continue
    const vista = vistaSezione(s.vista)
    const lista = ordina(vociPer.get(s.id), (v) => nomeVoce(v, perId.get(v.drink_id))).map((v) =>
      voceInSezione(v, perId.get(v.drink_id), vista)
    )
    if (lista.length) out.push([nomeSezione(s), lista, { id: s.id, vista }])
  }
  return out
}
