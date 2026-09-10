/**
 * 관찰 영상 플레이어 상태머신 (순수 reducer). DOM 을 모르며 effects 로 의도를 반환한다.
 *
 * phase:
 *   preloading → ready | ready_restart | free_watch(첫 시청 완료 후 새로고침)
 *   ready ──USER_START──▶ first_watch_playing ──ENDED(완주)──▶ first_watch_completed ──FIRST_WATCH_ACCEPTED──▶ free_watch
 *   first_watch_playing ──(pause 복구 실패 | 미완주 | 서버 거부)──▶ ready_restart ──USER_RESTART──▶ first_watch_playing
 *   any ──TIMER_EXPIRED──▶ expired,  any ──MEDIA_ERROR──▶ error ──RETRY──▶ (직전 단계로)
 *
 * 첫 시청 규칙: seek/pause/배속 금지. 위반 시 되돌리고 first_watch_blocked_action 로그.
 */
export type Phase = "preloading" | "ready" | "ready_restart" | "first_watch_playing" | "first_watch_completed" | "free_watch" | "expired" | "error";

export type PlayerState = {
  phase: Phase;
  durationMs: number;
  isBuffering: boolean;
  maxWatchedMs: number;
  lastGoodTimeMs: number;
  pendingInternalSeek: boolean;
  timerStarted: boolean;
  firstWatchDone: boolean;
  blockedActions: number;
  resumeAttempts: number;
  preloadIncomplete: boolean;
  justEnded: boolean;
  errorCode: number | null;
  phaseBeforeError: Phase | null;
};

export type PlayerAction =
  | { type: "LOADED_METADATA"; durationMs: number }
  | { type: "CAN_PLAY_THROUGH" }
  | { type: "PRELOAD_TIMEOUT" }
  | { type: "USER_START" }
  | { type: "USER_RESTART" }
  | { type: "PLAYING" }
  | { type: "PAUSED"; ended: boolean }
  | { type: "RESUME_FAILED" }
  | { type: "SEEKING"; toMs: number }
  | { type: "SEEKED"; toMs: number; fromMs: number; source?: string }
  | { type: "TIMEUPDATE"; tMs: number }
  | { type: "RATE_CHANGED"; rate: number }
  | { type: "WAITING" }
  | { type: "ENDED"; tMs: number }
  | { type: "FIRST_WATCH_ACCEPTED" }
  | { type: "FIRST_WATCH_REJECTED" }
  | { type: "TIMER_EXPIRED" }
  | { type: "MEDIA_ERROR"; code: number }
  | { type: "RETRY" }
  | { type: "KEY_BLOCKED"; key: string }
  | { type: "USER_PLAY" }
  | { type: "USER_PAUSE" }
  | { type: "USER_SEEK"; toMs: number; source: "slider" | "skip_button" | "keyboard" | "restart_button" };

export type PlayerEffect =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SET_TIME"; ms: number }
  | { type: "SET_RATE"; rate: number }
  | { type: "LOG"; event: string; meta?: Record<string, unknown> }
  | { type: "ANNOUNCE"; text: "first_watch_done" | "restart" }
  | { type: "FOCUS_EDITOR" }
  | { type: "START_TIMER" }
  | { type: "REPORT_FIRST_WATCH"; maxWatchedMs: number }
  | { type: "SCHEDULE_RESUME_CHECK" };

/** timeupdate 간격(≈250ms, 백그라운드 탭 ≈1s)보다 큰 점프만 seek 로 본다 */
export const SEEK_TOLERANCE_MS = 2500;
export const ENDED_EPSILON_MS = 500;
export const REPLAY_THRESHOLD_MS = 1000;
export const MAX_RESUME_ATTEMPTS = 3;

export function createInitialState(init: { durationMs: number | null; timerStarted: boolean; firstWatchDone: boolean }): PlayerState {
  return {
    phase: "preloading",
    durationMs: init.durationMs ?? 0,
    isBuffering: false,
    maxWatchedMs: 0,
    lastGoodTimeMs: 0,
    pendingInternalSeek: false,
    timerStarted: init.timerStarted,
    firstWatchDone: init.firstWatchDone,
    blockedActions: 0,
    resumeAttempts: 0,
    preloadIncomplete: false,
    justEnded: false,
    errorCode: null,
    phaseBeforeError: null,
  };
}

export type ReduceResult = { state: PlayerState; effects: PlayerEffect[] };

const FIRST_WATCH_PHASES: Phase[] = ["ready", "ready_restart", "first_watch_playing", "first_watch_completed"];

function phaseAfterPreload(s: PlayerState): Phase {
  if (s.firstWatchDone) return "free_watch";
  return s.timerStarted ? "ready_restart" : "ready";
}

export function reduce(state: PlayerState, action: PlayerAction): ReduceResult {
  const s = state;
  const effects: PlayerEffect[] = [];
  const done = (next: Partial<PlayerState>): ReduceResult => ({ state: { ...s, ...next }, effects });

  // 횡단 규칙: 배속 고정, 타이머 만료, 미디어 오류
  if (action.type === "RATE_CHANGED") {
    if (Math.abs(action.rate - 1) < 0.001) return done({});
    effects.push({ type: "SET_RATE", rate: 1 });
    effects.push({ type: "LOG", event: "first_watch_blocked_action", meta: { action: "rate", rate: action.rate, phase: s.phase } });
    return done({ blockedActions: s.blockedActions + 1 });
  }
  if (action.type === "TIMER_EXPIRED") {
    if (s.phase === "expired") return done({});
    effects.push({ type: "PAUSE" });
    return done({ phase: "expired" });
  }
  if (action.type === "MEDIA_ERROR") {
    if (s.phase === "expired") return done({});
    effects.push({ type: "LOG", event: "video_error", meta: { code: action.code, phase: s.phase } });
    return done({ phase: "error", errorCode: action.code, phaseBeforeError: s.phase === "error" ? s.phaseBeforeError : s.phase, isBuffering: false });
  }
  if (action.type === "RETRY") {
    if (s.phase !== "error") return done({});
    if (s.firstWatchDone) {
      effects.push({ type: "SET_TIME", ms: s.lastGoodTimeMs });
      return done({ phase: "free_watch", errorCode: null, phaseBeforeError: null, pendingInternalSeek: true });
    }
    // 첫 시청 중 오류 → 처음부터 다시 (타이머는 계속)
    return done({ phase: s.timerStarted ? "ready_restart" : "ready", errorCode: null, phaseBeforeError: null, maxWatchedMs: 0, lastGoodTimeMs: 0 });
  }
  if (action.type === "KEY_BLOCKED") {
    if (s.phase !== "first_watch_playing") return done({});
    effects.push({ type: "LOG", event: "first_watch_blocked_action", meta: { action: "key", key: action.key } });
    return done({ blockedActions: s.blockedActions + 1 });
  }
  if (action.type === "LOADED_METADATA") {
    // 서버 duration 을 우선, 없을 때만 미디어 값 사용
    return done({ durationMs: s.durationMs > 0 ? s.durationMs : Math.round(action.durationMs) });
  }
  if (action.type === "WAITING") {
    if (s.isBuffering || !["first_watch_playing", "free_watch"].includes(s.phase)) return done({});
    effects.push({ type: "LOG", event: "video_buffer_start", meta: { phase: s.phase } });
    return done({ isBuffering: true });
  }

  switch (s.phase) {
    case "preloading": {
      if (action.type === "CAN_PLAY_THROUGH") return done({ phase: phaseAfterPreload(s) });
      if (action.type === "PRELOAD_TIMEOUT") {
        effects.push({ type: "LOG", event: "observation_started", meta: { preload_incomplete: true } });
        return done({ phase: phaseAfterPreload(s), preloadIncomplete: true });
      }
      return done({});
    }

    case "ready": {
      if (action.type === "USER_START") {
        effects.push({ type: "PLAY" });
        return done({ phase: "first_watch_playing", maxWatchedMs: 0, lastGoodTimeMs: 0, resumeAttempts: 0 });
      }
      return done({});
    }

    case "ready_restart": {
      if (action.type === "USER_RESTART") {
        effects.push({ type: "SET_TIME", ms: 0 }, { type: "PLAY" });
        return done({ phase: "first_watch_playing", maxWatchedMs: 0, lastGoodTimeMs: 0, pendingInternalSeek: true, resumeAttempts: 0 });
      }
      return done({});
    }

    case "first_watch_playing": {
      switch (action.type) {
        case "PLAYING": {
          const next: Partial<PlayerState> = { resumeAttempts: 0 };
          if (s.isBuffering) {
            effects.push({ type: "LOG", event: "video_buffer_end", meta: { phase: s.phase } });
            next.isBuffering = false;
          }
          if (!s.timerStarted) {
            effects.push({ type: "START_TIMER" });
            next.timerStarted = true;
          }
          return done(next);
        }
        case "PAUSED": {
          if (action.ended) return done({});
          if (s.resumeAttempts >= MAX_RESUME_ATTEMPTS) {
            effects.push({ type: "PAUSE" }, { type: "LOG", event: "first_watch_restarted", meta: { reason: "pause_unrecoverable" } }, { type: "ANNOUNCE", text: "restart" });
            return done({ phase: "ready_restart", maxWatchedMs: 0, lastGoodTimeMs: 0, resumeAttempts: 0 });
          }
          effects.push({ type: "PLAY" }, { type: "LOG", event: "first_watch_blocked_action", meta: { action: "pause" } }, { type: "SCHEDULE_RESUME_CHECK" });
          return done({ blockedActions: s.blockedActions + 1, resumeAttempts: s.resumeAttempts + 1 });
        }
        case "RESUME_FAILED": {
          effects.push({ type: "PAUSE" }, { type: "LOG", event: "first_watch_restarted", meta: { reason: "pause_unrecoverable" } }, { type: "ANNOUNCE", text: "restart" });
          return done({ phase: "ready_restart", maxWatchedMs: 0, lastGoodTimeMs: 0, resumeAttempts: 0 });
        }
        case "SEEKING": {
          if (s.pendingInternalSeek) return done({});
          if (Math.abs(action.toMs - s.lastGoodTimeMs) <= SEEK_TOLERANCE_MS) return done({});
          effects.push({ type: "SET_TIME", ms: s.lastGoodTimeMs }, { type: "LOG", event: "first_watch_blocked_action", meta: { action: "seek", to_ms: action.toMs, from_ms: s.lastGoodTimeMs } });
          return done({ pendingInternalSeek: true, blockedActions: s.blockedActions + 1 });
        }
        case "SEEKED":
          return done({ pendingInternalSeek: false });
        case "TIMEUPDATE": {
          if (s.pendingInternalSeek) return done({});
          const delta = action.tMs - s.lastGoodTimeMs;
          if (delta > SEEK_TOLERANCE_MS || delta < -SEEK_TOLERANCE_MS) {
            effects.push({ type: "SET_TIME", ms: s.lastGoodTimeMs }, { type: "LOG", event: "first_watch_blocked_action", meta: { action: "seek", to_ms: action.tMs, from_ms: s.lastGoodTimeMs, detected: "timeupdate" } });
            return done({ pendingInternalSeek: true, blockedActions: s.blockedActions + 1 });
          }
          if (action.tMs < s.lastGoodTimeMs) return done({});
          return done({ lastGoodTimeMs: action.tMs, maxWatchedMs: Math.max(s.maxWatchedMs, action.tMs) });
        }
        case "ENDED": {
          const watched = Math.max(s.maxWatchedMs, action.tMs);
          if (s.durationMs > 0 && watched + ENDED_EPSILON_MS < s.durationMs) {
            effects.push({ type: "LOG", event: "first_watch_restarted", meta: { reason: "ended_incomplete", max_watched_ms: watched, duration_ms: s.durationMs } }, { type: "ANNOUNCE", text: "restart" });
            return done({ phase: "ready_restart", maxWatchedMs: 0, lastGoodTimeMs: 0 });
          }
          effects.push({ type: "REPORT_FIRST_WATCH", maxWatchedMs: watched });
          return done({ phase: "first_watch_completed", maxWatchedMs: watched, lastGoodTimeMs: watched, isBuffering: false, justEnded: true });
        }
        case "USER_PAUSE":
        case "USER_SEEK":
        case "USER_PLAY":
          effects.push({ type: "LOG", event: "first_watch_blocked_action", meta: { action: action.type.toLowerCase() } });
          return done({ blockedActions: s.blockedActions + 1 });
        default:
          return done({});
      }
    }

    case "first_watch_completed": {
      if (action.type === "FIRST_WATCH_ACCEPTED") {
        effects.push({ type: "ANNOUNCE", text: "first_watch_done" }, { type: "FOCUS_EDITOR" });
        return done({ phase: "free_watch", firstWatchDone: true });
      }
      if (action.type === "FIRST_WATCH_REJECTED") {
        effects.push({ type: "ANNOUNCE", text: "restart" });
        return done({ phase: "ready_restart", maxWatchedMs: 0, lastGoodTimeMs: 0, justEnded: false });
      }
      // 서버 응답 대기 중 사용자 조작은 무시
      return done({});
    }

    case "free_watch": {
      switch (action.type) {
        case "USER_PLAY":
          effects.push({ type: "PLAY" });
          return done({});
        case "USER_PAUSE":
          effects.push({ type: "PAUSE" });
          return done({});
        case "USER_SEEK":
          effects.push({ type: "SET_TIME", ms: Math.max(0, Math.min(action.toMs, s.durationMs || action.toMs)) });
          return done({ pendingInternalSeek: false });
        case "PLAYING": {
          const next: Partial<PlayerState> = { justEnded: false };
          if (s.isBuffering) {
            effects.push({ type: "LOG", event: "video_buffer_end", meta: { phase: s.phase } });
            next.isBuffering = false;
            return done(next);
          }
          const isReplay = s.justEnded || s.lastGoodTimeMs < REPLAY_THRESHOLD_MS;
          effects.push({ type: "LOG", event: "video_play", meta: { is_replay: isReplay } });
          return done(next);
        }
        case "PAUSED":
          if (action.ended) return done({});
          effects.push({ type: "LOG", event: "video_pause" });
          return done({});
        case "SEEKED": {
          const direction = action.toMs < action.fromMs ? "back" : "forward";
          effects.push({ type: "LOG", event: "video_seek", meta: { from_ms: action.fromMs, to_ms: action.toMs, direction, source: action.source ?? "unknown" } });
          return done({ lastGoodTimeMs: action.toMs, pendingInternalSeek: false });
        }
        case "TIMEUPDATE":
          return done({ lastGoodTimeMs: action.tMs, maxWatchedMs: Math.max(s.maxWatchedMs, action.tMs) });
        case "ENDED":
          effects.push({ type: "LOG", event: "video_ended" });
          return done({ justEnded: true, isBuffering: false });
        default:
          return done({});
      }
    }

    case "expired":
    case "error":
      return done({});
  }
}

export function isFirstWatchPhase(phase: Phase): boolean {
  return FIRST_WATCH_PHASES.includes(phase);
}

export function editorEnabled(state: PlayerState): boolean {
  return state.phase === "free_watch";
}

export function controlsVisible(state: PlayerState): boolean {
  return state.phase === "free_watch";
}
