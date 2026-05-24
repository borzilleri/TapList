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
  type AdhocBeerPayload,
  type BeerStatus,
  type BeerUserState,
  type Opinion,
} from './types';

/**
 * Apply a status change. Tri-state semantics: setting either value clears
 * the other implicitly (since they're the same field). Setting null
 * clears whatever status was there.
 *
 * Inverse-cascade: moving AWAY from 'tried' (to null or to 'toTry') also
 * clears the opinion, since opinion only makes sense on a beer you've
 * sampled. This is the mirror of `applyOpinion`'s opinion→tried cascade
 * and keeps the invariant `opinion != null ⇒ status === 'tried'`.
 */
export function applyStatus(state: BeerUserState, status: BeerStatus): BeerUserState {
  if (state.status === status) return state;
  const next: BeerUserState = { ...state, status };
  if (state.status === 'tried' && status !== 'tried' && state.opinion !== null) {
    next.opinion = null;
  }
  return next;
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

// --- Ad-hoc beers ------------------------------------------------------------

/**
 * Build the initial user-data entry for a newly-created ad-hoc beer.
 * Status / opinion / notes / notPresent all start at their defaults; the
 * caller can apply further mutations afterward if needed.
 */
export function startingAdhocState(payload: AdhocBeerPayload): BeerUserState {
  return {
    ...EMPTY_BEER_USER_STATE,
    adhoc: sanitizeAdhocPayload(payload),
  };
}

/**
 * Apply edits to the ad-hoc payload of an existing beer state. Leaves
 * status/opinion/notes/notPresent untouched. Returns the same object if
 * the state isn't ad-hoc (defensive — caller shouldn't invoke for dataset
 * beers).
 */
export function applyAdhocEdit(state: BeerUserState, payload: AdhocBeerPayload): BeerUserState {
  if (!state.adhoc) return state;
  return { ...state, adhoc: sanitizeAdhocPayload(payload) };
}

/**
 * Trim string fields and normalize empty optional values to undefined so
 * round-tripping through storage produces a stable shape. `name` and
 * `brewery` are required; the form is the validation boundary, so we
 * trust them to be non-empty after trim.
 */
function sanitizeAdhocPayload(payload: AdhocBeerPayload): AdhocBeerPayload {
  const result: AdhocBeerPayload = {
    name: payload.name.trim(),
    brewery: payload.brewery.trim(),
  };
  if (typeof payload.abv === 'number' && Number.isFinite(payload.abv)) {
    result.abv = payload.abv;
  } else if (payload.abv === null) {
    result.abv = null;
  }
  const style = payload.style?.trim();
  if (style) result.style = style;
  const location = payload.location?.trim();
  if (location) result.location = location;
  const description = payload.description?.trim();
  if (description) result.description = description;
  return result;
}
