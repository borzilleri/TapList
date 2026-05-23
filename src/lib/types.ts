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

// --- View model: sort/filter/search state for the list view ---

export type SortKey = 'brewery' | 'name' | 'abv';
export type SortDirection = 'asc' | 'desc';
export type FilterMode = 'all' | 'toTry' | 'tried' | 'notTried';

export interface ListViewState {
  sort: SortKey;
  sortDirection: SortDirection;
  filter: FilterMode;
  search: string;
}
