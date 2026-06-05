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
})
