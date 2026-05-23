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

- Node.js 18.18+ (20.x LTS recommended)
- npm 9+

### Setup

```sh
npm install
```

### Common commands

| Command              | What it does                                       |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server with HMR                 |
| `npm run build`      | Type-check then produce a production bundle (dist) |
| `npm run preview`    | Serve the production bundle locally                |
| `npm test`           | Run the Vitest suite once                          |
| `npm run test:watch` | Watch-mode tests                                   |
| `npm run check`      | Run `svelte-check` (TS + Svelte type checking)     |
| `npm run lint`       | ESLint + Prettier check                            |
| `npm run format`     | Auto-format with Prettier                          |

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
`.github/workflows/deploy.yml`. The deploy uses `VITE_BASE_PATH` so assets
resolve correctly under the project's GitHub Pages path
(`https://<user>.github.io/<repo>/`). A custom domain can be added later
by reconfiguring GitHub Pages and removing the base-path override.

## Documentation

- [Overview](docs/overview.md) — why this exists and who it's for
- [Specification](docs/spec.md) — what the app does
- [Data model](docs/data-model.md) — catalog, dataset, user data, and CSV format
