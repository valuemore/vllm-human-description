/**
 * Claim Coding 초안 파일의 스키마와 원문 내 Claim 위치 계산 (순수 로직, 서버/스크립트 공용).
 *
 * 초안 파일은 원문을 verbatim 부분 문자열로 나눈 Claim 과 코딩값을 담는다.
 * 위치 계산은 원문을 수정하지 않고, 앞 Claim 이 끝난 지점부터 순차 검색한다.
 */
import { z } from "zod";

export const SUPPORT_TYPES = ["observed", "observed_unreferenced", "inference_supported", "inference_unsupported", "hallucination", "unclear"] as const;
export const ACCURACY_LEVELS = ["correct", "partial", "incorrect", "not_applicable"] as const;

const accuracy = z.enum(ACCURACY_LEVELS).nullable();

export const draftClaimSchema = z.object({
  order: z.number().int().min(1),
  text: z.string().trim().min(1),
  support_type: z.enum(SUPPORT_TYPES),
  matched_reference_event_id: z.string().uuid().nullable(),
  actor_accuracy: accuracy,
  action_accuracy: accuracy,
  object_accuracy: accuracy,
  temporal_accuracy: accuracy,
  granularity_score: z.number().int().min(1).max(3).nullable(),
  note: z.string().nullable().default(null),
});

export const draftSourceSchema = z.object({
  source_type: z.enum(["teacher", "ai"]),
  source_record_id: z.string().uuid(),
  label: z.string().optional(),
  claims: z.array(draftClaimSchema).min(1),
});

export const draftFileSchema = z.array(draftSourceSchema);

export type DraftClaim = z.infer<typeof draftClaimSchema>;
export type DraftSource = z.infer<typeof draftSourceSchema>;

export type ClaimSpan = { start: number; end: number };

/** 공백을 제외한 문자만 남기고, 각 문자의 원문 인덱스를 함께 돌려준다. */
function compact(text: string): { chars: string; map: number[] } {
  const map: number[] = [];
  let chars = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (/\s/.test(ch)) continue;
    chars += ch;
    map.push(i);
  }
  return { chars, map };
}

/**
 * 원문에서 Claim 들의 [start, end) 위치를 순서대로 찾는다.
 * 1) 직전 Claim 끝부터 정확히 검색 → 2) 처음부터 정확히 검색 → 3) 공백 무시 검색. 못 찾으면 null.
 */
export function locateClaims(text: string, claims: { text: string }[]): (ClaimSpan | null)[] {
  const compacted = compact(text);
  let cursor = 0;
  let compactCursor = 0;
  return claims.map((c) => {
    const needle = c.text.trim();
    if (!needle) return null;
    let idx = text.indexOf(needle, cursor);
    if (idx < 0) idx = text.indexOf(needle);
    if (idx >= 0) {
      cursor = idx + needle.length;
      compactCursor = compacted.map.findIndex((m) => m >= cursor);
      if (compactCursor < 0) compactCursor = compacted.chars.length;
      return { start: idx, end: idx + needle.length };
    }
    const cn = compact(needle).chars;
    if (!cn) return null;
    let cidx = compacted.chars.indexOf(cn, compactCursor);
    if (cidx < 0) cidx = compacted.chars.indexOf(cn);
    if (cidx < 0) return null;
    const start = compacted.map[cidx];
    const end = compacted.map[cidx + cn.length - 1] + 1;
    cursor = end;
    compactCursor = cidx + cn.length;
    return { start, end };
  });
}

/** 세션 확정 전 검사: 확인되지 않은 초안 수 */
export function countUnreviewedDrafts(codings: { draft_source: string | null; reviewed_at: string | null }[]): number {
  return codings.filter((c) => c.draft_source !== null && c.reviewed_at === null).length;
}

/** 초안 원본값과 코더 저장값의 일치 여부 (감사·일치율 산출용) */
export function draftMatchesCoding(
  draft: Record<string, unknown> | null,
  coding: { support_type: string; matched_reference_event_id: string | null; actor_accuracy: string | null; action_accuracy: string | null; object_accuracy: string | null; temporal_accuracy: string | null; granularity_score: number | null },
): boolean {
  if (!draft) return false;
  const keys = ["support_type", "matched_reference_event_id", "actor_accuracy", "action_accuracy", "object_accuracy", "temporal_accuracy", "granularity_score"] as const;
  return keys.every((k) => (draft[k] ?? null) === (coding[k] ?? null));
}
