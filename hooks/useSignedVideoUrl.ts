"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiClientError, apiPost } from "@/lib/client/api";

type Signed = { url: string; expiresAt: string; mimeType: string };

/** 관찰 영상 signed URL. 만료 60초 전 자동 갱신. 오류 코드는 호출자가 처리. */
export function useSignedVideoUrl(observationId: string, enabled = true) {
  const [signed, setSigned] = useState<Signed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const refreshRef = useRef<(() => Promise<Signed | null>) | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await apiPost<Signed>("/api/videos/sign", { observation_id: observationId });
      setSigned(data);
      setError(null);
      const ms = Math.max(new Date(data.expiresAt).getTime() - Date.now() - 60_000, 30_000);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => void refreshRef.current?.(), ms);
      return data;
    } catch (e) {
      setError(e instanceof ApiClientError ? e.code : "NETWORK");
      return null;
    }
  }, [observationId]);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const kick = window.setTimeout(() => void refreshRef.current?.(), 0);
    return () => {
      window.clearTimeout(kick);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return { url: signed?.url ?? null, mimeType: signed?.mimeType ?? "video/mp4", error, refresh };
}
