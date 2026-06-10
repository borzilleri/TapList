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

// icon.svg's background rect fill. The apple/maskable presets default to 30% padding on a
// white background, which leaves the icon shrunken inside a white tile. Rendering full-bleed
// and flattening to the brand-dark color fills the rounded-corner gaps, giving a solid dark
// square; iOS/Android then apply their own mask.
const fullBleed = {
  padding: 0,
  resizeOptions: { fit: 'contain' as const, background: '#1a1a1a' },
};

export default defineConfig({
  headLinkOptions: {
    preset: '2023',
  },
  preset: {
    ...minimal2023Preset,
    maskable: { sizes: [512], ...fullBleed },
    apple: { sizes: [180], ...fullBleed },
  },
  images: ['public/icon.svg'],
});
