import { describe, expect, it } from "vitest";
import { computeBufferingSeconds, computeTimerState, TIMEOUT_TOLERANCE_SECONDS } from "@/lib/timer";

const T0 = new Date("2026-09-10T10:00:00.000Z").getTime();
const at = (sec: number) => new Date(T0 + sec * 1000);

describe("computeBufferingSeconds", () => {
  it("start/end 쌍 합산", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(5) },
      { eventType: "video_buffer_end", eventTimestamp: at(7.5) },
      { eventType: "video_buffer_start", eventTimestamp: at(20) },
      { eventType: "video_buffer_end", eventTimestamp: at(21) },
    ];
    expect(computeBufferingSeconds(events, at(0), at(60))).toBe(3.5);
  });

  it("짝 없는 start 는 다음 play 까지", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(5) },
      { eventType: "video_play", eventTimestamp: at(9) },
    ];
    expect(computeBufferingSeconds(events, at(0), at(60))).toBe(4);
  });

  it("종료 시각까지 열린 start 는 종료 시각에서 닫히고 60초 상한", () => {
    const events = [{ eventType: "video_buffer_start", eventTimestamp: at(5) }];
    expect(computeBufferingSeconds(events, at(0), at(30))).toBe(25);
    expect(computeBufferingSeconds(events, at(0), at(200))).toBe(60);
  });

  it("개별 구간 60초 상한", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(5) },
      { eventType: "video_buffer_end", eventTimestamp: at(100) },
    ];
    expect(computeBufferingSeconds(events, at(0), at(300))).toBe(60);
  });

  it("시작 전 이벤트는 무시, 중복 start 는 첫 것만", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(-3) },
      { eventType: "video_buffer_start", eventTimestamp: at(10) },
      { eventType: "video_buffer_start", eventTimestamp: at(12) },
      { eventType: "video_buffer_end", eventTimestamp: at(15) },
    ];
    expect(computeBufferingSeconds(events, at(0), at(60))).toBe(5);
  });

  it("시작 전이면 0", () => {
    expect(computeBufferingSeconds([], null, at(10))).toBe(0);
  });
});

describe("computeTimerState", () => {
  it("시작 전: 전체 시간 남음", () => {
    const s = computeTimerState({ startedAt: null, maxSeconds: 300, timerMode: "effective_time", now: at(100) });
    expect(s).toEqual({
      wallElapsedSeconds: 0, bufferingSeconds: 0, effectiveElapsedSeconds: 0, remainingSeconds: 300, expired: false,
      totalRemainingSeconds: null, limitKind: "video", startedAfterTotalDeadline: false,
    });
  });

  it("wall_time: 버퍼링 무시", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(10) },
      { eventType: "video_buffer_end", eventTimestamp: at(20) },
    ];
    const s = computeTimerState({ startedAt: at(0), maxSeconds: 300, timerMode: "wall_time", events, now: at(100) });
    expect(s.wallElapsedSeconds).toBe(100);
    expect(s.bufferingSeconds).toBe(10);
    expect(s.remainingSeconds).toBe(200);
  });

  it("effective_time: 버퍼링 차감", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(10) },
      { eventType: "video_buffer_end", eventTimestamp: at(20) },
    ];
    const s = computeTimerState({ startedAt: at(0), maxSeconds: 300, timerMode: "effective_time", events, now: at(100) });
    expect(s.effectiveElapsedSeconds).toBe(90);
    expect(s.remainingSeconds).toBe(210);
    expect(s.expired).toBe(false);
  });

  it("300초 도달 시 만료 (refresh 와 무관하게 started_at 기준)", () => {
    const s = computeTimerState({ startedAt: at(0), maxSeconds: 300, timerMode: "wall_time", now: at(300) });
    expect(s.expired).toBe(true);
    expect(s.remainingSeconds).toBe(0);
    const later = computeTimerState({ startedAt: at(0), maxSeconds: 300, timerMode: "wall_time", now: at(1000) });
    expect(later.remainingSeconds).toBe(-700);
  });

  it("제출 후에는 submitted_at 기준으로 고정", () => {
    const s = computeTimerState({ startedAt: at(0), submittedAt: at(120), maxSeconds: 300, timerMode: "wall_time", now: at(5000) });
    expect(s.wallElapsedSeconds).toBe(120);
    expect(s.remainingSeconds).toBe(180);
  });

  it("저장된 buffering 값이 있으면 재계산하지 않음", () => {
    const s = computeTimerState({
      startedAt: at(0),
      maxSeconds: 300,
      timerMode: "effective_time",
      events: [{ eventType: "video_buffer_start", eventTimestamp: at(1) }],
      bufferingSecondsOverride: 7,
      now: at(100),
    });
    expect(s.bufferingSeconds).toBe(7);
    expect(s.remainingSeconds).toBe(207);
  });

  it("timeout 허용오차 상수", () => {
    expect(TIMEOUT_TOLERANCE_SECONDS).toBe(2);
  });
});

describe("computeTimerState: 영상별 제한 없음 + 참여자 전체 제한 (0010)", () => {
  it("둘 다 없으면 remaining null, 만료 없음", () => {
    const s = computeTimerState({ startedAt: at(0), maxSeconds: null, timerMode: "effective_time", now: at(9999) });
    expect(s.remainingSeconds).toBeNull();
    expect(s.totalRemainingSeconds).toBeNull();
    expect(s.limitKind).toBe("none");
    expect(s.expired).toBe(false);
    expect(s.wallElapsedSeconds).toBe(9999);
  });

  it("전체 제한만: wall time 기준, buffering 은 차감하지 않는다", () => {
    const events = [
      { eventType: "video_buffer_start", eventTimestamp: at(10) },
      { eventType: "video_buffer_end", eventTimestamp: at(20) },
    ];
    const s = computeTimerState({ startedAt: at(0), maxSeconds: null, totalDeadlineAt: at(2400), timerMode: "effective_time", events, now: at(100) });
    expect(s.bufferingSeconds).toBe(10);
    expect(s.remainingSeconds).toBe(2300);
    expect(s.totalRemainingSeconds).toBe(2300);
    expect(s.limitKind).toBe("total");
    expect(s.expired).toBe(false);
  });

  it("전체 제한: 두 번째 영상은 자기 시작 시각이 아니라 전체 마감 기준으로 남는다", () => {
    const s = computeTimerState({ startedAt: at(2000), maxSeconds: null, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(2100) });
    expect(s.remainingSeconds).toBe(300);
    expect(computeTimerState({ startedAt: at(2000), maxSeconds: null, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(2400) }).expired).toBe(true);
  });

  it("시작 전에도 전체 남은 시간은 흐른다 (허브 대기 중)", () => {
    const s = computeTimerState({ startedAt: null, maxSeconds: null, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(1000) });
    expect(s.remainingSeconds).toBe(1400);
    expect(s.limitKind).toBe("total");
    expect(s.expired).toBe(false);
    const pv = computeTimerState({ startedAt: null, maxSeconds: 300, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(1000) });
    expect(pv.remainingSeconds).toBe(300);
    expect(pv.limitKind).toBe("video");
  });

  it("첫 본 관찰 시작 전(마감 미확정): 설정값 전체를 표시", () => {
    const s = computeTimerState({ startedAt: null, maxSeconds: null, totalLimitSeconds: 2400, timerMode: "wall_time", now: at(0) });
    expect(s.remainingSeconds).toBe(2400);
    expect(s.limitKind).toBe("total");
    // 마감이 확정되면 설정값이 아니라 마감 기준
    const t = computeTimerState({ startedAt: null, maxSeconds: null, totalLimitSeconds: 2400, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(1000) });
    expect(t.remainingSeconds).toBe(1400);
    // 마감이 이미 지난 뒤의 시작 전 화면: 이 관찰에는 전체 제한이 적용되지 않는다
    const u = computeTimerState({ startedAt: null, maxSeconds: null, totalLimitSeconds: 2400, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(3000) });
    expect(u.remainingSeconds).toBeNull();
    expect(u.limitKind).toBe("none");
  });

  it("전체 마감 이후 시작한 관찰: 전체 제한 미적용, 플래그만 기록", () => {
    const s = computeTimerState({ startedAt: at(2500), maxSeconds: null, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(9000) });
    expect(s.startedAfterTotalDeadline).toBe(true);
    expect(s.remainingSeconds).toBeNull();
    expect(s.limitKind).toBe("none");
    expect(s.expired).toBe(false);
  });

  it("둘 다 있으면 더 이른 마감이 적용된다", () => {
    const a = computeTimerState({ startedAt: at(0), maxSeconds: 300, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(100) });
    expect(a.remainingSeconds).toBe(200);
    expect(a.limitKind).toBe("video");
    const b = computeTimerState({ startedAt: at(2300), maxSeconds: 300, totalDeadlineAt: at(2400), timerMode: "wall_time", now: at(2350) });
    expect(b.remainingSeconds).toBe(50);
    expect(b.limitKind).toBe("total");
  });
});
