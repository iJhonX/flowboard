import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// globals: false en vite.config.js -> React Testing Library no limpia solo
// entre tests; hay que desmontar a mano o un test deja el DOM sucio para el
// siguiente (falsos positivos/negativos difíciles de rastrear).
afterEach(() => {
  cleanup();
});
