import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { Notice, PageHeader, Section, StatusBadge, Table, Td, fmtDate, fmtSec } from "@/components/admin/ui";
import { AppError } from "@/lib/errors";
import { getObservationDetail } from "@/lib/services/admin/observations";
import { signVideoForAdmin } from "@/lib/services/videos";
import { invalidateAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ObservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let d;
  try {
    d = await getObservationDetail(id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { metrics: m, row, events, summary } = d;
  const signed = await signVideoForAdmin(m.video_id!).catch(() => null);
  const t0 = m.started_at ? new Date(m.started_at).getTime() : null;

  return (
    <>
      <PageHeader
        title={`${m.participant_code} · ${m.video_code} · 관찰 ${m.presentation_order ?? "연습"} (attempt ${m.attempt_number})`}
        description={`${m.order_group ?? ""} · ${m.status}${m.is_practice ? " · 연습" : ""}`}
        actions={
          <>
            <Link className="text-sm underline" href={`/admin/participants/${m.participant_id}`}>
              참여자
            </Link>
            <Link className="text-sm underline" href="/admin/observations">
              목록
            </Link>
          </>
        }
      />
      {m.invalidated && (
        <Notice tone="error">
          무효화됨 ({fmtDate(row.invalidated_at)}): {m.invalidated_reason}
        </Notice>
      )}
      {m.status === "in_progress" && Number(m.remaining_seconds) <= 0 && <Notice tone="warn">서버 기준 만료된 진행 중 관찰입니다. 다음 참여자 요청 또는 cron 에서 timeout 제출로 마감됩니다.</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="영상">
          {signed ? <video src={signed.url} controls controlsList="nodownload" className="w-full rounded bg-black" preload="metadata" /> : <p className="text-sm text-muted-foreground">영상 파일 없음</p>}
        </Section>
        <Section title="교사 원문 (불변)">
          {m.status === "submitted" || m.status === "invalidated" ? (
            <pre className="whitespace-pre-wrap rounded bg-muted/40 p-3 font-sans text-sm leading-relaxed">{row.observation_text || "(빈 기록)"}</pre>
          ) : (
            <>
              <p className="mb-1 text-xs text-muted-foreground">
                제출 전 작업본 (revision {row.draft_revision}, {fmtDate(row.draft_saved_at)})
              </p>
              <pre className="whitespace-pre-wrap rounded bg-muted/40 p-3 font-sans text-sm leading-relaxed">{row.draft_text || "(비어 있음)"}</pre>
            </>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            글자 {m.character_count ?? "—"} · 단어 {m.word_count ?? "—"} · 문장 {m.sentence_count ?? "—"}
          </p>
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="시간">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">시작</dt>
            <dd className="text-xs">{fmtDate(m.started_at)}</dd>
            <dt className="text-muted-foreground">첫 시청 완료</dt>
            <dd className="text-xs">{fmtDate(m.first_watch_completed_at)}</dd>
            <dt className="text-muted-foreground">제출</dt>
            <dd className="text-xs">{fmtDate(m.submitted_at)}</dd>
            <dt className="text-muted-foreground">wall / effective</dt>
            <dd className="font-mono">
              {fmtSec(m.wall_elapsed_seconds)} / {fmtSec(m.effective_elapsed_seconds)}
            </dd>
            <dt className="text-muted-foreground">첫 시청</dt>
            <dd className="font-mono">{fmtSec(m.first_watch_seconds)}</dd>
            <dt className="text-muted-foreground">buffering</dt>
            <dd className="font-mono">{fmtSec(m.buffering_seconds)}</dd>
            <dt className="text-muted-foreground">page hidden</dt>
            <dd className="font-mono">
              {m.page_hidden_count}회 / {fmtSec(m.page_hidden_seconds)}
            </dd>
            <dt className="text-muted-foreground">제출유형</dt>
            <dd>{m.submission_type ?? "—"}</dd>
            <dt className="text-muted-foreground">기기</dt>
            <dd>
              {m.device_category ?? "—"} / {m.browser_category ?? "—"}
            </dd>
          </dl>
        </Section>
        <Section title="재생 행동 (이벤트 기반)">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">replay / play</dt>
            <dd className="font-mono">
              {m.replay_count} / {summary.plays}
            </dd>
            <dt className="text-muted-foreground">pause</dt>
            <dd className="font-mono">{m.pause_count}</dd>
            <dt className="text-muted-foreground">seek</dt>
            <dd className="font-mono">{m.seek_count}</dd>
            <dt className="text-muted-foreground">buffering 구간</dt>
            <dd className="font-mono">{summary.buffers}</dd>
            <dt className="text-muted-foreground">첫 시청 차단 조작</dt>
            <dd className="font-mono">{summary.blocked}</dd>
            <dt className="text-muted-foreground">첫 시청 재시작</dt>
            <dd className="font-mono">{summary.restarts}</dd>
            <dt className="text-muted-foreground">오프라인 / 오류</dt>
            <dd className="font-mono">
              {summary.offline} / {summary.errors}
            </dd>
            <dt className="text-muted-foreground">자동저장</dt>
            <dd className="font-mono">{summary.drafts}</dd>
          </dl>
        </Section>
        <Section title="무효화 · 재시도">
          {m.invalidated ? (
            <p className="text-sm text-muted-foreground">이미 무효화된 기록입니다.</p>
          ) : (
            <ActionForm action={invalidateAction} submitLabel="무효화" confirm="이 기록을 무효화합니다. 원문은 보존되며 되돌릴 수 없습니다. 계속할까요?">
              <input type="hidden" name="observation_id" value={m.observation_id ?? ""} />
              <Field label="사유 (필수)">
                <input name="reason" className={inputCls} placeholder="예: 네트워크 단절로 영상 재생 실패" />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="create_retry" value="1" defaultChecked /> 새 attempt 생성 (참여자가 다시 관찰)
              </label>
            </ActionForm>
          )}
        </Section>
      </div>

      <Section title={`이벤트 타임라인 (${events.length})`}>
        <Table head={["#", "+초", "시각(서버)", "이벤트", "영상 위치", "metadata"]}>
          {events.map((e) => (
            <tr key={e.id}>
              <Td mono>{e.seq ?? "s"}</Td>
              <Td mono>{t0 ? ((new Date(e.event_timestamp).getTime() - t0) / 1000).toFixed(1) : "—"}</Td>
              <Td className="whitespace-nowrap text-xs">{fmtDate(e.event_timestamp)}</Td>
              <Td mono>
                <StatusBadge status={e.event_type.includes("submitted") ? "submitted" : e.event_type.startsWith("first_watch_") ? "invalidated" : "pending"} /> {e.event_type}
              </Td>
              <Td mono>{e.video_current_time_ms !== null ? `${(e.video_current_time_ms / 1000).toFixed(1)}s` : ""}</Td>
              <Td className="max-w-xl truncate font-mono text-xs">{JSON.stringify(e.metadata_json)}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
