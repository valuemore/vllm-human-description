import { Notice, PageHeader, Section, StatusBadge, Table, Td } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/auth/admin";
import { getServiceClient } from "@/lib/db/service-client";
import { listSources } from "@/lib/services/admin/coding";
import { getCurrentStudy } from "@/lib/services/admin/study";
import { listVideos } from "@/lib/services/admin/videos";
import { openSessionAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CodingIndexPage({ searchParams }: { searchParams: Promise<{ video?: string; type?: string }> }) {
  const { video, type } = await searchParams;
  const { admin } = await requireAdminPage();
  const study = await getCurrentStudy();
  const [videos, sources, { data: progress }] = await Promise.all([
    listVideos(study.id),
    listSources(study.id, admin.id, video || undefined),
    getServiceClient().from("v_coding_progress").select("*").eq("study_id", study.id).order("video_code"),
  ]);
  const shown = type ? sources.filter((s) => s.source_type === type) : sources;

  return (
    <>
      <PageHeader title="Claim Coding" description="기술문을 의미 단위 Claim 으로 분할하고 Reference Event 와 대응시킵니다. 원문은 절대 수정하지 않으며 코딩은 별도 레이어에 저장됩니다." />
      {(progress ?? []).some((p) => (p.reference_events ?? 0) === 0) && <Notice tone="warn">Reference Event 가 없는 영상이 있습니다. 코딩 전에 Reference Annotation 을 먼저 완료하세요.</Notice>}

      <Section title="영상별 코딩 진행">
        <Table head={["영상", "Reference Events", "교사 기록 (확정/전체)", "AI run (확정/전체)"]}>
          {(progress ?? []).map((p) => (
            <tr key={p.video_id}>
              <Td mono>{p.video_code}</Td>
              <Td mono>{p.reference_events}</Td>
              <Td mono>
                {p.teacher_finalized}/{p.teacher_sources}
              </Td>
              <Td mono>
                {p.ai_finalized}/{p.ai_sources}
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <form className="mb-4 flex gap-2 text-sm">
        <select name="video" defaultValue={video ?? ""} className="rounded border bg-background px-2 py-1">
          <option value="">영상 전체</option>
          {videos.filter((v) => v.kind === "research").map((v) => (
            <option key={v.id} value={v.id}>
              {v.code}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type ?? ""} className="rounded border bg-background px-2 py-1">
          <option value="">교사 + AI</option>
          <option value="teacher">교사</option>
          <option value="ai">AI</option>
        </select>
        <button className="rounded border px-3 py-1 hover:bg-muted">필터</button>
      </form>

      <Section title={`코딩 대상 (${shown.length})`}>
        <Table head={["영상", "출처", "라벨", "글자", "내 세션", "Claim", "다른 코더", ""]}>
          {shown.map((s) => (
            <tr key={`${s.source_type}-${s.source_record_id}`}>
              <Td mono>{s.video_code}</Td>
              <Td>{s.source_type === "teacher" ? "교사" : "AI"}</Td>
              <Td mono>{s.source_label}</Td>
              <Td mono>{s.character_count}</Td>
              <Td>{s.session ? <StatusBadge status={s.session.status === "finalized" ? "submitted" : "in_progress"} /> : <span className="text-muted-foreground">—</span>}</Td>
              <Td mono>{s.claimCount}</Td>
              <Td mono>{s.otherCoders}</Td>
              <Td>
                <form action={openSessionAction}>
                  <input type="hidden" name="source_type" value={s.source_type ?? ""} />
                  <input type="hidden" name="source_record_id" value={s.source_record_id ?? ""} />
                  <button className="text-sm underline">{s.session ? "열기" : "코딩 시작"}</button>
                </form>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
