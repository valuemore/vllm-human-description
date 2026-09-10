/** RFC 4180 CSV. UTF-8 BOM(Excel 한글) + CRLF. boolean → TRUE/FALSE, null → 빈 셀, 객체 → JSON. */
export type CsvColumn = { key: string; header: string };

export function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function escapeCsv(s: string): string {
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: CsvColumn[], opts: { bom?: boolean } = {}): string {
  const head = columns.map((c) => escapeCsv(c.header)).join(",");
  const body = rows.map((r) => columns.map((c) => escapeCsv(formatCell(r[c.key]))).join(","));
  return (opts.bom === false ? "" : "﻿") + [head, ...body].join("\r\n") + "\r\n";
}
