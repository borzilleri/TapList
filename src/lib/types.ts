/**
 * Domain types for TapList. These mirror the shapes documented in
 * docs/data-model.md. Source-of-truth lives there; this file is the
 * TypeScript projection.
 */

// --- Catalog (the index of available festival datasets) ---

export type DatasetStatus = 'upcoming' | 'active' | 'archived';

export interface CatalogEntry {
  id: string;
  name: string;
  url: string;
  dates?: { start: string; end: string };
  location?: string;
  status?: DatasetStatus;
  default?: boolean;
}

export interface Catalog {
  version: number;
  datasets: CatalogEntry[];
}

// --- Dataset (one festival's beer list) ---

/**
 * A beer as exposed to the rest of the app. ABV is a number-or-null after
 * validation — invalid/missing/unparseable ABV in the source JSON all collapse
 * to null here.
 */
export interface Beer {
  id: string;
  name: string;
  brewery: string;
  abv: number | null;
  style: string | null;
  location: string | null;
  description: string | null;
}

export interface Dataset {
  id: string;
  festival: string | null;
  updatedAt: string | null;
  beers: Beer[];
}

// --- User data (per-beer state in localStorage) ---

export const NOTES_MAX_LENGTH = 280;

/** Cap on the user-supplied custom location override. */
export const LOCATION_MAX_LENGTH = 80;

/**
 * Tri-state user progress on a beer. `null` means neither queued nor tried.
 * Setting `opinion` to a non-null value implicitly sets `status = 'tried'`
 * (the cascade lives in the store, not the type).
 */
export type BeerStatus = 'toTry' | 'tried' | null;

export type Opinion = 'liked' | 'disliked' | null;

/**
 * Ad-hoc beers carry the source-beer fields here because they aren't in the
 * dataset. Slice 2 doesn't create or edit ad-hoc beers but the type lives
 * here so the storage layer can pass the payload through unchanged for
 * slice 3.
 */
export interface AdhocBeerPayload {
  name: string;
  brewery: string;
  abv?: number | null;
  style?: string;
  location?: string;
  description?: string;
}

export interface BeerUserState {
  status: BeerStatus;
  opinion: Opinion;
  notes: string;
  /**
   * User-supplied custom location. Overrides the dataset beer's `location`
   * in the list view when non-empty. Empty string means "no override".
   */
  location: string;
  notPresent: boolean;
  adhoc?: AdhocBeerPayload;
}

export interface UserData {
  version: 1;
  beers: Record<string, BeerUserState>;
}

/** The "empty" / default state for any beer the user hasn't touched. */
export const EMPTY_BEER_USER_STATE: Readonly<BeerUserState> = Object.freeze({
  status: null,
  opinion: null,
  notes: '',
  location: '',
  notPresent: false,
});

// --- App-wide settings (persisted to localStorage) ---

/**
 * Settings that apply across the whole app (not per-dataset). Persisted
 * to localStorage under `taplist:settings`. Versioned for future
 * migrations.
 */
/**
 * Color scheme preference. `'system'` defers to `prefers-color-scheme`;
 * `'light'` and `'dark'` force the corresponding palette regardless.
 */
export type ThemePreference = 'light' | 'dark' | 'system';

export interface AppSettings {
  version: 1;
  /** When true, beers the user has marked notPresent are visible in the list. */
  showNotPresent: boolean;
  /** User's color scheme preference. Defaults to 'system'. */
  theme: ThemePreference;
  /**
   * The id of the dataset the user last loaded. Drives the boot resolution
   * cascade after the URL parameter but before the catalog defaults. `null`
   * means "no saved selection" (fresh install, or the user explicitly
   * cleared it) — the app falls back to catalog.default or the first entry.
   */
  selectedDatasetId: string | null;
}

// --- View model: sort/filter/search state for the list view ---

export type SortKey = 'brewery' | 'name' | 'abv';
export type SortDirection = 'asc' | 'desc';
export type FilterMode = 'all' | 'toTry' | 'tried' | 'notTried';

export interface ListViewState {
  sort: SortKey;
  sortDirection: SortDirection;
  filter: FilterMode;
  search: string;
  showNotPresent: boolean;
}
