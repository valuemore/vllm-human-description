import "server-only";
import ExcelJS from "exceljs";
import { formatCell } from "@/lib/export/csv";
import type { Column, Row } from "@/lib/export/datasets";

export type Sheet = { name: string; columns: Column[]; rows: Row[] };

/** 시트 이름은 31자 제한, 특수문자 금지 */
function sheetName(n: string) {
  return n.replace(/[\\/?*[\]:]/g, "_").slice(0, 31);
}

export async function buildWorkbook(sheets: Sheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "research-export";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(sheetName(s.name));
    ws.columns = s.columns.map((c) => ({ header: c.header ?? c.key, key: c.key, width: Math.min(Math.max((c.header ?? c.key).length + 2, 10), 60) }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of s.rows) {
      ws.addRow(
        Object.fromEntries(
          s.columns.map((c) => {
            const v = r[c.key];
            // 숫자/불리언은 원형 유지, 나머지는 문자열 (긴 텍스트는 셀 제한 32767자 안전 절단)
            if (typeof v === "number" || typeof v === "boolean") return [c.key, v];
            const str = formatCell(v);
            return [c.key, str.length > 32000 ? str.slice(0, 32000) + "…" : str];
          }),
        ),
      );
    }
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
