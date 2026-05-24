/**
 * Tests for the list-view pipeline (search, sort, filter, snippet extraction).
 */

import { describe, expect, it } from 'vitest';
import type { Beer, BeerUserState, UserData } from './types';
import { buildRows, type BuildRowsOptions } from './list';
import { emptyUserData } from './storage';

function beer(overrides: Partial<Beer> = {}): Beer {
  return {
    id: 'id',
    name: 'Name',
    brewery: 'Brewery',
    abv: 5.0,
    style: 'IPA',
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
