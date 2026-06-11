# TapList — code architecture

This document describes how the codebase is laid out and how the pieces fit together. For _what_ the app does, see [spec.md](spec.md); for the shape of the data, see [data-model.md](data-model.md).

## Snapshot

TapList is a single-page Svelte 5 (runes mode) app built with Vite. It runs entirely in the browser — there is no backend. The published catalog and datasets are static JSON files fetched at runtime from a standalone data site ([`taplist-data`](https://github.com/borzilleri/taplist-data) on GitHub Pages, `https://borzilleri.net/taplist-data/`), so festival data can be updated without redeploying the app; user data lives in `localStorage`. The app installs as a PWA so it keeps working with no network at the festival.

The build output is plain JS, CSS, an `index.html`, a manifest, a service worker, and a `CNAME` — all served from GitHub Pages at `https://taplist.rampant.io/`.

## Layering

Code is organised by responsibility, not by feature. Three layers, plus the entrypoint:

```
src/main.ts                 mount Svelte root
src/App.svelte              orchestrator: wires stores, owns top-level state
src/components/             presentation: dumb-ish Svelte components
src/lib/                    pure logic + stores + browser-effect helpers
src/lib/types.ts            shared domain types (the contract everyone agrees on)
```

The lib layer has two flavours of modules:

- **Pure modules** — plain TypeScript, no Svelte: `data.ts`, `csv.ts`, `transfer.ts`, `cascade.ts`, `list.ts`, `storage.ts`, `platform.ts`, `focusTrap.ts`, `scrollLock.ts`. These are deterministic, side-effect-free where possible, and easy to unit-test with Vitest in a Node environment.
- **Reactive stores** — files with the `.svelte.ts` extension that use Svelte's `$state`: `userStore.svelte.ts`, `settingsStore.svelte.ts`, `pwa.svelte.ts`, `dialogs.svelte.ts`. The extension is what lets Vite compile the rune syntax outside of `.svelte` files.

The cardinal rule: **components don't talk to `localStorage` or the network directly**. They receive props or call store methods. Persistence and fetch live behind `lib/`.

## Module map

### Entrypoint

| File                | Purpose                                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.ts`       | Boots Svelte, mounts `App` into `#app`, imports global CSS.                                                                                                                                   |
| `src/App.svelte`    | Orchestrator. Creates the three stores, drives the catalog → dataset load promise, owns top-level UI state (selected beer, modals open, import status), routes user actions back into stores. |
| `src/app.css`       | Global CSS variables (palette, typography, radii, shadows), light/dark via `prefers-color-scheme`, explicit `:root[data-theme=…]` overrides, base resets.                                     |
| `src/vite-env.d.ts` | Vite type augmentations.                                                                                                                                                                      |

### Domain types

| File               | Purpose                                                                                                                                                                                                                              |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/types.ts` | Every shared shape: `Beer`, `Catalog`, `Dataset`, `BeerUserState`, `UserData`, `AdhocBeerPayload`, `AppSettings`, `ThemePreference`, sort/filter enums, `NOTES_MAX_LENGTH`. This is the contract; everything else imports from here. |

### Pure logic

| File                    | Purpose                                                                                                                                                                                       |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/data.ts`       | Fetches and validates the catalog + active dataset. Defensive parsers that drop bad entries and warn but never throw. Re-anchors root-relative dataset URLs at the deployed base path.        |
| `src/lib/cascade.ts`    | Tri-state status (`null` / `'toTry'` / `'tried'`) + opinion + not-present cascade rules. The single source of truth for "what happens when I change X?"                                       |
| `src/lib/storage.ts`    | `StorageLike` interface (so we can inject mocks), `loadUserData` / `saveUserData`, namespacing by dataset id, defensive parse + version handling.                                             |
| `src/lib/list.ts`       | `mergeBeers(dataset + adhoc)`, `buildRows` (search/filter/sort over the merged set), search-term highlighting metadata. Returns row view-models that components render with no further logic. |
| `src/lib/csv.ts`        | RFC 4180 serialize/parse. Pure string → array → string.                                                                                                                                       |
| `src/lib/transfer.ts`   | Export and import wrappers over `csv.ts`. `serializeExport` collects only touched rows; `parseImport` applies lenient boolean/opinion parsing and notes truncation. Filename builder.         |
| `src/lib/platform.ts`   | `isIosSafari()` / `isStandalonePwa()` taking an injectable `PlatformEnv` for testability.                                                                                                     |
| `src/lib/focusTrap.ts`  | Svelte action: traps Tab inside a modal and restores focus on teardown. Uses `{ preventScroll: true }` everywhere.                                                                            |
| `src/lib/scrollLock.ts` | Svelte action: locks body scroll when a modal opens, restores scroll position on close.                                                                                                       |

### Reactive stores

| File                              | Purpose                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/userStore.svelte.ts`     | The big one. Wraps user data in `$state`, exposes `get(id)` / `set(id, partial)` / `addAdhoc` / `updateAdhoc` / `deleteAdhoc` / `replaceData`. Cascade rules from `cascade.ts` apply on every mutation. Persists to `StorageLike` on every change. Namespaced by dataset id via `activate(id)`. Exports `generateAdhocId` (UUID v4 with iOS 14 fallback) and `isAdhocId`. |
| `src/lib/settingsStore.svelte.ts` | App-wide settings (theme, show-not-present). Fixed key (`taplist:settings`) — not per-dataset.                                                                                                                                                                                                                                                                            |
| `src/lib/pwa.svelte.ts`           | Service worker registration via `virtual:pwa-register`. Exposes update-available state + a `reload()` method. Unregisters all SWs in dev mode to prevent stale-SW bugs.                                                                                                                                                                                                   |
| `src/lib/dialogs.svelte.ts`       | Singleton controller for the styled confirm dialog. Exposes a promise-based `dialogs.confirm({ title, message })` and the reactive state the `ConfirmDialog` component reads. Also hangs itself off `window.__taplistDialogs` so e2e tests can resolve confirmations.                                                                                                     |

### Components

All components are file-local Svelte; no global components folder structure. Conventions: props via `interface Props` + `$props()`, callbacks (`onSomething: () => void`) instead of custom events, no two-way `$bindable` except for native form inputs inside a component.

| File                                       | Renders                                                                                                                            | Receives                                                             |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `src/components/BeerList.svelte`           | The sortable / filterable / searchable list, `BeerRow` per row, the toolbar of controls.                                           | `dataset`, `userStore`, filter/sort state.                           |
| `src/components/BeerRow.svelte`            | One row in the list. Pure presentation; receives a row view-model from `buildRows`.                                                | `BeerRowVM`, click handlers.                                         |
| `src/components/BeerDetail.svelte`         | Full-screen modal for a single beer. Status / opinion buttons, notes textarea, not-present toggle, ad-hoc edit/delete affordances. | The selected `Beer`, `userStore`, close + edit callbacks.            |
| `src/components/AdhocBeerForm.svelte`      | Create/edit form for ad-hoc beers.                                                                                                 | Optional initial payload, submit + close callbacks.                  |
| `src/components/SettingsDrawer.svelte`     | Right-side drawer: theme segmented control, show-not-present toggle, CSV export/import, iOS install hint (conditional).            | `theme`, `showNotPresent`, `importStatus`, all the action callbacks. |
| `src/components/ConfirmDialog.svelte`      | Reads `dialogs.svelte` state. Renders nothing when closed.                                                                         | (none — pulls from the singleton.)                                   |
| `src/components/PwaBanner.svelte`          | "A new version is available — reload" banner.                                                                                      | `pwa` state.                                                         |
| `src/components/FreshnessIndicator.svelte` | Tiny "data fetched X ago" pill under the header.                                                                                   | `fetchedAt` timestamp.                                               |
| `src/components/LoadingSkeleton.svelte`    | Placeholder rows shown while the dataset loads.                                                                                    | (none.)                                                              |

## Runtime data flow

### Page load

1. `main.ts` mounts `App.svelte`.
2. `App` constructs `userStore` and `settingsStore` against `window.localStorage`. Settings hydrate immediately.
3. `App` calls `pwa.register()` (fire-and-forget).
4. `App` kicks off `loadAndActivate()`:
   - `loadActiveDataset()` fetches `data/catalog.json` from the data base URL (`VITE_DATA_BASE_URL` in production, the app origin in dev), picks an active entry (or honours one if multiple), then fetches that entry's dataset URL.
   - On success, `userStore.activate(dataset.id)` namespaces all subsequent reads/writes under `taplist:userdata:<datasetId>`.
5. The template's `{#await loadPromise}` block swaps from the loading skeleton to the populated list (or to the error state with a Retry button).
6. A `$effect` mirrors `settingsStore.theme` to the `<html data-theme>` attribute (removed entirely when the preference is `'system'` so the `prefers-color-scheme` media query takes over).

### A user mutation (e.g. tapping the "to-try" star)

1. `BeerRow` invokes a callback up to `App` / `BeerList`.
2. The handler calls a `userStore` method, e.g. `userStore.set(id, { status: 'toTry' })`.
3. `userStore` applies cascade rules from `cascade.ts` (e.g. clearing opinion when status leaves `'tried'`).
4. `userStore` writes the new `$state` and synchronously persists via `saveUserData(storage, ...)`.
5. Reactive Svelte re-renders only the cells that depend on that beer's state.

### Import (destructive)

1. User picks a file in `SettingsDrawer`; `App.handleImportFile` reads it.
2. `parseImport(text, dataset)` returns an `ImportResult` (parsed rows + warnings + summary).
3. `App` asks `dialogs.confirm({ ... })` to confirm replacement.
4. On confirm, `userStore.replaceData(...)` wipes and rewrites the namespaced storage in one shot.

## Conventions

### Svelte 5 runes mode

`$state` for reactive state, `$derived` for memoised computation, `$effect` for browser side effects, `$props()` to declare component inputs. No legacy `let`-as-state, no `$:` reactive blocks.

### Store factory pattern

Stores expose a `createXxxStore(storage)` factory rather than a singleton. This keeps tests trivial (`createUserStore(makeStorage())`) and lets components see the store's class type via `import type { UserStore } from '...'`. The single live instance is constructed in `App.svelte` and passed down.

### `StorageLike` over `localStorage` directly

`storage.ts` defines `StorageLike { getItem, setItem, removeItem }`. Stores accept any conforming object. Production passes `window.localStorage`; tests pass a `Map`-backed mock. Nothing in `lib/` imports `localStorage` directly.

### `$effect` lives in components, not stores

Stores own state and persistence. Anything DOM-shaped — applying `data-theme`, scrolling on selection change, focus moves — runs as a `$effect` in the component closest to the affected element.

### Defensive validation, lenient parsing

Every external input runs through a parser that drops bad entries and continues with what's valid. Catalog with three bad and two good entries → returns the two good ones with `console.warn`s. CSV with messy boolean cells → both `to_try` and `tried` can be `yes`/`no`/`1`/`0`/`true`/`false`. The app never throws on malformed inputs; it degrades.

### Cascade as a pure function

All "when X changes, also clear/set Y" rules live in `cascade.ts` and operate on plain objects. The user store calls into them on every mutation. Tests can exhaustively cover the cascade without booting Svelte.

### Custom Svelte actions for cross-cutting concerns

Focus trapping (`focusTrap`) and scroll locking (`lockBodyScroll`) are `use:` actions, not components or hooks. Each modal applies both. The actions handle teardown on the action's `destroy`.

### Component callbacks, not event dispatchers

Svelte 5 deprecates `createEventDispatcher`. Callbacks come in as typed `Props` (`onSelect: (id: string) => void`). Easier to grep, easier to type, no string event names to typo.

## Persistence

All keys live under the `taplist:` prefix:

| Key                            | Owner           | Lifetime                              |
| ------------------------------ | --------------- | ------------------------------------- |
| `taplist:userdata:<datasetId>` | `userStore`     | Per dataset. Wiped on import-replace. |
| `taplist:settings`             | `settingsStore` | App-wide. Never per-dataset.          |

Schemas are versioned (`version: 1` in stored JSON). Loaders branch on the version; an unknown version returns defaults rather than throwing. When the schema changes, bump `CURRENT_VERSION` and add migration logic to the parser.

## Build & deploy

| File                              | Role                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vite.config.ts`                  | Vite + Svelte plugin + `vite-plugin-pwa` config. `base` is parameterized via `VITE_BASE_PATH` (defaults to `/` for the custom domain; can be set to `/TapList/` for a project-path fallback). Workbox precaches the shell and runtime-caches `/data/*.json` with `NetworkFirst`.                          |
| `eslint.config.js`                | Flat config: `@eslint/js` + `typescript-eslint` + `eslint-plugin-svelte` + Prettier compat. Unused `_`-prefixed args allowed.                                                                                                                                                                             |
| `tsconfig.json`                   | Extends `@tsconfig/svelte`; `strict`, `noUnusedLocals`, `noUnusedParameters`.                                                                                                                                                                                                                             |
| `.prettierrc` (in `package.json`) | 2-space, single-quote, 100-col, trailing commas everywhere.                                                                                                                                                                                                                                               |
| `.github/workflows/ci.yml`        | Lint → check → test → build → Playwright e2e. Caches `~/.cache/ms-playwright`.                                                                                                                                                                                                                            |
| `.github/workflows/deploy.yml`    | On published release (or manual dispatch): build, upload as Pages artifact, deploy. Sets `VITE_DATA_BASE_URL` so the build fetches data from the standalone data site. `public/CNAME` carries the custom domain.                                                                                          |
| `public/`                         | Static files copied verbatim into `dist/`: PWA icons, favicon, `robots.txt`, `CNAME`, and `data/` — which now holds only a **local-dev fixture** (`catalog.json` + `taplist-mock-2026.json`). Real festival data lives in the separate [`taplist-data`](https://github.com/borzilleri/taplist-data) repo. |

## Dependencies

The shipped bundle has **zero runtime npm dependencies**. Svelte compiles to plain JS, and everything else is dev-time tooling. The full list:

### Build / runtime tooling

| Package                        | Purpose                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------- |
| `svelte`                       | The framework. Runes mode.                                                      |
| `@sveltejs/vite-plugin-svelte` | Vite ↔ Svelte glue.                                                             |
| `@tsconfig/svelte`             | Base TS config preset.                                                          |
| `vite`                         | Bundler + dev server.                                                           |
| `vite-plugin-pwa`              | Service worker generation, manifest emission, runtime caching strategies.       |
| `@vite-pwa/assets-generator`   | One-shot CLI: derives the full icon set from `public/icon.svg`.                 |
| `typescript`                   | Language.                                                                       |
| `svelte-check`                 | Type-checks `.svelte` files (TS doesn't natively). Used in `check` and `build`. |

### Testing

| Package      | Purpose                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `vitest`     | Unit test runner. Fast, Vite-aware.                                                                                                              |
| `playwright` | Headless Chromium driver for the a11y smoke suite.                                                                                               |
| `tsx`        | Runs the e2e suite TypeScript file directly. The e2e suite uses Playwright's library API rather than its test runner — keeps the dep tree small. |

### Lint / format

| Package                               | Purpose                                                                                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint` + `@eslint/js`               | Linter.                                                                                                                                |
| `typescript-eslint`                   | The unified TS-aware plugin (re-exports both the parser and the plugin — we don't need the legacy `@typescript-eslint/*` subpackages). |
| `eslint-plugin-svelte`                | Svelte-aware lint rules.                                                                                                               |
| `eslint-config-prettier`              | Disables ESLint rules that conflict with Prettier.                                                                                     |
| `globals`                             | Lookup table of global names per environment.                                                                                          |
| `prettier` + `prettier-plugin-svelte` | Formatter.                                                                                                                             |

## Test surface

`npm test` runs ten Vitest files (248 tests, ~700ms). Coverage focuses on the pure layer:

- `cascade.test.ts` — every cascade transition.
- `csv.test.ts` — RFC 4180 round-trips + edge cases (embedded quotes, CRLF, BOM).
- `data.test.ts` — catalog + dataset parsing, URL resolution, validation drop behaviour.
- `dialogs.test.ts` — promise resolution + cancellation.
- `list.test.ts` — search, filter, sort, merge.
- `platform.test.ts` — UA + standalone detection.
- `settingsStore.test.ts` — persistence, parsing, theme handling.
- `storage.test.ts` — load/save, version handling, namespacing.
- `transfer.test.ts` — export filtering + import with all the lenient parsers.
- `userStore.test.ts` — store lifecycle, mutations, ad-hoc CRUD.

`npm run test:e2e` boots a `vite preview` server and runs `e2e/a11y.spec.ts` (Playwright library API, not the test-runner). CI runs both gates.

## Common change recipes

### Add a setting

1. Extend `AppSettings` in `types.ts`.
2. Add a parser branch in `settingsStore.svelte.ts`'s `parseSettings` (default value, validation).
3. Add a getter and setter on the `SettingsStore` class.
4. Render it in `SettingsDrawer.svelte`; thread a callback in `App.svelte`.
5. Cover the new field in `settingsStore.test.ts` (defaults, persistence, round-trip).

### Add a CSV column

1. Add the field to the canonical column order in `transfer.ts`.
2. Update `serializeExport` to emit it and `parseImport` to read it (lenient if it's a flag).
3. Bump `version` in `data-model.md`'s CSV section; consider whether old imports should fall back gracefully.
4. Add test cases in `transfer.test.ts` for the new column on both sides.

### Add a list filter mode

1. Extend the `FilterMode` union in `types.ts`.
2. Implement the predicate in `list.ts`'s `buildRows`.
3. Add the chip / control in `BeerList.svelte`.
4. Cover the new mode in `list.test.ts`.

### Add a new modal

1. Create the component under `src/components/`.
2. Apply both `use:focusTrap` and `use:lockBodyScroll` to its backdrop.
3. Listen for Escape via `<svelte:window onkeydown={...}>` and close on backdrop click (`e.target === e.currentTarget`).
4. Add an e2e case in `e2e/a11y.spec.ts` that asserts focus traps and returns correctly.

## Known follow-ups

- **Visual brand pass.** The current icon is functional but generic; a designed mark is on the roadmap.
