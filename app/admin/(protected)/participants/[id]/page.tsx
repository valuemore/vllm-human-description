import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { PageHeader, Section, StatusBadge, Table, Td, fmtDate, fmtSec } from "@/components/admin/ui";
import { AppError } from "@/lib/errors";
import { getParticipantDetail } from "@/lib/services/admin/participants";
import { getOrderGroups } from "@/lib/services/admin/study";
import { changeGroupAction, resetPinAction, updateNotesAction, withdrawAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function ParticipantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let detail;
  try {
    detail = await getParticipantDetail(id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const { participant: p, observations, sessions, consents, demographics, audits } = detail;
  const { groups } = await getOrderGroups(p.study_id!);
  const started = !!p.started_at;

  return (
    <>
      <PageHeader
        title={`참여자 ${p.participant_code}`}
        description={`${p.order_group} · ${p.status} · ${p.is_valid ? "유효" : "무효(탈락)"}`}
        actions={
          <Link className="text-sm underline" href="/admin/participants">
            목록
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="진행">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">완료</dt>
            <dd className="font-mono">
              {p.completed_count}/{p.target_count}
            </dd>
            <dt className="text-muted-foreground">동의</dt>
            <dd>{p.has_consent ? "완료" : "—"}</dd>
            <dt className="text-muted-foreground">기본정보</dt>
            <dd>{p.has_demographics ? "완료" : "—"}</dd>
            <dt className="text-muted-foreground">안내 확인</dt>
            <dd>{fmtDate(p.guide_acknowledged_at)}</dd>
            <dt className="text-muted-foreground">연습 완료</dt>
            <dd>{fmtDate(p.practice_completed_at)}</dd>
            <dt className="text-muted-foreground">본 관찰 시작</dt>
            <dd>{fmtDate(p.started_at)}</dd>
            <dt className="text-muted-foreground">완료</dt>
            <dd>{fmtDate(p.completed_at)}</dd>
            <dt className="text-muted-foreground">기기/브라우저</dt>
            <dd>
              {p.device_category ?? "—"} / {p.browser_category ?? "—"}
            </dd>
          </dl>
        </Section>
        <Section title="기본정보">
          {demographics ? (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted-foreground">경력</dt>
              <dd>
                {demographics.teaching_experience_years}년 {demographics.teaching_experience_months}개월
              </dd>
              <dt className="text-muted-foreground">담당 연령</dt>
              <dd>{demographics.current_child_age_group}</dd>
              <dt className="text-muted-foreground">기록 빈도</dt>
              <dd>{demographics.observation_record_frequency}</dd>
              <dt className="text-muted-foreground">영상관찰 경험</dt>
              <dd>{demographics.video_observation_experience}</dd>
              <dt className="text-muted-foreground">생성형 AI 경험</dt>
              <dd>{demographics.generative_ai_experience}</dd>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">미입력</p>
          )}
          <h3 className="mt-4 text-sm font-medium">동의</h3>
          <ul className="text-sm">
            {consents.map((c, i) => (
              <li key={i}>
                {c.consent_type} {c.consent_version} · {fmtDate(c.consented_at)}
              </li>
            ))}
          </ul>
        </Section>
        <Section title="관리">
          <div className="space-y-6">
            <ActionForm action={resetPinAction} submitLabel="PIN 재설정" confirm="PIN 을 재설정하면 기존 세션이 종료됩니다. 계속할까요?" successMode="pin">
              <input type="hidden" name="participant_id" value={p.participant_id ?? ""} />
            </ActionForm>
            <ActionForm action={changeGroupAction} submitLabel="순서그룹 변경">
              <input type="hidden" name="participant_id" value={p.participant_id ?? ""} />
              <Field label="새 순서그룹" hint={started ? "관찰을 시작한 참여자는 변경할 수 없습니다" : undefined}>
                <select name="order_group_id" defaultValue={p.order_group_id ?? ""} className={inputCls} disabled={started}>
                  {groups.map((g) => (
                    <option key={g.order_group_id} value={g.order_group_id ?? ""}>
                      {g.code} ({g.assigned_valid}/{g.target_participants})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="사유 (필수)">
                <input name="reason" className={inputCls} disabled={started} />
              </Field>
            </ActionForm>
            {p.is_valid && (
              <ActionForm action={withdrawAction} submitLabel="참여 중단 처리" confirm="참여를 중단 처리하면 유효 참여자에서 제외됩니다. 기록은 보존됩니다. 계속할까요?">
                <input type="hidden" name="participant_id" value={p.participant_id ?? ""} />
                <Field label="상태">
                  <select name="status" className={inputCls}>
                    <option value="withdrawn">withdrawn (중도탈락)</option>
                    <option value="technical_issue">technical_issue (기술 문제)</option>
                  </select>
                </Field>
                <Field label="사유 (필수)">
                  <input name="reason" className={inputCls} />
                </Field>
              </ActionForm>
            )}
            <ActionForm action={updateNotesAction} submitLabel="메모 저장">
              <input type="hidden" name="participant_id" value={p.participant_id ?? ""} />
              <Field label="관리자 메모">
                <textarea name="notes" defaultValue={p.notes_admin ?? ""} className={`${inputCls} min-h-20`} />
              </Field>
            </ActionForm>
          </div>
        </Section>
      </div>

      <Section title="관찰기록">
        <Table head={["구분", "순서", "영상", "attempt", "상태", "시작", "제출", "wall/eff", "첫시청", "replay/pause/seek", "제출유형", "무효화", ""]}>
          {observations.map((o) => (
            <tr key={o.observation_id} className={o.invalidated ? "text-muted-foreground line-through" : ""}>
              <Td>{o.is_practice ? "연습" : "본"}</Td>
              <Td mono>{o.presentation_order ?? "—"}</Td>
              <Td mono>{o.video_code}</Td>
              <Td mono>{o.attempt_number}</Td>
              <Td>
                <StatusBadge status={o.status ?? ""} />
              </Td>
              <Td className="text-xs">{fmtDate(o.started_at)}</Td>
              <Td className="text-xs">{fmtDate(o.submitted_at)}</Td>
              <Td mono>
                {fmtSec(o.wall_elapsed_seconds)}/{fmtSec(o.effective_elapsed_seconds)}
              </Td>
              <Td mono>{fmtSec(o.first_watch_seconds)}</Td>
              <Td mono>
                {o.replay_count}/{o.pause_count}/{o.seek_count}
              </Td>
              <Td>{o.submission_type ?? "—"}</Td>
              <Td className="text-xs">{o.invalidated ? o.invalidated_reason : ""}</Td>
              <Td>
                <Link className="underline" href={`/admin/observations/${o.observation_id}`}>
                  상세
                </Link>
              </Td>
            </tr>
          ))}
        </Table>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="세션">
          <Table head={["발급", "만료", "revoke", "마지막 활동", "UA"]}>
            {sessions.map((s) => (
              <tr key={s.id}>
                <Td className="text-xs">{fmtDate(s.issued_at)}</Td>
                <Td className="text-xs">{fmtDate(s.expires_at)}</Td>
                <Td className="text-xs">{fmtDate(s.revoked_at)}</Td>
                <Td className="text-xs">{fmtDate(s.last_seen_at)}</Td>
                <Td className="max-w-60 truncate text-xs">{s.user_agent}</Td>
              </tr>
            ))}
          </Table>
        </Section>
        <Section title="감사 로그">
          <Table head={["시각", "행위", "내용"]}>
            {audits.map((a) => (
              <tr key={a.id}>
                <Td className="text-xs">{fmtDate(a.created_at)}</Td>
                <Td mono>{a.action}</Td>
                <Td className="max-w-80 truncate font-mono text-xs">{JSON.stringify(a.after_json ?? a.before_json ?? {})}</Td>
              </tr>
            ))}
          </Table>
        </Section>
      </div>
    </>
  );
}
