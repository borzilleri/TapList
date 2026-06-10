/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected at build time from package.json via Vite's `define`. */
declare const __APP_VERSION__: string;
/** GitHub release page for the current version. Injected via Vite's `define`. */
declare const __APP_RELEASE_URL__: string;
