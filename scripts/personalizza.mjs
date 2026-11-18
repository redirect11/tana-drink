// ── IL SITO UGUALE PER TUTTI DIVENTA IL SITO DI UN LOCALE (REQ-FLOTTA-034) ─
//
// La regia compila il sito una volta per versione (`PACCHETTO=1 npm run
// build`) e, per ogni locale, lancia questo script su una COPIA del `dist/`
// prima di pubblicarlo (interfaccia 16 di docs/contratto-regia-app.md della
// regia). Nel pacchetto per versione arriva come file solo, nella radice,
// coi suoi moduli dentro (scripts/crea-pacchetto.mjs, REQ-FLOTTA-035): la
// regia lo lancia da lì, senza un checkout del repository. Qui si lancia
// dal repository, per le prove.
//
//   node personalizza.mjs --dist <cartella> --configurazione <file.json> [--pubblica <cartella>]     # nel pacchetto
//   node scripts/personalizza.mjs --dist <cartella> --configurazione <file.json> [--pubblica <cartella>]   # dal repository
//
// Cosa fa:
//   - riempie i segnaposto `%VENUE_*%` di index.html e dell'informativa
//     privacy e cookie coi dati del locale (REQ-SIC-017);
//   - scrive il manifest della PWA dal modello;
//   - scrive la configurazione in `configurazione.json` E come blocco
//     dentro index.html, così arriva con la pagina anche al primo avvio e
//     senza rete (porte/configurazione.js);
//   - con `--pubblica`, mette i file del locale (logo, icone, copertina)
//     sopra quelli neutri; solo quei nomi, perché il controllo della regia
//     rifiuta un file che il pacchetto non dichiara.
//
// E cosa rifiuta, uscendo con 1 prima di scrivere qualunque cosa:
//   - una configurazione che l'app non seguirebbe, o con campi che non
//     conosce (configurazioneLocale.mjs: la stessa regola dell'app). Meglio
//     che lo scopra la regia pubblicando che il locale aprendo l'app;
//   - un `dist/` già personalizzato: si lavora sempre su una copia fresca,
//     o il secondo locale uscirebbe col nome del primo;
//   - un segnaposto rimasto dopo il suo passaggio;
//   - un blocco nella pagina che, riletto, non dice la configurazione
//     scritta: è la protezione del tablet senza rete, e se si rompe non
//     se ne accorge nessuno finché il tablet non parte senza locale.
//
// La logica sta in clienti/personalizzazione.mjs, la stessa che usa la build
// per un cliente: due copie avrebbero scritto due locali diversi.

import { existsSync, readFileSync, writeFileSync, readdirSync, copyFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import {
  SEGNAPOSTO,
  FILE_DEL_SET,
  PAGINE_INFORMATIVA,
  htmlPerCliente,
  manifestPerCliente,
  informativaPerCliente,
  conConfigurazione,
} from '../clienti/personalizzazione.mjs'
import { ID_BLOCCO, problemiConfigurazione } from '../src/porte/configurazioneLocale.mjs'

const FILE_CONFIGURAZIONE = 'configurazione.json'
const MANIFEST = 'manifest.webmanifest'

export class ErrorePersonalizzazione extends Error {
  constructor(problemi) {
    super(problemi.join('\n'))
    this.problemi = problemi
  }
}

export function leggiArgomenti(argv) {
  const a = {}
  for (let i = 0; i < argv.length; i++) {
    const [nome, valore] = argv[i].startsWith('--') && argv[i].includes('=') ? argv[i].split(/=(.*)/s) : [argv[i], argv[i + 1]]
    if (!['--dist', '--configurazione', '--pubblica'].includes(nome)) throw new ErrorePersonalizzazione([`argomento sconosciuto: ${argv[i]}`])
    if (!valore || valore.startsWith('--')) throw new ErrorePersonalizzazione([`${nome} vuole una cartella o un file`])
    a[nome.slice(2)] = valore
    if (!argv[i].includes('=')) i++
  }
  if (!a.dist || !a.configurazione) throw new ErrorePersonalizzazione(['servono --dist <cartella> e --configurazione <file.json>'])
  return a
}

const leggiTesto = (f) => readFileSync(f, 'utf8')

// Il blocco come lo leggerà l'app: il testo fra il tag e la sua chiusura,
// come JSON. Uguale alla configurazione, o niente.
export function bloccoUguale(html, config) {
  const m = html.match(new RegExp(`<script id="${ID_BLOCCO}" type="application/json">([\\s\\S]*?)</script>`))
  try {
    return Boolean(m) && JSON.stringify(JSON.parse(m[1])) === JSON.stringify(config)
  } catch {
    return false
  }
}

// Tutto in memoria prima, poi si scrive: un errore a metà non deve lasciare
// un `dist/` mezzo personalizzato.
export function preparaPersonalizzazione({ dist, configurazione, pubblica = null }) {
  const problemi = []
  const cartella = resolve(dist)
  const indice = join(cartella, 'index.html')
  if (!existsSync(indice)) throw new ErrorePersonalizzazione([`${cartella} non ha index.html: non è il dist/ del sito`])

  let config
  try {
    config = JSON.parse(leggiTesto(resolve(configurazione)))
  } catch (e) {
    throw new ErrorePersonalizzazione([`configurazione illeggibile (${configurazione}): ${e.message}`])
  }
  problemi.push(...problemiConfigurazione(config).map((p) => `configurazione: ${p}`))

  const html = leggiTesto(indice)
  if (!html.includes('%VENUE_NAME%') || existsSync(join(cartella, FILE_CONFIGURAZIONE))) {
    problemi.push('il dist/ è già personalizzato (o non è il sito uguale per tutti): serve una copia fresca del pacchetto')
  }
  for (const f of [MANIFEST, ...PAGINE_INFORMATIVA]) if (!existsSync(join(cartella, f))) problemi.push(`manca ${f} nel dist/`)

  const set = new Map()
  if (pubblica) {
    const sorgente = resolve(pubblica)
    if (!existsSync(sorgente) || !statSync(sorgente).isDirectory()) problemi.push(`--pubblica: ${sorgente} non è una cartella`)
    else {
      for (const nome of readdirSync(sorgente)) {
        if (FILE_DEL_SET.includes(nome)) set.set(nome, join(sorgente, nome))
        else problemi.push(`--pubblica: ${nome} non è un file del locale (ammessi: ${FILE_DEL_SET.join(', ')})`)
      }
    }
  }
  if (problemi.length) throw new ErrorePersonalizzazione(problemi)

  const venue = config.venue
  const scritti = new Map()
  scritti.set('index.html', conConfigurazione(htmlPerCliente(html, venue), config))
  scritti.set(MANIFEST, `${JSON.stringify(manifestPerCliente(JSON.parse(leggiTesto(join(cartella, MANIFEST))), venue), null, 2)}\n`)
  for (const f of PAGINE_INFORMATIVA) scritti.set(f, informativaPerCliente(leggiTesto(join(cartella, f)), venue))
  scritti.set(FILE_CONFIGURAZIONE, `${JSON.stringify(config, null, 2)}\n`)

  const rimasti = [...scritti].filter(([, testo]) => SEGNAPOSTO.test(testo)).map(([f, testo]) => `${f}: resta ${testo.match(SEGNAPOSTO)[0]}`)
  if (rimasti.length) throw new ErrorePersonalizzazione(rimasti)
  if (!bloccoUguale(scritti.get('index.html'), config)) throw new ErrorePersonalizzazione(['index.html: il blocco della configurazione, riletto, non è quello scritto'])

  return { cartella, scritti, set }
}

export function personalizza(opzioni) {
  const { cartella, scritti, set } = preparaPersonalizzazione(opzioni)
  for (const [f, testo] of scritti) writeFileSync(join(cartella, f), testo)
  for (const [nome, file] of set) copyFileSync(file, join(cartella, nome))
  return { scritti: [...scritti.keys()], copiati: [...set.keys()] }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const esito = personalizza(leggiArgomenti(process.argv.slice(2)))
    console.log(`personalizza: scritti ${esito.scritti.join(', ')}${esito.copiati.length ? `; file del locale: ${esito.copiati.join(', ')}` : ''}.`)
  } catch (e) {
    const problemi = e instanceof ErrorePersonalizzazione ? e.problemi : [e.message]
    console.error(`personalizza: niente è stato scritto.\n${problemi.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(1)
  }
}
