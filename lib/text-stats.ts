/**
 * 텍스트 통계. DB 함수 compute_text_stats 와 동일 규칙을 유지한다 (tests/db 에서 동등성 검증).
 * - characterCount : 공백·개행 제외 글자 수
 * - wordCount      : 공백 기준 토큰 수
 * - sentenceCount  : [.!?。] 또는 개행으로 분리한 비어 있지 않은 조각 수
 */
export type TextStats = { characterCount: number; wordCount: number; sentenceCount: number };

export function computeTextStats(text: string | null | undefined): TextStats {
  const t = text ?? "";
  const characterCount = Array.from(t.replace(/\s/g, "")).length;
  const trimmed = t.trim();
  const wordCount = trimmed === "" ? 0 : trimmed.split(/\s+/).filter((w) => w !== "").length;
  const sentenceCount = t.split(/[.!?。]+|\n+/).filter((s) => s.trim() !== "").length;
  return { characterCount, wordCount, sentenceCount };
}
