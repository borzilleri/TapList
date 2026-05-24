/**
 * RFC 4180 CSV serialize / parse.
 *
 * Kept intentionally pure and small: no business logic, no validation
 * past what RFC 4180 requires. The transfer layer (transfer.ts) sits
 * on top of this and handles row-shape concerns.
 *
 * Quoting rules (RFC 4180):
 * - Fields containing commas, double quotes, CR, or LF must be wrapped
 *   in double quotes.
 * - Embedded double quotes inside a quoted field are escaped by doubling.
 * - Line terminators are CRLF on output; we accept LF or CRLF on input.
 */

export interface CsvData {
  /** Header row, in the order they should appear in the file. */
  headers: string[];
  /** Data rows. Each row is keyed by header name; missing keys serialize as ''. */
  rows: Record<string, string>[];
}

const CRLF = '\r\n';

export function serializeCsv(data: CsvData): string {
  const out: string[] = [];
  out.push(data.headers.map(quoteField).join(','));
  for (const row of data.rows) {
    out.push(data.headers.map((h) => quoteField(row[h] ?? '')).join(','));
  }
  // RFC 4180 says CRLF between rows; trailing newline is optional but
  // conventional and plays nicer with spreadsheet round-trips.
  return out.join(CRLF) + CRLF;
}

function quoteField(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Parses an RFC 4180 CSV string. The first row is treated as headers;
 * each subsequent row is returned as a Record<header, value>. Missing
 * trailing fields on a short row are present in the result with value ''.
 *
 * Throws only for catastrophically malformed input (an unclosed quoted
 * field). Empty input returns `{ headers: [], rows: [] }`.
 */
export function parseCsv(text: string): CsvData {
  const records = parseRecords(text);
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = records[0];
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const row: Record<string, string> = {};
    const record = records[i];
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = record[j] ?? '';
    }
    rows.push(row);
  }
  return { headers, rows };
}

/**
 * Tokenize the CSV text into a list of records (each record is a list of
 * raw field strings). Strips trailing empty record if the file ends with
 * a newline (which is conventional).
 */
function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // Escaped quote inside a quoted field.
          field += '"';
          i += 2;
        } else {
          // Closing quote.
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
    } else {
      if (ch === '"' && field === '') {
        // Opening quote of a quoted field (only allowed at the start of a field).
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        record.push(field);
        field = '';
        i++;
      } else if (ch === '\r') {
        record.push(field);
        records.push(record);
        record = [];
        field = '';
        // Consume \r\n as one terminator; bare \r is also accepted.
        i += text[i + 1] === '\n' ? 2 : 1;
      } else if (ch === '\n') {
        record.push(field);
        records.push(record);
        record = [];
        field = '';
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  if (inQuotes) {
    throw new Error('CSV parse error: unterminated quoted field');
  }

  // Trailing field/record if the input doesn't end with a newline.
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }

  return records;
}
