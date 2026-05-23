import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages serves the site at https://<user>.github.io/<repo>/.
  // The base path is set via env var so production builds resolve assets correctly
  // while local dev (and a future custom domain) keep using the root.
  base: process.env.VITE_BASE_PATH || '/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
});
