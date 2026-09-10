/**
 * 참여자 진행단계 판정 (순수함수).
 * participant.status 는 관리자용 표시값이며, 판정은 사실(fact) 기반으로 한다 → 상태 컬럼 오염·재접속에도 복구 가능.
 */
export type StudyStatus = "draft" | "pilot" | "ready" | "active" | "paused" | "closed" | "archived";
export type ParticipantStatus =
  | "invited" | "consented" | "onboarding" | "practice_completed" | "in_progress" | "completed" | "withdrawn" | "technical_issue";
export type ObservationStatus = "pending" | "in_progress" | "submitted" | "invalidated";

export type ObservationSummary = {
  id: string;
  presentationOrder: number | null;
  status: ObservationStatus;
  attemptNumber: number;
  invalidated: boolean;
};

export type ParticipantSnapshot = {
  studyStatus: StudyStatus;
  participantStatus: ParticipantStatus;
  guideAcknowledgedAt: string | null;
  hasConsent: boolean;
  hasDemographics: boolean;
  practice: ObservationSummary | null;
  main: ObservationSummary[];
};

export type ParticipantStep =
  | { step: "blocked"; reason: "study_inactive" | "withdrawn" | "technical_issue"; href: "/enter" }
  | { step: "welcome"; href: "/welcome" }
  | { step: "profile"; href: "/profile" }
  | { step: "guide"; href: "/guide" }
  | { step: "practice"; href: "/practice"; observationId: string }
  | { step: "study_hub"; href: "/study"; nextObservationId: string; nextOrder: number; completedCount: number; totalCount: number }
  | { step: "observation"; href: string; observationId: string; order: number; completedCount: number; totalCount: number }
  | { step: "complete"; href: "/complete" };

/** 무효화되지 않은 최신 attempt 만 남긴다 (presentation_order 별 1건) */
export function activeMainObservations(main: ObservationSummary[]): ObservationSummary[] {
  const byOrder = new Map<number, ObservationSummary>();
  for (const o of main) {
    if (o.invalidated || o.presentationOrder === null) continue;
    const prev = byOrder.get(o.presentationOrder);
    if (!prev || o.attemptNumber > prev.attemptNumber) byOrder.set(o.presentationOrder, o);
  }
  return [...byOrder.values()].sort((a, b) => a.presentationOrder! - b.presentationOrder!);
}

export function resolveNextStep(s: ParticipantSnapshot): ParticipantStep {
  if (s.studyStatus !== "active" && s.studyStatus !== "pilot") return { step: "blocked", reason: "study_inactive", href: "/enter" };
  if (s.participantStatus === "withdrawn") return { step: "blocked", reason: "withdrawn", href: "/enter" };
  if (s.participantStatus === "technical_issue") return { step: "blocked", reason: "technical_issue", href: "/enter" };
  if (!s.hasConsent) return { step: "welcome", href: "/welcome" };
  if (!s.hasDemographics) return { step: "profile", href: "/profile" };
  if (!s.guideAcknowledgedAt) return { step: "guide", href: "/guide" };
  if (s.practice && !s.practice.invalidated && s.practice.status !== "submitted") {
    return { step: "practice", href: "/practice", observationId: s.practice.id };
  }

  const active = activeMainObservations(s.main);
  const totalCount = active.length;
  const completedCount = active.filter((o) => o.status === "submitted").length;

  const inProgress = active.find((o) => o.status === "in_progress");
  if (inProgress) {
    return {
      step: "observation",
      href: `/study/${inProgress.id}`,
      observationId: inProgress.id,
      order: inProgress.presentationOrder!,
      completedCount,
      totalCount,
    };
  }
  const pending = active.find((o) => o.status === "pending");
  if (pending) {
    return {
      step: "study_hub",
      href: "/study",
      nextObservationId: pending.id,
      nextOrder: pending.presentationOrder!,
      completedCount,
      totalCount,
    };
  }
  if (totalCount > 0 && completedCount === totalCount) return { step: "complete", href: "/complete" };
  // 배정이 없는 비정상 상태: 허브에서 안내
  return { step: "study_hub", href: "/study", nextObservationId: "", nextOrder: 0, completedCount, totalCount };
}

export type RouteKey = "welcome" | "consent" | "profile" | "guide" | "practice" | "study" | "observation" | "complete";

/** 현재 라우트가 판정된 단계에서 허용되는지 */
export function isRouteAllowed(step: ParticipantStep, route: RouteKey, observationId?: string): boolean {
  switch (step.step) {
    case "blocked":
      return false;
    case "welcome":
      return route === "welcome" || route === "consent";
    case "profile":
      return route === "profile";
    case "guide":
      return route === "guide";
    case "practice":
      return route === "guide" || route === "practice";
    case "study_hub":
      if (route === "study" || route === "guide") return true;
      return route === "observation" && !!observationId && observationId === step.nextObservationId;
    case "observation":
      return route === "observation" && observationId === step.observationId;
    case "complete":
      return route === "complete";
  }
}
