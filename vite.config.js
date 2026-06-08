import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Su Firebase Hosting il sito è servito dalla radice ("/").
// Usiamo BrowserRouter lato app, quindi qui serve solo impostare il base path.
// Può essere sovrascritto in build con la variabile d'ambiente BASE_PATH
// (es. "/karaoke-drink/" per un eventuale deploy su GitHub Pages di progetto).
const base = process.env.BASE_PATH || '/'

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
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
