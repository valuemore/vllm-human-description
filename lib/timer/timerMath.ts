/**
 * 클라이언트 타이머 (서버 앵커 기반). 서버가 모드(wall/effective)에 따라 remaining 을 계산해 주고,
 * 클라이언트는 마지막 앵커로부터 경과한 시간만큼 감쇠시킨다. effective 모드에서는 앵커 이후 로컬 버퍼링을 더한다.
 */
export type TimerAnchor = {
  remainingSeconds: number;
  /** performance.now() 기준 수신 시각 */
  receivedAtPerf: number;
};

export type TimerLevel = "normal" | "warn60" | "warn30" | "warn10" | "expired";

export function remainingAt(anchor: TimerAnchor | null, perfNow: number, localBufferingSinceAnchorSec = 0, effectiveMode = true, fallback = 0): number {
  if (!anchor) return fallback;
  const elapsed = Math.max(perfNow - anchor.receivedAtPerf, 0) / 1000;
  const credit = effectiveMode ? Math.max(localBufferingSinceAnchorSec, 0) : 0;
  return anchor.remainingSeconds - elapsed + credit;
}

/** null(제한 없음) 은 항상 normal */
export function timerLevel(remainingSeconds: number | null): TimerLevel {
  if (remainingSeconds === null) return "normal";
  if (remainingSeconds <= 0) return "expired";
  if (remainingSeconds <= 10) return "warn10";
  if (remainingSeconds <= 30) return "warn30";
  if (remainingSeconds <= 60) return "warn60";
  return "normal";
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

/** 서버-클라이언트 시계 오프셋(ms) 표본의 중앙값 */
export function medianOffset(samples: number[]): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** 새 앵커가 기존보다 신뢰할 만한지: 항상 서버 값을 채택하되, 감쇠보다 더 큰 값이 와도 그대로 채택(서버 권위) */
export function pickAnchor(current: TimerAnchor | null, incoming: TimerAnchor): TimerAnchor {
  void current;
  return incoming;
}

export const CLOCK_RESYNC_INTERVAL_MS = 30_000;
export const TIMER_TICK_MS = 250;
