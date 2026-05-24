/**
 * Tests for the app-wide settings store (load/save/parse + reactive shell).
 */

import { describe, expect, it } from 'vitest';
import {
  createSettingsStore,
  defaultSettings,
  loadSettings,
  parseSettings,
  saveSettings,
} from './settingsStore.svelte';
import type { StorageLike } from './storage';

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

describe('parseSettings', () => {
  it('returns defaults for null/wrong-type input', () => {
    expect(parseSettings(null)).toEqual(defaultSettings());
    expect(parseSettings('nope')).toEqual(defaultSettings());
    expect(parseSettings(42)).toEqual(defaultSettings());
  });

  it('returns defaults for missing or unknown version', () => {
    expect(parseSettings({ showNotPresent: true })).toEqual(defaultSettings());
    expect(parseSettings({ version: 2, showNotPresent: true })).toEqual(defaultSettings());
  });

  it('reads showNotPresent when version matches', () => {
    const parsed = parseSettings({ version: 1, showNotPresent: true });
    expect(parsed.showNotPresent).toBe(true);
  });

  it('coerces non-boolean showNotPresent to false', () => {
    const parsed = parseSettings({ version: 1, showNotPresent: 'yes' });
    expect(parsed.showNotPresent).toBe(false);
  });
});

describe('loadSettings + saveSettings', () => {
  it('returns defaults when storage is empty', () => {
    expect(loadSettings(makeStorage())).toEqual(defaultSettings());
  });

  it('returns defaults when stored JSON is malformed', () => {
    const storage = makeStorage({ 'taplist:settings': '{not valid' });
    expect(loadSettings(storage)).toEqual(defaultSettings());
  });

  it('round-trips through save + load', () => {
    const storage = makeStorage();
    saveSettings(storage, { version: 1, showNotPresent: true });
    expect(loadSettings(storage)).toEqual({ version: 1, showNotPresent: true });
  });
});

describe('SettingsStore', () => {
  it('hydrates from storage on construction', () => {
    const storage = makeStorage({
      'taplist:settings': JSON.stringify({ version: 1, showNotPresent: true }),
    });
    const store = createSettingsStore(storage);
    expect(store.showNotPresent).toBe(true);
  });

  it('defaults to showNotPresent=false on first run', () => {
    const store = createSettingsStore(makeStorage());
    expect(store.showNotPresent).toBe(false);
  });

  it('setShowNotPresent persists immediately', () => {
    const storage = makeStorage();
    const store = createSettingsStore(storage);
    store.setShowNotPresent(true);
    expect(store.showNotPresent).toBe(true);
    const raw = storage.raw.get('taplist:settings');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual({ version: 1, showNotPresent: true });
  });

  it('survives a hypothetical reload (new store reads what the prior wrote)', () => {
    const storage = makeStorage();
    createSettingsStore(storage).setShowNotPresent(true);
    // Simulate a page reload by creating a fresh store against the same storage.
    const reloaded = createSettingsStore(storage);
    expect(reloaded.showNotPresent).toBe(true);
  });

  it('no-ops when setting to the same value (no redundant writes)', () => {
    const storage = makeStorage();
    const store = createSettingsStore(storage);
    store.setShowNotPresent(true);
    storage.raw.delete('taplist:settings');
    store.setShowNotPresent(true); // same value — should not write
    expect(storage.raw.has('taplist:settings')).toBe(false);
  });
});
