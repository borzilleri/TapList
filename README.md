[![CI](https://github.com/borzilleri/TapList/actions/workflows/ci.yml/badge.svg)](https://github.com/borzilleri/TapList/actions/workflows/ci.yml)

# TapList

The unofficial guide for the Washington Brewers Festival.

TapList is an installable, offline-first web app for navigating a beer festival on your phone. Flag beers to try, rate the ones you've sampled, jot down quick notes, and patch the list when reality doesn't match the published spreadsheet.

## Features

- Flag beers you want to try
- Mark beers as tried, with an optional Liked / Disliked opinion
- Add short notes to any beer
- Mark beers as not-present, or add ad-hoc beers when the published list is wrong
- Works fully offline once loaded
- Export and import your data as CSV — plan on a laptop, take it to the fest on your phone

## Development

### Prerequisites

- Node.js — version pinned in [`.nvmrc`](.nvmrc). Run `nvm install && nvm use` to match.
- npm (ships with Node)

### Setup

```sh
npm install
```

### Common commands

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server with HMR                                    |
| `npm run build`      | Type-check then produce a production bundle (dist)                    |
| `npm run preview`    | Serve the production bundle locally                                   |
| `npm test`           | Run the Vitest suite once                                             |
| `npm run test:watch` | Watch-mode tests                                                      |
| `npm run test:e2e`   | Run the Playwright a11y/interaction suite against a running `preview` |
| `npm run check`      | Run `svelte-check` (TS + Svelte type checking)                        |
| `npm run lint`       | ESLint + Prettier check                                               |
| `npm run format`     | Auto-format with Prettier                                             |

The e2e suite expects `npm run preview` to be running on port 4173. First run on a new machine also needs `npx playwright install chromium` to download the headless browser.

### Lighthouse audit

Not on a fixed cadence, but worth re-running before significant releases. With the preview server up on port 4173:

```sh
CHROME_PATH="/Users/<you>/Library/Caches/ms-playwright/chromium-1223/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  npx lighthouse http://localhost:4173/ \
  --quiet --output=html --output-path=./lighthouse-report.html \
  --form-factor=mobile \
  --only-categories=performance,accessibility,best-practices,seo
```

Last known baseline (post slice 6c): Performance 99, Accessibility 100, Best-practices 100, SEO 100.

### Project structure

```
beerfest/
├── docs/                 # spec, data model, overview
├── public/
│   └── data/             # bundled catalog + festival datasets (mock for dev)
├── src/
│   ├── lib/              # types, data fetch/validation, list pipeline
│   └── components/       # Svelte components
└── .github/workflows/    # CI + GitHub Pages deploy
```

The dataset layer follows the catalog → dataset two-step described in
[`docs/data-model.md`](docs/data-model.md). The active dataset for dev is the
clearly-labeled mock data at `public/data/taplist-mock-2026.json`.

## Deployment

The production site is served from the custom domain
[`taplist.rampant.io`](https://taplist.rampant.io/) via GitHub Pages.
Deploys are decoupled from pushes to `main` — they only fire when a
GitHub Release is published (or on manual dispatch from the Actions UI).

### Cutting a release

Run the release script from `main` with a clean working tree:

```sh
npm run release -- patch          # 1.0.0 → 1.0.1
npm run release -- minor          # 1.0.1 → 1.1.0
npm run release -- major          # 1.1.0 → 2.0.0
npm run release -- 1.0.0          # explicit; useful for the first release
npm run release -- prerelease     # e.g. 1.0.0 → 1.0.0-0 (won't auto-deploy)
```

The script:

1. Verifies the working tree is clean, you're on `main`, and `main` is in
   sync with `origin/main`.
2. Runs lint, the full test suite, and a production build as quality gates.
3. Runs `npm version <bump>`, which writes the new version to
   `package.json`, commits it, and creates a `v<version>` git tag.
4. Pushes the commit and tag to `origin/main`.
5. Calls `gh release create` to publish a GitHub Release, with notes
   auto-generated from PR titles since the previous tag. Prerelease
   versions (any tag containing a `-`, per semver) get the `--prerelease`
   flag automatically.

Publishing the release fires
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which
checks out the tagged commit, builds, and ships to GitHub Pages.
Prereleases are skipped — they exist for testing, not production.

The `public/CNAME` file keeps the custom domain wired across deploys.
`vite.config.ts` still respects `VITE_BASE_PATH` if a project-path
fallback deploy ever becomes useful.

### Rolling back or deploying a specific tag

The deploy workflow accepts a manual dispatch with an optional tag input.
From the GitHub Actions UI:

1. Actions → Deploy to GitHub Pages → **Run workflow**.
2. Enter the tag to deploy (e.g. `v1.0.0`), or leave it blank to deploy
   the current `main` branch (useful as a hotfix escape hatch).
3. Click **Run workflow**. The build job checks out that ref, rebuilds,
   and redeploys.

Redeploying an existing tag is idempotent — the artifact is byte-identical
to what shipped originally. This is the rollback path.

## Documentation

- [Overview](docs/overview.md) — why this exists and who it's for
- [Specification](docs/spec.md) — what the app does
- [Data model](docs/data-model.md) — catalog, dataset, user data, and CSV format
- [Code architecture](docs/architecture.md) — module layout, conventions, change recipes
