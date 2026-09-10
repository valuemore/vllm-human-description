import "server-only";
import { redirect } from "next/navigation";
import { getParticipantContext, isStudyOpen, type ParticipantContext } from "@/lib/auth/participant";
import { loadParticipantSnapshot } from "@/lib/participant/snapshot";
import { isRouteAllowed, resolveNextStep, type ParticipantSnapshot, type ParticipantStep, type RouteKey } from "@/lib/participant/resolveNextStep";

export type GuardResult = { ctx: ParticipantContext; step: ParticipantStep; snapshot: ParticipantSnapshot };

/**
 * 참여자 페이지 공통 가드. 세션 없음 → /enter, 차단 → /enter?reason=…, 단계 불일치 → 판정된 단계로 redirect.
 * 각 page.tsx(서버 컴포넌트)에서 호출한다.
 */
export async function guardStep(route: RouteKey, observationId?: string): Promise<GuardResult> {
  const ctx = await getParticipantContext();
  if (!ctx) redirect("/enter?reason=session_expired");
  if (!isStudyOpen(ctx.study)) redirect("/enter?reason=study_inactive");
  if (ctx.participant.status === "withdrawn") redirect("/enter?reason=withdrawn");
  if (ctx.participant.status === "technical_issue") redirect("/enter?reason=technical_issue");

  const snapshot = await loadParticipantSnapshot(ctx);
  const step = resolveNextStep(snapshot);
  if (step.step === "blocked") redirect(`/enter?reason=${step.reason}`);
  if (!isRouteAllowed(step, route, observationId)) redirect(step.href);
  return { ctx, step, snapshot };
}
