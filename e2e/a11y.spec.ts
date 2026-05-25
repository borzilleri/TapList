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
