/**
 * 서버 타이머 순수 로직. DB 함수 observation_buffering_seconds / observation_timer_state 와 동일 규칙.
 * - buffering : buffer_start ~ buffer_end 쌍의 합. 짝 없는 start 는 다음 play/first_play_completed/pause/ended 또는 종료 시각까지.
 * - 개별 buffering 구간 상한 60초.
 * - wall = (submitted_at 또는 now) - started_at
 * - remaining = max - (effective_time ? wall - buffering : wall)
 */
export type TimerMode = "wall_time" | "effective_time";

export type TimerEvent = { eventType: string; eventTimestamp: Date | string | number };

export const BUFFER_SEGMENT_CAP_SECONDS = 60;

const CLOSERS = new Set(["video_buffer_end", "video_play", "video_first_play_completed", "video_pause", "video_ended"]);

function toMs(d: Date | string | number): number {
  return d instanceof Date ? d.getTime() : typeof d === "number" ? d : new Date(d).getTime();
}

export function computeBufferingSeconds(
  events: TimerEvent[],
  startedAt: Date | string | number | null,
  endAt: Date | string | number,
): number {
  if (startedAt === null) return 0;
  const start = toMs(startedAt);
  const end = toMs(endAt);
  const cap = BUFFER_SEGMENT_CAP_SECONDS;
  const sorted = events
    .map((e) => ({ type: e.eventType, ts: toMs(e.eventTimestamp) }))
    .filter((e) => e.ts >= start && e.ts <= end && (e.type === "video_buffer_start" || CLOSERS.has(e.type)))
    .sort((a, b) => a.ts - b.ts);
  let open: number | null = null;
  let total = 0;
  for (const e of sorted) {
    if (e.type === "video_buffer_start") {
      if (open === null) open = e.ts;
    } else if (open !== null) {
      total += Math.min((e.ts - open) / 1000, cap);
      open = null;
    }
  }
  if (open !== null) total += Math.min(Math.max((end - open) / 1000, 0), cap);
  return Math.round(total * 1000) / 1000;
}

export type TimerStateInput = {
  startedAt: Date | string | number | null;
  submittedAt?: Date | string | number | null;
  maxSeconds: number;
  timerMode: TimerMode;
  events?: TimerEvent[];
  /** 제출 시 저장된 값이 있으면 이벤트 재계산 대신 사용 */
  bufferingSecondsOverride?: number | null;
  now: Date | string | number;
};

export type TimerState = {
  wallElapsedSeconds: number;
  bufferingSeconds: number;
  effectiveElapsedSeconds: number;
  remainingSeconds: number;
  expired: boolean;
};

export function computeTimerState(input: TimerStateInput): TimerState {
  const { startedAt, submittedAt, maxSeconds, timerMode, events = [], bufferingSecondsOverride, now } = input;
  if (startedAt === null) {
    return { wallElapsedSeconds: 0, bufferingSeconds: 0, effectiveElapsedSeconds: 0, remainingSeconds: maxSeconds, expired: false };
  }
  const nowMs = toMs(now);
  const ref = Math.min(submittedAt ? toMs(submittedAt) : nowMs, nowMs);
  const wall = Math.round(Math.max((ref - toMs(startedAt)) / 1000, 0) * 1000) / 1000;
  const buffering = bufferingSecondsOverride ?? computeBufferingSeconds(events, startedAt, ref);
  const effective = Math.round(Math.max(wall - buffering, 0) * 1000) / 1000;
  const elapsed = timerMode === "effective_time" ? effective : wall;
  const remaining = Math.round((maxSeconds - elapsed) * 1000) / 1000;
  return {
    wallElapsedSeconds: wall,
    bufferingSeconds: buffering,
    effectiveElapsedSeconds: effective,
    remainingSeconds: remaining,
    expired: remaining <= 0,
  };
}

/** 클라이언트 timeout 제출 수락 허용오차(초). 서버 기준 remaining 이 이 값 이하일 때만 timeout 으로 기록한다. */
export const TIMEOUT_TOLERANCE_SECONDS = 2;
