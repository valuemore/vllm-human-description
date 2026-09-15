import { ActionForm, Field, inputCls } from "@/components/admin/ActionForm";
import { Notice, PageHeader, Section, StatusBadge, Table, Td, fmtDate } from "@/components/admin/ui";
import { getServiceClient } from "@/lib/db/service-client";
import { STATUS_TRANSITIONS, getCurrentStudy, getSettingsHistory, getTargets } from "@/lib/services/admin/study";
import { setStatusAction, updateSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const study = await getCurrentStudy();
  const [history, targets, practiceVideos] = await Promise.all([
    getSettingsHistory(study.id),
    getTargets(study.id),
    getServiceClient().from("videos").select("id, code, title_admin").eq("study_id", study.id).eq("kind", "practice").eq("active", true),
  ]);
  const locked = !!study.structure_locked_at;
  const active = study.status === "active";
  const bool = (v: boolean) => (v ? "true" : "false");

  return (
    <>
      <PageHeader title="연구 설정" description={`${study.code} · 상태 ${study.status}`} />
      {active && <Notice tone="warn">진행 중(active) 연구입니다. 실험조건 변경에는 사유가 필수이며 변경 이력이 기록됩니다.</Notice>}
      {locked && <Notice tone="info">구조 잠김 ({fmtDate(study.structure_locked_at)}): 영상 편수는 변경할 수 없습니다. 참여자 수는 조정할 수 있습니다.</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="연구 규모">
          <ActionForm action={updateSettingsAction} submitLabel="저장">
            <Field label="연구 이름">
              <input name="name" defaultValue={study.name} className={inputCls} />
            </Field>
            <Field label="목표 참여자 수 (P)" hint={`그룹당 목표 = ceil(P/N) = ${targets.per_group_target}${targets.balanced_possible ? "" : " (균형 불가 경고)"}`}>
              <input name="participant_target" type="number" min={1} defaultValue={study.participant_target} className={inputCls} />
            </Field>
            <Field label="연구영상 편수 (N)" hint={locked ? "잠김" : "변경 후: 영상 등록 → 순서그룹 재생성"}>
              <input name="research_video_count" type="number" min={2} max={20} defaultValue={study.research_video_count} className={inputCls} disabled={locked} />
            </Field>
            <Field label="변경 사유">
              <input name="reason" className={inputCls} placeholder={active ? "필수" : "선택"} />
            </Field>
          </ActionForm>
        </Section>

        <Section title="실험 조건">
          <ActionForm action={updateSettingsAction} submitLabel="저장">
            <div className="grid grid-cols-2 gap-3">
              <Field label="영상별 제한시간 (초)" hint="비우면 영상별 제한 없음">
                <input name="max_observation_seconds" type="number" min={30} max={3600} defaultValue={study.max_observation_seconds ?? ""} className={inputCls} />
              </Field>
              <Field label="전체 제한시간 (초)" hint="첫 본 관찰 첫 재생부터, wall time. 비우면 전체 제한 없음">
                <input name="total_time_limit_seconds" type="number" min={60} max={86400} defaultValue={study.total_time_limit_seconds ?? ""} className={inputCls} />
              </Field>
              <Field label="타이머 기준">
                <select name="timer_mode" defaultValue={study.timer_mode} className={inputCls}>
                  <option value="effective_time">effective_time (buffering 차감)</option>
                  <option value="wall_time">wall_time</option>
                </select>
              </Field>
              <Field label="첫 시청 seek 허용">
                <select name="first_watch_seek_enabled" defaultValue={bool(study.first_watch_seek_enabled)} className={inputCls}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </Field>
              <Field label="첫 시청 pause 허용">
                <select name="first_watch_pause_enabled" defaultValue={bool(study.first_watch_pause_enabled)} className={inputCls}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </Field>
              <Field label="재시청 허용">
                <select name="replay_enabled" defaultValue={bool(study.replay_enabled)} className={inputCls}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </Field>
              <Field label="모바일 허용">
                <select name="mobile_allowed" defaultValue={bool(study.mobile_allowed)} className={inputCls}>
                  <option value="false">false</option>
                  <option value="true">true</option>
                </select>
              </Field>
              <Field label="워터마크">
                <select name="watermark_enabled" defaultValue={bool(study.watermark_enabled)} className={inputCls}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </Field>
              <Field label="AI run / 영상">
                <input name="ai_runs_per_video" type="number" min={1} max={5} defaultValue={study.ai_runs_per_video} className={inputCls} />
              </Field>
              <Field label="연습영상">
                <select name="practice_video_id" defaultValue={study.practice_video_id ?? ""} className={inputCls}>
                  <option value="">없음</option>
                  {(practiceVideos.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} {v.title_admin}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="동의문 버전">
                <input name="consent_version" defaultValue={study.consent_version} className={inputCls} />
              </Field>
            </div>
            <Field label="변경 사유">
              <input name="reason" className={inputCls} placeholder={active ? "필수" : "선택"} />
            </Field>
          </ActionForm>
        </Section>
      </div>

      <Section title="연구 상태">
        <div className="flex items-center gap-3">
          <StatusBadge status={study.status} />
          <ActionForm action={setStatusAction} submitLabel="상태 변경" confirm="연구 상태를 변경할까요?">
            <div className="flex items-end gap-2">
              <Field label="새 상태">
                <select name="status" className={inputCls}>
                  {STATUS_TRANSITIONS[study.status].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="사유">
                <input name="reason" className={inputCls} />
              </Field>
            </div>
          </ActionForm>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          draft → pilot/ready → active → paused/closed → archived. active 전환에는 연습영상, 파일이 등록된 연구영상 N편, 순서그룹 N개가 필요합니다. 참여자는 active(또는 pilot)에서만 접속할 수 있습니다.
        </p>
      </Section>

      <Section title="설정 변경 이력">
        <Table head={["시각", "항목", "이전", "이후", "사유"]} empty="변경 이력이 없습니다">
          {history.map((h) => (
            <tr key={h.id}>
              <Td className="text-xs">{fmtDate(h.created_at)}</Td>
              <Td mono>{h.setting_key}</Td>
              <Td mono className="text-xs">{JSON.stringify(h.old_value)}</Td>
              <Td mono className="text-xs">{JSON.stringify(h.new_value)}</Td>
              <Td className="text-xs">{h.reason}</Td>
            </tr>
          ))}
        </Table>
      </Section>
    </>
  );
}
