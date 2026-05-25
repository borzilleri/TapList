/**
 * Tests for the reactive UserStore.
 *
 * These tests don't exercise reactivity directly (that needs the Svelte
 * runtime in a component); they verify the mutation API, storage
 * persistence, and the activate/switch lifecycle.
 */

import { describe, expect, it } from 'vitest';
import { createUserStore, generateAdhocId, isAdhocId } from './userStore.svelte';
import { storageKeyFor, type StorageLike } from './storage';

function makeStorage(initial: Record<string, string> = {}): StorageLike & {
  raw: Map<string, string>;
} {
  const raw = new Map(Object.entries(initial));
  return {
    raw,
    getItem: (k) => raw.get(k) ?? null,
    setItem: (k, v) => void raw.set(k, v),
    removeItem: (k) => void raw.delete(k),
  };
}

describe('UserStore lifecycle', () => {
  it('reads/writes nothing before activate', () => {
    const storage = makeStorage();
    const store = createUserStore(storage);
    expect(store.isActive).toBe(false);
    // Mutations are no-ops before activate; they log a warning but don't throw.
    store.setStatus('b1', 'toTry');
    expect(storage.raw.size).toBe(0);
  });

  it('hydrates from storage on activate', () => {
    const storage = makeStorage({
      [storageKeyFor('wbf-2026')]: JSON.stringify({
        version: 1,
        beers: {
          b1: { status: 'tried', opinion: 'liked', notes: 'nice', notPresent: false },
        },
      }),
    });
    const store = createUserStore(storage);
    store.activate('wbf-2026');
    expect(store.get('b1').status).toBe('tried');
    expect(store.get('b1').opinion).toBe('liked');
    expect(store.get('b1').notes).toBe('nice');
  });

  it('switching datasets reloads from storage', () => {
    const storage = makeStorage({
      [storageKeyFor('a')]: JSON.stringify({
        version: 1,
        beers: { b1: { status: 'toTry', opinion: null, notes: '', notPresent: false } },
      }),
      [storageKeyFor('b')]: JSON.stringify({
        version: 1,
        beers: { b1: { status: 'tried', opinion: null, notes: '', notPresent: false } },
      }),
    });
    const store = createUserStore(storage);
    store.activate('a');
    expect(store.get('b1').status).toBe('toTry');
    store.activate('b');
    expect(store.get('b1').status).toBe('tried');
  });

  it('re-activating the same dataset is a no-op', () => {
    const storage = makeStorage();
    const store = createUserStore(storage);
    store.activate('wbf-2026');
    store.setStatus('b1', 'toTry');
    store.activate('wbf-2026'); // would clobber if not idempotent
    expect(store.get('b1').status).toBe('toTry');
  });
});

describe('UserStore mutations + persistence', () => {
  function freshStore() {
    const storage = makeStorage();
    const store = createUserStore(storage);
    store.activate('wbf-2026');
    return { store, storage };
  }

  function readPersisted(storage: ReturnType<typeof makeStorage>) {
    const raw = storage.raw.get(storageKeyFor('wbf-2026'));
    return raw === undefined ? null : JSON.parse(raw);
  }

  it('persists status changes to storage', () => {
    const { store, storage } = freshStore();
    store.setStatus('b1', 'toTry');
    expect(readPersisted(storage)?.beers?.b1?.status).toBe('toTry');
  });

  it('toggleToTry flips between toTry and null', () => {
    const { store } = freshStore();
    store.toggleToTry('b1');
    expect(store.get('b1').status).toBe('toTry');
    store.toggleToTry('b1');
    expect(store.get('b1').status).toBeNull();
  });

  it('toggleToTry from tried jumps to toTry (mutual exclusion)', () => {
    const { store } = freshStore();
    store.setStatus('b1', 'tried');
    store.toggleToTry('b1');
    expect(store.get('b1').status).toBe('toTry');
  });

  it('setting opinion cascades status to tried', () => {
    const { store } = freshStore();
    store.setOpinion('b1', 'liked');
    expect(store.get('b1').status).toBe('tried');
    expect(store.get('b1').opinion).toBe('liked');
  });

  it('clearing opinion does NOT revert status', () => {
    const { store } = freshStore();
    store.setOpinion('b1', 'liked');
    store.setOpinion('b1', null);
    expect(store.get('b1').status).toBe('tried');
    expect(store.get('b1').opinion).toBeNull();
  });

  it('clearing tried status also clears opinion (inverse cascade)', () => {
    const { store } = freshStore();
    store.setOpinion('b1', 'liked'); // implicit status=tried
    store.setStatus('b1', null);
    expect(store.get('b1').status).toBeNull();
    expect(store.get('b1').opinion).toBeNull();
  });

  it('switching from tried to toTry also clears opinion', () => {
    const { store } = freshStore();
    store.setOpinion('b1', 'disliked'); // implicit status=tried
    store.setStatus('b1', 'toTry');
    expect(store.get('b1').status).toBe('toTry');
    expect(store.get('b1').opinion).toBeNull();
  });

  it('drops entries when state collapses back to untouched', () => {
    const { store, storage } = freshStore();
    store.setStatus('b1', 'toTry');
    expect(readPersisted(storage)?.beers?.b1).toBeDefined();
    store.setStatus('b1', null);
    expect(readPersisted(storage)?.beers?.b1).toBeUndefined();
  });

  it('keeps unrelated beers when mutating one', () => {
    const { store } = freshStore();
    store.setStatus('b1', 'toTry');
    store.setStatus('b2', 'tried');
    store.setStatus('b1', null);
    expect(store.get('b1').status).toBeNull();
    expect(store.get('b2').status).toBe('tried');
  });

  it('truncates notes at the hard cap', () => {
    const { store, storage } = freshStore();
    store.setNotes('b1', 'a'.repeat(500));
    expect(store.get('b1').notes.length).toBe(280);
    expect(readPersisted(storage)?.beers?.b1?.notes.length).toBe(280);
  });

  it('notPresent toggles to true on an empty beer', () => {
    const { store } = freshStore();
    store.setNotPresent('b1', true);
    expect(store.get('b1').notPresent).toBe(true);
    expect(store.get('b1').status).toBeNull();
  });

  it('replaceData wholesale-replaces the active dataset user data + persists', () => {
    const { store, storage } = freshStore();
    store.setStatus('b1', 'toTry');
    store.setNotes('b2', 'about to be wiped');
    store.replaceData({
      version: 1,
      beers: {
        replacement: { status: 'tried', opinion: 'liked', notes: 'new', notPresent: false },
      },
    });
    // Prior entries are gone, replacement is present.
    expect(store.get('b1').status).toBeNull();
    expect(store.get('b2').notes).toBe('');
    expect(store.get('replacement').status).toBe('tried');
    // Persisted to storage too.
    const persisted = readPersisted(storage);
    expect(Object.keys(persisted?.beers ?? {})).toEqual(['replacement']);
  });

  it('marking not-present clears status, opinion, and notes (cascade)', () => {
    const { store, storage } = freshStore();
    store.setStatus('b1', 'tried');
    store.setOpinion('b1', 'liked');
    store.setNotes('b1', 'memorable');
    store.setNotPresent('b1', true);
    const state = store.get('b1');
    expect(state.notPresent).toBe(true);
    expect(state.status).toBeNull();
    expect(state.opinion).toBeNull();
    expect(state.notes).toBe('');
    // Persisted to storage too.
    expect(readPersisted(storage)?.beers?.b1).toEqual({
      status: null,
      opinion: null,
      notes: '',
      notPresent: true,
    });
  });
});

describe('UserStore ad-hoc beers', () => {
  function freshStore() {
    const storage = makeStorage();
    const store = createUserStore(storage);
    store.activate('wbf-2026');
    return { store, storage };
  }

  function readPersisted(storage: ReturnType<typeof makeStorage>) {
    const raw = storage.raw.get(storageKeyFor('wbf-2026'));
    return raw === undefined ? null : JSON.parse(raw);
  }

  describe('generateAdhocId / isAdhocId', () => {
    it('produces ids with the adhoc- prefix', () => {
      const id = generateAdhocId();
      expect(isAdhocId(id)).toBe(true);
      expect(id.startsWith('adhoc-')).toBe(true);
    });

    it('returns false for dataset-style ids', () => {
      expect(isAdhocId('wbf26-0001')).toBe(false);
      expect(isAdhocId('mock-0030')).toBe(false);
    });

    it('produces unique ids on each call', () => {
      const ids = new Set([generateAdhocId(), generateAdhocId(), generateAdhocId()]);
      expect(ids.size).toBe(3);
    });
  });

  describe('addAdhoc', () => {
    it('creates a new ad-hoc beer and returns its id', () => {
      const { store, storage } = freshStore();
      const id = store.addAdhoc({ name: 'Mystery Sour', brewery: 'Backstage' });
      expect(isAdhocId(id)).toBe(true);
      expect(store.get(id).adhoc).toEqual({ name: 'Mystery Sour', brewery: 'Backstage' });
      expect(readPersisted(storage)?.beers?.[id]?.adhoc?.name).toBe('Mystery Sour');
    });

    it('starts user state at defaults (not touched yet beyond being adhoc)', () => {
      const { store } = freshStore();
      const id = store.addAdhoc({ name: 'Mystery', brewery: 'Backstage' });
      const state = store.get(id);
      expect(state.status).toBeNull();
      expect(state.opinion).toBeNull();
      expect(state.notes).toBe('');
      expect(state.notPresent).toBe(false);
    });

    it('produces distinct ids when added in sequence', () => {
      const { store } = freshStore();
      const a = store.addAdhoc({ name: 'A', brewery: 'Brew' });
      const b = store.addAdhoc({ name: 'B', brewery: 'Brew' });
      expect(a).not.toBe(b);
      expect(store.get(a).adhoc?.name).toBe('A');
      expect(store.get(b).adhoc?.name).toBe('B');
    });
  });

  describe('updateAdhoc', () => {
    it('edits an ad-hoc beer payload but preserves user state', () => {
      const { store } = freshStore();
      const id = store.addAdhoc({ name: 'Old name', brewery: 'Old brew' });
      store.setStatus(id, 'tried');
      store.setNotes(id, 'remember this');
      store.updateAdhoc(id, { name: 'New name', brewery: 'New brew', abv: 5.5 });
      const state = store.get(id);
      expect(state.adhoc).toEqual({ name: 'New name', brewery: 'New brew', abv: 5.5 });
      expect(state.status).toBe('tried');
      expect(state.notes).toBe('remember this');
    });

    it('does nothing on dataset (non-adhoc) ids', () => {
      const { store } = freshStore();
      store.setStatus('wbf26-0001', 'toTry');
      store.updateAdhoc('wbf26-0001', { name: 'Should not apply', brewery: 'X' });
      expect(store.get('wbf26-0001').adhoc).toBeUndefined();
    });
  });

  describe('deleteAdhoc', () => {
    it('removes the ad-hoc beer entirely', () => {
      const { store, storage } = freshStore();
      const id = store.addAdhoc({ name: 'Mystery', brewery: 'Backstage' });
      expect(readPersisted(storage)?.beers?.[id]).toBeDefined();
      store.deleteAdhoc(id);
      expect(readPersisted(storage)?.beers?.[id]).toBeUndefined();
      expect(store.get(id).adhoc).toBeUndefined();
    });

    it('ignores non-adhoc ids (defense against accidental data loss)', () => {
      const { store } = freshStore();
      store.setStatus('wbf26-0001', 'tried');
      store.deleteAdhoc('wbf26-0001');
      expect(store.get('wbf26-0001').status).toBe('tried');
    });

    it('ignores unknown ids', () => {
      const { store } = freshStore();
      store.addAdhoc({ name: 'A', brewery: 'Brew' });
      const beforeCount = Object.keys(store.all.beers).length;
      store.deleteAdhoc(generateAdhocId());
      expect(Object.keys(store.all.beers).length).toBe(beforeCount);
    });
  });

  describe('not-present round-trip', () => {
    it('preserves the ad-hoc payload through a not-present toggle cycle', () => {
      // Regression guard: marking an ad-hoc beer not-present clears
      // status/opinion/notes (per the cascade) but must NOT drop the
      // adhoc payload — otherwise the beer would vanish from the list
      // when the user un-marks it.
      const { store, storage } = freshStore();
      const id = store.addAdhoc({ name: 'Mystery', brewery: 'Backstage', abv: 4.5 });
      store.setStatus(id, 'tried');
      store.setOpinion(id, 'liked');
      store.setNotes(id, 'funky');

      store.setNotPresent(id, true);
      // Cascade: user state is wiped but the adhoc payload survives.
      expect(store.get(id).notPresent).toBe(true);
      expect(store.get(id).status).toBeNull();
      expect(store.get(id).opinion).toBeNull();
      expect(store.get(id).notes).toBe('');
      expect(store.get(id).adhoc).toEqual({
        name: 'Mystery',
        brewery: 'Backstage',
        abv: 4.5,
      });
      // ...and persists.
      expect(readPersisted(storage)?.beers?.[id]?.adhoc?.name).toBe('Mystery');

      // Un-mark not-present: the beer remains, payload intact, state
      // back to "untouched" (the cascade doesn't restore prior status).
      store.setNotPresent(id, false);
      expect(store.get(id).notPresent).toBe(false);
      expect(store.get(id).adhoc?.name).toBe('Mystery');
      expect(readPersisted(storage)?.beers?.[id]?.adhoc?.name).toBe('Mystery');
    });
  });
});
