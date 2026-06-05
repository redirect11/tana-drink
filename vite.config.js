import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Per il deploy su GitHub Pages il sito è servito sotto /<nome-repo>/.
// Usiamo HashRouter lato app, quindi qui serve solo impostare il base path.
// Può essere sovrascritto in build con la variabile d'ambiente BASE_PATH.
const base = process.env.BASE_PATH || '/karaoke-drink/'

// https://vitejs.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
})
