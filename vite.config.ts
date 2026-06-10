import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';

// Same path used at runtime by Vite to compute import.meta.env.BASE_URL.
const BASE_PATH = process.env.VITE_BASE_PATH || '/';

// https://vite.dev/config/
export default defineConfig({
  define: {
    // Surface the package version to the client bundle (shown in the header).
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    svelte(),
    VitePWA({
      // 'autoUpdate' silently activates new service workers on the next page
      // load. We layer an in-app banner over the top via virtual:pwa-register
      // so the user gets a visible "reload to update" cue before the swap.
      registerType: 'autoUpdate',
      // Match the deployed base path so the manifest's start_url / scope
      // resolve correctly. Defaults to "/" for the custom domain
      // (taplist.rampant.io); the env var lets a project-path deploy
      // override if we ever need one.
      base: BASE_PATH,
      scope: BASE_PATH,
      // Include the assets that aren't picked up by globPatterns by default
      // (apple-touch-icon needs a head <link>, etc.). vite-plugin-pwa emits
      // the head tags automatically.
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'icon.svg'],
      manifest: {
        name: 'TapList',
        short_name: 'TapList',
        description:
          'The unofficial guide for the Washington Brewers Festival. Flag beers, rate them, take notes — offline-first.',
        // start_url and scope inherit the deployed base via the `base` option above.
        start_url: BASE_PATH,
        scope: BASE_PATH,
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#b8651b',
        background_color: '#fafaf8',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Precache everything that lands in dist except the festival datasets,
        // which we'd rather fetch fresh (and fall back to runtime cache).
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        // The dataset files live alongside the rest of the static site; the
        // runtime cache below handles them.
        globIgnores: ['**/data/**'],
        navigateFallback: BASE_PATH,
        // SPA: anything that looks like an app route should fall back to index.html.
        navigateFallbackDenylist: [/\/data\/.+/, /\/api\//],
        runtimeCaching: [
          {
            // Catalog + festival dataset JSON. NetworkFirst so changes show up
            // quickly when online, but a cached copy is served if the network
            // is unreachable (the festival-floor case).
            urlPattern: ({ url }) => url.pathname.match(/\/data\/.+\.json$/) !== null,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'taplist-data',
              expiration: {
                maxEntries: 8,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
              // Short timeout: don't make the user wait forever before falling
              // back to the cache.
              networkTimeoutSeconds: 6,
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // The plugin can run a SW in dev for end-to-end testing. We leave it
        // off by default to keep dev fast and avoid HMR weirdness; flip on
        // when verifying PWA behavior manually.
        enabled: false,
        type: 'module',
      },
    }),
  ],
  // Production lives at https://taplist.rampant.io/ (GitHub Pages with a
  // custom domain), so the base is "/". The env var stays parameterized
  // so we can still build for a project-path deploy if we ever need to.
  base: BASE_PATH,
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
