import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
    env: { TZ: 'Europe/Rome' },
    include: ['tests/**/*.test.js', 'tests/**/*.test.jsx'],
  },
})
