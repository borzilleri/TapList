/**
 * Tests for the list-view pipeline (search, sort, filter, snippet extraction).
 */

import { describe, expect, it } from 'vitest';
import type { Beer } from './types';
import { buildRows } from './list';

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
    expect(buildRows(beers, '', 'all', 'name')).toHaveLength(3);
  });

  it('matches case-insensitively in name', () => {
    const rows = buildRows(beers, 'pils', 'all', 'name');
    expect(rows.map((r) => r.beer.id)).toEqual(['a']);
  });

  it('matches in brewery', () => {
    const rows = buildRows(beers, 'cloudburst', 'all', 'name');
    expect(rows.map((r) => r.beer.id)).toEqual(['b']);
  });

  it('matches in style', () => {
    const rows = buildRows(beers, 'stout', 'all', 'name');
    expect(rows.map((r) => r.beer.id)).toEqual(['c']);
  });

  it('matches in description', () => {
    const rows = buildRows(beers, 'espresso', 'all', 'name');
    expect(rows.map((r) => r.beer.id)).toEqual(['c']);
  });

  it('ignores leading/trailing whitespace', () => {
    expect(buildRows(beers, '   pils   ', 'all', 'name')).toHaveLength(1);
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
    const rows = buildRows([b], 'grapefruit', 'all', 'name');
    expect(rows[0].descriptionSnippet).not.toBeNull();
    expect(rows[0].descriptionSnippet).toContain('grapefruit');
    expect(rows[0].highlightRange).not.toBeNull();
  });

  it('does not produce a snippet when name also matches', () => {
    const rows = buildRows([b], 'pale', 'all', 'name');
    expect(rows[0].descriptionSnippet).toBeNull();
  });

  it('does not produce a snippet when style also matches', () => {
    const rows = buildRows([b], 'ale', 'all', 'name');
    expect(rows[0].descriptionSnippet).toBeNull();
  });

  it('highlight range covers the matched substring in the snippet', () => {
    const rows = buildRows([b], 'biscuit', 'all', 'name');
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
      const ids = buildRows(beers, '', 'all', 'name').map((r) => r.beer.id);
      expect(ids).toEqual(['b', 'c', 'd', 'a']);
    });

    it('sorts by brewery, then by beer name within brewery', () => {
      const ids = buildRows(beers, '', 'all', 'brewery').map((r) => r.beer.id);
      // Alpha (Apple, Pear), Bravo (Mango), Charlie (Zebra)
      expect(ids).toEqual(['b', 'd', 'c', 'a']);
    });

    it('sorts by ABV low to high', () => {
      const ids = buildRows(beers, '', 'all', 'abv').map((r) => r.beer.id);
      expect(ids).toEqual(['d', 'a', 'c', 'b']);
    });

    it('treats omitted direction as ascending', () => {
      const explicitAsc = buildRows(beers, '', 'all', 'name', 'asc').map((r) => r.beer.id);
      const omitted = buildRows(beers, '', 'all', 'name').map((r) => r.beer.id);
      expect(explicitAsc).toEqual(omitted);
    });
  });

  describe('descending', () => {
    it('sorts by name Z-A', () => {
      const ids = buildRows(beers, '', 'all', 'name', 'desc').map((r) => r.beer.id);
      expect(ids).toEqual(['a', 'd', 'c', 'b']);
    });

    it('reverses both brewery and within-brewery beer name', () => {
      const ids = buildRows(beers, '', 'all', 'brewery', 'desc').map((r) => r.beer.id);
      // Charlie (Zebra), Bravo (Mango), Alpha (Pear, Apple)
      expect(ids).toEqual(['a', 'c', 'd', 'b']);
    });

    it('sorts by ABV high to low', () => {
      const ids = buildRows(beers, '', 'all', 'abv', 'desc').map((r) => r.beer.id);
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
      const ids = buildRows(beersWithNull, '', 'all', 'abv', 'asc').map((r) => r.beer.id);
      expect(ids).toEqual(['y', 'z', 'x']);
    });

    it('still sorts missing ABV to the end when descending', () => {
      const ids = buildRows(beersWithNull, '', 'all', 'abv', 'desc').map((r) => r.beer.id);
      // Populated rows descend (z=8, y=5), null still tail-anchored.
      expect(ids).toEqual(['z', 'y', 'x']);
    });
  });
});

describe('buildRows — filter (slice 1 placeholder)', () => {
  const beers = [beer({ id: 'a' }), beer({ id: 'b' })];

  it("'all' shows everything", () => {
    expect(buildRows(beers, '', 'all', 'name')).toHaveLength(2);
  });

  it("'notTried' shows everything (no user state yet means nothing is tried)", () => {
    expect(buildRows(beers, '', 'notTried', 'name')).toHaveLength(2);
  });

  it("'toTry' shows nothing (no flags set yet)", () => {
    expect(buildRows(beers, '', 'toTry', 'name')).toHaveLength(0);
  });

  it("'tried' shows nothing (nothing tried yet)", () => {
    expect(buildRows(beers, '', 'tried', 'name')).toHaveLength(0);
  });
});
