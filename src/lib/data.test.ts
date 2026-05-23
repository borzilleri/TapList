/**
 * Unit tests for catalog/dataset validation and selection.
 *
 * Most behavior is asserted via the pure functions (parseCatalog, parseBeer,
 * selectDataset). The fetch orchestration is covered with a stub fetch so we
 * can exercise the catalog -> dataset round trip without a real network.
 */

import { describe, expect, it, vi } from 'vitest';
import { loadActiveDataset, parseCatalog, parseDataset, selectDataset } from './data';
import type { Catalog } from './types';

// --- Catalog -----------------------------------------------------------------

describe('parseCatalog', () => {
  it('parses a well-formed catalog', () => {
    const result = parseCatalog({
      version: 1,
      datasets: [{ id: 'a', name: 'A', url: '/a.json', default: true }],
    });
    expect(result).not.toBeNull();
    expect(result!.datasets).toHaveLength(1);
    expect(result!.datasets[0]).toMatchObject({ id: 'a', default: true });
  });

  it('returns null for non-object input', () => {
    expect(parseCatalog(null)).toBeNull();
    expect(parseCatalog('nope')).toBeNull();
    expect(parseCatalog(42)).toBeNull();
  });

  it('returns null when version is missing or non-numeric', () => {
    expect(parseCatalog({ datasets: [] })).toBeNull();
    expect(parseCatalog({ version: '1', datasets: [] })).toBeNull();
  });

  it('returns null when datasets is missing or not an array', () => {
    expect(parseCatalog({ version: 1 })).toBeNull();
    expect(parseCatalog({ version: 1, datasets: 'oops' })).toBeNull();
  });

  it('drops invalid entries but keeps valid ones', () => {
    const result = parseCatalog({
      version: 1,
      datasets: [
        { id: 'good', name: 'Good', url: '/g.json' },
        { id: '', name: 'Empty id', url: '/x.json' },
        { name: 'No id', url: '/y.json' },
        { id: 'no-url', name: 'No URL' },
      ],
    });
    expect(result!.datasets).toHaveLength(1);
    expect(result!.datasets[0].id).toBe('good');
  });

  it('returns null when all entries are invalid', () => {
    const result = parseCatalog({
      version: 1,
      datasets: [{ id: '', name: '', url: '' }],
    });
    expect(result).toBeNull();
  });

  it('preserves optional fields when valid', () => {
    const result = parseCatalog({
      version: 1,
      datasets: [
        {
          id: 'wbf-2026',
          name: 'WBF',
          url: '/wbf.json',
          dates: { start: '2026-06-12', end: '2026-06-14' },
          location: 'Marymoor',
          status: 'upcoming',
          default: true,
        },
      ],
    });
    const e = result!.datasets[0];
    expect(e.dates).toEqual({ start: '2026-06-12', end: '2026-06-14' });
    expect(e.location).toBe('Marymoor');
    expect(e.status).toBe('upcoming');
    expect(e.default).toBe(true);
  });

  it('ignores unknown status values', () => {
    const result = parseCatalog({
      version: 1,
      datasets: [{ id: 'a', name: 'A', url: '/a.json', status: 'cancelled' }],
    });
    expect(result!.datasets[0].status).toBeUndefined();
  });
});

// --- Selection algorithm -----------------------------------------------------

describe('selectDataset', () => {
  const cat: Catalog = {
    version: 1,
    datasets: [
      { id: 'first', name: 'First', url: '/first.json' },
      { id: 'middle', name: 'Middle', url: '/middle.json', default: true },
      { id: 'last', name: 'Last', url: '/last.json' },
    ],
  };

  it('prefers the explicitly-selected dataset id', () => {
    expect(selectDataset(cat, 'last').id).toBe('last');
  });

  it('falls back to default:true when no selection or selection misses', () => {
    expect(selectDataset(cat, null).id).toBe('middle');
    expect(selectDataset(cat, 'nonexistent').id).toBe('middle');
  });

  it('falls back to first entry when there is no default', () => {
    const noDefault: Catalog = {
      version: 1,
      datasets: [
        { id: 'a', name: 'A', url: '/a.json' },
        { id: 'b', name: 'B', url: '/b.json' },
      ],
    };
    expect(selectDataset(noDefault, null).id).toBe('a');
  });
});

// --- Dataset -----------------------------------------------------------------

describe('parseDataset', () => {
  it('parses a well-formed dataset', () => {
    const result = parseDataset({
      id: 'test',
      festival: 'Test Fest',
      updatedAt: '2026-01-01T00:00:00Z',
      beers: [{ id: 'b1', name: 'Beer One', brewery: 'Brew Co', abv: 5.5 }],
    });
    expect(result).not.toBeNull();
    expect(result!.id).toBe('test');
    expect(result!.festival).toBe('Test Fest');
    expect(result!.beers).toHaveLength(1);
    expect(result!.beers[0].abv).toBe(5.5);
  });

  it('returns null when the dataset id is missing (fatal)', () => {
    expect(parseDataset({ beers: [] })).toBeNull();
    expect(parseDataset({ id: '', beers: [] })).toBeNull();
  });

  it('returns null when beers is not an array', () => {
    expect(parseDataset({ id: 'x', beers: 'oops' })).toBeNull();
  });

  it('treats festival and updatedAt as optional', () => {
    const result = parseDataset({ id: 'x', beers: [] });
    expect(result!.festival).toBeNull();
    expect(result!.updatedAt).toBeNull();
  });

  it('drops beers missing required fields', () => {
    const result = parseDataset({
      id: 'x',
      beers: [
        { id: 'ok', name: 'OK', brewery: 'Brew' },
        { name: 'No id', brewery: 'Brew' },
        { id: 'no-name', brewery: 'Brew' },
        { id: 'no-brew', name: 'No brewery' },
      ],
    });
    expect(result!.beers.map((b) => b.id)).toEqual(['ok']);
  });

  describe('ABV coercion (spec: non-numeric -> null, row preserved)', () => {
    const cases: Array<[string, unknown, number | null]> = [
      ['number 5.2', 5.2, 5.2],
      ['integer 0 (NA beer)', 0, 0],
      ['missing field', undefined, null],
      ['explicit null', null, null],
      ['string "5.2%"', '5.2%', null],
      ['string range "5-7"', '5-7', null],
      ['string "TBD"', 'TBD', null],
      ['string "~5.2"', '~5.2', null],
      ['string "5.2" (numeric-looking)', '5.2', null],
      ['NaN', Number.NaN, null],
      ['Infinity', Number.POSITIVE_INFINITY, null],
    ];
    for (const [label, input, expected] of cases) {
      it(label, () => {
        const beer = { id: 'x', name: 'X', brewery: 'Y' } as Record<string, unknown>;
        if (input !== undefined) beer.abv = input;
        const result = parseDataset({ id: 'd', beers: [beer] });
        expect(result!.beers[0].abv).toBe(expected);
      });
    }
  });

  it('treats empty-string style/location/description as missing', () => {
    const result = parseDataset({
      id: 'x',
      beers: [{ id: 'a', name: 'A', brewery: 'B', style: '', location: '', description: '' }],
    });
    const beer = result!.beers[0];
    expect(beer.style).toBeNull();
    expect(beer.location).toBeNull();
    expect(beer.description).toBeNull();
  });
});

// --- Fetch orchestration -----------------------------------------------------

describe('loadActiveDataset', () => {
  function makeFetch(routes: Record<string, unknown>): typeof fetch {
    return vi.fn(async (url: string | URL | Request) => {
      const u = url.toString();
      if (u in routes) {
        return new Response(JSON.stringify(routes[u]), { status: 200 });
      }
      return new Response('not found', { status: 404 });
    }) as unknown as typeof fetch;
  }

  it('fetches catalog, selects default, fetches dataset', async () => {
    const fetchImpl = makeFetch({
      '/data/catalog.json': {
        version: 1,
        datasets: [{ id: 'wbf-2026', name: 'WBF', url: '/data/wbf-2026.json', default: true }],
      },
      '/data/wbf-2026.json': {
        id: 'wbf-2026',
        beers: [{ id: 'b1', name: 'Beer', brewery: 'Brew' }],
      },
    });
    const result = await loadActiveDataset(fetchImpl, null, '/');
    expect(result.entry.id).toBe('wbf-2026');
    expect(result.dataset.id).toBe('wbf-2026');
    expect(result.dataset.beers).toHaveLength(1);
    expect(result.idMismatch).toBe(false);
  });

  it('flags id mismatch but still returns the dataset', async () => {
    const fetchImpl = makeFetch({
      '/data/catalog.json': {
        version: 1,
        datasets: [{ id: 'expected', name: 'X', url: '/data/x.json', default: true }],
      },
      '/data/x.json': { id: 'actual', beers: [] },
    });
    const result = await loadActiveDataset(fetchImpl, null, '/');
    expect(result.idMismatch).toBe(true);
    expect(result.dataset.id).toBe('actual');
  });

  it('throws when the catalog fetch is non-200', async () => {
    const fetchImpl = makeFetch({});
    await expect(loadActiveDataset(fetchImpl, null, '/')).rejects.toThrow(/Catalog fetch failed/);
  });

  it('resolves catalog-relative URLs against the base path', async () => {
    const fetchImpl = makeFetch({
      '/TapList/data/catalog.json': {
        version: 1,
        datasets: [{ id: 'a', name: 'A', url: '/data/a.json', default: true }],
      },
      '/TapList/data/a.json': { id: 'a', beers: [] },
    });
    const result = await loadActiveDataset(fetchImpl, null, '/TapList/');
    expect(result.dataset.id).toBe('a');
  });

  it('passes absolute URLs through unchanged', async () => {
    const fetchImpl = makeFetch({
      '/data/catalog.json': {
        version: 1,
        datasets: [
          {
            id: 'remote',
            name: 'Remote',
            url: 'https://example.com/data.json',
            default: true,
          },
        ],
      },
      'https://example.com/data.json': { id: 'remote', beers: [] },
    });
    const result = await loadActiveDataset(fetchImpl, null, '/');
    expect(result.dataset.id).toBe('remote');
  });
});
