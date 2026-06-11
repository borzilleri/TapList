/**
 * One-time / re-runnable categorizer: assigns a normalized `styleCategory` to
 * every beer in a dataset JSON from its messy free-form `style`.
 *
 * Usage:
 *   npx tsx scripts/categorize-styles.ts public/data/wbf-2026.json [more.json ...]
 *
 * The rules are an ordered keyword match (first match wins) against the
 * lowercased raw `style`, falling back to the `name` when `style` carries no
 * signal. A handful of rows neither can resolve are pinned in OVERRIDES by
 * beer id, so re-runs stay idempotent. Anything unmatched falls to 'Other'.
 *
 * The script rewrites each beer object with `styleCategory` inserted right
 * after `style` (or appended when there is no `style`), preserving all other
 * fields and their order, and writes the file back with 2-space indentation.
 *
 * Style normalization lives here (build/author time), not at runtime — the
 * value is baked into the committed dataset. See public/data/wbf-2026.NOTES.md.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { STYLE_CATEGORIES, type StyleCategory } from '../src/lib/types';

/** Ordered keyword rules. First rule whose any-keyword is a substring wins. */
const RULES: Array<{ category: StyleCategory; keywords: string[] }> = [
  { category: 'Cider', keywords: ['cider', 'perry'] },
  {
    category: 'Wine & Mead',
    keywords: [
      'mead',
      'wine grape',
      'orange wine',
      'carmenere',
      'sangiovese',
      'riesling',
      'gewürz',
      'gewurz',
      'merlot',
      'cabernet',
      'chardonnay',
      'pinot',
      'syrah',
    ],
  },
  {
    category: 'Other',
    keywords: ['seltzer', 'kombucha', 'tepache', 'shandy'],
  },
  {
    category: 'Sour & Gose',
    keywords: [
      'sour',
      'gose',
      'berliner',
      'smoothie',
      'wild',
      'mixed culture',
      'lambic',
      'brett',
      'funk',
      'spontaneous',
    ],
  },
  { category: 'Saison & Farmhouse', keywords: ['saison', 'farmhouse', 'foeder'] },
  { category: 'Wheat', keywords: ['hefe', 'weizen', 'weiss', 'witbier', 'wheat'] },
  { category: 'Stout & Porter', keywords: ['stout', 'porter'] },
  { category: 'IPA', keywords: ['ipa', 'i.p.a', 'xpa', 'india pale'] },
  // Lager before Pale so "Czech Pale Lager" / "WC Pils" land in Lager, not Pale.
  {
    category: 'Lager & Pilsner',
    keywords: [
      'lager',
      'pilsner',
      'pils',
      'helles',
      'dortmunder',
      'keller',
      'märzen',
      'marzen',
      'rauch',
      'bock',
      'dunkel',
      'schwarz',
      'czech',
    ],
  },
  { category: 'Pale Ale', keywords: ['pale'] },
  {
    category: 'Belgian & Strong',
    keywords: [
      'belgian',
      'tripel',
      'dubbel',
      'quad',
      'golden strong',
      'barleywine',
      'strong ale',
      'barrel',
    ],
  },
  {
    category: 'Blonde, Kölsch & Cream',
    keywords: ['blonde', 'kölsch', 'kolsch', 'cream ale', 'golden ale'],
  },
  {
    category: 'Amber, Brown & Dark',
    keywords: ['amber', 'brown', 'scottish', 'scotch', 'dark ale', 'rye ale', 'esb', 'bitter'],
  },
];

/** Per-id pins for rows neither the style nor the name can resolve correctly. */
const OVERRIDES: Record<string, StyleCategory> = {
  'wbf26-0128': 'Cider', // "(off-dry)"   — Offset Ciderworks
  'wbf26-0129': 'Cider', // "(semi-sweet)" — Offset Ciderworks
  'wbf26-0217': 'Cider', // "Dry Apple"   — Offset Ciderworks
  'wbf26-0199': 'Saison & Farmhouse', // "Wine Grape Mixed Ferm" but a wild ale re-fermented on grapes
  'wbf26-0009': 'Lager & Pilsner', // "Heidelberg" — no style; desc is a crisp NW pilsner-malt lager
  'wbf26-0076': 'Blonde, Kölsch & Cream', // "Gusto Crema Coffee Ale" — no style; desc says "cream ale"
};

/** First rule whose any-keyword is a substring of `text`, or null if none match. */
function matchRules(text: unknown): StyleCategory | null {
  if (typeof text !== 'string' || text.trim().length === 0) return null;
  const s = text.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => s.includes(kw))) return rule.category;
  }
  return null;
}

/**
 * Non-alcoholic detection, which wins over the style buckets: a beer is NA if
 * its ABV is an explicit 0, or its `style`/`name` flags it — `N/A`, an `NA `
 * prefix, `non-alc(oholic)`, or an inherently alcohol-free drink (hop water,
 * soda). Hard seltzer/kombucha/tepache are NOT here — they carry alcohol.
 */
function isNonAlcoholic(abv: unknown, style: unknown, name: unknown): boolean {
  if (abv === 0) return true;
  for (const text of [style, name]) {
    if (typeof text !== 'string') continue;
    const s = text.toLowerCase();
    if (
      s.includes('n/a') ||
      s.includes('non-alc') ||
      s.includes('non alc') ||
      s.includes('nonalc') ||
      s.includes('alcohol-free') ||
      s.includes('alcohol free') ||
      s.includes('hop water') ||
      s.includes('hop2o') ||
      s.includes('spah2o') ||
      s.includes('soda') ||
      s === 'na' ||
      s.startsWith('na ')
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Categorize from the `style` field; when it carries no signal at all (missing,
 * empty, or an unrecognized label like "Fruit Ale"), fall back to the beer's
 * `name`, which is concise and intentional — e.g. "Juniorzafa IPA" or "360
 * Blonde Ale". Descriptions are deliberately NOT consulted: they're prose and
 * keywords like "barrel" or "lager finish" produce false hits.
 */
function categorize(id: string, rawStyle: unknown, name: unknown, abv: unknown): StyleCategory {
  if (OVERRIDES[id]) return OVERRIDES[id];
  if (isNonAlcoholic(abv, rawStyle, name)) return 'NA';
  return matchRules(rawStyle) ?? matchRules(name) ?? 'Other';
}

/** Rebuild a beer object inserting styleCategory after `style` (or at the end). */
function withCategory(
  beer: Record<string, unknown>,
  category: StyleCategory,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  let inserted = false;
  for (const [key, value] of Object.entries(beer)) {
    if (key === 'styleCategory') continue; // drop any stale value; we re-add it
    out[key] = value;
    if (key === 'style') {
      out.styleCategory = category;
      inserted = true;
    }
  }
  if (!inserted) out.styleCategory = category;
  return out;
}

function processFile(path: string): void {
  const data = JSON.parse(readFileSync(path, 'utf8')) as { beers?: Array<Record<string, unknown>> };
  if (!Array.isArray(data.beers)) {
    console.error(`Skipping ${path}: no beers array`);
    return;
  }
  const tally = new Map<StyleCategory, number>(STYLE_CATEGORIES.map((c) => [c, 0]));
  data.beers = data.beers.map((beer) => {
    const category = categorize(String(beer.id), beer.style, beer.name, beer.abv);
    tally.set(category, (tally.get(category) ?? 0) + 1);
    return withCategory(beer, category);
  });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  console.log(`\n${path} — ${data.beers.length} beers:`);
  for (const cat of STYLE_CATEGORIES) {
    const n = tally.get(cat) ?? 0;
    if (n > 0) console.log(`  ${String(n).padStart(4)}  ${cat}`);
  }
}

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: npx tsx scripts/categorize-styles.ts <dataset.json> [...]');
  process.exit(1);
}
for (const f of files) processFile(f);
