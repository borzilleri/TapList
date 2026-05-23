# TapList — specification

This document describes what the app does and how it behaves. The dataset and storage schemas live in [data-model.md](data-model.md).

## Architecture

- Single-page web app with no server-side components.
- Installable PWA with full offline support: service worker caches the app shell and the latest dataset so the app works with zero signal once first loaded.
- Hosted on **GitHub Pages** from the app repo. The default `<user>.github.io/<repo>` hostname is used during development and early deploys; a custom domain will be wired up later (DNS change only — no code impact, since all dataset URLs are relative to the deployed site root).
- Mobile-first responsive layout. Primary target is a phone in portrait, one-handed use. Tablet and desktop get wider, more spacious versions of the same UI.
- Browser support: latest two versions of Chrome, Safari, Firefox, and Edge; iOS Safari 14+.
- Accessibility target: WCAG 2.1 AA.

### Recommended stack (non-binding)

- **Vite + Svelte + TypeScript** — small bundle, low boilerplate, well-suited to the app's scope.
- **`vite-plugin-pwa`** for service worker generation and the web app manifest.
- **Plain CSS with custom properties** for styling. No UI kit.
- **`localStorage`** for user data (small enough not to need IndexedDB).
- **Cloudflare Pages or GitHub Pages** for hosting.

Alternatives like Preact + Vite are fine. Full React, Next.js, and SvelteKit are overkill for this scope and should be avoided.

## Dataset

The app discovers and loads datasets through a two-step fetch:

1. **Catalog fetch.** On startup, the app fetches a fixed catalog JSON from a known same-origin URL (`/data/catalog.json`). The catalog lists every festival dataset the app knows about, with metadata (name, dates, location, URL of the dataset itself).
2. **Dataset fetch.** The app picks the active dataset from the catalog (see selection rules below) and fetches it from the URL the catalog specifies. The dataset is the beer list.

Both files are cached locally after a successful fetch. On subsequent loads, the cached copies are used immediately and a background fetch updates them. If a background fetch fails (offline, server down), the cached copy is used silently and the user sees no error — this is the steady-state festival case.

**First-load behavior.** On the very first load with no cache available, the app requires connectivity to bootstrap the catalog. If both the network fetch and the cache are unavailable, the app shows an error state explaining that an initial connection is needed. After the first successful load, the PWA service worker keeps everything available offline.

**Selection rules (v1).** The catalog may list multiple datasets, but v1 does not expose a selector. The app picks, in order: (1) the dataset whose `id` matches a `selectedDatasetId` stored in localStorage (future feature; never set in v1), (2) the entry marked `default: true` in the catalog, (3) the first entry in the list. Selection is deterministic and invisible to the user.

**Freshness indicator.** A subtle indicator near the top of the list shows when the active dataset was last successfully updated (e.g., "updated 5 min ago"). No manual refresh button.

**Future-friendliness.** The catalog indirection means adding a second festival is a content change, not a code change. When a settings-panel selector is added in a future version, it simply exposes a choice that the data layer already supports. User data is namespaced by dataset `id`, so switching between datasets is non-destructive.

See [data-model.md](data-model.md) for the catalog and dataset schemas.

## List view

The primary screen is the list of beers.

### Sort

User can sort by:

- Name (A–Z)
- Brewery (A–Z), then beer name (A–Z) within a brewery — **default on first load**
- ABV (low → high)

Beers missing the sort field (e.g., ABV is optional and may be absent) sort to the end of the list regardless of sort direction, so the user always sees the populated beers first.

### Search

A single freeform text field. Matches case-insensitive substring across name, brewery, style, and description. Matches update the list as the user types.

### Filter

A single-select filter (radio chips or segmented control) controls which beers are visible:

- **All** — every beer (except not-present, see below)
- **To try** — only beers the user has flagged
- **Tried** — only beers the user has marked tried
- **Not tried** — only beers the user has *not* marked tried

Search, sort, and filter compose: e.g. search "saison" + filter "to try" shows only your to-try saisons.

### Not-present beers

Beers marked "not present" are hidden from all list views by default. The user can reveal them via a toggle in the settings panel (see Settings below).

### Visual treatment per beer

Each row shows: name, brewery, and — when populated — ABV, style, and location. Any of those three may be absent on a given beer and the row should simply omit them rather than show "N/A" or a placeholder. Iconography indicates the beer's user state at a glance:

- A flag/star icon if "to try"
- A check or filled state if "tried"
- A thumbs-up / thumbs-down (or equivalent) if Liked / Disliked
- A small badge on ad-hoc (user-added) beers so they're distinguishable from dataset beers
- A notes indicator if the user has notes on the beer

The beer's `description` field is **not** shown in the list row by default — descriptions can be paragraphs long and would dominate the row. There's one exception: when the active search query matches the description (and only the description — not name, brewery, or style), a short snippet of the matching region (with the matched substring highlighted) is shown inline beneath the row so the user can see why the beer is in the results.

Tapping a beer opens a detail view (or expands the row) where the user can perform all interactions described below. The detail view always shows the full `description` text in its entirety — no "read more" collapse. The view scrolls if the description is long.

## User interactions

The following state lives per-beer, in `localStorage`, keyed by the beer's stable `id`. See [data-model.md](data-model.md) for the exact shape.

### Status: To-try / Tried

A single tri-state per beer: **To-try**, **Tried**, or unset. The two are mutually exclusive — marking a beer Tried clears any prior To-try, and marking a beer To-try clears any prior Tried (the user is saying "actually, I haven't tried this yet"). A beer can be Tried with no opinion attached ("I sampled it, no strong feeling"), so Tried and opinion are independent.

The UI presents two controls (a flag/star for To-try, a check for Tried) that read as independent buttons; tapping one selects that state and unselects the other. Tapping the currently-selected one clears it back to unset.

### Opinion: Liked / Disliked

Single-select among `liked`, `disliked`, or unset. Optional. **Setting an opinion automatically sets status to Tried** (since opinions only make sense on beers you've sampled), overwriting a To-try state if it was there. Clearing an opinion does *not* revert status — you still tried it, you just no longer have a recorded opinion.

### Notes

Plain text, hard cap of 280 characters (Twitter-sized). One notes blob per beer. The input prevents typing past the limit and shows a remaining-character counter.

### Not-present

Boolean. Marks a beer as "not at the festival after all." Hides the beer from default views.

### Ad-hoc beers

The user can add a beer that isn't in the dataset (e.g., a last-minute substitution).

- Same schema as dataset beers (`name` required; `brewery`, `abv`, `style`, `location`, `description` optional).
- A locally-generated stable id (e.g., `adhoc-<uuid>`) so the beer persists across sessions and survives export/import.
- Visually badged in the list so the user knows it's user-added.
- Fully editable: the user can change any field after creating.
- Fully deletable (unlike dataset beers, which can only be marked not-present).

## Settings panel

Accessed from a settings icon in the app header. Contains:

- **Show not-present beers** toggle.
- **Export to CSV** button.
- **Import from CSV** button.
- (Future versions may add dataset switcher, theme, etc.)

## Export and import

### Export

- Format: CSV (RFC 4180 quoted).
- Scope: only beers the user has interacted with — those with any of `to_try`, `tried`, opinion set, notes set, marked not-present, or ad-hoc.
- Rows include both source beer fields (so ad-hoc beers can be reconstructed elsewhere) and all user-data fields.
- Filename includes a timestamp.

### Import

- Format: CSV.
- Semantics: **replace**. Importing wipes all current user data on the device, then applies the imported rows. A confirmation dialog spells out the destructive nature ("This will replace all your current ratings, flags, and notes. Continue?") before proceeding.
- Match strategy: rows with a non-ad-hoc `id` are matched against the current dataset. If the `id` doesn't exist in the current dataset (e.g., the dataset was updated between export and import), the row is dropped and the user is shown a count of dropped rows.
- Ad-hoc rows (those flagged `is_adhoc=true`) are recreated as ad-hoc beers on the device, regardless of dataset state.

See [data-model.md](data-model.md) for the full CSV column list and ordering.

## Persistence

All user data lives in `localStorage` on the device. No server-side storage, no sync. The exported CSV is the only way to move data between devices or back it up.

## Out of scope for v1

- No accounts or authentication.
- No cross-device sync.
- No sharing, following, or social features.
- No analytics, telemetry, or external tracking.
- No in-app dataset switcher (architected for, but not exposed).
- No filtering by ABV range or style multi-select (search is the workaround in v1).
- No map view.
