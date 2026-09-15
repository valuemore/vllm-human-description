"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CLOCK_RESYNC_INTERVAL_MS, TIMER_TICK_MS, remainingAt, timerLevel, type TimerAnchor, type TimerLevel } from "@/lib/timer/timerMath";
import type { LimitKind } from "@/lib/timer";

export type TimerInput = {
  /** null = 제한 없음 */
  remainingSeconds: number | null;
  maxSeconds: number | null;
  timerMode: "wall_time" | "effective_time";
  startedAt: string | null;
  /** 지금 적용 중인 제한의 종류. total 이면 관찰 시작 전에도 카운트다운한다 */
  limitKind: LimitKind;
};
export type TimerHandlers = { onExpire: () => void; onResync: () => void };

/**
 * 서버 앵커 기반 카운트다운. 서버 응답마다 applyAnchor 로 재동기화한다.
 * - 영상별 제한(effective 모드)에서는 앵커 이후 로컬 버퍼링을 가산한다. 전체 제한은 wall time 이라 가산하지 않는다.
 * - 전체 제한은 관찰 시작 전에도 흐르므로 시작 전에도 카운트다운하되, 만료 콜백은 시작 후에만 1회 호출한다.
 * - remaining null(제한 없음)이면 카운트다운하지 않는다.
 */
export function useObservationTimer(input: TimerInput, handlers: RefObject<TimerHandlers | null>) {
  const [started, setStarted] = useState(input.startedAt !== null);
  const countdownBeforeStart = input.limitKind === "total";
  // receivedAtPerf < 0 : 서버 스냅샷 앵커. 첫 tick 에서 performance.now() 로 확정한다 (렌더 중 impure 호출 회피)
  const [anchor, setAnchor] = useState<TimerAnchor | null>(() =>
    input.remainingSeconds !== null && (input.startedAt !== null || countdownBeforeStart)
      ? { remainingSeconds: input.remainingSeconds, receivedAtPerf: -1 }
      : null,
  );
  const [remaining, setRemaining] = useState<number | null>(input.remainingSeconds);
  const bufferingRef = useRef<{ since: number; openedAt: number | null }>({ since: 0, openedAt: null });
  const expiredRef = useRef(false);
  const startedRef = useRef(started);
  const effective = input.timerMode === "effective_time" && input.limitKind === "video";

  useEffect(() => {
    startedRef.current = started;
  }, [started]);

  const applyAnchor = useCallback((remainingSeconds: number | null) => {
    bufferingRef.current = { since: 0, openedAt: bufferingRef.current.openedAt ? performance.now() : null };
    setAnchor(remainingSeconds === null ? null : { remainingSeconds, receivedAtPerf: performance.now() });
    if (remainingSeconds === null) setRemaining(null);
    setStarted(true);
  }, []);

  /** 로컬 버퍼링 구간 추적 (effective 모드 보정용) */
  const bufferStart = useCallback(() => {
    if (bufferingRef.current.openedAt === null) bufferingRef.current.openedAt = performance.now();
  }, []);
  const bufferEnd = useCallback(() => {
    const b = bufferingRef.current;
    if (b.openedAt !== null) {
      b.since += Math.min((performance.now() - b.openedAt) / 1000, 60);
      b.openedAt = null;
    }
  }, []);

  useEffect(() => {
    if (!anchor) return;
    const resolved: TimerAnchor = anchor.receivedAtPerf < 0 ? { remainingSeconds: anchor.remainingSeconds, receivedAtPerf: performance.now() } : anchor;
    const id = window.setInterval(() => {
      const b = bufferingRef.current;
      const open = b.openedAt !== null ? Math.min((performance.now() - b.openedAt) / 1000, 60) : 0;
      const r = remainingAt(resolved, performance.now(), b.since + open, effective);
      setRemaining(r);
      if (r <= 0 && startedRef.current && !expiredRef.current) {
        expiredRef.current = true;
        handlers.current?.onExpire();
      }
    }, TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [anchor, effective, handlers]);

  // 주기적 재동기화 + 탭 복귀/온라인 복귀 시 재동기화
  useEffect(() => {
    if (!started) return;
    const resync = () => handlers.current?.onResync();
    const id = window.setInterval(resync, CLOCK_RESYNC_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", resync);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", resync);
    };
  }, [started, handlers]);

  const level: TimerLevel = anchor ? timerLevel(remaining) : "normal";
  return { started, remaining, level, applyAnchor, bufferStart, bufferEnd, maxSeconds: input.maxSeconds, limitKind: input.limitKind };
}
