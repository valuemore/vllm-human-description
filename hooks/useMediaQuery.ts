"use client";

import { useSyncExternalStore } from "react";

/** SSR 안전한 matchMedia 구독. 서버/하이드레이션 시점에는 false. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
