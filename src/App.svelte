<script lang="ts">
  import type { AdhocBeerPayload, Beer, Dataset } from './lib/types';
  import { loadActiveDataset } from './lib/data';
  import { createUserStore } from './lib/userStore.svelte';
  import { createSettingsStore } from './lib/settingsStore.svelte';
  import { createPwaState } from './lib/pwa.svelte';
  import {
    buildExportFilename,
    parseImport,
    serializeExport,
    type ImportResult,
  } from './lib/transfer';
  import BeerList from './components/BeerList.svelte';
  import BeerDetail from './components/BeerDetail.svelte';
  import FreshnessIndicator from './components/FreshnessIndicator.svelte';
  import SettingsDrawer from './components/SettingsDrawer.svelte';
  import AdhocBeerForm from './components/AdhocBeerForm.svelte';
  import PwaBanner from './components/PwaBanner.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import LoadingSkeleton from './components/LoadingSkeleton.svelte';
  import { dialogs } from './lib/dialogs.svelte';
  import { mergeBeers } from './lib/list';

  // One shared user-data store, persisted to localStorage. Activated below
  // once the dataset loads (the store namespaces storage by dataset id).
  const userStore = createUserStore(window.localStorage);

  // App-wide settings (theme, show-not-present, future dataset selection).
  // Hydrated immediately — settings are global, not per-dataset.
  const settingsStore = createSettingsStore(window.localStorage);

  // Apply the user's theme preference to <html data-theme>. When the
  // setting is 'system' we remove the attribute so the CSS @media
  // (prefers-color-scheme) rule decides; for 'light' / 'dark' the
  // explicit :root[data-theme] override wins regardless of OS preference.
  $effect(() => {
    const theme = settingsStore.theme;
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
  });

  // Service-worker registration + update-prompt state. The actual SW
  // registration happens asynchronously inside register(); errors are
  // logged but don't block the app from loading.
  const pwa = createPwaState();
  pwa.register();

  /**
   * Load the catalog + dataset, then activate the user store for that
   * dataset's id. Returns the dataset so the template can render it.
   */
  async function loadAndActivate(): Promise<Dataset> {
    const result = await loadActiveDataset();
    userStore.activate(result.dataset.id);
    return result.dataset;
  }

  // Promise so {#await} can drive the loading/error UX.
  let loadPromise = $state(loadAndActivate());

  let selectedBeerId = $state<string | null>(null);
  let settingsOpen = $state(false);
  // null = closed; 'create' = new beer; { id, payload } = editing an existing one.
  let adhocForm = $state<null | 'create' | { id: string; payload: AdhocBeerPayload }>(null);
  // Latest import outcome; shown in the settings drawer until it's reopened.
  let importStatus = $state<string | null>(null);

  /**
   * Resolve the selected beer against the merged dataset+ad-hoc list. We
   * compute the merged list here so the detail view can also reach ad-hoc
   * beers (since they aren't in dataset.beers).
   */
  function findBeer(dataset: Dataset, id: string): Beer | undefined {
    return mergeBeers(dataset.beers, userStore.all).find((b) => b.id === id);
  }

  function retry() {
    loadPromise = loadAndActivate();
  }

  function openCreateAdhoc() {
    adhocForm = 'create';
  }

  function openEditAdhoc(id: string) {
    const state = userStore.get(id);
    if (!state.adhoc) return;
    adhocForm = { id, payload: { ...state.adhoc } };
  }

  function handleAdhocSubmit(payload: AdhocBeerPayload) {
    if (adhocForm === 'create') {
      const id = userStore.addAdhoc(payload);
      adhocForm = null;
      selectedBeerId = id; // open the freshly created beer in the detail view
    } else if (adhocForm && typeof adhocForm === 'object') {
      userStore.updateAdhoc(adhocForm.id, payload);
      adhocForm = null;
    }
  }

  function handleDeleteAdhoc(id: string) {
    userStore.deleteAdhoc(id);
    // Detail view was open on this beer; close it since the beer no longer exists.
    if (selectedBeerId === id) selectedBeerId = null;
  }

  async function handleExport() {
    // We need the dataset to look up source-beer fields for non-ad-hoc
    // entries. The button is only reachable once the drawer is open, which
    // is only reachable once the dataset has loaded — but awaiting the
    // promise here is the cleanest way to type-narrow.
    const dataset = await loadPromise;
    const csv = serializeExport({
      datasetBeers: dataset.beers,
      userData: userStore.all,
    });
    const filename = buildExportFilename(dataset.id);
    triggerDownload(csv, filename);
  }

  async function handleImportFile(file: File) {
    const dataset = await loadPromise;
    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      importStatus = `Couldn't read the file: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }
    let result: ImportResult;
    try {
      result = parseImport({ csvText: text, datasetBeers: dataset.beers });
    } catch (err) {
      importStatus = `Import failed: ${err instanceof Error ? err.message : String(err)}`;
      return;
    }

    if (result.applied === 0 && result.droppedUnknownId === 0 && result.droppedInvalid === 0) {
      importStatus = 'The file was empty — nothing to import.';
      return;
    }

    const entryWord = result.applied === 1 ? 'entry' : 'entries';
    const droppedParts: string[] = [];
    if (result.droppedUnknownId > 0) {
      const r = result.droppedUnknownId;
      droppedParts.push(
        `${r} row${r === 1 ? '' : 's'} will be dropped (beer not in current dataset)`,
      );
    }
    if (result.droppedInvalid > 0) {
      const r = result.droppedInvalid;
      droppedParts.push(`${r} row${r === 1 ? '' : 's'} will be dropped (invalid)`);
    }
    const droppedNote = droppedParts.length > 0 ? `\n\n${droppedParts.join('; ')}.` : '';
    const ok = await dialogs.confirm({
      title: `Replace all your data with ${result.applied} ${entryWord}?`,
      message:
        `Importing wipes everything you've flagged, rated, or noted so far.` +
        ` This can't be undone.${droppedNote}`,
      confirmLabel: 'Replace',
      danger: true,
    });
    if (!ok) {
      importStatus = 'Import cancelled.';
      return;
    }

    userStore.replaceData(result.userData);
    // Close any open detail view in case it pointed at a beer that no
    // longer has state.
    selectedBeerId = null;

    const parts: string[] = [`Imported ${result.applied}.`];
    if (result.droppedUnknownId > 0) {
      parts.push(`${result.droppedUnknownId} dropped (unknown beer).`);
    }
    if (result.droppedInvalid > 0) {
      parts.push(`${result.droppedInvalid} dropped (invalid).`);
    }
    importStatus = parts.join(' ');
  }

  /**
   * Trigger a browser download of a text blob. Uses the standard
   * createObjectURL + anchor.click trick.
   */
  function triggerDownload(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so iOS Safari has a chance to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function openSettings() {
    settingsOpen = true;
    importStatus = null; // fresh open = fresh status line
  }
</script>

<header class="app-header">
  <div class="header-row">
    <h1>TapList</h1>
    <div class="header-actions">
      <button
        type="button"
        class="header-btn"
        aria-label="Add a beer"
        title="Add a beer"
        onclick={openCreateAdhoc}
      >
        <span aria-hidden="true">＋</span>
      </button>
      <button
        type="button"
        class="header-btn"
        aria-label="Settings"
        title="Settings"
        onclick={openSettings}
      >
        <span aria-hidden="true">⚙</span>
      </button>
    </div>
  </div>
  {#await loadPromise then dataset}
    {#if dataset.festival}
      <p class="subtitle">{dataset.festival}</p>
    {/if}
    <FreshnessIndicator updatedAt={dataset.updatedAt} />
  {/await}
</header>

<main>
  {#await loadPromise}
    <!--
      Visual skeleton while we wait. The screen-reader announcement is on a
      separate sr-only node so the placeholder cards stay cosmetic — assistive
      tech hears "Loading…" once, not "card card card."
    -->
    <p class="sr-only" role="status" aria-live="polite">Loading the beer list…</p>
    <LoadingSkeleton />
  {:then dataset}
    <BeerList
      beers={dataset.beers}
      store={userStore}
      showNotPresent={settingsStore.showNotPresent}
      onSelect={(id) => (selectedBeerId = id)}
    />
    {#if selectedBeerId}
      {@const beer = findBeer(dataset, selectedBeerId)}
      {#if beer}
        <BeerDetail
          {beer}
          store={userStore}
          onClose={() => (selectedBeerId = null)}
          onEditAdhoc={openEditAdhoc}
          onDeleteAdhoc={handleDeleteAdhoc}
        />
      {/if}
    {/if}
  {:catch error}
    <div class="status error" role="alert">
      <h2>Couldn't load the beer list</h2>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <p>
        The first time you open TapList, you need to be online so we can fetch the dataset. After
        that, it'll work offline.
      </p>
      <button type="button" onclick={retry}>Retry</button>
    </div>
  {/await}
</main>

<PwaBanner {pwa} />

<!--
  Confirm-dialog host. Reads from the dialogs singleton and renders the
  modal whenever something has called `dialogs.confirm(...)`. Lives at the
  app root so it's always available and stacks above other modals.
-->
<ConfirmDialog />

{#if settingsOpen}
  <SettingsDrawer
    showNotPresent={settingsStore.showNotPresent}
    theme={settingsStore.theme}
    {importStatus}
    onClose={() => (settingsOpen = false)}
    onToggleShowNotPresent={(next) => settingsStore.setShowNotPresent(next)}
    onSetTheme={(next) => settingsStore.setTheme(next)}
    onExport={handleExport}
    onImportFile={handleImportFile}
  />
{/if}

{#if adhocForm !== null}
  <AdhocBeerForm
    initial={adhocForm === 'create' ? null : adhocForm.payload}
    onClose={() => (adhocForm = null)}
    onSubmit={handleAdhocSubmit}
  />
{/if}

<style>
  .app-header {
    text-align: center;
    padding: 0.75rem 0.75rem 0.5rem;
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
  }
  .header-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 720px;
    margin: 0 auto;
  }
  h1 {
    margin: 0;
    font-size: 1.5rem;
    letter-spacing: -0.01em;
    flex: 1;
    text-align: left;
  }
  .header-actions {
    display: flex;
    gap: 0.35rem;
  }
  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    font-size: 1.35rem;
    line-height: 1;
    color: var(--color-text);
    cursor: pointer;
  }
  @media (hover: hover) {
    .header-btn:hover {
      background: var(--color-accent-bg);
    }
  }
  .header-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 1px;
  }

  .subtitle {
    margin: 0.15rem 0 0.25rem;
    color: var(--color-text-muted);
    font-size: 0.95rem;
  }

  .status {
    text-align: center;
    padding: 2rem 1rem;
    color: var(--color-text-muted);
  }
  .status.error {
    max-width: 480px;
    margin: 0 auto;
    color: var(--color-text);
  }
  .status.error h2 {
    margin-top: 0;
  }
  .status.error button {
    margin-top: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius);
    border: 1px solid var(--color-accent);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-size: 1rem;
  }
</style>
