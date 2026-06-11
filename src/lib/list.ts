/**
 * Pure list-view helpers: search, sort, filter, snippet extraction.
 *
 * Pulling these out of the Svelte component keeps them testable and keeps the
 * view code focused on rendering. Keeping them pure means we can compose them
 * in any order without surprise interactions.
 */

import { EMPTY_BEER_USER_STATE } from './types';
import type { Beer, BeerUserState, FilterMode, SortDirection, SortKey, UserData } from './types';

/**
 * Combine the dataset's beer list with any ad-hoc beers the user has
 * created. Ad-hoc beers live as entries in UserData (keyed by their
 * locally-generated id) with the source-beer fields stashed in the
 * `adhoc` payload. The merged list is what the list view actually
 * renders — ad-hoc beers slot in alongside dataset beers and sort
 * normally.
 */
export function mergeBeers(dataset: Beer[], userData: UserData): Beer[] {
  const out: Beer[] = [...dataset];
  for (const [id, state] of Object.entries(userData.beers)) {
    if (!state.adhoc) continue;
    out.push(adhocAsBeer(id, state.adhoc));
  }
  return out;
}

function adhocAsBeer(id: string, payload: { name: string; brewery: string } & Partial<Beer>): Beer {
  return {
    id,
    name: payload.name,
    brewery: payload.brewery,
    abv: payload.abv ?? null,
    style: payload.style ?? null,
    location: payload.location ?? null,
    description: payload.description ?? null,
  };
}

const SNIPPET_CONTEXT_CHARS = 40;
const MAX_SNIPPET_LEN = 120;

export interface BeerRowVM {
  beer: Beer;
  state: BeerUserState;
  /** When the search matched ONLY the description, a snippet to show inline. */
  descriptionSnippet: string | null;
  /** Indices into `descriptionSnippet` for highlight. Null when no snippet. */
  highlightRange: { start: number; end: number } | null;
}

export interface BuildRowsOptions {
  search: string;
  filter: FilterMode;
  sort: SortKey;
  direction?: SortDirection;
  /** When true, beers marked `notPresent` are included; otherwise hidden. */
  showNotPresent?: boolean;
}

/**
 * Returns the row view-model after applying search, then filter, then sort.
 *
 * Pipeline (in order):
 *   not-present hiding -> search -> filter -> sort -> snippet extraction
 *
 * `userData` is the active user state. Filters and the not-present hide
 * step read from it. Beers with no entry use the empty default.
 */
export function buildRows(
  beers: Beer[],
  userData: UserData,
  options: BuildRowsOptions,
): BeerRowVM[] {
  const { search, filter, sort, direction = 'asc', showNotPresent = false } = options;
  const q = search.trim().toLowerCase();
  const filtered = beers.filter((b) => {
    const state = stateFor(userData, b.id);
    if (!showNotPresent && state.notPresent) return false;
    if (!matchesSearch(b, q)) return false;
    if (!matchesFilter(state, filter)) return false;
    return true;
  });
  const sorted = [...filtered].sort(comparator(sort, direction));
  return sorted.map((beer) => buildVm(beer, stateFor(userData, beer.id), q));
}

function stateFor(userData: UserData, beerId: string): BeerUserState {
  return userData.beers[beerId] ?? EMPTY_BEER_USER_STATE;
}

// --- Search ------------------------------------------------------------------

function matchesSearch(beer: Beer, q: string): boolean {
  if (!q) return true;
  if (beer.name.toLowerCase().includes(q)) return true;
  if (beer.brewery.toLowerCase().includes(q)) return true;
  if (beer.style && beer.style.toLowerCase().includes(q)) return true;
  if (beer.description && beer.description.toLowerCase().includes(q)) return true;
  return false;
}

/**
 * True when the search hit ONLY the description — i.e. nothing in name,
 * brewery, or style matched. This is what triggers the inline snippet.
 */
function matchedOnlyDescription(beer: Beer, q: string): boolean {
  if (!q || !beer.description) return false;
  const inName = beer.name.toLowerCase().includes(q);
  const inBrewery = beer.brewery.toLowerCase().includes(q);
  const inStyle = !!beer.style && beer.style.toLowerCase().includes(q);
  if (inName || inBrewery || inStyle) return false;
  return beer.description.toLowerCase().includes(q);
}

// --- Filter ------------------------------------------------------------------

/**
 * Filter predicate against per-beer user state.
 *
 * - 'all'      — show every (non-hidden) beer
 * - 'toTry'    — only beers with status === 'toTry'
 * - 'tried'    — only beers with status === 'tried'
 * - 'notTried' — beers whose status is NOT 'tried' (i.e. null or 'toTry')
 *                so the festival-goer can see what's still on the table.
 */
function matchesFilter(state: BeerUserState, mode: FilterMode): boolean {
  switch (mode) {
    case 'all':
      return true;
    case 'toTry':
      return state.status === 'toTry';
    case 'tried':
      return state.status === 'tried';
    case 'notTried':
      return state.status !== 'tried';
  }
}

// --- Sort --------------------------------------------------------------------

/**
 * Comparator builder. Missing-field rows always sort to the END, regardless
 * of sort direction, so the populated rows are visible first (spec). Direction
 * only flips the ordering among rows that HAVE the sort field.
 */
function comparator(sort: SortKey, direction: SortDirection): (a: Beer, b: Beer) => number {
  const mul = direction === 'desc' ? -1 : 1;
  if (sort === 'name') {
    return (a, b) => mul * a.name.localeCompare(b.name);
  }
  if (sort === 'abv') {
    return (a, b) => {
      // Missing ABV always goes last, regardless of direction.
      if (a.abv === null && b.abv === null) return 0;
      if (a.abv === null) return 1;
      if (b.abv === null) return -1;
      return mul * (a.abv - b.abv);
    };
  }
  // 'brewery' — default. Then beer name within a brewery.
  // Both primary and secondary keys reverse together when direction is desc,
  // matching conventional spreadsheet behavior on multi-column sorts.
  return (a, b) => {
    const byBrewery = a.brewery.localeCompare(b.brewery);
    if (byBrewery !== 0) return mul * byBrewery;
    return mul * a.name.localeCompare(b.name);
  };
}

// --- Snippet extraction ------------------------------------------------------

function buildVm(beer: Beer, state: BeerUserState, q: string): BeerRowVM {
  // A non-empty custom location overrides the dataset location in the list.
  const customLocation = state.location.trim();
  const effectiveBeer = customLocation ? { ...beer, location: customLocation } : beer;
  if (!matchedOnlyDescription(beer, q)) {
    return { beer: effectiveBeer, state, descriptionSnippet: null, highlightRange: null };
  }
  // Safe: matchedOnlyDescription returned true.
  const desc = beer.description!;
  const lower = desc.toLowerCase();
  const matchStart = lower.indexOf(q);
  const matchEnd = matchStart + q.length;
  const start = Math.max(0, matchStart - SNIPPET_CONTEXT_CHARS);
  const end = Math.min(desc.length, matchEnd + SNIPPET_CONTEXT_CHARS);
  let snippet = desc.slice(start, end);
  if (start > 0) snippet = '…' + snippet;
  if (end < desc.length) snippet = snippet + '…';
  if (snippet.length > MAX_SNIPPET_LEN) {
    snippet = snippet.slice(0, MAX_SNIPPET_LEN - 1) + '…';
  }
  // Highlight range is relative to the (possibly-prefixed) snippet.
  const leadingEllipsis = start > 0 ? 1 : 0;
  const hlStart = matchStart - start + leadingEllipsis;
  const hlEnd = hlStart + q.length;
  return {
    beer: effectiveBeer,
    state,
    descriptionSnippet: snippet,
    highlightRange: { start: hlStart, end: hlEnd },
  };
}
