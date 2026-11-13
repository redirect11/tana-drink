// LA STRUTTURA DEL MENÙ DEI CLIENTI (REQ-MENU-025): come si divide e cosa
// mostra il menù che si legge al tavolo.
//
// Flavio, 04/11/2026: «non metterò tutto quello che ho nel menù gestionale
// sul menù di sala»; «gin e vodka, che ho insieme nel gestionale solo
// perché li ho vicini a livello logistico, nel menù vanno separati». Il
// gestionale è fatto per il banco: voci-prezzo («SOUR 7», «DRINK 8
// PREMIUM»), gin tonic chiamati col solo nome del gin, shot e bottiglie che
// al tavolo non si ordinano. L'utente, 05/11/2026: «vorrei che sia libero …
// partiamo dal prepopolare il menu con le voci di cassa … ma tutti devono
// obbligatoriamente essere connessi a un item del menu cassa». (Le forme
// provate prima — una carta a parte, una «composizione» come uno stile,
// sezioni che seguivano una categoria — stanno nel registro, REQ-MENU-025.)
//
// · FINCHÉ NESSUNO LA TOCCA, il menù dei clienti si divide per le categorie
//   della cassa, come è sempre stato (nessuna sezione scritta).
// · PER PERSONALIZZARLO si parte da una copia (`prepopolazione`), che è quel
//   menù per categorie scritto come struttura. Da lì tutto è libero:
//   sezioni nuove, rinominate, nascoste, spostate; voci spostate da una
//   sezione all'altra, aggiunte, tolte, rinominate; lo stesso prodotto in
//   più sezioni.
// · OGNI VOCE È COLLEGATA A UN PRODOTTO DELLA CASSA: da lì prende prezzo e
//   disponibilità, ed è quello che arriva al banco (cart.js).
// · I TESTI stanno sulla scheda prodotto (`nome_cliente`, descrizione,
//   ingredienti in carta) e valgono ovunque; una voce può ritoccarli per la
//   sua sezione.
//
// Il prezzo della libertà: un prodotto nuovo in cassa non entra da solo nel
// menù dei clienti. Per non perderlo, l'editor elenca quelli rimasti fuori
// (`fuoriDalMenu`).
//
// Una sezione ha anche un modo di mostrarsi: «dettagliata» (immagine,
// descrizione, ingredienti) o «snella» (nome e prezzo: acqua e Coca-Cola
// non hanno niente da raccontare), e può essere nascosta.
//
// E può stare in un GRUPPO (REQ-MENU-030): un livello sopra le sezioni,
// «Cocktail», «Distillati», «Cucina», che un menù impaginato per macro
// categoria mostra una pagina per gruppo (e che servirà ai quattro semi del
// mazzo di carte di Flavio, REQ-MENU-029). Il gruppo è un nome scritto sulla
// sezione, non un documento a parte: l'ordine dei gruppi è quello della loro
// prima sezione, così non c'è un secondo ordine da tenere d'accordo col
// primo. Senza gruppi non cambia niente.
//
// Qui la logica pura; le letture e le scritture stanno in api.js (le
// collezioni si chiamano ancora `carta_sezioni` e `carta_voci`), la pagina
// in MenuPage.jsx, la gestione in StrutturaMenu.jsx.

import { perNome } from './macros.js'
import { normName } from './nameMatch.js'
import { ingredientiDellaVoce, etichettaPulita, etichetteConScelta } from './etichetteIngredienti.js'

export const VISTE_SEZIONE = [
  { id: 'dettagliata', label: 'Dettagliata' },
  { id: 'snella', label: 'Snella' },
]
export const vistaSezione = (v) => (v === 'snella' ? 'snella' : 'dettagliata')

export const PERCORSO_ANTEPRIMA = '/menu?vista=cliente'

export const testo = (v) => (typeof v === 'string' ? v.trim() : '')

// I prodotti della cassa senza categoria, nella copia di partenza e nella
// tendina dei prodotti: una sezione col suo nome, in fondo, da smistare
// (l'utente, 10/11/2026: «quelli fuori categoria li mettiamo in una
// categoria non categorizzati»).
export const NON_CATEGORIZZATI = 'Non categorizzati'

// Sezioni e voci si mettono in fila allo stesso modo: l'ordine scelto, poi
// il nome, così due voci con lo stesso numero non si scambiano di posto a
// ogni lettura.
export function ordina(lista, nome = (x) => x.nome) {
  return [...(lista || [])].sort(
    (a, b) =>
      (Number(a.ordine) || 0) - (Number(b.ordine) || 0) || perNome({ name: testo(nome(a)) }, { name: testo(nome(b)) })
  )
}

// SU E GIÙ: si scambia col vicino e si rinumera tutta la lista, perché le
// voci scritte da uno script, o aggiunte in fretta, possono avere lo stesso
// numero d'ordine (e le sezioni nuove, messe in cima, uno negativo), e due
// numeri uguali non si scambiano. Torna solo chi cambia davvero, da
// scrivere in un pacchetto solo.
export function riordino(lista, idx, dir) {
  const j = idx + dir
  if (j < 0 || j >= lista.length) return []
  const nuova = [...lista]
  ;[nuova[idx], nuova[j]] = [nuova[j], nuova[idx]]
  return nuova.flatMap((x, k) => (Number(x.ordine) === k ? [] : [{ id: x.id, ordine: k }]))
}

// I PRODOTTI PER CATEGORIA, come li divide il menù di sempre: il nome della
// categoria, o quello che il prodotto si porta dietro se la sua non c'è
// più; le categorie nel loro ordine, quelle sparite in fondo. È lo stesso
// raggruppamento per la pagina, per la copia di partenza e per la tendina
// dei prodotti: la copia deve venire uguale al menù che il cliente vedeva.
export function perCategoria(drinks, cats, altro = 'Altro') {
  const byId = new Map((cats || []).map((c) => [c.id, c]))
  const gruppi = new Map()
  for (const d of drinks || []) {
    const cat = byId.get(d.category_id)
    const nome = cat?.name || d.category || altro
    if (!gruppi.has(nome)) gruppi.set(nome, { nome, sort: cat ? cat.sort_order : 9999, prodotti: [] })
    gruppi.get(nome).prodotti.push(d)
  }
  return [...gruppi.values()].sort((a, b) => a.sort - b.sort || perNome({ name: a.nome }, { name: b.nome }))
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

// Il gruppo di una sezione, o null se non ne ha uno.
export const nomeGruppo = (sezione) => testo(sezione?.gruppo).slice(0, 40) || null

// I gruppi già scritti, nell'ordine della loro prima sezione: sono le
// proposte della tendina dell'editor.
export function gruppiScritti(sezioni) {
  return [...new Set(ordina(sezioni).map(nomeGruppo).filter(Boolean))]
}

// UNA VOCE, come la vede il menù: il prodotto, con sopra quello che la voce
// dice di suo, già pronta da mostrare. Prende l'`id` della VOCE, perché due
// voci sullo stesso prodotto sono due card diverse (chiave, dettaglio); il
// prodotto resta in `drink_id`, ed è quello che finisce nell'ordine.
// Gli ingredienti sono le etichette della voce (REQ-MENU-040), se le ha,
// altrimenti il ritocco o quelli scritti sulla scheda; mai la ricetta da
// sola (Flavio, 04/11/2026: «non li devi prendere dalla ricetta, vanno
// messi a mano» — quella del gin tonic porta la tonica, quella di «SOUR 7»
// non è il drink in carta): senza `recipe_items`, ingredientiCarta.js non
// ha una ricetta su cui ripiegare. In una sezione snella non si racconta
// niente.
export function voceInSezione(voce, drink, vista = 'dettagliata') {
  const snella = vista === 'snella'
  return {
    ...drink,
    id: voce.id,
    drink_id: drink.id,
    name: nomeVoce(voce, drink),
    nome_gestionale: drink.nome_gestionale ?? drink.name,
    description: snella ? null : testo(voce.descrizione) || drink.description || null,
    ingredienti: snella ? '' : ingredientiDellaVoce(voce, drink),
    recipe_items: [],
    // Le etichette su cui il cliente sceglie (REQ-MENU-042), in ogni vista:
    // anche dalla riga snella si aggiunge al carrello.
    etichette_scelta: etichetteConScelta(voce.etichette),
  }
}

// La struttura è PERSONALIZZATA quando c'è almeno una sezione scritta.
// Senza, il menù si divide per categorie come è sempre stato.
export const strutturaPersonalizzata = (carta) => Boolean(carta?.sezioni?.length)

// LE FORME DEI DOCUMENTI, una volta sola per l'app (api.js) e per la demo.
export const sezioneDaScrivere = ({ nome = '', ordine = 0, vista, nascosta = false, gruppo = null }) => ({
  nome: String(nome || '').trim(),
  ordine,
  vista: vistaSezione(vista),
  nascosta: nascosta === true,
  gruppo: nomeGruppo({ gruppo }),
})
export const voceDaScrivere = ({ sezione_id, drink_id, nome = '', descrizione = '', ingredienti = '', ordine = 0 }) => ({
  sezione_id,
  drink_id,
  nome: String(nome || '').trim(),
  descrizione,
  ingredienti,
  ordine,
})

// LA COPIA DI PARTENZA: il menù per categorie (`perCategoria`) scritto come
// struttura. Una sezione per gruppo, nel suo ordine e col suo nome, e
// dentro tutti i prodotti, spenti compresi (al tavolo non si vedono, e
// tornano da soli quando si riaccendono). Le voci non hanno testi propri:
// valgono quelli della scheda. `chiave` lega le voci alla loro sezione
// finché non hanno un id (`materializza`).
export function prepopolazione(drinks, cats) {
  const gruppi = perCategoria(drinks, cats, NON_CATEGORIZZATI)
  return {
    sezioni: gruppi.map((g, i) => ({ chiave: `categoria:${g.nome}`, nome: g.nome, ordine: i, vista: 'dettagliata', nascosta: false })),
    voci: gruppi.flatMap((g) => g.prodotti.map((d, j) => ({ sezione: `categoria:${g.nome}`, drink_id: d.id, ordine: j }))),
  }
}

// La copia con gli id, nella forma dei documenti: `nuovoId(tipo, elemento)`
// li fa (casuali per l'app, fissi per la demo).
export function materializza({ sezioni, voci }, nuovoId) {
  const idDi = new Map()
  const scritte = (sezioni || []).map((s) => {
    const id = nuovoId('sezione', s)
    idDi.set(s.chiave, id)
    return { id, ...sezioneDaScrivere(s) }
  })
  const scritteVoci = (voci || [])
    .filter((v) => idDi.has(v.sezione))
    .map((v) => {
      const voce = voceDaScrivere({ ...v, sezione_id: idDi.get(v.sezione) })
      return { id: nuovoId('voce', voce), ...voce }
    })
  return { sezioni: scritte, voci: scritteVoci }
}

// LE VOCI CHE CONTANO: quelle in una sezione che c'è. Una voce rimasta senza
// sezione (una cancellazione a metà) non si vede da nessuna parte, e il suo
// prodotto è fuori dal menù come gli altri.
export function vociValide(carta) {
  const sezioni = new Set((carta?.sezioni || []).map((s) => s.id))
  return (carta?.voci || []).filter((v) => sezioni.has(v.sezione_id))
}

// Le voci di ogni sezione, in fila: `nome` dice come si chiama una voce,
// per mettere in fila quelle con lo stesso numero d'ordine.
export function vociPerSezione(voci, nome = (v) => v.nome) {
  const per = new Map()
  for (const v of voci || []) {
    if (!per.has(v.sezione_id)) per.set(v.sezione_id, [])
    per.get(v.sezione_id).push(v)
  }
  for (const [k, l] of per) per.set(k, ordina(l, nome))
  return per
}

// Il numero d'ordine di una voce messa in fondo alla sua sezione.
export const inFondo = (carta, sezioneId) => (carta?.voci || []).filter((v) => v.sezione_id === sezioneId).length

// LA CATEGORIA DELLA CASSA CHE PORTA IL NOME DELLA SEZIONE, per il
// prodotto nuovo creato dall'editor (REQ-MENU-036): le sezioni nascono
// dalle categorie (prepopolazione), e un prodotto nuovo in «Gin» va quasi
// sempre nella categoria Gin. Il confronto ignora maiuscole e accenti;
// senza una categoria con quel nome, nessuna.
export function categoriaDellaSezione(sezione, categories) {
  const nome = normName(nomeSezione(sezione))
  return (categories || []).find((c) => normName(c.name) === nome) || null
}

// PIÙ VOCI SPOSTATE INSIEME in una sezione (REQ-MENU-035): vanno in fondo,
// nell'ordine in cui stavano nel menù, così un blocco di gin portato via
// dai «Distillati» arriva nella sezione nuova nella fila di prima. Quelle
// già lì e gli id che non ci sono più non si toccano. Torna i cambi da
// scrivere in un pacchetto solo.
export function spostamentoInBlocco(carta, ids, sezioneId) {
  const scelte = new Set(ids)
  const per = vociPerSezione(carta?.voci)
  const base = inFondo(carta, sezioneId)
  return ordina(carta?.sezioni)
    .filter((s) => s.id !== sezioneId)
    .flatMap((s) => (per.get(s.id) || []).filter((v) => scelte.has(v.id)))
    .map((v, k) => ({ id: v.id, sezione_id: sezioneId, ordine: base + k }))
}

// LA RICERCA NELL'EDITOR: una voce si trova col nome che legge il cliente
// o con quello della cassa, senza badare a maiuscole, accenti e
// punteggiatura (normName, lo stesso confronto del listino fornitori).
export function voceTrovata(voce, drink, cerca) {
  const q = normName(cerca)
  if (!q) return true
  return [testo(voce?.nome), drink?.nome_cliente, drink?.name].some((n) => normName(n).includes(q))
}

// I PRODOTTI DELLA CASSA CHE NON SONO IN NESSUNA VOCE: quelli aggiunti dopo
// la copia, o tolti da tutte le sezioni. Al tavolo non si vedono, e senza
// questo elenco nessuno se ne accorgerebbe.
export function fuoriDalMenu(carta, drinks) {
  const dentro = new Set(vociValide(carta).map((v) => v.drink_id))
  return (drinks || []).filter((d) => !dentro.has(d.id))
}

// LE SEZIONI DEL MENÙ, nella forma che la pagina sa già disegnare:
// [nome, voci, { id, vista, gruppo }]. I `drinks` sono quelli del menù, cioè i soli
// disponibili e già col nome per il cliente: una voce su un prodotto spento
// o esaurito sparisce da sola, come nel menù di sempre (REQ-MENU-017), e una
// sezione rimasta senza voci non si mostra. Niente ricerca: nel menù c'è
// solo per il personale, che ordina dal gestionale e la struttura non la
// vede.
export function sezioniDelMenu(carta, drinks) {
  const perId = new Map((drinks || []).map((d) => [d.id, d]))
  const vociPer = vociPerSezione(
    (carta?.voci || []).filter((v) => perId.has(v.drink_id)),
    (v) => nomeVoce(v, perId.get(v.drink_id))
  )
  const out = []
  for (const s of ordina(carta?.sezioni)) {
    if (s.nascosta) continue
    const vista = vistaSezione(s.vista)
    const lista = (vociPer.get(s.id) || []).map((v) => voceInSezione(v, perId.get(v.drink_id), vista))
    if (lista.length) out.push([nomeSezione(s), lista, { id: s.id, vista, gruppo: nomeGruppo(s) }])
  }
  return out
}

// ── LE PAGINE DEL MENÙ (REQ-MENU-030) ────────────────────────────────
// Con l'impaginazione del tema le sezioni del menù (nella forma di
// `sezioniDelMenu`, o le categorie della cassa) si dividono in pagine:
// una per sezione, o una per gruppo. Una sezione senza gruppo fa pagina da
// sé, col suo nome; senza nessun gruppo scritto, una pagina per gruppo vale
// come una per sezione. Con una pagina sola non c'è niente da sfogliare, e
// torna null, come per il menù tutto in una pagina.
export function pagineDelMenu(sezioni, impaginazione) {
  if (impaginazione !== 'per-categoria' && impaginazione !== 'per-macro-categoria') return null
  const perGruppo = impaginazione === 'per-macro-categoria'
  const pagine = []
  const diGruppo = new Map()
  for (const s of sezioni || []) {
    const [nome, , meta] = s
    const gruppo = perGruppo ? meta?.gruppo : null
    if (gruppo && diGruppo.has(gruppo)) {
      diGruppo.get(gruppo).sezioni.push(s)
      continue
    }
    const pagina = gruppo
      ? { id: `gruppo:${gruppo}`, nome: gruppo, sezioni: [s] }
      : { id: `sezione:${meta?.id ?? nome}`, nome, sezioni: [s] }
    if (gruppo) diGruppo.set(gruppo, pagina)
    pagine.push(pagina)
  }
  return pagine.length > 1 ? pagine : null
}

// ── LA CATEGORIA DI UNA VOCE, E LE SEZIONI CHE NE NASCONO (REQ-MENU-041) ──
//
// Daniele, 13/11/2026: la categoria di una voce si sceglie (una di
// magazzino, una della cassa) o si scrive libera; senza, vale quella del
// prodotto della cassa collegato. Da lì «Raggruppa per categoria» crea le
// sezioni che mancano e ci sposta le voci. I gruppi restano liberi, del
// solo menù dei clienti.

const TIPI_CATEGORIA = ['categoria', 'categoria_cassa', 'testo']

// La categoria scritta sulla voce, pulita, o null.
export function categoriaScritta(c) {
  const e = etichettaPulita(c)
  return e && TIPI_CATEGORIA.includes(e.tipo) ? e : null
}

// Il nome della categoria di una voce: la sua, o quella del prodotto.
export function categoriaDellaVoce(voce, drink, categorieCassa = []) {
  const propria = categoriaScritta(voce?.categoria)
  if (propria) return propria.nome
  const cat = categorieCassa.find((c) => c.id === drink?.category_id)
  return testo(cat?.name) || testo(drink?.category) || null
}

// La sezione che porta il nome di una categoria, se c'è.
export function sezioneDellaCategoria(sezioni, nome) {
  const cercato = normName(nome)
  return cercato ? (sezioni || []).find((s) => normName(nomeSezione(s)) === cercato) || null : null
}

// IL RAGGRUPPAMENTO: le sezioni da creare (in fondo, col nome della
// categoria) e le voci da spostare, ognuna in fondo alla sua sezione
// nuova, nell'ordine in cui stava nel menù. Le voci senza categoria, e
// quelle già nella sezione giusta, non si toccano.
export function raggruppamentoPerCategoria(carta, drinks, categorieCassa = []) {
  const perId = new Map((drinks || []).map((d) => [d.id, d]))
  const sezioni = ordina(carta?.sezioni)
  const nuove = []
  const daCreare = new Map()
  const fondo = new Map()
  const spostamenti = []
  const per = vociPerSezione(vociValide(carta))
  for (const s of sezioni) {
    for (const v of per.get(s.id) || []) {
      const nome = categoriaDellaVoce(v, perId.get(v.drink_id), categorieCassa)
      if (!nome) continue
      let dest = sezioneDellaCategoria(sezioni, nome)?.id
      if (!dest) {
        const k = normName(nome)
        if (!daCreare.has(k)) {
          const chiave = `categoria:${nome}`
          daCreare.set(k, chiave)
          nuove.push({ chiave, nome, ordine: sezioni.length + nuove.length })
          fondo.set(chiave, 0)
        }
        dest = daCreare.get(k)
      }
      if (dest === v.sezione_id) continue
      if (!fondo.has(dest)) fondo.set(dest, inFondo(carta, dest))
      spostamenti.push({ id: v.id, sezione: dest, ordine: fondo.get(dest) })
      fondo.set(dest, fondo.get(dest) + 1)
    }
  }
  return { nuove, spostamenti }
}
