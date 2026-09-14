/**
 * 연구영상 길이 제한 (관리자 업로드 검증·경고, 참여자 안내 문구가 공유).
 * - 최대 90초(1분 30초): 초과 파일은 finalize 단계에서 거부한다.
 * - 최소 30초: 권장 하한이며 경고만 표시한다.
 */
export const MAX_RESEARCH_VIDEO_MS = 90_000;
export const MIN_RESEARCH_VIDEO_MS = 30_000;
/** 브라우저 duration 반올림 오차 허용치 */
export const RESEARCH_VIDEO_TOLERANCE_MS = 500;

export function exceedsResearchVideoMax(durationMs: number) {
  return durationMs > MAX_RESEARCH_VIDEO_MS + RESEARCH_VIDEO_TOLERANCE_MS;
}

export function isOutsideRecommendedRange(durationMs: number) {
  return durationMs < MIN_RESEARCH_VIDEO_MS || exceedsResearchVideoMax(durationMs);
}

/** 90000 → "1분 30초", 60000 → "1분", 45000 → "45초" */
export function formatDurationKo(ms: number) {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}초`;
  return s === 0 ? `${m}분` : `${m}분 ${s}초`;
}
