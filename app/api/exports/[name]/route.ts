import { fail, handle } from "@/lib/api-response";
import { requireAdmin } from "@/lib/auth/admin";
import { toCsv } from "@/lib/export/csv";
import { ALL_DATASETS, getDataset, runDataset } from "@/lib/export/datasets";
import { buildWorkbook } from "@/lib/export/xlsx";
import { recordAudit } from "@/lib/services/admin/audit";
import { getCurrentStudy } from "@/lib/services/admin/study";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * GET /api/exports/{name}?format=csv|xlsx   단일 데이터셋
 * GET /api/exports/all?format=xlsx           전체(interaction_events 제외) 다중 시트
 */
export const GET = handle(async (req: Request, { params }: { params: Promise<{ name: string }> }) => {
  const { admin } = await requireAdmin();
  const { name } = await params;
  const format = new URL(req.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const study = await getCurrentStudy();

  if (name === "all") {
    const sheets = [];
    let total = 0;
    for (const d of ALL_DATASETS.filter((d) => d.name !== "interaction_events")) {
      const rows = await runDataset(d, study.id);
      total += rows.length;
      sheets.push({ name: d.name, columns: d.columns, rows });
    }
    const buf = await buildWorkbook(sheets);
    await recordAudit({ studyId: study.id, adminId: admin.id, action: "data_exported", targetType: "study", targetId: study.id, after: { file: "all.xlsx", row_count: total } });
    return new Response(new Uint8Array(buf), {
      headers: {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${study.code}_all_${stamp()}.xlsx"`,
        "cache-control": "no-store",
      },
    });
  }

  const dataset = getDataset(name);
  if (!dataset) return fail("NOT_FOUND", "알 수 없는 데이터셋", 404);
  const rows = await runDataset(dataset, study.id);
  await recordAudit({ studyId: study.id, adminId: admin.id, action: "data_exported", targetType: "study", targetId: study.id, after: { file: `${dataset.name}.${format}`, row_count: rows.length } });
  const filename = `${study.code}_${dataset.name}_${stamp()}.${format}`;
  if (format === "xlsx") {
    const buf = await buildWorkbook([{ name: dataset.name, columns: dataset.columns, rows }]);
    return new Response(new Uint8Array(buf), {
      headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
    });
  }
  const csv = toCsv(rows, dataset.columns.map((c) => ({ key: c.key, header: c.header ?? c.key })));
  return new Response(csv, {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "no-store" },
  });
});
