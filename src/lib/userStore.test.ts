/**
 * Tests for the reactive UserStore.
 *
 * These tests don't exercise reactivity directly (that needs the Svelte
 * runtime in a component); they verify the mutation API, storage
 * persistence, and the activate/switch lifecycle.
 */

import { describe, expect, it } from 'vitest';
import { createUserStore } from './userStore.svelte';
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

  it('notPresent toggles independently of other state', () => {
    const { store } = freshStore();
    store.setNotPresent('b1', true);
    expect(store.get('b1').notPresent).toBe(true);
    expect(store.get('b1').status).toBeNull();
  });
});
