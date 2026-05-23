<script lang="ts" module>
  /** Minimal Intl.RelativeTimeFormat-backed relative label. */
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  export function formatRelative(deltaMs: number): string {
    const seconds = Math.round(deltaMs / 1000);
    if (Math.abs(seconds) < 60) return rtf.format(-seconds, 'second');
    const minutes = Math.round(seconds / 60);
    if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
    const hours = Math.round(minutes / 60);
    if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
    const days = Math.round(hours / 24);
    return rtf.format(-days, 'day');
  }
</script>

<script lang="ts">
  interface Props {
    updatedAt: string | null;
  }

  const { updatedAt }: Props = $props();

  // Re-evaluate every minute so the relative label stays current while the tab is open.
  let now = $state(Date.now());
  $effect(() => {
    const handle = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(handle);
  });

  const label = $derived.by(() => {
    if (!updatedAt) return null;
    const t = Date.parse(updatedAt);
    if (Number.isNaN(t)) return null;
    const deltaMs = now - t;
    return formatRelative(deltaMs);
  });
</script>

{#if label}
  <p class="freshness" title={updatedAt!}>updated {label}</p>
{/if}

<style>
  .freshness {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin: 0;
    text-align: center;
  }
</style>
