// ── IL NOME DELL'APP SEGUE CHI LA USA ────────────────────────────────
// Sul telefono di chi lavora l'icona in home deve dire di chi è: fra dieci
// applicazioni aperte, «La Tana del Coniglio - bartender» si riconosce a
// colpo d'occhio, e chi ha due profili (il proprio e quello del banco) non
// li confonde. Il cliente non ha suffisso: per lui è semplicemente l'app
// del locale.
//
// ATTENZIONE, non è un dettaglio: il nome dell'icona il telefono lo
// congela QUANDO SI INSTALLA. Cambiare ruolo dopo non ribattezza un'app
// già installata (su iPhone mai; su Android l'aggiornamento del manifest
// può arrivare, ma con i suoi tempi). Perché il suffisso sia quello giusto,
// l'app va installata da collegati col ruolo che serve.
//
// Logica pura: chi la usa (App.jsx) ci attacca titolo e manifest.

import { normalizzaRuolo } from './ruoli.js'

export const NOME_BASE = 'La Tana del Coniglio'

const SUFFISSO = {
  admin: 'admin',
  bartender: 'bartender',
  staff: 'staff',
}

// Nome completo per un ruolo. Cliente (o nessun accesso) = nome nudo.
export function nomeApp(ruolo) {
  const suffisso = SUFFISSO[normalizzaRuolo(ruolo)]
  return suffisso ? `${NOME_BASE} - ${suffisso}` : NOME_BASE
}

// Nome corto, quello che sta sotto l'icona: lì lo spazio è pochissimo e il
// nome per esteso viene troncato con i puntini proprio dove sta il
// suffisso — cioè l'unica parte che distingue una versione dall'altra.
export function nomeAppCorto(ruolo) {
  const suffisso = SUFFISSO[normalizzaRuolo(ruolo)]
  return suffisso ? `La Tana - ${suffisso}` : 'La Tana'
}

// Il manifest riscritto col nome giusto, a partire da quello pubblicato.
// Gli indirizzi vanno scritti PER ESTESO: il manifest riscritto viaggia come
// blob, e un `start_url` relativo verrebbe risolto contro `blob:…` — l'app
// installata partirebbe da nessuna parte, e le icone non si troverebbero.
export function manifestConNome(manifest, ruolo, base = '/') {
  const assoluto = (u) => {
    if (!u) return u
    try {
      return new URL(u, base).href
    } catch {
      return u
    }
  }
  return {
    ...manifest,
    name: nomeApp(ruolo),
    short_name: nomeAppCorto(ruolo),
    start_url: assoluto(manifest.start_url),
    scope: assoluto(manifest.scope),
    icons: (manifest.icons || []).map((i) => ({ ...i, src: assoluto(i.src) })),
  }
}

// ── Attaccarlo al documento ──────────────────────────────────────────
// Titolo (la linguetta del browser e il commutatore di app), il meta che
// usa Safari per il nome sotto l'icona, e il manifest — riscritto al volo
// perché il nome proposto all'installazione sia quello di chi sta usando
// l'app in questo momento.
let urlManifest = null

export async function applicaNomeApp(ruolo, doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return
  const nome = nomeApp(ruolo)
  doc.title = nome
  doc.querySelector('meta[name="apple-mobile-web-app-title"]')?.setAttribute('content', nome)

  const link = doc.querySelector('link[rel="manifest"]')
  if (!link || typeof fetch !== 'function' || typeof URL.createObjectURL !== 'function') return
  try {
    // L'indirizzo di partenza si ricorda: dalla seconda volta in poi
    // l'href è già un blob, e rileggerlo darebbe il manifest riscritto.
    const originale = link.dataset.manifestOriginale || link.href
    link.dataset.manifestOriginale = originale
    const risposta = await fetch(originale)
    const scritto = manifestConNome(await risposta.json(), ruolo, originale)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(scritto)], { type: 'application/manifest+json' })
    )
    if (urlManifest) URL.revokeObjectURL(urlManifest)
    urlManifest = url
    link.setAttribute('href', url)
  } catch {
    /* manifest irraggiungibile: resta quello pubblicato, col nome nudo */
  }
}
