/**
 * Headless a11y smoke tests.
 *
 * Run via `npm run test:e2e`. The script starts a Vite preview server
 * (or expects one running on PORT=4173), drives the page with playwright,
 * and asserts focus-management behavior on each of the three modals.
 *
 * Kept separate from the unit-test suite so Vitest stays fast and
 * Node-only. These spin up a real browser and take a few seconds.
 */

import { chromium, type Browser, type Page } from 'playwright';

const BASE_URL = process.env.E2E_URL || 'http://localhost:4173';

async function launchBrowser(): Promise<Browser> {
  // Default to playwright's bundled chromium; it's installed via
  // `npx playwright install chromium` (CI does this automatically).
  return chromium.launch({ headless: true });
}

interface TestCase {
  name: string;
  run: (page: Page) => Promise<void>;
}

const tests: TestCase[] = [
  {
    name: 'Settings drawer: focus traps and returns to opener',
    async run(page) {
      const gear = page.locator('button[aria-label="Settings"]');
      await gear.focus();
      await gear.click();

      // Focus should move into the drawer's close button (first focusable).
      await page.waitForTimeout(50);
      const inDrawer = await page.evaluate(() => {
        const active = document.activeElement;
        const drawer = document.querySelector('[aria-labelledby="settings-title"]');
        return drawer?.contains(active) ?? false;
      });
      assert(inDrawer, 'Focus should be inside the settings drawer after open');

      // Press Escape; focus should return to the gear button.
      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      const restored = await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') === 'Settings',
      );
      assert(restored, 'Focus should return to the Settings button after close');
    },
  },
  {
    name: 'Settings drawer: Tab cycles within the trap',
    async run(page) {
      await page.locator('button[aria-label="Settings"]').click();
      await page.waitForTimeout(50);
      // Tab a few times; focused element should stay within the drawer.
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab');
        const inDrawer = await page.evaluate(() => {
          const drawer = document.querySelector('[aria-labelledby="settings-title"]');
          return drawer?.contains(document.activeElement) ?? false;
        });
        assert(inDrawer, `Tab #${i + 1} escaped the drawer`);
      }
      // Clean up so subsequent tests start from a closed drawer.
      await page.keyboard.press('Escape');
    },
  },
  {
    name: 'Beer detail: focus traps and returns to opener',
    async run(page) {
      // First row is a button; clicking it opens the detail view.
      const firstRow = page.locator('article.row button.main').first();
      await firstRow.focus();
      await firstRow.click();
      await page.waitForTimeout(50);

      const inDetail = await page.evaluate(() => {
        const active = document.activeElement;
        const detail = document.querySelector('[aria-labelledby="detail-title"]');
        return detail?.contains(active) ?? false;
      });
      assert(inDetail, 'Focus should move into the beer detail dialog');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      const restored = await page.evaluate(() => {
        const active = document.activeElement;
        return active instanceof HTMLElement && active.classList.contains('main');
      });
      assert(restored, 'Focus should return to the row main button');
    },
  },
  {
    name: 'Settings drawer: locks body scroll while open',
    async run(page) {
      // Make the body tall enough to actually have a scroll range so the
      // "scroll didn't change" assertion is meaningful (the lock pins scroll
      // at whatever value it was when the modal opened; we just need to
      // verify that an attempted scroll AFTER the lock is no-op'd).
      await page.evaluate(() => {
        document.body.style.minHeight = '3000px';
      });
      await page.locator('button[aria-label="Settings"]').click();
      await page.waitForTimeout(50);

      const before = await page.evaluate(() => window.scrollY);
      await page.evaluate(() => window.scrollBy(0, 800));
      const after = await page.evaluate(() => window.scrollY);
      assert(
        before === after,
        `Body scroll should be locked while modal open, but moved ${before}→${after}`,
      );

      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      await page.evaluate(() => {
        document.body.style.minHeight = '';
      });
    },
  },
  // The dialog tests reach the dialogs singleton through `window.__taplistDialogs`,
  // which is exposed by src/lib/dialogs.svelte.ts as an e2e/debug hook.
  {
    name: 'Confirm dialog: resolves true on Confirm click',
    async run(page) {
      const result = await page.evaluate(async () => {
        const d = (
          window as unknown as { __taplistDialogs: { confirm: (o: object) => Promise<boolean> } }
        ).__taplistDialogs;
        const p = d.confirm({ title: 'Smoke test' });
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        document
          .querySelector<HTMLButtonElement>('[aria-labelledby="confirm-title"] .confirm')
          ?.click();
        return await p;
      });
      assert(result === true, `Expected dialog to resolve true on Confirm click, got ${result}`);
    },
  },
  {
    name: 'Confirm dialog: Escape resolves false',
    async run(page) {
      await page.evaluate(() => {
        const d = (
          window as unknown as { __taplistDialogs: { confirm: (o: object) => Promise<boolean> } }
        ).__taplistDialogs;
        (window as unknown as { __pending: Promise<boolean> }).__pending = d.confirm({
          title: 'Escape test',
        });
      });
      await page.waitForSelector('[aria-labelledby="confirm-title"]', { timeout: 1000 });
      await page.keyboard.press('Escape');
      const result = await page.evaluate(
        () => (window as unknown as { __pending: Promise<boolean> }).__pending,
      );
      assert(result === false, `Expected Escape to resolve false, got ${result}`);
    },
  },
  {
    name: 'Confirm dialog: backdrop click resolves false',
    async run(page) {
      await page.evaluate(() => {
        const d = (
          window as unknown as { __taplistDialogs: { confirm: (o: object) => Promise<boolean> } }
        ).__taplistDialogs;
        (window as unknown as { __pending: Promise<boolean> }).__pending = d.confirm({
          title: 'Backdrop test',
        });
      });
      await page.waitForSelector('[aria-labelledby="confirm-title"]', { timeout: 1000 });
      // Click the viewport corner so we land on the backdrop, not the centered panel.
      await page.mouse.click(5, 5);
      const result = await page.evaluate(
        () => (window as unknown as { __pending: Promise<boolean> }).__pending,
      );
      assert(result === false, `Expected backdrop click to resolve false, got ${result}`);
    },
  },
  {
    // Regression guard: Escape on a confirm dialog stacked over the
    // settings drawer must close ONLY the confirm — the drawer
    // underneath stays open. The naive `<svelte:window onkeydown>`
    // pattern in both layers used to close both in one keystroke; the
    // capture-phase listener in ConfirmDialog + stopImmediatePropagation
    // is what fixes it.
    name: 'Confirm dialog: Escape over an open drawer leaves the drawer in place',
    async run(page) {
      // Open the settings drawer the normal way (gear button).
      await page.locator('button[aria-label="Settings"]').click();
      await page.waitForSelector('[aria-labelledby="settings-title"]', { timeout: 1000 });
      // Stack a confirm dialog on top via the same back door the other tests use.
      await page.evaluate(() => {
        const d = (
          window as unknown as { __taplistDialogs: { confirm: (o: object) => Promise<boolean> } }
        ).__taplistDialogs;
        (window as unknown as { __pending: Promise<boolean> }).__pending = d.confirm({
          title: 'Stacked test',
        });
      });
      await page.waitForSelector('[aria-labelledby="confirm-title"]', { timeout: 1000 });
      await page.keyboard.press('Escape');
      // Give Svelte a tick to unmount the confirm.
      await page.waitForTimeout(50);
      // Confirm dialog should be gone…
      const confirmGone = (await page.locator('[aria-labelledby="confirm-title"]').count()) === 0;
      assert(confirmGone, 'Expected the confirm dialog to close after Escape');
      // …and the drawer should still be there.
      const drawerStillOpen =
        (await page.locator('[aria-labelledby="settings-title"]').count()) === 1;
      assert(drawerStillOpen, 'Expected the settings drawer to stay open');
      const result = await page.evaluate(
        () => (window as unknown as { __pending: Promise<boolean> }).__pending,
      );
      assert(result === false, `Expected confirm to resolve false on Escape, got ${result}`);
      // Cleanup for subsequent tests.
      await page.keyboard.press('Escape');
    },
  },
  {
    name: 'Empty state: filter-aware copy and Clear-search recovery',
    async run(page) {
      // Search-with-no-matches: the title should reference the query.
      await page.locator('input[type="search"]').fill('definitely-no-such-beer-xyz');
      await page.waitForTimeout(50);
      const noMatchTitle = await page.locator('.empty-title').textContent();
      assert(
        noMatchTitle?.includes('definitely-no-such-beer-xyz'),
        `Expected empty-state title to quote the search term, got ${JSON.stringify(noMatchTitle)}`,
      );
      // The Clear search button should reset the search and show rows again.
      await page.locator('.empty-action').click();
      await page.waitForTimeout(50);
      const visibleAfterClear = await page.locator('article.row').count();
      assert(
        visibleAfterClear > 0,
        `Expected rows to be visible after clearing search, got ${visibleAfterClear}`,
      );

      // Now: filter='toTry' with no flagged beers → encouraging copy, no button.
      const toTryChip = page.locator('label.chip:has(input[value="toTry"])');
      await toTryChip.click();
      await page.waitForTimeout(50);
      const toTryTitle = await page.locator('.empty-title').textContent();
      assert(
        toTryTitle?.toLowerCase().includes('to-try'),
        `Expected to-try empty-state title, got ${JSON.stringify(toTryTitle)}`,
      );
      const buttonCount = await page.locator('.empty-action').count();
      assert(
        buttonCount === 0,
        `Expected no Clear button on the to-try empty state, got ${buttonCount}`,
      );

      // Reset the filter for subsequent tests.
      await page.locator('label.chip:has(input[value="all"])').click();
    },
  },
  {
    name: 'Ad-hoc form: focus traps and returns to opener',
    async run(page) {
      const addBtn = page.locator('button[aria-label="Add a beer"]');
      await addBtn.focus();
      await addBtn.click();
      await page.waitForTimeout(50);

      const inForm = await page.evaluate(() => {
        const active = document.activeElement;
        const form = document.querySelector('[aria-labelledby="adhoc-title"]');
        return form?.contains(active) ?? false;
      });
      assert(inForm, 'Focus should move into the ad-hoc form');

      await page.keyboard.press('Escape');
      await page.waitForTimeout(50);
      const restored = await page.evaluate(
        () => document.activeElement?.getAttribute('aria-label') === 'Add a beer',
      );
      assert(restored, 'Focus should return to the Add-a-beer button');
    },
  },
];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const browser = await launchBrowser();
  let failed = 0;
  for (const test of tests) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    try {
      await page.goto(BASE_URL);
      await page.waitForSelector('article.row', { timeout: 10_000 });
      await test.run(page);
      console.log(`  ✓ ${test.name}`);
    } catch (err) {
      failed++;
      console.error(`  ✗ ${test.name}`);
      console.error(`    ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      await page.close();
    }
  }
  await browser.close();
  if (failed > 0) {
    console.error(`\n${failed} of ${tests.length} a11y test(s) failed`);
    process.exit(1);
  }
  console.log(`\nAll ${tests.length} a11y tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
