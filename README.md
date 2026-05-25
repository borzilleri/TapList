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

Pushes to `main` automatically build and deploy to GitHub Pages via
`.github/workflows/deploy.yml`. The production site is served from the
custom domain [`taplist.rampant.io`](https://taplist.rampant.io/) — the
`public/CNAME` file keeps that wired up across workflow-based deploys.
`vite.config.ts` still respects `VITE_BASE_PATH` if a project-path fallback
deploy ever becomes useful.

## Documentation

- [Overview](docs/overview.md) — why this exists and who it's for
- [Specification](docs/spec.md) — what the app does
- [Data model](docs/data-model.md) — catalog, dataset, user data, and CSV format
- [Code architecture](docs/architecture.md) — module layout, conventions, change recipes
