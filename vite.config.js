import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

// Su Firebase Hosting il sito è servito dalla radice ("/").
// Usiamo BrowserRouter lato app, quindi qui serve solo impostare il base path.
// Può essere sovrascritto in build con la variabile d'ambiente BASE_PATH
// (es. "/karaoke-drink/" per un eventuale deploy su GitHub Pages di progetto).
const base = process.env.BASE_PATH || '/'

// Identificativo di build: l'app lo confronta con version.json pubblicato
// insieme al deploy per accorgersi che c'è una versione nuova (la PWA
// sull'iPad resta aperta per giorni e non ricarica mai da sola).
const buildId = String(Date.now())

// DA QUALE VERSIONE STIAMO GUARDANDO. Con GitFlow su un solo ambiente di
// test ci finiscono, a turno, i branch feature e develop: senza scriverlo
// da qualche parte, "l'ho provato e non andava" non vuol dire niente —
// non si sa cosa fosse pubblicato in quel momento.
// In CI i valori arrivano da GitHub; in locale si chiedono a git; se git
// non c'è (build in un container spoglio) restano vuoti e l'app non
// mostra niente, invece di mostrare una bugia.
function daGit(comando, fallback = '') {
  try {
    return execSync(comando, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return fallback
  }
}
// IL RAMO, NON IL TAG. Da quando si pubblica taggando, in CI
// `GITHUB_REF_NAME` è il nome del TAG: preso così, in fondo al menu si
// leggeva «v1.4.3 · v1.4.3 · 11783f5» — la versione due volte e il ramo da
// nessuna parte, proprio l'informazione che serve per sapere cosa si sta
// guardando. `GITHUB_REF_TYPE` dice se quel nome è un ramo o un tag; il
// ramo che contiene il commit taggato lo passa la pipeline in `GIT_BRANCH`
// (vedi .github/workflows/deploy.yml).
// In locale resta il ramo su cui si sta lavorando; con HEAD staccata non
// c'è un ramo da dire, e allora meglio niente che una bugia.
const ramoDetto =
  process.env.GIT_BRANCH ||
  (process.env.GITHUB_REF_TYPE === 'branch' ? process.env.GITHUB_REF_NAME : '') ||
  daGit('git rev-parse --abbrev-ref HEAD')
const branch = ramoDetto === 'HEAD' ? '' : ramoDetto
const commit = (
  process.env.GITHUB_SHA ||
  process.env.GIT_COMMIT ||
  daGit('git rev-parse HEAD')
).slice(0, 7)
// VERSIONE: la dice package.json, che al rilascio viene allineato.
//
// Prima veniva dall'ultimo TAG RAGGIUNGIBILE, e non funzionava: il tag di
// rilascio si mette sul merge in `main`, che non è antenato di `develop` né
// dei rami di lavoro — quindi lì `git describe` risaliva al tag PRECEDENTE e
// l'ambiente di test diceva «v1.2.0» mentre ci girava sopra la 1.3.0. Un
// numero di versione sbagliato è peggio di nessun numero: chi segnala un
// problema dice una versione che non è quella che ha davanti.
//
// package.json invece sta su OGNI ramo e porta sempre l'ultima versione
// rilasciata (vedi docs/gitflow.md: si allinea insieme alle note di
// rilascio). Il tag resta come ripiego, per una cartella senza package.json.
const versione =
  process.env.APP_VERSION ||
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version ||
  daGit('git describe --tags --abbrev=0') ||
  ''

// https://vitejs.dev/config/
export default defineConfig({
  base,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
    __GIT_BRANCH__: JSON.stringify(branch),
    __GIT_COMMIT__: JSON.stringify(commit),
    __APP_VERSION__: JSON.stringify(versione),
  },
  plugins: [
    react(),
    {
      // IL CHANGELOG VIAGGIA COL DEPLOY. Le note della versione si leggono
      // dentro l'app (Impostazioni → Informazioni): il file sta nella
      // radice del progetto e viene pubblicato insieme al resto, così a
      // ogni rilascio l'app racconta cosa è cambiato senza doverlo
      // scrivere due volte.
      name: 'emit-changelog',
      apply: 'build',
      generateBundle() {
        try {
          this.emitFile({
            type: 'asset',
            fileName: 'changelog.md',
            source: readFileSync(new URL('./CHANGELOG.md', import.meta.url), 'utf8'),
          })
        } catch {
          /* senza changelog l'app mostra solo i dati tecnici */
        }
      },
    },
    {
      name: 'emit-version-json',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ build: buildId, branch, commit, versione }),
        })
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        // Separa le dipendenze grosse (soprattutto Firebase) in chunk distinti:
        // tiene ogni chunk sotto i 500 kB e migliora la cache del browser
        // (le librerie cambiano di rado rispetto al codice dell'app).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@firebase/firestore') || id.includes('firebase/firestore')) return 'firebase-firestore'
          if (id.includes('@firebase/auth') || id.includes('firebase/auth')) return 'firebase-auth'
          if (id.includes('@firebase/storage') || id.includes('firebase/storage')) return 'firebase-storage'
          if (id.includes('@firebase/functions') || id.includes('firebase/functions')) return 'firebase-functions'
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase-core'
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router'
          if (id.includes('react') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
  },
})
