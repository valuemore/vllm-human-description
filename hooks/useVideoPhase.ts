"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { createInitialState, reduce, type PlayerAction, type PlayerEffect, type PlayerState } from "@/lib/player/playerMachine";

export type VideoPhaseCallbacks = {
  log: (event: string, meta?: Record<string, unknown>, videoMs?: number | null) => void;
  onStartTimer: () => void;
  onReportFirstWatch: (maxWatchedMs: number) => void;
  onAnnounce: (text: "first_watch_done" | "restart") => void;
  onFocusEditor: () => void;
  onBufferStart: () => void;
  onBufferEnd: () => void;
};

export type SeekSource = "slider" | "skip_button" | "keyboard" | "restart_button";

const RESUME_CHECK_MS = 2000;
const PRELOAD_TIMEOUT_MS = 45_000;

/**
 * 순수 상태머신을 <video> 요소에 연결한다. dispatch 는 동기적으로 reducer 를 돌리고 effects 를 실행한다.
 * callbacks 는 ref 로 받는다 (호출자가 마운트 후 채운다).
 */
export function useVideoPhase(
  videoRef: RefObject<HTMLVideoElement | null>,
  init: { durationMs: number | null; timerStarted: boolean; firstWatchDone: boolean },
  callbacks: RefObject<VideoPhaseCallbacks | null>,
) {
  const [state, setState] = useState<PlayerState>(() => createInitialState(init));
  const stateRef = useRef<PlayerState>(state);
  const bufferOpenedAt = useRef<number | null>(null);
  const seekFromRef = useRef(0);
  const seekSourceRef = useRef<SeekSource | undefined>(undefined);
  const dispatchRef = useRef<((a: PlayerAction) => void) | null>(null);

  function runEffect(e: PlayerEffect) {
    const v = videoRef.current;
    const cb = callbacks.current;
    switch (e.type) {
      case "PLAY":
        v?.play().catch(() => {
          /* 사용자 클릭으로 시작하므로 autoplay 정책에 걸리지 않는다 */
        });
        break;
      case "PAUSE":
        v?.pause();
        break;
      case "SET_TIME":
        if (v) v.currentTime = e.ms / 1000;
        break;
      case "SET_RATE":
        if (v) v.playbackRate = e.rate;
        break;
      case "LOG": {
        let meta = e.meta ?? {};
        if (e.event === "video_buffer_start") {
          bufferOpenedAt.current = performance.now();
          cb?.onBufferStart();
        }
        if (e.event === "video_buffer_end") {
          const ms = bufferOpenedAt.current !== null ? Math.round(performance.now() - bufferOpenedAt.current) : null;
          bufferOpenedAt.current = null;
          meta = { ...meta, buffer_ms: ms };
          cb?.onBufferEnd();
        }
        cb?.log(e.event, meta, v ? Math.round(v.currentTime * 1000) : null);
        break;
      }
      case "ANNOUNCE":
        cb?.onAnnounce(e.text);
        break;
      case "FOCUS_EDITOR":
        cb?.onFocusEditor();
        break;
      case "START_TIMER":
        cb?.onStartTimer();
        break;
      case "REPORT_FIRST_WATCH":
        cb?.onReportFirstWatch(e.maxWatchedMs);
        break;
      case "SCHEDULE_RESUME_CHECK":
        window.setTimeout(() => {
          const vv = videoRef.current;
          if (stateRef.current.phase === "first_watch_playing" && vv && vv.paused && !vv.ended) dispatchRef.current?.({ type: "RESUME_FAILED" });
        }, RESUME_CHECK_MS);
        break;
    }
  }

  function dispatch(action: PlayerAction) {
    const r = reduce(stateRef.current, action);
    stateRef.current = r.state;
    setState(r.state);
    for (const e of r.effects) runEffect(e);
  }

  useEffect(() => {
    dispatchRef.current = dispatch;
  });

  /** <video> 에 붙일 이벤트 핸들러 */
  const handlers = {
    onLoadedMetadata: () => {
      const v = videoRef.current;
      if (v && Number.isFinite(v.duration)) dispatch({ type: "LOADED_METADATA", durationMs: v.duration * 1000 });
    },
    onCanPlayThrough: () => dispatch({ type: "CAN_PLAY_THROUGH" }),
    onPlaying: () => dispatch({ type: "PLAYING" }),
    onPause: () => dispatch({ type: "PAUSED", ended: !!videoRef.current?.ended }),
    onSeeking: () => {
      const v = videoRef.current;
      if (v) dispatch({ type: "SEEKING", toMs: Math.round(v.currentTime * 1000) });
    },
    onSeeked: () => {
      const v = videoRef.current;
      if (!v) return;
      dispatch({ type: "SEEKED", toMs: Math.round(v.currentTime * 1000), fromMs: seekFromRef.current, source: seekSourceRef.current });
      seekSourceRef.current = undefined;
    },
    onTimeUpdate: () => {
      const v = videoRef.current;
      if (!v) return;
      const tMs = Math.round(v.currentTime * 1000);
      dispatch({ type: "TIMEUPDATE", tMs });
      if (!v.seeking) seekFromRef.current = tMs;
      // ended 누락 대비 워치독
      const s = stateRef.current;
      if (s.phase === "first_watch_playing" && s.durationMs > 0 && tMs >= s.durationMs - 250 && v.paused && !v.seeking) {
        dispatch({ type: "ENDED", tMs });
      }
    },
    onRateChange: () => {
      const v = videoRef.current;
      if (v) dispatch({ type: "RATE_CHANGED", rate: v.playbackRate });
    },
    onWaiting: () => dispatch({ type: "WAITING" }),
    onEnded: () => {
      const v = videoRef.current;
      dispatch({ type: "ENDED", tMs: v ? Math.round(v.currentTime * 1000) : stateRef.current.durationMs });
    },
    onError: () => dispatch({ type: "MEDIA_ERROR", code: videoRef.current?.error?.code ?? 0 }),
  };

  /** 사용자 seek 의도 기록 (SEEKED 로그의 source/from 용) */
  function markUserSeek(source: SeekSource) {
    const v = videoRef.current;
    if (v) seekFromRef.current = Math.round(v.currentTime * 1000);
    seekSourceRef.current = source;
  }

  // preload 감시: 45초 안에 canplaythrough 가 없으면 진행 허용
  useEffect(() => {
    const id = window.setTimeout(() => {
      const v = videoRef.current;
      if (stateRef.current.phase === "preloading" && v && v.readyState >= 3) dispatchRef.current?.({ type: "PRELOAD_TIMEOUT" });
    }, PRELOAD_TIMEOUT_MS);
    return () => window.clearTimeout(id);
  }, [videoRef]);

  return { state, dispatch, handlers, markUserSeek };
}
