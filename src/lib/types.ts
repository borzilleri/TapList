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
  /**
   * Brewery name. Required on dataset beers (validation drops rows that
   * lack one). Null only for ad-hoc beers that the user added without a
   * brewery, which the spec allows.
   */
  brewery: string | null;
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
  brewery?: string;
  abv?: number | null;
  style?: string;
  location?: string;
  description?: string;
}

export interface BeerUserState {
  status: BeerStatus;
  opinion: Opinion;
  notes: string;
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
  notPresent: false,
});

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
