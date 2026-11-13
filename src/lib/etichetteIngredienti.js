// ── GLI INGREDIENTI DI UNA VOCE DEL MENÙ, A ETICHETTE (REQ-MENU-040) ──
//
// Daniele, 13/11/2026: gli ingredienti di una voce del menù dei clienti si
// scrivono a mano libera, e ognuno diventa un'ETICHETTA; mentre si scrive
// compaiono i suggerimenti. Menù dei clienti e cassa lavorano sugli stessi
// prodotti di magazzino, quindi la ricetta del prodotto collegato è la
// proposta di partenza. Resta una proposta: Flavio, 04/11/2026, «non li devi
// prendere dalla ricetta, vanno messi a mano» — la ricetta del gin tonic
// porta la tonica, quella di «SOUR 7» non è il drink in carta. Al cliente
// arrivano solo le etichette scelte.
//
// UN'ETICHETTA: { tipo, id, nome }
//   prodotto        un prodotto di magazzino (Tanqueray)
//   categoria       una categoria di magazzino (Gin)
//   categoria_cassa una categoria della cassa
//   testo           testo libero (id null)
// La scelta del cliente (REQ-MENU-042) si aggiungerà sull'etichetta.
//
// Logica pura: magazzino e categorie li passa chi chiama.

import { nomeInCarta, rigaDiServizio, ingredientiDalCampo } from './ingredientiCarta.js'

export const TIPI_ETICHETTA = ['prodotto', 'categoria', 'categoria_cassa', 'testo']

// L'ordine e il nome dei gruppi di suggerimenti: prima quello che viene
// dalla ricetta del prodotto collegato, poi il resto del magazzino, poi la
// cassa. Il nome si legge accanto al suggerimento: il colore non basta.
export const GRUPPI_SUGGERIMENTO = [
  { id: 'ricetta', nome: 'dalla ricetta' },
  { id: 'ricetta-categoria', nome: 'categoria della ricetta' },
  { id: 'prodotto', nome: 'magazzino' },
  { id: 'categoria', nome: 'categoria di magazzino' },
  { id: 'cassa', nome: 'categoria della cassa' },
]

const MAX_SUGGERIMENTI = 8

const normale = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const chiave = (e) => `${e.tipo}:${e.id ?? normale(e.nome)}`

// Un'etichetta scritta bene, o null.
export function etichettaPulita(e) {
  if (!e || typeof e !== 'object' || !TIPI_ETICHETTA.includes(e.tipo)) return null
  const nome = String(e.nome ?? '').trim().slice(0, 60)
  if (!nome) return null
  return { tipo: e.tipo, id: e.tipo === 'testo' ? null : (e.id ?? null), nome }
}

// Le etichette di una voce come stanno nel documento: un elenco pulito, o
// null se la voce non le ha mai avute (e allora vale il testo di prima).
export function etichetteDellaVoce(v) {
  if (!Array.isArray(v)) return null
  return v.map(etichettaPulita).filter(Boolean)
}

// GLI INGREDIENTI CHE LEGGE IL CLIENTE, per una voce:
//   nascosti → niente;
//   etichette scritte → i loro nomi;
//   altrimenti, come prima: il ritocco della voce o il testo della scheda.
export function ingredientiDellaVoce(voce, drink) {
  if (voce?.ingredienti_nascosti === true) return ''
  const etichette = etichetteDellaVoce(voce?.etichette)
  if (etichette) return etichette.map((e) => e.nome).join(', ')
  return String(voce?.ingredienti ?? '').trim() || String(drink?.ingredienti ?? '').trim()
}

// LA PROPOSTA DALLA RICETTA del prodotto collegato: un'etichetta per ogni
// prodotto di magazzino della ricetta, senza ghiaccio, manodopera e righe
// di servizio (le stesse regole di ingredientiCarta.js), col nome senza il
// formato («Gin Mare 70 cl» → «Gin Mare»).
export function propostaDallaRicetta(drink, items = []) {
  const perId = new Map(items.map((i) => [i.id, i]))
  const viste = new Set()
  const out = []
  for (const r of drink?.recipe_items || []) {
    if (rigaDiServizio(r)) continue
    const nome = nomeInCarta(perId.get(r.inventory_item_id)?.name ?? r.name)
    if (!nome || viste.has(normale(nome))) continue
    viste.add(normale(nome))
    out.push({ tipo: 'prodotto', id: r.inventory_item_id ?? null, nome })
  }
  return out
}

// I SUGGERIMENTI mentre si scrive: quelli il cui nome ha una parola che
// comincia come quello scritto, senza quelli già scelti, nell'ordine dei
// gruppi. Al massimo MAX_SUGGERIMENTI.
export function suggerimenti(scritto, { drink = null, items = [], categorieMagazzino = [], categorieCassa = [], scelte = [] } = {}) {
  const cercato = normale(scritto)
  if (!cercato) return []
  const parole = cercato.split(' ')
  const corrisponde = (nome) => {
    const sue = normale(nome).split(' ')
    return parole.every((p) => sue.some((w) => w.startsWith(p)))
  }
  const gia = new Set(scelte.map(chiave))
  const nomeCat = new Map(categorieMagazzino.map((c) => [c.id, c.name]))
  const ricetta = propostaDallaRicetta(drink, items)
  const idRicetta = new Set(ricetta.map((e) => e.id))
  const catRicetta = new Set(
    items.filter((i) => idRicetta.has(i.id) && i.category_id).map((i) => i.category_id)
  )
  const candidati = [
    ...ricetta.map((e) => ({ ...e, gruppo: 'ricetta' })),
    ...[...catRicetta].map((id) => ({ tipo: 'categoria', id, nome: nomeCat.get(id) ?? '', gruppo: 'ricetta-categoria' })),
    ...items.filter((i) => !idRicetta.has(i.id)).map((i) => ({ tipo: 'prodotto', id: i.id, nome: nomeInCarta(i.name), gruppo: 'prodotto' })),
    ...categorieMagazzino.filter((c) => !catRicetta.has(c.id)).map((c) => ({ tipo: 'categoria', id: c.id, nome: c.name, gruppo: 'categoria' })),
    ...categorieCassa.map((c) => ({ tipo: 'categoria_cassa', id: c.id, nome: c.name, gruppo: 'cassa' })),
  ]
  const out = []
  const visti = new Set()
  for (const c of candidati) {
    if (!c.nome || !corrisponde(c.nome)) continue
    const k = chiave(c)
    if (gia.has(k) || visti.has(k)) continue
    visti.add(k)
    out.push(c)
    if (out.length >= MAX_SUGGERIMENTI) break
  }
  return out
}

// Un'etichetta di testo libero da quello che si è scritto.
export const etichettaLibera = (scritto) => etichettaPulita({ tipo: 'testo', nome: scritto })

// Le etichette di partenza nell'editor, per una voce che non ne ha ancora:
// il testo di prima, spezzato, come etichette libere; senza, nessuna.
export function etichetteDaTesto(testo) {
  return ingredientiDalCampo(testo).map((nome) => etichettaPulita({ tipo: 'testo', nome })).filter(Boolean)
}
