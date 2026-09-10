"use client";

import { AlertTriangle, Clock } from "lucide-react";
import { formatClock, type TimerLevel } from "@/lib/timer/timerMath";
import { copy } from "@/lib/copy/participant.ko";

/** 남은 시간. 경고는 색상만이 아니라 아이콘+텍스트로 표현한다 (PRD §41). */
export function TimerDisplay({ remaining, level, started, maxSeconds }: { remaining: number; level: TimerLevel; started: boolean; maxSeconds: number }) {
  const t = copy.observation.timer;
  const suffix = level === "warn60" ? t.oneMinute : level === "warn30" ? t.thirty : level === "warn10" ? t.ten : level === "expired" ? t.expired : null;
  const warn = level !== "normal";
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1.5 font-mono text-lg tabular-nums ${warn ? "bg-amber-100 text-amber-900" : "bg-neutral-100 text-neutral-800"}`}
      aria-label={`${t.label} ${formatClock(started ? remaining : maxSeconds)}${suffix ? `, ${suffix}` : ""}`}
    >
      {warn ? <AlertTriangle className="size-5" aria-hidden="true" /> : <Clock className="size-5" aria-hidden="true" />}
      <span className="text-sm font-sans">{t.label}</span>
      <span className={level === "warn60" || level === "warn30" || level === "warn10" ? "font-bold" : ""}>{formatClock(started ? remaining : maxSeconds)}</span>
      {suffix && <span className="text-sm font-sans">· {suffix}</span>}
    </div>
  );
}
