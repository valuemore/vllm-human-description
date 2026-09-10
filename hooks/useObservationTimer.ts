"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { CLOCK_RESYNC_INTERVAL_MS, TIMER_TICK_MS, remainingAt, timerLevel, type TimerAnchor, type TimerLevel } from "@/lib/timer/timerMath";

export type TimerInput = { remainingSeconds: number; maxSeconds: number; timerMode: "wall_time" | "effective_time"; startedAt: string | null };
export type TimerHandlers = { onExpire: () => void; onResync: () => void };

/**
 * 서버 앵커 기반 카운트다운. 서버 응답마다 applyAnchor 로 재동기화, effective 모드에서는 앵커 이후 로컬 버퍼링을 가산한다.
 * 만료 시 handlers.onExpire 를 1회 호출한다 (시작 전에는 카운트다운하지 않음).
 */
export function useObservationTimer(input: TimerInput, handlers: RefObject<TimerHandlers | null>) {
  const [started, setStarted] = useState(input.startedAt !== null);
  // receivedAtPerf < 0 : 서버 스냅샷 앵커. 첫 tick 에서 performance.now() 로 확정한다 (렌더 중 impure 호출 회피)
  const [anchor, setAnchor] = useState<TimerAnchor | null>(() =>
    input.startedAt !== null ? { remainingSeconds: input.remainingSeconds, receivedAtPerf: -1 } : null,
  );
  const [remaining, setRemaining] = useState<number>(input.remainingSeconds);
  const bufferingRef = useRef<{ since: number; openedAt: number | null }>({ since: 0, openedAt: null });
  const expiredRef = useRef(false);
  const effective = input.timerMode === "effective_time";

  const applyAnchor = useCallback((remainingSeconds: number) => {
    bufferingRef.current = { since: 0, openedAt: bufferingRef.current.openedAt ? performance.now() : null };
    setAnchor({ remainingSeconds, receivedAtPerf: performance.now() });
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
    if (!started || !anchor) return;
    const resolved: TimerAnchor = anchor.receivedAtPerf < 0 ? { remainingSeconds: anchor.remainingSeconds, receivedAtPerf: performance.now() } : anchor;
    const id = window.setInterval(() => {
      const b = bufferingRef.current;
      const open = b.openedAt !== null ? Math.min((performance.now() - b.openedAt) / 1000, 60) : 0;
      const r = remainingAt(resolved, performance.now(), b.since + open, effective);
      setRemaining(r);
      if (r <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        handlers.current?.onExpire();
      }
    }, TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [started, anchor, effective, handlers]);

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

  const level: TimerLevel = started ? timerLevel(remaining) : "normal";
  return { started, remaining, level, applyAnchor, bufferStart, bufferEnd, maxSeconds: input.maxSeconds };
}
