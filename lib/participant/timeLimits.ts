import type { TimeLimits } from "@/lib/copy/participant.ko";

/** studies 설정(초) → 참여자 안내용 분 단위. null 은 그대로 null (해당 제한 없음) */
export function toTimeLimits(study: { max_observation_seconds: number | null; total_time_limit_seconds: number | null }): TimeLimits {
  return {
    perVideoMinutes: study.max_observation_seconds === null ? null : Math.round(study.max_observation_seconds / 60),
    totalMinutes: study.total_time_limit_seconds === null ? null : Math.round(study.total_time_limit_seconds / 60),
  };
}

/** 전체 마감까지 남은 초 (서버 시각 기준). 마감 미설정이면 null */
export function totalRemainingSeconds(mainDeadlineAt: string | null, now: number = Date.now()): number | null {
  if (!mainDeadlineAt) return null;
  return (new Date(mainDeadlineAt).getTime() - now) / 1000;
}
