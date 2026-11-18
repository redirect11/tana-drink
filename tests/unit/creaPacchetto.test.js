'use strict'
// @livello integrazione

// IL PACCHETTO PER VERSIONE (REQ-FLOTTA-035). scripts/crea-pacchetto.mjs
// compila il sito una volta per versione e lo mette in un archivio che la
// regia scarica dalla Release del tag e pubblica in ogni locale senza
// ricompilare (interfaccia 16 del contratto). La regia controlla il
// pacchetto prima di toccare un locale: qui si prova che quello che
// produciamo passa quei controlli, e che lo script si ferma nei casi in cui
// il pacchetto sarebbe sbagliato.
//
// La build, npm e tar qui sono finti (si prova cosa lo script ci fa
// intorno); l'unione di personalizza.mjs in un file solo invece è vera,
// perché è quella che la regia lancia senza un checkout del repository.

import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import {
  creaPacchetto,
  unisciPersonalizza,
  ambienteDellaBuild,
  personalizzabili,
  problemiDellaVersione,
  problemiDellaBuild,
  problemiDelManifesto,
  fileDelleFunctions,
  leggiArgomenti,
  manifesto,
  nomeArchivio,
  ErrorePacchetto,
} from '../../scripts/crea-pacchetto.mjs'
import { FILE_DEL_SET } from '../../clienti/personalizzazione.mjs'
import { CAMPI_VENUE } from '../../src/porte/configurazioneLocale.mjs'

const COMMIT = 'a'.repeat(40)
const H = 'b'.repeat(64)
const sha = (testo) => createHash('sha256').update(testo).digest('hex')
const scrivi = (f, testo) => {
  mkdirSync(dirname(f), { recursive: true })
  writeFileSync(f, testo)
}

// Un repository di prova: quello che lo script legge dalla radice.
function radiceDiProva(versione = '1.10.56-beta') {
  const r = mkdtempSync(join(tmpdir(), 'crea-pacchetto-'))
  scrivi(join(r, 'package.json'), JSON.stringify({ version: versione }))
  for (const f of ['firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules']) scrivi(join(r, f), `contenuto di ${f}`)
  for (const f of ['functions/index.js', 'functions/lib/conti.js', 'functions/package.json', 'functions/package-lock.json', 'functions/.env', 'functions/.env.tana-drink', 'functions/.env.tana-drink-test']) {
    scrivi(join(r, f), `contenuto di ${f}`)
  }
  return r
}

// I comandi esterni finti. `build` dice cosa lascia la build in dist/.
function comandiFinti(radice, { build = 'locali', modificati = '' } = {}) {
  const chiamate = []
  const esegui = (comando, argomenti, opzioni = {}) => {
    chiamate.push({ comando, argomenti, opzioni })
    const riga = `${comando} ${argomenti.join(' ')}`
    if (riga.startsWith('git status')) return modificati
    if (riga.startsWith('git rev-parse')) return `${COMMIT}\n`
    if (riga.startsWith('git ls-files')) return 'functions/index.js\nfunctions/lib/conti.js\nfunctions/package.json\nfunctions/package-lock.json\nfunctions/.env\nfunctions/.env.tana-drink\nfunctions/.env.tana-drink-test\nfunctions/.gitignore\n'
    if (riga === 'npm run build') {
      const dist = join(radice, 'dist')
      if (build === 'locali') {
        scrivi(join(dist, 'index.html'), '<title>%VENUE_NAME%</title>')
        for (const f of ['manifest.webmanifest', 'privacy-policy.html', 'cookie-policy.html', ...FILE_DEL_SET]) scrivi(join(dist, f), `neutro ${f}`)
        scrivi(join(dist, 'assets/app.js'), 'console.log("app")')
      } else if (build === 'demo') {
        scrivi(join(dist, 'index.html'), '<title>Bancone 21</title>')
        scrivi(join(dist, 'assets/app.js'), 'localStorage.getItem("drink:demo-sessione")')
      } else if (build === 'locali-con-demo') {
        scrivi(join(dist, 'index.html'), '<title>%VENUE_NAME%</title>')
        scrivi(join(dist, 'assets/app.js'), 'Ricomincia da capo')
      }
      return ''
    }
    if (riga.startsWith('npm ci')) {
      scrivi(join(opzioni.cwd, 'node_modules/firebase-admin/index.js'), 'module.exports = {}')
      return ''
    }
    if (comando === 'tar') {
      scrivi(join(opzioni.cwd, argomenti[1]), `archivio: ${argomenti.slice(2).join(',')}`)
      return ''
    }
    throw new Error(`comando inatteso: ${riga}`)
  }
  return { esegui, chiamate }
}

const unisciFinto = async (radice, destinazione) => scrivi(destinazione, '// personalizza unito')

let radice
beforeEach(() => {
  radice = radiceDiProva()
})

describe('il pacchetto dei locali', () => {
  it('porta il sito, le Functions con le dipendenze, le regole e personalizza.mjs, e la regia lo accetta', async () => {
    const { esegui } = comandiFinti(radice)
    const esito = await creaPacchetto({ tipo: 'locali', tag: 'v1.10.56-beta', radice, esegui, unisci: unisciFinto, ora: () => new Date('2026-11-18T12:00:00Z') })
    const m = esito.manifesto

    expect(problemiDelManifesto(m)).toEqual([])
    expect(m).toMatchObject({ formato: 1, tipo: 'locali', versione: '1.10.56-beta', tag: 'v1.10.56-beta', beta: true, commit: COMMIT, creato_il: '2026-11-18T12:00:00.000Z' })
    expect(Object.keys(m.file)).toEqual(expect.arrayContaining([
      'dist/index.html', 'dist/assets/app.js', 'firebase.json', 'firestore.rules', 'firestore.indexes.json', 'storage.rules',
      'functions/index.js', 'functions/lib/conti.js', 'functions/package.json', 'functions/package-lock.json', 'functions/.env',
      'functions/node_modules/firebase-admin/index.js', 'personalizza.mjs',
    ]))
    // La configurazione dei progetti della Tana non va ai locali.
    expect(Object.keys(m.file).filter((f) => f.includes('.env.') || f.endsWith('.gitignore'))).toEqual([])
    expect(m.file['firebase.json']).toBe(sha('contenuto di firebase.json'))
    expect(m.file).not.toHaveProperty('pacchetto.json')

    // L'archivio ha accanto la sua impronta, nel formato di sha256sum.
    const nome = nomeArchivio('locali', '1.10.56-beta')
    expect(esito.archivio).toBe(join(radice, 'pacchetti', nome))
    expect(readFileSync(`${esito.archivio}.sha256`, 'utf8')).toBe(`${sha(readFileSync(esito.archivio))}  ${nome}\n`)
    // La cartella di lavoro non resta.
    expect(readdirSync(join(radice, 'pacchetti')).sort()).toEqual([nome, `${nome}.sha256`])
  })

  it('le dipendenze sono solo quelle di produzione, dal lock e senza collegamenti', async () => {
    const { esegui, chiamate } = comandiFinti(radice)
    await creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto })
    const npmCi = chiamate.find((c) => c.comando === 'npm' && c.argomenti[0] === 'ci')
    expect(npmCi.argomenti).toEqual(expect.arrayContaining(['--omit=dev', '--no-bin-links']))
    expect(npmCi.opzioni.cwd.endsWith('functions')).toBe(true)
  })

  it('la build gira in modalità pacchetto, senza la configurazione di chi la lancia', async () => {
    const { esegui, chiamate } = comandiFinti(radice)
    process.env.VITE_FIREBASE_API_KEY = 'chiave-della-tana'
    try {
      await creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto })
    } finally {
      delete process.env.VITE_FIREBASE_API_KEY
    }
    const env = chiamate.find((c) => c.argomenti.join(' ') === 'run build').opzioni.env
    expect(env).toMatchObject({ PACCHETTO: '1', BASE_PATH: '/', VITE_APP_ENV: 'production' })
    expect(env.VITE_FIREBASE_API_KEY).toBeUndefined()
  })

  it('una build con dentro la demo non diventa un pacchetto', async () => {
    const { esegui } = comandiFinti(radice, { build: 'locali-con-demo' })
    await expect(creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto })).rejects.toThrow(/contiene la demo/)
    expect(existsSync(join(radice, 'pacchetti'))).toBe(false)
  })
})

describe('il pacchetto della demo', () => {
  it('ha il sito e le regole, senza Functions né personalizza.mjs, ed è solo leggero', async () => {
    const { esegui, chiamate } = comandiFinti(radice, { build: 'demo' })
    const { manifesto: m } = await creaPacchetto({ tipo: 'demo', radice, esegui, unisci: unisciFinto })
    expect(problemiDelManifesto(m)).toEqual([])
    expect(Object.keys(m.file).some((f) => f.startsWith('functions/') || f === 'personalizza.mjs')).toBe(false)
    expect(m.personalizzabili).toEqual([])
    expect(m.profili).toEqual(['leggero'])
    // Il formato 1 porta campiVenue anche qui: sempre, mai vuoto.
    expect(m.campiVenue).toEqual(CAMPI_VENUE)
    expect(chiamate.some((c) => c.argomenti[0] === 'ci')).toBe(false)
  })

  it('si compila come la compila la regia: CLIENTE=demo e un progetto finto', () => {
    const env = ambienteDellaBuild('demo', { PATH: '/bin', VITE_FIREBASE_PROJECT_ID: 'drinkpos-demo', CLIENTE: 'tana' })
    expect(env).toMatchObject({ PATH: '/bin', CLIENTE: 'demo', VITE_PROFILO: 'leggero', VITE_REGIA_PROGETTO: '', VITE_FIREBASE_PROJECT_ID: 'demo-drinkpos' })
    expect(env.PACCHETTO).toBeUndefined()
  })

  // vite.config.js legge APP_VERSION prima di package.json: rimasta nella
  // shell, l'app direbbe un numero e il manifesto un altro.
  it('una APP_VERSION rimasta nella shell non entra nella build', () => {
    expect(ambienteDellaBuild('locali', { APP_VERSION: '9.9.9' }).APP_VERSION).toBeUndefined()
  })
})

describe('quando non esce nessun pacchetto', () => {
  it('un tag che non è la versione di package.json', async () => {
    const { esegui, chiamate } = comandiFinti(radice)
    await expect(creaPacchetto({ tipo: 'locali', tag: 'v1.10.55', radice, esegui, unisci: unisciFinto })).rejects.toThrow(/non è v1\.10\.56-beta/)
    expect(chiamate.some((c) => c.argomenti.join(' ') === 'run build')).toBe(false)
  })

  it('una cartella di uscita dentro dist/', async () => {
    const { esegui } = comandiFinti(radice)
    await expect(creaPacchetto({ tipo: 'locali', uscita: 'dist/pacchetti', radice, esegui, unisci: unisciFinto })).rejects.toThrow(/dentro dist/)
  })

  it('un .env nella radice, che la build leggerebbe', async () => {
    writeFileSync(join(radice, '.env'), 'VITE_FIREBASE_PROJECT_ID=tana-drink')
    const { esegui } = comandiFinti(radice)
    await expect(creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto })).rejects.toThrow(/\.env nella radice/)
  })

  it('file tracciati modificati, salvo che lo si chieda per una prova', async () => {
    const { esegui } = comandiFinti(radice, { modificati: ' M src/main.jsx\n' })
    await expect(creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto })).rejects.toThrow(/file tracciati modificati/)
    await expect(creaPacchetto({ tipo: 'locali', radice, esegui, unisci: unisciFinto, ancheModificato: true })).resolves.toBeTruthy()
  })
})

describe('i pezzi', () => {
  it('i personalizzabili sono i file che personalizza.mjs riscrive o mette', () => {
    expect(personalizzabili('locali')).toEqual(['dist/index.html', 'dist/manifest.webmanifest', 'dist/privacy-policy.html', 'dist/cookie-policy.html', ...FILE_DEL_SET.map((f) => `dist/${f}`)])
    expect(personalizzabili('demo')).toEqual([])
  })

  it('la versione: X.Y.Z o X.Y.Z-beta, e il tag uguale', () => {
    expect(problemiDellaVersione('1.10.56', 'v1.10.56')).toEqual([])
    expect(problemiDellaVersione('1.10.56-beta', undefined)).toEqual([])
    expect(problemiDellaVersione('1.10', 'v1.10')).toHaveLength(1)
    expect(problemiDellaVersione('1.10.56', 'v1.10.56-prod')).toHaveLength(1)
  })

  it('un manifesto senza campiVenue la regia lo rifiuta, e qui non esce', () => {
    const m = manifesto({ tipo: 'demo', versione: '1.10.56', commit: COMMIT, creatoIl: '2026-11-18T12:00:00Z', file: { 'firebase.json': H, 'firestore.rules': H, 'firestore.indexes.json': H, 'storage.rules': H, 'dist/index.html': H } })
    expect(m.beta).toBe(false)
    expect(problemiDelManifesto(m)).toEqual([])
    expect(problemiDelManifesto({ ...m, campiVenue: [] })).toEqual(['campiVenue vuoto o con chiavi che non sono venue_*'])
  })

  // Gli stessi rifiuti della regia (lib-pacchetto.js), copiati: un manifesto
  // che passasse qui e non là sarebbe un pacchetto allegato e inservibile.
  it('le altre regole della regia: beta coerente, impronte, percorsi, strumenti', () => {
    const m = manifesto({ tipo: 'demo', versione: '1.10.56-beta', commit: COMMIT, creatoIl: '2026-11-18T12:00:00Z', file: { 'firebase.json': H, 'firestore.rules': H, 'firestore.indexes.json': H, 'storage.rules': H, 'dist/index.html': H } })
    expect(problemiDelManifesto(m)).toEqual([])
    expect(problemiDelManifesto({ ...m, beta: false })).toEqual(['beta: false, ma la versione è 1.10.56-beta'])
    expect(problemiDelManifesto({ ...m, file: { ...m.file, 'dist/x.js': 'corta' } })).toEqual(['impronta non valida per dist/x.js'])
    expect(problemiDelManifesto({ ...m, file: { ...m.file, 'C:/x.js': H } })).toEqual(['percorso non ammesso: C:/x.js'])
    expect(problemiDelManifesto({ ...m, strumenti: { node: '22', 'firebase-tools': 'latest' } })).toHaveLength(1)
    expect(problemiDelManifesto({ ...m, profili: ['tutto'] })).toEqual(['profili non validi'])
  })

  it('le Functions senza la configurazione dei progetti della Tana', () => {
    expect(fileDelleFunctions(['functions/index.js', 'functions/.env', 'functions/.env.tana-drink', 'functions/.gitignore', 'src/main.jsx'])).toEqual(['functions/index.js', 'functions/.env'])
  })

  it('la build della demo deve essere la demo, e senza il progetto vero', () => {
    const dist = join(radice, 'dist-demo')
    scrivi(join(dist, 'index.html'), '<title>Bancone 21</title>')
    scrivi(join(dist, 'assets/app.js'), 'nessun segno')
    expect(problemiDellaBuild('demo', dist)).toEqual(['la build della demo non contiene la demo'])
    scrivi(join(dist, 'assets/app.js'), '"drink:demo-sessione" projectId:"drinkpos-demo"')
    expect(problemiDellaBuild('demo', dist)).toEqual(['la build della demo porta la configurazione vera di drinkpos-demo'])
  })

  it('gli argomenti', () => {
    expect(leggiArgomenti(['--tipo', 'locali', '--tag=v1.0.0'])).toEqual({ tipo: 'locali', tag: 'v1.0.0', uscita: 'pacchetti', anche_modificato: false })
    expect(() => leggiArgomenti(['--tipo', 'tana'])).toThrow(ErrorePacchetto)
    expect(() => leggiArgomenti(['--tipo', 'demo', '--progetto', 'x'])).toThrow(/sconosciuto/)
  })
})

describe('personalizza.mjs in un file solo', () => {
  // La regia lo lancia dalla radice del pacchetto, dove clienti/ e src/
  // non ci sono, e con un ambiente vuoto.
  it('gira da solo, fuori dal repository, e personalizza un dist', async () => {
    const fuori = mkdtempSync(join(tmpdir(), 'personalizza-unito-'))
    await unisciPersonalizza(process.cwd(), join(fuori, 'personalizza.mjs'), '// intestazione di prova')
    expect(readdirSync(fuori)).toEqual(['personalizza.mjs'])
    const unito = readFileSync(join(fuori, 'personalizza.mjs'), 'utf8')
    expect(unito.startsWith('// intestazione di prova\n')).toBe(true)
    expect(unito).not.toMatch(/from ['"]\.\.?\//)

    const dist = join(fuori, 'dist')
    scrivi(join(dist, 'index.html'), readFileSync('index.html', 'utf8'))
    scrivi(join(dist, 'manifest.webmanifest'), readFileSync('clienti/manifest.template.json', 'utf8'))
    for (const f of ['privacy-policy.html', 'cookie-policy.html']) scrivi(join(dist, f), readFileSync(join('clienti', 'pagine', f), 'utf8'))
    for (const f of FILE_DEL_SET) scrivi(join(dist, f), `neutro ${f}`)
    const config = { backend: 'firebase', locale: 'bar-mario', firebase: { apiKey: 'k', authDomain: 'a.firebaseapp.com', projectId: 'p', appId: '1:2:web:3' }, venue: { venue_name: 'Bar Mario' } }
    writeFileSync(join(fuori, 'locale.json'), JSON.stringify(config))

    const r = spawnSync(process.execPath, ['personalizza.mjs', '--dist', 'dist', '--configurazione', 'locale.json'], { cwd: fuori, env: {}, encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
    expect(readFileSync(join(dist, 'index.html'), 'utf8')).toContain('Bar Mario')
    expect(JSON.parse(readFileSync(join(dist, 'configurazione.json'), 'utf8'))).toEqual(config)
  }, 60000)
})
