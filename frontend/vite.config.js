import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
  },
  test: {
    // happy-dom en vez de jsdom (Fase 8): la versión actual de jsdom trae
    // una dependencia (@csstools/css-calc) que es ESM-only pero se importa
    // con require() en el entorno de test de Vitest, y falla con
    // ERR_REQUIRE_ESM antes de poder correr un solo test. happy-dom es la
    // alternativa estándar para este caso, más liviana además.
    environment: 'happy-dom',
    setupFiles: ['./tests/setup.js'],
    globals: false,
  },
})
