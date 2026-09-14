import { describe, expect, it } from "vitest";
import { exceedsResearchVideoMax, formatDurationKo, isOutsideRecommendedRange, MAX_RESEARCH_VIDEO_MS } from "@/lib/video-limits";

describe("video-limits", () => {
  it("최대 90초, 반올림 오차 500ms 허용", () => {
    expect(MAX_RESEARCH_VIDEO_MS).toBe(90_000);
    expect(exceedsResearchVideoMax(60_001)).toBe(false);
    expect(exceedsResearchVideoMax(90_000)).toBe(false);
    expect(exceedsResearchVideoMax(90_500)).toBe(false);
    expect(exceedsResearchVideoMax(90_501)).toBe(true);
  });

  it("권장 범위 30~90초 밖이면 경고", () => {
    expect(isOutsideRecommendedRange(29_999)).toBe(true);
    expect(isOutsideRecommendedRange(30_000)).toBe(false);
    expect(isOutsideRecommendedRange(75_000)).toBe(false);
    expect(isOutsideRecommendedRange(91_000)).toBe(true);
  });

  it("한국어 길이 표기", () => {
    expect(formatDurationKo(90_000)).toBe("1분 30초");
    expect(formatDurationKo(60_000)).toBe("1분");
    expect(formatDurationKo(45_000)).toBe("45초");
  });
});
