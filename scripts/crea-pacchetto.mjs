// ── IL PACCHETTO PER VERSIONE (REQ-FLOTTA-035) ─────────────────────────────
//
// Un sito compilato UNA volta per versione, che la regia pubblica in ogni
// locale senza ricompilare (interfaccia 16 di docs/contratto-regia-app.md
// della regia). Daniele, 18/11/2026: «tana drink compila il pacchetto,
// provisiona istanza e aggiorna istanza aggiornano con il pacchetto di
// release di tana-drink». Lo lancia .github/workflows/pacchetto.yml al tag,
// e il risultato va nella Release di GitHub di quel tag. La regola 2 di
// docs/flotta.md resta: qui si scrive solo nel nostro repository.
//
//   node scripts/crea-pacchetto.mjs --tipo locali|demo [--tag vX.Y.Z] [--uscita pacchetti] [--anche-modificato]
//
// Esce con `pacchetto-<tipo>-vX.Y.Z.tgz` e, accanto, `….tgz.sha256`.
// Dentro:
//   - dist/          il sito: per i locali in modalità pacchetto (segnaposto
//                    %VENUE_*% e set neutro), per la demo la demo intera;
//   - functions/     (solo locali) il codice con le sole dipendenze di
//                    produzione già installate: firebase-tools carica il
//                    codice per sapere quali Functions ci sono. Senza i
//                    functions/.env.<progetto>, che sono della Tana;
//   - firebase.json, firestore.rules, firestore.indexes.json, storage.rules;
//   - personalizza.mjs (solo locali) in un file solo, coi moduli dentro: la
//                    regia lo lancia dalla radice del pacchetto, senza un
//                    checkout del repository;
//   - pacchetto.json il manifesto nel formato 1, con l'impronta di ogni file.
//
// Cosa rifiuta, prima di produrre qualunque cosa:
//   - un .env nella radice: la build lo leggerebbe, e il pacchetto
//     porterebbe dentro il progetto di chi l'ha lanciato;
//   - file tracciati modificati: il manifesto dice un commit, e il pacchetto
//     deve essere quel commit (`--anche-modificato` per le prove in locale);
//   - un tag che non è `v` + la versione di package.json;
//   - una build dei locali con dentro la demo, o una demo senza la demo;
//   - un manifesto che la regia rifiuterebbe (campiVenue vuoto compreso).

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILE_DEL_SET, PAGINE_INFORMATIVA, SEGNAPOSTO } from '../clienti/personalizzazione.mjs'
import { CAMPI_VENUE, PROFILI as PROFILI_DEL_LOCALE } from '../src/porte/configurazioneLocale.mjs'
import { cercaSegni } from './controlla-build-senza-demo.mjs'

export const FORMATO = 1
export const TIPI = ['locali', 'demo']

// Gli strumenti con cui la regia pubblica il pacchetto. firebase-tools è
// fissato perché il deploy delle Functions cambia fra una versione e l'altra
// (contratto, interfaccia 16: 15.36.0 al 18/11/2026); Node è quello di
// `functions/package.json` (engines) e della CI.
export const STRUMENTI = { node: '22', 'firebase-tools': '15.36.0' }

// La demo è sempre leggera: niente Functions né Storage (la regia, in
// aggiorna-istanza.yml). Un locale può essere l'uno o l'altro.
export const PROFILI = { locali: [...PROFILI_DEL_LOCALE], demo: ['leggero'] }

export const FILE_DELLA_RADICE = ['firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules']

// I file che Vite legge in una build di produzione. .env.locale e
// .env.sistema non contano: valgono solo con `--mode locale|sistema`.
export const ENV_DELLA_BUILD = ['.env', '.env.local', '.env.production', '.env.production.local']

// La configurazione finta della demo, la stessa che la regia scrive oggi
// (aggiorna-istanza.yml, «La configurazione finta della demo»): un progetto
// «demo-» che non esiste. La demo non parla con nessun server
// (REQ-FLOTTA-019), e la configurazione vera di drinkpos-demo nel pacchetto
// sarebbe solo un'informazione regalata.
const FIREBASE_FINTO_DELLA_DEMO = {
  VITE_FIREBASE_API_KEY: 'demo',
  VITE_FIREBASE_AUTH_DOMAIN: 'demo-drinkpos.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'demo-drinkpos',
  VITE_FIREBASE_STORAGE_BUCKET: '',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '',
  VITE_FIREBASE_APP_ID: '1:0:web:demo',
  VITE_FIREBASE_MEASUREMENT_ID: '',
}

const VERSIONE = /^\d+\.\d+\.\d+(?:-beta(?:\.\d+)?)?$/

export class ErrorePacchetto extends Error {
  constructor(problemi) {
    super(problemi.join('\n'))
    this.problemi = problemi
  }
}

export const nomeArchivio = (tipo, versione) => `pacchetto-${tipo}-v${versione}.tgz`
export const eBeta = (versione) => /-beta/.test(versione)

// I file che personalizza.mjs riscrive o aggiunge: la regia li esclude dal
// confronto delle impronte DOPO la personalizzazione. Tutti devono stare nel
// pacchetto (la regia rifiuta un personalizzabile che non c'è), e ci stanno:
// il set neutro ha tutti e sette i file. La demo non si personalizza.
export const personalizzabili = (tipo) =>
  tipo === 'locali' ? ['index.html', 'manifest.webmanifest', ...PAGINE_INFORMATIVA, ...FILE_DEL_SET].map((f) => `dist/${f}`) : []

export function leggiArgomenti(argv) {
  const a = { uscita: 'pacchetti', anche_modificato: false }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--anche-modificato') {
      a.anche_modificato = true
      continue
    }
    const [nome, valore] = argv[i].includes('=') ? argv[i].split(/=(.*)/s) : [argv[i], argv[i + 1]]
    if (!['--tipo', '--tag', '--uscita'].includes(nome)) throw new ErrorePacchetto([`argomento sconosciuto: ${argv[i]}`])
    if (!valore || valore.startsWith('--')) throw new ErrorePacchetto([`${nome} vuole un valore`])
    a[nome.slice(2)] = valore
    if (!argv[i].includes('=')) i++
  }
  if (!TIPI.includes(a.tipo)) throw new ErrorePacchetto([`serve --tipo ${TIPI.join('|')}`])
  return a
}

// La versione è quella di package.json; il tag, se c'è, deve dire la stessa.
// Il manifesto la porta con `tag` e `beta`, e la regia non manda una beta in
// produzione: un numero sbagliato qui è un locale che riceve la cosa sbagliata.
export function problemiDellaVersione(versione, tag) {
  const p = []
  if (!VERSIONE.test(versione || '')) p.push(`la versione di package.json (${JSON.stringify(versione)}) non è X.Y.Z o X.Y.Z-beta`)
  if (tag !== undefined && tag !== `v${versione}`) p.push(`il tag ${tag} non è v${versione}, la versione di package.json`)
  return p
}

// L'ambiente della build: quello di chi lancia, SENZA nessuna variabile che
// cambi cosa si compila, più quelle del tipo. Un VITE_FIREBASE_* rimasto
// nella shell farebbe un sito per tutti col database di uno (lo ferma anche
// clienti/pluginCliente.js, ma meglio non arrivarci). Fuori anche
// APP_VERSION, che vite.config.js legge prima di package.json: l'app
// mostrerebbe un numero diverso da quello del manifesto.
export function ambienteDellaBuild(tipo, env = process.env) {
  const pulito = Object.fromEntries(
    Object.entries(env).filter(([k]) => !k.startsWith('VITE_') && !['CLIENTE', 'PACCHETTO', 'BASE_PATH', 'APP_VERSION'].includes(k))
  )
  const comune = { ...pulito, BASE_PATH: '/', VITE_APP_ENV: 'production' }
  if (tipo === 'locali') return { ...comune, PACCHETTO: '1' }
  return { ...comune, CLIENTE: 'demo', VITE_PROFILO: 'leggero', VITE_REGIA_PROGETTO: '', ...FIREBASE_FINTO_DELLA_DEMO }
}

// La build è quella giusta? Per i locali niente demo (gli stessi segni di
// scripts/controlla-build-senza-demo.mjs) e i segnaposto ancora al loro
// posto; per la demo la demo, e non la configurazione vera del suo progetto
// (gli stessi controlli della regia, oggi, dopo la sua build).
export function problemiDellaBuild(tipo, dist) {
  if (!existsSync(join(dist, 'index.html'))) return [`${dist}: manca index.html, la build non è andata`]
  const p = []
  if (tipo === 'locali') {
    for (const t of cercaSegni(dist)) p.push(`la build dei locali contiene la demo: ${t.file} «${t.segno}»`)
    if (!SEGNAPOSTO.test(readFileSync(join(dist, 'index.html'), 'utf8'))) p.push('index.html senza segnaposto: non è una build in modalità pacchetto')
  } else {
    const testi = elencaFile(dist).filter((f) => /\.(js|html)$/.test(f)).map((f) => readFileSync(join(dist, f), 'utf8'))
    if (!testi.some((t) => t.includes('drink:demo-sessione'))) p.push('la build della demo non contiene la demo')
    if (testi.some((t) => t.includes('"drinkpos-demo"'))) p.push('la build della demo porta la configurazione vera di drinkpos-demo')
  }
  return p
}

// I file di functions/ che entrano: quelli tracciati, tranne la
// configurazione dei progetti della Tana (`.env.<progetto>`, che porta
// VENUE_NAME e REGIA_PROGETTO della Tana: per un locale li scrive la regia).
// `functions/.env` resta: è vuoto apposta, e senza il deploy non interattivo
// si ferma a chiedere le variabili.
export const fileDelleFunctions = (tracciati) =>
  tracciati.filter((f) => f.startsWith('functions/') && !/^functions\/\.env\./.test(f) && basename(f) !== '.gitignore')

export function elencaFile(cartella) {
  const fuori = []
  const giro = (d) => {
    for (const nome of readdirSync(d)) {
      const p = join(d, nome)
      if (statSync(p).isDirectory()) giro(p)
      else fuori.push(relative(cartella, p).split(sep).join('/'))
    }
  }
  giro(cartella)
  return fuori.sort()
}

export const improntaDi = (file) => createHash('sha256').update(readFileSync(file)).digest('hex')

export function manifesto({ tipo, versione, commit, creatoIl, file }) {
  return {
    formato: FORMATO,
    tipo,
    versione,
    tag: `v${versione}`,
    beta: eBeta(versione),
    commit,
    creato_il: creatoIl,
    profili: PROFILI[tipo],
    strumenti: { ...STRUMENTI },
    personalizzabili: personalizzabili(tipo),
    campiVenue: [...CAMPI_VENUE],
    file,
  }
}

// I CONTROLLI DELLA REGIA, COPIATI: quelli che fa appena scaricato il
// pacchetto (problemiDelManifesto in scripts/lib-pacchetto.js di
// drink-regia, ramo del 18/11/2026). Se uno non passa qui non passerebbe
// là, e tanto vale non allegarlo. È una copia da tenere allineata a mano
// (CLAUDE.md, «Fanno parte del contratto»): se la regia ne aggiunge uno,
// si aggiunge qui. campiVenue sta nel formato 1, sempre e mai vuoto
// (accordo del 18/11/2026). I file necessari qui sono qualcuno in più di
// quelli della regia (storage.rules anche nella demo): più stretti, mai meno.
const PERCORSO_SICURO = (f) => typeof f === 'string' && f.length > 0 && !f.startsWith('/') && !/^[A-Za-z]:/.test(f) && !f.split('/').includes('..') && !f.includes('\\')

export function problemiDelManifesto(m) {
  const p = []
  if (m.formato !== FORMATO) p.push(`formato ${m.formato}`)
  if (!TIPI.includes(m.tipo)) p.push(`tipo ${m.tipo}`)
  p.push(...problemiDellaVersione(m.versione, m.tag))
  if (m.beta !== eBeta(m.versione || '')) p.push(`beta: ${m.beta}, ma la versione è ${m.versione}`)
  if (!/^[0-9a-f]{40}$/.test(m.commit || '')) p.push('commit mancante o non valido')
  if (Number.isNaN(Date.parse(m.creato_il))) p.push('creato_il non è una data')
  if (!m.strumenti || typeof m.strumenti.node !== 'string' || !/^\d+\.\d+\.\d+$/.test(m.strumenti['firebase-tools'] || '')) p.push('strumenti: servono node e la versione fissata di firebase-tools')
  if (!Array.isArray(m.profili) || m.profili.length === 0 || m.profili.some((x) => !PROFILI.locali.includes(x))) p.push('profili non validi')
  if (!Array.isArray(m.campiVenue) || m.campiVenue.length === 0 || m.campiVenue.some((k) => !/^venue_[a-z_]+$/.test(k))) {
    p.push('campiVenue vuoto o con chiavi che non sono venue_*')
  }
  if (!Array.isArray(m.personalizzabili) || m.personalizzabili.some((f) => !PERCORSO_SICURO(f))) p.push('personalizzabili deve essere un elenco di percorsi del pacchetto')
  for (const [f, impronta] of Object.entries(m.file)) {
    if (!PERCORSO_SICURO(f)) p.push(`percorso non ammesso: ${f}`)
    if (!/^[0-9a-f]{64}$/.test(impronta)) p.push(`impronta non valida per ${f}`)
  }
  const necessari = [...FILE_DELLA_RADICE, 'dist/index.html', ...(m.tipo === 'locali' ? ['functions/package.json', 'functions/package-lock.json', 'personalizza.mjs'] : [])]
  for (const f of necessari) if (!(f in m.file)) p.push(`manca ${f}`)
  for (const f of m.personalizzabili || []) if (!(f in m.file)) p.push(`personalizzabile non nel pacchetto: ${f}`)
  return p
}

// ── Il lavoro vero: comandi esterni, file su disco ────────────────────────

function eseguiDavvero(comando, argomenti, opzioni = {}) {
  // Su Windows npm è un .cmd, e Node lo avvia solo passando dalla shell.
  const shell = process.platform === 'win32' && comando === 'npm'
  const r = spawnSync(comando, argomenti, { stdio: opzioni.cattura ? 'pipe' : 'inherit', encoding: 'utf8', shell, ...opzioni })
  if (r.status !== 0) throw new ErrorePacchetto([`${comando} ${argomenti.join(' ')} è uscito con ${r.status ?? r.error?.message}`])
  return r.stdout || ''
}

// personalizza.mjs in un file solo: la regia lo lancia dalla radice del
// pacchetto, dove clienti/ e src/ non ci sono. Lo unisce Vite (dipendenza
// diretta del progetto), in modalità server: i moduli di Node restano fuori,
// i nostri dentro.
export async function unisciPersonalizza(radice, destinazione, intestazione = '') {
  const { build } = await import('vite')
  const cartella = dirname(destinazione)
  await build({
    configFile: false,
    root: radice,
    // Senza, Vite copia public/ accanto allo script: il pacchetto si
    // ritrovava il logo, le icone e sw.js anche nella radice.
    publicDir: false,
    logLevel: 'warn',
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: join(radice, 'scripts', 'personalizza.mjs'),
      outDir: cartella,
      emptyOutDir: false,
      minify: false,
      target: 'node22',
      rollupOptions: { output: { format: 'es', entryFileNames: basename(destinazione) } },
    },
  })
  // L'intestazione si mette dopo: il banner di Rollup, in questa build, Vite
  // lo perde.
  if (intestazione) writeFileSync(destinazione, `${intestazione}\n${readFileSync(destinazione, 'utf8')}`)
}

export async function creaPacchetto({ tipo, tag, uscita = 'pacchetti', ancheModificato = false, radice = process.cwd(), esegui = eseguiDavvero, unisci = unisciPersonalizza, ora = () => new Date() }) {
  radice = resolve(radice)
  const versione = JSON.parse(readFileSync(join(radice, 'package.json'), 'utf8')).version
  const problemi = [...problemiDellaVersione(versione, tag)]
  for (const f of ENV_DELLA_BUILD) if (existsSync(join(radice, f))) problemi.push(`${f} nella radice: la build lo leggerebbe (spostarlo prima di creare il pacchetto)`)
  // Dentro dist/ la build la cancellerebbe, e la copia di dist/ copierebbe
  // la cartella di lavoro dentro sé stessa.
  const dentroDist = relative(join(radice, 'dist'), resolve(radice, uscita))
  if (!dentroDist.startsWith('..') && !isAbsolute(dentroDist)) problemi.push(`--uscita ${uscita} sta dentro dist/: va fuori`)
  if (!ancheModificato && esegui('git', ['status', '--porcelain', '--untracked-files=no'], { cwd: radice, cattura: true }).trim()) {
    problemi.push('ci sono file tracciati modificati: il pacchetto non sarebbe il commit che dichiara')
  }
  if (problemi.length) throw new ErrorePacchetto(problemi)
  const commit = esegui('git', ['rev-parse', 'HEAD'], { cwd: radice, cattura: true }).trim()

  // 1. La build, nell'ambiente del tipo.
  esegui('npm', ['run', 'build'], { cwd: radice, env: ambienteDellaBuild(tipo) })
  const dellaBuild = problemiDellaBuild(tipo, join(radice, 'dist'))
  if (dellaBuild.length) throw new ErrorePacchetto(dellaBuild)

  // 2. Il pacchetto, in una cartella di lavoro accanto all'archivio.
  const dirUscita = resolve(radice, uscita)
  const lavoro = join(dirUscita, `.lavoro-${tipo}`)
  rmSync(lavoro, { recursive: true, force: true })
  mkdirSync(lavoro, { recursive: true })
  cpSync(join(radice, 'dist'), join(lavoro, 'dist'), { recursive: true })
  for (const f of FILE_DELLA_RADICE) cpSync(join(radice, f), join(lavoro, f))
  if (tipo === 'locali') {
    const tracciati = esegui('git', ['ls-files', 'functions'], { cwd: radice, cattura: true }).split('\n').filter(Boolean)
    for (const f of fileDelleFunctions(tracciati)) {
      mkdirSync(dirname(join(lavoro, f)), { recursive: true })
      cpSync(join(radice, f), join(lavoro, f))
    }
    // Solo le dipendenze di produzione, dal lock, e senza i collegamenti di
    // node_modules/.bin: la regia rifiuta un percorso che esce dal pacchetto,
    // e un collegamento è proprio questo.
    esegui('npm', ['ci', '--omit=dev', '--no-bin-links', '--no-audit', '--no-fund'], { cwd: join(lavoro, 'functions') })
    await unisci(radice, join(lavoro, 'personalizza.mjs'), `// personalizza.mjs di tana-drink v${versione} (${commit}), unito da scripts/crea-pacchetto.mjs: non si modifica qui.`)
  }

  // 3. Il manifesto, con l'impronta di ogni file.
  const file = Object.fromEntries(elencaFile(lavoro).map((f) => [f, improntaDi(join(lavoro, f))]))
  const m = manifesto({ tipo, versione, commit, creatoIl: ora().toISOString(), file })
  const delManifesto = problemiDelManifesto(m)
  if (delManifesto.length) throw new ErrorePacchetto(delManifesto)
  writeFileSync(join(lavoro, 'pacchetto.json'), `${JSON.stringify(m, null, 2)}\n`)

  // 4. L'archivio e la sua impronta. tar lavora DALLA cartella del
  // pacchetto, con percorsi relativi: il tar GNU (quello di Git Bash) prende
  // «C:\…» per un indirizzo di rete.
  const archivio = nomeArchivio(tipo, versione)
  rmSync(join(dirUscita, archivio), { force: true })
  esegui('tar', ['-czf', `../${archivio}`, ...readdirSync(lavoro).sort()], { cwd: lavoro })
  const impronta = improntaDi(join(dirUscita, archivio))
  // Il formato di sha256sum: `sha256sum -c` lo controlla da sé.
  writeFileSync(join(dirUscita, `${archivio}.sha256`), `${impronta}  ${archivio}\n`)
  rmSync(lavoro, { recursive: true, force: true })
  return { archivio: join(dirUscita, archivio), impronta, manifesto: m }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const a = leggiArgomenti(process.argv.slice(2))
    const esito = await creaPacchetto({ tipo: a.tipo, tag: a.tag, uscita: a.uscita, ancheModificato: a.anche_modificato })
    console.log(`crea-pacchetto: ${esito.archivio} (${Object.keys(esito.manifesto.file).length} file), sha256 ${esito.impronta}`)
  } catch (e) {
    const problemi = e instanceof ErrorePacchetto ? e.problemi : [e.stack || e.message]
    console.error(`crea-pacchetto: nessun pacchetto.\n${problemi.map((p) => `  - ${p}`).join('\n')}`)
    process.exit(1)
  }
}
