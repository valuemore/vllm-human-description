import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeTextStats } from "@/lib/text-stats";
import { computeTimerState } from "@/lib/timer";
import { createParticipant, createStudyFixture, expectError, groupIdByIndex, observationsOf, one, pool, q, type Fixture } from "./helpers";

let f: Fixture;

beforeAll(async () => {
  f = await createStudyFixture({ n: 5, participantTarget: 20 });
});

afterAll(async () => {
  await pool.end();
});

describe("순서그룹 생성 (N=5, P=20)", () => {
  it("O1~O5 순환 라틴방진, 그룹당 목표 4", async () => {
    const groups = await q<{ code: string; group_index: number; target_participants: number; sequence: string }>(
      `select code, group_index, target_participants, sequence from v_order_group_balance where study_id = $1 order by group_index`,
      [f.studyId],
    );
    expect(groups.map((g) => g.code)).toEqual(["O1", "O2", "O3", "O4", "O5"]);
    expect(groups.every((g) => g.target_participants === 4)).toBe(true);
    expect(groups[0].sequence).toBe("V01 → V02 → V03 → V04 → V05");
    expect(groups[2].sequence).toBe("V03 → V04 → V05 → V01 → V02");
    expect(groups[4].sequence).toBe("V05 → V01 → V02 → V03 → V04");
  });

  it("20명 배정 후 균형 검증 4항목 PASS", async () => {
    for (let i = 1; i <= 20; i++) {
      await createParticipant(f, `T${String(i).padStart(2, "0")}`, ((i - 1) % 5) + 1);
    }
    const checks = await q<{ check_name: string; expected: number; actual: number; pass: boolean }>(
      `select check_name, expected, actual, pass from v_order_balance_check where study_id = $1`,
      [f.studyId],
    );
    expect(checks).toHaveLength(5);
    for (const c of checks) expect(c.pass, c.check_name).toBe(true);
    expect(checks.find((c) => c.check_name === "video_position_occurrence")!.expected).toBe(4);
    const kpi = await one<{ registered_participants: number; total_observation_target: number; per_group_target: number }>(
      `select registered_participants, total_observation_target, per_group_target from v_dashboard_kpi where study_id = $1`,
      [f.studyId],
    );
    expect(kpi.registered_participants).toBe(20);
    expect(kpi.total_observation_target).toBe(100);
    expect(kpi.per_group_target).toBe(4);
  });

  it("참여자 생성 시 본 관찰 5건 + 연습 1건 (그룹 순서대로)", async () => {
    const p = await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T03'`, [f.studyId]);
    const obs = await observationsOf(p.id);
    const main = obs.filter((o) => !o.is_practice);
    expect(main).toHaveLength(5);
    expect(main.map((o) => o.presentation_order)).toEqual([1, 2, 3, 4, 5]);
    // T03 은 O3: V03 → V04 → V05 → V01 → V02
    expect(main.map((o) => f.videoIds.indexOf(o.video_id) + 1)).toEqual([3, 4, 5, 1, 2]);
    expect(obs.filter((o) => o.is_practice)).toHaveLength(1);
    expect(main.every((o) => o.status === "pending")).toBe(true);
  });

  it("배정표에 없는 관찰은 생성 불가", async () => {
    const p = await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T01'`, [f.studyId]);
    await expectError(
      q(`insert into observations (study_id, participant_id, video_id, order_group_id, presentation_order, attempt_number)
         values ($1, $2, $3, (select order_group_id from participants where id = $2), 1, 9)`, [f.studyId, p.id, f.videoIds[2]]),
      "ASSIGNMENT_REQUIRED",
    );
  });
});

describe("시작 전 순서그룹 변경 / 잠금", () => {
  it("change_order_group: 시작 전 참여자는 재배정 (사유 필수)", async () => {
    const p = await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T20'`, [f.studyId]);
    const g1 = await groupIdByIndex(f.studyId, 1);
    await expectError(q(`select change_order_group($1, $2, null, '')`, [p.id, g1]), "REASON_REQUIRED");
    await q(`select change_order_group($1, $2, null, '대체 배정')`, [p.id, g1]);
    const obs = (await observationsOf(p.id)).filter((o) => !o.is_practice);
    expect(obs.map((o) => f.videoIds.indexOf(o.video_id) + 1)).toEqual([1, 2, 3, 4, 5]);
    // 되돌리기 (균형 유지)
    const g5 = await groupIdByIndex(f.studyId, 5);
    await q(`select change_order_group($1, $2, null, '원복')`, [p.id, g5]);
    // 직접 UPDATE 는 거부
    await expectError(q(`update participants set order_group_id = $2 where id = $1`, [p.id, g1]), "ADMIN_OVERRIDE_REQUIRED");
  });

  it("participant_target 변경은 그룹 목표를 동기화하고 이력을 남긴다", async () => {
    await q(`select update_study_settings($1, '{"participant_target": 25}'::jsonb, null, '증원')`, [f.studyId]);
    const g = await one<{ target_participants: number }>(`select target_participants from order_groups where study_id = $1 limit 1`, [f.studyId]);
    expect(g.target_participants).toBe(5);
    const hist = await q<{ setting_key: string; new_value: number }>(
      `select setting_key, new_value from study_settings where study_id = $1 and setting_key = 'participant_target'`,
      [f.studyId],
    );
    expect(hist).toHaveLength(1);
    expect(hist[0].new_value).toBe(25);
    await q(`select update_study_settings($1, '{"participant_target": 20}'::jsonb, null, '원복')`, [f.studyId]);
    await expectError(q(`update study_settings set reason = 'x' where study_id = $1`, [f.studyId]), "APPEND_ONLY");
  });
});

describe("관찰 진행: 시작 → 첫 시청 → 제출", () => {
  let obsId: string;
  let participantId: string;

  it("start_observation 은 started_at 을 1회만 설정하고 구조를 잠근다", async () => {
    participantId = (await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T01'`, [f.studyId])).id;
    const obs = (await observationsOf(participantId)).filter((o) => !o.is_practice);
    obsId = obs[0].id;
    // 서버는 ms 단위 시각을 넘긴다 (JS Date 와 동일 정밀도)
    const started = await one<{ started_at: string; status: string; deadline_at: string }>(
      `select o.started_at, o.status, o.deadline_at from start_observation($1, $2) o`, [obsId, new Date()],
    );
    expect(started.status).toBe("in_progress");
    expect(new Date(started.deadline_at).getTime() - new Date(started.started_at).getTime()).toBe(300_000);

    const again = await one<{ started_at: string }>(`select o.started_at from start_observation($1) o`, [obsId]);
    expect(again.started_at).toEqual(started.started_at);

    await expectError(q(`update observations set started_at = now() where id = $1`, [obsId]), "STARTED_AT_IMMUTABLE");

    const study = await one<{ structure_locked_at: string | null }>(`select structure_locked_at from studies where id = $1`, [f.studyId]);
    expect(study.structure_locked_at).not.toBeNull();
    const p = await one<{ status: string; started_at: string | null }>(`select status, started_at from participants where id = $1`, [participantId]);
    expect(p.status).toBe("in_progress");
    expect(p.started_at).not.toBeNull();
  });

  it("잠금 후: 영상 편수·연구영상 추가·순서그룹 재생성·시작 참여자 그룹 변경 거부, 참여자 증원은 허용", async () => {
    await expectError(q(`update studies set research_video_count = 6 where id = $1`, [f.studyId]), "STRUCTURE_LOCKED");
    await expectError(
      q(`insert into videos (study_id, code, kind, title_admin) values ($1, 'V06', 'research', 'x')`, [f.studyId]),
      "STRUCTURE_LOCKED",
    );
    await expectError(q(`select regenerate_order_groups($1, null)`, [f.studyId]), "STRUCTURE_LOCKED");
    await expectError(q(`update studies set structure_locked_at = null where id = $1`, [f.studyId]), "STRUCTURE_LOCK_IMMUTABLE");
    const g2 = await groupIdByIndex(f.studyId, 2);
    await expectError(q(`select change_order_group($1, $2, null, '사유')`, [participantId, g2]), "PARTICIPANT_STARTED");
    await q(`select update_study_settings($1, '{"participant_target": 24}'::jsonb, null, '증원')`, [f.studyId]);
    await q(`select update_study_settings($1, '{"participant_target": 20}'::jsonb, null, '원복')`, [f.studyId]);
    // 연습영상 교체는 잠금과 무관
    await q(`update videos set title_admin = '제목 변경' where id = $1`, [f.videoIds[0]]);
  });

  it("타이머: 이벤트 기반 buffering 이 TS 구현과 일치", async () => {
    const started = (await one<{ started_at: string }>(`select started_at from observations where id = $1`, [obsId])).started_at;
    const t0 = new Date(started).getTime();
    const ev = (type: string, sec: number, meta = "{}") =>
      q(`insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp, metadata_json)
         values ($1, $2, $3, $4::event_type, $5, $6::jsonb)`, [obsId, participantId, f.videoIds[0], type, new Date(t0 + sec * 1000), meta]);
    await ev("video_first_play_started", 0.1);
    await ev("video_buffer_start", 5);
    await ev("video_buffer_end", 7.5);
    await ev("video_buffer_start", 20);
    await ev("video_play", 24); // 짝 없는 start → play 에서 닫힘 (4초)
    await ev("video_first_play_completed", 45);
    await ev("video_play", 60, '{"is_replay": true}');
    await ev("video_pause", 70);
    await ev("video_seek", 72, '{"from_ms": 10000, "to_ms": 5000}');
    await ev("video_seek", 75, '{"from_ms": 5000, "to_ms": 15000}');
    await ev("page_hidden", 80);
    await ev("page_visible", 83, '{"hidden_ms": 3000}');

    const now = new Date(t0 + 100_000);
    const db = await one<{ wall_elapsed_seconds: string; buffering_seconds: string; effective_elapsed_seconds: string; remaining_seconds: string; expired: boolean }>(
      `select * from observation_timer_state($1, $2)`, [obsId, now],
    );
    const events = await q<{ event_type: string; event_timestamp: string }>(`select event_type, event_timestamp from observation_events where observation_id = $1`, [obsId]);
    const ts = computeTimerState({
      startedAt: started, maxSeconds: 300, timerMode: "effective_time", now,
      events: events.map((e) => ({ eventType: e.event_type, eventTimestamp: e.event_timestamp })),
    });
    expect(Number(db.buffering_seconds)).toBe(6.5);
    expect(Number(db.buffering_seconds)).toBe(ts.bufferingSeconds);
    expect(Number(db.wall_elapsed_seconds)).toBe(ts.wallElapsedSeconds);
    expect(Number(db.effective_elapsed_seconds)).toBe(ts.effectiveElapsedSeconds);
    expect(Number(db.remaining_seconds)).toBe(ts.remainingSeconds);
    expect(db.expired).toBe(false);
  });

  it("이벤트는 append-only", async () => {
    await expectError(q(`update observation_events set metadata_json = '{}' where observation_id = $1`, [obsId]), "APPEND_ONLY");
    await expectError(q(`delete from observation_events where observation_id = $1`, [obsId]), "APPEND_ONLY");
  });

  it("첫 시청 전 manual 제출 거부, 첫 시청 후 제출 시 텍스트 동결·통계·카운터 파생", async () => {
    await expectError(q(`select submit_observation($1, 'manual')`, [obsId]), "FIRST_WATCH_REQUIRED");
    const started = (await one<{ started_at: string }>(`select started_at from observations where id = $1`, [obsId])).started_at;
    const fw = new Date(new Date(started).getTime() + 45_000);
    await q(`update observations set first_watch_completed_at = $2 where id = $1`, [obsId, fw]);
    await expectError(q(`update observations set first_watch_completed_at = now() where id = $1`, [obsId]), "FIRST_WATCH_IMMUTABLE");

    const text = "아동 A가 오른손으로 블록을 집는다. 아동 B를 바라본다.\n블록을 내려놓는다";
    await q(`update observations set draft_text = $2, draft_revision = 3, draft_saved_at = now() where id = $1`, [obsId, text]);
    const submitted = await one<{
      status: string; observation_text: string; submission_type: string; timed_out: boolean;
      character_count: number; word_count: number; sentence_count: number;
      replay_count: number; pause_count: number; seek_count: number; page_hidden_count: number; page_hidden_seconds: string;
      first_watch_seconds: string; buffering_seconds: string;
      wall_elapsed_seconds: string;
    }>(`select * from submit_observation($1, 'manual', $2)`, [obsId, new Date(new Date(started).getTime() + 100_000)]);
    expect(submitted.status).toBe("submitted");
    expect(Number(submitted.wall_elapsed_seconds)).toBe(100);
    expect(submitted.observation_text).toBe(text);
    expect(submitted.submission_type).toBe("manual");
    expect(submitted.timed_out).toBe(false);
    const ts = computeTextStats(text);
    expect(submitted.character_count).toBe(ts.characterCount);
    expect(submitted.word_count).toBe(ts.wordCount);
    expect(submitted.sentence_count).toBe(ts.sentenceCount);
    expect(submitted.replay_count).toBe(1);
    expect(submitted.pause_count).toBe(1);
    expect(submitted.seek_count).toBe(2);
    expect(submitted.page_hidden_count).toBe(1);
    expect(Number(submitted.page_hidden_seconds)).toBe(3);
    expect(Number(submitted.first_watch_seconds)).toBe(45);
    expect(Number(submitted.buffering_seconds)).toBe(6.5);

    const evs = await q<{ event_type: string }>(`select event_type from observation_events where observation_id = $1 and event_type = 'observation_submitted'`, [obsId]);
    expect(evs).toHaveLength(1);
    // 재제출은 idempotent
    const again = await one<{ status: string; submitted_at: string }>(`select status, submitted_at from submit_observation($1, 'manual')`, [obsId]);
    expect(again.status).toBe("submitted");
  });

  it("제출된 기록은 수정·삭제 불가, 플래그만 허용", async () => {
    await expectError(q(`update observations set observation_text = '변조' where id = $1`, [obsId]), "SUBMITTED_IMMUTABLE");
    await expectError(q(`update observations set draft_text = '변조' where id = $1`, [obsId]), "SUBMITTED_IMMUTABLE");
    await expectError(q(`update observations set status = 'in_progress' where id = $1`, [obsId]), "SUBMITTED_IMMUTABLE");
    await expectError(q(`delete from observations where id = $1`, [obsId]), "NO_DELETE");
    await q(`update observations set technical_issue = true where id = $1`, [obsId]);
    await q(`update observations set technical_issue = false where id = $1`, [obsId]);
    // 제출 직후 도착한 late 이벤트는 30초 유예 내 허용 + late 표시
    await q(`insert into observation_events (observation_id, participant_id, video_id, event_type) values ($1, $2, $3, 'page_hidden')`, [obsId, participantId, f.videoIds[0]]);
    const late = await one<{ metadata_json: { late?: boolean } }>(`select metadata_json from observation_events where observation_id = $1 order by id desc limit 1`, [obsId]);
    expect(late.metadata_json.late).toBe(true);
  });

  it("무효화 + 재시도: 기존 기록 보존, attempt 2 생성, 무효화 기록은 변경 불가", async () => {
    await expectError(q(`update observations set invalidated = true where id = $1`, [obsId]), "INVALIDATION_REASON_REQUIRED");
    const retry = await one<{ id: string; attempt_number: number; status: string; presentation_order: number }>(
      `select * from invalidate_and_retry($1, '네트워크 단절', null)`, [obsId],
    );
    expect(retry.attempt_number).toBe(2);
    expect(retry.status).toBe("pending");
    expect(retry.presentation_order).toBe(1);
    const old = await one<{ status: string; invalidated: boolean; observation_text: string; invalidated_at: string }>(`select * from observations where id = $1`, [obsId]);
    expect(old.status).toBe("invalidated");
    expect(old.invalidated).toBe(true);
    expect(old.observation_text).toContain("아동 A");
    await expectError(q(`update observations set technical_issue = false where id = $1`, [obsId]), "INVALIDATED_IMMUTABLE");
    await expectError(q(`select invalidate_and_retry($1, 'x', null)`, [obsId]), "ALREADY_INVALIDATED");
    await expectError(
      q(`insert into observation_events (observation_id, participant_id, video_id, event_type) values ($1, $2, $3, 'video_play')`, [obsId, participantId, f.videoIds[0]]),
      "OBSERVATION_CLOSED",
    );
    const audits = await q<{ action: string }>(`select action from audit_logs where target_id in ($1, $2) order by created_at`, [obsId, retry.id]);
    expect(audits.map((a) => a.action)).toEqual(["observation_invalidated", "observation_retry_created"]);
    await expectError(q(`delete from audit_logs where target_id = $1`, [obsId]), "APPEND_ONLY");
    // 유효 기록 수에서 제외
    const vp = await one<{ valid_count: number; invalidated_count: number }>(`select valid_count, invalidated_count from v_video_progress where video_id = $1`, [f.videoIds[0]]);
    expect(vp.valid_count).toBe(0);
    expect(vp.invalidated_count).toBe(1);
  });

  it("timeout: 만료된 진행 중 관찰은 finalize 로 자동제출 (submitted_at = 마감 시각)", async () => {
    const obs = (await observationsOf(participantId)).filter((o) => !o.is_practice && o.presentation_order === 2);
    const startedAt = new Date(Date.now() - 400_000);
    await q(`select start_observation($1, $2)`, [obs[0].id, startedAt]);
    const before = await one<{ remaining_seconds: string; expired: boolean }>(`select remaining_seconds, expired from observation_timer_state($1)`, [obs[0].id]);
    expect(before.expired).toBe(true);
    const n = await one<{ n: number }>(`select finalize_expired_observations($1) as n`, [participantId]);
    expect(n.n).toBe(1);
    const done = await one<{ status: string; submission_type: string; timed_out: boolean; submitted_at: string; observation_text: string; wall_elapsed_seconds: string }>(
      `select * from observations where id = $1`, [obs[0].id],
    );
    expect(done.status).toBe("submitted");
    expect(done.submission_type).toBe("timeout");
    expect(done.timed_out).toBe(true);
    expect(done.observation_text).toBe("");
    expect(new Date(done.submitted_at).getTime() - startedAt.getTime()).toBe(300_000);
    expect(Number(done.wall_elapsed_seconds)).toBe(300);
    const ev = await q(`select 1 from observation_events where observation_id = $1 and event_type = 'timeout_submitted'`, [obs[0].id]);
    expect(ev).toHaveLength(1);
  });

  it("모든 본 관찰 제출 → 참여자 completed (세션은 완료 화면을 위해 유지)", async () => {
    await q(`insert into participant_sessions (participant_id, expires_at) values ($1, now() + interval '12 hours')`, [participantId]);
    const pending = (await observationsOf(participantId)).filter((o) => !o.is_practice && o.status === "pending");
    for (const o of pending) {
      await q(`select start_observation($1)`, [o.id]);
      await q(`update observations set first_watch_completed_at = now(), draft_text = '기록' where id = $1`, [o.id]);
      await q(`select submit_observation($1, 'manual')`, [o.id]);
    }
    const p = await one<{ status: string; completed_at: string | null }>(`select status, completed_at from participants where id = $1`, [participantId]);
    expect(p.status).toBe("completed");
    expect(p.completed_at).not.toBeNull();
    const sessions = await q<{ revoked_at: string | null }>(`select revoked_at from participant_sessions where participant_id = $1`, [participantId]);
    expect(sessions.every((s) => s.revoked_at === null)).toBe(true);
    const prog = await one<{ completed_count: number; target_count: number }>(`select completed_count, target_count from v_participant_progress where participant_id = $1`, [participantId]);
    expect(prog.completed_count).toBe(5);
    expect(prog.target_count).toBe(5);
    const master = await q<{ is_valid_record: boolean; attempt_number: number }>(`select is_valid_record, attempt_number from v_research_master where study_id = $1 and participant_code = 'T01' order by presentation_order, attempt_number`, [f.studyId]);
    expect(master).toHaveLength(6); // 5 유효 + 1 무효화
    expect(master.filter((m) => m.is_valid_record)).toHaveLength(5);
  });

  it("연습 관찰 제출 → practice_completed (분석 뷰에서 제외)", async () => {
    const p2 = (await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T02'`, [f.studyId])).id;
    const practice = (await observationsOf(p2)).find((o) => o.is_practice)!;
    await q(`select start_observation($1)`, [practice.id]);
    await q(`update observations set first_watch_completed_at = now(), draft_text = '연습' where id = $1`, [practice.id]);
    await q(`select submit_observation($1, 'manual')`, [practice.id]);
    const p = await one<{ status: string }>(`select status from participants where id = $1`, [p2]);
    expect(p.status).toBe("practice_completed");
    const valid = await q(`select 1 from v_valid_observations where participant_id = $1`, [p2]);
    expect(valid).toHaveLength(0);
  });

  it("참여자 삭제 불가, withdraw 는 is_valid=false", async () => {
    const p2 = (await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T02'`, [f.studyId])).id;
    await expectError(q(`delete from participants where id = $1`, [p2]), "NO_DELETE");
    await q(`select withdraw_participant($1, null, '개인 사정')`, [p2]);
    const p = await one<{ status: string; is_valid: boolean }>(`select status, is_valid from participants where id = $1`, [p2]);
    expect(p.status).toBe("withdrawn");
    expect(p.is_valid).toBe(false);
    const gb = await one<{ assigned_valid: number; dropped: number }>(`select assigned_valid, dropped from v_order_group_balance where study_id = $1 and code = 'O2'`, [f.studyId]);
    expect(gb.assigned_valid).toBe(3);
    expect(gb.dropped).toBe(1);
  });
});

describe("영상 편수 변경 (N=5 → 7, 시작 전)", () => {
  it("재생성 시 그룹 7개, 기존 참여자 재배정, 참여자당 7건", async () => {
    const g = await createStudyFixture({ n: 5, participantTarget: 21 });
    await createParticipant(g, "T01", 1);
    await createParticipant(g, "T02", 2);
    await createParticipant(g, "T03", 3);
    // 편수 7로 변경 → 영상 2편 추가 → 재생성
    await q(`select update_study_settings($1, '{"research_video_count": 7}'::jsonb, null, '설계 변경')`, [g.studyId]);
    await expectError(q(`select regenerate_order_groups($1, null)`, [g.studyId]), "VIDEO_COUNT_MISMATCH");
    for (const i of [6, 7]) {
      await q(`insert into videos (study_id, code, kind, title_admin, storage_path, duration_ms, sort_order) values ($1, $2, 'research', $2, $3, 40000, $4)`,
        [g.studyId, `V0${i}`, `studies/${g.studyId}/videos/V0${i}.mp4`, i]);
    }
    const n = await one<{ n: number }>(`select regenerate_order_groups($1, null) as n`, [g.studyId]);
    expect(n.n).toBe(7);
    const groups = await q<{ code: string; target_participants: number; generation: number; sequence: string }>(
      `select code, target_participants, generation, sequence from v_order_group_balance where study_id = $1 order by group_index`, [g.studyId]);
    expect(groups.map((x) => x.code)).toEqual(["O1", "O2", "O3", "O4", "O5", "O6", "O7"]);
    expect(groups.every((x) => x.target_participants === 3 && x.generation === 2)).toBe(true);
    expect(groups[6].sequence).toBe("V07 → V01 → V02 → V03 → V04 → V05 → V06");
    const p = await one<{ id: string }>(`select id from participants where study_id = $1 and participant_code = 'T03'`, [g.studyId]);
    const obs = (await observationsOf(p.id)).filter((o) => !o.is_practice);
    expect(obs).toHaveLength(7);
    const checks = await q<{ check_name: string; pass: boolean }>(`select check_name, pass from v_order_balance_check where study_id = $1`, [g.studyId]);
    expect(checks.find((c) => c.check_name === "participant_video_count")!.pass).toBe(true);
    expect(checks.find((c) => c.check_name === "balanced_possible")!.pass).toBe(true);
    const audit = await q(`select 1 from audit_logs where study_id = $1 and action = 'order_groups_regenerated'`, [g.studyId]);
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});

describe("AI run / Reference event 불변성", () => {
  it("ai_runs: generated_text 변경·삭제 거부, notes 변경 허용", async () => {
    const prompt = await one<{ id: string }>(`insert into ai_prompts (study_id, prompt_code, version, prompt_text, active) values ($1, 'observe', 1, '프롬프트', true) returning id`, [f.studyId]);
    const run = await one<{ id: string }>(
      `insert into ai_runs (study_id, video_id, run_number, provider, model_name, prompt_version_id, prompt_text_snapshot, generated_text)
       values ($1, $2, 1, 'google', 'gemini', $3, '프롬프트', '아동이 블록을 집는다.') returning id`, [f.studyId, f.videoIds[0], prompt.id]);
    await expectError(q(`update ai_runs set generated_text = '변조' where id = $1`, [run.id]), "AI_RUN_IMMUTABLE");
    await expectError(q(`delete from ai_runs where id = $1`, [run.id]), "NO_DELETE");
    await q(`update ai_runs set notes = '메모' where id = $1`, [run.id]);
  });

  it("reference_events: 변경 전 스냅샷 저장, 물리 삭제 거부", async () => {
    const ev = await one<{ id: string }>(
      `insert into reference_events (study_id, video_id, event_code, event_order, start_ms, end_ms, actor, action, object)
       values ($1, $2, 'E01', 1, 3000, 5000, '아동 A', '집는다', '빨간 블록') returning id`, [f.studyId, f.videoIds[0]]);
    await q(`update reference_events set action = '잡는다' where id = $1`, [ev.id]);
    await expectError(q(`delete from reference_events where id = $1`, [ev.id]), "USE_SOFT_DELETE");
    await q(`update reference_events set deleted_at = now() where id = $1`, [ev.id]);
    const versions = await q<{ operation: string; snapshot: { action: string } }>(`select operation, snapshot from reference_event_versions where reference_event_id = $1 order by id`, [ev.id]);
    expect(versions.map((v) => v.operation)).toEqual(["update", "delete"]);
    expect(versions[0].snapshot.action).toBe("집는다");
    await expectError(q(`update reference_event_versions set operation = 'x' where reference_event_id = $1`, [ev.id]), "APPEND_ONLY");
  });
});

describe("compute_text_stats ↔ TS 동등성", () => {
  it.each([
    "",
    "아동 A가 오른손으로 블록을 집는다. 아동 B를 바라본다.\n블록을 내려놓는다",
    "정말?! 그래... 응.",
    "첫 줄\n\n둘째 줄\n셋째 줄",
    "   공백   많은   문장   ",
  ])("%j", async (text) => {
    const db = await one<{ character_count: number; word_count: number; sentence_count: number }>(`select * from compute_text_stats($1)`, [text]);
    const ts = computeTextStats(text);
    expect(db).toEqual({ character_count: ts.characterCount, word_count: ts.wordCount, sentence_count: ts.sentenceCount });
  });
});
