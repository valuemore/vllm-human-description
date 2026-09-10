import { describe, expect, it } from "vitest";
import { createInitialState, editorEnabled, reduce, type PlayerAction, type PlayerEffect, type PlayerState } from "@/lib/player/playerMachine";

const DUR = 45_000;

function run(state: PlayerState, actions: PlayerAction[]): { state: PlayerState; effects: PlayerEffect[] } {
  const effects: PlayerEffect[] = [];
  let s = state;
  for (const a of actions) {
    const r = reduce(s, a);
    s = r.state;
    effects.push(...r.effects);
  }
  return { state: s, effects };
}

const fresh = () => createInitialState({ durationMs: DUR, timerStarted: false, firstWatchDone: false });
const toFirstWatch = () => run(fresh(), [{ type: "CAN_PLAY_THROUGH" }, { type: "USER_START" }, { type: "PLAYING" }]);
/** 실제 timeupdate 처럼 250ms 간격으로 진행 */
const progress = (upToMs: number): PlayerAction[] => Array.from({ length: upToMs / 250 }, (_, i) => ({ type: "TIMEUPDATE" as const, tMs: (i + 1) * 250 }));
const logs = (effects: PlayerEffect[]) => effects.filter((e): e is Extract<PlayerEffect, { type: "LOG" }> => e.type === "LOG").map((e) => e.event);

describe("preloading → ready", () => {
  it("preload 완료 후 ready, 시작 전 편집기 비활성", () => {
    const { state } = run(fresh(), [{ type: "LOADED_METADATA", durationMs: 44_990 }, { type: "CAN_PLAY_THROUGH" }]);
    expect(state.phase).toBe("ready");
    expect(state.durationMs).toBe(DUR); // 서버 값 우선
    expect(editorEnabled(state)).toBe(false);
  });
  it("서버 duration 없으면 미디어 값 사용", () => {
    const s = createInitialState({ durationMs: null, timerStarted: false, firstWatchDone: false });
    expect(reduce(s, { type: "LOADED_METADATA", durationMs: 12_345.6 }).state.durationMs).toBe(12_346);
  });
  it("새로고침 스냅샷: 타이머 시작됨 + 첫 시청 미완 → ready_restart", () => {
    const s = createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: false });
    expect(reduce(s, { type: "CAN_PLAY_THROUGH" }).state.phase).toBe("ready_restart");
  });
  it("첫 시청 완료 후 새로고침 → free_watch", () => {
    const s = createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: true });
    expect(reduce(s, { type: "CAN_PLAY_THROUGH" }).state.phase).toBe("free_watch");
  });
  it("preload 타임아웃 → ready + preload_incomplete 로그", () => {
    const r = reduce(fresh(), { type: "PRELOAD_TIMEOUT" });
    expect(r.state.phase).toBe("ready");
    expect(r.state.preloadIncomplete).toBe(true);
    expect(logs(r.effects)).toContain("observation_started");
  });
});

describe("first watch 시작", () => {
  it("USER_START → PLAY 효과, 최초 PLAYING 에서 START_TIMER 1회", () => {
    const { state, effects } = toFirstWatch();
    expect(state.phase).toBe("first_watch_playing");
    expect(effects.filter((e) => e.type === "PLAY")).toHaveLength(1);
    expect(effects.filter((e) => e.type === "START_TIMER")).toHaveLength(1);
    const again = reduce(state, { type: "PLAYING" });
    expect(again.effects.some((e) => e.type === "START_TIMER")).toBe(false);
  });
  it("ready_restart 에서는 SET_TIME(0) + PLAY, 타이머는 다시 시작하지 않음", () => {
    const s = createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: false });
    const r = run(s, [{ type: "CAN_PLAY_THROUGH" }, { type: "USER_RESTART" }, { type: "SEEKED", toMs: 0, fromMs: 0 }, { type: "PLAYING" }]);
    expect(r.effects).toContainEqual({ type: "SET_TIME", ms: 0 });
    expect(r.effects.some((e) => e.type === "START_TIMER")).toBe(false);
    expect(r.state.phase).toBe("first_watch_playing");
  });
});

describe("first watch 제한", () => {
  it("pause → 즉시 PLAY + blocked 로그 + 재개 확인 예약", () => {
    const { state } = toFirstWatch();
    const r = reduce(state, { type: "PAUSED", ended: false });
    expect(r.effects.map((e) => e.type)).toEqual(["PLAY", "LOG", "SCHEDULE_RESUME_CHECK"]);
    expect(r.state.blockedActions).toBe(1);
    expect(r.state.phase).toBe("first_watch_playing");
  });
  it("재개 실패 → ready_restart", () => {
    const { state } = toFirstWatch();
    const r = run(state, [{ type: "PAUSED", ended: false }, { type: "RESUME_FAILED" }]);
    expect(r.state.phase).toBe("ready_restart");
    expect(logs(r.effects)).toContain("first_watch_restarted");
    expect(r.state.maxWatchedMs).toBe(0);
  });
  it("반복 pause 는 MAX 회 이후 재시작", () => {
    const { state } = toFirstWatch();
    const r = run(state, [
      { type: "PAUSED", ended: false }, { type: "PAUSED", ended: false }, { type: "PAUSED", ended: false }, { type: "PAUSED", ended: false },
    ]);
    expect(r.state.phase).toBe("ready_restart");
  });
  it("seek 시도 → lastGood 으로 되돌리고 blocked 로그, seeked 로 내부 seek 해제", () => {
    const { state } = toFirstWatch();
    const r = run(state, [...progress(5000), { type: "SEEKING", toMs: 20_000 }]);
    expect(r.effects).toContainEqual({ type: "SET_TIME", ms: 5000 });
    expect(r.state.pendingInternalSeek).toBe(true);
    const after = reduce(r.state, { type: "SEEKED", toMs: 5000, fromMs: 20_000 });
    expect(after.state.pendingInternalSeek).toBe(false);
    expect(after.state.lastGoodTimeMs).toBe(5000);
  });
  it("허용오차 내 seeking 은 무시(버퍼링 지터)", () => {
    const { state } = toFirstWatch();
    const r = run(state, [...progress(5000), { type: "SEEKING", toMs: 6000 }]);
    expect(r.effects.some((e) => e.type === "SET_TIME")).toBe(false);
  });
  it("timeupdate 점프(프로그래밍적 seek) → 되돌림, 정상 진행은 maxWatched 단조 증가", () => {
    const { state } = toFirstWatch();
    const ok = run(state, [...progress(2000), { type: "TIMEUPDATE", tMs: 1800 }]);
    expect(ok.state.maxWatchedMs).toBe(2000);
    expect(ok.state.lastGoodTimeMs).toBe(2000);
    const jump = reduce(ok.state, { type: "TIMEUPDATE", tMs: 30_000 });
    expect(jump.effects).toContainEqual({ type: "SET_TIME", ms: 2000 });
    expect(logs(jump.effects)).toContain("first_watch_blocked_action");
  });
  it("배속 변경 → 1.0 강제 (모든 phase)", () => {
    const { state } = toFirstWatch();
    const r = reduce(state, { type: "RATE_CHANGED", rate: 2 });
    expect(r.effects).toContainEqual({ type: "SET_RATE", rate: 1 });
    const free = createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: true });
    const r2 = run(free, [{ type: "CAN_PLAY_THROUGH" }, { type: "RATE_CHANGED", rate: 0.5 }]);
    expect(r2.effects).toContainEqual({ type: "SET_RATE", rate: 1 });
    expect(reduce(state, { type: "RATE_CHANGED", rate: 1 }).effects).toHaveLength(0);
  });
  it("키 조작 차단 로그", () => {
    const { state } = toFirstWatch();
    expect(logs(reduce(state, { type: "KEY_BLOCKED", key: " " }).effects)).toEqual(["first_watch_blocked_action"]);
  });
  it("사용자 컨트롤(USER_PAUSE 등)은 첫 시청 중 무시 + 로그", () => {
    const { state } = toFirstWatch();
    const r = reduce(state, { type: "USER_PAUSE" });
    expect(r.effects.some((e) => e.type === "PAUSE")).toBe(false);
    expect(logs(r.effects)).toEqual(["first_watch_blocked_action"]);
  });
});

describe("first watch 완료 판정", () => {
  it("완주(ENDED, maxWatched ≥ duration−500) → first_watch_completed + REPORT", () => {
    const { state } = toFirstWatch();
    const r = run(state, [...progress(44_500), { type: "ENDED", tMs: 44_900 }]);
    expect(r.state.phase).toBe("first_watch_completed");
    expect(r.effects).toContainEqual({ type: "REPORT_FIRST_WATCH", maxWatchedMs: 44_900 });
    expect(editorEnabled(r.state)).toBe(false);
    const acc = reduce(r.state, { type: "FIRST_WATCH_ACCEPTED" });
    expect(acc.state.phase).toBe("free_watch");
    expect(editorEnabled(acc.state)).toBe(true);
    expect(acc.effects.map((e) => e.type)).toEqual(["ANNOUNCE", "FOCUS_EDITOR"]);
  });
  it("경계값: duration−500 미만이면 재시작, 정확히 −500 은 완주", () => {
    const { state } = toFirstWatch();
    expect(reduce(state, { type: "ENDED", tMs: DUR - 501 }).state.phase).toBe("ready_restart");
    expect(reduce(state, { type: "ENDED", tMs: DUR - 500 }).state.phase).toBe("first_watch_completed");
  });
  it("서버 거부 → ready_restart", () => {
    const { state } = toFirstWatch();
    const r = run(state, [{ type: "ENDED", tMs: DUR }, { type: "FIRST_WATCH_REJECTED" }]);
    expect(r.state.phase).toBe("ready_restart");
  });
});

describe("free watch", () => {
  const freeState = () => run(createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: true }), [{ type: "CAN_PLAY_THROUGH" }]).state;
  it("play/pause/seek 허용 + 로그 매핑", () => {
    const r = run(freeState(), [
      { type: "USER_PLAY" }, { type: "PLAYING" },
      { type: "TIMEUPDATE", tMs: 10_000 },
      { type: "USER_PAUSE" }, { type: "PAUSED", ended: false },
      { type: "USER_SEEK", toMs: 5000, source: "slider" }, { type: "SEEKED", toMs: 5000, fromMs: 10_000, source: "slider" },
      { type: "USER_SEEK", toMs: 15_000, source: "skip_button" }, { type: "SEEKED", toMs: 15_000, fromMs: 5000, source: "skip_button" },
    ]);
    expect(r.effects.filter((e) => e.type === "PLAY")).toHaveLength(1);
    expect(r.effects.filter((e) => e.type === "PAUSE")).toHaveLength(1);
    const lg = r.effects.filter((e): e is Extract<PlayerEffect, { type: "LOG" }> => e.type === "LOG");
    expect(lg.map((e) => e.event)).toEqual(["video_play", "video_pause", "video_seek", "video_seek"]);
    expect(lg[0].meta).toMatchObject({ is_replay: true }); // 0초 근처에서 재생
    expect(lg[2].meta).toMatchObject({ direction: "back", from_ms: 10_000, to_ms: 5000, source: "slider" });
    expect(lg[3].meta).toMatchObject({ direction: "forward" });
  });
  it("종료 후 재생은 is_replay", () => {
    const r = run(freeState(), [{ type: "TIMEUPDATE", tMs: 40_000 }, { type: "ENDED", tMs: DUR }, { type: "PLAYING" }]);
    const lg = r.effects.filter((e): e is Extract<PlayerEffect, { type: "LOG" }> => e.type === "LOG");
    expect(lg.map((e) => e.event)).toEqual(["video_ended", "video_play"]);
    expect(lg[1].meta).toMatchObject({ is_replay: true });
  });
  it("중간 재생은 is_replay=false", () => {
    const r = run(freeState(), [{ type: "TIMEUPDATE", tMs: 20_000 }, { type: "PLAYING" }]);
    const lg = r.effects.filter((e): e is Extract<PlayerEffect, { type: "LOG" }> => e.type === "LOG");
    expect(lg[0].meta).toMatchObject({ is_replay: false });
  });
  it("버퍼링: WAITING → buffer_start, PLAYING → buffer_end (play 로그 아님)", () => {
    const r = run(freeState(), [{ type: "WAITING" }, { type: "PLAYING" }]);
    expect(logs(r.effects)).toEqual(["video_buffer_start", "video_buffer_end"]);
    expect(r.state.isBuffering).toBe(false);
  });
});

describe("횡단: 만료·오류", () => {
  it("TIMER_EXPIRED 는 어느 phase 에서든 expired + PAUSE", () => {
    for (const st of [fresh(), toFirstWatch().state]) {
      const r = reduce(st, { type: "TIMER_EXPIRED" });
      expect(r.state.phase).toBe("expired");
      expect(r.effects).toContainEqual({ type: "PAUSE" });
    }
  });
  it("첫 시청 중 미디어 오류 → error → RETRY 로 ready_restart(타이머 진행)", () => {
    const { state } = toFirstWatch();
    const r = run(state, [{ type: "MEDIA_ERROR", code: 2 }, { type: "RETRY" }]);
    expect(logs(r.effects)).toContain("video_error");
    expect(r.state.phase).toBe("ready_restart");
  });
  it("자유시청 중 오류 → RETRY 로 위치 복원", () => {
    const free = run(createInitialState({ durationMs: DUR, timerStarted: true, firstWatchDone: true }), [{ type: "CAN_PLAY_THROUGH" }, { type: "TIMEUPDATE", tMs: 12_000 }]).state;
    const r = run(free, [{ type: "MEDIA_ERROR", code: 2 }, { type: "RETRY" }]);
    expect(r.state.phase).toBe("free_watch");
    expect(r.effects).toContainEqual({ type: "SET_TIME", ms: 12_000 });
  });
});
