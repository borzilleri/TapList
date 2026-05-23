/**
 * Pure list-view helpers: search, sort, filter, snippet extraction.
 *
 * Pulling these out of the Svelte component keeps them testable and keeps the
 * view code focused on rendering. Keeping them pure means we can compose them
 * in any order without surprise interactions.
 */

import type { Beer, FilterMode, SortKey } from './types';

const SNIPPET_CONTEXT_CHARS = 40;
const MAX_SNIPPET_LEN = 120;

export interface BeerRowVM {
  beer: Beer;
  /** When the search matched ONLY the description, a snippet to show inline. */
  descriptionSnippet: string | null;
  /** Indices into `descriptionSnippet` for highlight. Null when no snippet. */
  highlightRange: { start: number; end: number } | null;
}

/**
 * Returns the row view-model after applying search, then filter, then sort.
 *
 * Filter is currently always 'all' in slice 1 since there's no user state, but
 * the parameter is here so the pipeline is shaped correctly for the next slice.
 */
export function buildRows(
  beers: Beer[],
  search: string,
  filter: FilterMode,
  sort: SortKey,
): BeerRowVM[] {
  const q = search.trim().toLowerCase();
  const filtered = beers.filter((b) => matchesSearch(b, q) && matchesFilter(b, filter));
  const sorted = [...filtered].sort(comparator(sort));
  return sorted.map((beer) => buildVm(beer, q));
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
 * In slice 1 there is no per-beer user state yet, so every filter mode but
 * 'tried' / 'toTry' shows everything. We keep the type/contract in place so
 * the next slice can drop in the real predicate without changing call sites.
 */
function matchesFilter(_beer: Beer, mode: FilterMode): boolean {
  // No user state yet. 'all' and 'notTried' both show everything;
  // 'toTry' and 'tried' show nothing since no beer is in those states.
  if (mode === 'toTry' || mode === 'tried') return false;
  return true;
}

// --- Sort --------------------------------------------------------------------

/**
 * Comparator builder. Missing-field rows always sort to the END, regardless
 * of sort direction, so the populated rows are visible first (spec).
 */
function comparator(sort: SortKey): (a: Beer, b: Beer) => number {
  if (sort === 'name') {
    return (a, b) => a.name.localeCompare(b.name);
  }
  if (sort === 'abv') {
    return (a, b) => {
      // Both missing -> stable. One missing -> missing goes last.
      if (a.abv === null && b.abv === null) return 0;
      if (a.abv === null) return 1;
      if (b.abv === null) return -1;
      return a.abv - b.abv;
    };
  }
  // 'brewery' — default. Then beer name within a brewery.
  return (a, b) => {
    const byBrewery = a.brewery.localeCompare(b.brewery);
    if (byBrewery !== 0) return byBrewery;
    return a.name.localeCompare(b.name);
  };
}

// --- Snippet extraction ------------------------------------------------------

function buildVm(beer: Beer, q: string): BeerRowVM {
  if (!matchedOnlyDescription(beer, q)) {
    return { beer, descriptionSnippet: null, highlightRange: null };
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
    beer,
    descriptionSnippet: snippet,
    highlightRange: { start: hlStart, end: hlEnd },
  };
}
