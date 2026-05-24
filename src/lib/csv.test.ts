/**
 * Tests for the RFC 4180 CSV serialize / parse layer.
 */

import { describe, expect, it } from 'vitest';
import { parseCsv, serializeCsv } from './csv';

describe('serializeCsv', () => {
  it('writes a simple header + rows', () => {
    const csv = serializeCsv({
      headers: ['id', 'name', 'abv'],
      rows: [
        { id: '1', name: 'Sunbreak', abv: '5.2' },
        { id: '2', name: 'Lush', abv: '7.0' },
      ],
    });
    expect(csv).toBe('id,name,abv\r\n1,Sunbreak,5.2\r\n2,Lush,7.0\r\n');
  });

  it('quotes fields containing commas, quotes, or newlines', () => {
    const csv = serializeCsv({
      headers: ['id', 'notes'],
      rows: [
        { id: '1', notes: 'piney, citrusy' },
        { id: '2', notes: 'they said "wow"' },
        { id: '3', notes: 'line one\nline two' },
      ],
    });
    expect(csv).toBe(
      'id,notes\r\n' +
        '1,"piney, citrusy"\r\n' +
        '2,"they said ""wow"""\r\n' +
        '3,"line one\nline two"\r\n',
    );
  });

  it('serializes missing keys as empty fields', () => {
    const csv = serializeCsv({
      headers: ['id', 'name', 'abv'],
      rows: [{ id: '1', name: 'Lonely' }],
    });
    expect(csv).toBe('id,name,abv\r\n1,Lonely,\r\n');
  });

  it('handles an empty rows array (header-only output)', () => {
    expect(serializeCsv({ headers: ['id', 'name'], rows: [] })).toBe('id,name\r\n');
  });
});

describe('parseCsv', () => {
  it('parses a simple file with CRLF line endings', () => {
    const result = parseCsv('id,name,abv\r\n1,Sunbreak,5.2\r\n2,Lush,7.0\r\n');
    expect(result.headers).toEqual(['id', 'name', 'abv']);
    expect(result.rows).toEqual([
      { id: '1', name: 'Sunbreak', abv: '5.2' },
      { id: '2', name: 'Lush', abv: '7.0' },
    ]);
  });

  it('accepts LF-only line endings (spreadsheet exports often produce these)', () => {
    const result = parseCsv('id,name\n1,A\n2,B\n');
    expect(result.rows).toEqual([
      { id: '1', name: 'A' },
      { id: '2', name: 'B' },
    ]);
  });

  it('parses quoted fields with embedded commas, quotes, and newlines', () => {
    const text =
      'id,notes\r\n' +
      '1,"piney, citrusy"\r\n' +
      '2,"they said ""wow"""\r\n' +
      '3,"line one\nline two"\r\n';
    const result = parseCsv(text);
    expect(result.rows).toEqual([
      { id: '1', notes: 'piney, citrusy' },
      { id: '2', notes: 'they said "wow"' },
      { id: '3', notes: 'line one\nline two' },
    ]);
  });

  it('handles a file with no trailing newline', () => {
    const result = parseCsv('id,name\r\n1,Last');
    expect(result.rows).toEqual([{ id: '1', name: 'Last' }]);
  });

  it('treats missing trailing fields as empty strings', () => {
    const result = parseCsv('id,name,abv\r\n1,Lonely\r\n');
    expect(result.rows).toEqual([{ id: '1', name: 'Lonely', abv: '' }]);
  });

  it('returns empty data for empty input', () => {
    expect(parseCsv('')).toEqual({ headers: [], rows: [] });
  });

  it('throws on unterminated quoted field', () => {
    expect(() => parseCsv('id,name\r\n1,"unclosed')).toThrow(/unterminated/i);
  });

  it('round-trips through serializeCsv', () => {
    const data = {
      headers: ['id', 'name', 'notes', 'abv'],
      rows: [
        { id: 'a', name: 'Plain', notes: 'nothing weird', abv: '5.0' },
        { id: 'b', name: 'Tricky, beer', notes: 'has "quotes" and,\ncommas', abv: '' },
        { id: 'c', name: 'Empty notes', notes: '', abv: '8.5' },
      ],
    };
    const serialized = serializeCsv(data);
    const reparsed = parseCsv(serialized);
    expect(reparsed.headers).toEqual(data.headers);
    expect(reparsed.rows).toEqual(data.rows);
  });
});
