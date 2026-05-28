/**
 * URL helpers for the festival selector.
 *
 * Festival selection is encoded as a query parameter (`?festivalId=<id>`)
 * so the catalog/dataset can be deep-linked: copy the address bar, paste
 * it in chat, and the recipient lands on the same festival even if it
 * isn't the catalog's default.
 *
 * Both helpers are pure (no `window` access) so they're trivially unit-
 * testable. The wiring to actual `window.location` / `window.history`
 * lives in `App.svelte`, which is the only consumer.
 */

/** The query-string parameter name. User-facing — bake-in cost to change. */
export const FESTIVAL_PARAM = 'festivalId';

/**
 * Extract the festival id from a `location.search` string. Returns `null`
 * if the param is absent, blank, or otherwise unusable. Tolerant of both
 * raw search strings (`?festivalId=foo`) and bare ones (`festivalId=foo`).
 */
export function readFestivalId(search: string): string | null {
  const params = new URLSearchParams(search);
  const value = params.get(FESTIVAL_PARAM);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Produce a new full URL with `festivalId` set to the given id, preserving
 * any other query parameters and the path/hash. Idempotent: passing the
 * same id back returns an equivalent URL string.
 */
export function urlWithFestivalId(href: string, id: string): string {
  const url = new URL(href);
  url.searchParams.set(FESTIVAL_PARAM, id);
  return url.toString();
}
