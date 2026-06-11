/**
 * Catalog/dataset fetch and validation.
 *
 * Behavior reference: docs/data-model.md sections 1 (Catalog) and 2 (Dataset).
 * Validation is intentionally lenient on optional/missing fields and strict
 * only where the spec demands it (required identity fields).
 */

import { isStyleCategory } from './types';
import type { Beer, Catalog, CatalogEntry, Dataset } from './types';

const CATALOG_URL = '/data/catalog.json';

/**
 * Base URL the catalog and relative dataset URLs are fetched from.
 *
 * Defaults to the app's own origin (`BASE_URL`), which is what local dev and the
 * bundled `public/data/` dev fixture rely on. In production, `VITE_DATA_BASE_URL`
 * points this at the standalone data site (GitHub Pages) so festival data can be
 * published without redeploying the app.
 */
const DATA_BASE_URL = import.meta.env.VITE_DATA_BASE_URL || import.meta.env.BASE_URL;

// --- Catalog -----------------------------------------------------------------

/**
 * Validates the catalog shape. Drops malformed entries with a warning.
 * Returns null if the catalog itself is unusable (no version/datasets, or
 * zero valid entries remaining).
 */
export function parseCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('Catalog: root is not an object');
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.version !== 'number') {
    console.warn('Catalog: missing or non-numeric `version`');
    return null;
  }
  if (!Array.isArray(obj.datasets)) {
    console.warn('Catalog: missing or non-array `datasets`');
    return null;
  }

  const datasets: CatalogEntry[] = [];
  for (const [i, entry] of obj.datasets.entries()) {
    const parsed = parseCatalogEntry(entry, i);
    if (parsed) datasets.push(parsed);
  }
  if (datasets.length === 0) {
    console.warn('Catalog: zero valid entries after validation');
    return null;
  }
  return { version: obj.version, datasets };
}

function parseCatalogEntry(raw: unknown, index: number): CatalogEntry | null {
  if (!raw || typeof raw !== 'object') {
    console.warn(`Catalog entry ${index}: not an object`);
    return null;
  }
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || e.id.length === 0) {
    console.warn(`Catalog entry ${index}: missing/invalid \`id\``);
    return null;
  }
  if (typeof e.name !== 'string' || e.name.length === 0) {
    console.warn(`Catalog entry ${index} (${e.id}): missing/invalid \`name\``);
    return null;
  }
  if (typeof e.url !== 'string' || e.url.length === 0) {
    console.warn(`Catalog entry ${index} (${e.id}): missing/invalid \`url\``);
    return null;
  }
  const entry: CatalogEntry = { id: e.id, name: e.name, url: e.url };
  if (
    e.dates &&
    typeof e.dates === 'object' &&
    typeof (e.dates as Record<string, unknown>).start === 'string' &&
    typeof (e.dates as Record<string, unknown>).end === 'string'
  ) {
    const d = e.dates as Record<string, string>;
    entry.dates = { start: d.start, end: d.end };
  }
  if (typeof e.location === 'string') entry.location = e.location;
  if (e.status === 'upcoming' || e.status === 'active' || e.status === 'archived') {
    entry.status = e.status;
  }
  if (e.default === true) entry.default = true;
  return entry;
}

/**
 * Catalog selection algorithm, per spec:
 *   1. Entry whose id matches `selectedDatasetId` (not used in v1; reserved).
 *   2. Entry with `default: true`.
 *   3. First entry in datasets.
 */
export function selectDataset(catalog: Catalog, selectedDatasetId: string | null): CatalogEntry {
  if (selectedDatasetId) {
    const match = catalog.datasets.find((d) => d.id === selectedDatasetId);
    if (match) return match;
  }
  const defaulted = catalog.datasets.find((d) => d.default === true);
  if (defaulted) return defaulted;
  // Spec guarantees at least one entry — parseCatalog returns null otherwise.
  return catalog.datasets[0];
}

// --- Dataset -----------------------------------------------------------------

/**
 * Validates a dataset JSON document.
 *
 * Returns null on fatal load errors (missing/malformed id, not an object, no
 * beers array). Per-beer validation is lenient: rows missing required fields
 * (id, name, brewery) are dropped with a console warning; everything else is
 * coerced or set to null.
 */
export function parseDataset(raw: unknown): Dataset | null {
  if (!raw || typeof raw !== 'object') {
    console.warn('Dataset: root is not an object');
    return null;
  }
  const obj = raw as Record<string, unknown>;
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    console.warn('Dataset: missing/invalid top-level `id` — fatal');
    return null;
  }
  if (!Array.isArray(obj.beers)) {
    console.warn('Dataset: missing or non-array `beers`');
    return null;
  }

  const beers: Beer[] = [];
  for (const [i, raw] of obj.beers.entries()) {
    const parsed = parseBeer(raw, i);
    if (parsed) beers.push(parsed);
  }

  return {
    id: obj.id,
    festival: typeof obj.festival === 'string' ? obj.festival : null,
    updatedAt: typeof obj.updatedAt === 'string' ? obj.updatedAt : null,
    beers,
  };
}

function parseBeer(raw: unknown, index: number): Beer | null {
  if (!raw || typeof raw !== 'object') {
    console.warn(`Beer ${index}: not an object`);
    return null;
  }
  const b = raw as Record<string, unknown>;
  if (typeof b.id !== 'string' || b.id.length === 0) {
    console.warn(`Beer ${index}: missing/invalid \`id\``);
    return null;
  }
  if (typeof b.name !== 'string' || b.name.length === 0) {
    console.warn(`Beer ${b.id}: missing/invalid \`name\``);
    return null;
  }
  if (typeof b.brewery !== 'string' || b.brewery.length === 0) {
    console.warn(`Beer ${b.id}: missing/invalid \`brewery\``);
    return null;
  }
  // ABV: per spec, non-numeric values (including missing, null, strings like
  // "5.2%", "TBD", "5-7") collapse to null. The row is NOT dropped.
  const abv = typeof b.abv === 'number' && Number.isFinite(b.abv) ? b.abv : null;
  return {
    id: b.id,
    name: b.name,
    brewery: b.brewery,
    abv,
    style: typeof b.style === 'string' && b.style.length > 0 ? b.style : null,
    // styleCategory: accept only a known category; anything else (missing,
    // unknown string) collapses to null and is treated as "Other" downstream.
    styleCategory: isStyleCategory(b.styleCategory) ? b.styleCategory : null,
    location: typeof b.location === 'string' && b.location.length > 0 ? b.location : null,
    description:
      typeof b.description === 'string' && b.description.length > 0 ? b.description : null,
  };
}

// --- Fetch orchestration ------------------------------------------------------

export interface LoadResult {
  catalog: Catalog;
  entry: CatalogEntry;
  dataset: Dataset;
  /** True when the dataset's own id didn't match the catalog entry's id. */
  idMismatch: boolean;
}

/**
 * Loads the catalog and the selected dataset.
 *
 * v1: connectivity is required on first load. We don't yet maintain a cache —
 * that lands with the PWA slice. Throws on fatal fetch/parse errors.
 */
export async function loadActiveDataset(
  fetchImpl: typeof fetch = fetch,
  selectedDatasetId: string | null = null,
  baseUrl: string = DATA_BASE_URL,
): Promise<LoadResult> {
  const catalog = await fetchAndParseCatalog(fetchImpl, baseUrl);
  const entry = selectDataset(catalog, selectedDatasetId);
  const dataset = await fetchAndParseDataset(fetchImpl, entry, baseUrl);
  const idMismatch = dataset.id !== entry.id;
  if (idMismatch) {
    console.warn(
      `Dataset id mismatch: catalog says \`${entry.id}\`, dataset says \`${dataset.id}\`. ` +
        `Using dataset id for user-data namespacing.`,
    );
  }
  return { catalog, entry, dataset, idMismatch };
}

async function fetchAndParseCatalog(fetchImpl: typeof fetch, baseUrl: string): Promise<Catalog> {
  const url = joinUrl(baseUrl, CATALOG_URL);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Catalog fetch failed: ${res.status} ${res.statusText}`);
  const json: unknown = await res.json();
  const catalog = parseCatalog(json);
  if (!catalog) throw new Error('Catalog parse failed (see console warnings)');
  return catalog;
}

async function fetchAndParseDataset(
  fetchImpl: typeof fetch,
  entry: CatalogEntry,
  baseUrl: string,
): Promise<Dataset> {
  const url = resolveDatasetUrl(entry.url, baseUrl);
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Dataset fetch failed: ${res.status} ${res.statusText}`);
  const json: unknown = await res.json();
  const dataset = parseDataset(json);
  if (!dataset) throw new Error('Dataset parse failed (see console warnings)');
  return dataset;
}

/**
 * Catalog entries may use absolute URLs (https://…) or root-relative URLs
 * (/data/foo.json). Root-relative paths must be re-anchored at the deployed
 * base path so the same catalog ships unchanged across hosting environments
 * (e.g. "/" on the custom domain vs. "/TapList/" on a project-path fallback).
 */
function resolveDatasetUrl(entryUrl: string, baseUrl: string): string {
  if (/^https?:\/\//i.test(entryUrl)) return entryUrl;
  return joinUrl(baseUrl, entryUrl);
}

function joinUrl(base: string, path: string): string {
  const b = base.endsWith('/') ? base.slice(0, -1) : base;
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}
