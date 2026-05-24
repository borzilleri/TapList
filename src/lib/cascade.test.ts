/**
 * Tests for the pure cascade-rule functions.
 */

import { describe, expect, it } from 'vitest';
import {
  applyAdhocEdit,
  applyNotPresent,
  applyNotes,
  applyOpinion,
  applyStatus,
  startingAdhocState,
  startingState,
} from './cascade';

describe('applyStatus', () => {
  it('sets the status from null', () => {
    const result = applyStatus(startingState(), 'toTry');
    expect(result.status).toBe('toTry');
  });

  it('flips toTry -> tried (and vice versa) since they are mutually exclusive', () => {
    const a = applyStatus(startingState(), 'toTry');
    const b = applyStatus(a, 'tried');
    expect(b.status).toBe('tried');
    const c = applyStatus(b, 'toTry');
    expect(c.status).toBe('toTry');
  });

  it('clears status to null', () => {
    const a = applyStatus(startingState(), 'toTry');
    const b = applyStatus(a, null);
    expect(b.status).toBeNull();
  });

  it('does not modify opinion or notes', () => {
    const initial = { ...startingState(), opinion: 'liked' as const, notes: 'tasty' };
    const result = applyStatus(initial, 'tried');
    expect(result.opinion).toBe('liked');
    expect(result.notes).toBe('tasty');
  });

  it('is idempotent', () => {
    const a = applyStatus(startingState(), 'toTry');
    const b = applyStatus(a, 'toTry');
    expect(b).toBe(a);
  });

  describe('inverse cascade (status leaving "tried" clears opinion)', () => {
    it('clears opinion when status goes tried → null', () => {
      const withOpinion = {
        ...startingState(),
        status: 'tried' as const,
        opinion: 'liked' as const,
      };
      const result = applyStatus(withOpinion, null);
      expect(result.status).toBeNull();
      expect(result.opinion).toBeNull();
    });

    it('clears opinion when status goes tried → toTry', () => {
      const withOpinion = {
        ...startingState(),
        status: 'tried' as const,
        opinion: 'disliked' as const,
      };
      const result = applyStatus(withOpinion, 'toTry');
      expect(result.status).toBe('toTry');
      expect(result.opinion).toBeNull();
    });

    it('preserves opinion when staying at tried (no-op transition)', () => {
      const withOpinion = {
        ...startingState(),
        status: 'tried' as const,
        opinion: 'liked' as const,
      };
      const result = applyStatus(withOpinion, 'tried');
      expect(result.opinion).toBe('liked');
    });

    it('preserves opinion when status was never tried (e.g. toTry → null)', () => {
      // Opinion should not coexist with non-tried status in practice (the
      // applyOpinion cascade enforces that), but the storage parser could
      // theoretically produce one. The inverse cascade only triggers when
      // we're actually leaving 'tried'.
      const oddState = { ...startingState(), status: 'toTry' as const, opinion: 'liked' as const };
      const result = applyStatus(oddState, null);
      expect(result.opinion).toBe('liked');
    });

    it('does not touch notes or notPresent when clearing opinion', () => {
      const initial = {
        status: 'tried' as const,
        opinion: 'liked' as const,
        notes: 'tasty',
        notPresent: true,
      };
      const result = applyStatus(initial, null);
      expect(result.notes).toBe('tasty');
      expect(result.notPresent).toBe(true);
    });
  });
});

describe('applyOpinion', () => {
  it('sets the opinion', () => {
    const result = applyOpinion(startingState(), 'liked');
    expect(result.opinion).toBe('liked');
  });

  it('implicitly sets status=tried when opinion is set', () => {
    const result = applyOpinion(startingState(), 'liked');
    expect(result.status).toBe('tried');
  });

  it('overrides a prior toTry status when opinion is set', () => {
    const queued = applyStatus(startingState(), 'toTry');
    const result = applyOpinion(queued, 'disliked');
    expect(result.status).toBe('tried');
  });

  it('does NOT revert status when opinion is cleared', () => {
    const liked = applyOpinion(startingState(), 'liked');
    const cleared = applyOpinion(liked, null);
    expect(cleared.opinion).toBeNull();
    expect(cleared.status).toBe('tried');
  });

  it('is idempotent when nothing would change', () => {
    const liked = applyOpinion(startingState(), 'liked');
    const again = applyOpinion(liked, 'liked');
    expect(again).toBe(liked);
  });
});

describe('applyNotes', () => {
  it('updates notes', () => {
    const result = applyNotes(startingState(), 'piney');
    expect(result.notes).toBe('piney');
  });

  it('truncates over-long notes to 280 chars', () => {
    const result = applyNotes(startingState(), 'a'.repeat(500));
    expect(result.notes.length).toBe(280);
  });

  it('is idempotent', () => {
    const a = applyNotes(startingState(), 'same');
    const b = applyNotes(a, 'same');
    expect(b).toBe(a);
  });
});

describe('applyNotPresent', () => {
  it('toggles to true', () => {
    expect(applyNotPresent(startingState(), true).notPresent).toBe(true);
  });

  it('does not affect other fields', () => {
    const initial = { ...startingState(), status: 'tried' as const, opinion: 'liked' as const };
    const result = applyNotPresent(initial, true);
    expect(result.status).toBe('tried');
    expect(result.opinion).toBe('liked');
  });
});

describe('startingAdhocState', () => {
  it('produces a fresh user state with the ad-hoc payload populated', () => {
    const state = startingAdhocState({
      name: 'Mystery Sour',
      brewery: 'Backstage',
      abv: 4.5,
      style: 'Sour',
    });
    expect(state.status).toBeNull();
    expect(state.opinion).toBeNull();
    expect(state.notes).toBe('');
    expect(state.notPresent).toBe(false);
    expect(state.adhoc).toEqual({
      name: 'Mystery Sour',
      brewery: 'Backstage',
      abv: 4.5,
      style: 'Sour',
    });
  });

  it('trims whitespace on string fields', () => {
    const state = startingAdhocState({
      name: '  Mystery Sour  ',
      brewery: '  Backstage  ',
      style: ' Sour ',
      location: ' Booth 47 ',
      description: ' Funky, briny. ',
    });
    expect(state.adhoc).toEqual({
      name: 'Mystery Sour',
      brewery: 'Backstage',
      style: 'Sour',
      location: 'Booth 47',
      description: 'Funky, briny.',
    });
  });

  it('drops empty optional strings', () => {
    const state = startingAdhocState({
      name: 'Mystery',
      brewery: 'Backstage',
      style: '   ',
      location: '',
      description: '',
    });
    expect(state.adhoc).toEqual({ name: 'Mystery', brewery: 'Backstage' });
  });

  it('preserves explicit null ABV (intentional unknown)', () => {
    const state = startingAdhocState({ name: 'Mystery', brewery: 'Backstage', abv: null });
    expect(state.adhoc?.abv).toBeNull();
  });

  it('drops non-finite ABV (NaN/Infinity treated as unknown)', () => {
    const state = startingAdhocState({ name: 'Mystery', brewery: 'Backstage', abv: Number.NaN });
    expect(state.adhoc?.abv).toBeUndefined();
  });
});

describe('applyAdhocEdit', () => {
  it('updates the ad-hoc payload but leaves user state alone', () => {
    const initial = startingAdhocState({ name: 'Old name', brewery: 'Old brew' });
    const withState = { ...initial, status: 'tried' as const, notes: 'great' };
    const result = applyAdhocEdit(withState, { name: 'New name', brewery: 'NewBrew' });
    expect(result.adhoc).toEqual({ name: 'New name', brewery: 'NewBrew' });
    expect(result.status).toBe('tried');
    expect(result.notes).toBe('great');
  });

  it('is a no-op on dataset beers (no adhoc payload)', () => {
    const datasetBeer = startingState();
    const result = applyAdhocEdit(datasetBeer, { name: 'Should not apply', brewery: 'X' });
    expect(result).toBe(datasetBeer);
    expect(result.adhoc).toBeUndefined();
  });
});
