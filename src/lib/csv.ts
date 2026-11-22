/**
 * CSV export for report panels.
 *
 * A reporting screen that cannot be taken out of the browser is half a tool: the numbers
 * end up retyped into a spreadsheet by hand, which is both slow and where the errors come
 * from. Every panel that shows rows offers the same download.
 */

/** RFC 4180 quoting: only when needed, and a quote inside a field is doubled. */
function cell(value: unknown): string {
  if (value == null) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; header: string }[]) {
  if (!rows.length) return '';
  const cols = columns ?? Object.keys(rows[0]).map((key) => ({ key, header: key }));
  const head = cols.map((c) => cell(c.header)).join(',');
  const body = rows.map((row) => cols.map((c) => cell(row[c.key])).join(',')).join('\r\n');
  return `${head}\r\n${body}`;
}

/**
 * Save a CSV to disk.
 *
 * The BOM is not decoration. Excel reads a UTF-8 file without one as the local ANSI code
 * page, which turns every Arabic title in an export of this dashboard into mojibake; the
 * three bytes are what make the file open correctly on the machines these reports go to.
 */
export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked on the next frame: revoking synchronously races the download in Safari.
  requestAnimationFrame(() => URL.revokeObjectURL(url));
}
