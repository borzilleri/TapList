/**
 * Export and import transformations.
 *
 * Sits between the user-data model (typed UserData / Beer) and the
 * CSV layer (raw string maps). All behavior matches docs/data-model.md §4:
 *
 * - Export contains only "touched" beers, with both source-beer fields
 *   and user-data fields in each row. Dataset-beer fields are pulled
 *   from the dataset; ad-hoc beers carry their fields in the adhoc
 *   payload.
 * - Import is destructive (replace). Boolean and opinion parsing are
 *   lenient — spreadsheet-edited cells like `x`, `yes`, `liked` (case-
 *   insensitive) all map sensibly. Notes >280 chars are truncated.
 * - On import, non-ad-hoc rows are matched against the current dataset
 *   by id; rows whose id isn't in the dataset are dropped (and counted).
 * - For non-ad-hoc rows, only user-data columns are applied — the
 *   metadata columns are ignored, so the current dataset always wins
 *   on the source-beer fields.
 * - For ad-hoc rows, all fields are restored.
 */

import { parseCsv, serializeCsv, type CsvData } from './csv';
import { isAdhocId } from './userStore.svelte';
import {
  LOCATION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  type AdhocBeerPayload,
  type Beer,
  type BeerUserState,
  type UserData,
} from './types';

// --- Column schema -----------------------------------------------------------

export const EXPORT_HEADERS = [
  'id',
  'name',
  'brewery',
  'abv',
  'style',
  'location',
  'description',
  'to_try',
  'tried',
  'opinion',
  'notes',
  'user_location',
  'not_present',
  'is_adhoc',
] as const;

// --- Export ------------------------------------------------------------------

export interface ExportOptions {
  /** The active dataset's beers, looked up by id for non-ad-hoc rows. */
  datasetBeers: Beer[];
  /** Current user data; only touched entries get exported. */
  userData: UserData;
}

/** Build the CSV body string for the active dataset + user data. */
export function serializeExport(opts: ExportOptions): string {
  return serializeCsv(buildExportCsv(opts));
}

/** Underlying CSV shape, exposed for testing. */
export function buildExportCsv({ datasetBeers, userData }: ExportOptions): CsvData {
  const datasetById = new Map(datasetBeers.map((b) => [b.id, b]));
  const rows: Record<string, string>[] = [];
  for (const [id, state] of Object.entries(userData.beers)) {
    if (!isExportable(state)) continue;
    const beer = state.adhoc ? adhocStateAsBeer(id, state.adhoc) : (datasetById.get(id) ?? null);
    // Orphaned non-ad-hoc entries (id not in current dataset) are skipped on
    // export: we don't have source-beer fields for them, and they'd be
    // dropped on re-import anyway. Log so the dev/user can debug.
    if (!beer) {
      console.warn(
        `Export: skipping userData entry ${id} — no matching dataset beer and no adhoc payload`,
      );
      continue;
    }
    rows.push(rowForExport(beer, state));
  }
  return { headers: [...EXPORT_HEADERS], rows };
}

function isExportable(state: BeerUserState): boolean {
  return (
    state.status !== null ||
    state.opinion !== null ||
    state.notes !== '' ||
    state.location !== '' ||
    state.notPresent ||
    state.adhoc !== undefined
  );
}

function rowForExport(beer: Beer, state: BeerUserState): Record<string, string> {
  return {
    id: beer.id,
    name: beer.name,
    brewery: beer.brewery,
    abv: beer.abv === null ? '' : String(beer.abv),
    style: beer.style ?? '',
    location: beer.location ?? '',
    description: beer.description ?? '',
    to_try: state.status === 'toTry' ? 'true' : 'false',
    tried: state.status === 'tried' ? 'true' : 'false',
    opinion: state.opinion ?? '',
    notes: state.notes,
    user_location: state.location,
    not_present: state.notPresent ? 'true' : 'false',
    is_adhoc: state.adhoc ? 'true' : 'false',
  };
}

function adhocStateAsBeer(id: string, payload: AdhocBeerPayload): Beer {
  return {
    id,
    name: payload.name,
    brewery: payload.brewery,
    abv: typeof payload.abv === 'number' && Number.isFinite(payload.abv) ? payload.abv : null,
    style: payload.style ?? null,
    styleCategory: null,
    location: payload.location ?? null,
    description: payload.description ?? null,
  };
}

/** Build the canonical export filename for a dataset + timestamp. */
export function buildExportFilename(datasetId: string, now: Date = new Date()): string {
  const yyyy = String(now.getFullYear()).padStart(4, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `taplist-export-${datasetId}-${yyyy}${mm}${dd}-${hh}${mi}${ss}.csv`;
}

// --- Import ------------------------------------------------------------------

export interface ImportOptions {
  /** Raw CSV text from the user's file. */
  csvText: string;
  /** Current dataset's beers (for matching non-ad-hoc rows by id). */
  datasetBeers: Beer[];
}

export interface ImportResult {
  /** The new UserData that should replace whatever's currently stored. */
  userData: UserData;
  /** Count of rows that landed in the result (excluding the header). */
  applied: number;
  /** Rows dropped because their non-ad-hoc id isn't in the current dataset. */
  droppedUnknownId: number;
  /** Rows dropped because they were malformed (e.g. missing required fields). */
  droppedInvalid: number;
}

export function parseImport({ csvText, datasetBeers }: ImportOptions): ImportResult {
  const csv = parseCsv(csvText);
  const datasetIds = new Set(datasetBeers.map((b) => b.id));
  const beers: Record<string, BeerUserState> = {};
  let applied = 0;
  let droppedUnknownId = 0;
  let droppedInvalid = 0;

  for (const row of csv.rows) {
    // Skip fully-empty rows silently — these are typically trailing
    // blank lines or commas-only rows from a sloppy editor. They're
    // noise, not malformed data, so they don't belong in droppedInvalid.
    if (isEmptyRow(row)) continue;

    const id = (row.id ?? '').trim();
    if (!id) {
      droppedInvalid++;
      continue;
    }

    const isAdhoc = parseBool(row.is_adhoc) || isAdhocId(id);

    if (isAdhoc) {
      // Reject ad-hoc rows whose id collides with a real dataset beer.
      // A well-formed export never produces this (ad-hoc ids carry the
      // `adhoc-` prefix), but a hand-crafted CSV could try to overwrite
      // a dataset entry's slot with an ad-hoc payload — drop those.
      if (datasetIds.has(id)) {
        droppedInvalid++;
        continue;
      }
      const adhoc = parseAdhocFromRow(row);
      if (!adhoc) {
        droppedInvalid++;
        continue;
      }
      beers[id] = stateFromRow(row, adhoc);
      applied++;
    } else {
      if (!datasetIds.has(id)) {
        droppedUnknownId++;
        continue;
      }
      beers[id] = stateFromRow(row, undefined);
      applied++;
    }
  }

  return {
    userData: { version: 1, beers },
    applied,
    droppedUnknownId,
    droppedInvalid,
  };
}

function stateFromRow(
  row: Record<string, string>,
  adhoc: AdhocBeerPayload | undefined,
): BeerUserState {
  const toTry = parseBool(row.to_try);
  const tried = parseBool(row.tried);
  // Collapse the two boolean columns into the single in-memory status:
  // `tried` wins if both are checked (defensive against hand-edits).
  let status: BeerUserState['status'] = tried ? 'tried' : toTry ? 'toTry' : null;

  const opinion = parseOpinion(row.opinion);
  // Cascade invariant: opinion != null ⇒ status === 'tried'. The UI
  // enforces this when a user picks like/dislike; we re-enforce it here
  // so a CSV with stale or hand-edited values (e.g. tried=false +
  // opinion=liked) can't produce a state the UI can't reach.
  if (opinion !== null && status !== 'tried') status = 'tried';

  let notes = row.notes ?? '';
  if (notes.length > NOTES_MAX_LENGTH) notes = notes.slice(0, NOTES_MAX_LENGTH);
  let location = row.user_location ?? '';
  if (location.length > LOCATION_MAX_LENGTH) location = location.slice(0, LOCATION_MAX_LENGTH);
  const notPresent = parseBool(row.not_present);

  // The not-present cascade applies on import too — the runtime invariant
  // must hold even when reading from a CSV that violates it.
  const state: BeerUserState = notPresent
    ? { status: null, opinion: null, notes: '', location: '', notPresent: true }
    : { status, opinion, notes, location, notPresent: false };

  if (adhoc) state.adhoc = adhoc;
  return state;
}

function isEmptyRow(row: Record<string, string>): boolean {
  for (const value of Object.values(row)) {
    if (value && value.trim().length > 0) return false;
  }
  return true;
}

function parseAdhocFromRow(row: Record<string, string>): AdhocBeerPayload | null {
  const name = (row.name ?? '').trim();
  const brewery = (row.brewery ?? '').trim();
  if (!name || !brewery) return null;
  const payload: AdhocBeerPayload = { name, brewery };
  const abv = parseNumber(row.abv);
  if (abv !== undefined) payload.abv = abv;
  const style = (row.style ?? '').trim();
  if (style) payload.style = style;
  const location = (row.location ?? '').trim();
  if (location) payload.location = location;
  const description = (row.description ?? '').trim();
  if (description) payload.description = description;
  return payload;
}

// --- Lenient field parsers ---------------------------------------------------

const TRUTHY = new Set(['true', 't', 'yes', 'y', '1', 'x', '✓']);

export function parseBool(raw: string | undefined): boolean {
  if (raw === undefined) return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

const LIKED_ALIASES = new Set(['liked', 'like', 'yes', '+', 'thumbs up']);
const DISLIKED_ALIASES = new Set(['disliked', 'dislike', 'no', '-', 'thumbs down']);

export function parseOpinion(raw: string | undefined): 'liked' | 'disliked' | null {
  if (raw === undefined) return null;
  const v = raw.trim().toLowerCase();
  if (LIKED_ALIASES.has(v)) return 'liked';
  if (DISLIKED_ALIASES.has(v)) return 'disliked';
  return null;
}

function parseNumber(raw: string | undefined): number | undefined {
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  // Tolerate a trailing % from copy-paste; the form does the same.
  const cleaned = trimmed.replace(/%\s*$/, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
