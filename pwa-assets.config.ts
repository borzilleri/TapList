/**
 * @vite-pwa/assets-generator config.
 *
 * Runs out-of-band via `npx pwa-assets-generator` (or `npm run pwa:icons`)
 * — not at every build. The generated PNGs land in `public/` and are
 * committed to the repo so production builds don't need the source SVG
 * pipeline.
 *
 * `minimal2023Preset` produces the icons modern installable PWAs need:
 *   pwa-64x64.png, pwa-192x192.png, pwa-512x512.png,
 *   maskable-icon-512x512.png, apple-touch-icon-180x180.png,
 *   favicon.ico
 */
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: minimal2023Preset,
  images: ['public/icon.svg'],
});
