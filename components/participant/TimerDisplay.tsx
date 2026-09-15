"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { formatClock, type TimerLevel } from "@/lib/timer/timerMath";
import type { LimitKind } from "@/lib/timer";
import { copy } from "@/lib/copy/participant.ko";

/**
 * 남은 시간. 경고는 색상만이 아니라 아이콘+텍스트로 표현한다 (PRD §41).
 * remaining null = 제한 없음. limitKind total = 참여자 전체 제한(모든 영상에 걸쳐 흐름).
 */
export function TimerDisplay({ remaining, level, limitKind }: { remaining: number | null; level: TimerLevel; limitKind: LimitKind }) {
  const t = copy.observation.timer;
  const suffix = level === "warn60" ? t.oneMinute : level === "warn30" ? t.thirty : level === "warn10" ? t.ten : level === "expired" ? t.expired : null;
  const warn = level !== "normal";
  const label = limitKind === "total" ? t.labelTotal : t.label;
  const clock = remaining === null ? t.noLimit : formatClock(remaining);
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-lg tabular-nums ${warn ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-800"}`}
      aria-label={`${label} ${clock}${suffix ? `, ${suffix}` : ""}`}
    >
      {warn ? <AlertTriangle className="size-5" aria-hidden="true" /> : <Clock className="size-5" aria-hidden="true" />}
      <span className="text-sm font-sans">{label}</span>
      <span className={remaining === null ? "text-sm font-sans" : level === "warn60" || level === "warn30" || level === "warn10" ? "font-bold" : ""}>{clock}</span>
      {suffix && <span className="text-sm font-sans">· {suffix}</span>}
    </div>
  );
}
