import { describe, expect, it } from "vitest";
import { isRouteAllowed, resolveNextStep, type ObservationSummary, type ParticipantSnapshot } from "@/lib/participant/resolveNextStep";

const obs = (id: string, order: number, status: ObservationSummary["status"], attempt = 1, invalidated = false): ObservationSummary => ({
  id,
  presentationOrder: order,
  status,
  attemptNumber: attempt,
  invalidated,
});

const base: ParticipantSnapshot = {
  studyStatus: "active",
  participantStatus: "in_progress",
  guideAcknowledgedAt: "2026-09-10T00:00:00Z",
  hasConsent: true,
  hasDemographics: true,
  practice: { id: "p", presentationOrder: null, status: "submitted", attemptNumber: 1, invalidated: false },
  main: [obs("a", 1, "submitted"), obs("b", 2, "pending"), obs("c", 3, "pending"), obs("d", 4, "pending"), obs("e", 5, "pending")],
};

describe("resolveNextStep", () => {
  it("연구 비활성 → blocked", () => {
    expect(resolveNextStep({ ...base, studyStatus: "paused" })).toMatchObject({ step: "blocked", reason: "study_inactive" });
    expect(resolveNextStep({ ...base, studyStatus: "pilot" }).step).not.toBe("blocked");
  });
  it("withdrawn / technical_issue → blocked", () => {
    expect(resolveNextStep({ ...base, participantStatus: "withdrawn" })).toMatchObject({ step: "blocked", reason: "withdrawn" });
    expect(resolveNextStep({ ...base, participantStatus: "technical_issue" })).toMatchObject({ step: "blocked", reason: "technical_issue" });
  });
  it("동의 없음 → welcome (상태 컬럼과 무관)", () => {
    expect(resolveNextStep({ ...base, hasConsent: false, participantStatus: "in_progress" }).step).toBe("welcome");
  });
  it("기본정보 없음 → profile", () => {
    expect(resolveNextStep({ ...base, hasDemographics: false }).step).toBe("profile");
  });
  it("안내 미확인 → guide", () => {
    expect(resolveNextStep({ ...base, guideAcknowledgedAt: null }).step).toBe("guide");
  });
  it("연습 미제출 → practice (진행 중이어도 같은 페이지에서 복구)", () => {
    expect(resolveNextStep({ ...base, practice: { ...base.practice!, status: "pending" } })).toMatchObject({ step: "practice", observationId: "p" });
    expect(resolveNextStep({ ...base, practice: { ...base.practice!, status: "in_progress" } }).step).toBe("practice");
  });
  it("연습영상 없음(null) 이면 건너뜀", () => {
    expect(resolveNextStep({ ...base, practice: null }).step).toBe("study_hub");
  });
  it("진행 중 관찰이 있으면 즉시 그 관찰로", () => {
    const s = { ...base, main: [obs("a", 1, "submitted"), obs("b", 2, "in_progress"), obs("c", 3, "pending")] };
    expect(resolveNextStep(s)).toMatchObject({ step: "observation", observationId: "b", order: 2, completedCount: 1, totalCount: 3, href: "/study/b" });
  });
  it("pending 중 최소 순서 → 허브", () => {
    expect(resolveNextStep(base)).toMatchObject({ step: "study_hub", nextObservationId: "b", nextOrder: 2, completedCount: 1, totalCount: 5 });
  });
  it("무효화된 attempt 는 무시하고 최신 attempt 기준", () => {
    const s = {
      ...base,
      main: [obs("a1", 1, "invalidated", 1, true), obs("a2", 1, "pending", 2), obs("b", 2, "submitted"), obs("c", 3, "submitted")],
    };
    expect(resolveNextStep(s)).toMatchObject({ step: "study_hub", nextObservationId: "a2", nextOrder: 1, completedCount: 2, totalCount: 3 });
  });
  it("모두 제출 → complete", () => {
    const s = { ...base, main: base.main.map((o) => ({ ...o, status: "submitted" as const })) };
    expect(resolveNextStep(s).step).toBe("complete");
  });
  it("N=7 배정도 총 개수는 배정 수에서 파생", () => {
    const main = Array.from({ length: 7 }, (_, i) => obs(`o${i + 1}`, i + 1, i < 3 ? "submitted" : "pending"));
    expect(resolveNextStep({ ...base, main })).toMatchObject({ step: "study_hub", completedCount: 3, totalCount: 7, nextOrder: 4 });
  });
});

describe("isRouteAllowed", () => {
  it("허브 단계에서는 다음 관찰만 열 수 있다", () => {
    const step = resolveNextStep(base);
    expect(isRouteAllowed(step, "study")).toBe(true);
    expect(isRouteAllowed(step, "observation", "b")).toBe(true);
    expect(isRouteAllowed(step, "observation", "c")).toBe(false);
    expect(isRouteAllowed(step, "complete")).toBe(false);
    expect(isRouteAllowed(step, "welcome")).toBe(false);
  });
  it("진행 중 단계에서는 그 관찰만", () => {
    const step = resolveNextStep({ ...base, main: [obs("a", 1, "in_progress"), obs("b", 2, "pending")] });
    expect(isRouteAllowed(step, "observation", "a")).toBe(true);
    expect(isRouteAllowed(step, "study")).toBe(false);
  });
  it("완료 후에는 complete 만", () => {
    const step = resolveNextStep({ ...base, main: base.main.map((o) => ({ ...o, status: "submitted" as const })) });
    expect(isRouteAllowed(step, "observation", "a")).toBe(false);
    expect(isRouteAllowed(step, "complete")).toBe(true);
  });
  it("blocked 는 모두 거부", () => {
    expect(isRouteAllowed(resolveNextStep({ ...base, studyStatus: "closed" }), "study")).toBe(false);
  });
});
