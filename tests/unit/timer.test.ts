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
    expect(s).toEqual({ wallElapsedSeconds: 0, bufferingSeconds: 0, effectiveElapsedSeconds: 0, remainingSeconds: 300, expired: false });
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
