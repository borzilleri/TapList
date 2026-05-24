import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  // GitHub Pages serves the site at https://<user>.github.io/<repo>/.
  // The base path is set via env var so production builds resolve assets correctly
  // while local dev (and a future custom domain) keep using the root.
  base: process.env.VITE_BASE_PATH || '/',
  // The `server` block only applies to `vite dev` / `vite preview` — it has
  // no effect on the production build. Keeping the LAN-access settings here
  // is the cleanest way to scope them to local development only.
  server: {
    // Listen on all interfaces so other devices on the LAN can reach the
    // dev server (e.g. testing the mobile UX on a phone). Defaults to
    // 'localhost' otherwise.
    host: true,
    // Vite 5 added strict DNS-rebinding protection: any request whose Host
    // header isn't `localhost`/`127.0.0.1` is rejected unless explicitly
    // allowed. Add LAN hostnames here.
    allowedHosts: ['sdf-1.sdf1.internal'],
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,js}'],
  },
});
