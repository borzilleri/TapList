/// <reference types="svelte" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Injected at build time from package.json via Vite's `define`. */
declare const __APP_VERSION__: string;
/** GitHub release page for the current version. Injected via Vite's `define`. */
declare const __APP_RELEASE_URL__: string;

interface ImportMetaEnv {
  /**
   * Base URL the catalog/datasets are fetched from. Set by the deploy workflow
   * to the standalone data site; unset in dev so data loads from local `public/data/`.
   */
  readonly VITE_DATA_BASE_URL?: string;
}
