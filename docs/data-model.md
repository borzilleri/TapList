# TapList — data model

This document defines four distinct data shapes:

1. **The catalog** — JSON file listing the festival datasets the app knows about. Fetched first on every load.
2. **The dataset** — JSON file for one festival, containing its beers. Fetched after the catalog, using a URL the catalog provides.
3. **User data** — per-beer state stored in `localStorage`, namespaced by dataset id.
4. **The CSV export/import format** — round-trippable representation of user data.

## 1. Catalog JSON

The catalog is a small JSON file at a fixed, same-origin URL (`/data/catalog.json`). It enumerates every festival dataset the app can load. The catalog is the only thing the app must know up-front; every dataset is discovered through it.

### Shape

```json
{
  "version": 1,
  "datasets": [
    {
      "id": "wbf-2026",
      "name": "Washington Brewers Festival 2026",
      "url": "/data/wbf-2026.json",
      "dates": { "start": "2026-06-12", "end": "2026-06-14" },
      "location": "Marymoor Park, Redmond WA",
      "status": "upcoming",
      "default": true
    }
  ]
}
```

### Top-level fields

| Field      | Type   | Required | Notes                                                                                                                      |
| ---------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------- |
| `version`  | number | yes      | Catalog schema version. v1 sets this to `1`. Future schema changes bump it and the app may migrate or refuse older shapes. |
| `datasets` | array  | yes      | At least one entry. Order is preserved and used as the tie-breaker for selection (see below).                              |

### Per-entry fields

| Field      | Type                                   | Required | Notes                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `id`       | string                                 | yes      | Must match the `id` field inside the referenced dataset JSON. Slug-safe (lowercase, digits, hyphens). The dataset's own `id` is authoritative for user-data namespacing; the catalog `id` is a hint used for selection and display before the dataset itself is fetched. |
| `name`     | string                                 | yes      | Human-readable festival name. Shown in the future selector and in the app header.                                                                                                                                                                                        |
| `url`      | string                                 | yes      | URL of the dataset JSON. May be relative (resolved against the catalog's location) or absolute. Cross-origin URLs must serve CORS headers.                                                                                                                               |
| `dates`    | `{ start: string, end: string }`       | no       | ISO-8601 dates. Used in the future selector view; ignored in v1.                                                                                                                                                                                                         |
| `location` | string                                 | no       | Free-form venue/city string. Used in the future selector view.                                                                                                                                                                                                           |
| `status`   | `"upcoming" \| "active" \| "archived"` | no       | Hint for the future selector to sort/group/dim entries. Ignored in v1.                                                                                                                                                                                                   |
| `default`  | boolean                                | no       | When `true`, the app picks this entry if the user has no saved selection. At most one entry should set this; if multiple do, the first wins.                                                                                                                             |

### Validation behavior

- A catalog missing or malformed `version` or `datasets` is treated as a fatal load error, falling back to the cached copy if available.
- Entries missing required fields are dropped with a console warning; the catalog still loads with whatever valid entries remain.
- If a catalog ends up with zero valid entries, the app shows an error state.

### Selection algorithm

The app picks the active dataset on load by trying, in order:

1. The entry whose `id` matches the `selectedDatasetId` value in localStorage. (Not set in v1 — reserved for the future selector.)
2. The entry where `default: true`.
3. The first entry in `datasets`.

The selected entry's `url` is then fetched to load the dataset itself.

### Catalog/dataset id mismatch

If the catalog entry's `id` doesn't match the `id` inside the fetched dataset JSON, the dataset's own `id` is authoritative — user data namespacing follows the dataset. A console warning is logged. This shouldn't happen with a well-maintained catalog, but trusting the dataset over the catalog ensures the user's stored data is never silently mis-keyed.

## 2. Dataset JSON

The dataset is a JSON file containing a list of beers wrapped in an object that carries dataset-level metadata (notably the stable `id`).

### Shape

```json
{
  "id": "wbf-2026",
  "festival": "Washington Brewers Festival 2026",
  "updatedAt": "2026-06-12T15:30:00Z",
  "beers": [
    {
      "id": "wbf26-0001",
      "name": "Sunbreak Pils",
      "brewery": "Fremont Brewing",
      "abv": 5.2,
      "style": "Pilsner",
      "location": "North Tent, Booth 14",
      "description": "A crisp, bright German-style pilsner brewed with Hallertau Mittelfrüh hops. Snappy bitterness, clean lager finish. Perfect for a sunny afternoon."
    }
  ]
}
```

### Per-beer fields

| Field         | Type   | Required | Notes                                                                                                                                                                       |
| ------------- | ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`          | string | yes      | Stable across dataset versions. User data is keyed off this. The dataset author commits to never re-using or re-purposing an id.                                            |
| `name`        | string | yes      | The beer's display name.                                                                                                                                                    |
| `brewery`     | string | yes      | The brewery's display name.                                                                                                                                                 |
| `abv`         | number | no       | Percent alcohol by volume, as a number (e.g., `5.2`, not `"5.2%"`). Optional because some festivals publish lists with missing ABVs (especially for last-minute additions). |
| `style`       | string | no       | Free-form style label (e.g., "IPA", "Saison", "Imperial Stout"). Optional for the same reason.                                                                              |
| `location`    | string | no       | Free-form location string (e.g., "Booth 14", "North Tent").                                                                                                                 |
| `description` | string | no       | Free-form long-form text. The brewery's own write-up, tasting notes, or backstory — whatever the dataset author has. May be multiple paragraphs. No length cap.             |

Unknown fields are ignored (forward-compatibility).

### Top-level fields

| Field       | Type   | Required | Notes                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`        | string | yes      | Stable identifier for this dataset. Used as the namespace key for user data in `localStorage`, so it MUST remain stable across versions of the same dataset (e.g., daily updates of the WBF 2026 list all share `id: "wbf-2026"`). Should be slug-safe (lowercase letters, digits, and hyphens) since it's interpolated into a storage key. Required because user data cannot be safely persisted without it. |
| `festival`  | string | no       | Human-readable festival name; shown in the UI.                                                                                                                                                                                                                                                                                                                                                                |
| `updatedAt` | string | no       | ISO-8601 timestamp. Powers the "updated X ago" indicator. If absent, fall back to the time the dataset was fetched.                                                                                                                                                                                                                                                                                           |
| `beers`     | array  | yes      | The list of beers.                                                                                                                                                                                                                                                                                                                                                                                            |

### Validation behavior

- A dataset missing or malformed `id` is treated as a fatal load error: the app falls back to the cached copy. If there is no cached copy, the app shows an error state. (User data is keyed by `id`; loading a dataset without one would corrupt persistence.)
- Beers missing required fields (`id`, `name`, `brewery`) are dropped on load, with a console warning. The app still loads with whatever valid beers remain.
- `abv` values that aren't numbers are treated as missing (the field is set to `null` for that beer; the row is _not_ dropped).
- The file failing to parse as JSON falls back to the cached copy. If there is no cached copy, the app shows an error state.

## 3. User data (localStorage)

User data is stored under a single `localStorage` key, namespaced by the dataset's `id` field so different datasets never collide.

### Key

```
taplist:userdata:<datasetId>
```

`<datasetId>` is the top-level `id` field from the dataset JSON. For WBF 2026, that means the key is `taplist:userdata:wbf-2026`. Because user data is keyed by this value, dataset authors must keep the `id` stable across updates of the same dataset — changing it would orphan the user's existing flags, ratings, and notes.

### Value (JSON)

```json
{
  "version": 1,
  "beers": {
    "wbf26-0001": {
      "status": "toTry",
      "opinion": null,
      "notes": "",
      "notPresent": false
    },
    "adhoc-9f1c...": {
      "status": "tried",
      "opinion": "liked",
      "notes": "Bright, citrusy. Would buy.",
      "notPresent": false,
      "adhoc": {
        "name": "Mystery Sour",
        "brewery": "Backstage Brewing",
        "abv": 4.5,
        "style": "Sour",
        "location": "Booth 47"
      }
    }
  }
}
```

### Per-beer user data

| Field        | Type                            | Notes                                                                                                                                                                                                                                                     |
| ------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`     | `"toTry" \| "tried" \| null`    | The user's progress on this beer. `"toTry"` = queued to try, `"tried"` = sampled, `null` = neither. Mutually exclusive by construction. Setting `opinion` to a non-null value implicitly sets `status = "tried"` (overwriting `"toTry"` if it was there). |
| `opinion`    | `"liked" \| "disliked" \| null` | Optional. Null means no opinion. Setting a non-null value implicitly sets `status = "tried"`. Clearing the opinion does _not_ revert status.                                                                                                              |
| `notes`      | string                          | Plain text, ≤280 chars (hard enforced in UI; importer silently truncates longer values).                                                                                                                                                                  |
| `notPresent` | boolean                         | Hides the beer from default views.                                                                                                                                                                                                                        |
| `adhoc`      | object (see below)              | Present only on ad-hoc beers.                                                                                                                                                                                                                             |

A beer is "touched" — and therefore included in CSV export — if **any** of the following are true: `status !== null`, `opinion !== null`, `notes !== ""`, `notPresent`, or it is ad-hoc.

### Ad-hoc beer payload

When a beer is ad-hoc, its record carries an `adhoc` object holding the source-beer fields (since the beer isn't in the dataset). The id of an ad-hoc beer is locally generated and prefixed `adhoc-`.

| Field         | Type   | Required | Notes                                                                                      |
| ------------- | ------ | -------- | ------------------------------------------------------------------------------------------ |
| `name`        | string | yes      |                                                                                            |
| `brewery`     | string | yes      | Required — at a festival, the brewery is what the user is most likely to know on the spot. |
| `abv`         | number | no       |                                                                                            |
| `style`       | string | no       |                                                                                            |
| `location`    | string | no       |                                                                                            |
| `description` | string | no       |                                                                                            |

### Versioning

The `version` field at the top of the user-data object allows future migrations. v1 sets `version: 1`. Future schema changes bump it and the app migrates older shapes forward on load.

## 4. CSV export/import format

CSV files are RFC 4180 compliant: fields containing commas, quotes, or newlines are wrapped in double quotes; embedded double quotes are escaped by doubling.

### Filename

`taplist-export-<datasetId>-<YYYYMMDD-HHMMSS>.csv`

Example: `taplist-export-wbf-2026-20260612-153045.csv`.

### Columns

The header row is required on import. Column order in export is fixed (below) but the importer matches by header name, not position, so re-ordered columns from spreadsheet edits still import correctly.

| Column        | Type    | Notes                                                                                                       |
| ------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `id`          | string  | Beer id. For ad-hoc beers, the locally generated `adhoc-...` id.                                            |
| `name`        | string  | Beer name. Always populated.                                                                                |
| `brewery`     | string  | Brewery name.                                                                                               |
| `abv`         | number  | ABV as a number; blank if unknown.                                                                          |
| `style`       | string  | Style label.                                                                                                |
| `location`    | string  | Optional. Blank if not in dataset and not set on an ad-hoc beer.                                            |
| `description` | string  | Optional. Long-form text; quoted per RFC 4180 (may contain commas, newlines, quotes). Blank if not present. |
| `to_try`      | boolean | `true` if the user has queued this beer to try. Mutually exclusive with `tried` (see import semantics).     |
| `tried`       | boolean | `true` if the user has sampled this beer. Mutually exclusive with `to_try`.                                 |
| `opinion`     | enum    | `liked`, `disliked`, or blank.                                                                              |
| `notes`       | string  | Plain text; may contain commas/newlines (quoted per RFC 4180).                                              |
| `not_present` | boolean | `true` / `false`.                                                                                           |
| `is_adhoc`    | boolean | `true` for ad-hoc beers, `false` otherwise.                                                                 |

### Export scope

Only "touched" beers (per the definition in section 3) are exported.

### Import semantics

- **Replace, not merge.** All existing user data on the device is discarded before import, after a confirmation dialog.
- Each row is validated:
  - `is_adhoc=true` rows are recreated as ad-hoc beers, preserving the `id` so subsequent round-trips remain stable. All fields from the row (name, brewery, abv, style, location, description, plus user data) are restored, since there's no dataset record to fall back on.
  - `is_adhoc=false` rows must have an `id` matching a beer in the current dataset; non-matching rows are dropped with a count surfaced to the user. **Only the user-data columns (`to_try`, `tried`, `opinion`, `notes`, `not_present`) are applied from the row.** The beer-metadata columns (`name`, `brewery`, `abv`, `style`, `location`, `description`) in the CSV are ignored — the current dataset is the authoritative source for those, so a corrected brewery name or updated description in the dataset is never rolled back by re-importing an older CSV. These columns exist in the export only so the file is human-readable in a spreadsheet.
- `to_try` and `tried` are collapsed into the in-memory tri-state `status` field on import. The rule: if `tried` is true, `status = "tried"` (regardless of `to_try`); else if `to_try` is true, `status = "toTry"`; else `status = null`. The "`tried` wins" precedence handles hand-edited rows where the user checked both boxes by mistake.
- Boolean parsing is lenient (users are expected to hand-edit these files in a spreadsheet). All comparisons are case-insensitive and surrounding whitespace is stripped. The following are treated as **true**: `true`, `t`, `yes`, `y`, `1`, `x`, `✓`. Everything else — including blank cells, `false`, `f`, `no`, `n`, `0`, `-`, and any unrecognized value — is treated as **false**. The intent: a spreadsheet user can mark a column with an `x` or a `1` (or leave it blank for false) and have it Just Work.
- `opinion` parsing is also lenient: leading/trailing whitespace stripped, case-insensitive. `liked` and `disliked` map to their respective values; `+`, `like`, and `thumbs up` also map to `liked`; `-`, `dislike`, and `thumbs down` also map to `disliked`. Everything else (including blank) is treated as no opinion.
- `notes` longer than 280 characters are silently truncated to 280. The user's original CSV file is unchanged, so no data is lost from their perspective. No warning is surfaced — keep the import path quiet and forgiving.
