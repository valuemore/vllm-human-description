import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeTimerState } from "@/lib/timer";
import { createParticipant, createStudyFixture, expectError, observationsOf, one, pool, q, type Fixture } from "./helpers";

/**
 * 0010: 영상별 제한 없음 + 참여자 전체 제한(wall time).
 * 전체 마감 = 첫 본 관찰 started_at + total_time_limit_seconds. 마감 후 시작한 관찰은 제한 없이 진행(플래그).
 */
let f: Fixture;
let participantId: string;
const TOTAL = 2400;

beforeAll(async () => {
  f = await createStudyFixture({ n: 3, participantTarget: 6 });
  await q(`select update_study_settings($1, '{"max_observation_seconds": null, "total_time_limit_seconds": ${TOTAL}}'::jsonb, null, '전체 제한 도입')`, [f.studyId]);
  participantId = (await createParticipant(f, "T01", 1)).id;
});

afterAll(async () => {
  await pool.end();
});

describe("설정", () => {
  it("영상별 제한 null 허용, 전체 제한 범위 검사, 변경 이력 기록", async () => {
    const s = await one<{ max_observation_seconds: number | null; total_time_limit_seconds: number | null }>(
      `select max_observation_seconds, total_time_limit_seconds from studies where id = $1`, [f.studyId],
    );
    expect(s.max_observation_seconds).toBeNull();
    expect(s.total_time_limit_seconds).toBe(TOTAL);
    await expectError(q(`update studies set total_time_limit_seconds = 10 where id = $1`, [f.studyId]), "check");
    const hist = await q<{ setting_key: string; new_value: unknown }>(`select setting_key, new_value from study_settings where study_id = $1 order by created_at`, [f.studyId]);
    expect(hist.map((h) => h.setting_key)).toEqual(expect.arrayContaining(["max_observation_seconds", "total_time_limit_seconds"]));
  });

  it("active 연구에서는 사유 없이 전체 제한을 바꿀 수 없다", async () => {
    await q(`update studies set status = 'ready' where id = $1`, [f.studyId]);
    await q(`select set_study_status($1, 'active', null, null)`, [f.studyId]);
    await expectError(q(`update studies set total_time_limit_seconds = 3000 where id = $1`, [f.studyId]), "ACTIVE_STUDY_LOCKED");
    await q(`select update_study_settings($1, '{"total_time_limit_seconds": ${TOTAL}}'::jsonb, null, '동일값')`, [f.studyId]);
  });
});

describe("연습 관찰에는 전체 제한을 적용하지 않는다", () => {
  it("연습 시작 → deadline null, 참여자 main_deadline_at 미설정", async () => {
    const practice = (await observationsOf(participantId)).find((o) => o.is_practice)!;
    const started = await one<{ deadline_at: string | null }>(`select o.deadline_at from start_observation($1) o`, [practice.id]);
    expect(started.deadline_at).toBeNull();
    const t = await one<{ remaining_seconds: string | null; limit_kind: string; expired: boolean }>(`select * from observation_timer_state($1)`, [practice.id]);
    expect(t.remaining_seconds).toBeNull();
    expect(t.limit_kind).toBe("none");
    expect(t.expired).toBe(false);
    const p = await one<{ main_deadline_at: string | null }>(`select main_deadline_at from participants where id = $1`, [participantId]);
    expect(p.main_deadline_at).toBeNull();
    // 제한 없는 관찰은 timeout 제출 불가, finalize 도 건드리지 않는다
    await expectError(q(`select submit_observation($1, 'timeout')`, [practice.id]), "NO_DEADLINE");
    expect((await one<{ n: number }>(`select finalize_expired_observations($1) as n`, [participantId])).n).toBe(0);
    await q(`update observations set first_watch_completed_at = now() where id = $1`, [practice.id]);
    await q(`select submit_observation($1, 'manual')`, [practice.id]);
  });
});

describe("본 관찰: 전체 마감", () => {
  const t0 = new Date(Date.now() - 1000_000); // 첫 본 관찰 시작 시각 (테스트 안정성을 위해 과거 고정)
  let obs: Awaited<ReturnType<typeof observationsOf>>;

  it("첫 본 관찰 시작 전: 마감 미확정이라 설정값 전체(TOTAL)를 표시", async () => {
    obs = (await observationsOf(participantId)).filter((o) => !o.is_practice);
    const t = await one<{ remaining_seconds: string; limit_kind: string; expired: boolean }>(`select * from observation_timer_state($1)`, [obs[0].id]);
    expect(Number(t.remaining_seconds)).toBe(TOTAL);
    expect(t.limit_kind).toBe("total");
    expect(t.expired).toBe(false);
  });

  it("첫 본 관찰 시작 → 참여자 main_deadline_at = started_at + TOTAL, 관찰 deadline 동일", async () => {
    const started = await one<{ started_at: string; deadline_at: string }>(`select o.started_at, o.deadline_at from start_observation($1, $2) o`, [obs[0].id, t0]);
    expect(new Date(started.deadline_at).getTime() - new Date(started.started_at).getTime()).toBe(TOTAL * 1000);
    const p = await one<{ main_deadline_at: string; started_at: string }>(`select main_deadline_at, started_at from participants where id = $1`, [participantId]);
    expect(new Date(p.main_deadline_at).getTime()).toBe(t0.getTime() + TOTAL * 1000);
    expect(new Date(p.started_at).getTime()).toBe(t0.getTime());

    const now = new Date(t0.getTime() + 100_000);
    const t = await one<{ remaining_seconds: string; total_remaining_seconds: string; limit_kind: string; started_after_total_deadline: boolean; expired: boolean }>(
      `select * from observation_timer_state($1, $2)`, [obs[0].id, now],
    );
    expect(Number(t.remaining_seconds)).toBe(TOTAL - 100);
    expect(Number(t.total_remaining_seconds)).toBe(TOTAL - 100);
    expect(t.limit_kind).toBe("total");
    expect(t.started_after_total_deadline).toBe(false);
    expect(t.expired).toBe(false);
    const ts = computeTimerState({ startedAt: t0, maxSeconds: null, totalDeadlineAt: p.main_deadline_at, timerMode: "effective_time", now });
    expect(ts.remainingSeconds).toBe(Number(t.remaining_seconds));
    expect(ts.limitKind).toBe("total");
  });

  it("전체 제한은 wall time: buffering 이 있어도 남은 시간이 늘지 않는다", async () => {
    const base = new Date(t0.getTime());
    await q(`insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp)
             values ($1, $2, $3, 'video_buffer_start', $4), ($1, $2, $3, 'video_buffer_end', $5)`,
      [obs[0].id, participantId, obs[0].video_id, new Date(base.getTime() + 5000), new Date(base.getTime() + 15000)]);
    const now = new Date(t0.getTime() + 100_000);
    const t = await one<{ buffering_seconds: string; remaining_seconds: string }>(`select * from observation_timer_state($1, $2)`, [obs[0].id, now]);
    expect(Number(t.buffering_seconds)).toBe(10);
    expect(Number(t.remaining_seconds)).toBe(TOTAL - 100);
  });

  it("첫 관찰 수동 제출 → 두 번째 관찰은 시작 전에도 전체 남은 시간이 흐르고, 시작하면 같은 전체 마감을 받는다", async () => {
    await q(`update observations set first_watch_completed_at = $2 where id = $1`, [obs[0].id, new Date(t0.getTime() + 45_000)]);
    await q(`select submit_observation($1, 'manual', $2)`, [obs[0].id, new Date(t0.getTime() + 200_000)]);
    const beforeStart = await one<{ remaining_seconds: string; limit_kind: string; expired: boolean }>(
      `select * from observation_timer_state($1, $2)`, [obs[1].id, new Date(t0.getTime() + 600_000)],
    );
    expect(Number(beforeStart.remaining_seconds)).toBe(TOTAL - 600);
    expect(beforeStart.limit_kind).toBe("total");
    expect(beforeStart.expired).toBe(false);

    const second = await one<{ deadline_at: string }>(`select o.deadline_at from start_observation($1, $2) o`, [obs[1].id, new Date(t0.getTime() + 600_000)]);
    expect(new Date(second.deadline_at).getTime()).toBe(t0.getTime() + TOTAL * 1000);
  });

  it("전체 마감 도달 → 진행 중 관찰은 timeout 제출 (submitted_at = 전체 마감 시각)", async () => {
    const before = await one<{ expired: boolean }>(`select expired from observation_timer_state($1, $2)`, [obs[1].id, new Date(t0.getTime() + TOTAL * 1000 + 1000)]);
    expect(before.expired).toBe(true);
    const n = await one<{ n: number }>(`select finalize_expired_observations($1, $2) as n`, [participantId, new Date(t0.getTime() + TOTAL * 1000 + 1000)]);
    expect(n.n).toBe(1);
    const done = await one<{ status: string; submission_type: string; timed_out: boolean; submitted_at: string; wall_elapsed_seconds: string }>(
      `select * from observations where id = $1`, [obs[1].id],
    );
    expect(done.status).toBe("submitted");
    expect(done.submission_type).toBe("timeout");
    expect(done.timed_out).toBe(true);
    expect(new Date(done.submitted_at).getTime()).toBe(t0.getTime() + TOTAL * 1000);
    expect(Number(done.wall_elapsed_seconds)).toBe(TOTAL - 600);
  });

  it("전체 마감 이후 시작한 관찰: 제한 없이 진행, started_after_total_deadline 플래그, 참여자는 계속 진행 가능", async () => {
    const late = new Date(t0.getTime() + TOTAL * 1000 + 60_000);
    const pre = await one<{ remaining_seconds: string | null; limit_kind: string }>(`select * from observation_timer_state($1, $2)`, [obs[2].id, late]);
    expect(pre.remaining_seconds).toBeNull(); // 시작 전 화면도 "제한 없음"
    expect(pre.limit_kind).toBe("none");
    const third = await one<{ deadline_at: string | null; status: string }>(`select o.deadline_at, o.status from start_observation($1, $2) o`, [obs[2].id, late]);
    expect(third.deadline_at).toBeNull();
    expect(third.status).toBe("in_progress");
    const t = await one<{ remaining_seconds: string | null; limit_kind: string; started_after_total_deadline: boolean; expired: boolean }>(
      `select * from observation_timer_state($1, $2)`, [obs[2].id, new Date(late.getTime() + 5000_000)],
    );
    expect(t.remaining_seconds).toBeNull();
    expect(t.limit_kind).toBe("none");
    expect(t.started_after_total_deadline).toBe(true);
    expect(t.expired).toBe(false);
    expect((await one<{ n: number }>(`select finalize_expired_observations($1) as n`, [participantId])).n).toBe(0);

    await q(`update observations set first_watch_completed_at = $2 where id = $1`, [obs[2].id, new Date(late.getTime() + 45_000)]);
    await q(`select submit_observation($1, 'manual', $2)`, [obs[2].id, new Date(late.getTime() + 900_000)]);
    const p = await one<{ status: string }>(`select status from participants where id = $1`, [participantId]);
    expect(p.status).toBe("completed");

    const master = await q<{ video_code: string; started_after_total_deadline: boolean; seconds_since_participant_start: string; timed_out: boolean }>(
      `select video_code, started_after_total_deadline, seconds_since_participant_start, timed_out from v_research_master where participant_code = 'T01' and study_id = $1 order by presentation_order`,
      [f.studyId],
    );
    expect(master.map((m) => m.started_after_total_deadline)).toEqual([false, false, true]);
    expect(master.map((m) => m.timed_out)).toEqual([false, true, false]);
    expect(Number(master[2].seconds_since_participant_start)).toBe(TOTAL + 60);
  });
});

describe("영상별 제한과 전체 제한이 함께 설정된 경우", () => {
  it("더 이른 마감이 적용되고, effective 모드 buffering 가산은 영상별 마감에만 적용된다", async () => {
    const g = await createStudyFixture({ n: 2, participantTarget: 2 });
    await q(`select update_study_settings($1, '{"max_observation_seconds": 300, "total_time_limit_seconds": 400}'::jsonb, null, '둘 다')`, [g.studyId]);
    const pid = (await createParticipant(g, "T01", 1)).id;
    const obs = (await observationsOf(pid)).filter((o) => !o.is_practice);
    const t0 = new Date(Date.now() - 2000_000);
    const first = await one<{ deadline_at: string }>(`select o.deadline_at from start_observation($1, $2) o`, [obs[0].id, t0]);
    expect(new Date(first.deadline_at).getTime()).toBe(t0.getTime() + 300_000); // 영상별 5분이 더 이르다
    // 버퍼링 20초 → effective 모드에서 영상별 마감은 320초로 밀리지만 전체 마감(400초)보다는 이르다
    await q(`insert into observation_events (observation_id, participant_id, video_id, event_type, event_timestamp)
             values ($1, $2, $3, 'video_buffer_start', $4), ($1, $2, $3, 'video_buffer_end', $5)`,
      [obs[0].id, pid, obs[0].video_id, new Date(t0.getTime() + 10_000), new Date(t0.getTime() + 30_000)]);
    const t = await one<{ remaining_seconds: string; limit_kind: string }>(`select * from observation_timer_state($1, $2)`, [obs[0].id, new Date(t0.getTime() + 100_000)]);
    expect(Number(t.remaining_seconds)).toBe(220); // 300 - (100 - 20)
    expect(t.limit_kind).toBe("video");
    await q(`select finalize_expired_observations($1, $2)`, [pid, new Date(t0.getTime() + 330_000)]);
    const done = await one<{ submitted_at: string; submission_type: string }>(`select submitted_at, submission_type from observations where id = $1`, [obs[0].id]);
    expect(done.submission_type).toBe("timeout");
    expect(new Date(done.submitted_at).getTime()).toBe(t0.getTime() + 320_000);

    // 두 번째 영상: 전체 마감(400초)까지 남은 시간이 영상별 5분보다 짧다
    const s2 = new Date(t0.getTime() + 350_000);
    const second = await one<{ deadline_at: string }>(`select o.deadline_at from start_observation($1, $2) o`, [obs[1].id, s2]);
    expect(new Date(second.deadline_at).getTime()).toBe(t0.getTime() + 400_000);
    const t2 = await one<{ remaining_seconds: string; limit_kind: string }>(`select * from observation_timer_state($1, $2)`, [obs[1].id, new Date(t0.getTime() + 360_000)]);
    expect(Number(t2.remaining_seconds)).toBe(40);
    expect(t2.limit_kind).toBe("total");
    await q(`select finalize_expired_observations($1, $2)`, [pid, new Date(t0.getTime() + 500_000)]);
    const done2 = await one<{ submitted_at: string }>(`select submitted_at from observations where id = $1`, [obs[1].id]);
    expect(new Date(done2.submitted_at).getTime()).toBe(t0.getTime() + 400_000);
  });
});
