/**
 * Reactive user-data store.
 *
 * Svelte 5 $state lives inside a class so components can import a single
 * shared instance. The class wires the pure cascade functions (cascade.ts)
 * and the storage layer (storage.ts) together and exposes a small
 * mutation API.
 *
 * Lifecycle:
 *   const store = createUserStore(window.localStorage)
 *   await load dataset...
 *   store.activate(dataset.id)            // hydrates from localStorage
 *   store.get(beerId).status              // read, reactively
 *   store.setStatus(beerId, 'toTry')      // write, auto-persisted
 */

import {
  applyAdhocEdit,
  applyNotPresent,
  applyNotes,
  applyOpinion,
  applyStatus,
  startingAdhocState,
} from './cascade';
import { beerState, emptyUserData, loadUserData, saveUserData, type StorageLike } from './storage';
import {
  EMPTY_BEER_USER_STATE,
  type AdhocBeerPayload,
  type BeerStatus,
  type BeerUserState,
  type Opinion,
  type UserData,
} from './types';

const ADHOC_ID_PREFIX = 'adhoc-';

/**
 * Stable, locally-generated id for an ad-hoc beer.
 *
 * Prefers crypto.randomUUID when available (every browser since iOS
 * Safari 15.4 / Chrome 92 / Firefox 95). Falls back to a small RFC-4122
 * v4 generator built on crypto.getRandomValues for older iOS Safari 14.x
 * — we don't actually need cryptographic uniqueness here, just collision-
 * resistance across a single user's session.
 */
export function generateAdhocId(): string {
  return `${ADHOC_ID_PREFIX}${randomUuid()}`;
}

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback: classic 4-bit-each v4 UUID using crypto.getRandomValues
  // (available everywhere; even iOS Safari has had it for a decade).
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return (
    hex.slice(0, 4).join('') +
    '-' +
    hex.slice(4, 6).join('') +
    '-' +
    hex.slice(6, 8).join('') +
    '-' +
    hex.slice(8, 10).join('') +
    '-' +
    hex.slice(10, 16).join('')
  );
}

export function isAdhocId(id: string): boolean {
  return id.startsWith(ADHOC_ID_PREFIX);
}

export class UserStore {
  // The active dataset id this store is hydrated for. null until activate().
  private datasetId = $state<string | null>(null);

  // The active dataset's user data. Reactive; components reading this re-run.
  private data = $state<UserData>(emptyUserData());

  constructor(private storage: StorageLike) {}

  /**
   * Hydrate the store for a given dataset. Idempotent — re-activating the
   * same dataset id is a no-op. Switching datasets reloads from storage.
   */
  activate(datasetId: string): void {
    if (this.datasetId === datasetId) return;
    this.datasetId = datasetId;
    this.data = loadUserData(datasetId, this.storage);
  }

  /** True if we have an active dataset and can accept writes. */
  get isActive(): boolean {
    return this.datasetId !== null;
  }

  /**
   * Return the per-beer state. Always returns a stable shape so components
   * can read fields without null-checking. Reactive — re-runs when the
   * underlying data updates.
   */
  get(beerId: string): BeerUserState {
    return beerState(this.data, beerId);
  }

  /** Read the whole user-data map. Reactive. */
  get all(): Readonly<UserData> {
    return this.data;
  }

  setStatus(beerId: string, status: BeerStatus): void {
    this.mutate(beerId, (s) => applyStatus(s, status));
  }

  setOpinion(beerId: string, opinion: Opinion): void {
    this.mutate(beerId, (s) => applyOpinion(s, opinion));
  }

  setNotes(beerId: string, notes: string): void {
    this.mutate(beerId, (s) => applyNotes(s, notes));
  }

  setNotPresent(beerId: string, notPresent: boolean): void {
    this.mutate(beerId, (s) => applyNotPresent(s, notPresent));
  }

  /**
   * Convenience: flip to-try on/off. If status is anything else, becomes
   * 'toTry'; if already 'toTry', becomes null. This is the action the
   * one-tap row star button performs.
   */
  toggleToTry(beerId: string): void {
    const current = this.get(beerId).status;
    this.setStatus(beerId, current === 'toTry' ? null : 'toTry');
  }

  // --- Ad-hoc beers -------------------------------------------------------

  /**
   * Create a new ad-hoc beer. Returns the generated id so the caller can
   * navigate to it / select it after creation.
   */
  addAdhoc(payload: AdhocBeerPayload): string {
    if (this.datasetId === null) {
      console.warn('UserStore.addAdhoc called before activate()');
      return '';
    }
    const id = generateAdhocId();
    const state = startingAdhocState(payload);
    const nextBeers = { ...this.data.beers, [id]: state };
    this.data = { ...this.data, beers: nextBeers };
    saveUserData(this.datasetId, this.data, this.storage);
    return id;
  }

  /**
   * Update the source-beer fields on an existing ad-hoc beer. No effect if
   * the beer isn't ad-hoc (defensive — caller should check first).
   */
  updateAdhoc(beerId: string, payload: AdhocBeerPayload): void {
    this.mutate(beerId, (s) => applyAdhocEdit(s, payload));
  }

  /**
   * Wholesale-replace the entire UserData for the active dataset. Used by
   * CSV import — destructive, mirrors the spec's "replace" semantics.
   * Caller is responsible for prompting the user before invoking.
   */
  replaceData(data: UserData): void {
    if (this.datasetId === null) {
      console.warn('UserStore.replaceData called before activate()');
      return;
    }
    this.data = data;
    saveUserData(this.datasetId, this.data, this.storage);
  }

  /**
   * Permanently remove an ad-hoc beer. Unlike dataset beers (which can only
   * be marked notPresent), ad-hoc beers are user-created and can be deleted
   * outright. No-op on dataset beers — only ad-hoc records are removed.
   */
  deleteAdhoc(beerId: string): void {
    if (this.datasetId === null) {
      console.warn('UserStore.deleteAdhoc called before activate()');
      return;
    }
    const entry = this.data.beers[beerId];
    if (!entry || !entry.adhoc) return;
    const nextBeers = { ...this.data.beers };
    delete nextBeers[beerId];
    this.data = { ...this.data, beers: nextBeers };
    saveUserData(this.datasetId, this.data, this.storage);
  }

  // --- internals ----------------------------------------------------------

  private mutate(beerId: string, fn: (state: BeerUserState) => BeerUserState): void {
    if (this.datasetId === null) {
      console.warn('UserStore.mutate called before activate()');
      return;
    }
    const before = this.get(beerId);
    const after = fn(before);
    if (after === before) return; // pure functions short-circuit when unchanged

    // Cloning beers map so Svelte's deep reactivity picks up the change.
    const nextBeers = { ...this.data.beers };
    // Drop entries that have collapsed back to "untouched" so storage stays tidy.
    if (isUntouched(after)) delete nextBeers[beerId];
    else nextBeers[beerId] = after;

    this.data = { ...this.data, beers: nextBeers };
    saveUserData(this.datasetId, this.data, this.storage);
  }
}

function isUntouched(state: BeerUserState): boolean {
  return (
    state.status === null &&
    state.opinion === null &&
    state.notes === '' &&
    state.notPresent === false &&
    state.adhoc === undefined
  );
}

export function createUserStore(storage: StorageLike): UserStore {
  return new UserStore(storage);
}

/**
 * Empty state singleton, re-exported so components have a stable default
 * when the store isn't active yet (during initial dataset load).
 */
export { EMPTY_BEER_USER_STATE };
