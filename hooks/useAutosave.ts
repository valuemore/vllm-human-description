"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { ApiClientError, apiPut } from "@/lib/client/api";
import { AUTOSAVE_DEBOUNCE_MS, AUTOSAVE_MAX_WAIT_MS, backoffDelay, reconcileDraft, type AutosaveStatus } from "@/lib/autosave/draftReconcile";
import { localDraftStore } from "@/lib/autosave/localDraftStore";

export type DraftSaveResponse = { savedRevision: number; timer: { remainingSeconds: number } };

export type AutosaveHandlers = {
  onServerTimer: (remainingSeconds: number) => void;
  onTimedOut: () => void;
  onSessionExpired: () => void;
};

type Options = {
  observationId: string;
  initialText: string;
  initialRevision: number;
  submitted: boolean;
  /** 첫 시청 완료 후에만 서버 저장 가능 */
  enabled: boolean;
  handlers: RefObject<AutosaveHandlers | null>;
};

/**
 * 자동저장: 3초 debounce + 10초 maxWait, blur/hidden/pagehide/online 즉시 flush, 백오프 재시도, 로컬 캐시 reconcile.
 */
export function useAutosave(o: Options) {
  const { observationId, submitted, enabled, handlers } = o;
  const [text, setTextState] = useState(o.initialText);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [ready, setReady] = useState(false);
  const revisionRef = useRef(o.initialRevision);
  const savedRevisionRef = useRef(o.initialRevision);
  const textRef = useRef(o.initialText);
  const debounceRef = useRef<number | null>(null);
  const maxWaitRef = useRef<number | null>(null);
  const retryRef = useRef<number | null>(null);
  const attemptRef = useRef(0);
  const savingRef = useRef(false);
  const enabledRef = useRef(enabled);
  const saveRef = useRef<(() => Promise<boolean>) | null>(null);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const schedule = useCallback(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => void saveRef.current?.(), AUTOSAVE_DEBOUNCE_MS);
    if (!maxWaitRef.current) maxWaitRef.current = window.setTimeout(() => void saveRef.current?.(), AUTOSAVE_MAX_WAIT_MS);
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (!enabledRef.current || submitted || savingRef.current) return false;
    const revision = revisionRef.current;
    if (revision <= savedRevisionRef.current) {
      setStatus((s) => (s === "dirty" ? "saved" : s));
      return true;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    if (maxWaitRef.current) window.clearTimeout(maxWaitRef.current);
    debounceRef.current = maxWaitRef.current = null;
    savingRef.current = true;
    setStatus("saving");
    try {
      const { data } = await apiPut<DraftSaveResponse>(`/api/observations/${observationId}/draft`, { text: textRef.current, revision });
      savedRevisionRef.current = Math.max(savedRevisionRef.current, data.savedRevision);
      attemptRef.current = 0;
      setLastSavedAt(new Date());
      setStatus(revisionRef.current > savedRevisionRef.current ? "dirty" : "saved");
      handlers.current?.onServerTimer(data.timer.remainingSeconds);
      savingRef.current = false;
      if (revisionRef.current > savedRevisionRef.current) schedule();
      return true;
    } catch (err) {
      savingRef.current = false;
      if (err instanceof ApiClientError) {
        if (err.code === "TIMED_OUT" || err.code === "ALREADY_SUBMITTED") {
          handlers.current?.onTimedOut();
          return false;
        }
        if (err.code === "UNAUTHENTICATED") {
          handlers.current?.onSessionExpired();
          setStatus("error");
          return false;
        }
        if (err.code === "FIRST_WATCH_REQUIRED") {
          setStatus("dirty");
          return false;
        }
        setStatus(err.code === "NETWORK" || !navigator.onLine ? "offline" : "error");
      } else {
        setStatus("error");
      }
      const delay = backoffDelay(attemptRef.current++);
      retryRef.current = window.setTimeout(() => void saveRef.current?.(), delay);
      return false;
    }
  }, [observationId, submitted, handlers, schedule]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  const setText = useCallback(
    (next: string) => {
      textRef.current = next;
      revisionRef.current += 1;
      setTextState(next);
      localDraftStore.write(observationId, { text: next, revision: revisionRef.current });
      setStatus(navigator.onLine ? "dirty" : "offline");
      schedule();
    },
    [observationId, schedule],
  );

  /** 서버 초안과 로컬 캐시 조정 (마운트 시 1회) */
  const initialText = o.initialText;
  const initialRevision = o.initialRevision;
  useEffect(() => {
    const local = localDraftStore.read(observationId);
    const r = reconcileDraft({ server: { text: initialText, revision: initialRevision, submitted }, local });
    textRef.current = r.text;
    revisionRef.current = r.revision;
    savedRevisionRef.current = r.source === "local" ? initialRevision : r.revision;
    if (r.discardLocal) localDraftStore.clear(observationId);
    const t = window.setTimeout(() => {
      setTextState(r.text);
      setReady(true);
      if (r.pushToServer) {
        setStatus("dirty");
        schedule();
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [observationId, initialText, initialRevision, submitted, schedule]);

  // 활성화되는 순간 밀린 초안 저장
  useEffect(() => {
    if (enabled && revisionRef.current > savedRevisionRef.current) schedule();
  }, [enabled, schedule]);

  /** 즉시 저장 (제출 직전 등) */
  const flush = useCallback(() => save(), [save]);

  /** 페이지 이탈: sendBeacon 으로 마지막 초안 전송 */
  const flushBeacon = useCallback(() => {
    if (!enabledRef.current || submitted || revisionRef.current <= savedRevisionRef.current) return;
    try {
      navigator.sendBeacon(
        `/api/observations/${observationId}/draft`,
        new Blob([JSON.stringify({ text: textRef.current, revision: revisionRef.current })], { type: "text/plain" }),
      );
    } catch {
      /* 로컬 캐시에 남아 있음 */
    }
  }, [observationId, submitted]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") flushBeacon();
    };
    const onOnline = () => {
      setStatus((s) => (s === "offline" ? "dirty" : s));
      void save();
    };
    const onOffline = () => setStatus((s) => (s === "saved" || s === "idle" ? s : "offline"));
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flushBeacon);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flushBeacon);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      for (const r of [debounceRef, maxWaitRef, retryRef]) {
        if (r.current) window.clearTimeout(r.current);
        r.current = null;
      }
    };
  }, [flushBeacon, save]);

  const clearLocal = useCallback(() => localDraftStore.clear(observationId), [observationId]);
  const getSnapshot = useCallback(() => ({ text: textRef.current, revision: revisionRef.current }), []);

  return { text, setText, status, lastSavedAt, ready, flush, clearLocal, getSnapshot };
}
