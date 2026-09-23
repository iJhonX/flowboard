import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.js'],
    // Los tests pegan contra Neon/Atlas por red (mismas bases de dev que se
    // usaron manualmente durante todo el proyecto, ver tests/README.md) —
    // globalSetup no alcanza para todo, pero un timeout mayor al default
    // evita falsos negativos por latencia de red normal.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
});
