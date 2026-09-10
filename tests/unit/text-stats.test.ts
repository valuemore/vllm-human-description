import { describe, expect, it } from "vitest";
import { computeTextStats } from "@/lib/text-stats";

describe("computeTextStats", () => {
  it("빈 문자열", () => {
    expect(computeTextStats("")).toEqual({ characterCount: 0, wordCount: 0, sentenceCount: 0 });
    expect(computeTextStats(null)).toEqual({ characterCount: 0, wordCount: 0, sentenceCount: 0 });
    expect(computeTextStats("   \n ")).toEqual({ characterCount: 0, wordCount: 0, sentenceCount: 0 });
  });

  it("한국어 관찰기록", () => {
    const text = "아동 A가 오른손으로 블록을 집는다. 아동 B를 바라본다.\n블록을 내려놓는다";
    const s = computeTextStats(text);
    expect(s.characterCount).toBe(text.replace(/\s/g, "").length);
    expect(s.wordCount).toBe(10);
    expect(s.sentenceCount).toBe(3);
  });

  it("문장부호 연속·물음표·느낌표", () => {
    expect(computeTextStats("정말?! 그래... 응.").sentenceCount).toBe(3);
  });

  it("개행만 있는 구분", () => {
    expect(computeTextStats("첫 줄\n\n둘째 줄\n셋째 줄").sentenceCount).toBe(3);
  });
});
