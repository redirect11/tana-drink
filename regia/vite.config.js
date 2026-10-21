import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// La regia: un'app a sé, sul suo progetto Firebase (drink-regia). Servita
// dalla radice su Firebase Hosting.
export default defineConfig({
  plugins: [react()],
})
