import { PageHeader, Section, Table, Td, fmtDate } from "@/components/admin/ui";
import { listAuditLogs, type AuditAction } from "@/lib/services/admin/audit";
import { getCurrentStudy } from "@/lib/services/admin/study";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ action?: string; target?: string }> }) {
  const { action, target } = await searchParams;
  const study = await getCurrentStudy();
  const rows = await listAuditLogs(study.id, { action: (action || undefined) as AuditAction | undefined, targetType: target || undefined });
  return (
    <>
      <PageHeader title="감사 로그" description="관리자 행위·연구 설정 변경·무효화·export 기록 (append-only)" />
      <form className="mb-4 flex gap-2 text-sm">
        <input name="action" defaultValue={action ?? ""} placeholder="action (예: observation_invalidated)" className="rounded border px-2 py-1" />
        <input name="target" defaultValue={target ?? ""} placeholder="target_type (예: participant)" className="rounded border px-2 py-1" />
        <button className="rounded border px-3 py-1 hover:bg-muted">필터</button>
      </form>
      <Section title={`기록 (${rows.length})`}>
        <Table head={["시각", "관리자", "행위", "대상", "이전", "이후"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <Td className="whitespace-nowrap text-xs">{fmtDate(r.created_at)}</Td>
              <Td className="text-xs">{(r.admin as { email?: string } | null)?.email ?? "system"}</Td>
              <Td mono>{r.action}</Td>
              <Td className="font-mono text-xs">
                {r.target_type}
                <br />
                {r.target_id?.slice(0, 8)}
              </Td>
              <Td className="max-w-60 truncate font-mono text-xs">{r.before_json ? JSON.stringify(r.before_json) : ""}</Td>
              <Td className="max-w-80 truncate font-mono text-xs">{r.after_json ? JSON.stringify(r.after_json) : ""}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
