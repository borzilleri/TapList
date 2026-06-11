/**
 * Tests for the export/import transfer layer.
 */

import { describe, expect, it } from 'vitest';
import {
  buildExportCsv,
  buildExportFilename,
  parseBool,
  parseImport,
  parseOpinion,
  serializeExport,
} from './transfer';
import type { Beer, BeerUserState, UserData } from './types';

function beer(overrides: Partial<Beer> = {}): Beer {
  return {
    id: 'id',
    name: 'Name',
    brewery: 'Brewery',
    abv: 5.0,
    style: 'IPA',
    location: 'Booth 1',
    description: null,
    ...overrides,
  };
}

function userData(states: Record<string, Partial<BeerUserState>> = {}): UserData {
  const beers: Record<string, BeerUserState> = {};
  for (const [id, partial] of Object.entries(states)) {
    beers[id] = {
      status: null,
      opinion: null,
      notes: '',
      location: '',
      notPresent: false,
      ...partial,
    };
  }
  return { version: 1, beers };
}

// --- Export ------------------------------------------------------------------

describe('buildExportCsv', () => {
  it('writes the documented header order', () => {
    const csv = buildExportCsv({ datasetBeers: [], userData: userData() });
    expect(csv.headers).toEqual([
      'id',
      'name',
      'brewery',
      'abv',
      'style',
      'location',
      'description',
      'to_try',
      'tried',
      'opinion',
      'notes',
      'user_location',
      'not_present',
      'is_adhoc',
    ]);
    expect(csv.rows).toEqual([]);
  });

  it('exports only touched beers', () => {
    const datasetBeers = [beer({ id: 'a' }), beer({ id: 'b' }), beer({ id: 'c' })];
    const data = userData({
      a: { status: 'toTry' },
      // b is untouched — should not appear
      c: { notes: 'remember this' },
    });
    const csv = buildExportCsv({ datasetBeers, userData: data });
    expect(csv.rows.map((r) => r.id).sort()).toEqual(['a', 'c']);
  });

  it('joins user state with dataset source-beer fields for non-ad-hoc rows', () => {
    const datasetBeers = [
      beer({ id: 'b1', name: 'Sunbreak', brewery: 'Fremont', abv: 5.2, style: 'Pilsner' }),
    ];
    const data = userData({
      b1: { status: 'tried', opinion: 'liked', notes: 'crisp' },
    });
    const [row] = buildExportCsv({ datasetBeers, userData: data }).rows;
    expect(row).toMatchObject({
      id: 'b1',
      name: 'Sunbreak',
      brewery: 'Fremont',
      abv: '5.2',
      style: 'Pilsner',
      to_try: 'false',
      tried: 'true',
      opinion: 'liked',
      notes: 'crisp',
      not_present: 'false',
      is_adhoc: 'false',
    });
  });

  it('exports the custom location in the user_location column', () => {
    const datasetBeers = [beer({ id: 'b1', location: 'Booth 1' })];
    const data = userData({ b1: { location: 'North Tent, Booth 42' } });
    const [row] = buildExportCsv({ datasetBeers, userData: data }).rows;
    // The source `location` column keeps the dataset value; the override
    // travels in its own column.
    expect(row.location).toBe('Booth 1');
    expect(row.user_location).toBe('North Tent, Booth 42');
  });

  it('uses the ad-hoc payload as source-beer fields for ad-hoc rows', () => {
    const data = userData({
      'adhoc-1': {
        status: 'tried',
        opinion: 'liked',
        adhoc: { name: 'Mystery', brewery: 'Backstage', abv: 4.5, style: 'Sour' },
      },
    });
    const [row] = buildExportCsv({ datasetBeers: [], userData: data }).rows;
    expect(row).toMatchObject({
      id: 'adhoc-1',
      name: 'Mystery',
      brewery: 'Backstage',
      abv: '4.5',
      style: 'Sour',
      is_adhoc: 'true',
    });
  });

  it('renders missing optional fields as empty strings', () => {
    const datasetBeers = [
      beer({ id: 'b1', name: 'X', brewery: 'Y', abv: null, style: null, location: null }),
    ];
    const data = userData({ b1: { status: 'toTry' } });
    const [row] = buildExportCsv({ datasetBeers, userData: data }).rows;
    expect(row.abv).toBe('');
    expect(row.style).toBe('');
    expect(row.location).toBe('');
    expect(row.description).toBe('');
  });

  it('skips orphaned non-ad-hoc entries (id not in current dataset)', () => {
    const data = userData({ 'wbf26-9999': { status: 'tried' } });
    const csv = buildExportCsv({ datasetBeers: [], userData: data });
    expect(csv.rows).toEqual([]);
  });
});

describe('serializeExport', () => {
  it('produces RFC 4180 CSV with the header row first', () => {
    const csv = serializeExport({ datasetBeers: [], userData: userData() });
    expect(csv.startsWith('id,name,brewery,')).toBe(true);
  });

  it('quotes notes containing commas/newlines', () => {
    const datasetBeers = [beer({ id: 'b1', name: 'X', brewery: 'Y' })];
    const data = userData({ b1: { notes: 'piney, citrusy\ngreat finish' } });
    const csv = serializeExport({ datasetBeers, userData: data });
    expect(csv).toContain('"piney, citrusy\ngreat finish"');
  });
});

describe('buildExportFilename', () => {
  it('produces the documented format', () => {
    const filename = buildExportFilename('wbf-2026', new Date(2026, 5, 12, 15, 30, 45));
    expect(filename).toBe('taplist-export-wbf-2026-20260612-153045.csv');
  });

  it('zero-pads single-digit components', () => {
    const filename = buildExportFilename('a', new Date(2026, 0, 1, 1, 1, 1));
    expect(filename).toBe('taplist-export-a-20260101-010101.csv');
  });
});

// --- Lenient field parsers ---------------------------------------------------

describe('parseBool (lenient)', () => {
  for (const truthy of ['true', 'TRUE', 't', ' Yes ', 'y', '1', 'x', '✓', 'X']) {
    it(`treats ${JSON.stringify(truthy)} as true`, () => {
      expect(parseBool(truthy)).toBe(true);
    });
  }
  for (const falsy of ['false', 'no', '0', '', ' ', '-', undefined, 'maybe', 'nope']) {
    it(`treats ${JSON.stringify(falsy)} as false`, () => {
      expect(parseBool(falsy)).toBe(false);
    });
  }
});

describe('parseOpinion (lenient)', () => {
  for (const liked of ['liked', 'LIKED', 'like', 'yes', 'Yes', '+', 'thumbs up', ' Liked ']) {
    it(`treats ${JSON.stringify(liked)} as liked`, () => {
      expect(parseOpinion(liked)).toBe('liked');
    });
  }
  for (const disliked of ['disliked', 'dislike', 'no', 'NO', '-', 'thumbs down']) {
    it(`treats ${JSON.stringify(disliked)} as disliked`, () => {
      expect(parseOpinion(disliked)).toBe('disliked');
    });
  }
  for (const none of ['', 'maybe', undefined, 'meh']) {
    it(`treats ${JSON.stringify(none)} as null`, () => {
      expect(parseOpinion(none)).toBeNull();
    });
  }
});

// --- Import ------------------------------------------------------------------

describe('parseImport', () => {
  const datasetBeers = [
    beer({ id: 'wbf26-0001', name: 'Sunbreak', brewery: 'Fremont' }),
    beer({ id: 'wbf26-0002', name: 'Lush', brewery: 'Fremont' }),
  ];

  function importCsv(text: string) {
    return parseImport({ csvText: text, datasetBeers });
  }

  it('applies status from a single dataset row', () => {
    const result = importCsv('id,is_adhoc,to_try,tried\r\nwbf26-0001,false,true,false\r\n');
    expect(result.applied).toBe(1);
    expect(result.userData.beers['wbf26-0001'].status).toBe('toTry');
  });

  it('collapses to_try+tried with `tried` winning on conflict', () => {
    const result = importCsv('id,is_adhoc,to_try,tried\r\nwbf26-0001,false,true,true\r\n');
    expect(result.userData.beers['wbf26-0001'].status).toBe('tried');
  });

  it('reads opinion + notes + not_present', () => {
    const result = importCsv(
      'id,is_adhoc,tried,opinion,notes,not_present\r\n' +
        'wbf26-0001,false,true,liked,"bright, citrusy",false\r\n',
    );
    const state = result.userData.beers['wbf26-0001'];
    expect(state.opinion).toBe('liked');
    expect(state.notes).toBe('bright, citrusy');
    expect(state.notPresent).toBe(false);
  });

  it('truncates notes >280 chars silently', () => {
    const longNotes = 'a'.repeat(500);
    const result = importCsv(
      `id,is_adhoc,tried,notes\r\nwbf26-0001,false,false,"${longNotes}"\r\n`,
    );
    expect(result.userData.beers['wbf26-0001'].notes.length).toBe(280);
  });

  it('drops non-ad-hoc rows whose id isn’t in the dataset, and counts them', () => {
    const result = importCsv(
      'id,is_adhoc,tried\r\n' + 'wbf26-0001,false,true\r\n' + 'unknown-99,false,true\r\n',
    );
    expect(result.applied).toBe(1);
    expect(result.droppedUnknownId).toBe(1);
    expect(result.userData.beers['unknown-99']).toBeUndefined();
  });

  it('recreates ad-hoc beers with all source-beer fields', () => {
    const result = importCsv(
      'id,name,brewery,abv,style,location,description,is_adhoc,tried\r\n' +
        'adhoc-x,Mystery Sour,Backstage,4.5,Sour,Booth 47,"Funky and briny",true,true\r\n',
    );
    expect(result.applied).toBe(1);
    const state = result.userData.beers['adhoc-x'];
    expect(state.status).toBe('tried');
    expect(state.adhoc).toEqual({
      name: 'Mystery Sour',
      brewery: 'Backstage',
      abv: 4.5,
      style: 'Sour',
      location: 'Booth 47',
      description: 'Funky and briny',
    });
  });

  it('drops ad-hoc rows missing name or brewery', () => {
    const result = importCsv(
      'id,name,brewery,is_adhoc\r\n' + 'adhoc-x,,Backstage,true\r\n' + 'adhoc-y,Mystery,,true\r\n',
    );
    expect(result.applied).toBe(0);
    expect(result.droppedInvalid).toBe(2);
  });

  it('drops rows missing an id entirely', () => {
    const result = importCsv('id,is_adhoc,tried\r\n,false,true\r\n');
    expect(result.droppedInvalid).toBe(1);
  });

  it('propagates a CSV parse error (unclosed quote) to the caller', () => {
    // The handler in App.svelte wraps parseImport in try/catch so the
    // user sees a friendly status line. Verify the throw contract holds
    // — if the underlying CSV is malformed, parseImport must throw
    // rather than returning a partial result.
    expect(() =>
      parseImport({
        csvText: 'id,name\r\nwbf26-0001,"unclosed quote\r\n',
        datasetBeers,
      }),
    ).toThrow(/CSV parse/);
  });

  it('silently skips fully-empty rows (trailing blank lines, commas-only)', () => {
    // A trailing blank line is noise, not bad data — don't pollute the
    // drop count with it.
    const result = importCsv(
      'id,is_adhoc,tried\r\n' + 'wbf26-0001,false,true\r\n' + ',,\r\n' + '\r\n',
    );
    expect(result.applied).toBe(1);
    expect(result.droppedInvalid).toBe(0);
    expect(result.droppedUnknownId).toBe(0);
  });

  it('still counts a row with content but no id as droppedInvalid', () => {
    // Regression guard: an empty `id` cell is still invalid if the row
    // carries other data — only fully-blank rows get skipped silently.
    const result = importCsv('id,tried\r\n,true\r\n');
    expect(result.droppedInvalid).toBe(1);
  });

  it('infers is_adhoc from the id prefix when the column is missing', () => {
    // If the user hand-deletes the is_adhoc column, beers whose id starts
    // with `adhoc-` should still be treated as ad-hoc.
    const result = importCsv('id,name,brewery,tried\r\nadhoc-x,Mystery,Backstage,true\r\n');
    expect(result.applied).toBe(1);
    expect(result.userData.beers['adhoc-x'].adhoc).toBeDefined();
  });

  it('enforces the opinion→tried cascade on import', () => {
    // A CSV with opinion=liked but tried=false violates the invariant
    // opinion != null ⇒ status === 'tried'. The importer promotes
    // status to 'tried' so the in-memory state is one the UI can reach.
    const result = importCsv(
      'id,is_adhoc,to_try,tried,opinion\r\n' + 'wbf26-0001,false,false,false,liked\r\n',
    );
    const state = result.userData.beers['wbf26-0001'];
    expect(state.status).toBe('tried');
    expect(state.opinion).toBe('liked');
  });

  it('promotes to-try → tried when opinion is set', () => {
    // Same cascade, but starting from to_try=true instead of all-false.
    const result = importCsv(
      'id,is_adhoc,to_try,tried,opinion\r\n' + 'wbf26-0001,false,true,false,disliked\r\n',
    );
    const state = result.userData.beers['wbf26-0001'];
    expect(state.status).toBe('tried');
    expect(state.opinion).toBe('disliked');
  });

  it('leaves status alone when opinion is empty', () => {
    // Regression guard: the cascade should only fire when opinion is non-null.
    const result = importCsv(
      'id,is_adhoc,to_try,tried,opinion\r\n' + 'wbf26-0001,false,true,false,\r\n',
    );
    expect(result.userData.beers['wbf26-0001'].status).toBe('toTry');
    expect(result.userData.beers['wbf26-0001'].opinion).toBeNull();
  });

  it('drops is_adhoc=true rows whose id collides with a dataset beer', () => {
    // A hand-crafted CSV could try to spoof an ad-hoc payload on a
    // dataset beer's slot. The importer rejects these as invalid
    // rather than overwriting the dataset entry's user state.
    const result = importCsv(
      'id,name,brewery,is_adhoc,tried\r\n' +
        'wbf26-0001,Spoofed Beer,Spoofed Brewery,true,true\r\n',
    );
    expect(result.applied).toBe(0);
    expect(result.droppedInvalid).toBe(1);
    expect(result.userData.beers['wbf26-0001']).toBeUndefined();
  });

  it('enforces the not-present cascade on import (clears status/opinion/notes)', () => {
    const result = importCsv(
      'id,is_adhoc,to_try,tried,opinion,notes,not_present\r\n' +
        'wbf26-0001,false,false,true,liked,"some notes",true\r\n',
    );
    const state = result.userData.beers['wbf26-0001'];
    expect(state.notPresent).toBe(true);
    expect(state.status).toBeNull();
    expect(state.opinion).toBeNull();
    expect(state.notes).toBe('');
  });

  it('restores a custom location from the user_location column', () => {
    const result = importCsv(
      'id,is_adhoc,tried,user_location\r\n' + 'wbf26-0001,false,true,"North Tent, Booth 42"\r\n',
    );
    expect(result.userData.beers['wbf26-0001'].location).toBe('North Tent, Booth 42');
  });

  it('defaults the location to empty when the user_location column is absent', () => {
    // Older exports predate the column — they must still import cleanly.
    const result = importCsv('id,is_adhoc,tried\r\nwbf26-0001,false,true\r\n');
    expect(result.userData.beers['wbf26-0001'].location).toBe('');
  });

  it('clears the custom location under the not-present cascade on import', () => {
    const result = importCsv(
      'id,is_adhoc,not_present,user_location\r\n' + 'wbf26-0001,false,true,"Booth 42"\r\n',
    );
    expect(result.userData.beers['wbf26-0001'].location).toBe('');
  });

  it('ignores source-beer columns for non-ad-hoc rows (dataset wins)', () => {
    // The user might have hand-edited the brewery in the CSV; on import,
    // we ignore that and trust the current dataset for non-ad-hoc beers.
    // The visible behavior is that the state attaches to the dataset's
    // current source-beer fields, not whatever was in the CSV.
    const result = importCsv(
      'id,name,brewery,is_adhoc,tried\r\n' + 'wbf26-0001,Wrong Name,Wrong Brewery,false,true\r\n',
    );
    expect(result.applied).toBe(1);
    const state = result.userData.beers['wbf26-0001'];
    // No adhoc payload on a dataset row.
    expect(state.adhoc).toBeUndefined();
    expect(state.status).toBe('tried');
  });

  it('round-trips an export through parseImport without data loss', () => {
    // Build a userData, export, re-import, compare. The re-imported user
    // data should match the original (minus orphaned entries / collapsed
    // representations).
    const datasetBeersForRoundTrip = [
      beer({ id: 'wbf26-0001', name: 'Sunbreak', brewery: 'Fremont', abv: 5.2 }),
    ];
    const original: UserData = {
      version: 1,
      beers: {
        'wbf26-0001': {
          status: 'tried',
          opinion: 'liked',
          notes: 'piney, citrusy\nwith a "wow" finish',
          location: 'North Tent, Booth 7',
          notPresent: false,
        },
        'adhoc-1': {
          status: 'toTry',
          opinion: null,
          notes: '',
          location: '',
          notPresent: false,
          adhoc: {
            name: 'Mystery Sour',
            brewery: 'Backstage',
            abv: 4.5,
            style: 'Sour',
          },
        },
      },
    };
    const csv = serializeExport({ datasetBeers: datasetBeersForRoundTrip, userData: original });
    const result = parseImport({ csvText: csv, datasetBeers: datasetBeersForRoundTrip });
    expect(result.applied).toBe(2);
    expect(result.userData.beers['wbf26-0001']).toEqual({
      status: 'tried',
      opinion: 'liked',
      notes: 'piney, citrusy\nwith a "wow" finish',
      location: 'North Tent, Booth 7',
      notPresent: false,
    });
    expect(result.userData.beers['adhoc-1']).toMatchObject({
      status: 'toTry',
      opinion: null,
      notes: '',
      notPresent: false,
      adhoc: {
        name: 'Mystery Sour',
        brewery: 'Backstage',
        abv: 4.5,
        style: 'Sour',
      },
    });
  });
});
