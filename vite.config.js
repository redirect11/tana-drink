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
const branch =
  process.env.GITHUB_REF_NAME || process.env.GIT_BRANCH || daGit('git rev-parse --abbrev-ref HEAD')
const commit = (
  process.env.GITHUB_SHA ||
  process.env.GIT_COMMIT ||
  daGit('git rev-parse HEAD')
).slice(0, 7)
// VERSIONE: l'ultimo tag raggiungibile. In produzione è l'unica cosa che
// serve sapere. Se i tag non ci sono (checkout superficiale, cartella
// senza git) si ripiega su package.json, che al rilascio viene allineato.
const versione =
  process.env.APP_VERSION ||
  daGit('git describe --tags --abbrev=0') ||
  JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version ||
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
