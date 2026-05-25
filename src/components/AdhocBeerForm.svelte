<script lang="ts">
  import type { AdhocBeerPayload } from '../lib/types';
  import { focusTrap } from '../lib/focusTrap';

  interface Props {
    /**
     * When editing, the initial values to pre-fill. When omitted, the form
     * is in "create" mode (all fields blank).
     */
    initial?: AdhocBeerPayload | null;
    onClose: () => void;
    onSubmit: (payload: AdhocBeerPayload) => void;
  }

  const { initial = null, onClose, onSubmit }: Props = $props();

  const isEdit = $derived(initial !== null);

  // Local form state. Mirrors AdhocBeerPayload but with all strings to keep
  // input bindings simple. ABV is a separate string and is parsed on submit
  // so we can distinguish blank (unknown) from invalid (rejected).
  //
  // `initial` is intentionally read once at mount: the form is unmounted +
  // remounted between open/close in App.svelte, so there's no "in-place"
  // update of the initial payload to react to. Suppress the lint accordingly.
  /* svelte-ignore state_referenced_locally */
  let name = $state(initial?.name ?? '');
  /* svelte-ignore state_referenced_locally */
  let brewery = $state(initial?.brewery ?? '');
  /* svelte-ignore state_referenced_locally */
  let abvText = $state(
    initial?.abv === undefined || initial?.abv === null ? '' : String(initial.abv),
  );
  /* svelte-ignore state_referenced_locally */
  let style = $state(initial?.style ?? '');
  /* svelte-ignore state_referenced_locally */
  let location = $state(initial?.location ?? '');
  /* svelte-ignore state_referenced_locally */
  let description = $state(initial?.description ?? '');

  let nameError = $state<string | null>(null);
  let breweryError = $state<string | null>(null);
  let abvError = $state<string | null>(null);

  // Refs so we can focus the first invalid field on validation failure.
  // This is the key mobile fix: on a phone, if validation fails for a field
  // that's scrolled off-screen above the keyboard, the user can't see the
  // inline error and the submit button looks broken. Focusing the field
  // scrolls it into view and pops the keyboard back open if needed.
  let nameInput: HTMLInputElement | undefined = $state();
  let breweryInput: HTMLInputElement | undefined = $state();
  let abvInput: HTMLInputElement | undefined = $state();

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  function validate(): AdhocBeerPayload | null {
    nameError = null;
    breweryError = null;
    abvError = null;
    const trimmedName = name.trim();
    const trimmedBrewery = brewery.trim();
    let firstInvalid: HTMLInputElement | undefined;
    if (!trimmedName) {
      nameError = 'Name is required.';
      firstInvalid ??= nameInput;
    }
    if (!trimmedBrewery) {
      breweryError = 'Brewery is required.';
      firstInvalid ??= breweryInput;
    }
    let abv: number | null | undefined = undefined;
    const abvTrim = abvText.trim();
    if (abvTrim.length > 0) {
      // Accept a bare number; tolerate a trailing % (common when copy-pasting).
      const cleaned = abvTrim.replace(/%\s*$/, '').trim();
      const parsed = Number(cleaned);
      if (!Number.isFinite(parsed)) {
        abvError = "Couldn't read that as a number. Leave blank if you don't know.";
        firstInvalid ??= abvInput;
      } else {
        abv = parsed;
      }
    }
    if (firstInvalid) {
      firstInvalid.focus();
      firstInvalid.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return null;
    }
    const payload: AdhocBeerPayload = { name: trimmedName, brewery: trimmedBrewery };
    if (abv !== undefined) payload.abv = abv;
    if (style.trim()) payload.style = style.trim();
    if (location.trim()) payload.location = location.trim();
    if (description.trim()) payload.description = description.trim();
    return payload;
  }

  function handleSubmit(e: Event) {
    e.preventDefault();
    const payload = validate();
    if (!payload) return;
    onSubmit(payload);
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!--
  Same modal pattern as BeerDetail — sheet on mobile, centered on desktop.
  The backdrop click handler checks `e.target === e.currentTarget` so a tap
  inside the form doesn't bubble up and close the modal. This is more
  robust than putting stopPropagation on the form, which has been known
  to interact oddly with form submit on iOS Safari. Keyboard equivalent
  for the close action is the Escape key, handled at the window level.
-->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
  class="backdrop"
  role="dialog"
  aria-modal="true"
  aria-labelledby="adhoc-title"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
  tabindex="-1"
>
  <form class="panel" onsubmit={handleSubmit} use:focusTrap>
    <header>
      <h2 id="adhoc-title">{isEdit ? 'Edit ad-hoc beer' : 'Add a beer'}</h2>
      <button type="button" class="close" onclick={onClose} aria-label="Close">×</button>
    </header>

    <p class="hint">
      Adding a beer the published list missed (or a last-minute substitution)? You can fill in
      whatever you know — only the name is required.
    </p>

    <label class="field">
      <span class="field-label">
        Name <span class="required">*</span>
      </span>
      <input
        bind:this={nameInput}
        type="text"
        bind:value={name}
        placeholder="Mystery Sour"
        autocomplete="off"
        autocapitalize="words"
        required
        aria-invalid={nameError !== null}
      />
      {#if nameError}<span class="field-error">{nameError}</span>{/if}
    </label>

    <label class="field">
      <span class="field-label">
        Brewery <span class="required">*</span>
      </span>
      <input
        bind:this={breweryInput}
        type="text"
        bind:value={brewery}
        placeholder="Backstage Brewing"
        autocomplete="off"
        autocapitalize="words"
        required
        aria-invalid={breweryError !== null}
      />
      {#if breweryError}<span class="field-error">{breweryError}</span>{/if}
    </label>

    <div class="field-row">
      <label class="field field-flex-2">
        <span class="field-label">ABV (%)</span>
        <input
          bind:this={abvInput}
          type="text"
          inputmode="decimal"
          bind:value={abvText}
          placeholder="5.2"
          autocomplete="off"
          aria-invalid={abvError !== null}
        />
        {#if abvError}<span class="field-error">{abvError}</span>{/if}
      </label>
      <label class="field field-flex-3">
        <span class="field-label">Style</span>
        <input
          type="text"
          bind:value={style}
          placeholder="IPA"
          autocomplete="off"
          autocapitalize="words"
        />
      </label>
    </div>

    <label class="field">
      <span class="field-label">Location</span>
      <input
        type="text"
        bind:value={location}
        placeholder="North Tent, Booth 14"
        autocomplete="off"
      />
    </label>

    <label class="field">
      <span class="field-label">Description</span>
      <textarea
        bind:value={description}
        rows="3"
        placeholder="Brewery write-up, tasting notes, anything…"
        autocomplete="off"
        spellcheck="true"
      ></textarea>
    </label>

    <div class="actions">
      <button type="button" class="cancel" onclick={onClose}>Cancel</button>
      <button type="submit" class="save">{isEdit ? 'Save changes' : 'Add beer'}</button>
    </div>
  </form>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
  }
  @media (min-width: 600px) {
    .backdrop {
      align-items: center;
      padding: 2rem;
    }
  }

  .panel {
    background: var(--color-surface);
    border-radius: var(--radius) var(--radius) 0 0;
    width: 100%;
    max-width: 520px;
    max-height: 90vh;
    overflow-y: auto;
    padding: 1.25rem 1.25rem 1.5rem;
    box-shadow: var(--shadow-md);
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    -webkit-overflow-scrolling: touch;
  }
  @media (min-width: 600px) {
    .panel {
      border-radius: var(--radius);
    }
  }

  header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 0;
  }
  h2 {
    margin: 0;
    font-size: 1.25rem;
    flex: 1;
  }
  .close {
    background: transparent;
    border: none;
    font-size: 1.8rem;
    line-height: 1;
    padding: 0 0.25rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  @media (hover: hover) {
    .close:hover {
      color: var(--color-text);
    }
  }
  .close:focus-visible {
    color: var(--color-text);
    outline: 2px solid var(--color-accent);
    border-radius: 4px;
  }

  .hint {
    margin: 0;
    font-size: 0.85rem;
    color: var(--color-text-muted);
    line-height: 1.4;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .field-label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  .required {
    color: var(--color-accent);
  }
  .field input,
  .field textarea {
    width: 100%;
    padding: 0.55rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    font: inherit;
    line-height: 1.4;
    -webkit-appearance: none;
    appearance: none;
  }
  .field textarea {
    resize: vertical;
    min-height: 4rem;
  }
  .field input:focus,
  .field textarea:focus {
    outline: 2px solid var(--color-accent);
    outline-offset: -1px;
  }
  .field input[aria-invalid='true'] {
    border-color: #b3261e;
  }
  .field-error {
    font-size: 0.8rem;
    color: #b3261e;
  }

  .field-row {
    display: flex;
    gap: 0.75rem;
  }
  .field-flex-2 {
    flex: 2;
  }
  .field-flex-3 {
    flex: 3;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--color-border);
  }
  .cancel,
  .save {
    flex: 1;
    padding: 0.65rem 0.5rem;
    border-radius: var(--radius);
    font-size: 0.95rem;
    cursor: pointer;
    min-height: 44px;
  }
  .cancel {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    color: var(--color-text);
  }
  .save {
    background: var(--color-accent);
    border: 1px solid var(--color-accent);
    color: var(--color-on-accent);
    font-weight: 600;
  }
  @media (hover: hover) {
    .cancel:hover {
      background: var(--color-accent-bg);
    }
    .save:hover {
      filter: brightness(0.95);
    }
  }
  .cancel:focus-visible,
  .save:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }
</style>
