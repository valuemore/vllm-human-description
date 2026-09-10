import Link from "next/link";
import { PageHeader, Section, StatusBadge, Table, Td, fmtDate, fmtSec } from "@/components/admin/ui";
import { listObservations, type ObservationFilters } from "@/lib/services/admin/observations";
import { getCurrentStudy } from "@/lib/services/admin/study";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function ObservationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const study = await getCurrentStudy();
  const f: ObservationFilters = {
    participant: sp.participant || undefined,
    video: sp.video || undefined,
    group: sp.group || undefined,
    order: sp.order ? Number(sp.order) : undefined,
    submission: (sp.submission as "manual" | "timeout") || undefined,
    validity: (sp.validity as "valid" | "invalid") || undefined,
    technical: sp.technical === "1",
    status: (sp.status as ObservationFilters["status"]) || undefined,
    practice: sp.practice === "1",
  };
  const rows = await listObservations(study.id, f);
  const sel = "rounded border bg-background px-2 py-1 text-sm";

  return (
    <>
      <PageHeader title="관찰기록" description="원문·시간·재생행동·상태. 제출된 원문은 수정되지 않으며 무효화는 플래그로만 처리됩니다." />
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <input name="participant" defaultValue={sp.participant ?? ""} placeholder="참여자 (T01)" className={sel} />
        <input name="video" defaultValue={sp.video ?? ""} placeholder="영상 (V01)" className={sel} />
        <input name="group" defaultValue={sp.group ?? ""} placeholder="그룹 (O1)" className={sel} />
        <input name="order" defaultValue={sp.order ?? ""} placeholder="제시순서" type="number" min={1} className={`${sel} w-24`} />
        <select name="status" defaultValue={sp.status ?? ""} className={sel}>
          <option value="">상태 전체</option>
          <option value="pending">pending</option>
          <option value="in_progress">in_progress</option>
          <option value="submitted">submitted</option>
          <option value="invalidated">invalidated</option>
        </select>
        <select name="submission" defaultValue={sp.submission ?? ""} className={sel}>
          <option value="">제출유형 전체</option>
          <option value="manual">manual</option>
          <option value="timeout">timeout</option>
        </select>
        <select name="validity" defaultValue={sp.validity ?? ""} className={sel}>
          <option value="">유효/무효 전체</option>
          <option value="valid">유효 제출</option>
          <option value="invalid">무효화</option>
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="technical" value="1" defaultChecked={sp.technical === "1"} /> 기술오류
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="practice" value="1" defaultChecked={sp.practice === "1"} /> 연습 관찰
        </label>
        <button className="rounded border px-3 py-1 hover:bg-muted">필터</button>
        <Link href="/admin/observations" className="text-xs underline">
          초기화
        </Link>
      </form>

      <Section title={`기록 (${rows.length})`}>
        <Table head={["참여자", "그룹", "영상", "순서", "att", "상태", "시작", "제출", "wall", "eff", "첫시청", "replay", "pause", "seek", "글자", "제출유형", "무효화", ""]}>
          {rows.map((o) => (
            <tr key={o.observation_id} className={o.invalidated ? "text-muted-foreground" : ""}>
              <Td mono>{o.participant_code}</Td>
              <Td mono>{o.order_group}</Td>
              <Td mono>{o.video_code}</Td>
              <Td mono>{o.presentation_order}</Td>
              <Td mono>{o.attempt_number}</Td>
              <Td>
                <StatusBadge status={o.status ?? ""} />
              </Td>
              <Td className="whitespace-nowrap text-xs">{fmtDate(o.started_at)}</Td>
              <Td className="whitespace-nowrap text-xs">{fmtDate(o.submitted_at)}</Td>
              <Td mono>{fmtSec(o.wall_elapsed_seconds)}</Td>
              <Td mono>{fmtSec(o.effective_elapsed_seconds)}</Td>
              <Td mono>{fmtSec(o.first_watch_seconds)}</Td>
              <Td mono>{o.replay_count}</Td>
              <Td mono>{o.pause_count}</Td>
              <Td mono>{o.seek_count}</Td>
              <Td mono>{o.character_count ?? "—"}</Td>
              <Td>{o.submission_type ?? "—"}</Td>
              <Td className="max-w-40 truncate text-xs">{o.invalidated ? o.invalidated_reason : o.technical_issue ? "기술오류" : ""}</Td>
              <Td>
                <Link className="underline" href={`/admin/observations/${o.observation_id}`}>
                  상세
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
