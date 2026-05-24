/**
 * App-wide settings store.
 *
 * Settings are scoped to the user (not the dataset) so they live under a
 * fixed `taplist:settings` key. The store hydrates from the injected
 * storage in its constructor and persists on every mutation.
 *
 * Smaller surface area than UserStore: no per-key namespacing, no
 * cascade rules, just typed get/set on the AppSettings shape.
 */

import { type StorageLike } from './storage';
import type { AppSettings } from './types';

const STORAGE_KEY = 'taplist:settings';
const CURRENT_VERSION = 1 as const;

export function defaultSettings(): AppSettings {
  return { version: CURRENT_VERSION, showNotPresent: false };
}

/**
 * Parse a settings blob defensively. Unknown versions, missing fields,
 * and malformed JSON all collapse to the default settings — never throws.
 */
export function parseSettings(raw: unknown): AppSettings {
  if (!raw || typeof raw !== 'object') return defaultSettings();
  const obj = raw as Record<string, unknown>;
  if (obj.version !== CURRENT_VERSION) {
    // Future migrations will branch here. For v1, anything else is treated as a fresh start.
    return defaultSettings();
  }
  return {
    version: CURRENT_VERSION,
    showNotPresent: obj.showNotPresent === true,
  };
}

export function loadSettings(storage: StorageLike): AppSettings {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return defaultSettings();
  try {
    return parseSettings(JSON.parse(raw));
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(storage: StorageLike, settings: AppSettings): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export class SettingsStore {
  private data = $state<AppSettings>(defaultSettings());

  constructor(private storage: StorageLike) {
    this.data = loadSettings(storage);
  }

  /** Read the current settings. Reactive. */
  get showNotPresent(): boolean {
    return this.data.showNotPresent;
  }

  setShowNotPresent(value: boolean): void {
    if (this.data.showNotPresent === value) return;
    this.data = { ...this.data, showNotPresent: value };
    saveSettings(this.storage, this.data);
  }
}

export function createSettingsStore(storage: StorageLike): SettingsStore {
  return new SettingsStore(storage);
}
