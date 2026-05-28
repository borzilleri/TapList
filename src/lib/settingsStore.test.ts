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

  it("defaults theme to 'system' when missing or invalid", () => {
    expect(parseSettings({ version: 1, showNotPresent: false }).theme).toBe('system');
    expect(parseSettings({ version: 1, showNotPresent: false, theme: 'magenta' }).theme).toBe(
      'system',
    );
  });

  it.each(['light', 'dark', 'system'] as const)('reads theme=%s', (theme) => {
    const parsed = parseSettings({ version: 1, showNotPresent: false, theme });
    expect(parsed.theme).toBe(theme);
  });

  it('defaults selectedDatasetId to null when missing', () => {
    expect(parseSettings({ version: 1, showNotPresent: false }).selectedDatasetId).toBe(null);
  });

  it('coerces non-string selectedDatasetId to null', () => {
    expect(parseSettings({ version: 1, selectedDatasetId: 42 }).selectedDatasetId).toBe(null);
    expect(parseSettings({ version: 1, selectedDatasetId: '' }).selectedDatasetId).toBe(null);
  });

  it('reads selectedDatasetId when valid', () => {
    expect(parseSettings({ version: 1, selectedDatasetId: 'wbf-2026' }).selectedDatasetId).toBe(
      'wbf-2026',
    );
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
    saveSettings(storage, {
      version: 1,
      showNotPresent: true,
      theme: 'dark',
      selectedDatasetId: 'wbf-2026',
    });
    expect(loadSettings(storage)).toEqual({
      version: 1,
      showNotPresent: true,
      theme: 'dark',
      selectedDatasetId: 'wbf-2026',
    });
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
    expect(JSON.parse(raw!)).toEqual({
      version: 1,
      showNotPresent: true,
      theme: 'system',
      selectedDatasetId: null,
    });
  });

  it("defaults theme to 'system' on first run", () => {
    expect(createSettingsStore(makeStorage()).theme).toBe('system');
  });

  it('setTheme persists immediately', () => {
    const storage = makeStorage();
    const store = createSettingsStore(storage);
    store.setTheme('dark');
    expect(store.theme).toBe('dark');
    const raw = storage.raw.get('taplist:settings');
    expect(JSON.parse(raw!).theme).toBe('dark');
  });

  it('theme survives reload', () => {
    const storage = makeStorage();
    createSettingsStore(storage).setTheme('light');
    expect(createSettingsStore(storage).theme).toBe('light');
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

  it('selectedDatasetId defaults to null on first run', () => {
    expect(createSettingsStore(makeStorage()).selectedDatasetId).toBe(null);
  });

  it('setSelectedDatasetId persists immediately', () => {
    const storage = makeStorage();
    const store = createSettingsStore(storage);
    store.setSelectedDatasetId('wbf-2026');
    expect(store.selectedDatasetId).toBe('wbf-2026');
    expect(JSON.parse(storage.raw.get('taplist:settings')!).selectedDatasetId).toBe('wbf-2026');
  });

  it('selectedDatasetId survives reload', () => {
    const storage = makeStorage();
    createSettingsStore(storage).setSelectedDatasetId('wbf-2026');
    expect(createSettingsStore(storage).selectedDatasetId).toBe('wbf-2026');
  });

  it('clears selectedDatasetId when set to null', () => {
    const storage = makeStorage();
    const store = createSettingsStore(storage);
    store.setSelectedDatasetId('wbf-2026');
    store.setSelectedDatasetId(null);
    expect(store.selectedDatasetId).toBe(null);
    expect(JSON.parse(storage.raw.get('taplist:settings')!).selectedDatasetId).toBe(null);
  });

  it('hydrates selectedDatasetId from pre-existing settings without it', () => {
    // Forward-compat: settings written before this field existed must
    // still load cleanly. The field defaults to null.
    const storage = makeStorage({
      'taplist:settings': JSON.stringify({ version: 1, showNotPresent: true, theme: 'dark' }),
    });
    const store = createSettingsStore(storage);
    expect(store.selectedDatasetId).toBe(null);
    // And the other settings still load correctly.
    expect(store.showNotPresent).toBe(true);
    expect(store.theme).toBe('dark');
  });
});
