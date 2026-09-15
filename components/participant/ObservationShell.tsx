"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AutosaveStatus } from "@/components/participant/AutosaveStatus";
import { StudyVideoPlayer } from "@/components/participant/StudyVideoPlayer";
import { SubmitDialog } from "@/components/participant/SubmitDialog";
import { TimerDisplay } from "@/components/participant/TimerDisplay";
import { useAutosave, type AutosaveHandlers } from "@/hooks/useAutosave";
import { useEventLogger, type ServerTimerPayload } from "@/hooks/useEventLogger";
import { useObservationTimer, type TimerHandlers } from "@/hooks/useObservationTimer";
import { useSignedVideoUrl } from "@/hooks/useSignedVideoUrl";
import { useVideoPhase, type VideoPhaseCallbacks } from "@/hooks/useVideoPhase";
import { ApiClientError, apiGet, apiPost } from "@/lib/client/api";
import { copy } from "@/lib/copy/participant.ko";
import { classifyBrowser, resolveDevice } from "@/lib/participant/device";
import { editorEnabled } from "@/lib/player/playerMachine";
import type { ObservationSnapshot } from "@/lib/services/observations";

type TimerPayload = { remainingSeconds: number | null };
type StartResponse = { startedAt: string; timer: TimerPayload };
type FirstWatchResponse = { accepted: boolean; timer: TimerPayload };
type ClockResponse = { status: string; submissionType: string | null; timer: TimerPayload };
type SubmitResponse = { status: "submitted"; submissionType: "manual" | "timeout"; next: { href: string } };
type Finished = { type: "manual" | "timeout"; next: string };

export function ObservationShell({ snapshot, mode }: { snapshot: ObservationSnapshot; mode: "practice" | "main" }) {
  const router = useRouter();
  const c = copy.observation;
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [announce, setAnnounce] = useState("");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const submittingRef = useRef(false);
  const finishedRef = useRef<Finished | null>(null);
  const playStartedAtRef = useRef<number | null>(null);
  const hiddenAtRef = useRef<number | null>(null);

  // 훅 간 순환 참조를 피하기 위해 콜백은 ref 로 전달하고 마운트 후 채운다.
  const timerHandlers = useRef<TimerHandlers | null>(null);
  const loggerHandler = useRef<((p: ServerTimerPayload) => void) | null>(null);
  const autosaveHandlers = useRef<AutosaveHandlers | null>(null);
  const videoCallbacks = useRef<VideoPhaseCallbacks | null>(null);

  const timer = useObservationTimer(
    {
      remainingSeconds: snapshot.timer.remainingSeconds,
      maxSeconds: snapshot.timer.maxSeconds,
      timerMode: snapshot.timer.timerMode,
      startedAt: snapshot.startedAt,
      limitKind: snapshot.timer.limitKind,
    },
    timerHandlers,
  );
  const { logger } = useEventLogger(snapshot.id, loggerHandler);
  const { state, dispatch, handlers, markUserSeek } = useVideoPhase(
    videoRef,
    { durationMs: snapshot.video.durationMs, timerStarted: snapshot.startedAt !== null, firstWatchDone: snapshot.firstWatchCompletedAt !== null },
    videoCallbacks,
  );
  const editorOn = editorEnabled(state) && !finished && !sessionExpired;
  const autosave = useAutosave({
    observationId: snapshot.id,
    initialText: snapshot.draftText,
    initialRevision: snapshot.draftRevision,
    submitted: snapshot.status === "submitted",
    enabled: editorOn,
    handlers: autosaveHandlers,
  });
  const video = useSignedVideoUrl(snapshot.id, !finished);

  const label = mode === "practice" ? copy.practice.label : c.label(snapshot.order ?? 0, snapshot.totalCount);
  const phaseRef = useRef(state.phase);

  // ---- 서버 호출 ----
  const handleApiError = (err: unknown) => {
    if (!(err instanceof ApiClientError)) return;
    if (err.code === "UNAUTHENTICATED") setSessionExpired(true);
    else if (err.code === "TIMED_OUT" || err.code === "ALREADY_SUBMITTED") void resync();
    else if (err.code === "TOO_EARLY_FOR_TIMEOUT") {
      const d = err.details as { remainingSeconds?: number | null } | undefined;
      if (d && d.remainingSeconds !== undefined) timer.applyAnchor(d.remainingSeconds);
    }
  };

  const finish = (f: Finished) => {
    finishedRef.current = f;
    setFinished(f);
  };

  const finishAfterServerSubmit = (type: "manual" | "timeout") => {
    dispatch({ type: "TIMER_EXPIRED" });
    autosave.clearLocal();
    void apiGet<{ step: { href: string } }>("/api/participant/state")
      .then(({ data }) => finish({ type, next: data.step.href }))
      .catch(() => finish({ type, next: "/study" }));
  };

  const resync = async () => {
    if (finishedRef.current || submittingRef.current) return;
    try {
      const { data } = await apiGet<ClockResponse>(`/api/observations/${snapshot.id}/clock`);
      if (data.status === "submitted") {
        finishAfterServerSubmit(data.submissionType === "timeout" ? "timeout" : "manual");
        return;
      }
      timer.applyAnchor(data.timer.remainingSeconds);
    } catch (err) {
      handleApiError(err);
    }
  };

  const startTimer = async () => {
    const elapsed = playStartedAtRef.current !== null ? Math.round(performance.now() - playStartedAtRef.current) : 0;
    try {
      const { data } = await apiPost<StartResponse>(`/api/observations/${snapshot.id}/start`, { client_elapsed_ms_since_play: elapsed });
      timer.applyAnchor(data.timer.remainingSeconds);
    } catch (err) {
      handleApiError(err);
    }
  };

  const reportFirstWatch = async (maxWatchedMs: number) => {
    try {
      const { data } = await apiPost<FirstWatchResponse>(`/api/observations/${snapshot.id}/first-watch-complete`, { max_watched_ms: maxWatchedMs });
      timer.applyAnchor(data.timer.remainingSeconds);
      dispatch({ type: data.accepted ? "FIRST_WATCH_ACCEPTED" : "FIRST_WATCH_REJECTED" });
    } catch (err) {
      handleApiError(err);
    }
  };

  const handleTimeout = async () => {
    if (submittingRef.current || finishedRef.current) return;
    submittingRef.current = true;
    dispatch({ type: "TIMER_EXPIRED" });
    const { text, revision } = autosave.getSnapshot();
    try {
      const { data } = await apiPost<SubmitResponse>(`/api/observations/${snapshot.id}/submit`, { submission_type: "timeout", text, revision });
      autosave.clearLocal();
      finish({ type: data.submissionType, next: data.next.href });
    } catch (err) {
      submittingRef.current = false;
      if (err instanceof ApiClientError && err.code === "TOO_EARLY_FOR_TIMEOUT") {
        handleApiError(err);
        window.setTimeout(() => void handleTimeout(), 1500);
        return;
      }
      handleApiError(err);
      // 네트워크 오류: 서버가 lazy finalize 하므로 잠시 후 상태 재조회
      window.setTimeout(() => void resync(), 3000);
    }
  };

  const handleManualSubmit = async () => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    const { text, revision } = autosave.getSnapshot();
    try {
      const { data } = await apiPost<SubmitResponse>(`/api/observations/${snapshot.id}/submit`, { submission_type: "manual", text, revision });
      autosave.clearLocal();
      logger.flushOnUnload();
      router.replace(data.next.href);
    } catch (err) {
      submittingRef.current = false;
      setSubmitting(false);
      setSubmitOpen(false);
      handleApiError(err);
    }
  };

  // 최신 클로저를 ref 에 반영 (렌더마다)
  useEffect(() => {
    phaseRef.current = state.phase;
    timerHandlers.current = { onExpire: () => void handleTimeout(), onResync: () => void resync() };
    loggerHandler.current = (payload) => {
      if (payload.timer) timer.applyAnchor(payload.timer.remainingSeconds);
      if (payload.status === "submitted" && !finishedRef.current && !submittingRef.current) void resync();
    };
    autosaveHandlers.current = {
      onServerTimer: (r) => timer.applyAnchor(r),
      onTimedOut: () => void resync(),
      onSessionExpired: () => setSessionExpired(true),
    };
    videoCallbacks.current = {
      log: (event, meta, videoMs) => logger.log(event, meta, videoMs ?? null),
      onStartTimer: () => void startTimer(),
      onReportFirstWatch: (ms) => void reportFirstWatch(ms),
      onAnnounce: (t) => setAnnounce(t === "first_watch_done" ? c.firstWatchDone : c.restartBody),
      onFocusEditor: () => editorRef.current?.focus(),
      onBufferStart: timer.bufferStart,
      onBufferEnd: timer.bufferEnd,
    };
  });

  // 관찰 진입 이벤트 (기기 정보) + 페이지 가시성/네트워크 이벤트
  useEffect(() => {
    const ua = navigator.userAgent;
    logger.log("observation_started", {
      device_category: resolveDevice({ ua, coarsePointer: window.matchMedia("(pointer: coarse)").matches, viewportWidth: window.innerWidth }),
      browser_category: classifyBrowser(ua),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      resumed: snapshot.startedAt !== null,
      first_watch_done: snapshot.firstWatchCompletedAt !== null,
    });
    const videoMs = () => (videoRef.current ? Math.round(videoRef.current.currentTime * 1000) : null);
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenAtRef.current = performance.now();
        logger.log("page_hidden", { phase: phaseRef.current }, videoMs());
      } else {
        const hidden = hiddenAtRef.current !== null ? Math.round(performance.now() - hiddenAtRef.current) : null;
        hiddenAtRef.current = null;
        logger.log("page_visible", { phase: phaseRef.current, hidden_ms: hidden }, videoMs());
      }
    };
    const onOffline = () => logger.log("network_offline", { pending_events: logger.pendingCount });
    const onOnline = () => logger.log("network_online", {});
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, [logger, snapshot.startedAt, snapshot.firstWatchCompletedAt]);

  // 시청 시작 클릭 시각 (서버 started_at 보정용)
  const onStartClickCapture = () => {
    if (phaseRef.current === "ready") playStartedAtRef.current = performance.now();
  };

  const charCount = Array.from(autosave.text.replace(/\s/g, "")).length;

  return (
    <div className="mx-auto max-w-3xl" onClickCapture={onStartClickCapture}>
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold" tabIndex={-1}>
          {label}
        </h1>
        <TimerDisplay remaining={timer.remaining} level={timer.level} limitKind={timer.limitKind} />
      </header>
      {mode === "practice" && (
        <p className="mb-4 rounded-lg bg-sky-50 px-4 py-2 text-sky-900" role="note">
          {copy.practice.banner}
        </p>
      )}

      <StudyVideoPlayer
        videoRef={videoRef}
        src={video.url}
        state={state}
        dispatch={dispatch}
        markUserSeek={markUserSeek}
        handlers={handlers}
        watermark={snapshot.settings.watermarkEnabled ? c.watermark(snapshot.settings.participantCode) : null}
        urlError={video.error}
        onRetry={() => {
          void video.refresh();
          dispatch({ type: "RETRY" });
        }}
      />

      <section className="mt-6 space-y-2" aria-labelledby="editor-label">
        <div className="flex items-end justify-between">
          <label id="editor-label" htmlFor="observation-text" className="text-lg font-medium">
            {c.editorLabel}
          </label>
          <span className="text-sm text-neutral-500">{c.charCount(charCount)}</span>
        </div>
        {!autosave.ready ? (
          <p className="text-neutral-500">{c.loadingDraft}</p>
        ) : (
          <Textarea
            id="observation-text"
            ref={editorRef}
            value={autosave.text}
            onChange={(e) => autosave.setText(e.target.value)}
            disabled={!editorOn}
            placeholder={editorOn ? c.editorPlaceholder : c.editorLocked}
            aria-describedby="editor-help"
            className="min-h-60 resize-y text-[17px] leading-relaxed disabled:bg-neutral-100"
            spellCheck={false}
          />
        )}
        <div className="flex items-center justify-between">
          <AutosaveStatus status={editorOn ? autosave.status : "idle"} lastSavedAt={autosave.lastSavedAt} />
          <p id="editor-help" className="sr-only">
            {editorOn ? c.editorPlaceholder : c.editorLocked}
          </p>
        </div>
        {sessionExpired && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-red-800">
            {c.sessionExpired}{" "}
            <a className="underline" href="/enter?reason=session_expired">
              다시 접속
            </a>
          </p>
        )}
        <div className="flex justify-end pt-2">
          <Button size="lg" className="h-12 px-8 text-base" disabled={!editorOn || submitting} onClick={() => setSubmitOpen(true)}>
            {c.submit}
          </Button>
        </div>
      </section>

      <SubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} onConfirm={() => void handleManualSubmit()} charCount={charCount} submitting={submitting} />

      {finished && (
        <div role="dialog" aria-modal="true" aria-labelledby="finished-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
            <h2 id="finished-title" className="text-xl font-semibold">
              {finished.type === "timeout" ? c.timeoutTitle : "제출되었습니다."}
            </h2>
            {finished.type === "timeout" && <p className="mt-3 text-neutral-700">{c.timeoutBody}</p>}
            <Button size="lg" className="mt-6 h-12 w-full text-base" autoFocus onClick={() => router.replace(finished.next)}>
              {c.next}
            </Button>
          </div>
        </div>
      )}

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>
    </div>
  );
}
