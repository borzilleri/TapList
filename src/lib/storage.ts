/**
 * localStorage read/write for user data.
 *
 * The storage layer is intentionally pure-ish: it accepts a Storage-like
 * dependency (so tests can inject an in-memory mock) and exposes pure
 * parse/serialize functions that work without any global side effects.
 *
 * Behavior reference: docs/data-model.md §3 (User data).
 */

import {
  EMPTY_BEER_USER_STATE,
  NOTES_MAX_LENGTH,
  type AdhocBeerPayload,
  type BeerStatus,
  type BeerUserState,
  type Opinion,
  type UserData,
} from './types';

const STORAGE_KEY_PREFIX = 'taplist:userdata:';
const CURRENT_VERSION = 1 as const;

/** The Storage API subset we depend on — keeps tests from needing a full DOM. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function storageKeyFor(datasetId: string): string {
  return `${STORAGE_KEY_PREFIX}${datasetId}`;
}

export function emptyUserData(): UserData {
  return { version: CURRENT_VERSION, beers: {} };
}

/**
 * Read user data from a Storage-like backend. Defensive against missing,
 * malformed, or partially-bad JSON — always returns a valid UserData
 * (possibly with fewer or zero beers). Never throws on bad data; that's
 * the storage layer's job to absorb.
 */
export function loadUserData(datasetId: string, storage: StorageLike): UserData {
  const raw = storage.getItem(storageKeyFor(datasetId));
  if (raw === null) return emptyUserData();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.warn(`User data for ${datasetId}: JSON parse failed, starting fresh`);
    return emptyUserData();
  }
  return parseUserData(parsed);
}

export function saveUserData(datasetId: string, data: UserData, storage: StorageLike): void {
  storage.setItem(storageKeyFor(datasetId), JSON.stringify(data));
}

/**
 * Parse + sanitize user data. Drops invalid per-beer entries with a console
 * warning; never throws. Unknown fields on a beer state are preserved
 * verbatim (forward-compat) — except `adhoc`, which gets its own validation
 * so the slice-3 ad-hoc UI can rely on the shape.
 */
export function parseUserData(raw: unknown): UserData {
  if (!raw || typeof raw !== 'object') return emptyUserData();
  const obj = raw as Record<string, unknown>;
  if (obj.version !== CURRENT_VERSION) {
    // Future migrations live here. For v1, anything else is treated as empty.
    if (typeof obj.version === 'number') {
      console.warn(
        `User data: unknown version ${obj.version}, starting fresh (current is ${CURRENT_VERSION})`,
      );
    }
    return emptyUserData();
  }
  if (!obj.beers || typeof obj.beers !== 'object') return emptyUserData();

  const beers: Record<string, BeerUserState> = {};
  for (const [beerId, rawState] of Object.entries(obj.beers as Record<string, unknown>)) {
    const parsed = parseBeerState(rawState);
    if (parsed) beers[beerId] = parsed;
  }
  return { version: CURRENT_VERSION, beers };
}

function parseBeerState(raw: unknown): BeerUserState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  let status = parseStatus(s.status);
  let opinion = parseOpinion(s.opinion);
  let notes = parseNotes(s.notes);
  const notPresent = s.notPresent === true;
  const adhoc = parseAdhoc(s.adhoc);

  // Enforce the invariant: a not-present beer can't carry status/opinion/notes.
  // If storage has both (e.g. hand-edited), not-present wins.
  if (notPresent) {
    status = null;
    opinion = null;
    notes = '';
  }

  // If the entry has no actual data on it, treat it as absent so we don't
  // bloat storage with empty records. Ad-hoc beers always carry data, so
  // they're never empty by definition.
  if (adhoc === undefined && status === null && opinion === null && notes === '' && !notPresent) {
    return null;
  }

  const result: BeerUserState = { status, opinion, notes, notPresent };
  if (adhoc) result.adhoc = adhoc;
  return result;
}

function parseStatus(value: unknown): BeerStatus {
  if (value === 'toTry' || value === 'tried') return value;
  return null;
}

function parseOpinion(value: unknown): Opinion {
  if (value === 'liked' || value === 'disliked') return value;
  return null;
}

function parseNotes(value: unknown): string {
  if (typeof value !== 'string') return '';
  // Hard cap on read — defensive against hand-edited storage.
  if (value.length > NOTES_MAX_LENGTH) return value.slice(0, NOTES_MAX_LENGTH);
  return value;
}

function parseAdhoc(value: unknown): AdhocBeerPayload | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const a = value as Record<string, unknown>;
  // name and brewery are both required; missing either invalidates the
  // payload (the entry might still have user state, which parseBeerState
  // preserves separately).
  if (typeof a.name !== 'string' || a.name.length === 0) return undefined;
  if (typeof a.brewery !== 'string' || a.brewery.length === 0) return undefined;
  const result: AdhocBeerPayload = { name: a.name, brewery: a.brewery };
  if (typeof a.abv === 'number' && Number.isFinite(a.abv)) result.abv = a.abv;
  else if (a.abv === null) result.abv = null;
  if (typeof a.style === 'string') result.style = a.style;
  if (typeof a.location === 'string') result.location = a.location;
  if (typeof a.description === 'string') result.description = a.description;
  return result;
}

/**
 * Returns the user state for a beer, or the default empty state if no record
 * exists. Always returns a stable shape so consumers can read `status`,
 * `notes`, etc. without null-checking the wrapper.
 */
export function beerState(data: UserData, beerId: string): BeerUserState {
  return data.beers[beerId] ?? EMPTY_BEER_USER_STATE;
}

/** True when the beer has any user-visible state (matches the CSV "touched" rule). */
export function isBeerTouched(state: BeerUserState): boolean {
  return (
    state.status !== null ||
    state.opinion !== null ||
    state.notes !== '' ||
    state.notPresent ||
    state.adhoc !== undefined
  );
}
