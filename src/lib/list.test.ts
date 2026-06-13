/**
 * Tests for the list-view pipeline (search, sort, filter, snippet extraction).
 */

import { describe, expect, it } from 'vitest';
import type { Beer, BeerUserState, UserData } from './types';
import {
  buildRows,
  filterModeFacets,
  mergeBeers,
  styleCategoryFacets,
  type BuildRowsOptions,
} from './list';
import { emptyUserData } from './storage';

function beer(overrides: Partial<Beer> = {}): Beer {
  return {
    id: 'id',
    name: 'Name',
    brewery: 'Brewery',
    abv: 5.0,
    style: 'IPA',
    styleCategory: 'IPA',
    location: 'Booth 1',
    description: null,
    ...overrides,
  };
}

/**
 * Build a UserData blob from a sparse map of beerId -> partial state.
 * Tests use this to set up per-beer state without writing the full record.
 */
function userData(states: Record<string, Partial<BeerUserState>> = {}): UserData {
  const beers: Record<string, BeerUserState> = {};
  for (const [id, partial] of Object.entries(states)) {
    beers[id] = {
      status: null,
      opinion: null,
      notes: '',
      location: '',
      notPresent: false,
      ...partial,
    };
  }
  return { version: 1, beers };
}

/** Default options — only override what each test cares about. */
function opts(overrides: Partial<BuildRowsOptions> = {}): BuildRowsOptions {
  return {
    search: '',
    filter: 'all',
    sort: 'name',
    direction: 'asc',
    showNotPresent: false,
    ...overrides,
  };
}

describe('buildRows — search', () => {
  const beers = [
    beer({ id: 'a', name: 'Sunbreak Pils', brewery: 'Fremont', style: 'Pilsner' }),
    beer({ id: 'b', name: 'Hazy IPA', brewery: 'Cloudburst', style: 'Hazy IPA' }),
    beer({
      id: 'c',
      name: 'Foghorn Stout',
      brewery: "Reuben's",
      style: 'Stout',
      description: 'Notes of espresso and dark chocolate.',
    }),
  ];

  it('returns all beers when search is empty', () => {
    expect(buildRows(beers, emptyUserData(), opts())).toHaveLength(3);
  });

  it('matches case-insensitively in name', () => {
    const rows = buildRows(beers, emptyUserData(), opts({ search: 'pils' }));
    expect(rows.map((r) => r.beer.id)).toEqual(['a']);
  });

  it('matches in brewery', () => {
    const rows = buildRows(beers, emptyUserData(), opts({ search: 'cloudburst' }));
    expect(rows.map((r) => r.beer.id)).toEqual(['b']);
  });

  it('matches in style', () => {
    const rows = buildRows(beers, emptyUserData(), opts({ search: 'stout' }));
    expect(rows.map((r) => r.beer.id)).toEqual(['c']);
  });

  it('matches in description', () => {
    const rows = buildRows(beers, emptyUserData(), opts({ search: 'espresso' }));
    expect(rows.map((r) => r.beer.id)).toEqual(['c']);
  });

  it('ignores leading/trailing whitespace', () => {
    expect(buildRows(beers, emptyUserData(), opts({ search: '   pils   ' }))).toHaveLength(1);
  });
});

describe('buildRows — snippet extraction (description-only match)', () => {
  const b = beer({
    id: 'x',
    name: 'Plain Pale',
    brewery: 'Brew',
    style: 'Pale Ale',
    description:
      'A clean pale ale with notes of grapefruit, light pine resin, and a soft biscuit finish.',
  });

  it('produces a snippet when the match is only in the description', () => {
    const rows = buildRows([b], emptyUserData(), opts({ search: 'grapefruit' }));
    expect(rows[0].descriptionSnippet).not.toBeNull();
    expect(rows[0].descriptionSnippet).toContain('grapefruit');
    expect(rows[0].highlightRange).not.toBeNull();
  });

  it('does not produce a snippet when name also matches', () => {
    const rows = buildRows([b], emptyUserData(), opts({ search: 'pale' }));
    expect(rows[0].descriptionSnippet).toBeNull();
  });

  it('does not produce a snippet when style also matches', () => {
    const rows = buildRows([b], emptyUserData(), opts({ search: 'ale' }));
    expect(rows[0].descriptionSnippet).toBeNull();
  });

  it('highlight range covers the matched substring in the snippet', () => {
    const rows = buildRows([b], emptyUserData(), opts({ search: 'biscuit' }));
    const { descriptionSnippet, highlightRange } = rows[0];
    expect(descriptionSnippet).not.toBeNull();
    expect(highlightRange).not.toBeNull();
    const sub = descriptionSnippet!.slice(highlightRange!.start, highlightRange!.end);
    expect(sub.toLowerCase()).toBe('biscuit');
  });
});

describe('buildRows — sort', () => {
  const beers = [
    beer({ id: 'a', name: 'Zebra', brewery: 'Charlie', abv: 4.0 }),
    beer({ id: 'b', name: 'Apple', brewery: 'Alpha', abv: 9.5 }),
    beer({ id: 'c', name: 'Mango', brewery: 'Bravo', abv: 6.0 }),
    beer({ id: 'd', name: 'Pear', brewery: 'Alpha', abv: 3.5 }),
  ];

  describe('ascending (default)', () => {
    it('sorts by name A-Z', () => {
      const ids = buildRows(beers, emptyUserData(), opts({ sort: 'name' })).map((r) => r.beer.id);
      expect(ids).toEqual(['b', 'c', 'd', 'a']);
    });

    it('sorts by brewery, then by beer name within brewery', () => {
      const ids = buildRows(beers, emptyUserData(), opts({ sort: 'brewery' })).map(
        (r) => r.beer.id,
      );
      expect(ids).toEqual(['b', 'd', 'c', 'a']);
    });

    it('sorts by ABV low to high', () => {
      const ids = buildRows(beers, emptyUserData(), opts({ sort: 'abv' })).map((r) => r.beer.id);
      expect(ids).toEqual(['d', 'a', 'c', 'b']);
    });

    it('treats omitted direction as ascending', () => {
      const explicitAsc = buildRows(
        beers,
        emptyUserData(),
        opts({ sort: 'name', direction: 'asc' }),
      ).map((r) => r.beer.id);
      const omitted = buildRows(beers, emptyUserData(), {
        search: '',
        filter: 'all',
        sort: 'name',
      }).map((r) => r.beer.id);
      expect(explicitAsc).toEqual(omitted);
    });
  });

  describe('descending', () => {
    it('sorts by name Z-A', () => {
      const ids = buildRows(beers, emptyUserData(), opts({ sort: 'name', direction: 'desc' })).map(
        (r) => r.beer.id,
      );
      expect(ids).toEqual(['a', 'd', 'c', 'b']);
    });

    it('reverses both brewery and within-brewery beer name', () => {
      const ids = buildRows(
        beers,
        emptyUserData(),
        opts({ sort: 'brewery', direction: 'desc' }),
      ).map((r) => r.beer.id);
      // Charlie (Zebra), Bravo (Mango), Alpha (Pear, Apple)
      expect(ids).toEqual(['a', 'c', 'd', 'b']);
    });

    it('sorts by ABV high to low', () => {
      const ids = buildRows(beers, emptyUserData(), opts({ sort: 'abv', direction: 'desc' })).map(
        (r) => r.beer.id,
      );
      expect(ids).toEqual(['b', 'c', 'a', 'd']);
    });
  });

  describe('missing-field invariant', () => {
    const beersWithNull = [
      beer({ id: 'x', abv: null }),
      beer({ id: 'y', abv: 5.0 }),
      beer({ id: 'z', abv: 8.0 }),
    ];

    it('sorts missing ABV to the end when ascending', () => {
      const ids = buildRows(
        beersWithNull,
        emptyUserData(),
        opts({ sort: 'abv', direction: 'asc' }),
      ).map((r) => r.beer.id);
      expect(ids).toEqual(['y', 'z', 'x']);
    });

    it('still sorts missing ABV to the end when descending', () => {
      const ids = buildRows(
        beersWithNull,
        emptyUserData(),
        opts({ sort: 'abv', direction: 'desc' }),
      ).map((r) => r.beer.id);
      // Populated rows descend (z=8, y=5), null still tail-anchored.
      expect(ids).toEqual(['z', 'y', 'x']);
    });
  });
});

describe('buildRows — filter (user-state aware)', () => {
  const beers = [beer({ id: 'unset' }), beer({ id: 'queued' }), beer({ id: 'sampled' })];
  const data = userData({
    queued: { status: 'toTry' },
    sampled: { status: 'tried' },
  });

  it("'all' shows every beer regardless of state", () => {
    const ids = buildRows(beers, data, opts({ filter: 'all' })).map((r) => r.beer.id);
    expect(ids.sort()).toEqual(['queued', 'sampled', 'unset']);
  });

  it("'toTry' shows only beers flagged to try", () => {
    const ids = buildRows(beers, data, opts({ filter: 'toTry' })).map((r) => r.beer.id);
    expect(ids).toEqual(['queued']);
  });

  it("'tried' shows only sampled beers", () => {
    const ids = buildRows(beers, data, opts({ filter: 'tried' })).map((r) => r.beer.id);
    expect(ids).toEqual(['sampled']);
  });

  it("'notTried' shows both unset and to-try (anything that's not Tried)", () => {
    const ids = buildRows(beers, data, opts({ filter: 'notTried' })).map((r) => r.beer.id);
    expect(ids.sort()).toEqual(['queued', 'unset']);
  });
});

describe('buildRows — not-present hiding', () => {
  const beers = [beer({ id: 'visible' }), beer({ id: 'hidden' })];
  const data = userData({ hidden: { notPresent: true } });

  it('hides not-present beers by default', () => {
    const ids = buildRows(beers, data, opts()).map((r) => r.beer.id);
    expect(ids).toEqual(['visible']);
  });

  it('reveals not-present beers when showNotPresent is true', () => {
    const ids = buildRows(beers, data, opts({ showNotPresent: true })).map((r) => r.beer.id);
    expect(ids.sort()).toEqual(['hidden', 'visible']);
  });

  it('hiding applies before filter (a not-present + to-try beer is still hidden by default)', () => {
    const data2 = userData({ hidden: { notPresent: true, status: 'toTry' } });
    const ids = buildRows(beers, data2, opts({ filter: 'toTry' })).map((r) => r.beer.id);
    expect(ids).toEqual([]);
  });
});

describe('buildRows — vm carries per-row state', () => {
  it('attaches the beer state to each row VM', () => {
    const beers = [beer({ id: 'b1' })];
    const data = userData({ b1: { status: 'toTry', opinion: 'liked', notes: 'nice' } });
    const [vm] = buildRows(beers, data, opts());
    expect(vm.state.status).toBe('toTry');
    expect(vm.state.opinion).toBe('liked');
    expect(vm.state.notes).toBe('nice');
  });

  it('uses the empty default for untouched beers', () => {
    const beers = [beer({ id: 'b1' })];
    const [vm] = buildRows(beers, emptyUserData(), opts());
    expect(vm.state.status).toBeNull();
    expect(vm.state.opinion).toBeNull();
    expect(vm.state.notes).toBe('');
    expect(vm.state.notPresent).toBe(false);
  });
});

describe('buildRows — custom location override', () => {
  it('uses the custom location in place of the dataset location when set', () => {
    const beers = [beer({ id: 'b1', location: 'Booth 1' })];
    const data = userData({ b1: { location: 'North Tent, Booth 42' } });
    const [vm] = buildRows(beers, data, opts());
    expect(vm.beer.location).toBe('North Tent, Booth 42');
  });

  it('falls back to the dataset location when no custom location is set', () => {
    const beers = [beer({ id: 'b1', location: 'Booth 1' })];
    const [vm] = buildRows(beers, emptyUserData(), opts());
    expect(vm.beer.location).toBe('Booth 1');
  });

  it('surfaces the custom location even when the dataset has none', () => {
    const beers = [beer({ id: 'b1', location: null })];
    const data = userData({ b1: { location: 'My spot' } });
    const [vm] = buildRows(beers, data, opts());
    expect(vm.beer.location).toBe('My spot');
  });

  it('treats a whitespace-only custom location as no override', () => {
    const beers = [beer({ id: 'b1', location: 'Booth 1' })];
    const data = userData({ b1: { location: '   ' } });
    const [vm] = buildRows(beers, data, opts());
    expect(vm.beer.location).toBe('Booth 1');
  });
});

describe('mergeBeers (dataset + ad-hoc)', () => {
  it('returns dataset beers unchanged when there are no ad-hoc entries', () => {
    const beers = [beer({ id: 'a' }), beer({ id: 'b' })];
    expect(mergeBeers(beers, emptyUserData())).toHaveLength(2);
  });

  it('appends ad-hoc beers materialized from userData', () => {
    const dataset = [beer({ id: 'real' })];
    const data = userData({
      'adhoc-1': {
        adhoc: { name: 'Mystery Sour', brewery: 'Backstage', abv: 4.5, style: 'Sour' },
      },
    });
    const merged = mergeBeers(dataset, data);
    expect(merged).toHaveLength(2);
    const adhoc = merged.find((b) => b.id === 'adhoc-1')!;
    expect(adhoc.name).toBe('Mystery Sour');
    expect(adhoc.brewery).toBe('Backstage');
    expect(adhoc.abv).toBe(4.5);
    expect(adhoc.style).toBe('Sour');
  });

  it('fills missing optional ad-hoc fields with null on the Beer projection', () => {
    const data = userData({
      'adhoc-1': { adhoc: { name: 'Bare Bones', brewery: 'Tiny Brew' } },
    });
    const merged = mergeBeers([], data);
    expect(merged[0]).toEqual({
      id: 'adhoc-1',
      name: 'Bare Bones',
      brewery: 'Tiny Brew',
      abv: null,
      style: null,
      styleCategory: null,
      location: null,
      description: null,
    });
  });

  it('skips userData entries that lack an adhoc payload (status-only beers)', () => {
    const data = userData({
      real: { status: 'toTry' },
      'adhoc-1': { adhoc: { name: 'A', brewery: 'B' } },
    });
    const merged = mergeBeers([], data);
    expect(merged.map((b) => b.id)).toEqual(['adhoc-1']);
  });
});

describe('buildRows — style-category filter', () => {
  const beers = [
    beer({ id: 'ipa', styleCategory: 'IPA' }),
    beer({ id: 'lager', styleCategory: 'Lager & Pilsner' }),
    beer({ id: 'sour', styleCategory: 'Sour & Gose' }),
    beer({ id: 'uncat', styleCategory: null }),
  ];

  it('shows every beer when no style is active (null)', () => {
    const ids = buildRows(beers, emptyUserData(), opts({ styleCategory: null })).map(
      (r) => r.beer.id,
    );
    expect(ids.sort()).toEqual(['ipa', 'lager', 'sour', 'uncat']);
  });

  it('keeps only beers in the active category', () => {
    const ids = buildRows(beers, emptyUserData(), opts({ styleCategory: 'IPA' })).map(
      (r) => r.beer.id,
    );
    expect(ids).toEqual(['ipa']);
  });

  it("treats a null styleCategory as 'Other'", () => {
    const ids = buildRows(beers, emptyUserData(), opts({ styleCategory: 'Other' })).map(
      (r) => r.beer.id,
    );
    expect(ids).toEqual(['uncat']);
  });

  it('composes with search', () => {
    const named = [
      beer({ id: 'a', name: 'Citrus IPA', styleCategory: 'IPA' }),
      beer({ id: 'b', name: 'Citrus Sour', styleCategory: 'Sour & Gose' }),
    ];
    const ids = buildRows(
      named,
      emptyUserData(),
      opts({ search: 'citrus', styleCategory: 'IPA' }),
    ).map((r) => r.beer.id);
    expect(ids).toEqual(['a']);
  });
});

describe('styleCategoryFacets', () => {
  const beers = [
    beer({ id: 'i1', styleCategory: 'IPA' }),
    beer({ id: 'i2', styleCategory: 'IPA' }),
    beer({ id: 'l1', styleCategory: 'Lager & Pilsner' }),
    beer({ id: 'u1', styleCategory: null }),
  ];

  function facetMap(facets: Array<{ category: string; count: number }>) {
    return Object.fromEntries(facets.map((f) => [f.category, f.count]));
  }

  it('counts each category and buckets null under Other', () => {
    const m = facetMap(styleCategoryFacets(beers, emptyUserData(), { search: '', filter: 'all' }));
    expect(m['IPA']).toBe(2);
    expect(m['Lager & Pilsner']).toBe(1);
    expect(m['Other']).toBe(1);
  });

  it('returns all categories in canonical order, including zero counts', () => {
    const cats = styleCategoryFacets(beers, emptyUserData(), { search: '', filter: 'all' }).map(
      (f) => f.category,
    );
    expect(cats[0]).toBe('IPA');
    expect(cats).toContain('Wheat'); // present even with zero matches
    expect(cats[cats.length - 1]).toBe('Other');
  });

  it('respects search but ignores the style filter (so counts stay stable)', () => {
    const named = [
      beer({ id: 'a', name: 'Hazy One', styleCategory: 'IPA' }),
      beer({ id: 'b', name: 'Crisp One', styleCategory: 'Lager & Pilsner' }),
    ];
    const m = facetMap(
      styleCategoryFacets(named, emptyUserData(), { search: 'hazy', filter: 'all' }),
    );
    expect(m['IPA']).toBe(1);
    expect(m['Lager & Pilsner']).toBe(0);
  });

  it('respects the status filter', () => {
    const data = userData({ i1: { status: 'tried' } });
    const m = facetMap(styleCategoryFacets(beers, data, { search: '', filter: 'tried' }));
    expect(m['IPA']).toBe(1);
    expect(m['Lager & Pilsner']).toBe(0);
  });

  it('respects not-present hiding', () => {
    const data = userData({ i2: { notPresent: true } });
    const hidden = facetMap(
      styleCategoryFacets(beers, data, { search: '', filter: 'all', showNotPresent: false }),
    );
    expect(hidden['IPA']).toBe(1);
    const shown = facetMap(
      styleCategoryFacets(beers, data, { search: '', filter: 'all', showNotPresent: true }),
    );
    expect(shown['IPA']).toBe(2);
  });
});

describe('filterModeFacets', () => {
  const beers = [
    beer({ id: 'a', name: 'Hazy One', styleCategory: 'IPA' }),
    beer({ id: 'b', name: 'Crisp One', styleCategory: 'Lager & Pilsner' }),
    beer({ id: 'c', name: 'Dark One', styleCategory: 'IPA' }),
  ];

  it('partitions statuses, with all as the total and notTried covering untracked + toTry', () => {
    const data = userData({ a: { status: 'tried' }, b: { status: 'toTry' } });
    const counts = filterModeFacets(beers, data, { search: '' });
    expect(counts.all).toBe(3);
    expect(counts.tried).toBe(1);
    expect(counts.toTry).toBe(1);
    expect(counts.notTried).toBe(2); // untracked 'c' + toTry 'b'
  });

  it('respects search', () => {
    const counts = filterModeFacets(beers, emptyUserData(), { search: 'hazy' });
    expect(counts.all).toBe(1);
    expect(counts.notTried).toBe(1);
  });

  it('respects the style filter', () => {
    const counts = filterModeFacets(beers, emptyUserData(), {
      search: '',
      styleCategory: 'IPA',
    });
    expect(counts.all).toBe(2);
  });

  it('respects not-present hiding', () => {
    const data = userData({ c: { notPresent: true } });
    expect(filterModeFacets(beers, data, { search: '', showNotPresent: false }).all).toBe(2);
    expect(filterModeFacets(beers, data, { search: '', showNotPresent: true }).all).toBe(3);
  });
});
