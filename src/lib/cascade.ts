/**
 * Pure cascade rules for user-state mutations. Lives separately from the
 * reactive store so it can be tested without any Svelte runtime.
 *
 * Behavior reference: docs/spec.md "User interactions" + "Status: To-try / Tried"
 * and "Opinion: Liked / Disliked".
 */

import {
  EMPTY_BEER_USER_STATE,
  NOTES_MAX_LENGTH,
  type BeerStatus,
  type BeerUserState,
  type Opinion,
} from './types';

/**
 * Apply a status change. Tri-state semantics: setting either value clears
 * the other implicitly (since they're the same field). Setting null
 * clears whatever status was there.
 */
export function applyStatus(state: BeerUserState, status: BeerStatus): BeerUserState {
  if (state.status === status) return state;
  return { ...state, status };
}

/**
 * Apply an opinion change. Setting a non-null opinion implicitly sets
 * status='tried' (you can only have an opinion on something you've sampled).
 * Clearing the opinion does NOT revert status — you still tried it.
 */
export function applyOpinion(state: BeerUserState, opinion: Opinion): BeerUserState {
  if (state.opinion === opinion && (opinion === null || state.status === 'tried')) {
    return state;
  }
  const next: BeerUserState = { ...state, opinion };
  if (opinion !== null) next.status = 'tried';
  return next;
}

/** Apply a notes update. Truncates to the hard cap (defensive; UI should prevent). */
export function applyNotes(state: BeerUserState, notes: string): BeerUserState {
  const clipped = notes.length > NOTES_MAX_LENGTH ? notes.slice(0, NOTES_MAX_LENGTH) : notes;
  if (state.notes === clipped) return state;
  return { ...state, notes: clipped };
}

/** Apply a not-present toggle. */
export function applyNotPresent(state: BeerUserState, notPresent: boolean): BeerUserState {
  if (state.notPresent === notPresent) return state;
  return { ...state, notPresent };
}

/** Convenience: a beer's "before" state when the user touches a never-seen beer. */
export function startingState(): BeerUserState {
  return { ...EMPTY_BEER_USER_STATE };
}
