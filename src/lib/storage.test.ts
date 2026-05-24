/**
 * Tests for the localStorage user-data layer.
 *
 * Uses a hand-rolled in-memory Storage mock so the suite doesn't depend on
 * jsdom or a real DOM environment.
 */

import { describe, expect, it } from 'vitest';
import {
  beerState,
  emptyUserData,
  isBeerTouched,
  loadUserData,
  parseUserData,
  saveUserData,
  storageKeyFor,
  type StorageLike,
} from './storage';
import { EMPTY_BEER_USER_STATE } from './types';

function makeStorage(initial: Record<string, string> = {}): StorageLike {
  const store = new Map(Object.entries(initial));
  return {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  };
}

describe('storageKeyFor', () => {
  it('namespaces by dataset id', () => {
    expect(storageKeyFor('wbf-2026')).toBe('taplist:userdata:wbf-2026');
    expect(storageKeyFor('other')).toBe('taplist:userdata:other');
  });
});

describe('loadUserData', () => {
  it('returns empty data when key is absent', () => {
    const data = loadUserData('wbf-2026', makeStorage());
    expect(data).toEqual(emptyUserData());
  });

  it('returns empty data when JSON is malformed', () => {
    const storage = makeStorage({
      [storageKeyFor('wbf-2026')]: '{not valid json',
    });
    expect(loadUserData('wbf-2026', storage)).toEqual(emptyUserData());
  });

  it('round-trips through save + load', () => {
    const storage = makeStorage();
    const initial = {
      version: 1 as const,
      beers: {
        'wbf26-0001': {
          status: 'toTry' as const,
          opinion: null,
          notes: 'looks good',
          notPresent: false,
        },
        'wbf26-0002': {
          status: 'tried' as const,
          opinion: 'liked' as const,
          notes: '',
          notPresent: false,
        },
      },
    };
    saveUserData('wbf-2026', initial, storage);
    const loaded = loadUserData('wbf-2026', storage);
    expect(loaded).toEqual(initial);
  });

  it('keeps each dataset namespace separate', () => {
    const storage = makeStorage();
    saveUserData(
      'wbf-2026',
      {
        version: 1,
        beers: { x: { status: 'toTry', opinion: null, notes: '', notPresent: false } },
      },
      storage,
    );
    saveUserData(
      'other-fest',
      {
        version: 1,
        beers: { y: { status: 'tried', opinion: null, notes: '', notPresent: false } },
      },
      storage,
    );
    expect(Object.keys(loadUserData('wbf-2026', storage).beers)).toEqual(['x']);
    expect(Object.keys(loadUserData('other-fest', storage).beers)).toEqual(['y']);
  });
});

describe('parseUserData', () => {
  it('returns empty on non-objects', () => {
    expect(parseUserData(null)).toEqual(emptyUserData());
    expect(parseUserData('nope')).toEqual(emptyUserData());
    expect(parseUserData(42)).toEqual(emptyUserData());
  });

  it('returns empty on missing/wrong version', () => {
    expect(parseUserData({ beers: {} })).toEqual(emptyUserData());
    expect(parseUserData({ version: 2, beers: {} })).toEqual(emptyUserData());
    expect(parseUserData({ version: '1', beers: {} })).toEqual(emptyUserData());
  });

  it('coerces invalid status/opinion values to null', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        a: { status: 'maybe', opinion: 'eh', notes: 'x', notPresent: false },
      },
    });
    expect(parsed.beers.a).toEqual({
      status: null,
      opinion: null,
      notes: 'x',
      notPresent: false,
    });
  });

  it('drops beer entries that have no actual user state', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        empty: { status: null, opinion: null, notes: '', notPresent: false },
        real: { status: 'toTry', opinion: null, notes: '', notPresent: false },
      },
    });
    expect(Object.keys(parsed.beers)).toEqual(['real']);
  });

  it('truncates over-long notes on read (defensive against hand-edits)', () => {
    const tooLong = 'a'.repeat(500);
    const parsed = parseUserData({
      version: 1,
      beers: { a: { status: null, opinion: null, notes: tooLong, notPresent: false } },
    });
    expect(parsed.beers.a.notes.length).toBe(280);
  });

  it('enforces the not-present invariant on read (clears status/opinion/notes)', () => {
    // Hand-edited or legacy storage might have notPresent=true alongside
    // active state; the parser strips that to match the runtime invariant.
    const parsed = parseUserData({
      version: 1,
      beers: {
        a: { status: 'tried', opinion: 'liked', notes: 'tasty', notPresent: true },
      },
    });
    expect(parsed.beers.a).toEqual({
      status: null,
      opinion: null,
      notes: '',
      notPresent: true,
    });
  });

  it('preserves ad-hoc beer payloads when valid', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        'adhoc-1': {
          status: 'tried',
          opinion: 'liked',
          notes: '',
          notPresent: false,
          adhoc: {
            name: 'Mystery Sour',
            brewery: 'Backstage Brewing',
            abv: 4.5,
            style: 'Sour',
            location: 'Booth 47',
          },
        },
      },
    });
    expect(parsed.beers['adhoc-1'].adhoc).toEqual({
      name: 'Mystery Sour',
      brewery: 'Backstage Brewing',
      abv: 4.5,
      style: 'Sour',
      location: 'Booth 47',
    });
  });

  it('drops invalid ad-hoc payloads (missing name) but keeps user state', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        'adhoc-1': {
          status: 'tried',
          opinion: null,
          notes: '',
          notPresent: false,
          adhoc: { brewery: 'no name here' },
        },
      },
    });
    expect(parsed.beers['adhoc-1'].adhoc).toBeUndefined();
    expect(parsed.beers['adhoc-1'].status).toBe('tried');
  });

  it('drops invalid ad-hoc payloads (missing brewery) but keeps user state', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        'adhoc-1': {
          status: 'tried',
          opinion: null,
          notes: '',
          notPresent: false,
          adhoc: { name: 'Just a name, no brewery' },
        },
      },
    });
    expect(parsed.beers['adhoc-1'].adhoc).toBeUndefined();
    expect(parsed.beers['adhoc-1'].status).toBe('tried');
  });

  it('preserves null ABV on ad-hoc beers (intentional unknown)', () => {
    const parsed = parseUserData({
      version: 1,
      beers: {
        'adhoc-1': {
          status: null,
          opinion: null,
          notes: 'note',
          notPresent: false,
          adhoc: { name: 'Mystery', brewery: 'Some Brew', abv: null },
        },
      },
    });
    expect(parsed.beers['adhoc-1'].adhoc).toEqual({
      name: 'Mystery',
      brewery: 'Some Brew',
      abv: null,
    });
  });
});

describe('beerState', () => {
  it('returns the stored state when present', () => {
    const data = {
      version: 1 as const,
      beers: {
        a: { status: 'tried' as const, opinion: null, notes: '', notPresent: false },
      },
    };
    expect(beerState(data, 'a').status).toBe('tried');
  });

  it('returns the empty default for untouched beers', () => {
    expect(beerState(emptyUserData(), 'unknown')).toBe(EMPTY_BEER_USER_STATE);
  });
});

describe('isBeerTouched', () => {
  it('returns true if any user-state field is set', () => {
    expect(isBeerTouched({ ...EMPTY_BEER_USER_STATE, status: 'toTry' })).toBe(true);
    expect(isBeerTouched({ ...EMPTY_BEER_USER_STATE, opinion: 'liked' })).toBe(true);
    expect(isBeerTouched({ ...EMPTY_BEER_USER_STATE, notes: 'hi' })).toBe(true);
    expect(isBeerTouched({ ...EMPTY_BEER_USER_STATE, notPresent: true })).toBe(true);
    expect(
      isBeerTouched({
        ...EMPTY_BEER_USER_STATE,
        adhoc: { name: 'Mystery', brewery: 'Backstage' },
      }),
    ).toBe(true);
  });

  it('returns false for the empty state', () => {
    expect(isBeerTouched(EMPTY_BEER_USER_STATE)).toBe(false);
  });
});
