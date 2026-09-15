/**
 * 서버 타이머 순수 로직. DB 함수 observation_buffering_seconds / observation_timer_state 와 동일 규칙.
 * - buffering : buffer_start ~ buffer_end 쌍의 합. 짝 없는 start 는 다음 play/first_play_completed/pause/ended 또는 종료 시각까지.
 * - 개별 buffering 구간 상한 60초.
 * - wall = (submitted_at 또는 now) - started_at
 * - 영상별 remaining = max - (effective_time ? wall - buffering : wall)   (max null 이면 없음)
 * - 전체 remaining   = totalDeadlineAt - ref (wall time)                   (없거나 마감 후 시작이면 없음)
 * - remaining = 둘 중 작은 값. 둘 다 없으면 null (제한 없음)
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

export type LimitKind = "video" | "total" | "none";

export type TimerStateInput = {
  startedAt: Date | string | number | null;
  submittedAt?: Date | string | number | null;
  /** 영상 1편당 제한(초). null = 영상별 제한 없음 */
  maxSeconds: number | null;
  /** 참여자 전체 마감 시각. null = 아직 미확정(첫 본 관찰 전) 또는 전체 제한 없음 */
  totalDeadlineAt?: Date | string | number | null;
  /** 전체 제한 설정값(초). 시작 전이고 마감이 미확정일 때 표시용으로 쓴다 */
  totalLimitSeconds?: number | null;
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
  /** null = 제한 없음 */
  remainingSeconds: number | null;
  totalRemainingSeconds: number | null;
  limitKind: LimitKind;
  startedAfterTotalDeadline: boolean;
  expired: boolean;
};

const r3 = (n: number) => Math.round(n * 1000) / 1000;

function least(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.min(a, b);
}

function limitKindOf(perVideo: number | null, total: number | null): LimitKind {
  if (perVideo === null && total === null) return "none";
  if (perVideo !== null && (total === null || perVideo <= total)) return "video";
  return "total";
}

export function computeTimerState(input: TimerStateInput): TimerState {
  const { startedAt, submittedAt, maxSeconds, totalDeadlineAt = null, totalLimitSeconds = null, timerMode, events = [], bufferingSecondsOverride, now } = input;
  const nowMs = toMs(now);
  const totalDeadlineMs = totalDeadlineAt === null || totalDeadlineAt === undefined ? null : toMs(totalDeadlineAt);
  if (startedAt === null) {
    // 시작 전: 영상별 제한은 전체 시간, 전체 제한은 지금 남은 시간 (다른 영상 진행 중에도 계속 흐른다).
    // 첫 본 관찰이라 전체 마감이 아직 없으면 설정값 전체를 보여준다. 마감이 이미 지났으면 이 관찰에는 전체 제한이 적용되지 않는다.
    const totalRem = totalDeadlineMs !== null ? (totalDeadlineMs > nowMs ? r3((totalDeadlineMs - nowMs) / 1000) : null) : totalLimitSeconds;
    return {
      wallElapsedSeconds: 0,
      bufferingSeconds: 0,
      effectiveElapsedSeconds: 0,
      remainingSeconds: least(maxSeconds, totalRem),
      totalRemainingSeconds: totalRem,
      limitKind: limitKindOf(maxSeconds, totalRem),
      startedAfterTotalDeadline: false,
      expired: false,
    };
  }
  const startMs = toMs(startedAt);
  const ref = Math.min(submittedAt ? toMs(submittedAt) : nowMs, nowMs);
  const wall = r3(Math.max((ref - startMs) / 1000, 0));
  const buffering = bufferingSecondsOverride ?? computeBufferingSeconds(events, startedAt, ref);
  const effective = r3(Math.max(wall - buffering, 0));
  const elapsed = timerMode === "effective_time" ? effective : wall;
  const perVideo = maxSeconds === null ? null : r3(maxSeconds - elapsed);
  const startedAfterTotalDeadline = totalDeadlineMs !== null && startMs > totalDeadlineMs;
  const totalRem = totalDeadlineMs === null || startedAfterTotalDeadline ? null : r3((totalDeadlineMs - ref) / 1000);
  const remaining = least(perVideo, totalRem);
  return {
    wallElapsedSeconds: wall,
    bufferingSeconds: buffering,
    effectiveElapsedSeconds: effective,
    remainingSeconds: remaining,
    totalRemainingSeconds: totalRem,
    limitKind: limitKindOf(perVideo, totalRem),
    startedAfterTotalDeadline,
    expired: remaining !== null && remaining <= 0,
  };
}

/** 클라이언트 timeout 제출 수락 허용오차(초). 서버 기준 remaining 이 이 값 이하일 때만 timeout 으로 기록한다. */
export const TIMEOUT_TOLERANCE_SECONDS = 2;
