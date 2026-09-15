"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { createLocalEventStorage, EventLogger, type EventBatch } from "@/lib/events/eventLogger";

function uuid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export type ServerTimerPayload = { timer?: { remainingSeconds: number | null }; status?: string; server_now?: string };

/**
 * 관찰별 이벤트 로거. fetch(JSON) 로 배치 전송, 페이지 이탈 시 sendBeacon(text/plain).
 * 응답의 timer/status 는 onServerResponse(ref) 로 전달해 타이머 재동기화에 쓴다.
 */
export function useEventLogger(observationId: string, onServerResponse: RefObject<((payload: ServerTimerPayload) => void) | null>) {
  const sessionId = useMemo(() => uuid(), []);

  const logger = useMemo(() => {
    const send = async (batch: EventBatch) => {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(batch),
        credentials: "same-origin",
        keepalive: true,
      });
      const body = (await res.json()) as { ok: boolean; data?: ServerTimerPayload; code?: string; server_now?: string };
      if (!res.ok || !body.ok) {
        // 세션 만료/종료된 관찰은 재시도해도 소용없으므로 성공 처리
        if (res.status === 401 || res.status === 409 || res.status === 404) return { status: body.code };
        throw new Error(body.code ?? `HTTP ${res.status}`);
      }
      if (body.data) onServerResponse.current?.({ ...body.data, server_now: body.server_now });
      return { status: body.data?.status };
    };
    const beacon = (batch: EventBatch) => {
      try {
        return navigator.sendBeacon("/api/events", new Blob([JSON.stringify(batch)], { type: "text/plain" }));
      } catch {
        return false;
      }
    };
    return new EventLogger({
      observationId,
      clientSessionId: sessionId,
      transport: { send, beacon },
      storage: typeof window !== "undefined" ? createLocalEventStorage(observationId) : undefined,
    });
  }, [observationId, sessionId, onServerResponse]);

  const loggerRef = useRef(logger);
  useEffect(() => {
    loggerRef.current = logger;
  }, [logger]);

  useEffect(() => {
    logger.resume();
    const onHide = () => {
      if (document.visibilityState === "hidden") logger.flushOnUnload();
    };
    const onPageHide = () => logger.flushOnUnload();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      logger.flushOnUnload();
      logger.stop();
    };
  }, [logger]);

  return { logger, sessionId };
}
