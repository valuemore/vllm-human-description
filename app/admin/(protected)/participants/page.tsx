import Link from "next/link";
import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { Notice, PageHeader, Section, StatusBadge, Table, Td, fmtDate, fmtSec } from "@/components/admin/ui";
import { getEnv } from "@/lib/env";
import { listParticipants, nextParticipantCode, recommendedGroup } from "@/lib/services/admin/participants";
import { getCurrentStudy, getOrderGroups } from "@/lib/services/admin/study";
import { createParticipantAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ParticipantsPage() {
  const study = await getCurrentStudy();
  const [rows, { groups, targets }, nextCode, rec] = await Promise.all([listParticipants(study.id), getOrderGroups(study.id), nextParticipantCode(study.id), recommendedGroup(study.id)]);
  const base = getEnv().APP_BASE_URL;
  const validCount = rows.filter((r) => r.is_valid).length;

  return (
    <>
      <PageHeader title="참여자" description={`유효 ${validCount} / 목표 ${targets.participant_target} · 그룹당 목표 ${targets.per_group_target}`} />
      {groups.length === 0 && <Notice tone="warn">순서그룹이 없습니다. 먼저 순서그룹을 생성하세요.</Notice>}
      {!targets.balanced_possible && <Notice tone="warn">목표 인원 {targets.participant_target}명은 영상 {targets.video_count}편으로 완전 균형이 되지 않습니다 (나머지 {targets.participant_target % targets.video_count}).</Notice>}

      <Section title="참여자 생성">
        <ActionForm action={createParticipantAction} submitLabel="생성" successMode="pin" baseUrl={base}>
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="참여코드" hint="예: T01">
              <input name="code" defaultValue={nextCode} className={inputCls} required />
            </Field>
            <Field label="순서그룹" hint={rec ? `추천: O${rec.group_index} (미달)` : undefined}>
              <select name="order_group_id" defaultValue={rec?.order_group_id ?? groups[0]?.order_group_id ?? ""} className={inputCls} required>
                {groups.map((g) => (
                  <option key={g.order_group_id} value={g.order_group_id ?? ""}>
                    {g.code} ({g.assigned_valid}/{g.target_participants}) {g.sequence}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="대체 대상 (중도탈락자)">
              <select name="replaced_participant_id" defaultValue="" className={inputCls}>
                <option value="">없음</option>
                {rows.filter((r) => !r.is_valid).map((r) => (
                  <option key={r.participant_id} value={r.participant_id ?? ""}>
                    {r.participant_code} ({r.order_group})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="관리자 메모">
              <input name="notes" className={inputCls} />
            </Field>
          </div>
        </ActionForm>
      </Section>

      <Section title={`참여자 목록 (${rows.length})`}>
        <Table head={["Code", "그룹", "상태", "유효", "완료", "평균시간", "기술오류", "마지막 접속", ""]}>
          {rows.map((r) => (
            <tr key={r.participant_id} className={!r.is_valid ? "text-muted-foreground" : ""}>
              <Td mono>{r.participant_code}</Td>
              <Td mono>{r.order_group}</Td>
              <Td>
                <StatusBadge status={r.status ?? ""} />
              </Td>
              <Td>{r.is_valid ? "✓" : "—"}</Td>
              <Td mono>
                {r.completed_count}/{r.target_count}
              </Td>
              <Td mono>{fmtSec(r.avg_wall_seconds)}</Td>
              <Td>{r.has_technical_issue ? <span className="text-red-700">있음</span> : ""}</Td>
              <Td className="text-xs">{fmtDate(r.last_seen_at)}</Td>
              <Td>
                <Link className="underline" href={`/admin/participants/${r.participant_id}`}>
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
