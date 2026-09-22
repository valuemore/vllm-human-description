import { describe, expect, it } from "vitest";
import { countUnreviewedDrafts, draftFileSchema, draftMatchesCoding, locateClaims } from "@/lib/coding/draftClaims";

describe("locateClaims", () => {
  const S1 = "교사가 시범을 보인다.";
  const S2 = "영아가 공을 굴린다.";
  const S3 = "교사를 바라본다.";
  const text = `${S1} ${S2}  ${S2} ${S3}`;
  const at = (s: string, from = 0) => {
    const start = text.indexOf(s, from);
    return { start, end: start + s.length };
  };
  const second = at(S2, at(S2).end);

  it("순서대로 정확한 위치를 찾는다", () => {
    const spans = locateClaims(text, [{ text: S1 }, { text: S2 }, { text: S3 }]);
    expect(spans).toEqual([at(S1), at(S2), at(S3)]);
    for (const [i, s] of spans.entries()) expect(text.slice(s!.start, s!.end)).toBe([S1, S2, S3][i]);
  });

  it("같은 문장이 두 번 나오면 직전 Claim 이후에서 찾는다", () => {
    const spans = locateClaims(text, [{ text: S2 }, { text: S2 }]);
    expect(spans[0]).toEqual(at(S2));
    expect(spans[1]).toEqual(second);
  });

  it("앞뒤 공백은 무시하고 내부 공백 차이는 공백 무시 검색으로 보정한다", () => {
    const spans = locateClaims(text, [{ text: `  ${S1}  ` }, { text: "영아가  공을 굴린다." }]);
    expect(spans[0]).toEqual(at(S1));
    expect(spans[1]).toEqual(at(S2));
    expect(text.slice(spans[1]!.start, spans[1]!.end)).toBe(S2);
  });

  it("원문에 없는 문장은 null", () => {
    expect(locateClaims(text, [{ text: "영아가 블록을 던진다." }])).toEqual([null]);
    expect(locateClaims(text, [{ text: "   " }])).toEqual([null]);
  });

  it("공백 무시 검색도 직전 위치 이후를 우선한다", () => {
    const spans = locateClaims(text, [{ text: S2 }, { text: "영아가공을굴린다." }]);
    expect(spans[1]).toEqual(second);
  });
});

describe("draftFileSchema", () => {
  const base = {
    source_type: "teacher",
    source_record_id: "66c45137-85f5-47ea-93af-2119f0e3c016",
    claims: [
      {
        order: 1,
        text: "영아가 공을 굴린다.",
        support_type: "observed",
        matched_reference_event_id: "1cc3b38b-1e9e-4d28-a4e7-51cf4d7bc0e5",
        actor_accuracy: "correct",
        action_accuracy: "partial",
        object_accuracy: "not_applicable",
        temporal_accuracy: null,
        granularity_score: 2,
        note: "REF#2",
      },
    ],
  };

  it("유효한 파일을 통과시킨다", () => {
    expect(draftFileSchema.safeParse([base]).success).toBe(true);
  });

  it("열거형 밖의 값과 빈 claims 를 거부한다", () => {
    expect(draftFileSchema.safeParse([{ ...base, claims: [{ ...base.claims[0], support_type: "maybe" }] }]).success).toBe(false);
    expect(draftFileSchema.safeParse([{ ...base, claims: [] }]).success).toBe(false);
    expect(draftFileSchema.safeParse([{ ...base, claims: [{ ...base.claims[0], granularity_score: 4 }] }]).success).toBe(false);
  });
});

describe("countUnreviewedDrafts / draftMatchesCoding", () => {
  it("초안이면서 reviewed_at 이 없는 행만 센다", () => {
    expect(
      countUnreviewedDrafts([
        { draft_source: "x", reviewed_at: null },
        { draft_source: "x", reviewed_at: "2026-09-22T00:00:00Z" },
        { draft_source: null, reviewed_at: null },
      ]),
    ).toBe(1);
  });

  it("코딩 7개 필드가 초안과 같을 때만 일치", () => {
    const coding = { support_type: "observed", matched_reference_event_id: "a", actor_accuracy: "correct", action_accuracy: null, object_accuracy: null, temporal_accuracy: null, granularity_score: 2 };
    expect(draftMatchesCoding({ ...coding, note: "무시됨" }, coding)).toBe(true);
    expect(draftMatchesCoding({ ...coding, support_type: "hallucination" }, coding)).toBe(false);
    expect(draftMatchesCoding(null, coding)).toBe(false);
  });
});
